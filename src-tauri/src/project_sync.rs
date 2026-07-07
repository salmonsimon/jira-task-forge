use std::collections::{BTreeMap, HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::models::Category;

pub const TRANSVERSAL_PROJECT_NAME: &str = "Transversal";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JiraEpicProjectCandidate {
    pub key: String,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncDecision {
    pub name: String,
    pub normalized_name: String,
    pub status: String,
    pub jira_issue_keys: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncCandidate {
    pub name: String,
    pub normalized_name: String,
    pub jira_issue_keys: Vec<String>,
    pub status: String,
    pub already_local: bool,
    pub will_promote_local: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncSections {
    pub active: Vec<ProjectSyncCandidate>,
    pub newly_available: Vec<ProjectSyncCandidate>,
    pub ignored: Vec<ProjectSyncCandidate>,
    pub archived: Vec<ProjectSyncCandidate>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncReview {
    pub jira_project_key: String,
    pub jql: String,
    pub sections: ProjectSyncSections,
    pub default_active_names: Vec<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncApplyRequest {
    pub active_project_names: Vec<String>,
    pub ignored_project_names: Vec<String>,
    pub archived_project_names: Vec<String>,
    pub candidates: Vec<ProjectSyncCandidate>,
}

pub fn jira_epic_project_discovery_jql(project_key: &str) -> Result<String, String> {
    let project_key = project_key.trim().to_ascii_uppercase();
    if project_key.is_empty() {
        return Err("Jira creation project key is required.".to_string());
    }

    Ok(format!(
        "project = {} AND issuetype = Epic ORDER BY updated DESC",
        escape_jql_identifier(&project_key)
    ))
}

pub fn normalize_project_name(value: &str) -> String {
    let without_accents: String = value.trim().chars().map(normalize_char).collect();
    without_accents
        .to_lowercase()
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn extract_project_name_from_epic_summary(summary: &str) -> Option<String> {
    let trimmed = summary.trim();
    let close = trimmed.find(']')?;
    if !trimmed.starts_with('[') || close <= 1 {
        return None;
    }
    let project = trimmed[1..close].trim();
    if project.is_empty() || is_issue_type_word(project) {
        return None;
    }
    let rest = trimmed[close + 1..].trim_start();
    if rest.is_empty() {
        return None;
    }
    if !(rest.starts_with('[') || rest.chars().next().is_some_and(|character| character.is_alphanumeric())) {
        return None;
    }
    Some(project.to_string())
}

pub fn build_project_sync_review(
    jira_project_key: &str,
    jql: &str,
    local_projects: &[Category],
    discovered_epics: &[JiraEpicProjectCandidate],
    remembered_decisions: &[ProjectSyncDecision],
) -> ProjectSyncReview {
    let local_by_normalized = local_projects
        .iter()
        .map(|project| (normalize_project_name(&project.name), project))
        .collect::<HashMap<_, _>>();
    let remembered_by_normalized = remembered_decisions
        .iter()
        .map(|decision| (decision.normalized_name.clone(), decision))
        .collect::<HashMap<_, _>>();
    let mut discovered = BTreeMap::<String, ProjectSyncCandidate>::new();

    for epic in discovered_epics {
        let Some(name) = extract_project_name_from_epic_summary(&epic.summary) else {
            continue;
        };
        let normalized_name = normalize_project_name(&name);
        if normalized_name.is_empty() {
            continue;
        }
        let entry = discovered.entry(normalized_name.clone()).or_insert_with(|| {
            let local = local_by_normalized.get(&normalized_name);
            let remembered = remembered_by_normalized.get(&normalized_name);
            ProjectSyncCandidate {
                name: local.map(|category| category.name.clone()).unwrap_or(name),
                normalized_name: normalized_name.clone(),
                jira_issue_keys: Vec::new(),
                status: remembered
                    .map(|decision| decision.status.clone())
                    .unwrap_or_else(|| "new".to_string()),
                already_local: local.is_some(),
                will_promote_local: local.is_some_and(|category| category.source == "local"),
            }
        });
        entry.jira_issue_keys.push(epic.key.clone());
    }

    let transversal = ProjectSyncCandidate {
        name: TRANSVERSAL_PROJECT_NAME.to_string(),
        normalized_name: normalize_project_name(TRANSVERSAL_PROJECT_NAME),
        jira_issue_keys: Vec::new(),
        status: "active".to_string(),
        already_local: local_by_normalized.contains_key(&normalize_project_name(TRANSVERSAL_PROJECT_NAME)),
        will_promote_local: false,
    };

    let mut sections = ProjectSyncSections {
        active: vec![transversal],
        newly_available: Vec::new(),
        ignored: Vec::new(),
        archived: Vec::new(),
    };

    for candidate in discovered.into_values() {
        if candidate.normalized_name == normalize_project_name(TRANSVERSAL_PROJECT_NAME) {
            continue;
        }
        match candidate.status.as_str() {
            "active" => sections.active.push(candidate),
            "ignored" => sections.ignored.push(candidate),
            "archived" => sections.archived.push(candidate),
            _ => sections.newly_available.push(candidate),
        }
    }

    sections.active.sort_by(project_sort);
    sections.newly_available.sort_by(project_sort);
    sections.ignored.sort_by(project_sort);
    sections.archived.sort_by(project_sort);

    ProjectSyncReview {
        jira_project_key: jira_project_key.trim().to_ascii_uppercase(),
        jql: jql.to_string(),
        default_active_names: sections
            .active
            .iter()
            .chain(sections.newly_available.iter())
            .map(|candidate| candidate.name.clone())
            .collect(),
        notes: sections
            .newly_available
            .iter()
            .filter(|candidate| candidate.will_promote_local)
            .map(|candidate| {
                format!(
                    "{} already exists locally and will become official because it exists in Jira.",
                    candidate.name
                )
            })
            .collect(),
        sections,
    }
}

pub fn unique_project_names(names: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for name in names {
        let trimmed = name.trim();
        let normalized = normalize_project_name(trimmed);
        if trimmed.is_empty() || normalized.is_empty() || !seen.insert(normalized) {
            continue;
        }
        result.push(trimmed.to_string());
    }
    result
}

fn project_sort(left: &ProjectSyncCandidate, right: &ProjectSyncCandidate) -> std::cmp::Ordering {
    match (
        left.normalized_name == normalize_project_name(TRANSVERSAL_PROJECT_NAME),
        right.normalized_name == normalize_project_name(TRANSVERSAL_PROJECT_NAME),
    ) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
    }
}

fn is_issue_type_word(value: &str) -> bool {
    matches!(
        normalize_project_name(value).as_str(),
        "bug" | "story" | "epic" | "sub-task" | "subtask"
    )
}

fn normalize_char(character: char) -> char {
    match character {
        'á' | 'à' | 'ä' | 'â' | 'Á' | 'À' | 'Ä' | 'Â' => 'a',
        'é' | 'è' | 'ë' | 'ê' | 'É' | 'È' | 'Ë' | 'Ê' => 'e',
        'í' | 'ì' | 'ï' | 'î' | 'Í' | 'Ì' | 'Ï' | 'Î' => 'i',
        'ó' | 'ò' | 'ö' | 'ô' | 'Ó' | 'Ò' | 'Ö' | 'Ô' => 'o',
        'ú' | 'ù' | 'ü' | 'û' | 'Ú' | 'Ù' | 'Ü' | 'Û' => 'u',
        'ñ' | 'Ñ' => 'n',
        other => other,
    }
}

fn escape_jql_identifier(value: &str) -> String {
    if value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '_')
    {
        value.to_string()
    } else {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovers_project_names_from_supported_epic_summary_shapes() {
        assert_eq!(
            extract_project_name_from_epic_summary("[PilotLab] [Programación] Demo Version 1"),
            Some("PilotLab".to_string())
        );
        assert_eq!(
            extract_project_name_from_epic_summary("[MR Studio] VFX"),
            Some("MR Studio".to_string())
        );
        assert_eq!(extract_project_name_from_epic_summary("PilotLab [Bug] Demo"), None);
        assert_eq!(extract_project_name_from_epic_summary("[Bug] Fix timer"), None);
    }

    #[test]
    fn builds_project_sync_review_with_transversal_pinned_and_local_promotion_note() {
        let review = build_project_sync_review(
            "JTFTEST",
            "project = JTFTEST AND issuetype = Epic ORDER BY updated DESC",
            &[Category {
                id: "project-mr".to_string(),
                category_type: "project".to_string(),
                name: "MR Studio".to_string(),
                source: "local".to_string(),
                hidden: false,
                ignored: false,
                created_at: "now".to_string(),
                updated_at: "now".to_string(),
            }],
            &[
                JiraEpicProjectCandidate {
                    key: "JTFTEST-1".to_string(),
                    summary: "[PilotLab] [Bug] Demo".to_string(),
                },
                JiraEpicProjectCandidate {
                    key: "JTFTEST-2".to_string(),
                    summary: "[MR Studio] [VFX] Demo".to_string(),
                },
            ],
            &[],
        );

        assert_eq!(review.sections.active[0].name, TRANSVERSAL_PROJECT_NAME);
        assert_eq!(
            review
                .sections
                .newly_available
                .iter()
                .map(|candidate| candidate.name.as_str())
                .collect::<Vec<_>>(),
            vec!["MR Studio", "PilotLab"]
        );
        assert!(review.notes[0].contains("MR Studio already exists locally"));
        assert_eq!(
            review.default_active_names,
            vec!["Transversal", "MR Studio", "PilotLab"]
        );
    }
}
