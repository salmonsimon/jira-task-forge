import { describe, expect, it, vi } from "vitest";
import { buildAuthorizationUrl, exchangeAuthorizationCode, resolveConfig } from "./notion-oauth-backend.mjs";

const env = {
  JTF_NOTION_OAUTH_CLIENT_ID: "client_123",
  JTF_NOTION_OAUTH_CLIENT_SECRET: "secret_456",
  JTF_NOTION_OAUTH_REDIRECT_URI: "http://127.0.0.1:5177/notion/oauth/callback"
};

describe("notion-oauth-backend", () => {
  it("builds a Notion authorization URL without exposing the client secret", () => {
    const url = buildAuthorizationUrl(resolveConfig(env), "jtf_123456789012345678901234");

    expect(url).toContain("https://api.notion.com/v1/oauth/authorize?");
    expect(url).toContain("client_id=client_123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("owner=user");
    expect(url).toContain("state=jtf_123456789012345678901234");
    expect(url).toContain("redirect_uri=http%3A%2F%2F127.0.0.1%3A5177%2Fnotion%2Foauth%2Fcallback");
    expect(url).not.toContain("secret_456");
  });

  it("exchanges a callback code with Notion using HTTP Basic auth server-side", async () => {
    const fetchImpl = vi.fn(async (_url, request) => {
      expect(request.headers.Authorization).toBe(`Basic ${Buffer.from("client_123:secret_456", "utf8").toString("base64")}`);
      expect(JSON.parse(request.body)).toEqual({
        grant_type: "authorization_code",
        code: "callback-code",
        redirect_uri: "http://127.0.0.1:5177/notion/oauth/callback"
      });
      return new Response(JSON.stringify({ access_token: "notion-access-token", refresh_token: "notion-refresh-token" }), { status: 200 });
    });

    await expect(exchangeAuthorizationCode(resolveConfig(env), "callback-code", fetchImpl)).resolves.toEqual({
      accessToken: "notion-access-token",
      refreshToken: "notion-refresh-token"
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.notion.com/v1/oauth/token", expect.any(Object));
  });

  it("rejects missing secrets before contacting Notion", async () => {
    const fetchImpl = vi.fn();
    await expect(exchangeAuthorizationCode(resolveConfig({ ...env, JTF_NOTION_OAUTH_CLIENT_SECRET: "" }), "callback-code", fetchImpl)).rejects.toThrow(
      "JTF_NOTION_OAUTH_CLIENT_SECRET is required"
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
