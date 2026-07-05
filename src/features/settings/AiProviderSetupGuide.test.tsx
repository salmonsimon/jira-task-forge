import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../lib/types";
import { AiProviderSetupGuide, defaultAiProviderModels } from "./AiProviderSetupGuide";

const settings: AppSettings = {
  themeMode: "light",
  jiraSiteUrl: "https://salmonsimondts.atlassian.net",
  jiraAccountEmail: "simon.bahamonde@gmail.com",
  jiraAuthMethod: "api-token",
  jiraCreationProjectKey: "JTFTEST",
  aiProvider: "OpenAI",
  aiModel: "gpt-4.1",
  defaultContentLanguage: "Spanish",
  catalogSourceMode: "manual",
  catalogSourceUrl: ""
};

function renderGuide(overrides: Partial<AppSettings> = {}) {
  return renderToStaticMarkup(
    <AiProviderSetupGuide
      settings={{ ...settings, ...overrides }}
      hasAiProviderApiKey={false}
      aiCredentialMessage={null}
      isTestingAiProviderConnection={false}
      onChange={async () => true}
      onClose={() => undefined}
      onDeleteAiProviderApiKey={() => undefined}
      onOpenAiProviderApiKeys={() => undefined}
      onSaveAiProviderApiKey={async () => true}
      onTestAiProviderApiKey={async () => ({ ok: true, message: "Connected" })}
      onTestAiProviderConnection={async () => ({ ok: true, message: "Connected" })}
    />
  );
}

describe("AiProviderSetupGuide", () => {
  it("shows provider choices with default recommended models", () => {
    const html = renderGuide();

    expect(html).toContain("Set AI Provider");
    expect(html).toContain("OpenAI");
    expect(html).toContain(defaultAiProviderModels.OpenAI);
    expect(html).toContain("Claude");
    expect(html).toContain(defaultAiProviderModels.Claude);
    expect(html).toContain("Gemini");
    expect(html).toContain(defaultAiProviderModels.Gemini);
  });

  it("keeps OpenAI as the provider-agnostic default when AI is off", () => {
    const html = renderGuide({ aiProvider: "None", aiModel: "" });

    expect(html).toContain("Provider:</span> OpenAI");
    expect(html).toContain("Model:</span> gpt-4.1");
  });
});
