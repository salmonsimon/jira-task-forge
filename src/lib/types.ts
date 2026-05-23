export type MainTab = "trays" | "jql";
export type Panel = "categories" | "settings" | "detail" | null;
export type ThemeMode = "light" | "dark" | "system";
export type Priority = "Lowest" | "Low" | "Medium" | "High" | "Highest";
export type SyncStatus = "Pending" | "Failed" | "Exported" | "Created";
export type TrayState = "Active" | "Needs attention" | "Completed" | "Archived";
export type IssueType = "Story" | "Bug" | "Sub-task";
export type AttachmentPurpose = "AI only" | "Jira attachment" | "AI + Jira attachment";
export type PreflightWarningSeverity = "blocking" | "resolvable";
export type PreflightWarningCode =
  | "empty-tray"
  | "missing-credential"
  | "invalid-credential"
  | "missing-creation-project"
  | "missing-project"
  | "missing-area"
  | "missing-title"
  | "missing-description"
  | "missing-epic"
  | "retry-failed-task"
  | "exported-duplicate-risk";

export type Attachment = {
  id: string;
  filename: string;
  purpose: AttachmentPurpose;
  size: string;
};

export type SyncLogEntry = {
  id: string;
  timestamp: string;
  event: string;
  detail: string;
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
  epic?: string;
  description?: string;
  notes?: string;
  subtasks?: string[];
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
  name: string;
  hidden?: boolean;
  source: "local" | "jira";
};

export type JqlFavorite = {
  id: string;
  name: string;
  jql: string;
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
  aiProvider: "OpenAI" | "None";
  aiModel: string;
  defaultContentLanguage: "Spanish" | "English";
};

export type JiraConnectionTestResult = {
  ok: boolean;
  message: string;
  accountDisplayName?: string | null;
  accountEmail?: string | null;
};
