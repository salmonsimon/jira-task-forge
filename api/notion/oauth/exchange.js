import { exchangeAuthorizationCode, readConfig, requestBody, sendJson } from "../../../server/notion-oauth-shared.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const body = requestBody(request);
    return sendJson(response, 200, await exchangeAuthorizationCode(readConfig(), body.authorizationCode));
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : "Notion OAuth exchange failed." });
  }
}
