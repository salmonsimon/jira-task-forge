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

export type CatalogDeliveryFormatGate =
  | {
      kind: "auto";
      areaDisplayName: string;
      format: string | null;
      options: string[];
    }
  | {
      kind: "needs_confirmation";
      areaDisplayName: string;
      suggestedFormat: string | null;
      options: string[];
    }
  | {
      kind: "unknown";
      areaDisplayName: string;
      options: string[];
      message: string;
    };

export type CatalogOfficialAreaOption = {
  areaDisplayName: string;
  jiraLabel: string;
};

const artPackageFormats: CatalogConditionalDeliveryFormat[] = [
  { format: "Arte Empaquetado", match: ["package", "paquete", "zip", "integracion manual", "otra persona", "another person"] }
];

export const officialAreaCatalog = {
  metadata: {
    sourceUrl: "https://app.notion.com/p/397c335aece481818013f3fe51cd2030",
    syncedAt: "2026-07-06",
    version: "2026.07.06-jtf-sync-catalog",
    maintenanceNote: "Fallback catalog for Jira Task Forge Issue #141. Public/exportable catalog sync is the preferred runtime source."
  },
  areas: [
    area("Bug", "Bug", ["bug"], "Bug"),
    area("Programación", "Programación", ["Programacion"], "Feature de Programación"),
    area("Integración", "Integración", ["Integracion"], "Integración"),
    area("Refactorización", "Refactorización", ["Refactorizacion"], "Feature de Programación"),
    area("3D", "3D", ["Modelos 3D", "Modelo 3D"], "Arte Integrado", artPackageFormats),
    area("Animación", "Animación", ["Animacion"], "Arte Integrado", artPackageFormats),
    area("Texturas", "Texturas", [], "Arte Integrado", artPackageFormats),
    area("Iluminación", "Iluminación", ["Iluminacion"], "Arte Integrado", artPackageFormats),
    area("VFX", "VFX", [], "Arte Integrado", artPackageFormats),
    area("SFX", "SFX", [], "Integración"),
    area("Haptics", "Haptics", [], "Haptics", [
      { format: "Integración", match: ["integrar", "integracion", "defined haptics", "haptics definidos"] },
      { format: "QA", match: ["validar", "build", "device", "dispositivo", "integrated haptic"] }
    ]),
    area("UI", "UI", [], "Integración", [
      { format: "Feature de Programación", match: ["widget behavior", "comportamiento", "logic", "logica", "interaction", "interaccion"] },
      { format: "Decisión de Diseño", match: ["experience", "experiencia", "flow", "flujo", "structure", "estructura", "visual criterion", "criterio visual"] }
    ]),
    area("Feeling", "Feeling", [], "Feature de Programación", [
      { format: "Decisión de Diseño", match: ["criterio", "ux", "interaccion", "balance", "decision", "experiencia"] },
      { format: "Playtest Documentado", match: ["playtest", "usuarios", "stakeholders", "validar feeling", "validar sensacion"] }
    ]),
    area("Diseño", "Diseño", ["Diseno"], "Decisión de Diseño"),
    area("Concept", "Concept", [], "Concept Art"),
    area("Localización", "Localización", ["Localizacion"], "Integración"),
    area("Polish", "Polish", ["Pulido"], "Feature de Programación", [
      { format: "Integración", match: ["integrar", "integracion", "assets preparados", "adjustments"] }
    ]),
    area("Investigación", "Investigación", ["Investigacion"], "Investigación"),
    area("Arquitectura", "Arquitectura", [], "Arquitectura - Brief", [
      { format: "Arquitectura - Propuesta Final", match: ["propuesta final", "decision final", "solucion final", "accepted brief", "brief aceptado"] }
    ]),
    area("QA", "QA", [], "QA"),
    area("Build", "Build", ["Build / Release"], "Build / Release"),
    area("Producción", "Producción", ["Produccion"], "Producción Audiovisual"),
    area("Documentación", "Documentación", ["Documentacion"], "Story base documental", [
      { format: "Investigación", match: ["research", "investigacion"] },
      { format: "Decisión de Diseño", match: ["design decision", "decision de diseno"] },
      { format: "Arquitectura - Brief", match: ["architectural", "arquitectura", "arquitectonico"] },
      { format: "Reunión Documentada", match: ["meeting", "reunion", "acuerdos"] },
      { format: "Curso / Capacitación", match: ["training", "course", "curso", "capacitacion"] }
    ]),
    area("Capacitación", "Capacitación", ["Capacitacion"], "Curso / Capacitación"),
    area("Housekeeping", "Housekeeping", [], "Feature de Programación", [
      { format: "Integración", match: ["asset integration", "integracion", "integrar"] },
      { format: "Arte Integrado", match: ["integrated art", "arte integrado", "assets de arte"] }
    ]),
    area("Selección Recurso", "Selección-Recurso", ["Seleccion Recurso"], "Selección Recurso")
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

export function getDeliveryFormatGateForArea(areaInput: string, descriptionOrDeliverable = ""): CatalogDeliveryFormatGate {
  const resolution = resolveCatalogArea(areaInput);
  if (resolution.kind === "blocked") {
    return {
      kind: "unknown",
      areaDisplayName: areaInput.trim(),
      options: [],
      message: "Choose an official catalog area before generating a description proposal."
    };
  }

  const catalogArea = officialAreaCatalog.areas.find((entry) => entry.areaDisplayName === resolution.areaDisplayName);
  if (!catalogArea) {
    return {
      kind: "unknown",
      areaDisplayName: resolution.areaDisplayName,
      options: [],
      message: "Choose an official catalog area before generating a description proposal."
    };
  }

  const options = getMappedDeliveryFormats(catalogArea);
  return {
    kind: "auto",
    areaDisplayName: catalogArea.areaDisplayName,
    format: suggestDeliveryFormat(catalogArea, descriptionOrDeliverable),
    options
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

function getMappedDeliveryFormats(catalogArea: CatalogArea): string[] {
  const formats = [
    ...(catalogArea.conditionalDeliveryFormats?.map((conditionalFormat) => conditionalFormat.format) ?? []),
    catalogArea.deliveryFormat
  ];
  return Array.from(new Set(formats.map((format) => format.trim()).filter(Boolean)));
}

function suggestDeliveryFormat(catalogArea: CatalogArea, descriptionOrDeliverable: string): string | null {
  const normalizedContext = normalizeCatalogKey(descriptionOrDeliverable);
  return (
    catalogArea.conditionalDeliveryFormats?.find((candidate) =>
      candidate.match.some((term) => normalizedContext.includes(normalizeCatalogKey(term)))
    )?.format ?? null
  );
}
