import { summarizeTrayTasks } from "../domain/trays";
import type {
  Attachment,
  AssistedDescriptionProposal,
  AssistedDescriptionProposalSection,
  Category,
  DescriptionProposalLogEntry,
  IssueType,
  LocalIssueRelationship,
  JqlFavorite,
  LocalTask,
  Priority,
  SyncLogEntry,
  SyncStatus,
  Tray,
  TrayState
} from "../types";

export type BackendTray = {
  id: string;
  name: string;
  state: "Active" | "NeedsAttention" | "Completed" | "Archived";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type BackendTask = {
  id: string;
  tray_id: string;
  project: string;
  area: string;
  title: string;
  priority: Priority;
  issue_type: IssueType;
  sync_status: SyncStatus;
  description_status: "Ready" | "Missing" | "Draft";
  description: string | null;
  content_language: "Spanish" | "English";
  jira_key: string | null;
  jira_url: string | null;
  epic_key: string | null;
  parent_task_id: string | null;
  task_order: number;
  created_at: string;
  updated_at: string;
  issue_relationships?: BackendIssueRelationship[];
  attachments?: BackendAttachment[];
};

export type BackendAttachment = {
  id: string;
  task_id: string;
  display_filename: string;
  mime_type: string | null;
  purpose: Attachment["purpose"];
  original_size_bytes: number;
  original_relative_path: string;
  size_label: string;
  restore_status: string | null;
  created_at: string;
  updated_at: string;
};

export type BackendIssueRelationship = {
  id: string;
  relationship_type: LocalIssueRelationship["type"];
  target_task_id: string;
};

export type BackendCategory = {
  id: string;
  category_type: "project" | "area";
  name: string;
  source: "local" | "jira";
  hidden: boolean;
  ignored: boolean;
  created_at: string;
  updated_at: string;
};

export type BackendJqlFavorite = {
  id: string;
  name: string;
  jql: string;
  created_at: string;
  updated_at: string;
};

export type BackendSyncAuditEvent = {
  id: string;
  syncAttemptId: string | null;
  trayId: string | null;
  taskId: string | null;
  eventType: string;
  occurredAt: string;
  outcome: string;
  provider: string | null;
  operation: string | null;
  detail: unknown;
};

export type BackendAssistedDescriptionProposalSection = AssistedDescriptionProposalSection;
export type BackendAssistedDescriptionProposal = AssistedDescriptionProposal;
export type BackendDescriptionProposalLogEntry = DescriptionProposalLogEntry;

export function mapBackendTask(task: BackendTask): LocalTask {
  return {
    id: task.id,
    project: task.project,
    area: task.area,
    title: task.title,
    priority: task.priority,
    issueType: task.issue_type,
    syncStatus: task.sync_status,
    descriptionStatus: task.description_status,
    description: task.description ?? undefined,
    language: task.content_language,
    jiraKey: task.jira_key ?? undefined,
    jiraUrl: task.jira_url ?? undefined,
    epic: task.epic_key ?? undefined,
    parentTaskId: task.parent_task_id ?? undefined,
    issueRelationships: task.issue_relationships?.map(mapBackendIssueRelationship),
    attachments: task.attachments?.map(mapBackendAttachment)
  };
}

export function mapBackendAttachment(attachment: BackendAttachment): Attachment {
  return {
    id: attachment.id,
    filename: attachment.display_filename,
    purpose: attachment.purpose,
    size: attachment.size_label,
    mimeType: attachment.mime_type,
    sizeBytes: attachment.original_size_bytes,
    restoreStatus: attachment.restore_status
  };
}

export function mapBackendIssueRelationship(relationship: BackendIssueRelationship): LocalIssueRelationship {
  return {
    id: relationship.id,
    type: relationship.relationship_type,
    targetTaskId: relationship.target_task_id
  };
}

export function mapBackendCategory(category: BackendCategory): Category {
  return {
    id: category.id,
    categoryType: category.category_type,
    name: category.name,
    source: category.source,
    hidden: category.hidden
  };
}

export function mapBackendJqlFavorite(favorite: BackendJqlFavorite): JqlFavorite {
  return {
    id: favorite.id,
    name: favorite.name,
    jql: favorite.jql
  };
}

export function mapBackendSyncAuditEvent(event: BackendSyncAuditEvent): SyncLogEntry {
  return {
    id: event.id,
    timestamp: formatTimestamp(event.occurredAt),
    event: formatAuditEventTitle(event),
    detail: formatAuditEventDetail(event.detail)
  };
}

export function mapBackendAssistedDescriptionProposal(
  proposal: BackendAssistedDescriptionProposal
): AssistedDescriptionProposal {
  return {
    ...proposal,
    sections: proposal.sections.map((section) => ({ ...section }))
  };
}

export function mapBackendDescriptionProposalLogEntry(
  entry: BackendDescriptionProposalLogEntry
): DescriptionProposalLogEntry {
  return { ...entry };
}

export function mapBackendTray(tray: BackendTray, tasks: LocalTask[]): Tray {
  return {
    id: tray.id,
    name: tray.name,
    state: mapBackendTrayState(tray.state),
    summary: summarizeTrayTasks(tasks),
    updatedAt: formatTimestamp(tray.updated_at),
    tasks
  };
}

export function mapBackendTrayState(state: BackendTray["state"]): TrayState {
  if (state === "NeedsAttention") return "Needs attention";
  return state;
}

export function formatBackendTimestamp(timestamp: string): string {
  return formatTimestamp(timestamp);
}

function formatAuditEventTitle(event: BackendSyncAuditEvent): string {
  const eventName = event.eventType
    .replace(/^jira\./, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const outcome = event.outcome.charAt(0).toUpperCase() + event.outcome.slice(1);
  return `${outcome}: ${eventName}`;
}

function formatAuditEventDetail(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const value = detail as Record<string, unknown>;

  if (typeof value.message === "string") return value.message;
  if (Array.isArray(value.messages)) return value.messages.filter((message) => typeof message === "string").join(" ");

  const summaryParts = [
    typeof value.jiraKey === "string" ? value.jiraKey : null,
    typeof value.summary === "string" ? value.summary : null,
    typeof value.priority === "string" ? `Priority ${value.priority}` : null,
    typeof value.source === "string" ? `Source ${value.source}` : null
  ].filter(Boolean);

  return summaryParts.length ? summaryParts.join(" · ") : "No additional details.";
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
