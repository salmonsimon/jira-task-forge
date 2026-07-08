use super::credentials::AI_API_KEY_ACCOUNT;
use super::AppServices;
use crate::integrations::ai::{ai_model_or_default, AiClient, AiCredentials, AiProvider};
use crate::models::{AssistedDescriptionDraft, EpicScopePluralSuggestion, JqlAiDraft};
use crate::repositories::{CategoryRepository, SyncedCatalogTemplateContext, TaskRepository};

impl AppServices {
    pub fn draft_jql_with_ai(&self, prompt: &str) -> Result<JqlAiDraft, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let provider = AiProvider::from_settings_value(&settings.ai_provider)?;
        let client = self.ai_client(provider)?;
        let model = ai_model_or_default(provider, &settings.ai_model);
        client.draft_jql(&model, prompt, Some(&settings.jira_creation_project_key))
    }

    pub fn suggest_transversal_epic_scope(
        &self,
        epic_scope: &str,
    ) -> Result<EpicScopePluralSuggestion, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let provider = AiProvider::from_settings_value(&settings.ai_provider)?;
        let client = self.ai_client(provider)?;
        let model = ai_model_or_default(provider, &settings.ai_model);
        client.suggest_transversal_epic_scope(&model, epic_scope)
    }

    pub fn generate_task_description(
        &self,
        task_id: &str,
        additional_context: Option<&str>,
        delivery_format: Option<&str>,
    ) -> Result<AssistedDescriptionDraft, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let provider = AiProvider::from_settings_value(&settings.ai_provider)?;
        let client = self.ai_client(provider)?;
        let model = ai_model_or_default(provider, &settings.ai_model);
        let task = {
            let connection = self.connection();
            TaskRepository::new(&connection)
                .find_by_id(task_id)
                .map_err(|error| format!("Could not load task: {error}"))?
        }
        .ok_or_else(|| "Task not found.".to_string())?;

        let mut synced_catalog_template = None;
        let catalog_context = {
            let connection = self.connection();
            let category_repository = CategoryRepository::new(&connection);
            let delivery_format = delivery_format
                .map(str::trim)
                .filter(|value| !value.is_empty());
            let synced_options = category_repository
                .catalog_delivery_format_options_for_area(&task.area)
                .map_err(|error| format!("Could not load catalog delivery formats: {error}"))?;

            if !synced_options.is_empty() {
                let Some(delivery_format) = delivery_format else {
                    return Err(
                        "Choose a delivery format before generating a description proposal."
                            .to_string(),
                    );
                };
                let template = category_repository
                    .catalog_template_for_confirmed_delivery_format(&task.area, delivery_format)
                    .map_err(|error| format!("Could not load catalog template context: {error}"))?
                    .ok_or_else(|| {
                        "Choose a delivery format with a synced catalog template before generating a description proposal."
                            .to_string()
                    })?;
                let prompt_context = template.prompt_context.clone();
                synced_catalog_template = Some(template);
                Some(prompt_context)
            } else {
                Some(unsynced_catalog_generation_context(&task.area))
            }
        };

        let mut draft = client.draft_task_description(
            &model,
            &task,
            additional_context,
            catalog_context.as_deref(),
            synced_catalog_template.is_none(),
        )?;
        if let Some(template) = synced_catalog_template.as_ref() {
            append_synced_catalog_final_sections(&mut draft, template);
        }
        Ok(draft)
    }

    pub fn test_ai_provider_connection(&self) -> Result<String, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let provider = AiProvider::from_settings_value(&settings.ai_provider)?;
        let model = ai_model_or_default(provider, &settings.ai_model);

        self.ai_client(provider)?.test_connection(&model)?;
        Ok(format!("{} connection succeeded.", provider.label()))
    }

    pub fn test_ai_provider_connection_with_api_key(
        &self,
        ai_provider: &str,
        api_key: &str,
    ) -> Result<String, String> {
        let provider = AiProvider::from_settings_value(ai_provider)?;
        let model = self.model_for_ai_provider(provider)?;

        self.ai_client_with_api_key(provider, api_key)?
            .test_connection(&model)?;
        Ok(format!("{} connection succeeded.", provider.label()))
    }

    pub fn list_ai_provider_models(
        &self,
        ai_provider: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<String>, String> {
        let provider = AiProvider::from_settings_value(ai_provider)?;
        let models = match api_key.map(str::trim).filter(|value| !value.is_empty()) {
            Some(api_key) => self
                .ai_client_with_api_key(provider, api_key)?
                .list_models()?,
            None => self.ai_client(provider)?.list_models()?,
        };

        if models.is_empty() {
            Ok(provider
                .fallback_models()
                .iter()
                .map(|model| (*model).to_string())
                .collect())
        } else {
            Ok(models)
        }
    }

    fn ai_client(&self, provider: AiProvider) -> Result<AiClient, String> {
        let api_key = self.ai_provider_api_key(provider)?;
        self.ai_client_with_api_key(provider, &api_key)
    }

    fn ai_client_with_api_key(
        &self,
        provider: AiProvider,
        api_key: &str,
    ) -> Result<AiClient, String> {
        let api_key = api_key.trim();
        if api_key.is_empty() {
            return Err(format!("{} API key cannot be empty.", provider.label()));
        }

        Ok(AiClient::new(AiCredentials {
            provider,
            api_key: api_key.to_string(),
        }))
    }

    fn ai_provider_api_key(&self, provider: AiProvider) -> Result<String, String> {
        let entry = keyring::Entry::new(provider.credential_service(), AI_API_KEY_ACCOUNT)
            .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(api_key) if api_key.trim().is_empty() => Err(format!(
                "{} API key is empty. Save a new API key in Settings.",
                provider.label()
            )),
            Ok(api_key) => Ok(api_key.trim().to_string()),
            Err(keyring::Error::NoEntry) => {
                Err(format!("{} API key is required.", provider.label()))
            }
            Err(error) => Err(format!(
                "Could not read {} API key: {error}",
                provider.label()
            )),
        }
    }

    fn model_for_ai_provider(&self, provider: AiProvider) -> Result<String, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let selected_provider = AiProvider::from_settings_value(&settings.ai_provider).ok();
        if selected_provider == Some(provider) {
            Ok(ai_model_or_default(provider, &settings.ai_model))
        } else {
            Ok(provider.default_model().to_string())
        }
    }
}

fn append_synced_catalog_final_sections(
    draft: &mut AssistedDescriptionDraft,
    template: &SyncedCatalogTemplateContext,
) {
    if draft.status != "drafted" {
        return;
    }
    let Some(description) = draft.description.as_deref() else {
        return;
    };

    let base_description = remove_synced_catalog_final_sections(description);
    let checklist = if template.review_checklist.is_empty() {
        "- None".to_string()
    } else {
        template
            .review_checklist
            .iter()
            .map(|item| format!("- {}", item.trim()))
            .collect::<Vec<_>>()
            .join("\n")
    };

    draft.description = Some(
        [
            base_description.trim_end(),
            "## Entregable mínimo",
            template.minimum_deliverable.trim(),
            "## Checklist antes de Review",
            checklist.as_str(),
        ]
        .join("\n\n"),
    );
}

fn unsynced_catalog_generation_context(area: &str) -> String {
    format!(
        "Unsynced catalog guidance:\n\
- No synced Notion catalog template is available for this Local Task.\n\
- Area is user-provided local input: {area}.\n\
- Infer the most likely delivery format from the Area, title, existing description, and user context.\n\
- Generate all requested Target Markdown sections, including Entregable mínimo and Checklist antes de Review, from that inferred context.\n\
- Do not claim that any official synced Notion deliverable or checklist was available."
    )
}

fn remove_synced_catalog_final_sections(description: &str) -> String {
    let final_section_start = description
        .lines()
        .scan(0, |offset, line| {
            let current_offset = *offset;
            *offset += line.len() + 1;
            Some((current_offset, line.trim()))
        })
        .find(|(_, line)| {
            normalize_markdown_heading(line).is_some_and(|heading| {
                heading == "entregable minimo" || heading == "checklist antes de review"
            })
        })
        .map(|(offset, _)| offset);

    match final_section_start {
        Some(offset) => description[..offset].trim_end().to_string(),
        None => description.trim().to_string(),
    }
}

fn normalize_markdown_heading(line: &str) -> Option<String> {
    let heading = line.strip_prefix("## ")?.trim();
    if heading.is_empty() {
        return None;
    }
    Some(
        heading
            .to_lowercase()
            .replace('á', "a")
            .replace('é', "e")
            .replace('í', "i")
            .replace('ó', "o")
            .replace('ú', "u")
            .replace('ü', "u")
            .replace('ñ', "n")
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() {
                    character
                } else {
                    ' '
                }
            })
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" "),
    )
}

#[cfg(test)]
mod tests {
    use super::{append_synced_catalog_final_sections, SyncedCatalogTemplateContext};
    use crate::models::AssistedDescriptionDraft;

    #[test]
    fn appends_exact_synced_final_sections_to_generated_description() {
        let mut draft = AssistedDescriptionDraft {
            status: "drafted".to_string(),
            description: Some(
                "## Historia de usuario

Como artista,
quiero preparar el asset.

## Contexto

Usar formato Arte Empaquetado.

## Alcance

- Empaquetar archivos.

## Criterios de aceptacion

- El paquete se puede revisar.

## Entregable mínimo

Texto inventado por IA.

## Checklist antes de Review

- Checklist inventado."
                    .to_string(),
            ),
            clarification_questions: Vec::new(),
        };
        let template = SyncedCatalogTemplateContext {
            prompt_context: "Synced Notion catalog template".to_string(),
            minimum_deliverable: "Zip o paquete disponible para integración manual.".to_string(),
            review_checklist: vec![
                "Zip o paquete disponible".to_string(),
                "estructura acordada".to_string(),
            ],
        };

        append_synced_catalog_final_sections(&mut draft, &template);

        let description = draft.description.expect("description remains");
        assert!(description.ends_with(
            "## Entregable mínimo\n\nZip o paquete disponible para integración manual.\n\n## Checklist antes de Review\n\n- Zip o paquete disponible\n- estructura acordada"
        ));
        assert!(!description.contains("Texto inventado por IA"));
        assert!(!description.contains("Checklist inventado"));
    }
}
