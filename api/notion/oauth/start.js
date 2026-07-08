import { buildAuthorizationUrl, readConfig, requestBody, sendJson } from "./shared.js";

export default function handler(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const body = requestBody(request);
    return sendJson(response, 200, { authorizationUrl: buildAuthorizationUrl(readConfig(), body.state) });
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : "Notion OAuth start failed." });
  }
}
