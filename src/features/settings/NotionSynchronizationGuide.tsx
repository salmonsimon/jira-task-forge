import { Check, ChevronDown, ChevronLeft, ExternalLink, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FeedbackNote, LoadingOrb, PanelHeader } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { getModalMouseNavigationIntent, isMouseNavigationButton, shouldHandleEnterAsWizardAdvance } from "../../lib/modal-navigation";
import type { AppSettings, NotionCatalogConnectionTestResult } from "../../lib/types";

const notionDeveloperPortalUrl = "https://app.notion.com/developers/connections";
export const defaultNotionCatalogUrl = "https://app.notion.com/p/capacitacion-interna-dts/JTF-Sync-Catalog-387c335aece481c292baf6991a86a5c3";
export const notionCatalogSourceRequirementsUrl = "https://app.notion.com/p/395c335aece48144b2dbe2cc2e0de298";

type NotionStep = "source" | "token" | "review";
type NotionTokenDraftTestStatus = "idle" | "success" | "error";

const notionSteps: Array<{ id: NotionStep; label: string }> = [
  { id: "source", label: "Source" },
  { id: "token", label: "Token" },
  { id: "review", label: "Review" }
];

export const catalogModeOptions: Array<{ label: string; value: AppSettings["catalogSourceMode"] }> = [
  { label: "Sync from Notion page", value: "notion" },
  { label: "Manual catalog", value: "manual" }
];

export function canSaveNotionSynchronization(mode: AppSettings["catalogSourceMode"], testResult: NotionCatalogConnectionTestResult | null): boolean {
  return mode === "manual" || Boolean(testResult?.ok);
}

export function canSaveNotionTokenDraft(tokenDraft: string, tokenDraftTestStatus: NotionTokenDraftTestStatus, isSavingToken: boolean): boolean {
  return Boolean(tokenDraft.trim()) && tokenDraftTestStatus === "success" && !isSavingToken;
}

export function canTestNotionCatalogSource(
  mode: AppSettings["catalogSourceMode"],
  sourceUrl: string,
  hasToken: boolean,
  tokenDraft: string,
  isTesting: boolean
): boolean {
  if (isTesting) return false;
  if (mode !== "notion") return true;
  return Boolean(sourceUrl.trim()) && (hasToken || Boolean(tokenDraft.trim()));
}

export function NotionSynchronizationGuide({
  settings,
  hasNotionIntegrationToken,
  onChangeCatalogSettings,
  onClose,
  onDeleteNotionIntegrationToken,
  onOpenCatalogSourceRequirements,
  onOpenNotionDevelopers,
  onSaveNotionIntegrationToken,
  onTestNotionCatalogConnection
}: {
  settings: AppSettings;
  hasNotionIntegrationToken: () => Promise<boolean>;
  onChangeCatalogSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  onClose: () => void;
  onDeleteNotionIntegrationToken: () => Promise<void>;
  onOpenCatalogSourceRequirements: () => void;
  onOpenNotionDevelopers: () => void;
  onSaveNotionIntegrationToken: (token: string) => Promise<void>;
  onTestNotionCatalogConnection: (pageUrlOrId: string, token?: string) => Promise<NotionCatalogConnectionTestResult>;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState<NotionStep>("source");
  const [mode, setMode] = useState<AppSettings["catalogSourceMode"]>(
    settings.catalogSourceMode === "public-exportable" ? "notion" : settings.catalogSourceMode
  );
  const [sourceUrl, setSourceUrl] = useState(settings.catalogSourceUrl || defaultNotionCatalogUrl);
  const [tokenDraft, setTokenDraft] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [tokenDraftTestStatus, setTokenDraftTestStatus] = useState<NotionTokenDraftTestStatus>("idle");
  const [testResult, setTestResult] = useState<NotionCatalogConnectionTestResult | null>(null);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const visibleSteps = mode === "manual" ? notionSteps.filter((candidate) => candidate.id === "source") : notionSteps;
  const currentStepIndex = visibleSteps.findIndex((candidate) => candidate.id === step);
  const canContinue =
    (step === "source" && (mode === "manual" || Boolean(sourceUrl.trim()))) ||
    (step === "token" && (hasToken || mode !== "notion")) ||
    step === "review";
  const canSaveSynchronization = canSaveNotionSynchronization(mode, testResult) && (mode !== "notion" || hasToken);
  const canSaveTokenDraft = canSaveNotionTokenDraft(tokenDraft, tokenDraftTestStatus, isSavingToken);
  const canTestSource = canTestNotionCatalogSource(mode, sourceUrl, hasToken, tokenDraft, isTesting);
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

  useEffect(() => {
    if (mode === "manual" && step !== "source") {
      setStep("source");
    }
  }, [mode, step]);

  function moveNext() {
    const nextStep = visibleSteps[currentStepIndex + 1]?.id;
    if (nextStep) setStep(nextStep);
  }

  function moveBack() {
    const previousStep = visibleSteps[currentStepIndex - 1]?.id;
    if (previousStep) setStep(previousStep);
  }

  async function saveTokenDraft() {
    const token = tokenDraft.trim();
    if (!token || tokenDraftTestStatus !== "success") return;
    setIsSavingToken(true);
    try {
      await onSaveNotionIntegrationToken(token);
      setHasToken(true);
      setTokenDraft("");
      setTokenMessage("Notion token saved in the OS credential store.");
      setTokenDraftTestStatus("idle");
    } finally {
      setIsSavingToken(false);
    }
  }

  async function removeToken() {
    await onDeleteNotionIntegrationToken();
    setHasToken(false);
    setTokenDraft("");
    setTokenDraftTestStatus("idle");
    setTokenMessage("Notion token removed.");
    setTestResult(null);
  }

  async function testSource() {
    if (!canTestSource) return;
    setIsTesting(true);
    setTestResult(null);
    setTokenMessage(null);
    try {
      if (mode === "notion") {
        const result = await onTestNotionCatalogConnection(sourceUrl.trim(), tokenDraft.trim() || undefined);
        setTestResult(result);
        if (tokenDraft.trim()) {
          setTokenDraftTestStatus(result.ok ? "success" : "error");
          setTokenMessage(result.ok ? "This token passed Test source and can be saved." : "Test source failed. The draft token was not saved.");
        }
      } else {
        await onChangeCatalogSettings({ catalogSourceMode: mode, catalogSourceUrl: "" });
        setTestResult({
          ok: true,
          message: "Manual catalog mode is configured.",
          title: null,
          extractedBlockCount: 0
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestResult({
        ok: false,
        message: message || "Notion catalog connection test failed.",
        title: null,
        extractedBlockCount: 0
      });
      if (tokenDraft.trim()) {
        setTokenDraftTestStatus("error");
        setTokenMessage("Test source failed. The draft token was not saved.");
      }
    } finally {
      setIsTesting(false);
    }
  }

  async function saveAndClose() {
    if (!canSaveSynchronization) return;
    await onChangeCatalogSettings({ catalogSourceMode: mode, catalogSourceUrl: mode === "manual" ? "" : sourceUrl.trim() });
    onClose();
  }

  function handleWizardEnter(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!shouldHandleEnterAsWizardAdvance(event.target)) return;
    if (step === "review") {
      if (!canContinue || isTesting || !canSaveSynchronization) return;
      event.preventDefault();
      void saveAndClose();
      return;
    }
    if (!canContinue) return;
    event.preventDefault();
    moveNext();
  }

  function handleModalMouseUp(event: ReactMouseEvent<HTMLElement>) {
    const intent = getModalMouseNavigationIntent(event.button, {
      canGoBack: currentStepIndex > 0,
      canGoForward: step === "review" ? canContinue && !isTesting && canSaveSynchronization : canContinue
    });
    if (!intent) return;
    event.preventDefault();
    event.stopPropagation();
    if (intent === "back") {
      moveBack();
      return;
    }
    if (step === "review") {
      void saveAndClose();
      return;
    }
    moveNext();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(9,30,66,0.54)] px-4"
      {...overlay.backdropProps}
      onMouseDown={(event) => {
        if (isMouseNavigationButton(event.button)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
      onMouseUp={handleModalMouseUp}
    >
      <section
        ref={surfaceRef}
        className="flex max-h-[86vh] w-full max-w-[760px] flex-col overflow-hidden rounded border border-[#c1c7d0] bg-white shadow-2xl"
        {...overlay.surfaceProps}
        onKeyDown={handleWizardEnter}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={handleModalMouseUp}
      >
        <PanelHeader title="Set Catalog Source" subtitle="Choose Manual catalog for local Areas or connect the JTF Sync Catalog page for official area sync." onClose={onClose} />
        <div className="border-b border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <div className={`grid gap-2 ${visibleSteps.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
            {visibleSteps.map((candidate, index) => (
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
          {step === "source" ? (
            <GuideSection title="Catalog source" description="Choose whether Areas are managed locally or synced from the Notion catalog. Manual catalog saves immediately and skips external setup.">
              <SourceModeSelect label="Catalog mode" value={mode} options={catalogModeOptions} onChange={setMode} />
              {mode !== "manual" ? (
                <>
                  <GuideInput
                    label="Notion page URL or ID"
                    placeholder={defaultNotionCatalogUrl}
                    value={sourceUrl}
                    onChange={(value) => {
                      setSourceUrl(value);
                      setTestResult(null);
                      setTokenDraftTestStatus("idle");
                      setTokenMessage(null);
                    }}
                  />
                  <Button
                    className="settings-button-secondary"
                    icon={<ExternalLink size={13} />}
                    title={notionCatalogSourceRequirementsUrl}
                    variant="secondary"
                    onClick={onOpenCatalogSourceRequirements}
                  >
                    View source requirements
                  </Button>
                </>
              ) : (
                <FeedbackNote variant="warning">Manual catalog keeps Areas editable in Categories. No Notion token, page URL, or connection test is needed.</FeedbackNote>
              )}
            </GuideSection>
          ) : null}
          {step === "token" ? (
            <GuideSection title="Notion integration token" description="Create or copy the internal integration secret, test it against the selected page, then save it. The token stays in the OS credential store.">
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
                  setTokenDraftTestStatus("idle");
                  setTestResult(null);
                }}
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="settings-button-test"
                  disabled={!canTestSource || !tokenDraft.trim()}
                  icon={isTesting ? <LoadingOrb size="xs" /> : <RefreshCw size={14} />}
                  variant="secondary"
                  onClick={testSource}
                >
                  {isTesting ? "Testing..." : "Test source"}
                </Button>
                <Button
                  className="settings-button-primary"
                  disabled={!canSaveTokenDraft}
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
              {tokenMessage ? <FeedbackNote className="mt-4" variant="success">{tokenMessage}</FeedbackNote> : null}
            </GuideSection>
          ) : null}
          {step === "review" ? (
            <GuideSection title="Review and test" description="Save the source settings, then test that the app can read the JTF catalog contract.">
              <ReviewRows
                rows={[
                  ["Catalog mode", sourceLabel],
                  ["Source", mode === "manual" ? "Manual fallback" : sourceUrl.trim() || "Missing"],
                  ["Integration token", mode === "notion" ? (hasToken ? "Saved" : "Missing") : "Not required"]
                ]}
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="settings-button-test"
                  disabled={!canTestSource || (mode === "notion" && !hasToken)}
                  icon={isTesting ? <LoadingOrb size="xs" /> : <RefreshCw size={14} />}
                  variant="secondary"
                  onClick={testSource}
                >
                  {isTesting ? "Testing..." : "Test source"}
                </Button>
                <Button className="settings-button-primary" disabled={isTesting || !canSaveSynchronization} icon={<Check size={14} />} onClick={saveAndClose}>
                  Save synchronization
                </Button>
              </div>
              {testResult ? (
                <FeedbackNote className="mt-4" variant={testResult.ok ? "success" : "error"}>
                  {testResult.message}
                  {testResult.title ? ` Page: ${testResult.title}.` : ""}
                </FeedbackNote>
              ) : null}
            </GuideSection>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <Button disabled={currentStepIndex === 0} icon={<ChevronLeft size={14} />} variant="secondary" onClick={moveBack}>
            Back
          </Button>
          {step === "review" ? (
            <Button className="settings-button-primary" disabled={!canContinue || isTesting || !canSaveSynchronization} icon={<Check size={14} />} onClick={saveAndClose}>
              Done
            </Button>
          ) : step === "source" && mode === "manual" ? (
            <Button className="settings-button-primary" disabled={!canContinue || isTesting} icon={<Check size={14} />} onClick={saveAndClose}>
              Use manual catalog
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
      <div className="mb-2 block text-xs font-medium text-[#6b778c]">{label}</div>
      <button
        className="flex h-10 w-full items-center justify-between gap-2 rounded border border-[#c1c7d0] bg-white px-3 text-left text-sm text-[#172b4d] outline-none hover:bg-[#f4f5f7] focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div className="app-select-menu absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded border py-1 text-sm shadow-xl">
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className="app-select-option flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
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
