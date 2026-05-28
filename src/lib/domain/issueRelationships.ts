import type { IssueRelationshipType, LocalIssueRelationship, LocalTask } from "../types";

export const issueRelationshipTypes: IssueRelationshipType[] = ["blocks", "blocked_by"];

export function formatIssueRelationshipTypeLabel(type: IssueRelationshipType): string {
  return type === "blocks" ? "Blocks" : "Blocked by";
}

export function getAvailableIssueRelationshipTargets(
  tasks: LocalTask[] | null | undefined,
  sourceTaskId: string,
  relationships: LocalIssueRelationship[] | null | undefined = []
): LocalTask[] {
  const usedTargetTaskIds = new Set((relationships ?? []).map((relationship) => relationship.targetTaskId));
  return (tasks ?? []).filter((task) => task.id !== sourceTaskId && !usedTargetTaskIds.has(task.id));
}

export function findIssueRelationshipTarget(
  tasks: LocalTask[] | null | undefined,
  relationship: LocalIssueRelationship
): LocalTask | null {
  return (tasks ?? []).find((task) => task.id === relationship.targetTaskId) ?? null;
}

export function formatIssueRelationshipTargetLabel(task: LocalTask): string {
  const project = task.project.trim() || "No project";
  const area = task.area.trim() || "No area";
  const title = task.title.trim() || "(untitled)";
  return `[${project}] ${area} · ${title}`;
}

export function addLocalIssueRelationship(
  task: LocalTask,
  type: IssueRelationshipType,
  targetTaskId: string
): LocalIssueRelationship[] {
  const relationships = task.issueRelationships ?? [];
  if (targetTaskId === task.id) return relationships;
  if (relationships.some((relationship) => relationship.targetTaskId === targetTaskId)) {
    return relationships;
  }

  return [
    ...relationships,
    {
      id: buildLocalIssueRelationshipId(task.id, type, targetTaskId),
      type,
      targetTaskId
    }
  ];
}

export function removeLocalIssueRelationship(
  relationships: LocalIssueRelationship[] | undefined,
  relationshipId: string
): LocalIssueRelationship[] {
  return (relationships ?? []).filter((relationship) => relationship.id !== relationshipId);
}

export function countIssueRelationships(task: LocalTask): number {
  return task.issueRelationships?.length ?? 0;
}

function buildLocalIssueRelationshipId(
  sourceTaskId: string,
  type: IssueRelationshipType,
  targetTaskId: string
): string {
  return `rel-${slugIdPart(sourceTaskId)}-${type}-${slugIdPart(targetTaskId)}`;
}

function slugIdPart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "task";
}
