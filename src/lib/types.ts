export type MainTab = "trays" | "jql";
export type Panel = "categories" | "settings" | "detail" | null;
export type ThemeMode = "light" | "dark" | "system";
export type Priority = "Lowest" | "Low" | "Medium" | "High" | "Highest";
export type SyncStatus = "Pending" | "Failed" | "Exported" | "Created";
export type TrayState = "Active" | "Needs attention" | "Completed" | "Archived";
export type IssueType = "Story" | "Bug" | "Sub-task";
export type IssueRelationshipType = "blocks" | "blocked_by";
export type AttachmentPurpose = "AI only" | "Jira attachment" | "AI + Jira attachment";
export type AiProvider = "OpenAI" | "Claude" | "Gemini" | "None";
export type DescriptionSectionStatus = "Raw" | "Polished";
export type AssistedDescriptionProposalStatus = "Pending" | "Accepted" | "Rejected" | "Partial";
export type AssistedDescriptionSectionId =
  | "user_story"
  | "problem"
  | "scope"
  | "acceptance_criteria"
  | "minimum_deliverable"
  | "review_checklist";
export type PreflightWarningSeverity = "blocking" | "resolvable";
export type PreflightWarningCode =
  | "empty-tray"
  | "missing-credential"
  | "invalid-credential"
  | "missing-creation-project"
  | "missing-project"
  | "missing-area"
  | "invalid-area"
  | "missing-title"
  | "missing-parent-task"
  | "missing-description"
  | "missing-epic"
  | "retry-failed-task"
  | "exported-duplicate-risk";

export type Attachment = {
  id: string;
  filename: string;
  purpose: AttachmentPurpose;
  size: string;
  mimeType?: string | null;
  sizeBytes?: number;
  restoreStatus?: string | null;
};

export type SyncLogEntry = {
  id: string;
  timestamp: string;
  event: string;
  detail: string;
};

export type LocalIssueRelationship = {
  id: string;
  type: IssueRelationshipType;
  targetTaskId: string;
};

export type LocalTask = {
  id: string;
  project: string;
  area: string;
  title: string;
  priority: Priority;
  issueType: IssueType;
  syncStatus: SyncStatus;
  descriptionStatus: "Ready" | "Missing" | "Draft";
  language: "Spanish" | "English";
  jiraKey?: string;
  jiraUrl?: string;
  epic?: string;
  parentTaskId?: string;
  description?: string;
  notes?: string;
  issueRelationships?: LocalIssueRelationship[];
  attachments?: Attachment[];
  syncLog?: SyncLogEntry[];
};

export type Tray = {
  id: string;
  name: string;
  state: TrayState;
  summary: string;
  updatedAt: string;
  tasks: LocalTask[];
};

export type Category = {
  id: string;
  categoryType: "project" | "area";
  name: string;
  hidden?: boolean;
  source: "local" | "jira" | "catalog";
};

export type JqlFavorite = {
  id: string;
  name: string;
  jql: string;
};

export type JqlRecentQuery = {
  id: string;
  jql: string;
  ranAt: string;
  status: "success" | "error";
  resultCount?: number;
};

export type JqlRunState = "idle" | "running" | "success" | "error";

export type BackupOperationNotice = {
  kind: "success" | "error";
  title: string;
  summary: string;
  primaryCounts?: Record<string, number>;
  secondaryCounts?: Record<string, number>;
  warnings?: string[];
};

export type JqlResult = {
  key: string;
  project: string;
  issueType: string;
  priority: string;
  status: string;
  summary: string;
  assignee: string;
};

export type JqlQueryResult = {
  results: JqlResult[];
  isLast: boolean;
  nextPageToken?: string | null;
  warningMessages: string[];
};

export type JqlAiDraft = {
  jql: string;
  explanation: string;
  warnings: string[];
};

export type AssistedDescriptionDraft = {
  status: "drafted" | "needs_clarification";
  description?: string | null;
  clarificationQuestions: string[];
};

export type AssistedDescriptionProposalSection = {
  sectionId: AssistedDescriptionSectionId;
  heading: string;
  currentContent: string;
  proposedContent: string;
  status: DescriptionSectionStatus;
  reviewerComment?: string | null;
  updatedAt?: string | null;
};

export type AssistedDescriptionProposal = {
  id: string;
  taskId: string;
  title: string;
  summary?: string | null;
  status: AssistedDescriptionProposalStatus;
  provider?: string | null;
  model?: string | null;
  userComment?: string | null;
  sections: AssistedDescriptionProposalSection[];
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
};

export type NewAssistedDescriptionProposal = {
  taskId: string;
  title?: string | null;
  summary?: string | null;
  provider?: string | null;
  model?: string | null;
  userComment?: string | null;
  sections: AssistedDescriptionProposalSection[];
};

export type DescriptionProposalLogEntry = {
  id: string;
  taskId: string;
  proposalId?: string | null;
  eventType: string;
  title: string;
  summary?: string | null;
  status: AssistedDescriptionProposalStatus;
  provider?: string | null;
  model?: string | null;
  userComment?: string | null;
  detail: unknown;
  occurredAt: string;
};

export type PreflightWarning = {
  code: PreflightWarningCode;
  severity: PreflightWarningSeverity;
  taskId?: string;
  message: string;
};

export type AppSettings = {
  themeMode: ThemeMode;
  jiraSiteUrl: string;
  jiraAccountEmail: string;
  jiraAuthMethod: "api-token" | "oauth-ready";
  jiraCreationProjectKey: string;
  aiProvider: AiProvider;
  aiModel: string;
  defaultContentLanguage: "Spanish" | "English";
  catalogSourceMode: "notion" | "public-exportable" | "manual";
  catalogSourceUrl: string;
};

export type CatalogSyncResult = {
  ok: boolean;
  sourceUrl: string;
  syncedAreaCount: number;
  deliveryFormatCount: number;
  ruleCount: number;
  warnings: string[];
  errors: string[];
  areas: Array<{
    areaDisplayName: string;
    jiraLabel: string;
    enabledInJTF: boolean;
    issueType: "Story" | "Bug";
    defaultDeliveryFormat: string;
    safeAliases: string[];
    notes: string;
  }>;
  deliveryFormats: Array<{
    formatName: string;
    issueType: "Story" | "Bug";
    storyHeadings: string[];
    minimumDeliverable: string;
    reviewChecklist: string[];
  }>;
  areaFormatRules: Array<{
    areaDisplayName: string;
    priority: number;
    condition: string;
    deliveryFormat: string;
    blocking: boolean;
  }>;
};

export type NotionCatalogConnectionTestResult = {
  ok: boolean;
  message: string;
  title?: string | null;
  extractedBlockCount: number;
};

export type JiraConnectionTestResult = {
  ok: boolean;
  message: string;
  accountDisplayName?: string | null;
  accountEmail?: string | null;
};

export type JiraProjectOption = {
  key: string;
  name: string;
};

export type CredentialConnectionTestResult = {
  ok: boolean;
  message: string;
  detail?: string | null;
};

export type JiraCreatedIssueResult = {
  taskId?: string | null;
  key: string;
  url: string;
  issueType: string;
  summary: string;
  epicKey?: string | null;
};

export type JiraFailedTaskResult = {
  taskId: string;
  title: string;
  project: string;
  area: string;
  message: string;
};

export type JiraCreateIssuesResult = {
  syncAttemptId: string;
  status: "blocked" | "succeeded" | "partial" | "failed" | "running";
  createdIssueCount: number;
  skippedIssueCount: number;
  failedIssueCount: number;
  createdIssues: JiraCreatedIssueResult[];
  failedTasks: JiraFailedTaskResult[];
  messages: string[];
};

export type JiraCreateProgress = {
  syncAttemptId?: string | null;
  step: string;
  label: string;
  detail?: string | null;
  completedSteps: number;
  totalSteps: number;
  status: "running" | "succeeded" | "partial" | "failed" | "blocked";
};
