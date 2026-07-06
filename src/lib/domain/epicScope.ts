import type { LocalTask, Tray } from "../types";

export const TBD_EPIC_SCOPE = "TBD";

export type EpicScopeConfig = Pick<Tray, "epicScope" | "transversalEpicScope">;

export type EpicTarget = {
  project: string;
  area: string;
  scope: string;
};

export function normalizeEpicScope(scope?: string | null): string | null {
  const normalized = scope?.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized.toLowerCase() === "[tbd]" || normalized.toLowerCase() === "tbd") return TBD_EPIC_SCOPE;
  return normalized;
}

export function epicTargetForTask(
  task: Pick<LocalTask, "project" | "area">,
  config?: EpicScopeConfig
): EpicTarget | null {
  const scope = effectiveEpicScopeForProject(task.project, config);
  if (!scope) return null;
  return {
    project: task.project.trim(),
    area: task.area.trim(),
    scope
  };
}

export function effectiveEpicScopeForProject(project: string, config?: EpicScopeConfig): string | null {
  const singular = normalizeEpicScope(config?.epicScope);
  if (!singular) return null;
  if (singular === TBD_EPIC_SCOPE) return singular;
  if (project.trim().toLowerCase() === "transversal") {
    return normalizeEpicScope(config?.transversalEpicScope);
  }
  return singular;
}

export function formatEpicTarget(target: EpicTarget): string {
  return `[${target.project}] [${target.area}] ${target.scope}`;
}

export function formatPendingEpicTarget(project: string, area: string): string {
  return `[${project.trim()}] [${area.trim()}] Scope pending`;
}

export function suggestTransversalEpicScope(scope?: string | null): string | null {
  const normalized = normalizeEpicScope(scope);
  if (!normalized) return null;
  if (normalized === TBD_EPIC_SCOPE) return TBD_EPIC_SCOPE;

  const words = normalized.split(" ");
  const firstWord = words[0] ?? "";
  const lowerFirstWord = firstWord.toLowerCase();
  if (lowerFirstWord.endsWith("s")) return normalized;
  if (lowerFirstWord.endsWith("ión")) {
    words[0] = `${firstWord.slice(0, -3)}iones`;
    return words.join(" ");
  }
  if (lowerFirstWord.endsWith("z")) {
    words[0] = `${firstWord.slice(0, -1)}ces`;
    return words.join(" ");
  }
  if (/[aeiouáéíóú]$/i.test(firstWord)) {
    words[0] = `${firstWord}s`;
    return words.join(" ");
  }
  words[0] = `${firstWord}es`;
  return words.join(" ");
}
