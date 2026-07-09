import { Bot, Check, ChevronLeft, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { Button, FeedbackNote, LoadingOrb, PanelHeader } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { normalizeEpicScope, suggestTransversalEpicScope, TBD_EPIC_SCOPE } from "../../lib/domain";
import { getModalMouseNavigationIntent, isMouseNavigationButton, shouldHandleEnterAsWizardAdvance } from "../../lib/modal-navigation";

type CreateTrayStep = "tray" | "transversal";

const createTraySteps: Array<{ id: CreateTrayStep; label: string }> = [
  { id: "tray", label: "Tray scope" },
  { id: "transversal", label: "Transversal" }
];

export type CreateTrayInput = {
  name: string;
  epicScope: string;
  transversalEpicScope: string | null;
};

export function CreateTrayDialog({
  onClose,
  onCreateTray,
  onSuggestTransversalScope,
  onConfigureAiProvider,
  isAiProviderConfigured = true,
  initialStep = "tray",
  initialTrayName = "",
  initialEpicScope = ""
}: {
  onClose: () => void;
  onCreateTray: (input: CreateTrayInput) => void | Promise<void>;
  onSuggestTransversalScope?: (epicScope: string) => Promise<string>;
  onConfigureAiProvider?: () => void;
  isAiProviderConfigured?: boolean;
  initialStep?: CreateTrayStep;
  initialTrayName?: string;
  initialEpicScope?: string;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const epicScopeInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<CreateTrayStep>(initialStep);
  const [trayName, setTrayName] = useState(initialTrayName);
  const [epicScopeDraft, setEpicScopeDraft] = useState(initialEpicScope);
  const [transversalScopeDraft, setTransversalScopeDraft] = useState("");
  const [suggestionState, setSuggestionState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const normalizedScope = normalizeEpicScope(epicScopeDraft);
  const normalizedTransversalScope = normalizeEpicScope(transversalScopeDraft);
  const currentStepIndex = createTraySteps.findIndex((candidate) => candidate.id === step);
  const isTbdScope = normalizedScope === TBD_EPIC_SCOPE;
  const canContinueFromTray = Boolean(trayName.trim() && normalizedScope);
  const canCreateFromTransversal = Boolean(canContinueFromTray && (isTbdScope || normalizedTransversalScope));
  const overlay = useAppOverlay({
    layer: appOverlayLayers.modal,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef
  });

  useEffect(() => {
    if (!normalizedScope || step !== "transversal" || isTbdScope) return;
    if (transversalScopeDraft.trim()) return;
    if (!isAiProviderConfigured) return;
    void suggestTransversalScope();
  }, [isAiProviderConfigured, isTbdScope, normalizedScope, step, transversalScopeDraft]);

  async function suggestTransversalScope() {
    if (!normalizedScope || isTbdScope) return;
    if (!isAiProviderConfigured) {
      setSuggestionState("idle");
      setSuggestionMessage("Set up an AI provider before asking for a Transversal scope suggestion.");
      onConfigureAiProvider?.();
      return;
    }
    setSuggestionState("loading");
    setSuggestionMessage(null);
    try {
      const suggestion = onSuggestTransversalScope
        ? await onSuggestTransversalScope(normalizedScope)
        : (suggestTransversalEpicScope(normalizedScope) ?? "");
      const normalizedSuggestion = normalizeEpicScope(suggestion);
      if (!normalizedSuggestion) throw new Error("No Transversal scope suggestion was returned.");
      setTransversalScopeDraft(normalizedSuggestion);
      setSuggestionState("ready");
      setSuggestionMessage("Review the suggested Transversal scope before creating the tray.");
    } catch (error) {
      const fallback = suggestTransversalEpicScope(normalizedScope);
      if (fallback) setTransversalScopeDraft(fallback);
      setSuggestionState("failed");
      setSuggestionMessage(error instanceof Error ? error.message : "Could not suggest a Transversal scope.");
    }
  }

  function continueFromTray() {
    if (!canContinueFromTray) return;
    if (isTbdScope) {
      void createTray();
      return;
    }
    setStep("transversal");
  }

  function handleTrayNameKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    epicScopeInputRef.current?.focus();
  }

  function handleWizardEnter(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!shouldHandleEnterAsWizardAdvance(event.target)) return;
    if (event.defaultPrevented) return;
    if (step === "tray") {
      if (!canContinueFromTray) return;
      event.preventDefault();
      continueFromTray();
      return;
    }
    if (!canCreateFromTransversal || isCreating) return;
    event.preventDefault();
    void createTray();
  }

  function handleModalMouseUp(event: ReactMouseEvent<HTMLElement>) {
    const intent = getModalMouseNavigationIntent(event.button, {
      canGoBack: step !== "tray" && !isCreating,
      canGoForward: step === "tray" ? canContinueFromTray && !isCreating : canCreateFromTransversal && !isCreating
    });
    if (!intent) return;
    event.preventDefault();
    event.stopPropagation();
    if (intent === "back") {
      setStep("tray");
      return;
    }
    if (step === "tray") {
      continueFromTray();
      return;
    }
    void createTray();
  }

  async function createTray() {
    if (!normalizedScope || !canCreateFromTransversal) return;
    setIsCreating(true);
    try {
      await onCreateTray({
        name: trayName.trim(),
        epicScope: normalizedScope,
        transversalEpicScope: isTbdScope ? null : normalizedTransversalScope
      });
      onClose();
    } finally {
      setIsCreating(false);
    }
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
        className="flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded border border-[#c1c7d0] bg-white shadow-2xl"
        {...overlay.surfaceProps}
        onKeyDown={handleWizardEnter}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={handleModalMouseUp}
      >
        <PanelHeader title="Create Tray" subtitle="Set the tray name and Epic Scope before capture starts." onClose={onClose} />
        <div className="border-b border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <div className="grid grid-cols-2 gap-2">
            {createTraySteps.map((candidate, index) => (
              <button
                className={`h-8 rounded border px-2 text-xs font-medium ${
                  candidate.id === step
                    ? "border-[#0052cc] bg-[#deebff] text-[#0747a6]"
                    : index < currentStepIndex
                      ? "border-[#abf5d1] bg-[#e3fcef] text-[#006644]"
                      : "border-[#dfe1e6] bg-white text-[#6b778c]"
                }`}
                disabled={candidate.id === "transversal" && (!canContinueFromTray || isTbdScope)}
                key={candidate.id}
                onClick={() => {
                  if (candidate.id === "transversal" && (!canContinueFromTray || isTbdScope)) return;
                  setStep(candidate.id);
                }}
                type="button"
              >
                {index + 1}. {candidate.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-[320px] flex-1 overflow-y-auto p-6">
          {step === "tray" ? (
            <GuideSection title="Tray scope" description="This scope is used in Jira epic targets for every non-Transversal project group.">
              <GuideInput label="Tray name" placeholder="Demo prep" value={trayName} onChange={setTrayName} onKeyDown={handleTrayNameKeyDown} />
              <GuideInput inputRef={epicScopeInputRef} label="Epic Scope" placeholder="Enter Epic Scope" value={epicScopeDraft} onChange={setEpicScopeDraft} />
              <div className="mt-4 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4 text-sm text-[#172b4d]">
                <div className="font-semibold">Jira epic target preview</div>
                <div className="mt-2 font-mono text-xs text-[#42526e]">[Project] [Area] {normalizedScope ?? "Scope"}</div>
              </div>
              {epicScopeDraft.trim().toLowerCase() === "[tbd]" ? (
                <FeedbackNote className="mt-3" variant="info">[TBD] will be saved as TBD.</FeedbackNote>
              ) : null}
            </GuideSection>
          ) : null}

          {step === "transversal" ? (
            <GuideSection title="Transversal scope" description="Transversal epics use a confirmed plural scope. Review the assisted suggestion or edit it manually.">
              <div className="mb-4 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                <div className="text-xs font-medium text-[#6b778c]">Singular scope</div>
                <div className="mt-1 text-sm font-semibold text-[#172b4d]">{normalizedScope}</div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  className="app-action-secondary"
                  disabled={suggestionState === "loading" || !normalizedScope || isTbdScope}
                  icon={suggestionState === "loading" ? <LoadingOrb size="xs" /> : <Sparkles size={14} />}
                  variant="secondary"
                  onClick={() => void suggestTransversalScope()}
                >
                  {suggestionState === "loading" ? "Suggesting..." : isAiProviderConfigured ? "Suggest with AI" : "Set up AI provider"}
                </Button>
              </div>
              <GuideInput label="Transversal Epic Scope" placeholder="Enter plural Epic Scope" value={transversalScopeDraft} onChange={setTransversalScopeDraft} />
              {suggestionMessage ? (
                <FeedbackNote className="mt-3" variant={suggestionState === "failed" ? "warning" : "success"}>{suggestionMessage}</FeedbackNote>
              ) : null}
              <div className="mt-4 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4 text-sm text-[#172b4d]">
                <div className="flex items-center gap-2 font-semibold"><Bot size={14} /> Transversal preview</div>
                <div className="mt-2 font-mono text-xs text-[#42526e]">[Transversal] [Area] {normalizedTransversalScope ?? "Scope"}</div>
              </div>
            </GuideSection>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <Button disabled={step === "tray" || isCreating} icon={<ChevronLeft size={14} />} variant="secondary" onClick={() => setStep("tray")}>
            Back
          </Button>
          {step === "tray" ? (
            <Button className="settings-button-primary" disabled={!canContinueFromTray || isCreating} onClick={continueFromTray}>
              {isTbdScope ? "Create tray" : "Continue"}
            </Button>
          ) : (
            <Button className="settings-button-primary" disabled={!canCreateFromTransversal || isCreating} icon={isCreating ? <LoadingOrb size="xs" /> : <Check size={14} />} onClick={() => void createTray()}>
              {isCreating ? "Creating..." : "Create tray"}
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
  value,
  onChange,
  onKeyDown,
  inputRef
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-[#6b778c]">{label}</span>
      <input
        className="h-9 w-full rounded border border-[#c1c7d0] bg-white px-2 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
        placeholder={placeholder}
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}
