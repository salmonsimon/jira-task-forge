import { describe, expect, it } from "vitest";
import {
  addJqlRecentQuery,
  buildJiraIssueBrowseUrl,
  formatJqlAiDraftMessage,
  formatJqlQueryError,
  formatJqlQueryMessage
} from "./jql";
import { formatUnknownError, redactSensitiveText } from "./errors";
import type { JqlRecentQuery } from "../types";

const existingRecentQueries: JqlRecentQuery[] = [
  {
    id: "recent-old-match",
    jql: " project = JTFTEST ORDER BY created DESC ",
    ranAt: "2026-05-25T10:00:00.000Z",
    status: "success",
    resultCount: 2
  },
  {
    id: "recent-other",
    jql: "project = DTS ORDER BY updated DESC",
    ranAt: "2026-05-25T09:00:00.000Z",
    status: "error"
  }
];

describe("JQL workflow domain helpers", () => {
  it("records recent queries at the front and dedupes by normalized JQL", () => {
    const recentQueries = addJqlRecentQuery(
      existingRecentQueries,
      "project = JTFTEST ORDER BY created DESC",
      { status: "success", resultCount: 5 },
      { id: "recent-new", ranAt: "2026-05-25T11:00:00.000Z" }
    );

    expect(recentQueries).toEqual([
      {
        id: "recent-new",
        jql: "project = JTFTEST ORDER BY created DESC",
        ranAt: "2026-05-25T11:00:00.000Z",
        status: "success",
        resultCount: 5
      },
      existingRecentQueries[1]
    ]);
  });

  it("keeps recent query history capped and omits result counts for errors", () => {
    const currentQueries = Array.from({ length: 5 }, (_, index) => ({
      id: `recent-${index}`,
      jql: `project = JTFTEST AND summary ~ "${index}"`,
      ranAt: `2026-05-25T0${index}:00:00.000Z`,
      status: "success" as const,
      resultCount: index
    }));

    const recentQueries = addJqlRecentQuery(
      currentQueries,
      "project = DTS ORDER BY updated DESC",
      { status: "error", resultCount: 99 },
      { id: "recent-error", ranAt: "2026-05-25T12:00:00.000Z" }
    );

    expect(recentQueries).toHaveLength(5);
    expect(recentQueries[0]).toMatchObject({
      id: "recent-error",
      jql: "project = DTS ORDER BY updated DESC",
      status: "error"
    });
    expect(recentQueries[0].resultCount).toBeUndefined();
    expect(recentQueries.some((recentQuery) => recentQuery.id === "recent-4")).toBe(false);
  });

  it("ignores blank recent queries", () => {
    expect(addJqlRecentQuery(existingRecentQueries, "   ", { status: "success", resultCount: 1 })).toBe(
      existingRecentQueries
    );
  });

  it("formats JQL result messages", () => {
    expect(formatJqlQueryMessage(0, true, ["Field priority does not exist."])).toBe(
      "No issues matched this JQL query. Field priority does not exist."
    );
    expect(formatJqlQueryMessage(1, true, [])).toBe("1 issue returned.");
    expect(formatJqlQueryMessage(4, false, ["Some results were omitted."])).toBe(
      "4 issues returned. More results are available in Jira. Some results were omitted."
    );
  });

  it("builds safe Jira issue browse URLs from the configured site URL", () => {
    expect(buildJiraIssueBrowseUrl(" https://DTS.atlassian.net/jira/software ", "JTFTEST-123")).toBe(
      "https://dts.atlassian.net/browse/JTFTEST-123"
    );
    expect(buildJiraIssueBrowseUrl("http://dts.atlassian.net", "JTFTEST-123")).toBeNull();
    expect(buildJiraIssueBrowseUrl("https://example.com", "JTFTEST-123")).toBeNull();
    expect(buildJiraIssueBrowseUrl("https://dts.atlassian.net", "JTFTEST 123")).toBeNull();
  });

  it("formats JQL errors and AI draft messages", () => {
    expect(formatJqlQueryError(new Error("Jira rejected the JQL."))).toBe(
      "JQL query failed. Jira rejected the JQL."
    );
    expect(formatUnknownError("", "Fallback message.")).toBe("Fallback message.");
    expect(
      formatUnknownError(
        "OpenAI request failed with HTTP 401: Incorrect API key provided: sk-proj-secretValue123456. You can find your API key at https://platform.openai.com/account/api-keys.",
        "Fallback message."
      )
    ).toBe(
      "OpenAI request failed with HTTP 401: Incorrect API key provided: <redacted> You can find your API key at https://platform.openai.com/account/api-keys."
    );
    expect(redactSensitiveText("Authorization: Bearer jira-secret-token")).toBe(
      "Authorization: Bearer <redacted>"
    );
    expect(redactSensitiveText("Gemini rejected AIzaSySecretValue1234567890")).toBe(
      "Gemini rejected <redacted>"
    );
    expect(
      formatJqlAiDraftMessage({
        jql: "project = DTS",
        explanation: "Drafted a DTS query.",
        warnings: ["Review before running."]
      })
    ).toBe("Drafted a DTS query. Review before running.");
  });
});
