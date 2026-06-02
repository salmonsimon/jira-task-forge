import { describe, expect, it } from "vitest";
import type { JiraCreateIssuesResult } from "../types";
import {
  formatJiraCreationResultCounts,
  getJiraCreationNoticeGuidance,
  shouldShowBlockingJiraCreationNotice
} from "./jiraCreation";

describe("Jira creation result notices", () => {
  it("promotes partial results with created Jira issues to blocking notices", () => {
    const result = jiraResultFixture({
      status: "partial",
      createdIssueCount: 1,
      skippedIssueCount: 8,
      messages: [
        "JTFTEST-138 attachment aaaaaa.csv could not be uploaded: Jira attachment upload failed with HTTP 500.",
        "1 Jira issue created."
      ]
    });

    expect(shouldShowBlockingJiraCreationNotice(result)).toBe(true);
    expect(formatJiraCreationResultCounts(result)).toBe("1 created · 0 failed · 8 skipped");
    expect(getJiraCreationNoticeGuidance(result)).toContain("preflight was closed");
  });

  it("keeps failed runs with no created Jira issues out of the blocking partial notice", () => {
    const result = jiraResultFixture({
      status: "failed",
      createdIssueCount: 0,
      failedIssueCount: 1
    });

    expect(shouldShowBlockingJiraCreationNotice(result)).toBe(false);
  });
});

function jiraResultFixture(patch: Partial<JiraCreateIssuesResult> = {}): JiraCreateIssuesResult {
  return {
    syncAttemptId: "sync-1",
    status: "succeeded",
    createdIssueCount: 0,
    skippedIssueCount: 0,
    failedIssueCount: 0,
    createdIssues: [],
    failedTasks: [],
    messages: [],
    ...patch
  };
}
