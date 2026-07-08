import { sendCallbackPage } from "./shared.js";

export default function handler(request, response) {
  return sendCallbackPage(response, request.query?.code || "", request.query?.state || "", request.query?.error || "");
}
