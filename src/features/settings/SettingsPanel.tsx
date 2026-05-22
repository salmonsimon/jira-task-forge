import { Bot, Download, KeyRound, Settings, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Button, DetailBlock, PanelHeader, SegmentedControl } from "../../components/ui";
import type { AppSettings, ThemeMode } from "../../lib/types";

export function SettingsPanel({
  settings,
  hasJiraApiToken,
  jiraCredentialMessage,
  onChange,
  onSaveJiraApiToken,
  onDeleteJiraApiToken,
  onClose
}: {
  settings: AppSettings;
  hasJiraApiToken: boolean;
  jiraCredentialMessage: string | null;
  onChange: (settings: Partial<AppSettings>) => void;
  onSaveJiraApiToken: (token: string) => Promise<boolean>;
  onDeleteJiraApiToken: () => void;
  onClose: () => void;
}) {
  const [jiraApiTokenDraft, setJiraApiTokenDraft] = useState("");

  async function saveJiraToken() {
    const saved = await onSaveJiraApiToken(jiraApiTokenDraft);
    if (saved) setJiraApiTokenDraft("");
  }

  return (
    <aside className="fixed right-0 top-0 z-30 flex h-screen w-[420px] flex-col border-l border-[#dfe1e6] bg-white shadow-xl">
      <PanelHeader title="Settings" subtitle="Local configuration without secrets in backups" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        <DetailBlock icon={<Settings size={15} />} title="Appearance">
          <div className="mb-2 text-xs font-medium text-[#6b778c]">Theme</div>
          <SegmentedControl
            value={settings.themeMode}
            options={[
              { label: "Dark", value: "dark" },
              { label: "Light", value: "light" },
              { label: "System", value: "system" }
            ]}
            onChange={(value) => onChange({ themeMode: value as ThemeMode })}
          />
        </DetailBlock>

        <DetailBlock icon={<KeyRound size={15} />} title="Jira connection">
          <SettingsInput
            label="Site URL"
            value={settings.jiraSiteUrl}
            onChange={(jiraSiteUrl) => onChange({ jiraSiteUrl })}
          />
          <SettingsInput
            label="Account email"
            placeholder="name@example.com"
            value={settings.jiraAccountEmail}
            onChange={(jiraAccountEmail) => onChange({ jiraAccountEmail })}
          />
          <SettingsSelect
            label="Auth method"
            value={settings.jiraAuthMethod}
            options={[
              { label: "API token fallback", value: "api-token" },
              { label: "OAuth-ready later", value: "oauth-ready" }
            ]}
            onChange={(jiraAuthMethod) => onChange({ jiraAuthMethod: jiraAuthMethod as AppSettings["jiraAuthMethod"] })}
          />
          <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
            Tokens are never stored in SQLite or backups. The backend stores the token in the OS credential store.
          </p>
          <div className="mt-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-[#6b778c]">API token</div>
                <div className="text-sm font-medium text-[#172b4d]">
                  {hasJiraApiToken ? "Credential saved" : "No credential saved"}
                </div>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-medium ${hasJiraApiToken ? "bg-[#e3fcef] text-[#006644]" : "bg-[#f4f5f7] text-[#6b778c]"}`}>
                {hasJiraApiToken ? "Saved" : "Missing"}
              </span>
            </div>
            <SettingsInput
              label="New API token"
              masked
              placeholder={hasJiraApiToken ? "Enter a new token to replace it" : "Paste API token"}
              value={jiraApiTokenDraft}
              onChange={setJiraApiTokenDraft}
            />
            <div className="flex gap-2">
              <Button disabled={!jiraApiTokenDraft.trim()} variant="secondary" onClick={saveJiraToken}>
                Save token
              </Button>
              <Button disabled={!hasJiraApiToken} variant="secondary" onClick={onDeleteJiraApiToken}>
                Remove token
              </Button>
            </div>
            {jiraCredentialMessage ? (
              <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">{jiraCredentialMessage}</p>
            ) : null}
          </div>
          <div className="mt-3">
            <Button disabled variant="secondary">Test connection</Button>
          </div>
        </DetailBlock>

        <DetailBlock icon={<Bot size={15} />} title="AI provider">
          <SettingsSelect
            label="Provider"
            value={settings.aiProvider}
            options={[
              { label: "OpenAI", value: "OpenAI" },
              { label: "None", value: "None" }
            ]}
            onChange={(aiProvider) => onChange({ aiProvider: aiProvider as AppSettings["aiProvider"] })}
          />
          <SettingsInput label="Model" value={settings.aiModel} onChange={(aiModel) => onChange({ aiModel })} />
          <SettingsSelect
            label="Default content language"
            value={settings.defaultContentLanguage}
            options={[
              { label: "Spanish", value: "Spanish" },
              { label: "English", value: "English" }
            ]}
            onChange={(defaultContentLanguage) =>
              onChange({ defaultContentLanguage: defaultContentLanguage as AppSettings["defaultContentLanguage"] })
            }
          />
          <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
            AI keys follow the same secret boundary as Jira credentials and are never included in backups.
          </p>
        </DetailBlock>

        <DetailBlock icon={<Download size={15} />} title="Backup and restore">
          <p className="mb-3 text-sm text-[#6b778c]">
            Backups include trays, descriptions, attachments, categories, epic mappings, favorites, and sync logs. Secrets are excluded.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={14} />}>
              Export backup
            </Button>
            <Button variant="secondary" icon={<UploadCloud size={14} />}>
              Import backup
            </Button>
          </div>
        </DetailBlock>
      </div>
    </aside>
  );
}

function SettingsInput({
  label,
  value,
  masked = false,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  masked?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-[#6b778c]">{label}</span>
      <input
        className={`h-9 w-full rounded border border-[#c1c7d0] bg-white px-2 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff] ${masked ? "secret-input" : ""}`}
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SettingsSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-[#6b778c]">{label}</span>
      <select
        className="h-9 w-full rounded border border-[#c1c7d0] bg-white px-2 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
