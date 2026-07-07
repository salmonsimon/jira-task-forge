export type ProjectSyncSource = "local" | "jira" | "catalog";
export type ProjectSyncDecisionStatus = "active" | "ignored" | "archived";

export type ProjectSyncLocalProject = {
  name: string;
  source: ProjectSyncSource;
  hidden?: boolean;
};

export type ProjectSyncDiscoveredEpic = {
  key: string;
  summary: string;
};

export type ProjectSyncRememberedDecision = {
  name: string;
  normalizedName: string;
  status: ProjectSyncDecisionStatus;
};

export type ProjectSyncCandidate = {
  name: string;
  normalizedName: string;
  jiraIssueKeys: string[];
  status: ProjectSyncDecisionStatus | "new";
  alreadyLocal: boolean;
  willPromoteLocal: boolean;
};

export type ProjectSyncReview = {
  sections: {
    active: ProjectSyncCandidate[];
    new: ProjectSyncCandidate[];
    ignored: ProjectSyncCandidate[];
    archived: ProjectSyncCandidate[];
  };
  defaultActiveNames: string[];
  notes: string[];
};

export const TRANSVERSAL_PROJECT_NAME = "Transversal";

export function normalizeProjectNameForSync(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractProjectNameFromEpicSummary(summary: string): string | null {
  const trimmed = summary.trim();
  const match = trimmed.match(/^\[([^\]]+)\](?:\s+\[[^\]]+\]|\s+[^\[].*)/);
  const projectName = match?.[1]?.trim();
  if (!projectName) return null;
  if (["bug", "story", "epic", "sub-task", "subtask"].includes(normalizeProjectNameForSync(projectName))) return null;
  return projectName;
}

export function buildProjectSyncReview({
  localProjects,
  discoveredEpics,
  rememberedDecisions
}: {
  localProjects: ProjectSyncLocalProject[];
  discoveredEpics: ProjectSyncDiscoveredEpic[];
  rememberedDecisions: ProjectSyncRememberedDecision[];
}): ProjectSyncReview {
  const localByNormalizedName = new Map(localProjects.map((project) => [normalizeProjectNameForSync(project.name), project]));
  const rememberedByNormalizedName = new Map(rememberedDecisions.map((decision) => [decision.normalizedName, decision]));
  const discoveredByNormalizedName = new Map<string, ProjectSyncCandidate>();

  for (const epic of discoveredEpics) {
    const name = extractProjectNameFromEpicSummary(epic.summary);
    if (!name) continue;

    const normalizedName = normalizeProjectNameForSync(name);
    if (!normalizedName) continue;

    const existing = discoveredByNormalizedName.get(normalizedName);
    if (existing) {
      existing.jiraIssueKeys.push(epic.key);
      continue;
    }

    const localProject = localByNormalizedName.get(normalizedName);
    const remembered = rememberedByNormalizedName.get(normalizedName);
    discoveredByNormalizedName.set(normalizedName, {
      name: localProject?.name ?? name,
      normalizedName,
      jiraIssueKeys: [epic.key],
      status: remembered?.status ?? "new",
      alreadyLocal: Boolean(localProject),
      willPromoteLocal: Boolean(localProject && localProject.source === "local")
    });
  }

  const transversal: ProjectSyncCandidate = {
    name: TRANSVERSAL_PROJECT_NAME,
    normalizedName: normalizeProjectNameForSync(TRANSVERSAL_PROJECT_NAME),
    jiraIssueKeys: [],
    status: "active",
    alreadyLocal: localByNormalizedName.has(normalizeProjectNameForSync(TRANSVERSAL_PROJECT_NAME)),
    willPromoteLocal: false
  };

  const sections: ProjectSyncReview["sections"] = {
    active: [transversal],
    new: [],
    ignored: [],
    archived: []
  };

  for (const candidate of Array.from(discoveredByNormalizedName.values()).sort((left, right) => left.name.localeCompare(right.name))) {
    if (candidate.normalizedName === transversal.normalizedName) continue;
    if (candidate.status === "active") sections.active.push(candidate);
    if (candidate.status === "ignored") sections.ignored.push(candidate);
    if (candidate.status === "archived") sections.archived.push(candidate);
    if (candidate.status === "new") sections.new.push(candidate);
  }

  return {
    sections,
    defaultActiveNames: [...sections.active, ...sections.new].map((candidate) => candidate.name),
    notes: sections.new
      .filter((candidate) => candidate.willPromoteLocal)
      .map((candidate) => `${candidate.name} already exists locally and will become official because it exists in Jira.`)
  };
}
