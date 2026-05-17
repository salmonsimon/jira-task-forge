import { Bot, Download, KeyRound, Settings, UploadCloud } from "lucide-react";
import { Button, DetailBlock, Field, PanelHeader, SegmentedControl } from "../../components/ui";

export function SettingsPanel({
  themeMode,
  setThemeMode,
  onClose
}: {
  themeMode: "light" | "dark" | "system";
  setThemeMode: (theme: "light" | "dark" | "system") => void;
  onClose: () => void;
}) {
  return (
    <aside className="fixed right-0 top-0 z-30 flex h-screen w-[420px] flex-col border-l border-[#dfe1e6] bg-white shadow-xl">
      <PanelHeader title="Settings" subtitle="Local configuration without secrets in backups" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        <DetailBlock icon={<Settings size={15} />} title="Appearance">
          <div className="mb-2 text-xs font-medium text-[#6b778c]">Theme</div>
          <SegmentedControl
            value={themeMode}
            options={[
              { label: "Dark", value: "dark" },
              { label: "Light", value: "light" },
              { label: "System", value: "system" }
            ]}
            onChange={(value) => setThemeMode(value as "light" | "dark" | "system")}
          />
        </DetailBlock>

        <DetailBlock icon={<KeyRound size={15} />} title="Jira connection">
          <Field label="Site URL" value="https://dts.atlassian.net" />
          <Field label="Auth method" value="OAuth 2.0 preferred · API token fallback" />
          <div className="mt-3">
            <Button variant="secondary">Test connection</Button>
          </div>
        </DetailBlock>

        <DetailBlock icon={<Bot size={15} />} title="AI provider">
          <Field label="Provider" value="OpenAI" />
          <Field label="Model" value="Selected in app settings" />
          <Field label="Default content language" value="Spanish" />
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
