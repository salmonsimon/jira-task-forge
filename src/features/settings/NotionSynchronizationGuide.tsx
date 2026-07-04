import { Check, CheckCircle2, ChevronDown, ChevronLeft, ExternalLink, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, LoadingOrb, PanelHeader } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import type { AppSettings, NotionCatalogConnectionTestResult } from "../../lib/types";

const notionDeveloperPortalUrl = "https://www.notion.so/developers";
export const defaultNotionCatalogUrl = "https://app.notion.com/p/capacitacion-interna-dts/JTF-Sync-Catalog-387c335aece481c292baf6991a86a5c3";

type NotionStep = "token" | "source" | "review";

const notionSteps: Array<{ id: NotionStep; label: string }> = [
  { id: "token", label: "Token" },
  { id: "source", label: "Source" },
  { id: "review", label: "Review" }
];

const catalogModeOptions: Array<{ label: string; value: AppSettings["catalogSourceMode"] }> = [
  { label: "Sync from Notion page", value: "notion" },
  { label: "Sync with public/exportable source", value: "public-exportable" },
  { label: "Manual catalog", value: "manual" }
];

export function NotionSynchronizationGuide({
  settings,
  hasNotionIntegrationToken,
  onChangeCatalogSettings,
  onClose,
  onDeleteNotionIntegrationToken,
  onOpenNotionDevelopers,
  onSaveNotionIntegrationToken,
  onTestNotionCatalogConnection
}: {
  settings: AppSettings;
  hasNotionIntegrationToken: () => Promise<boolean>;
  onChangeCatalogSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  onClose: () => void;
  onDeleteNotionIntegrationToken: () => Promise<void>;
  onOpenNotionDevelopers: () => void;
  onSaveNotionIntegrationToken: (token: string) => Promise<void>;
  onTestNotionCatalogConnection: (pageUrlOrId: string) => Promise<NotionCatalogConnectionTestResult>;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState<NotionStep>("token");
  const [mode, setMode] = useState<AppSettings["catalogSourceMode"]>(settings.catalogSourceMode);
  const [sourceUrl, setSourceUrl] = useState(settings.catalogSourceUrl || defaultNotionCatalogUrl);
  const [tokenDraft, setTokenDraft] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<NotionCatalogConnectionTestResult | null>(null);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const currentStepIndex = notionSteps.findIndex((candidate) => candidate.id === step);
  const canContinue =
    (step === "token" && (hasToken || Boolean(tokenDraft.trim()) || mode !== "notion")) ||
    (step === "source" && (mode === "manual" || Boolean(sourceUrl.trim()))) ||
    step === "review";
  const sourceLabel = useMemo(
    () => catalogModeOptions.find((option) => option.value === mode)?.label ?? "Unknown",
    [mode]
  );
  const overlay = useAppOverlay({
    layer: appOverlayLayers.nestedModal,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef
  });

  useEffect(() => {
    let cancelled = false;
    void hasNotionIntegrationToken().then((available) => {
      if (!cancelled) setHasToken(available);
    });
    return () => {
      cancelled = true;
    };
  }, [hasNotionIntegrationToken]);

  function moveNext() {
    const nextStep = notionSteps[currentStepIndex + 1]?.id;
    if (nextStep) setStep(nextStep);
  }

  function moveBack() {
    const previousStep = notionSteps[currentStepIndex - 1]?.id;
    if (previousStep) setStep(previousStep);
  }

  async function saveTokenDraft() {
    const token = tokenDraft.trim();
    if (!token) return;
    setIsSavingToken(true);
    try {
      await onSaveNotionIntegrationToken(token);
      setHasToken(true);
      setTokenDraft("");
      setTokenMessage("Notion token saved in the OS credential store.");
    } finally {
      setIsSavingToken(false);
    }
  }

  async function removeToken() {
    await onDeleteNotionIntegrationToken();
    setHasToken(false);
    setTokenDraft("");
    setTokenMessage("Notion token removed.");
    setTestResult(null);
  }

  async function testSource() {
    if (mode === "notion" && !sourceUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      if (tokenDraft.trim()) {
        await saveTokenDraft();
      }
      await onChangeCatalogSettings({ catalogSourceMode: mode, catalogSourceUrl: mode === "manual" ? "" : sourceUrl.trim() });
      if (mode === "notion") {
        setTestResult(await onTestNotionCatalogConnection(sourceUrl.trim()));
      } else {
        setTestResult({
          ok: true,
          message: mode === "manual" ? "Manual catalog mode is configured." : "Catalog source settings saved.",
          title: null,
          extractedBlockCount: 0
        });
      }
    } finally {
      setIsTesting(false);
    }
  }

  async function saveAndClose() {
    await onChangeCatalogSettings({ catalogSourceMode: mode, catalogSourceUrl: mode === "manual" ? "" : sourceUrl.trim() });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(9,30,66,0.54)] px-4"
      {...overlay.backdropProps}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <section
        ref={surfaceRef}
        className="flex max-h-[86vh] w-full max-w-[760px] flex-col overflow-hidden rounded border border-[#c1c7d0] bg-white shadow-2xl"
        {...overlay.surfaceProps}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <PanelHeader title="Set Notion Synchronization" subtitle="Connect the JTF Sync Catalog page used by official area sync." onClose={onClose} />
        <div className="border-b border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <div className="grid grid-cols-3 gap-2">
            {notionSteps.map((candidate, index) => (
              <button
                className={`h-8 rounded border px-2 text-xs font-medium ${
                  candidate.id === step
                    ? "border-[#0052cc] bg-[#deebff] text-[#0747a6]"
                    : index < currentStepIndex
                      ? "border-[#abf5d1] bg-[#e3fcef] text-[#006644]"
                      : "border-[#dfe1e6] bg-white text-[#6b778c]"
                }`}
                key={candidate.id}
                onClick={() => setStep(candidate.id)}
                type="button"
              >
                {index + 1}. {candidate.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-[360px] flex-1 overflow-y-auto p-6">
          {step === "token" ? (
            <GuideSection title="Notion integration token" description="Create or copy the internal integration secret, then save it before testing the page. The token stays in the OS credential store.">
              <div className="mb-5 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#172b4d]">{hasToken ? "Credential saved" : "No credential saved"}</div>
                    <p className="text-xs leading-relaxed text-[#6b778c]">The Notion page must also be shared with the Jira Task Forge connection.</p>
                  </div>
                  <Button
                    className="settings-button-secondary w-full justify-center sm:w-auto sm:shrink-0"
                    icon={<ExternalLink size={13} />}
                    title={notionDeveloperPortalUrl}
                    variant="secondary"
                    onClick={onOpenNotionDevelopers}
                  >
                    Manage token
                  </Button>
                </div>
              </div>
              <GuideInput
                label="New integration token"
                placeholder={hasToken ? "Enter a new token to replace it" : "Paste Notion integration token"}
                secret
                value={tokenDraft}
                onChange={(value) => {
                  setTokenDraft(value);
                  setTokenMessage(null);
                  setTestResult(null);
                }}
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="settings-button-primary"
                  disabled={!tokenDraft.trim() || isSavingToken}
                  icon={isSavingToken ? <LoadingOrb size="xs" /> : <KeyRound size={14} />}
                  variant="secondary"
                  onClick={saveTokenDraft}
                >
                  {isSavingToken ? "Saving..." : "Save token"}
                </Button>
                <Button
                  className="settings-button-danger"
                  disabled={!hasToken || isSavingToken}
                  icon={<Trash2 size={14} />}
                  variant="secondary"
                  onClick={removeToken}
                >
                  Remove token
                </Button>
              </div>
              {tokenMessage ? <Feedback kind="success">{tokenMessage}</Feedback> : null}
            </GuideSection>
          ) : null}
          {step === "source" ? (
            <GuideSection title="Catalog source" description="Use the existing Notion page as the source of truth. The app extracts the page id from the URL and reads the JSON code block through the Notion API.">
              <SourceModeSelect label="Catalog mode" value={mode} options={catalogModeOptions} onChange={setMode} />
              {mode !== "manual" ? (
                <GuideInput
                  label={mode === "notion" ? "Notion page URL or ID" : "Source URL"}
                  placeholder={mode === "notion" ? defaultNotionCatalogUrl : "https://.../jtf-sync-catalog.json"}
                  value={sourceUrl}
                  onChange={(value) => {
                    setSourceUrl(value);
                    setTestResult(null);
                  }}
                />
              ) : (
                <Feedback kind="warning">Manual catalog mode keeps the local fallback catalog and does not read Notion.</Feedback>
              )}
            </GuideSection>
          ) : null}
          {step === "review" ? (
            <GuideSection title="Review and test" description="Save the source settings, then test that the app can read the JTF catalog contract.">
              <ReviewRows
                rows={[
                  ["Catalog mode", sourceLabel],
                  ["Source", mode === "manual" ? "Manual fallback" : sourceUrl.trim() || "Missing"],
                  ["Integration token", mode === "notion" ? (hasToken || tokenDraft.trim() ? "Saved or ready to save" : "Missing") : "Not required"]
                ]}
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="settings-button-test"
                  disabled={isTesting || (mode === "notion" && (!sourceUrl.trim() || (!hasToken && !tokenDraft.trim())))}
                  icon={isTesting ? <LoadingOrb size="xs" /> : <RefreshCw size={14} />}
                  variant="secondary"
                  onClick={testSource}
                >
                  {isTesting ? "Testing..." : "Test source"}
                </Button>
                <Button className="settings-button-primary" disabled={isTesting || (mode !== "manual" && !sourceUrl.trim())} icon={<CheckCircle2 size={14} />} onClick={saveAndClose}>
                  Save synchronization
                </Button>
              </div>
              {testResult ? (
                <Feedback kind={testResult.ok ? "success" : "error"}>
                  {testResult.message}
                  {testResult.title ? ` Page: ${testResult.title}.` : ""}
                </Feedback>
              ) : null}
            </GuideSection>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <Button disabled={currentStepIndex === 0} icon={<ChevronLeft size={14} />} variant="secondary" onClick={moveBack}>
            Back
          </Button>
          {step === "review" ? (
            <Button className="settings-button-primary" disabled={!canContinue || isTesting} icon={<Check size={14} />} onClick={saveAndClose}>
              Done
            </Button>
          ) : (
            <Button className="settings-button-primary" disabled={!canContinue} onClick={moveNext}>
              Continue
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function GuideSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-semibold text-[#172b4d]">{title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-[#6b778c]">{description}</p>
      {children}
    </section>
  );
}

function GuideInput({
  label,
  placeholder,
  secret = false,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  secret?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-[#6b778c]">{label}</span>
      <input
        className={`h-9 w-full rounded border border-[#c1c7d0] bg-white px-2 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff] ${secret ? "secret-input" : ""}`}
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SourceModeSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: AppSettings["catalogSourceMode"];
  options: Array<{ label: string; value: AppSettings["catalogSourceMode"] }>;
  onChange: (value: AppSettings["catalogSourceMode"]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="relative mb-3">
      <div className="mb-1 block text-xs font-medium text-[#6b778c]">{label}</div>
      <button
        className="flex h-9 w-full items-center justify-between gap-2 rounded border border-[#c1c7d0] bg-white px-2 text-left text-sm text-[#172b4d] outline-none hover:bg-[#f4f5f7] focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded border border-[#c1c7d0] bg-white py-1 text-sm shadow-xl">
          {options.map((option) => (
            <button
              className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-[#172b4d] hover:bg-[#f4f5f7]"
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReviewRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="rounded border border-[#dfe1e6] bg-white">
      {rows.map(([label, value]) => (
        <div className="border-b border-[#ebecf0] px-3 py-2.5 last:border-b-0" key={label}>
          <div className="mb-1 text-xs font-semibold text-[#6b778c]">{label}</div>
          <div className="min-w-0 break-words text-sm text-[#172b4d]">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Feedback({ children, kind }: { children: ReactNode; kind: "success" | "warning" | "error" }) {
  return (
    <div
      className={`mt-4 rounded border px-3 py-2 text-xs font-medium ${
        kind === "success"
          ? "border-[#006644] bg-[#00875a] text-white"
          : kind === "warning"
            ? "border-[#f5cd47] bg-[#fff7d6] text-[#533f04]"
            : "border-[#ffbdad] bg-[#ffebe6] text-[#5d1f1a]"
      }`}
    >
      {children}
    </div>
  );
}
