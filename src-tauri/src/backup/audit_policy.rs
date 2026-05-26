use super::format::AuditSummaryBackup;

const AUDIT_SUMMARY_IMPORT_WARNING: &str =
    "Audit summaries were reviewed but are not imported into local audit tables yet.";

pub(crate) fn full_redacted_audit_included_in_current_export() -> bool {
    false
}

pub(crate) fn import_warnings(audit_summaries: &[AuditSummaryBackup]) -> Vec<String> {
    if audit_summaries.is_empty() {
        Vec::new()
    } else {
        vec![AUDIT_SUMMARY_IMPORT_WARNING.to_string()]
    }
}
