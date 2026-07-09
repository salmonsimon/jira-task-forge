import { Check, ChevronDown, ChevronLeft, ExternalLink, Link, RefreshCw, Trash2 } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FeedbackNote, LoadingOrb, PanelHeader } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { getModalMouseNavigationIntent, isMouseNavigationButton, shouldHandleEnterAsWizardAdvance } from "../../lib/modal-navigation";
import type { AppSettings, NotionCatalogConnectionTestResult, NotionOAuthConnectionResult, NotionOAuthStartResult } from "../../lib/types";

export const defaultNotionCatalogUrl = "https://app.notion.com/p/387c335aece481c292baf6991a86a5c3";
export const notionCatalogSourceRequirementsUrl = "https://app.notion.com/p/395c335aece48144b2dbe2cc2e0de298";

type NotionStep = "source" | "connect" | "catalog" | "review";
type NotionOAuthStatus = "idle" | "started" | "success" | "error";

const notionSteps: Array<{ id: NotionStep; label: string }> = [
  { id: "source", label: "Source" },
  { id: "connect", label: "Connect" },
  { id: "catalog", label: "Catalog page" },
  { id: "review", label: "Review" }
];

export const catalogModeOptions: Array<{ label: string; value: AppSettings["catalogSourceMode"] }> = [
  { label: "Sync from Notion page", value: "notion" },
  { label: "Manual catalog", value: "manual" }
];

export function canSaveNotionSynchronization(mode: AppSettings["catalogSourceMode"], testResult: NotionCatalogConnectionTestResult | null): boolean {
  return mode === "manual" || Boolean(testResult?.ok);
}

export function canCompleteNotionOAuth(
  mode: AppSettings["catalogSourceMode"],
  authorizationCode: string,
  pendingState: string | null,
  isCompleting: boolean
): boolean {
  if (isCompleting || mode !== "notion") return false;
  return Boolean(authorizationCode.trim() && pendingState?.trim());
}

export function canTestNotionCatalogSource(
  mode: AppSettings["catalogSourceMode"],
  sourceUrl: string,
  hasToken: boolean,
  isTesting: boolean
): boolean {
  if (isTesting) return false;
  if (mode !== "notion") return true;
  return Boolean(sourceUrl.trim()) && hasToken;
}

export function NotionSynchronizationGuide({
  settings,
  hasNotionIntegrationToken,
  onChangeCatalogSettings,
  onClose,
  onDeleteNotionIntegrationToken,
  onOpenCatalogSourceRequirements,
  onStartNotionOAuthConnection,
  onOpenNotionOAuthAuthorizationUrl,
  onCompleteNotionOAuthConnection,
  onTestNotionCatalogConnection,
  initialStep = "source"
}: {
  settings: AppSettings;
  hasNotionIntegrationToken: () => Promise<boolean>;
  onChangeCatalogSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  onClose: () => void;
  onDeleteNotionIntegrationToken: () => Promise<void>;
  onOpenCatalogSourceRequirements: () => void;
  onStartNotionOAuthConnection: () => Promise<NotionOAuthStartResult>;
  onOpenNotionOAuthAuthorizationUrl: (url: string) => Promise<void> | void;
  onCompleteNotionOAuthConnection: (authorizationCode: string, state: string) => Promise<NotionOAuthConnectionResult>;
  onTestNotionCatalogConnection: (pageUrlOrId: string, token?: string) => Promise<NotionCatalogConnectionTestResult>;
  initialStep?: NotionStep;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState<NotionStep>(initialStep);
  const [mode, setMode] = useState<AppSettings["catalogSourceMode"]>(
    settings.catalogSourceMode === "public-exportable" ? "notion" : settings.catalogSourceMode
  );
  const [sourceUrl, setSourceUrl] = useState(settings.catalogSourceUrl || defaultNotionCatalogUrl);
  const [hasToken, setHasToken] = useState(false);
  const [oauthCode, setOauthCode] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<NotionOAuthStatus>("idle");
  const [pendingOAuthState, setPendingOAuthState] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<NotionCatalogConnectionTestResult | null>(null);
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [isCompletingOAuth, setIsCompletingOAuth] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingSynchronization, setIsSavingSynchronization] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const visibleSteps = mode === "manual" ? notionSteps.filter((candidate) => candidate.id === "source") : notionSteps;
  const currentStepIndex = visibleSteps.findIndex((candidate) => candidate.id === step);
  const canContinue =
    step === "source" ||
    (step === "connect" && (hasToken || oauthStatus === "success" || mode !== "notion")) ||
    (step === "catalog" && (mode !== "notion" || canSaveNotionSynchronization(mode, testResult))) ||
    step === "review";
  const canSaveSynchronization = canSaveNotionSynchronization(mode, testResult) && (mode !== "notion" || hasToken);
  const canCompleteOAuth = canCompleteNotionOAuth(mode, oauthCode, pendingOAuthState, isCompletingOAuth);
  const canTestSource = canTestNotionCatalogSource(mode, sourceUrl, hasToken, isTesting);
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

  async function startOAuth() {
    if (mode !== "notion") return;
    setIsStartingOAuth(true);
    setOauthMessage(null);
    setOauthStatus("idle");
    try {
      const result = await onStartNotionOAuthConnection();
      setPendingOAuthState(result.state);
      setAuthorizationUrl(result.authorizationUrl);
      await onOpenNotionOAuthAuthorizationUrl(result.authorizationUrl);
      setOauthStatus("started");
      setOauthMessage("Notion authorization opened. After approval, paste the callback code here to finish connecting.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOauthStatus("error");
      setOauthMessage(message || "Could not start Notion OAuth.");
    } finally {
      setIsStartingOAuth(false);
    }
  }

  async function completeOAuth() {
    if (!canCompleteOAuth || !pendingOAuthState) return;
    setIsCompletingOAuth(true);
    setOauthMessage(null);
    setTestResult(null);
    try {
      const result = await onCompleteNotionOAuthConnection(oauthCode.trim(), pendingOAuthState);
      setHasToken(true);
      setOauthCode("");
      setOauthStatus("success");
      setOauthMessage(result.message || "Notion callback code accepted. Connection saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOauthStatus("error");
      setOauthMessage(message || "Notion OAuth failed. No connection was saved.");
    } finally {
      setIsCompletingOAuth(false);
    }
  }

  async function removeToken() {
    await onDeleteNotionIntegrationToken();
    setHasToken(false);
    setOauthCode("");
    setAuthorizationUrl(null);
    setOauthStatus("idle");
    setOauthMessage("Notion connection removed.");
    setTestResult(null);
  }

  async function testSource() {
    if (!canTestSource) return;
    setIsTesting(true);
    setTestResult(null);
    setOauthMessage(null);
    try {
      if (mode === "notion") {
        const result = await onTestNotionCatalogConnection(sourceUrl.trim());
        setTestResult(result);
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
    } finally {
      setIsTesting(false);
    }
  }

  async function saveAndClose() {
    if (!canSaveSynchronization || isSavingSynchronization) return;
    setIsSavingSynchronization(true);
    setSaveStatus("saving");
    setSaveMessage(mode === "manual" ? "Saving manual catalog mode..." : "Saving synchronization and refreshing Areas...");
    try {
      const saved = await onChangeCatalogSettings({ catalogSourceMode: mode, catalogSourceUrl: mode === "manual" ? "" : sourceUrl.trim() });
      if (saved) {
        onClose();
        return;
      }
      setSaveStatus("error");
      setSaveMessage("Could not save synchronization settings.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveStatus("error");
      setSaveMessage(message || "Could not save synchronization settings.");
    } finally {
      setIsSavingSynchronization(false);
    }
  }

  function handleWizardEnter(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!shouldHandleEnterAsWizardAdvance(event.target)) return;
    if (step === "review") {
      if (!canContinue || isTesting || isSavingSynchronization || !canSaveSynchronization) return;
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
      canGoForward: step === "review" ? canContinue && !isTesting && !isSavingSynchronization && canSaveSynchronization : canContinue
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
          <div className={`grid gap-2 ${visibleSteps.length === 1 ? "grid-cols-1" : "grid-cols-4"}`}>
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
                <FeedbackNote variant="info">Continue to connect Notion, then confirm the dedicated catalog page before saving.</FeedbackNote>
              ) : (
                <FeedbackNote variant="warning">Manual catalog keeps Areas editable in Categories. No Notion token, page URL, or connection test is needed.</FeedbackNote>
              )}
            </GuideSection>
          ) : null}
          {step === "connect" ? (
            <GuideSection title="Connect Notion" description="Authorize the Jira Task Forge public connection in Notion, paste the callback code, then save the connection. OAuth callback codes are single-use, so saving the connection is the code check.">
              <div className="mb-5 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#172b4d]">{hasToken ? "Notion connected" : "Notion not connected"}</div>
                    <p className="text-xs leading-relaxed text-[#6b778c]">
                      The access token is saved in the OS credential store after the callback code is accepted. The catalog page is selected and tested in the next step.
                    </p>
                  </div>
                  <Button
                    className="settings-button-primary w-full justify-center sm:w-auto sm:shrink-0"
                    disabled={isStartingOAuth}
                    icon={isStartingOAuth ? <LoadingOrb size="xs" /> : <ExternalLink size={13} />}
                    variant="secondary"
                    onClick={startOAuth}
                  >
                    {isStartingOAuth ? "Opening..." : "Connect Notion"}
                  </Button>
                </div>
              </div>
              <GuideInput
                label="OAuth callback code"
                placeholder="Paste the code returned by the Notion callback"
                value={oauthCode}
                onChange={(value) => {
                  setOauthCode(value);
                  setOauthMessage(null);
                  setOauthStatus(pendingOAuthState ? "started" : "idle");
                  setTestResult(null);
                }}
              />
              {authorizationUrl ? (
                <div className="mt-4 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
                  <div className="text-xs font-semibold text-[#172b4d]">Authorization link</div>
                  <p className="mt-1 text-xs leading-relaxed text-[#6b778c]">If the browser did not open, copy this URL into your browser.</p>
                  <code className="mt-2 block max-h-24 overflow-auto break-all rounded border border-[#dfe1e6] bg-white p-2 text-xs text-[#172b4d]">{authorizationUrl}</code>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="settings-button-test"
                  disabled={!canCompleteOAuth}
                  icon={isCompletingOAuth ? <LoadingOrb size="xs" /> : <Link size={14} />}
                  variant="secondary"
                  onClick={completeOAuth}
                >
                  {isCompletingOAuth ? "Saving..." : "Test & save code"}
                </Button>
                <Button
                  className="settings-button-danger"
                  disabled={!hasToken || isCompletingOAuth}
                  icon={<Trash2 size={14} />}
                  variant="secondary"
                  onClick={removeToken}
                >
                  Delete connection
                </Button>
              </div>
              {oauthMessage ? <FeedbackNote className="mt-4" variant={oauthStatus === "error" ? "error" : "success"}>{oauthMessage}</FeedbackNote> : null}
            </GuideSection>
          ) : null}
          {step === "catalog" ? (
            <GuideSection title="Catalog page" description="Paste the dedicated catalog page URL or ID that you selected in the Notion OAuth picker. The page must pass validation before synchronization can be saved.">
              <GuideInput
                label="Selected catalog page URL or ID"
                placeholder={defaultNotionCatalogUrl}
                value={sourceUrl}
                onChange={(value) => {
                  setSourceUrl(value);
                  setTestResult(null);
                  setOauthStatus(pendingOAuthState ? "started" : hasToken ? "success" : "idle");
                  setOauthMessage(null);
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
              <FeedbackNote className="mt-2" variant="warning">
                Select only the dedicated catalog page in Notion. Selecting a parent page may also share its child pages; team catalogs may require Full access on that dedicated page.
              </FeedbackNote>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="settings-button-test"
                  disabled={!canTestSource || !hasToken}
                  icon={isTesting ? <LoadingOrb size="xs" /> : <RefreshCw size={14} />}
                  variant="secondary"
                  onClick={testSource}
                >
                  {isTesting ? "Testing..." : "Test source"}
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
          {step === "review" ? (
            <GuideSection title="Review and save" description="Save the source settings after the catalog page test passes. Saving refreshes Areas from the selected source.">
              <ReviewRows
                rows={[
                  ["Catalog mode", sourceLabel],
                  ["Source", mode === "manual" ? "Manual fallback" : sourceUrl.trim() || "Missing"],
                  ["Notion connection", mode === "notion" ? (hasToken ? "Connected" : "Missing") : "Not required"]
                ]}
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <Button className="settings-button-primary" disabled={isTesting || isSavingSynchronization || !canSaveSynchronization} icon={isSavingSynchronization ? <LoadingOrb size="xs" /> : <Check size={14} />} onClick={saveAndClose}>
                  {isSavingSynchronization ? "Saving..." : "Save synchronization"}
                </Button>
              </div>
              {testResult ? (
                <FeedbackNote className="mt-4" variant={testResult.ok ? "success" : "error"}>
                  {testResult.message}
                  {testResult.title ? ` Page: ${testResult.title}.` : ""}
                </FeedbackNote>
              ) : null}
              {saveMessage ? <FeedbackNote className="mt-4" variant={saveStatus === "error" ? "error" : "info"}>{saveMessage}</FeedbackNote> : null}
            </GuideSection>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <Button disabled={currentStepIndex === 0} icon={<ChevronLeft size={14} />} variant="secondary" onClick={moveBack}>
            Back
          </Button>
          {step === "review" ? (
            <Button
              className="settings-button-primary"
              disabled={!canContinue || isTesting || isSavingSynchronization || !canSaveSynchronization}
              icon={isSavingSynchronization ? <LoadingOrb size="xs" /> : <Check size={14} />}
              onClick={saveAndClose}
            >
              {isSavingSynchronization ? "Saving..." : "Done"}
            </Button>
          ) : step === "source" && mode === "manual" ? (
            <Button
              className="settings-button-primary"
              disabled={!canContinue || isTesting || isSavingSynchronization}
              icon={isSavingSynchronization ? <LoadingOrb size="xs" /> : <Check size={14} />}
              onClick={saveAndClose}
            >
              {isSavingSynchronization ? "Saving..." : "Use manual catalog"}
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
