import type { JqlAiDraft, JqlRecentQuery } from "../types";
import { formatUnknownError } from "./errors";

export function addJqlRecentQuery(
  currentQueries: JqlRecentQuery[],
  query: string,
  result: Pick<JqlRecentQuery, "status" | "resultCount">,
  options: { id?: string; ranAt?: string; limit?: number } = {}
): JqlRecentQuery[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return currentQueries;

  const nextQuery: JqlRecentQuery = {
    id: options.id ?? `recent-${Date.now().toString(36)}`,
    jql: normalizedQuery,
    ranAt: options.ranAt ?? new Date().toISOString(),
    status: result.status,
    resultCount: result.status === "success" ? result.resultCount : undefined
  };
  const dedupedQueries = currentQueries.filter((recentQuery) => recentQuery.jql.trim() !== normalizedQuery);
  return [nextQuery, ...dedupedQueries].slice(0, options.limit ?? 5);
}

export function formatJqlQueryMessage(resultCount: number, isLast: boolean, warningMessages: string[]): string {
  if (resultCount === 0) {
    const warningText = warningMessages.length ? ` ${warningMessages.join(" ")}` : "";
    return `No issues matched this JQL query.${warningText}`;
  }

  const resultText = `${resultCount} ${resultCount === 1 ? "issue" : "issues"} returned.`;
  const pageText = isLast ? null : "More results are available in Jira.";
  const warningText = warningMessages.length ? warningMessages.join(" ") : null;

  return [resultText, pageText, warningText].filter(Boolean).join(" ");
}

export function formatJqlQueryError(error: unknown): string {
  const message = formatUnknownError(error, "Could not run JQL query.");
  return `JQL query failed. ${message}`;
}

export function formatJqlAiDraftMessage(draft: JqlAiDraft): string {
  const warningText = draft.warnings.length ? ` ${draft.warnings.join(" ")}` : "";
  return `${draft.explanation}${warningText}`;
}

export function buildJiraIssueBrowseUrl(jiraSiteUrl: string, issueKey: string): string | null {
  const trimmedIssueKey = issueKey.trim();
  if (!isSafeJiraIssueKey(trimmedIssueKey)) return null;

  try {
    const url = new URL(jiraSiteUrl.trim());
    if (url.protocol !== "https:" || !url.hostname.endsWith(".atlassian.net")) return null;

    return `https://${url.hostname.toLowerCase()}/browse/${encodeURIComponent(trimmedIssueKey)}`;
  } catch {
    return null;
  }
}

function isSafeJiraIssueKey(issueKey: string): boolean {
  return Boolean(issueKey && /^[A-Za-z0-9_]+-[A-Za-z0-9_]+$/.test(issueKey));
}
