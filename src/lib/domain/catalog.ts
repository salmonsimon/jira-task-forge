import type { IssueType } from "../types";

export type CatalogArea = {
  areaDisplayName: string;
  jiraLabel: string;
  aliases: string[];
  deliveryFormat: string;
  conditionalDeliveryFormats?: CatalogConditionalDeliveryFormat[];
};

export type CatalogConditionalDeliveryFormat = {
  format: string;
  match: string[];
};

export type OfficialAreaCatalog = {
  metadata: {
    sourceUrl: string;
    syncedAt: string;
    version: string;
    maintenanceNote: string;
  };
  areas: CatalogArea[];
};

export type CatalogAreaResolution =
  | {
      kind: "official" | "normalized";
      input: string;
      normalizedInput: string;
      areaDisplayName: string;
      jiraLabel: string;
    }
  | {
      kind: "blocked";
      input: string;
      normalizedInput: string;
      officialOptions: CatalogOfficialAreaOption[];
      message: string;
    };

export type CatalogDeliveryFormatResolution =
  | {
      kind: "direct" | "conditional";
      areaDisplayName: string;
      format: string;
    }
  | {
      kind: "unknown";
      areaDisplayName: string;
    };

export type CatalogOfficialAreaOption = {
  areaDisplayName: string;
  jiraLabel: string;
};

export const officialAreaCatalog = {
  metadata: {
    sourceUrl: "https://app.notion.com/p/387c335aece481c292baf6991a86a5c3",
    syncedAt: "2026-06-23",
    version: "2026.06.23-catalog-foundation",
    maintenanceNote: "Internal v1 catalog for Jira Task Forge Issue #141. Notion remains the documentary source; this file is the runtime source."
  },
  areas: [
    area("Bug", "bug", [], "Reporte de bug"),
    area("3D", "3d", ["Modelos 3D", "Modelo 3D"], "Asset 3D integrado"),
    area("Polish", "polish", ["Pulido"], "Ajuste de polish"),
    area("Programación", "programacion", ["Programacion"], "Implementación técnica"),
    area("Integración", "integracion", ["Integracion"], "Integración técnica"),
    area("Diseño", "diseno", ["Diseno"], "Diseño funcional"),
    area("Animación", "animacion", ["Animacion"], "Animación implementada"),
    area("Iluminación", "iluminacion", ["Iluminacion"], "Iluminación integrada"),
    area("Texturas", "texturas", [], "Texturas aplicadas"),
    area("Localización", "localizacion", ["Localizacion"], "Contenido localizado"),
    area("Refactorización", "refactorizacion", ["Refactorizacion"], "Refactor técnico"),
    area("Investigación", "investigacion", ["Investigacion"], "Informe de investigación"),
    area("Selección Recurso", "Selección-Recurso", ["Seleccion Recurso"], "Recurso seleccionado"),
    area("Arquitectura", "arquitectura", [], "Decisión técnica", [
      { format: "Brief técnico", match: ["brief", "requerimiento", "contexto inicial"] },
      { format: "Propuesta final", match: ["propuesta final", "decision final", "cerrar propuesta"] }
    ])
  ]
} as const satisfies OfficialAreaCatalog;

export function resolveCatalogArea(input: string): CatalogAreaResolution {
  const normalizedInput = normalizeCatalogKey(input);
  const trimmedInput = input.trim();

  for (const catalogArea of officialAreaCatalog.areas) {
    if (catalogArea.areaDisplayName.trim().toLowerCase() === trimmedInput.toLowerCase()) {
      return {
        kind: "official",
        input: trimmedInput,
        normalizedInput,
        areaDisplayName: catalogArea.areaDisplayName,
        jiraLabel: catalogArea.jiraLabel
      };
    }

    if (
      normalizeCatalogKey(catalogArea.areaDisplayName) === normalizedInput ||
      normalizeCatalogKey(catalogArea.jiraLabel) === normalizedInput ||
      catalogArea.aliases.some((alias) => normalizeCatalogKey(alias) === normalizedInput)
    ) {
      return {
        kind: "normalized",
        input: trimmedInput,
        normalizedInput,
        areaDisplayName: catalogArea.areaDisplayName,
        jiraLabel: catalogArea.jiraLabel
      };
    }
  }

  return {
    kind: "blocked",
    input: trimmedInput,
    normalizedInput,
    officialOptions: getOfficialAreaOptions(),
    message: "Choose an official catalog area before generating Jira labels or descriptions."
  };
}

export function getDeliveryFormatForArea(areaInput: string, descriptionOrDeliverable = ""): CatalogDeliveryFormatResolution {
  const resolution = resolveCatalogArea(areaInput);
  if (resolution.kind === "blocked") {
    return { kind: "unknown", areaDisplayName: areaInput.trim() };
  }

  const catalogArea = officialAreaCatalog.areas.find((entry) => entry.areaDisplayName === resolution.areaDisplayName);
  if (!catalogArea) return { kind: "unknown", areaDisplayName: resolution.areaDisplayName };

  const normalizedContext = normalizeCatalogKey(descriptionOrDeliverable);
  const conditionalFormat = catalogArea.conditionalDeliveryFormats?.find((candidate) =>
    candidate.match.some((term) => normalizedContext.includes(normalizeCatalogKey(term)))
  );

  if (conditionalFormat) {
    return {
      kind: "conditional",
      areaDisplayName: catalogArea.areaDisplayName,
      format: conditionalFormat.format
    };
  }

  return {
    kind: "direct",
    areaDisplayName: catalogArea.areaDisplayName,
    format: catalogArea.deliveryFormat
  };
}

export function deriveCatalogIssueType(area: string): IssueType {
  const resolution = resolveCatalogArea(area);
  if (resolution.kind !== "blocked" && resolution.areaDisplayName === "Bug") {
    return "Bug";
  }

  return "Story";
}

export function getOfficialAreaOptions(): CatalogOfficialAreaOption[] {
  return officialAreaCatalog.areas.map((catalogArea) => ({
    areaDisplayName: catalogArea.areaDisplayName,
    jiraLabel: catalogArea.jiraLabel
  }));
}

export function normalizeCatalogKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function area(
  areaDisplayName: string,
  jiraLabel: string,
  aliases: string[],
  deliveryFormat: string,
  conditionalDeliveryFormats?: CatalogConditionalDeliveryFormat[]
): CatalogArea {
  return {
    areaDisplayName,
    jiraLabel,
    aliases,
    deliveryFormat,
    conditionalDeliveryFormats
  };
}
