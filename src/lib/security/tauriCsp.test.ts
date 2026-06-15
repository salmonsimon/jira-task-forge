import { describe, expect, it } from "vitest";
import tauriConfig from "../../../src-tauri/tauri.conf.json";

const splitDirectives = (policy: string) =>
  new Map(
    policy
      .split(";")
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...sources] = directive.split(/\s+/);
        return [name, sources];
      })
  );

describe("Tauri content security policy", () => {
  const csp = tauriConfig.app.security.csp;

  it("uses an explicit production policy", () => {
    expect(csp).toEqual(expect.any(String));
    expect(csp).not.toContain("null");
  });

  it("blocks remote scripts in production", () => {
    const directives = splitDirectives(csp);
    const scriptSources = directives.get("script-src");

    expect(scriptSources).toEqual(["'self'"]);
    expect(scriptSources).not.toContain("'unsafe-inline'");
    expect(scriptSources).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("https:");
  });

  it("keeps frontend network access limited to Tauri IPC in production", () => {
    const directives = splitDirectives(csp);

    expect(directives.get("connect-src")).toEqual(["ipc:", "http://ipc.localhost"]);
    expect(csp).not.toContain("atlassian.net");
    expect(csp).not.toContain("api.openai.com");
    expect(csp).not.toContain("anthropic.com");
    expect(csp).not.toContain("generativelanguage.googleapis.com");
  });
});
