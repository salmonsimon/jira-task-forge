import type { AssistedDescriptionSectionId, IssueType } from "../types";

export type AssistedDescriptionSectionDefinition = {
  id: AssistedDescriptionSectionId;
  label: string;
  markdownHeading: string;
};

export type AssistedDescriptionTemplatePolicy = {
  issueType: "Story" | "Bug";
  sections: readonly AssistedDescriptionSectionDefinition[];
};

export const storyAssistedDescriptionSectionDefinitions = [
  { id: "user_story", label: "User story", markdownHeading: "Historia de usuario" },
  { id: "problem", label: "Context", markdownHeading: "Contexto" },
  { id: "scope", label: "Scope", markdownHeading: "Alcance" },
  { id: "acceptance_criteria", label: "Acceptance criteria", markdownHeading: "Criterios de aceptacion" },
  { id: "minimum_deliverable", label: "Minimum deliverable", markdownHeading: "Entregable mínimo" },
  { id: "review_checklist", label: "Review checklist", markdownHeading: "Checklist antes de Review" }
] as const satisfies readonly AssistedDescriptionSectionDefinition[];

export const bugAssistedDescriptionSectionDefinitions = [
  { id: "problem", label: "Problem", markdownHeading: "Problema" },
  { id: "context_impact", label: "Context / impact", markdownHeading: "Contexto / impacto" },
  { id: "reproduction_steps", label: "Steps to reproduce", markdownHeading: "Pasos para reproducir" },
  { id: "actual_result", label: "Actual result", markdownHeading: "Resultado actual" },
  { id: "expected_result", label: "Expected result", markdownHeading: "Resultado esperado" },
  { id: "evidence", label: "Evidence", markdownHeading: "Evidencia" },
  { id: "acceptance_criteria", label: "Acceptance criteria", markdownHeading: "Criterios de aceptacion" },
  { id: "minimum_deliverable", label: "Minimum deliverable", markdownHeading: "Entregable mínimo" },
  { id: "review_checklist", label: "Review checklist", markdownHeading: "Checklist antes de Review" }
] as const satisfies readonly AssistedDescriptionSectionDefinition[];

export const defaultAssistedDescriptionSectionDefinitions = storyAssistedDescriptionSectionDefinitions;

const allAssistedDescriptionSectionDefinitions = [
  ...storyAssistedDescriptionSectionDefinitions,
  ...bugAssistedDescriptionSectionDefinitions.filter(
    (bugSection) => !storyAssistedDescriptionSectionDefinitions.some((storySection) => storySection.id === bugSection.id)
  )
] as const satisfies readonly AssistedDescriptionSectionDefinition[];

const sectionAliases: Record<AssistedDescriptionSectionId, string[]> = {
  user_story: ["historia de usuario", "user story"],
  problem: ["problema", "problem", "contexto", "context"],
  context_impact: ["contexto impacto", "contexto / impacto", "context impact", "impacto"],
  scope: [
    "alcance",
    "scope",
    "objetivo",
    "objective",
    "goal",
    "expected impact",
    "impacto esperado",
    "impacto",
    "fuera de alcance",
    "out of scope",
    "no incluye",
    "not included",
    "flujos principales",
    "main flows",
    "flows",
    "flujo principal",
    "requisitos funcionales",
    "functional requirements",
    "requisitos no funcionales relevantes",
    "requisitos no funcionales",
    "non functional requirements",
    "nonfunctional requirements",
    "restricciones y dependencias",
    "constraints and dependencies",
    "constraints dependencies"
  ],
  reproduction_steps: ["pasos para reproducir", "steps to reproduce", "reproduccion", "reproduction"],
  actual_result: ["resultado actual", "actual result", "comportamiento actual", "observed result"],
  expected_result: ["resultado esperado", "expected result", "comportamiento esperado"],
  evidence: ["evidencia", "evidence", "captura", "video", "log"],
  acceptance_criteria: [
    "criterios de aceptacion de alto nivel",
    "criterios de aceptacion",
    "acceptance criteria",
    "criterios de acceptance",
    "riesgos y preguntas abiertas",
    "riesgos",
    "risks",
    "open questions",
    "preguntas abiertas"
  ],
  minimum_deliverable: ["entregable minimo", "entregable mínimo", "minimum deliverable"],
  review_checklist: ["checklist antes de review", "checklist", "review checklist"]
};

const sectionIdByNormalizedHeading = buildSectionAliasIndex();

export function getAssistedDescriptionTemplatePolicy(issueType?: IssueType | string | null): AssistedDescriptionTemplatePolicy {
  return isBugDescriptionIssueType(issueType)
    ? { issueType: "Bug", sections: bugAssistedDescriptionSectionDefinitions }
    : { issueType: "Story", sections: storyAssistedDescriptionSectionDefinitions };
}

export function getAllAssistedDescriptionSectionDefinitions(): readonly AssistedDescriptionSectionDefinition[] {
  return allAssistedDescriptionSectionDefinitions;
}

export function getAssistedDescriptionSectionDefinitions(issueType?: IssueType | string | null) {
  return getAssistedDescriptionTemplatePolicy(issueType).sections;
}

export function getAssistedDescriptionSectionIds(issueType?: IssueType | string | null): AssistedDescriptionSectionId[] {
  return getAssistedDescriptionTemplatePolicy(issueType).sections.map((section) => section.id);
}

export function getAssistedDescriptionSectionLabel(
  sectionId: AssistedDescriptionSectionId,
  issueType?: IssueType | string | null
): string {
  return getAssistedDescriptionTemplatePolicy(issueType).sections.find((section) => section.id === sectionId)?.label
    ?? allAssistedDescriptionSectionDefinitions.find((section) => section.id === sectionId)?.label
    ?? sectionId;
}

export function findAssistedDescriptionSectionId(heading: string): AssistedDescriptionSectionId | null {
  return sectionIdByNormalizedHeading.get(normalizeHeading(heading)) ?? null;
}

export function isAssistedDescriptionWrapperHeading(value: string): boolean {
  const heading = normalizeHeading(value);
  return heading === "srs lite" || heading === "jira srs lite";
}

export function buildAssistedDescriptionGenerationContext({
  changeRequest,
  issueType,
  sectionIds
}: {
  changeRequest: string;
  issueType: IssueType;
  sectionIds: AssistedDescriptionSectionId[];
}): string {
  const policy = getAssistedDescriptionTemplatePolicy(issueType);
  const request = changeRequest.trim();
  const sectionLabels = sectionIds.map((sectionId) => getAssistedDescriptionSectionLabel(sectionId, issueType)).join(", ");
  const allowedLabels = policy.sections.map((section) => section.label).join(", ");
  const scope =
    sectionIds.length === policy.sections.length
      ? `Generate a complete proposal for the fixed ${policy.issueType} Jira description sections.`
      : `Revise only these fixed ${policy.issueType} Jira description sections: ${sectionLabels}. Leave other sections unchanged.`;

  return [
    request,
    scope,
    `Use only these fixed sections: ${allowedLabels}. Do not include suggested sub-tasks inside the description. If missing information materially changes scope or acceptance criteria, ask targeted clarification questions instead of inventing Jira content.`
  ].filter(Boolean).join("\n\n");
}

export function formatAssistedDescriptionSectionScopeLabel(
  sectionIds: AssistedDescriptionSectionId[],
  issueType?: IssueType | string | null
): string {
  if (sectionIds.length === 1) return getAssistedDescriptionSectionLabel(sectionIds[0], issueType);
  if (sectionIds.length === getAssistedDescriptionTemplatePolicy(issueType).sections.length) return "all proposal sections";
  return `${sectionIds.length} proposal sections`;
}

function buildSectionAliasIndex(): Map<string, AssistedDescriptionSectionId> {
  const index = new Map<string, AssistedDescriptionSectionId>();
  for (const section of allAssistedDescriptionSectionDefinitions) {
    index.set(normalizeHeading(section.markdownHeading), section.id);
    index.set(normalizeHeading(section.label), section.id);
    for (const alias of sectionAliases[section.id]) {
      index.set(normalizeHeading(alias), section.id);
    }
  }
  return index;
}

function isBugDescriptionIssueType(issueType?: IssueType | string | null): boolean {
  const normalized = normalizeHeading(issueType ?? "");
  return normalized === "bug" || normalized === "error";
}

function normalizeHeading(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\d+[\).\s-]+/, "")
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
