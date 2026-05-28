use serde_json::{json, Value};

use super::{strip_json_fence, JsonFeatureRequest};
use crate::integrations::ai::AiProvider;
use crate::models::{AssistedDescriptionDraft, LocalTask};

const SIMPLE_TASK_TITLE_WORD_LIMIT: usize = 4;
const ASSISTED_DESCRIPTION_BASE_CONTEXT: &str =
    include_str!("../../../../../docs/assisted-description-context.md");
const ASSISTED_DESCRIPTION_REQUIRED_HEADINGS: &[&str] = &[
    "## Historia de usuario",
    "## Contexto",
    "## Alcance",
    "## Criterios de aceptación",
    "## SRE Lite",
    "### Impacto esperado",
    "### Riesgos",
    "### Observabilidad / señales",
    "### Rollback / mitigación",
];
const ASSISTED_DESCRIPTION_TEMPLATE: &str = r#"## Historia de usuario

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

## Criterios de aceptación

- ...

## SRE Lite

### Impacto esperado
...

### Riesgos
- ...

### Observabilidad / señales
QA/Arte/Programacion/etc. debe validar:
- ...

### Rollback / mitigación
..."#;

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum AssistedDescriptionRequest {
    Clarification(AssistedDescriptionDraft),
    Generate(JsonFeatureRequest),
}

pub(crate) fn build_request(
    task: &LocalTask,
    additional_context: &str,
) -> Result<AssistedDescriptionRequest, String> {
    let additional_context = additional_context.trim();
    if task_description_needs_clarification(task, additional_context) {
        return Ok(AssistedDescriptionRequest::Clarification(
            clarification_draft_for_task(task),
        ));
    }

    let input = task_description_generation_context(task, additional_context);
    Ok(AssistedDescriptionRequest::Generate(JsonFeatureRequest {
        instructions: task_description_generation_instructions(),
        json_prompt: provider_task_description_json_prompt(&input),
        input,
        schema_name: "assisted_description_draft",
        schema: assisted_description_json_schema(),
        max_output_tokens: 2000,
    }))
}

pub(crate) fn parse_draft(
    provider: AiProvider,
    output_text: &str,
) -> Result<AssistedDescriptionDraft, String> {
    let draft: AssistedDescriptionDraft = serde_json::from_str(&strip_json_fence(output_text))
        .map_err(|error| {
            format!(
                "{} returned an invalid assisted description payload: {error}",
                provider.label()
            )
        })?;
    validate_assisted_description_draft(draft)
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
Use the base context as user and project preference context, especially stack defaults. \
Do not invent product behavior, implementation scope, acceptance criteria, risk, observability, or rollback detail. \
Prefer drafting over asking for clarification when the title, area, and user context describe a concrete problem or desired outcome. \
Do not ask about known defaults from the base context, such as the engine or primary stack. \
If the title and context are too thin to fill any useful section, return status needs_clarification with up to three concise questions in the task language and description null. \
If only one section is uncertain, draft the useful sections and put a short explicit uncertainty note in that section instead of making facts up. \
Keep the description compact and Jira-ready. Do not include markdown fences."
}

fn task_description_generation_context(task: &LocalTask, additional_context: &str) -> String {
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

    format!(
        "Base context:\n{base_context}\n\n\
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
        project = task.project,
        area = task.area,
        issue_type = task.issue_type,
        priority = task.priority,
        language = task.content_language,
        title = task.title,
        template = ASSISTED_DESCRIPTION_TEMPLATE
    )
}

fn validate_assisted_description_draft(
    mut draft: AssistedDescriptionDraft,
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
            if let Some(missing_heading) = ASSISTED_DESCRIPTION_REQUIRED_HEADINGS
                .iter()
                .find(|heading| !description.contains(**heading))
            {
                return Err(format!(
                    "AI provider omitted required assisted description section {missing_heading}."
                ));
            }
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
            "How should QA, art, programming, or another owner validate success?".to_string(),
        ];
    }

    vec![
        "Que usuario o persona se ve afectado, y que necesita lograr?".to_string(),
        "Que debe cambiar, incluyendo lo mas importante dentro y fuera de alcance?".to_string(),
        "Como debe validar el exito QA, Arte, Programacion u otro responsable?".to_string(),
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
        let request = build_request(&task_with_title("bug mesa"), "").expect("request builds");

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
        );

        assert!(context.contains("Unreal Engine 5"));
        assert!(context.contains("Do not ask which engine"));
        assert!(context.contains("Additional user context: mesa aparece sin patas"));
    }

    #[test]
    fn build_request_owns_assisted_description_prompt_shape() {
        let request = build_request(
            &task_with_title("Crear maquinas expendedoras para el anden del Metro"),
            "Validar escala y materiales en runtime.",
        )
        .expect("request builds");

        let AssistedDescriptionRequest::Generate(request) = request else {
            panic!("specific task should build a provider request");
        };

        assert!(request.input.contains("Target Markdown format:"));
        assert!(request.json_prompt.contains("\"status\":\"drafted\""));
        assert_eq!(request.schema_name, "assisted_description_draft");
        assert_eq!(request.max_output_tokens, 2000);
    }

    #[test]
    fn parses_json_fenced_assisted_description_output() {
        let draft = parse_draft(
            AiProvider::Gemini,
            "```json\n{\"status\":\"needs_clarification\",\"description\":null,\"clarificationQuestions\":[\"Que falta?\"]}\n```",
        )
        .expect("draft parses");

        assert_eq!(draft.status, "needs_clarification");
        assert_eq!(draft.description, None);
        assert_eq!(draft.clarification_questions, vec!["Que falta?"]);
    }

    #[test]
    fn validates_assisted_description_template_sections() {
        let draft = validate_assisted_description_draft(AssistedDescriptionDraft {
            status: " drafted ".to_string(),
            description: Some(
                "## Historia de usuario\n\nComo usuario,\nquiero algo,\npara lograr valor.\n\n\
## Contexto\n\nContexto claro.\n\n\
## Alcance\n\nIncluye:\n- A\n\nNo incluye:\n- B\n\n\
## Criterios de aceptación\n\n- Criterio\n\n\
## SRE Lite\n\n### Impacto esperado\nBajo\n\n\
### Riesgos\n- Riesgo\n\n\
### Observabilidad / señales\nQA/Arte/Programacion/etc. debe validar:\n- Senal\n\n\
### Rollback / mitigación\nMitigar."
                    .to_string(),
            ),
            clarification_questions: vec!["  ".to_string(), "extra".to_string()],
        })
        .expect("description template validates");

        assert_eq!(draft.status, "drafted");
        assert!(draft.description.is_some());
        assert!(draft.clarification_questions.is_empty());
    }

    #[test]
    fn validates_clarification_question_payload() {
        let draft = validate_assisted_description_draft(AssistedDescriptionDraft {
            status: "needs_clarification".to_string(),
            description: Some("ignore me".to_string()),
            clarification_questions: vec![
                " Que usuario se ve afectado? ".to_string(),
                " ".to_string(),
                " Que validacion espera? ".to_string(),
            ],
        })
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
            task_order: 0,
            created_at: "2026-05-26T00:00:00Z".to_string(),
            updated_at: "2026-05-26T00:00:00Z".to_string(),
        }
    }
}
