export function formatUnknownError(error: unknown, fallback: string): string {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  const trimmedMessage = message.trim();
  return trimmedMessage ? redactSensitiveText(trimmedMessage) : fallback;
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(Authorization\s*:\s*(?:Bearer|Basic)\s+)([^\s"',;}]+)/gi, "$1<redacted>")
    .replace(/\b(Bearer|Basic)\s+([^\s"',;}]+)/gi, "$1 <redacted>")
    .replace(
      /((?:api[_ -]?key|api[_ -]?token|token)(?:\s+provided)?\s*[:=]\s*)([^\s"',;}]+)/gi,
      "$1<redacted>"
    )
    .replace(/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{6,}|svcac[A-Za-z0-9_*.-]{6,}|[A-Za-z0-9_-]{3,}\*{6,}[A-Za-z0-9_.-]*)\b/g, "<redacted>");
}
