import type { JiraCreateIssuesResult } from "../types";

export function shouldShowBlockingJiraCreationNotice(result: JiraCreateIssuesResult): boolean {
  return result.status === "partial" && result.createdIssueCount > 0;
}

export function formatJiraCreationResultCounts(result: Pick<JiraCreateIssuesResult, "createdIssueCount" | "failedIssueCount" | "skippedIssueCount">): string {
  return `${result.createdIssueCount} created · ${result.failedIssueCount} failed · ${result.skippedIssueCount} skipped`;
}

export function getJiraCreationNoticeGuidance(result: JiraCreateIssuesResult): string {
  if (result.failedTasks.length > 0) {
    return "Some Jira issues already exist. The preflight was closed to prevent submitting the same run again from stale review state.";
  }

  return "Jira issues already exist, but follow-up work did not finish. The preflight was closed to prevent submitting the same run again.";
}
