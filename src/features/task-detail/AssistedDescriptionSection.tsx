import { Check, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button, IconButton } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import type { AssistedDescriptionDraft, LocalTask } from "../../lib/types";
import { TaskFocusSection } from "./TaskFocusSection";

type DescriptionEditorMode = "hidden" | "ai" | "manual";

export const assistedDescriptionEditorSelector = "[data-description-editor]";

export function AssistedDescriptionSection({
  task,
  readOnly,
  isGeneratingDescription,
  onGenerateDescription,
  onSaveDescription
}: {
  task: LocalTask;
  readOnly: boolean;
  isGeneratingDescription: boolean;
  onGenerateDescription: (taskId: string, additionalContext: string) => Promise<AssistedDescriptionDraft>;
  onSaveDescription: (taskId: string, description: string) => void | Promise<void>;
}) {
  const hasDescription = Boolean(task.description?.trim());
  const [descriptionEditorMode, setDescriptionEditorMode] = useState<DescriptionEditorMode>(() =>
    hasDescription ? "hidden" : "ai"
  );
  const [descriptionContext, setDescriptionContext] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState<string | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [descriptionProposal, setDescriptionProposal] = useState<string | null>(null);
  const [isApplyingDescriptionProposal, setIsApplyingDescriptionProposal] = useState(false);
  const [manualDescriptionDraft, setManualDescriptionDraft] = useState(task.description ?? "");
  const [manualDescriptionMessage, setManualDescriptionMessage] = useState<string | null>(null);
  const [isSavingManualDescription, setIsSavingManualDescription] = useState(false);

  useEffect(() => {
    setDescriptionEditorMode(task.description?.trim() ? "hidden" : "ai");
    setDescriptionContext("");
    setDescriptionMessage(null);
    setClarificationQuestions([]);
    setDescriptionProposal(null);
    setIsApplyingDescriptionProposal(false);
    setManualDescriptionDraft(task.description ?? "");
    setManualDescriptionMessage(null);
    setIsSavingManualDescription(false);
  }, [task.id]);

  function cancelDescriptionContext() {
    setDescriptionContext("");
    setDescriptionMessage(null);
    setClarificationQuestions([]);
    if (task.description?.trim()) setDescriptionEditorMode("hidden");
  }

  function openAiDescriptionEditor() {
    setDescriptionEditorMode("ai");
    setDescriptionMessage(null);
    setClarificationQuestions([]);
    setManualDescriptionMessage(null);
  }

  function openManualDescriptionEditor() {
    setDescriptionEditorMode("manual");
    setManualDescriptionDraft(task.description ?? "");
    setManualDescriptionMessage(null);
    setDescriptionMessage(null);
    setClarificationQuestions([]);
  }

  async function generateDescription() {
    if (readOnly || isGeneratingDescription) return;
    setDescriptionMessage("Generating description...");
    setClarificationQuestions([]);

    try {
      const draft = await onGenerateDescription(task.id, descriptionContext);
      if (draft.status === "needs_clarification") {
        setDescriptionMessage("More context is needed before generating a useful description.");
        setClarificationQuestions(draft.clarificationQuestions);
        return;
      }
      if (!draft.description?.trim()) {
        setDescriptionMessage("The AI provider returned an empty description.");
        return;
      }
      setDescriptionProposal(draft.description);
      setDescriptionMessage(null);
      setClarificationQuestions([]);
    } catch (error) {
      setDescriptionMessage(error instanceof Error ? error.message : "Could not generate a description.");
    }
  }

  async function acceptDescriptionProposal() {
    if (!descriptionProposal || isApplyingDescriptionProposal) return;

    setIsApplyingDescriptionProposal(true);
    try {
      await onSaveDescription(task.id, descriptionProposal);
      setDescriptionProposal(null);
      setDescriptionEditorMode("hidden");
      setDescriptionContext("");
      setDescriptionMessage(null);
      setClarificationQuestions([]);
    } catch (error) {
      setDescriptionProposal(null);
      setDescriptionMessage(error instanceof Error ? error.message : "Could not apply the proposed description.");
    } finally {
      setIsApplyingDescriptionProposal(false);
    }
  }

  function cancelManualDescriptionEdit() {
    setManualDescriptionDraft(task.description ?? "");
    setManualDescriptionMessage(null);
    setDescriptionEditorMode(task.description?.trim() ? "hidden" : "ai");
  }

  async function saveManualDescription() {
    if (readOnly || isSavingManualDescription) return;

    const nextDescription = manualDescriptionDraft.trim();
    if (!nextDescription) {
      setManualDescriptionMessage("Description cannot be empty.");
      return;
    }

    setIsSavingManualDescription(true);
    setManualDescriptionMessage(null);
    try {
      await onSaveDescription(task.id, nextDescription);
      setDescriptionEditorMode("hidden");
    } catch (error) {
      setManualDescriptionMessage(error instanceof Error ? error.message : "Could not save the description.");
    } finally {
      setIsSavingManualDescription(false);
    }
  }

  function handleDescriptionContextKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void generateDescription();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelDescriptionContext();
    }
  }

  function handleManualDescriptionKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void saveManualDescription();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelManualDescriptionEdit();
    }
  }

  const showAiDescriptionEditor = !readOnly && descriptionEditorMode === "ai";
  const showManualDescriptionEditor = !readOnly && descriptionEditorMode === "manual";
  const manualDescriptionHasChanges = manualDescriptionDraft.trim() !== (task.description ?? "").trim();

  return (
    <>
      <TaskFocusSection
        title="Description"
        actions={
          hasDescription && !readOnly ? (
            <>
              <IconButton title="Edit description" onClick={openManualDescriptionEditor}>
                <Pencil size={15} />
              </IconButton>
              <Button variant="darkSecondary" onClick={openAiDescriptionEditor}>
                Regenerate
              </Button>
            </>
          ) : null
        }
      >
        {hasDescription && showAiDescriptionEditor ? (
          <DescriptionAiContextPanel
            clarificationQuestions={clarificationQuestions}
            descriptionContext={descriptionContext}
            descriptionMessage={descriptionMessage}
            isGeneratingDescription={isGeneratingDescription}
            onCancel={cancelDescriptionContext}
            onChange={setDescriptionContext}
            onGenerate={() => {
              void generateDescription();
            }}
            onKeyDown={handleDescriptionContextKeyDown}
          />
        ) : null}
        {showManualDescriptionEditor ? (
          <ManualDescriptionEditor
            draft={manualDescriptionDraft}
            hasChanges={manualDescriptionHasChanges}
            isSaving={isSavingManualDescription}
            message={manualDescriptionMessage}
            onCancel={cancelManualDescriptionEdit}
            onChange={setManualDescriptionDraft}
            onKeyDown={handleManualDescriptionKeyDown}
            onSave={() => {
              void saveManualDescription();
            }}
          />
        ) : task.description ? (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#dfe1e6]">{task.description}</pre>
        ) : (
          <div className="text-sm text-[#aeb3bd]">
            No final description yet.
            {task.notes ? <div className="mt-2 text-[#dfe1e6]">{task.notes}</div> : null}
          </div>
        )}
        {!hasDescription && showAiDescriptionEditor ? (
          <DescriptionAiContextPanel
            clarificationQuestions={clarificationQuestions}
            descriptionContext={descriptionContext}
            descriptionMessage={descriptionMessage}
            isGeneratingDescription={isGeneratingDescription}
            onCancel={cancelDescriptionContext}
            onChange={setDescriptionContext}
            onGenerate={() => {
              void generateDescription();
            }}
            onKeyDown={handleDescriptionContextKeyDown}
          />
        ) : null}
      </TaskFocusSection>
      {descriptionProposal ? (
        <DescriptionProposalDialog
          currentDescription={task.description ?? ""}
          isApplying={isApplyingDescriptionProposal}
          onAccept={() => {
            void acceptDescriptionProposal();
          }}
          onClose={() => setDescriptionProposal(null)}
          proposedDescription={descriptionProposal}
          taskTitle={`[${task.area}] ${task.title}`}
        />
      ) : null}
    </>
  );
}

function DescriptionAiContextPanel({
  clarificationQuestions,
  descriptionContext,
  descriptionMessage,
  isGeneratingDescription,
  onCancel,
  onChange,
  onGenerate,
  onKeyDown
}: {
  clarificationQuestions: string[];
  descriptionContext: string;
  descriptionMessage: string | null;
  isGeneratingDescription: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onGenerate: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="relative mt-4 overflow-hidden rounded border border-[#454852] bg-[#25272c]" data-description-editor>
      {isGeneratingDescription ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1f2126]/80 px-4 text-sm font-medium text-[#dfe1e6] backdrop-blur-[2px]">
          <span className="inline-flex items-center gap-2 rounded border border-[#454852] bg-[#25272c] px-4 py-3 shadow-xl">
            <Loader2 className="animate-spin text-[#85b8ff]" size={16} />
            Generating description proposal...
          </span>
        </div>
      ) : null}
      <div className="flex items-center justify-between border-b border-[#454852] px-3 py-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
          <Sparkles size={14} className="text-[#85b8ff]" />
          Description prompt
        </div>
      </div>
      <textarea
        className="min-h-[150px] w-full resize-y border-0 bg-[#1f2126] p-3 text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:ring-2 focus:ring-inset focus:ring-[#85b8ff]"
        disabled={isGeneratingDescription}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Describe what should be built, fixed, or validated. The AI will combine this note with the task title, project, area, and your description preferences to draft a Jira-ready proposal."
        value={descriptionContext}
      />
      {descriptionMessage ? (
        <div className="border-t border-[#454852] px-3 py-2 text-xs leading-relaxed text-[#aeb3bd]">{descriptionMessage}</div>
      ) : null}
      {clarificationQuestions.length ? (
        <div className="border-t border-[#454852] bg-[#22252a] px-3 py-2 text-sm text-[#dfe1e6]">
          <div className="mb-2 text-xs font-semibold text-[#aeb3bd]">Clarification questions</div>
          <ul className="space-y-1">
            {clarificationQuestions.map((question) => (
              <li className="flex gap-2" key={question}>
                <span className="text-[#85b8ff]">-</span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex justify-end gap-2 border-t border-[#454852] px-3 py-3">
        <Button disabled={isGeneratingDescription} variant="darkSecondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={isGeneratingDescription} variant="darkPrimary" onClick={onGenerate}>
          Generate
        </Button>
      </div>
    </div>
  );
}

function ManualDescriptionEditor({
  draft,
  hasChanges,
  isSaving,
  message,
  onCancel,
  onChange,
  onKeyDown,
  onSave
}: {
  draft: string;
  hasChanges: boolean;
  isSaving: boolean;
  message: string | null;
  onCancel: () => void;
  onChange: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
}) {
  return (
    <div className="overflow-hidden rounded border border-[#454852] bg-[#25272c]" data-description-editor>
      <div className="flex items-center justify-between border-b border-[#454852] px-3 py-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
          <Pencil size={14} className="text-[#85b8ff]" />
          Edit description
        </div>
      </div>
      <textarea
        autoFocus
        className="h-[320px] max-h-[42vh] min-h-[220px] w-full resize-y border-0 bg-[#1f2126] p-3 font-mono text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:ring-2 focus:ring-inset focus:ring-[#85b8ff]"
        disabled={isSaving}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        value={draft}
      />
      {message ? <div className="border-t border-[#454852] px-3 py-2 text-sm text-[#ffb4a8]">{message}</div> : null}
      <div className="flex justify-end gap-2 border-t border-[#454852] px-3 py-3">
        <Button disabled={isSaving} variant="darkSecondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={isSaving || !hasChanges || !draft.trim()}
          variant="darkPrimary"
          icon={isSaving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
          onClick={onSave}
        >
          {isSaving ? "Saving" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function DescriptionProposalDialog({
  currentDescription,
  isApplying,
  onAccept,
  onClose,
  proposedDescription,
  taskTitle
}: {
  currentDescription: string;
  isApplying: boolean;
  onAccept: () => void;
  onClose: () => void;
  proposedDescription: string;
  taskTitle: string;
}) {
  const overlay = useAppOverlay({
    layer: appOverlayLayers.nestedModal,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-[#091e42]/70 px-4 py-6 backdrop-blur-sm"
      {...overlay.backdropProps}
    >
      <section
        className="mx-auto flex h-full max-h-[840px] w-full max-w-[980px] flex-col overflow-hidden rounded border border-[#5d6470] bg-[#25272c] text-[#dfe1e6] shadow-2xl"
        {...overlay.surfaceProps}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#454852] px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
              <Sparkles size={16} className="text-[#85b8ff]" />
              AI proposal review
            </div>
            <p className="mt-1 truncate text-sm text-[#aeb3bd]">{taskTitle}</p>
          </div>
          <IconButton title="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="overflow-hidden rounded border border-[#454852] bg-[#25272c]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#454852] px-3 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium text-[#f4f5f7]">Description</span>
              </div>
            </div>
            <div className="bg-[#1f2126] font-mono text-xs leading-5">
              <div className="md:hidden">
                <InlineDescriptionDiffSection title="Current" tone="removed" lines={trimDiffLines(currentDescription)} />
                <InlineDescriptionDiffSection title="Proposed" tone="added" lines={trimDiffLines(proposedDescription)} />
              </div>
              <div className="hidden md:grid md:grid-cols-2">
                <DescriptionDiffSide title="Current" tone="removed" lines={trimDiffLines(currentDescription)} />
                <DescriptionDiffSide title="Proposed" tone="added" lines={trimDiffLines(proposedDescription)} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#454852] bg-[#22252a] p-4">
          <Button disabled={isApplying} icon={<X size={14} />} onClick={onClose} variant="darkSecondary">
            Reject
          </Button>
          <Button
            disabled={isApplying}
            icon={isApplying ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
            onClick={onAccept}
            variant="darkPrimary"
          >
            {isApplying ? "Applying" : "Accept proposal"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function InlineDescriptionDiffSection({
  lines,
  title,
  tone
}: {
  lines: string[];
  title: string;
  tone: "added" | "removed";
}) {
  const isRemoved = tone === "removed";

  return (
    <section className={`border-b border-[#454852] last:border-b-0 ${isRemoved ? "bg-[#2b1616]/70 text-[#ffb4a8]" : "bg-[#14251b]/70 text-[#a6e3b8]"}`}>
      <div className={`sticky top-0 z-10 border-b border-[#454852] px-3 py-2 font-sans text-xs font-semibold ${isRemoved ? "bg-[#2b1616] text-[#ffb4a8]" : "bg-[#14251b] text-[#a6e3b8]"}`}>
        {title}
      </div>
      {lines.map((line, index) => (
        <div className="grid grid-cols-[28px_1fr] gap-2 px-3 py-0.5" key={`${tone}-inline-${index}`}>
          <span className="select-none text-[#9aa0aa]">{isRemoved ? "-" : "+"}</span>
          <span className="whitespace-pre-wrap break-words">{line}</span>
        </div>
      ))}
    </section>
  );
}

function DescriptionDiffSide({ lines, title, tone }: { lines: string[]; title: string; tone: "added" | "removed" }) {
  const isRemoved = tone === "removed";

  return (
    <div className={`min-w-0 ${isRemoved ? "md:border-r md:border-[#454852]" : ""}`}>
      <div className={`sticky top-0 z-10 border-b border-[#454852] px-3 py-2 font-sans text-xs font-semibold ${isRemoved ? "bg-[#2b1616] text-[#ffb4a8]" : "bg-[#14251b] text-[#a6e3b8]"}`}>
        {title}
      </div>
      <div className={isRemoved ? "bg-[#2b1616]/70 text-[#ffb4a8]" : "bg-[#14251b]/70 text-[#a6e3b8]"}>
        {lines.map((line, index) => (
          <div className="grid grid-cols-[28px_1fr] gap-2 px-3 py-0.5" key={`${tone}-${index}`}>
            <span className="select-none text-[#9aa0aa]">{isRemoved ? "-" : "+"}</span>
            <span className="whitespace-pre-wrap break-words">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function trimDiffLines(value: string) {
  const lines = (value.trimEnd() || "(empty)").split("\n");
  const maxLines = 40;
  if (lines.length <= maxLines) return lines.map((line) => line || " ");
  return [...lines.slice(0, maxLines).map((line) => line || " "), `... ${lines.length - maxLines} more lines`];
}
