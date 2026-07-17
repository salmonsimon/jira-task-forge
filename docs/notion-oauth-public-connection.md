[English](notion-oauth-public-connection.md) | [Español](notion-oauth-public-connection.es.md) · [Back to README](../README.md)

# Create And Host Your Own Notion OAuth Public Connection

> This is an advanced maintainer guide for forks and self-hosted versions of
> Jira Task Forge. If you use the standard app from GitHub Releases, do not
> follow the publisher or backend setup below. Use `Connect Notion` in the app
> and follow the [Catalog Sync Guide](catalog-sync.md).

This document explains how to create and host the Notion public OAuth
connection required by an independent Jira Task Forge deployment. The desktop
app must not contain the Notion OAuth client secret.

The Notion public connection is created once by the Jira Task Forge publisher.
End users do not create Notion integrations, do not paste integration secrets,
and do not manually add a connection from the Notion page menu. They only click
`Connect Notion`, authorize the Jira Task Forge public connection on Notion's
OAuth page, and choose the catalog page in Notion's page picker.

The selected catalog must be an owned page in the user's workspace. The
[Catalog Sync Guide](catalog-sync.md) explains how to copy the public example,
keep it as a dedicated top-level page, and select only that page in the picker.

Why Jira Task Forge needs its own backend:

- Notion provides the hosted authorization page at
  `https://api.notion.com/v1/oauth/authorize`.
- Jira Task Forge still needs a redirect URI that Notion can call after the user
  approves access.
- Jira Task Forge also needs a trusted server-side place to exchange the
  temporary authorization code for tokens, because that exchange uses the Notion
  OAuth client secret.
- `https://notion-oauth.salmonsimon.com` is that Jira Task Forge-owned redirect
  and exchange service. It is not replacing Notion's OAuth page.

Publisher setup:

1. Create one Notion public connection for Jira Task Forge in Notion Developer
   portal.
2. Use `Any workspace` installation scope.
3. Register this redirect URI:
   `https://notion-oauth.salmonsimon.com/notion/oauth/callback`.
4. Deploy the Vercel API routes under `api/notion/oauth/` behind
   `https://notion-oauth.salmonsimon.com`. The committed `vercel.json` rewrites
   public `/notion/oauth/...` paths to Vercel's `/api/notion/oauth/...`
   function routes.
5. Store the Notion connection client id and client secret as backend secrets.

End-user flow:

1. Click `Connect Notion` in Jira Task Forge.
2. Authorize the Jira Task Forge public connection on Notion's page.
3. Select only the dedicated catalog page in Notion's page picker.
4. Paste the temporary callback code into Jira Task Forge.
5. Confirm the catalog page URL or id.
6. Jira Task Forge validates the selected page and stores the OAuth token set in
   the OS credential store.

Catalog page access model:

- The Jira Task Forge publisher configures the public connection once. End users
  authorize their own Notion workspace and receive their own token.
- External users create a catalog page in their own workspace by copying the
  catalog source requirements and selecting that page during OAuth.
- Team users can share one catalog page. They may need `Full access` on that
  dedicated page for it to appear/select correctly in Notion's OAuth picker,
  because the picker is granting the connection access to the page.
- Do not select a broad parent page such as a project wiki root. Notion can grant
  child-page access when a parent page is selected. Select the dedicated catalog
  page itself.
- Sharing a child catalog page does not require sharing its parent page, but a
  root-level dedicated catalog page is safer because it avoids accidental parent
  selection.

Desktop runtime configuration:

- `JTF_NOTION_OAUTH_BACKEND_BASE_URL`: optional backend base URL. Defaults to
  `https://notion-oauth.salmonsimon.com`. Non-local URLs must use HTTPS.
- `JTF_NOTION_OAUTH_START_URL`: optional full URL for the authorization-start
  endpoint. Defaults to `{backendBaseUrl}/notion/oauth/start`.
- `JTF_NOTION_OAUTH_EXCHANGE_URL`: optional full URL for the code-exchange
  endpoint. Defaults to `{backendBaseUrl}/notion/oauth/exchange`.

The desktop app also supports direct local authorization URL construction with
`JTF_NOTION_OAUTH_CLIENT_ID` and `JTF_NOTION_OAUTH_REDIRECT_URI`, but that is a
development convenience only. The preferred flow is to let the OAuth backend own
the client id, redirect URI, and client secret.

OAuth backend runtime configuration:

- `JTF_NOTION_OAUTH_CLIENT_ID`: Notion public connection client id.
- `JTF_NOTION_OAUTH_CLIENT_SECRET`: Notion public connection client secret.
- `JTF_NOTION_OAUTH_REDIRECT_URI`: callback URI registered for the Notion public
  connection. For local development use
  `http://127.0.0.1:5177/notion/oauth/callback`.
- `JTF_NOTION_OAUTH_BACKEND_PORT`: optional local backend port. Defaults to
  `5177`.

Production backend target:

- Deploy this repo to a dedicated Vercel project or deploy only the API routes
  under `api/notion/oauth/`.
- Keep the committed `vercel.json` in the deployment so
  `https://notion-oauth.salmonsimon.com/notion/oauth/start`,
  `https://notion-oauth.salmonsimon.com/notion/oauth/exchange`, and
  `https://notion-oauth.salmonsimon.com/notion/oauth/callback` reach the Vercel
  functions in `api/notion/oauth/`.
- Add `notion-oauth.salmonsimon.com` as a Vercel domain for that project.
- In Wix DNS, create the subdomain record that Vercel requests for
  `notion-oauth.salmonsimon.com`.
- Set `JTF_NOTION_OAUTH_CLIENT_ID`, `JTF_NOTION_OAUTH_CLIENT_SECRET`, and
  `JTF_NOTION_OAUTH_REDIRECT_URI` as Vercel environment variables, not committed
  files. Use `https://notion-oauth.salmonsimon.com/notion/oauth/callback` for
  the redirect URI.
- Register this redirect URI in the Notion public connection:
  `https://notion-oauth.salmonsimon.com/notion/oauth/callback`.

Local development fallback:

Use localhost only when deliberately testing without the deployed backend.
Start the local exchange backend with:


```bash
JTF_NOTION_OAUTH_CLIENT_ID="<client-id>" \
JTF_NOTION_OAUTH_CLIENT_SECRET="<client-secret>" \
JTF_NOTION_OAUTH_REDIRECT_URI="http://127.0.0.1:5177/notion/oauth/callback" \
npm run notion:oauth-backend
```

Then start the desktop app in another shell with the local backend override:

```bash
JTF_NOTION_OAUTH_BACKEND_BASE_URL="http://127.0.0.1:5177" \
npm run tauri dev
```

Desktop flow:

1. Settings opens `Connect Notion`.
2. The Tauri backend generates an OAuth state and stores it temporarily in the OS
   credential store.
3. The OAuth backend returns the Notion authorization URL.
4. The user authorizes the public connection in Notion and selects the catalog
   page in Notion's page picker.
5. Notion redirects to the backend callback page, which shows the temporary
   callback code and state without storing tokens.
6. The user completes the callback code in Jira Task Forge and enters the
   selected catalog page URL or id.
7. The Tauri backend verifies the state, calls the OAuth backend exchange
   endpoint, tests the selected page with the returned access token, then saves
   the access token in the OS credential store only after the page passes
   validation.

The access token must never be written to SQLite, backups, logs, screenshots, or
committed files. Failed exchange or page validation must not persist the token.

Pending real-smoke requirement:

- Create the Notion public connection with `Any workspace` installation scope.
- Deploy the OAuth Vercel API with the Notion client secret stored server-side.
- Run one credentialed OAuth smoke against a dedicated test catalog page without
  printing the authorization code, access token, or client secret.
