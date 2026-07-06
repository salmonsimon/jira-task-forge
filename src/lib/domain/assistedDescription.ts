import type {
  AssistedDescriptionProposal as PersistedAssistedDescriptionProposal,
  AssistedDescriptionProposalSection,
  AssistedDescriptionProposalStatus,
  AssistedDescriptionSectionId,
  DescriptionSectionStatus,
  IssueType,
  NewAssistedDescriptionProposal
} from "../types";

export type { AssistedDescriptionSectionId, DescriptionSectionStatus } from "../types";

export const storyAssistedDescriptionSectionDefinitions = [
  { id: "user_story", label: "User story", markdownHeading: "Historia de usuario" },
  { id: "problem", label: "Context", markdownHeading: "Contexto" },
  { id: "scope", label: "Scope", markdownHeading: "Alcance" },
  { id: "acceptance_criteria", label: "Acceptance criteria", markdownHeading: "Criterios de aceptacion" },
  { id: "minimum_deliverable", label: "Minimum deliverable", markdownHeading: "Entregable mínimo" },
  { id: "review_checklist", label: "Review checklist", markdownHeading: "Checklist antes de Review" }
] as const satisfies readonly {
  id: AssistedDescriptionSectionId;
  label: string;
  markdownHeading: string;
}[];

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
] as const satisfies readonly {
  id: AssistedDescriptionSectionId;
  label: string;
  markdownHeading: string;
}[];

export const assistedDescriptionSectionDefinitions = storyAssistedDescriptionSectionDefinitions;

const allAssistedDescriptionSectionDefinitions = [
  ...storyAssistedDescriptionSectionDefinitions,
  ...bugAssistedDescriptionSectionDefinitions.filter(
    (bugSection) => !storyAssistedDescriptionSectionDefinitions.some((storySection) => storySection.id === bugSection.id)
  )
] as const satisfies readonly {
  id: AssistedDescriptionSectionId;
  label: string;
  markdownHeading: string;
}[];

export type AssistedDescriptionSections = Record<AssistedDescriptionSectionId, string>;
export type AssistedDescriptionSectionStatuses = Record<AssistedDescriptionSectionId, DescriptionSectionStatus>;
export type AssistedDescriptionProposal = PersistedAssistedDescriptionProposal;
export type AssistedDescriptionProposalItemStatus = "pending" | "accepted" | "rejected";

export type AssistedDescriptionProposalItem = {
  id: string;
  currentValue: string;
  label: string;
  proposedValue: string;
  reviewerComment?: string | null;
  sectionId: AssistedDescriptionSectionId;
  status: AssistedDescriptionProposalItemStatus;
};

export type AssistedDescriptionState = {
  sections: AssistedDescriptionSections;
  sectionStatuses: AssistedDescriptionSectionStatuses;
};

export type AssistedDescriptionProposalPatch = AssistedDescriptionState & {
  markdown: string;
  proposal: AssistedDescriptionProposal;
  shouldApplyDescription: boolean;
};

export type AssistedDescriptionParagraphDiff = {
  current: string;
  proposed: string;
};

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

export function createEmptyAssistedDescriptionSections(): AssistedDescriptionSections {
  const sections = {} as AssistedDescriptionSections;
  for (const section of allAssistedDescriptionSectionDefinitions) {
    sections[section.id] = "";
  }
  return sections;
}

export function createEmptyAssistedDescriptionSectionStatuses(): AssistedDescriptionSectionStatuses {
  const statuses = {} as AssistedDescriptionSectionStatuses;
  for (const section of allAssistedDescriptionSectionDefinitions) {
    statuses[section.id] = "Raw";
  }
  return statuses;
}

export function getAssistedDescriptionSectionDefinitions(issueType?: IssueType | string | null) {
  return isBugDescriptionIssueType(issueType) ? bugAssistedDescriptionSectionDefinitions : storyAssistedDescriptionSectionDefinitions;
}

export function getAssistedDescriptionSectionIds(issueType?: IssueType | string | null): AssistedDescriptionSectionId[] {
  return getAssistedDescriptionSectionDefinitions(issueType).map((section) => section.id);
}

export function getAssistedDescriptionSectionLabel(
  sectionId: AssistedDescriptionSectionId,
  issueType?: IssueType | string | null
): string {
  return getAssistedDescriptionSectionDefinitions(issueType).find((section) => section.id === sectionId)?.label
    ?? allAssistedDescriptionSectionDefinitions.find((section) => section.id === sectionId)?.label
    ?? sectionId;
}

export function parseAssistedDescriptionMarkdown(
  markdown: string | null | undefined,
  issueType?: IssueType | string | null
): AssistedDescriptionSections {
  const sections = createEmptyAssistedDescriptionSections();
  const lines = (markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  let currentSectionId: AssistedDescriptionSectionId | null = null;
  const fallbackSectionId: AssistedDescriptionSectionId = isBugDescriptionIssueType(issueType) ? "problem" : "problem";

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const sectionId = findAssistedDescriptionSectionId(heading[2]);
      if (sectionId) {
        currentSectionId = sectionId;
        continue;
      }
      if (isWrapperHeading(heading[2])) {
        currentSectionId = null;
        continue;
      }
    }

    const targetSectionId = currentSectionId ?? fallbackSectionId;
    sections[targetSectionId] = appendSectionLine(sections[targetSectionId], line);
  }

  for (const section of allAssistedDescriptionSectionDefinitions) {
    sections[section.id] = trimSectionContent(sections[section.id]);
  }

  return sections;
}

export function serializeAssistedDescriptionSections(
  sections: AssistedDescriptionSections,
  issueType?: IssueType | string | null
): string {
  const lines: string[] = [];
  for (const section of getAssistedDescriptionSectionDefinitions(issueType)) {
    appendSerializedSection(lines, 2, section.markdownHeading, sections[section.id]);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function serializeAssistedDescriptionSectionsForProposal(
  sections: AssistedDescriptionSections,
  proposal: AssistedDescriptionProposal
): string {
  const lines: string[] = [];
  for (const proposalSection of proposal.sections) {
    appendSerializedSection(
      lines,
      2,
      proposalSection.heading || getAssistedDescriptionSectionLabel(proposalSection.sectionId),
      sections[proposalSection.sectionId]
    );
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function hasMeaningfulAssistedDescriptionContent(sections: AssistedDescriptionSections): boolean {
  return allAssistedDescriptionSectionDefinitions.some((section) => Boolean(sections[section.id].trim()));
}

export function applyManualAssistedDescriptionSectionEdit(
  state: AssistedDescriptionState,
  sectionId: AssistedDescriptionSectionId,
  content: string
): AssistedDescriptionState {
  const nextContent = content.trim();
  return {
    sections: {
      ...state.sections,
      [sectionId]: nextContent
    },
    sectionStatuses: {
      ...state.sectionStatuses,
      [sectionId]: nextContent ? "Polished" : "Raw"
    }
  };
}

export function markAssistedDescriptionSectionPolished(
  state: AssistedDescriptionState,
  sectionId: AssistedDescriptionSectionId
): AssistedDescriptionState {
  const hasContent = Boolean(state.sections[sectionId].trim());
  return {
    sections: state.sections,
    sectionStatuses: {
      ...state.sectionStatuses,
      [sectionId]: hasContent ? "Polished" : "Raw"
    }
  };
}

export function buildAssistedDescriptionProposal({
  changeRequest = "",
  currentMarkdown,
  id,
  model,
  now = new Date().toISOString(),
  proposedMarkdown,
  provider,
  sectionIds,
  taskId,
  issueType
}: {
  changeRequest?: string;
  currentMarkdown: string;
  id?: string;
  model?: string | null;
  now?: string;
  proposedMarkdown: string;
  provider?: string | null;
  sectionIds?: AssistedDescriptionSectionId[];
  taskId: string;
  issueType?: IssueType | string | null;
}): AssistedDescriptionProposal {
  const proposalId = id ?? `proposal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const currentSections = parseAssistedDescriptionMarkdown(currentMarkdown, issueType);
  const proposedSections = parseAssistedDescriptionMarkdown(proposedMarkdown, issueType);
  const activeSectionDefinitions = getAssistedDescriptionSectionDefinitions(issueType);
  const uniqueSectionIds = getUniqueSectionIds(sectionIds, issueType);
  const selectedSectionIds = new Set(uniqueSectionIds);
  const sections: AssistedDescriptionProposalSection[] = activeSectionDefinitions.map((section) => {
    const proposedContent = selectedSectionIds.has(section.id) ? proposedSections[section.id] : "";
    return {
      currentContent: currentSections[section.id],
      heading: section.markdownHeading,
      proposedContent,
      reviewerComment: null,
      sectionId: section.id,
      status: "Raw",
      updatedAt: now
    };
  });

  return {
    createdAt: now,
    decidedAt: null,
    id: proposalId,
    model,
    provider,
    sections,
    status: "Pending",
    summary: buildProposalSummary(uniqueSectionIds, changeRequest),
    taskId,
    title: uniqueSectionIds.length === 1
      ? `AI proposal: ${getAssistedDescriptionSectionLabel(uniqueSectionIds[0], issueType)}`
      : "AI description proposal",
    updatedAt: now,
    userComment: changeRequest.trim() || null
  };
}

export function toNewAssistedDescriptionProposal(
  proposal: AssistedDescriptionProposal
): NewAssistedDescriptionProposal {
  return {
    model: proposal.model,
    provider: proposal.provider,
    sections: proposal.sections.map((section) => ({ ...section })),
    summary: proposal.summary,
    taskId: proposal.taskId,
    title: proposal.title,
    userComment: proposal.userComment
  };
}

export function insertAssistedDescriptionProposal(
  proposals: AssistedDescriptionProposal[],
  proposal: AssistedDescriptionProposal
): AssistedDescriptionProposal[] {
  return [proposal, ...proposals.filter((candidate) => candidate.id !== proposal.id)];
}

export function replaceAssistedDescriptionProposal(
  proposals: AssistedDescriptionProposal[],
  proposal: AssistedDescriptionProposal
): AssistedDescriptionProposal[] {
  return proposals.some((candidate) => candidate.id === proposal.id)
    ? proposals.map((candidate) => (candidate.id === proposal.id ? proposal : candidate))
    : [proposal, ...proposals];
}

export function reviseAssistedDescriptionProposal(
  proposal: AssistedDescriptionProposal,
  revision: AssistedDescriptionProposal,
  sectionIds?: AssistedDescriptionSectionId[],
  now = new Date().toISOString()
): AssistedDescriptionProposal {
  const revisionSectionsBySectionId = new Map(revision.sections.map((section) => [section.sectionId, section]));
  const targetSectionIds = new Set(sectionIds?.length ? sectionIds : proposal.sections.map((section) => section.sectionId));

  return {
    ...proposal,
    model: revision.model ?? proposal.model,
    provider: revision.provider ?? proposal.provider,
    sections: proposal.sections.map((section) => {
      if (!targetSectionIds.has(section.sectionId)) return section;
      const revisionSection = revisionSectionsBySectionId.get(section.sectionId);
      if (!revisionSection) return section;

      return {
        ...section,
        currentContent: revisionSection.currentContent,
        proposedContent: revisionSection.proposedContent,
        reviewerComment: revision.userComment ?? null,
        status: "Raw",
        updatedAt: now
      };
    }),
    status: "Pending",
    summary: revision.summary,
    updatedAt: now,
    userComment: revision.userComment || proposal.userComment
  };
}

export function getAssistedDescriptionProposalItems(
  proposal: AssistedDescriptionProposal
): AssistedDescriptionProposalItem[] {
  return proposal.sections
    .filter((section) => isReviewableProposalSection(proposal.status, section))
    .map((section) => ({
      currentValue: section.currentContent,
      id: `${proposal.id}-${section.sectionId}`,
      label: section.heading || getAssistedDescriptionSectionLabel(section.sectionId),
      proposedValue: section.proposedContent,
      reviewerComment: section.reviewerComment ?? null,
      sectionId: section.sectionId,
      status: getAssistedDescriptionProposalItemStatus(proposal.status, section)
    }));
}

export function hasReviewableAssistedDescriptionProposalItems(
  proposal: AssistedDescriptionProposal
): boolean {
  return getAssistedDescriptionProposalItems(proposal).some((item) => item.status === "pending");
}

function isReviewableProposalSection(
  proposalStatus: AssistedDescriptionProposalStatus,
  section: AssistedDescriptionProposalSection
): boolean {
  const currentContent = section.currentContent.trim();
  const proposedContent = section.proposedContent.trim();
  const hasReviewerRequest = Boolean(section.reviewerComment?.trim());
  const hasContentChange = currentContent !== proposedContent;

  if (hasReviewerRequest) return true;
  if (section.status === "Polished" && proposedContent && hasContentChange) return true;
  if (proposedContent && hasContentChange) return true;
  if (proposalStatus !== "Pending" && currentContent && hasContentChange) return true;

  return false;
}

export function hasAcceptedAssistedDescriptionProposalSections(proposal: AssistedDescriptionProposal): boolean {
  return proposal.sections.some((section) =>
    section.status === "Polished" && (section.proposedContent.trim() || section.reviewerComment?.trim())
  );
}

export function buildResolveAssistedDescriptionProposalItemPatch(
  state: AssistedDescriptionState,
  proposal: AssistedDescriptionProposal,
  itemId: string,
  accepted: boolean,
  now = new Date().toISOString()
): AssistedDescriptionProposalPatch | null {
  if (proposal.status !== "Pending") return null;

  const item = getAssistedDescriptionProposalItems(proposal).find((candidate) => candidate.id === itemId);
  if (!item || item.status !== "pending") return null;

  const nextState = accepted ? applyAcceptedProposalItem(state, item) : cloneAssistedDescriptionState(state);
  const nextProposal = {
    ...proposal,
    sections: proposal.sections.map((section) =>
      section.sectionId === item.sectionId
        ? {
            ...section,
            status: accepted ? "Polished" as const : "Raw" as const,
            updatedAt: now
          }
        : section
    ),
    updatedAt: now
  };

  return {
    ...nextState,
    markdown: serializeAssistedDescriptionSectionsForProposal(nextState.sections, proposal),
    proposal: nextProposal,
    shouldApplyDescription: accepted
  };
}

export function buildResolveAssistedDescriptionProposalPatch(
  state: AssistedDescriptionState,
  proposal: AssistedDescriptionProposal,
  accepted: boolean,
  now = new Date().toISOString()
): AssistedDescriptionProposalPatch | null {
  if (proposal.status !== "Pending") return null;

  let nextState = applyPolishedProposalSections(state, proposal);
  let nextStatus: AssistedDescriptionProposalStatus;
  let nextSections = proposal.sections;

  if (accepted) {
    for (const item of getAssistedDescriptionProposalItems(proposal)) {
      if (item.status === "pending") {
        nextState = applyAcceptedProposalItem(nextState, item);
      }
    }
    nextStatus = "Accepted";
    const pendingSectionIds = new Set(
      getAssistedDescriptionProposalItems(proposal)
        .filter((item) => item.status === "pending")
        .map((item) => item.sectionId)
    );
    nextSections = proposal.sections.map((section) => ({
      ...section,
      status: pendingSectionIds.has(section.sectionId) || section.status === "Polished" ? "Polished" : "Raw",
      updatedAt: now
    }));
  } else {
    nextStatus = hasAcceptedAssistedDescriptionProposalSections(proposal) ? "Partial" : "Rejected";
  }

  const nextProposal = {
    ...proposal,
    decidedAt: now,
    sections: nextSections,
    status: nextStatus,
    updatedAt: now
  };

  return {
    ...nextState,
    markdown: serializeAssistedDescriptionSectionsForProposal(nextState.sections, proposal),
    proposal: nextProposal,
    shouldApplyDescription: accepted || nextStatus === "Partial"
  };
}

export function isAssistedDescriptionProposalItemStale(
  sections: AssistedDescriptionSections,
  item: AssistedDescriptionProposalItem
): boolean {
  return item.status === "pending" && sections[item.sectionId].trim() !== item.currentValue.trim();
}

export function buildAssistedDescriptionParagraphDiff(
  currentValue: string,
  proposedValue: string
): AssistedDescriptionParagraphDiff[] {
  const currentParagraphs = splitParagraphs(currentValue);
  const proposedParagraphs = splitParagraphs(proposedValue);
  const lcs = buildParagraphLcsTable(currentParagraphs, proposedParagraphs);
  const diff: AssistedDescriptionParagraphDiff[] = [];
  let currentIndex = 0;
  let proposedIndex = 0;

  while (currentIndex < currentParagraphs.length || proposedIndex < proposedParagraphs.length) {
    if (
      currentIndex < currentParagraphs.length &&
      proposedIndex < proposedParagraphs.length &&
      normalizeParagraph(currentParagraphs[currentIndex]) === normalizeParagraph(proposedParagraphs[proposedIndex])
    ) {
      currentIndex += 1;
      proposedIndex += 1;
      continue;
    }

    const removed: string[] = [];
    const added: string[] = [];

    while (currentIndex < currentParagraphs.length || proposedIndex < proposedParagraphs.length) {
      if (
        currentIndex < currentParagraphs.length &&
        proposedIndex < proposedParagraphs.length &&
        normalizeParagraph(currentParagraphs[currentIndex]) === normalizeParagraph(proposedParagraphs[proposedIndex])
      ) {
        break;
      }

      if (
        currentIndex < currentParagraphs.length &&
        (proposedIndex >= proposedParagraphs.length || lcs[currentIndex + 1][proposedIndex] >= lcs[currentIndex][proposedIndex + 1])
      ) {
        removed.push(currentParagraphs[currentIndex]);
        currentIndex += 1;
      } else if (proposedIndex < proposedParagraphs.length) {
        added.push(proposedParagraphs[proposedIndex]);
        proposedIndex += 1;
      } else {
        break;
      }
    }

    diff.push({
      current: removed.join("\n\n"),
      proposed: added.join("\n\n")
    });
  }

  return diff;
}

function getAssistedDescriptionProposalItemStatus(
  proposalStatus: AssistedDescriptionProposalStatus,
  section: AssistedDescriptionProposalSection
): AssistedDescriptionProposalItemStatus {
  if (section.status === "Polished") return "accepted";
  if (proposalStatus === "Rejected" || proposalStatus === "Partial") return "rejected";
  if (proposalStatus === "Accepted") return section.proposedContent.trim() ? "accepted" : "rejected";
  return "pending";
}

function applyAcceptedProposalItem(
  state: AssistedDescriptionState,
  item: AssistedDescriptionProposalItem
): AssistedDescriptionState {
  const nextValue = item.proposedValue.trim();
  return {
    sections: {
      ...state.sections,
      [item.sectionId]: nextValue
    },
    sectionStatuses: {
      ...state.sectionStatuses,
      [item.sectionId]: nextValue ? "Polished" : "Raw"
    }
  };
}

function applyPolishedProposalSections(
  state: AssistedDescriptionState,
  proposal: AssistedDescriptionProposal
): AssistedDescriptionState {
  return getAssistedDescriptionProposalItems(proposal).reduce(
    (nextState, item) => (item.status === "accepted" ? applyAcceptedProposalItem(nextState, item) : nextState),
    cloneAssistedDescriptionState(state)
  );
}

function cloneAssistedDescriptionState(state: AssistedDescriptionState): AssistedDescriptionState {
  return {
    sections: { ...state.sections },
    sectionStatuses: { ...state.sectionStatuses }
  };
}

function appendSectionLine(currentValue: string, line: string): string {
  return currentValue ? `${currentValue}\n${line}` : line;
}

function trimSectionContent(value: string): string {
  return value.replace(/^\s+|\s+$/g, "");
}

function appendSerializedSection(lines: string[], level: 2 | 3, heading: string, content: string) {
  lines.push(`${"#".repeat(level)} ${heading}`);
  const trimmedContent = content.trim();
  if (trimmedContent) {
    lines.push("", trimmedContent);
  }
  lines.push("");
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

function findAssistedDescriptionSectionId(heading: string): AssistedDescriptionSectionId | null {
  return sectionIdByNormalizedHeading.get(normalizeHeading(heading)) ?? null;
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

function isWrapperHeading(value: string): boolean {
  const heading = normalizeHeading(value);
  return heading === "srs lite" || heading === "jira srs lite";
}

function getUniqueSectionIds(
  sectionIds: AssistedDescriptionSectionId[] | undefined,
  issueType?: IssueType | string | null
): AssistedDescriptionSectionId[] {
  const fallback = getAssistedDescriptionSectionIds(issueType);
  const selectedSectionIds = sectionIds?.length ? sectionIds : fallback;
  const seen = new Set<AssistedDescriptionSectionId>();
  return selectedSectionIds.filter((sectionId) => {
    if (seen.has(sectionId)) return false;
    seen.add(sectionId);
    return true;
  });
}

function buildProposalSummary(sectionIds: AssistedDescriptionSectionId[], changeRequest: string): string {
  const request = changeRequest.trim();
  if (request) return `Requested adjustment: ${truncateSummary(request)}`;
  if (sectionIds.length === 1) return `Review proposed changes to ${getAssistedDescriptionSectionLabel(sectionIds[0])}.`;
  return "Review proposed Jira description changes.";
}

function isBugDescriptionIssueType(issueType?: IssueType | string | null): boolean {
  const normalized = normalizeHeading(issueType ?? "");
  return normalized === "bug" || normalized === "error";
}

function truncateSummary(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function splitParagraphs(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return trimmed.split(/\n\s*\n/g).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function buildParagraphLcsTable(currentParagraphs: string[], proposedParagraphs: string[]): number[][] {
  const table = Array.from({ length: currentParagraphs.length + 1 }, () => Array(proposedParagraphs.length + 1).fill(0));

  for (let currentIndex = currentParagraphs.length - 1; currentIndex >= 0; currentIndex -= 1) {
    for (let proposedIndex = proposedParagraphs.length - 1; proposedIndex >= 0; proposedIndex -= 1) {
      if (normalizeParagraph(currentParagraphs[currentIndex]) === normalizeParagraph(proposedParagraphs[proposedIndex])) {
        table[currentIndex][proposedIndex] = table[currentIndex + 1][proposedIndex + 1] + 1;
      } else {
        table[currentIndex][proposedIndex] = Math.max(table[currentIndex + 1][proposedIndex], table[currentIndex][proposedIndex + 1]);
      }
    }
  }

  return table;
}

function normalizeParagraph(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
