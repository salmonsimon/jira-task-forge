const NOTION_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";

export function readConfig(env = process.env) {
  return {
    clientId: env.JTF_NOTION_OAUTH_CLIENT_ID?.trim() || "",
    clientSecret: env.JTF_NOTION_OAUTH_CLIENT_SECRET?.trim() || "",
    redirectUri: env.JTF_NOTION_OAUTH_REDIRECT_URI?.trim() || ""
  };
}

export function buildAuthorizationUrl(config, state) {
  requireConfig("JTF_NOTION_OAUTH_CLIENT_ID", config.clientId);
  requireConfig("JTF_NOTION_OAUTH_REDIRECT_URI", config.redirectUri);
  validateState(state);
  const url = new URL(NOTION_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state.trim());
  return url.toString();
}

export async function exchangeAuthorizationCode(config, authorizationCode, fetchImpl = fetch) {
  requireConfig("JTF_NOTION_OAUTH_CLIENT_ID", config.clientId);
  requireConfig("JTF_NOTION_OAUTH_CLIENT_SECRET", config.clientSecret);
  requireConfig("JTF_NOTION_OAUTH_REDIRECT_URI", config.redirectUri);
  const code = authorizationCode?.trim() || "";
  if (!code) throw new Error("Notion OAuth authorization code is required.");

  const response = await fetchImpl(NOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString("base64")}`
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(`Notion OAuth exchange failed: ${error}.`);
  }
  const accessToken = payload?.access_token?.trim() || "";
  if (!accessToken) throw new Error("OAuth exchange did not return a Notion access token.");
  const refreshToken = payload?.refresh_token?.trim() || "";
  return refreshToken ? { accessToken, refreshToken } : { accessToken };
}

export function requestBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") return JSON.parse(request.body);
  return request.body;
}

export function sendJson(response, status, payload) {
  response.status(status).setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function sendCallbackPage(response, code, state, error) {
  const title = error ? "Notion authorization failed" : "Return to Jira Task Forge";
  const body = error
    ? `<p>Notion returned an authorization error. Restart the connection flow.</p><pre>${escapeHtml(error)}</pre>`
    : `<p>Paste this callback code into Jira Task Forge to finish the connection.</p><label>Code</label><pre>${escapeHtml(code)}</pre><label>State</label><pre>${escapeHtml(state)}</pre>`;
  response.status(error ? 400 : 200).setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 24px;color:#172b4d}pre{white-space:pre-wrap;word-break:break-all;background:#f4f5f7;border:1px solid #dfe1e6;border-radius:6px;padding:12px}label{display:block;margin-top:20px;font-weight:700}</style></head><body><h1>${title}</h1>${body}</body></html>`);
}

function requireConfig(name, value) {
  if (!value?.trim()) throw new Error(`${name} is required.`);
}

function validateState(state) {
  const value = state?.trim() || "";
  if (value.length < 24) throw new Error("Notion OAuth state is missing or invalid.");
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Notion OAuth state contains invalid characters.");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character]);
}
