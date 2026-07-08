#!/usr/bin/env node
import { createServer } from "node:http";

const DEFAULT_PORT = 5177;
const NOTION_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const MAX_BODY_BYTES = 16_384;

export function resolveConfig(env = process.env) {
  const port = Number(env.JTF_NOTION_OAUTH_BACKEND_PORT || DEFAULT_PORT);
  return {
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
    clientId: env.JTF_NOTION_OAUTH_CLIENT_ID?.trim() || "",
    clientSecret: env.JTF_NOTION_OAUTH_CLIENT_SECRET?.trim() || "",
    redirectUri: env.JTF_NOTION_OAUTH_REDIRECT_URI?.trim() || `http://127.0.0.1:${DEFAULT_PORT}/notion/oauth/callback`
  };
}

export function buildAuthorizationUrl(config, state) {
  requireValue("JTF_NOTION_OAUTH_CLIENT_ID", config.clientId);
  requireValue("JTF_NOTION_OAUTH_REDIRECT_URI", config.redirectUri);
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
  requireValue("JTF_NOTION_OAUTH_CLIENT_ID", config.clientId);
  requireValue("JTF_NOTION_OAUTH_CLIENT_SECRET", config.clientSecret);
  requireValue("JTF_NOTION_OAUTH_REDIRECT_URI", config.redirectUri);
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

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(`Notion OAuth exchange failed: ${error}.`);
  }

  const accessToken = payload?.access_token?.trim() || "";
  if (!accessToken) throw new Error("OAuth exchange did not return a Notion access token.");
  const refreshToken = payload?.refresh_token?.trim() || "";
  return refreshToken ? { accessToken, refreshToken } : { accessToken };
}

export function createNotionOAuthBackend(config = resolveConfig(), fetchImpl = fetch) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, { ok: true });
      }
      if (request.method === "GET" && url.pathname === "/notion/oauth/callback") {
        return sendCallbackPage(response, url.searchParams.get("code") || "", url.searchParams.get("state") || "", url.searchParams.get("error") || "");
      }
      if (request.method === "POST" && url.pathname === "/notion/oauth/start") {
        const body = await readJsonBody(request);
        const authorizationUrl = buildAuthorizationUrl(config, body.state);
        return sendJson(response, 200, { authorizationUrl });
      }
      if (request.method === "POST" && url.pathname === "/notion/oauth/exchange") {
        const body = await readJsonBody(request);
        validateState(body.state);
        const result = await exchangeAuthorizationCode(config, body.authorizationCode, fetchImpl);
        return sendJson(response, 200, result);
      }
      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Notion OAuth backend failed." });
    }
  });
}

function requireValue(name, value) {
  if (!value?.trim()) throw new Error(`${name} is required.`);
}

function validateState(state) {
  const value = state?.trim() || "";
  if (value.length < 24) throw new Error("Notion OAuth state is missing or invalid.");
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Notion OAuth state contains invalid characters.");
}

async function readJsonBody(request) {
  const chunks = [];
  let byteCount = 0;
  for await (const chunk of request) {
    byteCount += chunk.length;
    if (byteCount > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendCallbackPage(response, code, state, error) {
  const title = error ? "Notion authorization failed" : "Return to Jira Task Forge";
  const body = error
    ? `<p>Notion returned an authorization error. Restart the connection flow.</p><pre>${escapeHtml(error)}</pre>`
    : `<p>Paste this callback code into Jira Task Forge to finish the connection.</p><label>Code</label><pre>${escapeHtml(code)}</pre><label>State</label><pre>${escapeHtml(state)}</pre>`;
  response.writeHead(error ? 400 : 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 24px;color:#172b4d}pre{white-space:pre-wrap;word-break:break-all;background:#f4f5f7;border:1px solid #dfe1e6;border-radius:6px;padding:12px}label{display:block;margin-top:20px;font-weight:700}</style></head><body><h1>${title}</h1>${body}</body></html>`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = resolveConfig();
  const server = createNotionOAuthBackend(config);
  server.listen(config.port, "127.0.0.1", () => {
    console.log(`Notion OAuth backend listening on http://127.0.0.1:${config.port}`);
  });
}
