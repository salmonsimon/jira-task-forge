use serde_json::{json, Value};

use self::template_policy::{normalize_heading, TemplatePolicy};
use super::{strip_json_fence, JsonFeatureRequest};
use crate::area_catalog::{catalog_context_for_area, resolve_catalog_area, CatalogAreaResolution};
use crate::integrations::ai::AiProvider;
use crate::models::{AssistedDescriptionDraft, LocalTask};

const SIMPLE_TASK_TITLE_WORD_LIMIT: usize = 4;
const ASSISTED_DESCRIPTION_BASE_CONTEXT: &str =
    include_str!("../../../../../docs/assisted-description-context.md");

mod template_policy {
    pub(super) struct TemplatePolicy {
        required_headings: &'static [&'static str],
        template: &'static str,
    }

    const STORY_REQUIRED_HEADINGS: &[&str] = &[
        "Historia de usuario",
        "Contexto",
        "Alcance",
        "Criterios de aceptacion",
        "Entregable mínimo",
        "Checklist antes de Review",
    ];
    const BUG_REQUIRED_HEADINGS: &[&str] = &[
        "Problema",
        "Contexto / impacto",
        "Pasos para reproducir",
        "Resultado actual",
        "Resultado esperado",
        "Evidencia",
        "Criterios de aceptacion",
        "Entregable mínimo",
        "Checklist antes de Review",
    ];
    const STORY_ASSISTED_DESCRIPTION_TEMPLATE: &str = r#"## Historia de usuario

Como [usuario/persona],
quiero [necesidad],
para que [beneficio].

## Contexto

[Contexto claro]

## Alcance

Incluye:
- ...

No incluye:
- ...

## Criterios de aceptacion

- ...

## Entregable mínimo

- ...

## Checklist antes de Review

- ...
"#;
    const BUG_ASSISTED_DESCRIPTION_TEMPLATE: &str = r#"## Problema

[Que falla.]

## Contexto / impacto

[A quien afecta y por que importa.]

## Pasos para reproducir

1. [Paso verificable.]

## Resultado actual

[Comportamiento observado.]

## Resultado esperado

[Comportamiento correcto.]

## Evidencia

- [Captura, video, log, PR, build, o referencia accesible.]

## Criterios de aceptacion

- [Resultado verificable.]

## Entregable mínimo

- [Cambio minimo necesario para resolver el problema.]

## Checklist antes de Review

- [Evidencia disponible para revisar.]
"#;

    impl TemplatePolicy {
        pub(super) fn for_issue_type(issue_type: &str) -> Self {
            if is_bug_issue_type(issue_type) {
                Self {
                    required_headings: BUG_REQUIRED_HEADINGS,
                    template: BUG_ASSISTED_DESCRIPTION_TEMPLATE,
                }
            } else {
                Self {
                    required_headings: STORY_REQUIRED_HEADINGS,
                    template: STORY_ASSISTED_DESCRIPTION_TEMPLATE,
                }
            }
        }

        pub(super) fn template(&self) -> &'static str {
            self.template
        }

        pub(super) fn required_headings(&self) -> &'static [&'static str] {
            self.required_headings
        }

        pub(super) fn final_headings(&self) -> [&'static str; 2] {
            ["Entregable mínimo", "Checklist antes de Review"]
        }

        pub(super) fn allows_heading(&self, heading: &str) -> bool {
            let normalized_heading = normalize_heading(heading);
            self.required_headings()
                .iter()
                .any(|required_heading| normalize_heading(required_heading) == normalized_heading)
        }
    }

    pub(super) fn normalize_heading(value: &str) -> String {
        value
            .trim()
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
            .join(" ")
    }

    fn is_bug_issue_type(issue_type: &str) -> bool {
        matches!(normalize_heading(issue_type).as_str(), "bug" | "error")
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum AssistedDescriptionRequest {
    Clarification(AssistedDescriptionDraft),
    Generate(JsonFeatureRequest),
}

pub(crate) fn build_request(
    task: &LocalTask,
    additional_context: &str,
    catalog_template_context: Option<&str>,
) -> Result<AssistedDescriptionRequest, String> {
    let additional_context = additional_context.trim();
    if task_description_needs_clarification(task, additional_context) {
        return Ok(AssistedDescriptionRequest::Clarification(
            clarification_draft_for_task(task),
        ));
    }

    let input =
        task_description_generation_context(task, additional_context, catalog_template_context);
    Ok(AssistedDescriptionRequest::Generate(JsonFeatureRequest {
        instructions: task_description_generation_instructions(),
        json_prompt: provider_task_description_json_prompt(&input),
        input,
        schema_name: "assisted_description_draft",
        schema: assisted_description_json_schema(),
        max_output_tokens: 3000,
    }))
}

pub(crate) fn parse_draft(
    provider: AiProvider,
    output_text: &str,
    issue_type: &str,
) -> Result<AssistedDescriptionDraft, String> {
    let draft: AssistedDescriptionDraft = serde_json::from_str(&strip_json_fence(output_text))
        .map_err(|error| {
            format!(
                "{} returned an invalid assisted description payload: {error}",
                provider.label()
            )
        })?;
    validate_assisted_description_draft(draft, issue_type)
}

fn provider_task_description_json_prompt(input: &str) -> String {
    format!(
        "{input}\n\nReturn only JSON matching this exact shape: {{\"status\":\"drafted\",\"description\":\"...\",\"clarificationQuestions\":[]}} or {{\"status\":\"needs_clarification\",\"description\":null,\"clarificationQuestions\":[\"...\"]}}. Do not include markdown fences."
    )
}

fn assisted_description_json_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "status": {
                "type": "string",
                "enum": ["drafted", "needs_clarification"]
            },
            "description": {
                "type": ["string", "null"],
                "description": "The complete Markdown Jira task description, or null when clarification is needed."
            },
            "clarificationQuestions": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Concise questions to ask before drafting when the input is too thin."
            }
        },
        "required": ["status", "description", "clarificationQuestions"]
    })
}

fn task_description_generation_instructions() -> &'static str {
    "You generate Assisted Descriptions for Jira Task Forge Local Tasks. Return only valid JSON matching the schema. \
Generated Jira task descriptions may be Spanish when the task language is Spanish. UI copy is not part of the response. \
Use the exact Markdown section headings from the requested template. \
Do not add headings or sections that are not present in the requested template. \
Use the base context as user and project preference context, especially stack defaults. \
Do not invent product behavior, implementation scope, or acceptance criteria. \
Do not add validation, risk, rollback, observability, open-question, suggested-subtask, or subtasks sections. \
When synced Notion catalog template context is present, treat its minimum deliverable and review checklist as mandatory requirements for the draft. The description must always end with the final sections ## Entregable mínimo and ## Checklist antes de Review, in that order. \
Catalog template headings are content requirements only; map them into the Target Markdown format and never replace the Target Markdown format headings. \
Prefer drafting over asking for clarification when the title, area, and user context describe a concrete problem or desired outcome. \
Do not ask about known defaults from the base context, such as the engine or primary stack. \
When no synced catalog template guidance exists for a manual or custom Area, do not invent area-specific delivery requirements, review checklist items, or synced catalog context; ask concise clarification questions when user input is needed to make those sections honest. \
If the title and context are too thin to fill any useful section, return status needs_clarification with up to three concise questions in the task language and description null. \
If missing information would materially change scope or acceptance criteria, return status needs_clarification with targeted questions instead of inventing Jira content. \
Keep the description compact and Jira-ready. Do not include markdown fences."
}

fn task_description_generation_context(
    task: &LocalTask,
    additional_context: &str,
    catalog_template_context: Option<&str>,
) -> String {
    let existing_description = task
        .description
        .as_deref()
        .map(str::trim)
        .filter(|description| !description.is_empty())
        .unwrap_or("None");
    let additional_context = if additional_context.is_empty() {
        "None"
    } else {
        additional_context
    };

    let policy = TemplatePolicy::for_issue_type(&task.issue_type);

    format!(
        "Base context:\n{base_context}\n\n\
{catalog_context}\n\n\
Local Task context:\n\
- Project: {project}\n\
- Area: {area}\n\
- Issue type: {issue_type}\n\
- Priority: {priority}\n\
- Task language: {language}\n\
- Title/prompt: {title}\n\
- Existing description: {existing_description}\n\
- Additional user context: {additional_context}\n\n\
Target Markdown format:\n{template}",
        base_context = ASSISTED_DESCRIPTION_BASE_CONTEXT.trim(),
        catalog_context = catalog_template_context
            .map(str::trim)
            .filter(|context| !context.is_empty())
            .map(ToString::to_string)
            .unwrap_or_else(|| {
                missing_or_fallback_catalog_context(task, additional_context, existing_description)
            }),
        project = task.project,
        area = task.area,
        issue_type = task.issue_type,
        priority = task.priority,
        language = task.content_language,
        title = task.title,
        template = policy.template()
    )
}

fn missing_or_fallback_catalog_context(
    task: &LocalTask,
    additional_context: &str,
    existing_description: &str,
) -> String {
    match resolve_catalog_area(&task.area) {
        CatalogAreaResolution::Official { .. } | CatalogAreaResolution::Normalized { .. } => {
            catalog_context_for_area(
                &task.area,
                &format!(
                    "{}\n{}\n{}",
                    task.title, additional_context, existing_description
                ),
            )
        }
        CatalogAreaResolution::Blocked => format!(
            "Manual catalog guidance:\n\
- No synced Notion catalog template context was found for Area: {area}.\n\
- Preserve the Target Markdown format exactly, including only the headings requested for this issue type.\n\
- Do not pretend official catalog template requirements exist for this Area.\n\
- If the title and user context do not give enough information for the requested sections, return needs_clarification with targeted questions.",
            area = task.area
        ),
    }
}

fn validate_assisted_description_draft(
    mut draft: AssistedDescriptionDraft,
    issue_type: &str,
) -> Result<AssistedDescriptionDraft, String> {
    draft.status = draft.status.trim().to_string();
    draft.description = draft
        .description
        .map(|description| description.trim().to_string())
        .filter(|description| !description.is_empty());
    draft.clarification_questions = draft
        .clarification_questions
        .into_iter()
        .map(|question| question.trim().to_string())
        .filter(|question| !question.is_empty())
        .take(3)
        .collect();

    match draft.status.as_str() {
        "drafted" => {
            let Some(description) = draft.description.as_deref() else {
                return Err("AI provider returned an empty assisted description.".to_string());
            };
            let policy = TemplatePolicy::for_issue_type(issue_type);
            validate_required_description_sections(description, &policy)?;
            validate_no_extra_description_sections(description, &policy)?;
            validate_final_description_sections(description, &policy)?;
            draft.clarification_questions.clear();
        }
        "needs_clarification" => {
            draft.description = None;
            if draft.clarification_questions.is_empty() {
                return Err(
                    "AI provider asked for clarification without returning questions.".to_string(),
                );
            }
        }
        _ => {
            return Err(format!(
                "AI provider returned unsupported assisted description status '{}'.",
                draft.status
            ));
        }
    }

    Ok(draft)
}

fn validate_required_description_sections(
    description: &str,
    policy: &TemplatePolicy,
) -> Result<(), String> {
    let headings = markdown_headings(description);
    let normalized_headings = headings
        .iter()
        .map(|heading| normalize_heading(heading))
        .collect::<Vec<_>>();
    if let Some(missing_heading) = policy
        .required_headings()
        .iter()
        .find(|heading| !normalized_headings.contains(&normalize_heading(heading)))
    {
        return Err(format!(
            "AI provider omitted required assisted description section ## {missing_heading}."
        ));
    }
    Ok(())
}

fn validate_no_extra_description_sections(
    description: &str,
    policy: &TemplatePolicy,
) -> Result<(), String> {
    for heading in markdown_headings(description) {
        if !policy.allows_heading(&heading) {
            return Err(format!(
                "AI provider returned out-of-template assisted description section ## {heading}."
            ));
        }
    }
    Ok(())
}

fn validate_final_description_sections(
    description: &str,
    policy: &TemplatePolicy,
) -> Result<(), String> {
    let heading_positions = markdown_heading_positions(description);
    let [deliverable_heading, checklist_heading] = policy.final_headings();
    let deliverable_index = heading_positions
        .iter()
        .find(|(_, heading)| normalize_heading(heading) == normalize_heading(deliverable_heading))
        .map(|(index, _)| *index)
        .ok_or_else(|| {
            "AI provider omitted final assisted description deliverable section.".to_string()
        })?;
    let checklist_index = heading_positions
        .iter()
        .find(|(_, heading)| normalize_heading(heading) == normalize_heading(checklist_heading))
        .map(|(index, _)| *index)
        .ok_or_else(|| {
            "AI provider omitted final assisted description checklist section.".to_string()
        })?;
    if checklist_index <= deliverable_index {
        return Err(
            "AI provider returned assisted description final sections in the wrong order."
                .to_string(),
        );
    }
    let after_checklist = description[checklist_index..].trim();
    let nested_heading_after_checklist = after_checklist
        .lines()
        .skip(1)
        .any(|line| line.trim_start().starts_with("## "));
    if nested_heading_after_checklist {
        return Err(
            "AI provider returned content after the final assisted description checklist section."
                .to_string(),
        );
    }
    Ok(())
}

fn markdown_headings(description: &str) -> Vec<String> {
    markdown_heading_positions(description)
        .into_iter()
        .map(|(_, heading)| heading)
        .collect()
}

fn markdown_heading_positions(description: &str) -> Vec<(usize, String)> {
    description
        .lines()
        .scan(0, |offset, line| {
            let current_offset = *offset;
            *offset += line.len() + 1;
            let trimmed = line.trim();
            Some(
                trimmed
                    .strip_prefix("## ")
                    .map(str::trim)
                    .filter(|heading| !heading.is_empty())
                    .map(|heading| (current_offset, heading.to_string())),
            )
        })
        .flatten()
        .collect()
}

fn task_description_needs_clarification(task: &LocalTask, additional_context: &str) -> bool {
    if !additional_context.trim().is_empty() {
        return false;
    }

    let title = task.title.trim();
    if title.is_empty() {
        return true;
    }

    title.split_whitespace().count() <= SIMPLE_TASK_TITLE_WORD_LIMIT
}

fn clarification_draft_for_task(task: &LocalTask) -> AssistedDescriptionDraft {
    AssistedDescriptionDraft {
        status: "needs_clarification".to_string(),
        description: None,
        clarification_questions: clarification_questions_for_language(&task.content_language),
    }
}

fn clarification_questions_for_language(language: &str) -> Vec<String> {
    if language.trim().eq_ignore_ascii_case("english") {
        return vec![
            "Who is affected, and what are they trying to accomplish?".to_string(),
            "What should change, including the most important in-scope and out-of-scope details?"
                .to_string(),
            "Which acceptance criteria would prove the change is complete?".to_string(),
        ];
    }

    vec![
        "Que usuario o persona se ve afectado, y que necesita lograr?".to_string(),
        "Que debe cambiar, incluyendo lo mas importante dentro y fuera de alcance?".to_string(),
        "Que criterios de aceptacion probarian que el cambio esta completo?".to_string(),
    ]
}

#[cfg(test)]
mod tests {
    use super::{
        build_request, parse_draft, task_description_generation_context,
        task_description_needs_clarification, validate_assisted_description_draft,
        AssistedDescriptionRequest,
    };
    use crate::integrations::ai::AiProvider;
    use crate::models::{AssistedDescriptionDraft, LocalTask};

    #[test]
    fn asks_for_clarification_when_task_title_is_too_thin() {
        let task = task_with_title("Maquinas expendedoras");

        assert!(task_description_needs_clarification(&task, ""));
        assert!(!task_description_needs_clarification(
            &task,
            "Crear un set dressing de maquinas expendedoras para el anden del Metro, validando escala, materiales y ubicacion final."
        ));
    }

    #[test]
    fn build_request_returns_clarification_before_provider_work() {
        let request =
            build_request(&task_with_title("bug mesa"), "", None).expect("request builds");

        let AssistedDescriptionRequest::Clarification(draft) = request else {
            panic!("short task should ask for clarification");
        };
        assert_eq!(draft.status, "needs_clarification");
        assert_eq!(draft.description, None);
        assert_eq!(draft.clarification_questions.len(), 3);
    }

    #[test]
    fn task_description_context_includes_user_stack_defaults() {
        let task = task_with_title("bug mesa");
        let context = task_description_generation_context(
            &task,
            "mesa aparece sin patas en runtime y afecta todas las escenas",
            None,
        );

        assert!(context.contains("Unreal Engine 5"));
        assert!(context.contains("Do not ask which engine"));
        assert!(context.contains("Additional user context: mesa aparece sin patas"));
    }

    #[test]
    fn task_description_context_includes_catalog_guidance_for_area() {
        let task = LocalTask {
            area: "Programacion".to_string(),
            issue_type: "Story".to_string(),
            ..task_with_title("Implementar cooldown de habilidad")
        };
        let context = task_description_generation_context(
            &task,
            "La habilidad puede dispararse muchas veces seguidas.",
            None,
        );

        assert!(context.contains("Official catalog context:"));
        assert!(context.contains("- Official area display name: Programación"));
        assert!(context.contains("- Jira label: Programación"));
        assert!(context.contains("- Delivery format: Feature de Programación"));
        assert!(context.contains("- Issue type derivation: Story"));
        assert!(context.contains("Use the official area display name in visible summaries"));
    }

    #[test]
    fn task_description_context_uses_synced_catalog_template_requirements() {
        let task = LocalTask {
            area: "Programación".to_string(),
            issue_type: "Story".to_string(),
            ..task_with_title("Implementar cooldown de habilidad")
        };
        let context = task_description_generation_context(
            &task,
            "La habilidad puede dispararse muchas veces seguidas.",
            Some(
                "Synced Notion catalog template:
- Delivery format: Feature de Programación
- Minimum deliverable: PR/MR listo con implementación y validación.
- Review checklist:
- PR/MR creado.
- Validado en runtime.",
            ),
        );

        assert!(context.contains("Synced Notion catalog template:"));
        assert!(context.contains("Minimum deliverable: PR/MR listo"));
        assert!(context.contains("Review checklist:"));
        assert!(context.contains("Validado en runtime."));
    }

    #[test]
    fn task_description_context_is_honest_when_manual_area_has_no_catalog_guidance() {
        let task = LocalTask {
            area: "Gameplay Experiments".to_string(),
            issue_type: "Story".to_string(),
            ..task_with_title("Probar interaccion de portal con objetivos")
        };
        let context = task_description_generation_context(
            &task,
            "Explorar si el portal puede activar objetivos cercanos sin romper el flujo actual.",
            None,
        );

        assert!(context.contains("Manual catalog guidance:"));
        assert!(context.contains(
            "No synced Notion catalog template context was found for Area: Gameplay Experiments."
        ));
        assert!(context.contains(
            "Do not pretend official catalog template requirements exist for this Area."
        ));
        assert!(context.contains("return needs_clarification with targeted questions"));
        assert!(!context.contains("Official catalog context:"));
        assert!(!context.contains("Synced Notion catalog template:"));
    }

    #[test]
    fn manual_area_context_preserves_base_assisted_description_structure() {
        let task = LocalTask {
            area: "Gameplay Experiments".to_string(),
            issue_type: "Story".to_string(),
            ..task_with_title("Probar interaccion de portal con objetivos")
        };
        let context = task_description_generation_context(
            &task,
            "Explorar si el portal puede activar objetivos cercanos.",
            None,
        );

        assert!(context.contains("## Historia de usuario"));
        assert!(context.contains("## Contexto"));
        assert!(context.contains("## Alcance"));
        assert!(context.contains("## Criterios de aceptacion"));
        assert!(context.contains("## Entregable mínimo"));
        assert!(context.contains("## Checklist antes de Review"));
    }

    #[test]
    fn bug_task_context_uses_bug_description_template() {
        let task = LocalTask {
            area: "Bug".to_string(),
            issue_type: "Bug".to_string(),
            ..task_with_title("Resolver timer que no se detiene al completar objetivos")
        };
        let context = task_description_generation_context(
            &task,
            "El timer queda corriendo despues del estado Completed.",
            None,
        );

        assert!(context.contains("## Problema"));
        assert!(context.contains("## Contexto / impacto"));
        assert!(context.contains("## Pasos para reproducir"));
        assert!(context.contains("## Resultado actual"));
        assert!(context.contains("## Resultado esperado"));
        assert!(context.contains("## Evidencia"));
        assert!(!context.contains("## Historia de usuario"));
        assert!(!context.contains("Como [usuario/persona]"));
    }

    #[test]
    fn task_description_context_separates_area_display_name_from_jira_label() {
        let task = LocalTask {
            area: "Selección Recurso".to_string(),
            issue_type: "Story".to_string(),
            ..task_with_title("Elegir asset base")
        };
        let context =
            task_description_generation_context(&task, "Seleccionar el recurso base.", None);

        assert!(context.contains("- Official area display name: Selección Recurso"));
        assert!(context.contains("- Jira label: Selección-Recurso"));
    }

    #[test]
    fn build_request_owns_assisted_description_prompt_shape() {
        let request = build_request(
            &task_with_title("Crear maquinas expendedoras para el anden del Metro"),
            "Validar escala y materiales en runtime.",
            None,
        )
        .expect("request builds");

        let AssistedDescriptionRequest::Generate(request) = request else {
            panic!("specific task should build a provider request");
        };

        assert!(request.input.contains("Target Markdown format:"));
        assert!(request.json_prompt.contains("\"status\":\"drafted\""));
        assert_eq!(request.schema_name, "assisted_description_draft");
        assert_eq!(request.max_output_tokens, 3000);
    }

    #[test]
    fn parses_json_fenced_assisted_description_output() {
        let draft = parse_draft(
            AiProvider::Gemini,
            "```json\n{\"status\":\"needs_clarification\",\"description\":null,\"clarificationQuestions\":[\"Que falta?\"]}\n```",
            "Story",
        )
        .expect("draft parses");

        assert_eq!(draft.status, "needs_clarification");
        assert_eq!(draft.description, None);
        assert_eq!(draft.clarification_questions, vec!["Que falta?"]);
    }

    #[test]
    fn validates_assisted_description_template_sections() {
        let draft = validate_assisted_description_draft(
            AssistedDescriptionDraft {
                status: " drafted ".to_string(),
                description: Some(
                    "## Historia de usuario

Como usuario,
quiero algo,
para lograr valor.

## Contexto

Contexto claro.

## Alcance

Incluye:
- A

No incluye:
- B

## Criterios de aceptacion

- Criterio

## Entregable mínimo

- Entregable

## Checklist antes de Review

- Checklist"
                        .to_string(),
                ),
                clarification_questions: vec!["  ".to_string(), "extra".to_string()],
            },
            "Story",
        )
        .expect("description template validates");

        assert_eq!(draft.status, "drafted");
        assert!(draft.description.is_some());
        assert!(draft.clarification_questions.is_empty());
    }

    #[test]
    fn validates_bug_description_template_sections() {
        let draft = validate_assisted_description_draft(
            AssistedDescriptionDraft {
                status: "drafted".to_string(),
                description: Some(
                    "## Problema

El timer no se detiene.

## Contexto / impacto

Afecta QA de cierre de objetivos.

## Pasos para reproducir

1. Completar el objetivo.

## Resultado actual

El timer sigue corriendo.

## Resultado esperado

El timer se detiene.

## Evidencia

- Video de QA.

## Criterios de aceptación

- El timer se detiene al completar objetivos.

## Entregable minimo

- Fix aplicado al cierre del flujo.

## Checklist antes de Review

- Evidencia adjunta."
                        .to_string(),
                ),
                clarification_questions: Vec::new(),
            },
            "Error",
        )
        .expect("bug description template validates");

        assert_eq!(draft.status, "drafted");
        assert!(draft.description.is_some());
    }

    #[test]
    fn rejects_out_of_template_sections_and_suggested_subtasks() {
        let error = validate_assisted_description_draft(
            AssistedDescriptionDraft {
                status: "drafted".to_string(),
                description: Some(
                    "## Historia de usuario

Como usuario, quiero algo.

## Contexto

Contexto.

## Alcance

Incluye:
- A

## Criterios de aceptacion

- Criterio

## Entregable mínimo

- Entregable

## Checklist antes de Review

- Checklist

## Subtasks sugeridas

- Crear una subtarea."
                        .to_string(),
                ),
                clarification_questions: Vec::new(),
            },
            "Story",
        )
        .expect_err("out-of-template heading should fail");

        assert!(error.contains("out-of-template"));
        assert!(error.contains("Subtasks sugeridas"));
    }

    #[test]
    fn rejects_descriptions_without_final_deliverable_and_checklist_sections() {
        let error = validate_assisted_description_draft(
            AssistedDescriptionDraft {
                status: "drafted".to_string(),
                description: Some(
                    "## Historia de usuario

Como usuario, quiero algo.

## Contexto

Contexto.

## Alcance

Incluye:
- A

## Criterios de aceptacion

- Criterio

## Checklist antes de Review

- Checklist

## Entregable mínimo

- Entregable"
                        .to_string(),
                ),
                clarification_questions: Vec::new(),
            },
            "Story",
        )
        .expect_err("wrong final section order should fail");

        assert!(error.contains("wrong order"));
    }

    #[test]
    fn validates_clarification_question_payload() {
        let draft = validate_assisted_description_draft(
            AssistedDescriptionDraft {
                status: "needs_clarification".to_string(),
                description: Some("ignore me".to_string()),
                clarification_questions: vec![
                    " Que usuario se ve afectado? ".to_string(),
                    " ".to_string(),
                    " Que validacion espera? ".to_string(),
                ],
            },
            "Story",
        )
        .expect("clarification validates");

        assert_eq!(draft.description, None);
        assert_eq!(
            draft.clarification_questions,
            vec!["Que usuario se ve afectado?", "Que validacion espera?"]
        );
    }

    fn task_with_title(title: &str) -> LocalTask {
        LocalTask {
            id: "task-1".to_string(),
            tray_id: "tray-1".to_string(),
            project: "STT".to_string(),
            area: "3D".to_string(),
            title: title.to_string(),
            priority: "Medium".to_string(),
            issue_type: "Story".to_string(),
            sync_status: "Pending".to_string(),
            description_status: "Missing".to_string(),
            description: None,
            content_language: "Spanish".to_string(),
            jira_key: None,
            jira_url: None,
            epic_key: None,
            parent_task_id: None,
            issue_relationships: Vec::new(),
            attachments: Vec::new(),
            task_order: 0,
            created_at: "2026-05-26T00:00:00Z".to_string(),
            updated_at: "2026-05-26T00:00:00Z".to_string(),
        }
    }
}
