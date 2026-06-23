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
pub const CATALOG_SYNCED_AT: &str = "2026-06-23";
pub const CATALOG_VERSION: &str = "2026.06.23-catalog-foundation";
pub const CATALOG_MAINTENANCE_NOTE: &str =
    "Internal v1 catalog for Jira Task Forge Issue #141. Notion remains the documentary source; this file is the runtime source.";

const ARCHITECTURE_CONDITIONAL_FORMATS: &[CatalogConditionalDeliveryFormat] = &[
    CatalogConditionalDeliveryFormat {
        format: "Brief técnico",
        matches: &["brief", "requerimiento", "contexto inicial"],
    },
    CatalogConditionalDeliveryFormat {
        format: "Propuesta final",
        matches: &["propuesta final", "decision final", "cerrar propuesta"],
    },
];

pub const OFFICIAL_AREAS: &[CatalogArea] = &[
    area("Bug", "bug", &[], "Reporte de bug", &[]),
    area(
        "3D",
        "3d",
        &["Modelos 3D", "Modelo 3D"],
        "Asset 3D integrado",
        &[],
    ),
    area("Polish", "polish", &["Pulido"], "Ajuste de polish", &[]),
    area(
        "Programación",
        "programacion",
        &["Programacion"],
        "Implementación técnica",
        &[],
    ),
    area(
        "Integración",
        "integracion",
        &["Integracion"],
        "Integración técnica",
        &[],
    ),
    area("Diseño", "diseno", &["Diseno"], "Diseño funcional", &[]),
    area(
        "Animación",
        "animacion",
        &["Animacion"],
        "Animación implementada",
        &[],
    ),
    area(
        "Iluminación",
        "iluminacion",
        &["Iluminacion"],
        "Iluminación integrada",
        &[],
    ),
    area("Texturas", "texturas", &[], "Texturas aplicadas", &[]),
    area(
        "Localización",
        "localizacion",
        &["Localizacion"],
        "Contenido localizado",
        &[],
    ),
    area(
        "Refactorización",
        "refactorizacion",
        &["Refactorizacion"],
        "Refactor técnico",
        &[],
    ),
    area(
        "Investigación",
        "investigacion",
        &["Investigacion"],
        "Informe de investigación",
        &[],
    ),
    area(
        "Selección Recurso",
        "Selección-Recurso",
        &["Seleccion Recurso"],
        "Recurso seleccionado",
        &[],
    ),
    area(
        "Arquitectura",
        "arquitectura",
        &[],
        "Decisión técnica",
        ARCHITECTURE_CONDITIONAL_FORMATS,
    ),
];

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
        resolve_catalog_area, CatalogAreaResolution, OfficialAreaOption, OFFICIAL_AREAS,
    };

    #[test]
    fn normalizes_safe_aliases() {
        assert_eq!(
            resolve_catalog_area("Programacion"),
            CatalogAreaResolution::Normalized {
                area_display_name: "Programación",
                jira_label: "programacion"
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

        assert!(context.contains("- Delivery format: Brief técnico"));
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
            jira_label: "programacion"
        }));
        assert!(options.contains(&OfficialAreaOption {
            area_display_name: "Integración",
            jira_label: "integracion"
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
}
