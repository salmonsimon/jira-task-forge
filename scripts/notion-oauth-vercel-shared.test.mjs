import { describe, expect, it, vi } from "vitest";
import { buildAuthorizationUrl, exchangeAuthorizationCode, readConfig } from "../server/notion-oauth-shared.js";

const env = {
  JTF_NOTION_OAUTH_CLIENT_ID: "client_123",
  JTF_NOTION_OAUTH_CLIENT_SECRET: "secret_456",
  JTF_NOTION_OAUTH_REDIRECT_URI: "https://notion-oauth.salmonsimon.com/notion/oauth/callback"
};

describe("notion oauth Vercel backend", () => {
  it("builds a Notion authorization URL without leaking the client secret", () => {
    const url = buildAuthorizationUrl(readConfig(env), "jtf_123456789012345678901234");

    expect(url).toContain("https://api.notion.com/v1/oauth/authorize?");
    expect(url).toContain("client_id=client_123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("owner=user");
    expect(url).toContain("state=jtf_123456789012345678901234");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fnotion-oauth.salmonsimon.com%2Fnotion%2Foauth%2Fcallback");
    expect(url).not.toContain("secret_456");
  });

  it("exchanges an authorization code server-side and preserves refresh tokens", async () => {
    const fetchImpl = vi.fn(async (_url, request) => {
      expect(request.headers.Authorization).toBe(`Basic ${Buffer.from("client_123:secret_456", "utf8").toString("base64")}`);
      expect(JSON.parse(request.body)).toEqual({
        grant_type: "authorization_code",
        code: "callback-code",
        redirect_uri: "https://notion-oauth.salmonsimon.com/notion/oauth/callback"
      });
      return Response.json({ access_token: "notion-access-token", refresh_token: "notion-refresh-token" });
    });

    await expect(exchangeAuthorizationCode(readConfig(env), "callback-code", fetchImpl)).resolves.toEqual({
      accessToken: "notion-access-token",
      refreshToken: "notion-refresh-token"
    });
  });
});
