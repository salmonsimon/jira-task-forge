use crate::models::LocalTask;

pub(crate) const TBD_SCOPE: &str = "TBD";

#[derive(Debug, Clone, Copy)]
pub(crate) struct EpicScopeConfig<'a> {
    pub(crate) singular_scope: Option<&'a str>,
    pub(crate) transversal_scope: Option<&'a str>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct EpicTarget {
    pub(crate) local_project: String,
    pub(crate) area: String,
    pub(crate) scope: String,
}

impl EpicTarget {
    pub(crate) fn for_task(task: &LocalTask, config: EpicScopeConfig<'_>) -> Option<Self> {
        Some(Self {
            local_project: task.project.trim().to_string(),
            area: task.area.trim().to_string(),
            scope: effective_scope_for_project(&task.project, config)?,
        })
    }

    pub(crate) fn summary(&self) -> String {
        format!("[{}] [{}] {}", self.local_project, self.area, self.scope)
    }

    pub(crate) fn legacy_summary(&self) -> String {
        format!("[{}] {}", self.local_project, self.area)
    }

    pub(crate) fn searchable_summaries(&self) -> [String; 2] {
        [self.summary(), self.legacy_summary()]
    }

    pub(crate) fn matches_existing_summary(&self, summary: &str) -> bool {
        summary == self.summary() || summary == self.legacy_summary()
    }
}

pub(crate) fn effective_scope_for_project(
    project: &str,
    config: EpicScopeConfig<'_>,
) -> Option<String> {
    let singular = normalize_epic_scope(config.singular_scope)?;
    if singular == TBD_SCOPE {
        return Some(singular);
    }
    if project.trim().eq_ignore_ascii_case("Transversal") {
        return normalize_epic_scope(config.transversal_scope);
    }
    Some(singular)
}

pub(crate) fn normalize_epic_scope(scope: Option<&str>) -> Option<String> {
    let normalized = scope?.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return None;
    }
    if normalized.eq_ignore_ascii_case("[TBD]") || normalized.eq_ignore_ascii_case(TBD_SCOPE) {
        return Some(TBD_SCOPE.to_string());
    }
    Some(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_tbd_without_brackets() {
        assert_eq!(normalize_epic_scope(Some("[TBD]")).as_deref(), Some("TBD"));
        assert_eq!(normalize_epic_scope(Some(" tbd ")).as_deref(), Some("TBD"));
    }

    #[test]
    fn resolves_transversal_scope_only_when_confirmed() {
        let config = EpicScopeConfig {
            singular_scope: Some("Demo Version 1"),
            transversal_scope: None,
        };

        assert_eq!(
            effective_scope_for_project("STT", config).as_deref(),
            Some("Demo Version 1")
        );
        assert_eq!(effective_scope_for_project("Transversal", config), None);
    }

    #[test]
    fn tbd_scope_applies_to_transversal_without_plural_flow() {
        let config = EpicScopeConfig {
            singular_scope: Some("TBD"),
            transversal_scope: None,
        };

        assert_eq!(
            effective_scope_for_project("Transversal", config).as_deref(),
            Some("TBD")
        );
    }

    #[test]
    fn epic_target_owns_current_and_legacy_summaries() {
        let target = EpicTarget {
            local_project: "STT".to_string(),
            area: "Programacion".to_string(),
            scope: "Demo Version 1".to_string(),
        };

        assert_eq!(target.summary(), "[STT] [Programacion] Demo Version 1");
        assert_eq!(
            target.searchable_summaries(),
            [
                "[STT] [Programacion] Demo Version 1".to_string(),
                "[STT] Programacion".to_string(),
            ]
        );
        assert!(target.matches_existing_summary("[STT] [Programacion] Demo Version 1"));
        assert!(target.matches_existing_summary("[STT] Programacion"));
    }
}
