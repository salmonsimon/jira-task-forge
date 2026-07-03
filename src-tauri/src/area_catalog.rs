use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogArea {
    pub area_display_name: &'static str,
    pub jira_label: &'static str,
    pub aliases: &'static [&'static str],
    pub delivery_format: &'static str,
    pub conditional_delivery_formats: &'static [CatalogConditionalDeliveryFormat],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CatalogConditionalDeliveryFormat {
    pub format: &'static str,
    pub matches: &'static [&'static str],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OfficialAreaOption {
    pub area_display_name: &'static str,
    pub jira_label: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSyncResult {
    pub ok: bool,
    pub source_url: String,
    pub synced_area_count: usize,
    pub delivery_format_count: usize,
    pub rule_count: usize,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub areas: Vec<SyncedCatalogArea>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportableCatalog {
    #[serde(default)]
    pub areas: Vec<SyncedCatalogArea>,
    #[serde(default)]
    pub delivery_formats: Vec<SyncedDeliveryFormat>,
    #[serde(default)]
    pub area_format_rules: Vec<SyncedAreaFormatRule>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedCatalogArea {
    pub area_display_name: String,
    pub jira_label: String,
    #[serde(rename = "enabledInJTF", alias = "enabledInJtf")]
    pub enabled_in_jtf: bool,
    pub issue_type: String,
    pub default_delivery_format: String,
    #[serde(default)]
    pub safe_aliases: Vec<String>,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedDeliveryFormat {
    pub format_name: String,
    pub issue_type: String,
    #[serde(default)]
    pub story_headings: Vec<String>,
    pub minimum_deliverable: String,
    #[serde(default)]
    pub review_checklist: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedAreaFormatRule {
    pub area_display_name: String,
    pub priority: i64,
    pub condition: String,
    pub delivery_format: String,
    pub blocking: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CatalogAreaResolution {
    Official {
        area_display_name: &'static str,
        jira_label: &'static str,
    },
    Normalized {
        area_display_name: &'static str,
        jira_label: &'static str,
    },
    Blocked,
}

pub const CATALOG_SOURCE_URL: &str = "https://app.notion.com/p/387c335aece481c292baf6991a86a5c3";
pub const CATALOG_SYNCED_AT: &str = "2026-07-03";
pub const CATALOG_VERSION: &str = "2026.07.03-jtf-sync-catalog";
pub const CATALOG_MAINTENANCE_NOTE: &str =
    "Fallback catalog for Jira Task Forge Issue #141. Public/exportable catalog sync is the preferred runtime source.";

const ARCHITECTURE_CONDITIONAL_FORMATS: &[CatalogConditionalDeliveryFormat] = &[
    CatalogConditionalDeliveryFormat {
        format: "Arquitectura - Brief",
        matches: &["brief", "requerimiento", "contexto inicial"],
    },
    CatalogConditionalDeliveryFormat {
        format: "Arquitectura - Propuesta Final",
        matches: &["propuesta final", "decision final", "cerrar propuesta"],
    },
];

pub const OFFICIAL_AREAS: &[CatalogArea] = &[
    area("Bug", "Bug", &["bug"], "Bug", &[]),
    area(
        "Programación",
        "Programación",
        &["Programacion"],
        "Feature de Programación",
        &[],
    ),
    area(
        "Integración",
        "Integración",
        &["Integracion"],
        "Integración",
        &[],
    ),
    area(
        "Refactorización",
        "Refactorización",
        &["Refactorizacion"],
        "Feature de Programación",
        &[],
    ),
    area(
        "3D",
        "3D",
        &["Modelos 3D", "Modelo 3D"],
        "Arte Integrado",
        &[],
    ),
    area(
        "Animación",
        "Animación",
        &["Animacion"],
        "Arte Integrado",
        &[],
    ),
    area("Texturas", "Texturas", &[], "Arte Integrado", &[]),
    area(
        "Iluminación",
        "Iluminación",
        &["Iluminacion"],
        "Arte Integrado",
        &[],
    ),
    area("VFX", "VFX", &[], "Arte Integrado", &[]),
    area("SFX", "SFX", &[], "Integración", &[]),
    area("UI", "UI", &[], "Integración", &[]),
    area("Feeling", "Feeling", &[], "Feature de Programación", &[]),
    area("Diseño", "Diseño", &["Diseno"], "Decisión de Diseño", &[]),
    area("Concept", "Concept", &[], "Concept Art", &[]),
    area(
        "Localización",
        "Localización",
        &["Localizacion"],
        "Integración",
        &[],
    ),
    area(
        "Polish",
        "Polish",
        &["Pulido"],
        "Feature de Programación",
        &[],
    ),
    area(
        "Investigación",
        "Investigación",
        &["Investigacion"],
        "Investigación",
        &[],
    ),
    area(
        "Arquitectura",
        "Arquitectura",
        &[],
        "Arquitectura - Brief",
        ARCHITECTURE_CONDITIONAL_FORMATS,
    ),
    area("QA", "QA", &[], "QA", &[]),
    area(
        "Build",
        "Build",
        &["Build / Release"],
        "Build / Release",
        &[],
    ),
    area(
        "Producción",
        "Producción",
        &["Produccion"],
        "Producción Audiovisual",
        &[],
    ),
    area(
        "Documentación",
        "Documentación",
        &["Documentacion"],
        "Story base documental",
        &[],
    ),
    area(
        "Capacitación",
        "Capacitación",
        &["Capacitacion"],
        "Curso / Capacitación",
        &[],
    ),
    area(
        "Housekeeping",
        "Housekeeping",
        &[],
        "Feature de Programación",
        &[],
    ),
    area(
        "Selección Recurso",
        "Selección-Recurso",
        &["Seleccion Recurso"],
        "Selección Recurso",
        &[],
    ),
];

pub fn sync_exportable_catalog_from_url(source_url: &str) -> Result<CatalogSyncResult, String> {
    let source_url = source_url.trim();
    if source_url.is_empty() {
        return Err("Catalog source URL is required.".to_string());
    }

    let response = ureq::get(source_url)
        .set("Accept", "application/json, text/plain;q=0.8, */*;q=0.5")
        .timeout(std::time::Duration::from_secs(20))
        .call()
        .map_err(|error| format!("Could not read catalog source: {error}"))?;
    let body = response
        .into_string()
        .map_err(|error| format!("Could not read catalog response body: {error}"))?;

    if body.trim_start().starts_with("<!DOCTYPE html")
        || body.trim_start().starts_with("<html")
        || body.contains("notion.so/eap")
    {
        return Err(
            "This looks like a rendered Notion page, not an exportable JSON catalog. Publish or export the JTF Sync Catalog as JSON and use that URL."
                .to_string(),
        );
    }

    parse_exportable_catalog_json(source_url, &body)
}

pub fn parse_exportable_catalog_json(
    source_url: &str,
    body: &str,
) -> Result<CatalogSyncResult, String> {
    let catalog: ExportableCatalog = serde_json::from_str(body)
        .map_err(|error| format!("Catalog source must be valid JSON: {error}"))?;
    validate_exportable_catalog(source_url, catalog)
}

pub fn validate_exportable_catalog(
    source_url: &str,
    catalog: ExportableCatalog,
) -> Result<CatalogSyncResult, String> {
    let mut warnings = Vec::new();
    let mut errors = Vec::new();
    let formats: HashSet<String> = catalog
        .delivery_formats
        .iter()
        .map(|format| normalize_catalog_key(&format.format_name))
        .collect();
    let mut area_keys = HashSet::new();
    let mut label_keys = HashSet::new();
    let mut bug_areas = Vec::new();
    let mut enabled_areas = Vec::new();

    for area in &catalog.areas {
        if !area.enabled_in_jtf {
            if area.area_display_name.trim().is_empty() {
                warnings.push("Disabled catalog area is missing areaDisplayName.".to_string());
            }
            continue;
        }

        if area.area_display_name.trim().is_empty() {
            errors.push("Enabled area is missing areaDisplayName.".to_string());
        }
        if area.jira_label.trim().is_empty() {
            errors.push(format!("{} is missing jiraLabel.", area.area_display_name));
        }
        if !matches!(area.issue_type.trim(), "Story" | "Bug") {
            errors.push(format!(
                "{} has unsupported issueType {}.",
                area.area_display_name, area.issue_type
            ));
        }
        if area.default_delivery_format.trim().is_empty() {
            errors.push(format!(
                "{} is missing defaultDeliveryFormat.",
                area.area_display_name
            ));
        } else if !formats.contains(&normalize_catalog_key(&area.default_delivery_format)) {
            errors.push(format!(
                "{} references unknown delivery format {}.",
                area.area_display_name, area.default_delivery_format
            ));
        }

        if !area_keys.insert(normalize_catalog_key(&area.area_display_name)) {
            errors.push(format!(
                "Duplicate normalized areaDisplayName {}.",
                area.area_display_name
            ));
        }
        if !label_keys.insert(normalize_catalog_key(&area.jira_label)) {
            errors.push(format!(
                "Duplicate normalized jiraLabel {}.",
                area.jira_label
            ));
        }
        if area.issue_type.trim() == "Bug" {
            bug_areas.push(area.area_display_name.clone());
        }
        if normalize_catalog_key(&area.area_display_name) == "regularizacion" {
            errors.push("Regularización must remain disabled until Issue #135.".to_string());
        }
        enabled_areas.push(area.clone());
    }

    for format in &catalog.delivery_formats {
        if format.format_name.trim().is_empty() {
            errors.push("Delivery format is missing formatName.".to_string());
        }
        if !matches!(format.issue_type.trim(), "Story" | "Bug") {
            errors.push(format!(
                "{} has unsupported issueType {}.",
                format.format_name, format.issue_type
            ));
        }
        if format.story_headings.is_empty() {
            errors.push(format!("{} is missing storyHeadings.", format.format_name));
        }
        if format.minimum_deliverable.trim().is_empty() {
            errors.push(format!(
                "{} is missing minimumDeliverable.",
                format.format_name
            ));
        }
        if format.review_checklist.is_empty() {
            errors.push(format!(
                "{} is missing reviewChecklist.",
                format.format_name
            ));
        }
    }

    let enabled_area_keys: HashSet<String> = enabled_areas
        .iter()
        .map(|area| normalize_catalog_key(&area.area_display_name))
        .collect();
    for rule in &catalog.area_format_rules {
        if !enabled_area_keys.contains(&normalize_catalog_key(&rule.area_display_name))
            && normalize_catalog_key(&rule.area_display_name) != "regularizacion"
        {
            errors.push(format!(
                "Rule references unknown enabled area {}.",
                rule.area_display_name
            ));
        }
        if !formats.contains(&normalize_catalog_key(&rule.delivery_format)) {
            errors.push(format!(
                "Rule for {} references unknown delivery format {}.",
                rule.area_display_name, rule.delivery_format
            ));
        }
        if !rule.blocking && rule.condition.trim().len() > 80 {
            warnings.push(format!(
                "Rule for {} has a broad condition that should be reviewed.",
                rule.area_display_name
            ));
        }
    }

    if bug_areas.as_slice() != ["Bug"] {
        errors.push("Bug must be the only enabled area deriving issueType Bug.".to_string());
    }

    if !errors.is_empty() {
        return Ok(CatalogSyncResult {
            ok: false,
            source_url: source_url.to_string(),
            synced_area_count: 0,
            delivery_format_count: catalog.delivery_formats.len(),
            rule_count: catalog.area_format_rules.len(),
            warnings,
            errors,
            areas: Vec::new(),
        });
    }

    Ok(CatalogSyncResult {
        ok: true,
        source_url: source_url.to_string(),
        synced_area_count: enabled_areas.len(),
        delivery_format_count: catalog.delivery_formats.len(),
        rule_count: catalog.area_format_rules.len(),
        warnings,
        errors,
        areas: enabled_areas,
    })
}

pub fn resolve_catalog_area(input: &str) -> CatalogAreaResolution {
    let trimmed_input = input.trim();
    let normalized_input = normalize_catalog_key(trimmed_input);

    for catalog_area in OFFICIAL_AREAS {
        if catalog_area.area_display_name.to_lowercase() == trimmed_input.to_lowercase() {
            return CatalogAreaResolution::Official {
                area_display_name: catalog_area.area_display_name,
                jira_label: catalog_area.jira_label,
            };
        }

        if normalize_catalog_key(catalog_area.area_display_name) == normalized_input
            || normalize_catalog_key(catalog_area.jira_label) == normalized_input
            || catalog_area
                .aliases
                .iter()
                .any(|alias| normalize_catalog_key(alias) == normalized_input)
        {
            return CatalogAreaResolution::Normalized {
                area_display_name: catalog_area.area_display_name,
                jira_label: catalog_area.jira_label,
            };
        }
    }

    CatalogAreaResolution::Blocked
}

pub fn catalog_area_display_name(input: &str) -> Option<&'static str> {
    match resolve_catalog_area(input) {
        CatalogAreaResolution::Official {
            area_display_name, ..
        }
        | CatalogAreaResolution::Normalized {
            area_display_name, ..
        } => Some(area_display_name),
        CatalogAreaResolution::Blocked => None,
    }
}

pub fn catalog_jira_label(input: &str) -> Option<&'static str> {
    match resolve_catalog_area(input) {
        CatalogAreaResolution::Official { jira_label, .. }
        | CatalogAreaResolution::Normalized { jira_label, .. } => Some(jira_label),
        CatalogAreaResolution::Blocked => None,
    }
}

pub fn derive_issue_type_from_area(area: &str) -> &'static str {
    match resolve_catalog_area(area) {
        CatalogAreaResolution::Official {
            area_display_name: "Bug",
            ..
        }
        | CatalogAreaResolution::Normalized {
            area_display_name: "Bug",
            ..
        } => "Bug",
        _ => "Story",
    }
}

pub fn catalog_context_for_area(area: &str, description_or_deliverable: &str) -> String {
    match resolve_catalog_area(area) {
        CatalogAreaResolution::Official {
            area_display_name,
            jira_label,
        }
        | CatalogAreaResolution::Normalized {
            area_display_name,
            jira_label,
        } => catalog_context_for_resolved_area(area_display_name, jira_label, description_or_deliverable),
        CatalogAreaResolution::Blocked => format!(
            "Official catalog context:\n- Catalog version: {CATALOG_VERSION}\n- Catalog synced at: {CATALOG_SYNCED_AT}\n- Source: {CATALOG_SOURCE_URL}\n- Maintenance note: {CATALOG_MAINTENANCE_NOTE}\n- Area status: blocked non-official value\n- Official options: {}\n- Issue type derivation: Story\n- Warning: Choose an official catalog area before generating Jira labels or descriptions.",
            official_area_options()
                .iter()
                .map(|option| format!(
                    "{} ({})",
                    option.area_display_name, option.jira_label
                ))
                .collect::<Vec<_>>()
                .join(", ")
        ),
    }
}

pub fn official_area_options() -> Vec<OfficialAreaOption> {
    OFFICIAL_AREAS
        .iter()
        .map(|catalog_area| OfficialAreaOption {
            area_display_name: catalog_area.area_display_name,
            jira_label: catalog_area.jira_label,
        })
        .collect()
}

fn catalog_context_for_resolved_area(
    area_display_name: &str,
    jira_label: &str,
    description_or_deliverable: &str,
) -> String {
    let delivery_format = delivery_format_for_area(area_display_name, description_or_deliverable)
        .unwrap_or("Decisión pendiente");
    [
        "Official catalog context:".to_string(),
        format!("- Catalog version: {CATALOG_VERSION}"),
        format!("- Catalog synced at: {CATALOG_SYNCED_AT}"),
        format!("- Source: {CATALOG_SOURCE_URL}"),
        format!("- Maintenance note: {CATALOG_MAINTENANCE_NOTE}"),
        format!("- Official area display name: {area_display_name}"),
        format!("- Jira label: {jira_label}"),
        format!("- Delivery format: {delivery_format}"),
        format!(
            "- Issue type derivation: {}",
            derive_issue_type_from_area(area_display_name)
        ),
        "- Use the official area display name in visible summaries and readable content."
            .to_string(),
        "- Use the Jira label only in Jira labels or equivalent technical fields.".to_string(),
    ]
    .join("\n")
}

fn delivery_format_for_area(
    area_display_name: &str,
    description_or_deliverable: &str,
) -> Option<&'static str> {
    let catalog_area = OFFICIAL_AREAS
        .iter()
        .find(|entry| entry.area_display_name == area_display_name)?;
    let normalized_context = normalize_catalog_key(description_or_deliverable);
    if let Some(conditional_format) =
        catalog_area
            .conditional_delivery_formats
            .iter()
            .find(|candidate| {
                candidate
                    .matches
                    .iter()
                    .any(|term| normalized_context.contains(normalize_catalog_key(term).as_str()))
            })
    {
        return Some(conditional_format.format);
    }

    Some(catalog_area.delivery_format)
}

fn normalize_catalog_key(value: &str) -> String {
    let without_accents: String = value.trim().chars().map(normalize_catalog_char).collect();
    without_accents
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

const fn area(
    area_display_name: &'static str,
    jira_label: &'static str,
    aliases: &'static [&'static str],
    delivery_format: &'static str,
    conditional_delivery_formats: &'static [CatalogConditionalDeliveryFormat],
) -> CatalogArea {
    CatalogArea {
        area_display_name,
        jira_label,
        aliases,
        delivery_format,
        conditional_delivery_formats,
    }
}

fn normalize_catalog_char(ch: char) -> char {
    match ch {
        'á' | 'Á' => 'a',
        'é' | 'É' => 'e',
        'í' | 'Í' => 'i',
        'ó' | 'Ó' => 'o',
        'ú' | 'Ú' => 'u',
        'ñ' | 'Ñ' => 'n',
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        catalog_context_for_area, derive_issue_type_from_area, official_area_options,
        parse_exportable_catalog_json, resolve_catalog_area, CatalogAreaResolution,
        OfficialAreaOption, OFFICIAL_AREAS,
    };

    #[test]
    fn normalizes_safe_aliases() {
        assert_eq!(
            resolve_catalog_area("Programacion"),
            CatalogAreaResolution::Normalized {
                area_display_name: "Programación",
                jira_label: "Programación"
            }
        );
    }

    #[test]
    fn blocks_non_official_values_instead_of_preserving_them() {
        assert_eq!(
            resolve_catalog_area("Implementación"),
            CatalogAreaResolution::Blocked
        );
        assert_eq!(
            resolve_catalog_area("Compra"),
            CatalogAreaResolution::Blocked
        );
    }

    #[test]
    fn separates_display_area_name_from_jira_label() {
        assert_eq!(
            resolve_catalog_area("Selección Recurso"),
            CatalogAreaResolution::Official {
                area_display_name: "Selección Recurso",
                jira_label: "Selección-Recurso"
            }
        );
        let context = catalog_context_for_area("Selección Recurso", "");
        assert!(context.contains("- Official area display name: Selección Recurso"));
        assert!(context.contains("- Jira label: Selección-Recurso"));
    }

    #[test]
    fn uses_conditional_delivery_formats() {
        let context = catalog_context_for_area("Arquitectura", "Preparar brief tecnico");

        assert!(context.contains("- Delivery format: Arquitectura - Brief"));
    }

    #[test]
    fn derives_bug_issue_type_only_from_bug_area() {
        assert_eq!(derive_issue_type_from_area("Bug"), "Bug");
        assert_eq!(derive_issue_type_from_area("  bug  "), "Bug");
        assert_eq!(derive_issue_type_from_area("Programacion"), "Story");
        assert_eq!(derive_issue_type_from_area("3D"), "Story");
        assert_eq!(derive_issue_type_from_area(""), "Story");
    }

    #[test]
    fn excludes_regularizacion_from_this_slice() {
        assert!(!format!("{OFFICIAL_AREAS:?}")
            .to_lowercase()
            .contains("regulariz"));
        assert_eq!(
            resolve_catalog_area("Regularizacion"),
            CatalogAreaResolution::Blocked
        );
    }

    #[test]
    fn exposes_only_official_area_options() {
        let options = official_area_options();

        assert!(options.contains(&OfficialAreaOption {
            area_display_name: "Programación",
            jira_label: "Programación"
        }));
        assert!(options.contains(&OfficialAreaOption {
            area_display_name: "Integración",
            jira_label: "Integración"
        }));
        assert!(options.contains(&OfficialAreaOption {
            area_display_name: "Producción",
            jira_label: "Producción"
        }));
        assert!(options.contains(&OfficialAreaOption {
            area_display_name: "Selección Recurso",
            jira_label: "Selección-Recurso"
        }));
        assert!(!options.contains(&OfficialAreaOption {
            area_display_name: "Implementación",
            jira_label: "implementacion"
        }));
        assert!(!options.contains(&OfficialAreaOption {
            area_display_name: "Compra",
            jira_label: "compra"
        }));
    }

    #[test]
    fn validates_exportable_catalog_source() {
        let result = parse_exportable_catalog_json(
            "https://example.test/jtf-sync-catalog.json",
            r#"{
              "areas": [
                {
                  "areaDisplayName": "Bug",
                  "jiraLabel": "Bug",
                  "enabledInJTF": true,
                  "issueType": "Bug",
                  "defaultDeliveryFormat": "Bug",
                  "safeAliases": []
                },
                {
                  "areaDisplayName": "Programación",
                  "jiraLabel": "Programación",
                  "enabledInJTF": true,
                  "issueType": "Story",
                  "defaultDeliveryFormat": "Feature de Programación",
                  "safeAliases": ["Programacion"]
                }
              ],
              "deliveryFormats": [
                {
                  "formatName": "Bug",
                  "issueType": "Bug",
                  "storyHeadings": ["Historia de usuario"],
                  "minimumDeliverable": "Bug reproducible.",
                  "reviewChecklist": ["Pasos de reproducción incluidos."]
                },
                {
                  "formatName": "Feature de Programación",
                  "issueType": "Story",
                  "storyHeadings": ["Historia de usuario"],
                  "minimumDeliverable": "PR/MR creado.",
                  "reviewChecklist": ["PR/MR creado."]
                }
              ],
              "areaFormatRules": [
                {
                  "areaDisplayName": "Programación",
                  "priority": 1,
                  "condition": "fallback",
                  "deliveryFormat": "Feature de Programación",
                  "blocking": false
                }
              ]
            }"#,
        )
        .expect("catalog should parse");

        assert!(result.ok);
        assert_eq!(result.synced_area_count, 2);
        assert_eq!(result.delivery_format_count, 2);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn rejects_exportable_catalog_with_non_bug_bug_issue_type() {
        let result = parse_exportable_catalog_json(
            "https://example.test/jtf-sync-catalog.json",
            r#"{
              "areas": [
                {
                  "areaDisplayName": "Bug",
                  "jiraLabel": "Bug",
                  "enabledInJTF": true,
                  "issueType": "Bug",
                  "defaultDeliveryFormat": "Bug"
                },
                {
                  "areaDisplayName": "Programación",
                  "jiraLabel": "Programación",
                  "enabledInJTF": true,
                  "issueType": "Bug",
                  "defaultDeliveryFormat": "Feature de Programación"
                }
              ],
              "deliveryFormats": [
                {
                  "formatName": "Bug",
                  "issueType": "Bug",
                  "storyHeadings": ["Historia de usuario"],
                  "minimumDeliverable": "Bug reproducible.",
                  "reviewChecklist": ["Pasos de reproducción incluidos."]
                },
                {
                  "formatName": "Feature de Programación",
                  "issueType": "Story",
                  "storyHeadings": ["Historia de usuario"],
                  "minimumDeliverable": "PR/MR creado.",
                  "reviewChecklist": ["PR/MR creado."]
                }
              ],
              "areaFormatRules": []
            }"#,
        )
        .expect("catalog should parse");

        assert!(!result.ok);
        assert!(result
            .errors
            .contains(&"Bug must be the only enabled area deriving issueType Bug.".to_string()));
    }
}
