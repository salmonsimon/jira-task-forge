import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../lib/types";
import { AiProviderSetupGuide, availableAiProviderModels, defaultAiProviderModels } from "./AiProviderSetupGuide";

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
  it("shows the three setup levels and provider dropdown entry point", () => {
    const html = renderGuide();

    expect(html).toContain("Set AI Provider");
    expect(html).toContain("1. Provider");
    expect(html).toContain("2. API key");
    expect(html).toContain("3. Model");
    expect(html).toContain("AI provider");
    expect(html).toContain("OpenAI");
    expect(html).toContain("Default model:</span> gpt-4.1");
  });

  it("keeps available model options separate from provider selection", () => {
    expect(availableAiProviderModels.OpenAI).toContain(defaultAiProviderModels.OpenAI);
    expect(availableAiProviderModels.Claude).toContain(defaultAiProviderModels.Claude);
    expect(availableAiProviderModels.Gemini).toContain(defaultAiProviderModels.Gemini);
  });

  it("keeps OpenAI as the provider-agnostic default when AI is off", () => {
    const html = renderGuide({ aiProvider: "None", aiModel: "" });

    expect(html).toContain("Provider:</span> OpenAI");
    expect(html).toContain("Default model:</span> gpt-4.1");
  });
});
