import { Check, ChevronDown, Eye, Loader2, MessageCircle, Pencil, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button, IconButton } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import {
  applyManualAssistedDescriptionSectionEdit,
  assistedDescriptionSectionDefinitions,
  buildAssistedDescriptionParagraphDiff,
  buildAssistedDescriptionProposal,
  buildResolveAssistedDescriptionProposalItemPatch,
  buildResolveAssistedDescriptionProposalPatch,
  createEmptyAssistedDescriptionSectionStatuses,
  getAssistedDescriptionProposalItems,
  getAssistedDescriptionSectionLabel,
  hasAcceptedAssistedDescriptionProposalSections,
  hasMeaningfulAssistedDescriptionContent,
  insertAssistedDescriptionProposal,
  isAssistedDescriptionProposalItemStale,
  markAssistedDescriptionSectionPolished,
  parseAssistedDescriptionMarkdown,
  replaceAssistedDescriptionProposal,
  reviseAssistedDescriptionProposal,
  serializeAssistedDescriptionSections,
  toNewAssistedDescriptionProposal,
  type AssistedDescriptionProposal,
  type AssistedDescriptionProposalItem,
  type AssistedDescriptionSectionId,
  type AssistedDescriptionSectionStatuses,
  type AssistedDescriptionSections
} from "../../lib/domain/assistedDescription";
import type {
  AssistedDescriptionDraft,
  AssistedDescriptionProposalStatus,
  DescriptionProposalLogEntry,
  DescriptionSectionStatus,
  LocalTask,
  NewAssistedDescriptionProposal
} from "../../lib/types";
import { cn } from "../../lib/utils";
import { AssistedDescriptionMarkdown } from "./AssistedDescriptionMarkdown";
import { TaskFocusSection } from "./TaskFocusSection";

export const assistedDescriptionEditorSelector = "[data-description-editor]";

const allSectionIds = assistedDescriptionSectionDefinitions.map((section) => section.id);

export function AssistedDescriptionSection({
  task,
  readOnly,
  isGeneratingDescription,
  onGenerateDescription,
  onListProposals,
  onListProposalLog,
  onSaveDescription,
  onCreateProposal,
  onRefreshTask,
  onTransitionProposal,
  onUpdateProposalSection,
  proposalModel,
  proposalProvider
}: {
  task: LocalTask;
  readOnly: boolean;
  isGeneratingDescription: boolean;
  onGenerateDescription: (taskId: string, additionalContext: string) => Promise<AssistedDescriptionDraft>;
  onListProposals?: (taskId: string) => Promise<AssistedDescriptionProposal[]>;
  onListProposalLog?: (taskId: string) => Promise<DescriptionProposalLogEntry[]>;
  onSaveDescription: (taskId: string, description: string) => void | Promise<void>;
  onCreateProposal?: (proposal: NewAssistedDescriptionProposal) => Promise<AssistedDescriptionProposal>;
  onRefreshTask?: (taskId: string) => Promise<void>;
  onTransitionProposal?: (
    proposalId: string,
    status: AssistedDescriptionProposalStatus,
    options?: { reviewerComment?: string | null; applyToTaskDescription?: boolean }
  ) => Promise<AssistedDescriptionProposal | null>;
  onUpdateProposalSection?: (
    proposalId: string,
    sectionId: AssistedDescriptionSectionId,
    patch: {
      proposedContent?: string | null;
      status?: DescriptionSectionStatus | null;
      reviewerComment?: string | null;
      applyToTaskDescription?: boolean;
    }
  ) => Promise<AssistedDescriptionProposal | null>;
  proposalModel?: string | null;
  proposalProvider?: string | null;
}) {
  const sections = useMemo(() => parseAssistedDescriptionMarkdown(task.description), [task.description]);
  const hasDescriptionContent = hasMeaningfulAssistedDescriptionContent(sections);
  const hasEmptySections = assistedDescriptionSectionDefinitions.some((section) => !sections[section.id].trim());
  const canLoadPersistedProposals = Boolean(onListProposals || onListProposalLog);
  const [sectionStatuses, setSectionStatuses] = useState<AssistedDescriptionSectionStatuses>(() =>
    createEmptyAssistedDescriptionSectionStatuses()
  );
  const [showEmptySections, setShowEmptySections] = useState(false);
  const [descriptionContext, setDescriptionContext] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState<string | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [promptOpen, setPromptOpen] = useState(() => !hasDescriptionContent);
  const [proposalPanelOpen, setProposalPanelOpen] = useState(true);
  const [proposals, setProposals] = useState<AssistedDescriptionProposal[]>([]);
  const [proposalLog, setProposalLog] = useState<DescriptionProposalLogEntry[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [proposalLoadMessage, setProposalLoadMessage] = useState<string | null>(null);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [savingSectionId, setSavingSectionId] = useState<AssistedDescriptionSectionId | null>(null);
  const [sectionMessages, setSectionMessages] = useState<Partial<Record<AssistedDescriptionSectionId, string>>>({});
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [resolvingProposalAction, setResolvingProposalAction] = useState<"accept" | "reject" | null>(null);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);
  const [isRequestingProposalChanges, setIsRequestingProposalChanges] = useState(false);
  const [editingProposalItemId, setEditingProposalItemId] = useState<string | null>(null);

  useEffect(() => {
    const nextSections = parseAssistedDescriptionMarkdown(task.description);
    setSectionStatuses(createEmptyAssistedDescriptionSectionStatuses());
    setShowEmptySections(false);
    setDescriptionContext("");
    setDescriptionMessage(null);
    setClarificationQuestions([]);
    setPromptOpen(!hasMeaningfulAssistedDescriptionContent(nextSections));
    setProposalPanelOpen(true);
    setProposals([]);
    setProposalLog([]);
    setIsLoadingProposals(false);
    setProposalLoadMessage(null);
    setActiveProposalId(null);
    setSavingSectionId(null);
    setSectionMessages({});
    setReviewMessage(null);
    setResolvingProposalAction(null);
    setResolvingItemId(null);
    setIsRequestingProposalChanges(false);
    setEditingProposalItemId(null);
    if (!onListProposals && !onListProposalLog) return;

    let isCurrent = true;
    setIsLoadingProposals(true);
    Promise.all([
      onListProposals ? onListProposals(task.id) : Promise.resolve([]),
      onListProposalLog ? onListProposalLog(task.id) : Promise.resolve([])
    ])
      .then(([nextProposals, nextProposalLog]) => {
        if (!isCurrent) return;
        setProposals(nextProposals);
        setProposalLog(nextProposalLog);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setProposalLoadMessage(error instanceof Error ? error.message : "Could not load saved proposals.");
      })
      .finally(() => {
        if (isCurrent) setIsLoadingProposals(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [task.id, canLoadPersistedProposals]);

  const activeProposal = activeProposalId ? proposals.find((proposal) => proposal.id === activeProposalId) ?? null : null;

  function clearDescriptionPrompt() {
    setDescriptionContext("");
    setDescriptionMessage(null);
    setClarificationQuestions([]);
    if (hasDescriptionContent) setPromptOpen(false);
  }

  async function generateProposal(sectionIds: AssistedDescriptionSectionId[] = allSectionIds, changeRequest = descriptionContext) {
    if (readOnly || isGeneratingDescription) return false;

    setDescriptionMessage("Generating proposal...");
    setClarificationQuestions([]);
    setReviewMessage(null);

    try {
      const draft = await onGenerateDescription(task.id, buildGenerationContext(changeRequest, sectionIds));
      if (draft.status === "needs_clarification") {
        setDescriptionMessage("More context is needed before generating a useful proposal.");
        setClarificationQuestions(draft.clarificationQuestions);
        setProposalPanelOpen(true);
        setPromptOpen(true);
        return false;
      }
      if (!draft.description?.trim()) {
        setDescriptionMessage("The AI provider returned an empty proposal.");
        return false;
      }

      const proposal = buildAssistedDescriptionProposal({
        changeRequest,
        currentMarkdown: serializeAssistedDescriptionSections(sections),
        model: proposalModel,
        proposedMarkdown: draft.description,
        provider: proposalProvider,
        sectionIds,
        taskId: task.id
      });
      const savedProposal = onCreateProposal
        ? await onCreateProposal(toNewAssistedDescriptionProposal(proposal))
        : proposal;
      setProposals((currentProposals) => insertAssistedDescriptionProposal(currentProposals, savedProposal));
      await refreshProposalLog();
      setActiveProposalId(savedProposal.id);
      setDescriptionContext("");
      setDescriptionMessage(null);
      setClarificationQuestions([]);
      setPromptOpen(false);
      setProposalPanelOpen(true);
      return true;
    } catch (error) {
      setDescriptionMessage(error instanceof Error ? error.message : "Could not generate a description proposal.");
      setProposalPanelOpen(true);
      setPromptOpen(true);
      return false;
    }
  }

  async function requestProposalChanges(
    proposal: AssistedDescriptionProposal,
    sectionIds: AssistedDescriptionSectionId[],
    changeRequest: string
  ) {
    if (readOnly || isRequestingProposalChanges || isGeneratingDescription || !changeRequest.trim()) return false;

    setIsRequestingProposalChanges(true);
    setReviewMessage(null);
    try {
      const draft = await onGenerateDescription(task.id, buildGenerationContext(changeRequest, sectionIds));
      if (draft.status === "needs_clarification") {
        setReviewMessage(`More context is needed: ${draft.clarificationQuestions.join(" ")}`);
        return false;
      }
      if (!draft.description?.trim()) {
        setReviewMessage("The AI provider returned an empty revision.");
        return false;
      }

      const revision = buildAssistedDescriptionProposal({
        changeRequest,
        currentMarkdown: serializeAssistedDescriptionSections(sections),
        model: proposalModel,
        proposedMarkdown: draft.description,
        provider: proposalProvider,
        sectionIds,
        taskId: task.id
      });
      let revisedProposal = reviseAssistedDescriptionProposal(proposal, revision, sectionIds);
      if (onUpdateProposalSection) {
        for (const sectionId of sectionIds) {
          const revisionSection = revision.sections.find((section) => section.sectionId === sectionId);
          const persistedProposal = await onUpdateProposalSection(proposal.id, sectionId, {
            proposedContent: revisionSection?.proposedContent ?? "",
            status: "Raw",
            reviewerComment: changeRequest,
            applyToTaskDescription: false
          });
          if (persistedProposal) revisedProposal = persistedProposal;
        }
      }
      setProposals((currentProposals) => replaceAssistedDescriptionProposal(currentProposals, revisedProposal));
      await refreshProposalLog();
      setActiveProposalId(proposal.id);
      return true;
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Could not request changes for this proposal.");
      return false;
    } finally {
      setIsRequestingProposalChanges(false);
    }
  }

  async function saveSection(sectionId: AssistedDescriptionSectionId, content: string) {
    if (readOnly || savingSectionId) return false;

    const nextState = applyManualAssistedDescriptionSectionEdit(
      { sections, sectionStatuses },
      sectionId,
      content
    );

    setSavingSectionId(sectionId);
    setSectionMessages((currentMessages) => ({ ...currentMessages, [sectionId]: undefined }));
    try {
      await onSaveDescription(task.id, serializeAssistedDescriptionSections(nextState.sections));
      setSectionStatuses(nextState.sectionStatuses);
      return true;
    } catch (error) {
      setSectionMessages((currentMessages) => ({
        ...currentMessages,
        [sectionId]: error instanceof Error ? error.message : "Could not save this section."
      }));
      return false;
    } finally {
      setSavingSectionId(null);
    }
  }

  function markSectionOk(sectionId: AssistedDescriptionSectionId) {
    if (readOnly) return;
    const nextState = markAssistedDescriptionSectionPolished({ sections, sectionStatuses }, sectionId);
    setSectionStatuses(nextState.sectionStatuses);
  }

  async function resolveProposalItem(proposal: AssistedDescriptionProposal, item: AssistedDescriptionProposalItem, accepted: boolean) {
    if (readOnly || resolvingItemId || proposal.status !== "Pending") return;

    const patch = buildResolveAssistedDescriptionProposalItemPatch(
      { sections, sectionStatuses },
      proposal,
      item.id,
      accepted
    );
    if (!patch) return;

    setResolvingItemId(item.id);
    setReviewMessage(null);
    try {
      if (onUpdateProposalSection || onTransitionProposal) {
        let persistedProposal: AssistedDescriptionProposal | null = null;
        if (accepted) {
          persistedProposal = onUpdateProposalSection
            ? await onUpdateProposalSection(proposal.id, item.sectionId, {
                status: "Polished",
                reviewerComment: `Accepted ${item.label}.`,
                applyToTaskDescription: true
              })
            : null;
          await refreshTaskDescription();
        } else {
          const pendingItems = getAssistedDescriptionProposalItems(proposal).filter((candidate) => candidate.status === "pending");
          if (pendingItems.length <= 1 && onTransitionProposal) {
            const nextStatus = hasAcceptedAssistedDescriptionProposalSections(proposal) ? "Partial" : "Rejected";
            persistedProposal = await onTransitionProposal(proposal.id, nextStatus, {
              reviewerComment: `Rejected ${item.label}.`,
              applyToTaskDescription: nextStatus === "Partial"
            });
            if (nextStatus === "Partial") await refreshTaskDescription();
          } else {
            // The backend stores accepted sections as Polished, but does not have a durable
            // item-level rejected state while a proposal remains Pending. This logs the
            // reviewer decision without pretending that a reload can recover the row as rejected.
            persistedProposal = onUpdateProposalSection
              ? await onUpdateProposalSection(proposal.id, item.sectionId, {
                  status: "Raw",
                  reviewerComment: `Rejected ${item.label}.`,
                  applyToTaskDescription: false
                })
              : null;
            setReviewMessage(
              "Section rejection was logged. Saved proposals show rejected sections after the proposal is finished as Partial or Rejected."
            );
          }
        }
        setSectionStatuses(patch.sectionStatuses);
        if (persistedProposal) {
          setProposals((currentProposals) => replaceAssistedDescriptionProposal(currentProposals, persistedProposal));
        }
        await refreshProposalLog();
        return;
      }

      if (patch.shouldApplyDescription) await onSaveDescription(task.id, patch.markdown);
      setSectionStatuses(patch.sectionStatuses);
      setProposals((currentProposals) => replaceAssistedDescriptionProposal(currentProposals, patch.proposal));
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Could not resolve this section.");
    } finally {
      setResolvingItemId(null);
    }
  }

  async function editProposalItem(
    proposal: AssistedDescriptionProposal,
    item: AssistedDescriptionProposalItem,
    proposedContent: string
  ) {
    if (readOnly || editingProposalItemId || proposal.status !== "Pending") return false;

    const nextContent = proposedContent.trim();
    const now = new Date().toISOString();
    const localProposal: AssistedDescriptionProposal = {
      ...proposal,
      sections: proposal.sections.map((section) =>
        section.sectionId === item.sectionId
          ? {
              ...section,
              proposedContent: nextContent,
              status: "Raw",
              updatedAt: now
            }
          : section
      ),
      status: "Pending",
      updatedAt: now
    };

    setEditingProposalItemId(item.id);
    setReviewMessage(null);
    try {
      const persistedProposal = onUpdateProposalSection
        ? await onUpdateProposalSection(proposal.id, item.sectionId, {
            proposedContent: nextContent,
            status: "Raw",
            reviewerComment: `Edited proposed ${item.label}.`,
            applyToTaskDescription: false
          })
        : null;
      setProposals((currentProposals) =>
        replaceAssistedDescriptionProposal(currentProposals, persistedProposal ?? localProposal)
      );
      await refreshProposalLog();
      return true;
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Could not edit this proposed section.");
      return false;
    } finally {
      setEditingProposalItemId(null);
    }
  }

  async function resolveProposal(proposal: AssistedDescriptionProposal, accepted: boolean) {
    if (readOnly || resolvingProposalAction || proposal.status !== "Pending") return;

    const patch = buildResolveAssistedDescriptionProposalPatch(
      { sections, sectionStatuses },
      proposal,
      accepted
    );
    if (!patch) return;

    setResolvingProposalAction(accepted ? "accept" : "reject");
    setReviewMessage(null);
    try {
      if (onTransitionProposal) {
        const nextStatus = accepted
          ? "Accepted"
          : hasAcceptedAssistedDescriptionProposalSections(proposal)
            ? "Partial"
            : "Rejected";
        const persistedProposal = await onTransitionProposal(proposal.id, nextStatus, {
          applyToTaskDescription: accepted || nextStatus === "Partial"
        });
        if (accepted || nextStatus === "Partial") await refreshTaskDescription();
        setSectionStatuses(patch.sectionStatuses);
        if (persistedProposal) {
          setProposals((currentProposals) => replaceAssistedDescriptionProposal(currentProposals, persistedProposal));
        }
        await refreshProposalLog();
        return;
      }

      if (patch.shouldApplyDescription) await onSaveDescription(task.id, patch.markdown);
      setSectionStatuses(patch.sectionStatuses);
      setProposals((currentProposals) => replaceAssistedDescriptionProposal(currentProposals, patch.proposal));
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Could not resolve this proposal.");
    } finally {
      setResolvingProposalAction(null);
    }
  }

  async function refreshTaskDescription() {
    if (onRefreshTask) {
      await onRefreshTask(task.id);
    }
  }

  async function refreshProposalLog() {
    if (!onListProposalLog) return;
    try {
      setProposalLog(await onListProposalLog(task.id));
    } catch {
      // Proposal mutations should not fail only because the non-critical log refresh did.
    }
  }

  function handleDescriptionContextKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void generateProposal();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      clearDescriptionPrompt();
    }
  }

  return (
    <>
      <TaskFocusSection
        title="Description"
        actions={
          !readOnly ? (
            <>
              {hasEmptySections ? (
                <Button variant="darkSecondary" onClick={() => setShowEmptySections((current) => !current)}>
                  {showEmptySections ? "Hide empty" : "Show empty"}
                </Button>
              ) : null}
              <Button
                variant="darkSecondary"
                icon={<Sparkles size={14} />}
                onClick={() => {
                  setProposalPanelOpen(true);
                  setPromptOpen(true);
                }}
              >
                Generate
              </Button>
            </>
          ) : null
        }
      >
        <AssistedDescriptionSectionList
          hasDescriptionContent={hasDescriptionContent}
          notes={task.notes}
          onMarkSectionOk={markSectionOk}
          onRequestSectionProposal={(sectionId) => {
            void generateProposal([sectionId], `Revise only ${getAssistedDescriptionSectionLabel(sectionId)}.`);
          }}
          onSaveSection={saveSection}
          readOnly={readOnly}
          savingSectionId={savingSectionId}
          sectionMessages={sectionMessages}
          sectionStatuses={sectionStatuses}
          sections={sections}
          showEmptySections={showEmptySections}
        />

        <AssistedDescriptionProposalPanel
          clarificationQuestions={clarificationQuestions}
          descriptionContext={descriptionContext}
          descriptionMessage={descriptionMessage}
          isLoadingProposals={isLoadingProposals}
          isGeneratingDescription={isGeneratingDescription}
          onCancelPrompt={clearDescriptionPrompt}
          onChangePrompt={setDescriptionContext}
          onGenerate={() => {
            void generateProposal();
          }}
          onKeyDown={handleDescriptionContextKeyDown}
          onOpenProposal={(proposalId) => setActiveProposalId(proposalId)}
          onToggle={() => setProposalPanelOpen((current) => !current)}
          open={proposalPanelOpen}
          promptOpen={promptOpen}
          proposalLoadMessage={proposalLoadMessage}
          proposalLog={proposalLog}
          proposals={proposals}
          readOnly={readOnly}
          setPromptOpen={setPromptOpen}
        />
      </TaskFocusSection>

      {activeProposal ? (
        <AssistedDescriptionProposalReviewModal
          editingItemId={editingProposalItemId}
          isBusy={Boolean(resolvingProposalAction || resolvingItemId || editingProposalItemId || isRequestingProposalChanges || isGeneratingDescription)}
          isRequestingChanges={isRequestingProposalChanges}
          onClose={() => setActiveProposalId(null)}
          onEditProposalItem={editProposalItem}
          onRequestChanges={requestProposalChanges}
          onResolveItem={resolveProposalItem}
          onResolveProposal={resolveProposal}
          proposal={activeProposal}
          readOnly={readOnly}
          resolvingItemId={resolvingItemId}
          resolvingProposalAction={resolvingProposalAction}
          reviewMessage={reviewMessage}
          sections={sections}
        />
      ) : null}
    </>
  );
}

function AssistedDescriptionSectionList({
  hasDescriptionContent,
  notes,
  onMarkSectionOk,
  onRequestSectionProposal,
  onSaveSection,
  readOnly,
  savingSectionId,
  sectionMessages,
  sectionStatuses,
  sections,
  showEmptySections
}: {
  hasDescriptionContent: boolean;
  notes?: string;
  onMarkSectionOk: (sectionId: AssistedDescriptionSectionId) => void;
  onRequestSectionProposal: (sectionId: AssistedDescriptionSectionId) => void;
  onSaveSection: (sectionId: AssistedDescriptionSectionId, content: string) => Promise<boolean>;
  readOnly: boolean;
  savingSectionId: AssistedDescriptionSectionId | null;
  sectionMessages: Partial<Record<AssistedDescriptionSectionId, string>>;
  sectionStatuses: AssistedDescriptionSectionStatuses;
  sections: AssistedDescriptionSections;
  showEmptySections: boolean;
}) {
  const visibleSections = showEmptySections
    ? assistedDescriptionSectionDefinitions
    : assistedDescriptionSectionDefinitions.filter((section) => sections[section.id].trim());

  if (!hasDescriptionContent && !showEmptySections) {
    return (
      <div className="rounded border border-dashed border-[#454852] bg-[#22252a] px-4 py-4 text-sm text-[#aeb3bd]">
        No final description yet.
        {notes ? <div className="mt-2 text-[#dfe1e6]">{notes}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleSections.map((section) => (
        <AssistedDescriptionSectionBlock
          content={sections[section.id]}
          isSaving={savingSectionId === section.id}
          key={section.id}
          message={sectionMessages[section.id] ?? null}
          onMarkOk={() => onMarkSectionOk(section.id)}
          onRequestProposal={() => onRequestSectionProposal(section.id)}
          onSave={(content) => onSaveSection(section.id, content)}
          readOnly={readOnly}
          status={sectionStatuses[section.id]}
          title={section.label}
        />
      ))}
      {!showEmptySections && assistedDescriptionSectionDefinitions.some((section) => !sections[section.id].trim()) ? (
        <div className="rounded border border-dashed border-[#454852] bg-[#22252a] px-4 py-3 text-xs text-[#9aa0aa]">
          Empty Jira/SRS Lite sections are hidden in read mode.
        </div>
      ) : null}
    </div>
  );
}

function AssistedDescriptionSectionBlock({
  content,
  isSaving,
  message,
  onMarkOk,
  onRequestProposal,
  onSave,
  readOnly,
  status,
  title
}: {
  content: string;
  isSaving: boolean;
  message: string | null;
  onMarkOk: () => void;
  onRequestProposal: () => void;
  onSave: (content: string) => Promise<boolean>;
  readOnly: boolean;
  status: "Raw" | "Polished";
  title: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  useEffect(() => {
    if (!editing) setDraft(content);
  }, [content, editing]);

  function cancelEditing() {
    setDraft(content);
    setEditing(false);
  }

  async function save() {
    const saved = await onSave(draft);
    if (saved) setEditing(false);
  }

  function handleDraftKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void save();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelEditing();
    }
  }

  return (
    <section className="overflow-hidden rounded border border-[#454852] bg-[#25272c]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#454852] px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-[#f4f5f7]">{title}</h3>
          <SectionStatusBadge status={status} />
        </div>
        {!readOnly ? (
          <div className="flex items-center gap-1">
            {content.trim() && status !== "Polished" ? (
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#7ee2a8] hover:bg-[#183f2e]"
                onClick={onMarkOk}
                title="Mark section OK"
                type="button"
              >
                <Check size={14} />
              </button>
            ) : null}
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#85b8ff] hover:bg-[#1d3b66]"
              onClick={onRequestProposal}
              title="Request section proposal"
              type="button"
            >
              <Sparkles size={14} />
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#b7bbc4] hover:bg-[#303238]"
              onClick={() => setEditing((current) => !current)}
              title="Edit section"
              type="button"
            >
              <Pencil size={14} />
            </button>
          </div>
        ) : null}
      </div>
      <div className="px-4 py-4">
        {editing ? (
          <div data-description-editor>
            <textarea
              autoFocus
              className="min-h-36 w-full resize-y rounded border border-[#454852] bg-[#1f2126] px-3 py-2 text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:border-[#85b8ff]"
              disabled={isSaving}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              value={draft}
            />
            {message ? <div className="mt-2 text-sm text-[#ffb4a8]">{message}</div> : null}
            <div className="mt-3 flex justify-end gap-2">
              <Button disabled={isSaving} onClick={cancelEditing} variant="darkSecondary">
                Cancel
              </Button>
              <Button
                disabled={isSaving}
                icon={isSaving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                onClick={() => {
                  void save();
                }}
                variant="darkPrimary"
              >
                {isSaving ? "Saving" : "Save"}
              </Button>
            </div>
          </div>
        ) : content.trim() ? (
          <AssistedDescriptionMarkdown markdown={content} />
        ) : (
          <p className="text-sm text-[#7f858f]">Empty section.</p>
        )}
      </div>
    </section>
  );
}

function AssistedDescriptionProposalPanel({
  clarificationQuestions,
  descriptionContext,
  descriptionMessage,
  isLoadingProposals,
  isGeneratingDescription,
  onCancelPrompt,
  onChangePrompt,
  onGenerate,
  onKeyDown,
  onOpenProposal,
  onToggle,
  open,
  promptOpen,
  proposalLoadMessage,
  proposalLog,
  proposals,
  readOnly,
  setPromptOpen
}: {
  clarificationQuestions: string[];
  descriptionContext: string;
  descriptionMessage: string | null;
  isLoadingProposals: boolean;
  isGeneratingDescription: boolean;
  onCancelPrompt: () => void;
  onChangePrompt: (value: string) => void;
  onGenerate: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenProposal: (proposalId: string) => void;
  onToggle: () => void;
  open: boolean;
  promptOpen: boolean;
  proposalLoadMessage: string | null;
  proposalLog: DescriptionProposalLogEntry[];
  proposals: AssistedDescriptionProposal[];
  readOnly: boolean;
  setPromptOpen: (open: boolean) => void;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded border border-[#454852] bg-[#25272c]">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#303238]"
        onClick={onToggle}
        type="button"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
          <Sparkles size={15} className="text-[#85b8ff]" />
          AI proposals
        </span>
        <ChevronDown className={cn("shrink-0 text-[#aeb3bd] transition", open && "rotate-180")} size={16} />
      </button>

      {open ? (
        <>
          {!readOnly ? (
            <div className="border-t border-[#454852] px-4 py-3">
              {!promptOpen ? (
                <Button
                  icon={<Sparkles size={14} />}
                  onClick={() => setPromptOpen(true)}
                  variant="darkPrimary"
                >
                  New proposal
                </Button>
              ) : (
                <DescriptionPromptPanel
                  clarificationQuestions={clarificationQuestions}
                  descriptionContext={descriptionContext}
                  descriptionMessage={descriptionMessage}
                  isGeneratingDescription={isGeneratingDescription}
                  onCancel={onCancelPrompt}
                  onChange={onChangePrompt}
                  onGenerate={onGenerate}
                  onKeyDown={onKeyDown}
                />
              )}
            </div>
          ) : null}

          {proposalLoadMessage ? (
            <div className="border-t border-[#454852] px-4 py-3 text-sm text-[#ffb4a8]">{proposalLoadMessage}</div>
          ) : null}

          {isLoadingProposals ? (
            <div className="flex items-center gap-2 border-t border-[#454852] px-4 py-3 text-sm text-[#aeb3bd]">
              <Loader2 className="animate-spin text-[#85b8ff]" size={14} />
              Loading saved proposals...
            </div>
          ) : null}

          {proposals.length ? (
            <div className="space-y-2 border-t border-[#454852] p-4">
              {proposals.map((proposal) => (
                <button
                  className="group w-full rounded border border-[#454852] bg-[#1f2126] px-3 py-3 text-left transition hover:border-[#85b8ff] hover:bg-[#252b35] focus:outline-none focus:ring-2 focus:ring-[#85b8ff]"
                  key={proposal.id}
                  onClick={() => onOpenProposal(proposal.id)}
                  type="button"
                >
                  <span className="flex items-start gap-3">
                    <Eye className="mt-0.5 shrink-0 text-[#85b8ff]" size={16} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#f4f5f7] group-hover:underline">
                        {proposal.title}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-[#aeb3bd]">
                        {proposal.summary ?? "Review proposed Jira/SRS Lite description changes."}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <ProposalStatusBadge status={proposal.status} />
                        <ProviderModelLabel model={proposal.model} provider={proposal.provider} />
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            !isLoadingProposals ? (
              <div className="border-t border-[#454852] px-4 py-3 text-sm text-[#aeb3bd]">No proposals yet.</div>
            ) : null
          )}

          {proposalLog.length ? <ProposalLogList entries={proposalLog} /> : null}
        </>
      ) : null}
    </section>
  );
}

function ProposalLogList({ entries }: { entries: DescriptionProposalLogEntry[] }) {
  return (
    <div className="border-t border-[#454852] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9aa0aa]">Proposal log</div>
      <div className="space-y-2">
        {[...entries].reverse().map((entry) => (
          <div className="rounded border border-[#3d4149] bg-[#202328] px-3 py-2" key={entry.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[#f4f5f7]">{entry.title}</div>
                {entry.summary ? (
                  <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#aeb3bd]">{entry.summary}</div>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-[#7f858f]">{formatProposalLogTimestamp(entry.occurredAt)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <ProposalStatusBadge status={entry.status} />
              <ProviderModelLabel model={entry.model} provider={entry.provider} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DescriptionPromptPanel({
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
    <div className="relative overflow-hidden rounded border border-[#454852] bg-[#25272c]" data-description-editor>
      {isGeneratingDescription ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1f2126]/80 px-4 text-sm font-medium text-[#dfe1e6] backdrop-blur-[2px]">
          <span className="inline-flex items-center gap-2 rounded border border-[#454852] bg-[#25272c] px-4 py-3 shadow-xl">
            <Loader2 className="animate-spin text-[#85b8ff]" size={16} />
            Generating proposal...
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
        className="min-h-[130px] w-full resize-y border-0 bg-[#1f2126] p-3 text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:ring-2 focus:ring-inset focus:ring-[#85b8ff]"
        disabled={isGeneratingDescription}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Describe what should change, what context matters, and what Jira-ready detail the proposal should add."
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

function AssistedDescriptionProposalReviewModal({
  editingItemId,
  isBusy,
  isRequestingChanges,
  onClose,
  onEditProposalItem,
  onRequestChanges,
  onResolveItem,
  onResolveProposal,
  proposal,
  readOnly,
  resolvingItemId,
  resolvingProposalAction,
  reviewMessage,
  sections
}: {
  editingItemId: string | null;
  isBusy: boolean;
  isRequestingChanges: boolean;
  onClose: () => void;
  onEditProposalItem: (
    proposal: AssistedDescriptionProposal,
    item: AssistedDescriptionProposalItem,
    proposedContent: string
  ) => Promise<boolean>;
  onRequestChanges: (
    proposal: AssistedDescriptionProposal,
    sectionIds: AssistedDescriptionSectionId[],
    changeRequest: string
  ) => Promise<boolean>;
  onResolveItem: (proposal: AssistedDescriptionProposal, item: AssistedDescriptionProposalItem, accepted: boolean) => void | Promise<void>;
  onResolveProposal: (proposal: AssistedDescriptionProposal, accepted: boolean) => void | Promise<void>;
  proposal: AssistedDescriptionProposal;
  readOnly: boolean;
  resolvingItemId: string | null;
  resolvingProposalAction: "accept" | "reject" | null;
  reviewMessage: string | null;
  sections: AssistedDescriptionSections;
}) {
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [changeRequest, setChangeRequest] = useState("");
  const proposalItems = getAssistedDescriptionProposalItems(proposal);
  const pendingItems = proposalItems.filter((item) => item.status === "pending");
  const overlay = useAppOverlay({
    layer: appOverlayLayers.nestedModal,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true
  });

  useEffect(() => {
    setChangeRequest("");
    setChangeRequestOpen(false);
  }, [proposal.id]);

  async function submitChangeRequest() {
    if (!changeRequest.trim()) return;
    const saved = await onRequestChanges(proposal, proposal.sections.map((section) => section.sectionId), changeRequest);
    if (saved) {
      setChangeRequest("");
      setChangeRequestOpen(false);
    }
  }

  function handleChangeRequestKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void submitChangeRequest();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#091e42]/70 px-4 py-6 backdrop-blur-sm"
      {...overlay.backdropProps}
    >
      <section
        className="mx-auto flex h-full max-h-[840px] w-full max-w-[1040px] flex-col overflow-hidden rounded border border-[#5d6470] bg-[#25272c] text-[#dfe1e6] shadow-2xl"
        {...overlay.surfaceProps}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#454852] px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
              <Sparkles size={16} className="text-[#85b8ff]" />
              Proposal review
              <ProposalStatusBadge status={proposal.status} />
              <ProviderModelLabel model={proposal.model} provider={proposal.provider} />
            </div>
            <p className="mt-1 truncate text-sm text-[#aeb3bd]">{proposal.title}</p>
          </div>
          <IconButton title="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 rounded border border-[#454852] bg-[#1f2126] px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#f4f5f7]">
                  {proposal.summary ?? "Review proposed Jira/SRS Lite description changes."}
                </p>
                {proposal.userComment ? (
                  <p className="mt-1 text-xs leading-relaxed text-[#aeb3bd]">{proposal.userComment}</p>
                ) : null}
              </div>
              {proposal.status === "Pending" && !readOnly ? (
                <Button
                  disabled={isBusy}
                  icon={<MessageCircle size={14} />}
                  onClick={() => setChangeRequestOpen((current) => !current)}
                  variant="darkSecondary"
                >
                  Request changes
                </Button>
              ) : null}
            </div>
            {changeRequestOpen ? (
              <div className="mt-4 border-t border-[#454852] pt-4" data-description-editor>
                <textarea
                  className="min-h-20 w-full resize-y rounded border border-[#454852] bg-[#25272c] px-3 py-2 text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:border-[#85b8ff]"
                  onChange={(event) => setChangeRequest(event.target.value)}
                  onKeyDown={handleChangeRequestKeyDown}
                  placeholder="Ask for a revision to the remaining proposal sections."
                  value={changeRequest}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={isBusy || !changeRequest.trim()}
                    icon={isRequestingChanges ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    onClick={() => {
                      void submitChangeRequest();
                    }}
                    variant="darkPrimary"
                  >
                    Send adjustment
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {reviewMessage ? (
            <div className="mb-4 rounded border border-[#5d1f1a] bg-[#2b1616] px-4 py-3 text-sm text-[#ffb4a8]">
              {reviewMessage}
            </div>
          ) : null}

          <div className="space-y-3">
            {proposalItems.map((item) => (
              <ProposalDiffItemRow
                disabled={readOnly || isBusy}
                editing={editingItemId === item.id}
                item={item}
                key={item.id}
                onEditProposedContent={(proposedContent) => onEditProposalItem(proposal, item, proposedContent)}
                onRequestChanges={onRequestChanges}
                onResolve={(accepted) => onResolveItem(proposal, item, accepted)}
                proposal={proposal}
                resolving={resolvingItemId === item.id}
                sections={sections}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#454852] bg-[#22252a] p-4">
          {isBusy ? (
            <div className="mr-auto flex items-center gap-2 text-sm text-[#b7bbc4]" role="status" aria-live="polite">
              <Loader2 className="animate-spin text-[#85b8ff]" size={14} />
              {isRequestingChanges
                ? "Generating revision..."
                : editingItemId
                  ? "Saving proposed section..."
                  : "Resolving proposal..."}
            </div>
          ) : null}
          {proposal.status === "Pending" && pendingItems.length && !readOnly ? (
            <>
              <Button
                disabled={isBusy}
                icon={resolvingProposalAction === "reject" ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
                onClick={() => {
                  void onResolveProposal(proposal, false);
                }}
                variant="darkSecondary"
              >
                Reject remaining
              </Button>
              <Button
                disabled={isBusy}
                icon={resolvingProposalAction === "accept" ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                onClick={() => {
                  void onResolveProposal(proposal, true);
                }}
                variant="darkPrimary"
              >
                Accept remaining
              </Button>
            </>
          ) : (
            <Button disabled={isBusy} onClick={onClose} variant="darkSecondary">
              Close
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function ProposalDiffItemRow({
  disabled,
  editing,
  item,
  onEditProposedContent,
  onRequestChanges,
  onResolve,
  proposal,
  resolving,
  sections
}: {
  disabled: boolean;
  editing: boolean;
  item: AssistedDescriptionProposalItem;
  onEditProposedContent: (proposedContent: string) => Promise<boolean>;
  onRequestChanges: (
    proposal: AssistedDescriptionProposal,
    sectionIds: AssistedDescriptionSectionId[],
    changeRequest: string
  ) => Promise<boolean>;
  onResolve: (accepted: boolean) => void | Promise<void>;
  proposal: AssistedDescriptionProposal;
  resolving: boolean;
  sections: AssistedDescriptionSections;
}) {
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [changeRequest, setChangeRequest] = useState("");
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState(item.proposedValue);
  const currentValue = sections[item.sectionId];
  const paragraphDiff = buildAssistedDescriptionParagraphDiff(currentValue, item.proposedValue);
  const isStale = isAssistedDescriptionProposalItemStale(sections, item);

  useEffect(() => {
    setChangeRequestOpen(false);
    setChangeRequest("");
    setManualEditOpen(false);
    setManualDraft(item.proposedValue);
  }, [item.id, item.proposedValue]);

  async function submitChangeRequest() {
    if (!changeRequest.trim()) return;
    const saved = await onRequestChanges(proposal, [item.sectionId], changeRequest);
    if (saved) {
      setChangeRequest("");
      setChangeRequestOpen(false);
    }
  }

  function handleChangeRequestKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void submitChangeRequest();
    }
  }

  async function saveManualEdit() {
    const saved = await onEditProposedContent(manualDraft);
    if (saved) {
      setManualEditOpen(false);
    }
  }

  function handleManualEditKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void saveManualEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setManualDraft(item.proposedValue);
      setManualEditOpen(false);
    }
  }

  return (
    <section className="overflow-hidden rounded border border-[#454852] bg-[#25272c]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#454852] px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium text-[#f4f5f7]">{item.label}</span>
          <ProposalItemStatusBadge status={item.status} />
          {isStale ? <span className="rounded bg-[#533f04] px-2 py-1 text-xs text-[#f5cd47]">Current changed</span> : null}
        </div>
        {item.status === "pending" ? (
          <div className="flex items-center gap-1">
            <button
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded text-[#85b8ff] transition hover:bg-[#1d3b66] disabled:cursor-not-allowed disabled:opacity-50",
                changeRequestOpen && "bg-[#1d3b66] text-[#cce0ff]"
              )}
              disabled={disabled || resolving}
              onClick={() => setChangeRequestOpen((current) => !current)}
              title="Request section changes"
              type="button"
            >
              <MessageCircle size={14} />
            </button>
            <button
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded text-[#b7bbc4] transition hover:bg-[#303238] disabled:cursor-not-allowed disabled:opacity-50",
                manualEditOpen && "bg-[#303238] text-[#f4f5f7]"
              )}
              disabled={disabled || editing || resolving}
              onClick={() => {
                setManualDraft(item.proposedValue);
                setManualEditOpen((current) => !current);
              }}
              title="Edit proposed section"
              type="button"
            >
              {editing ? <Loader2 className="animate-spin" size={14} /> : <Pencil size={14} />}
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#7ee2a8] transition hover:bg-[#183f2e] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || resolving}
              onClick={() => {
                void onResolve(true);
              }}
              title="Accept section"
              type="button"
            >
              {resolving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#ffb4a8] transition hover:bg-[#5d1f1a] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || resolving}
              onClick={() => {
                void onResolve(false);
              }}
              title="Reject section"
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
      </div>
      {changeRequestOpen && item.status === "pending" ? (
        <div className="border-b border-[#454852] bg-[#22252a] px-3 py-3" data-description-editor>
          <textarea
            className="min-h-20 w-full resize-y rounded border border-[#454852] bg-[#1f2126] px-3 py-2 text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:border-[#85b8ff]"
            onChange={(event) => setChangeRequest(event.target.value)}
            onKeyDown={handleChangeRequestKeyDown}
            placeholder={`Ask for a revision to ${item.label}.`}
            value={changeRequest}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button disabled={disabled} onClick={() => setChangeRequestOpen(false)} variant="darkSecondary">
              Cancel
            </Button>
            <Button
              disabled={disabled || !changeRequest.trim()}
              icon={<Sparkles size={14} />}
              onClick={() => {
                void submitChangeRequest();
              }}
              variant="darkPrimary"
            >
              Send adjustment
            </Button>
          </div>
        </div>
      ) : null}
      {manualEditOpen && item.status === "pending" ? (
        <div className="border-b border-[#454852] bg-[#22252a] px-3 py-3" data-description-editor>
          <textarea
            className="min-h-28 w-full resize-y rounded border border-[#454852] bg-[#1f2126] px-3 py-2 text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:border-[#85b8ff]"
            disabled={disabled || editing}
            onChange={(event) => setManualDraft(event.target.value)}
            onKeyDown={handleManualEditKeyDown}
            value={manualDraft}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              disabled={disabled || editing}
              onClick={() => {
                setManualDraft(item.proposedValue);
                setManualEditOpen(false);
              }}
              variant="darkSecondary"
            >
              Cancel
            </Button>
            <Button
              disabled={disabled || editing}
              icon={editing ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              onClick={() => {
                void saveManualEdit();
              }}
              variant="darkPrimary"
            >
              {editing ? "Saving" : "Save proposal"}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="bg-[#1f2126]">
        {paragraphDiff.length ? (
          <div className="divide-y divide-[#34373d]">
            {paragraphDiff.map((chunk, index) => (
              <ParagraphDiffChunk chunk={chunk} key={`${item.id}-${index}`} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-4 text-sm text-[#9aa0aa]">No paragraph changes.</div>
        )}
      </div>
    </section>
  );
}

function ParagraphDiffChunk({ chunk }: { chunk: { current: string; proposed: string } }) {
  return (
    <div className="grid gap-0 md:grid-cols-2">
      <DiffSide label="Current" tone="removed" value={chunk.current} />
      <DiffSide label="Proposed" tone="added" value={chunk.proposed} />
    </div>
  );
}

function DiffSide({ label, tone, value }: { label: string; tone: "added" | "removed"; value: string }) {
  const removed = tone === "removed";
  return (
    <div className={cn("min-w-0 border-b border-[#34373d] md:border-b-0", removed && "md:border-r md:border-[#34373d]")}>
      <div className={cn("border-b border-[#34373d] px-3 py-2 text-xs font-semibold", removed ? "bg-[#2b1616] text-[#ffb4a8]" : "bg-[#14251b] text-[#a6e3b8]")}>
        {label}
      </div>
      <div className={cn("min-h-16 whitespace-pre-wrap break-words px-3 py-3 font-mono text-xs leading-5", removed ? "bg-[#2b1616]/70 text-[#ffb4a8]" : "bg-[#14251b]/70 text-[#a6e3b8]")}>
        {value.trim() || "(empty)"}
      </div>
    </div>
  );
}

function SectionStatusBadge({ status }: { status: "Raw" | "Polished" }) {
  return (
    <span className={cn("rounded px-2 py-1 text-xs font-medium", status === "Polished" ? "bg-[#183f2e] text-[#7ee2a8]" : "bg-[#533f04] text-[#f5cd47]")}>
      {status}
    </span>
  );
}

function ProposalStatusBadge({ status }: { status: AssistedDescriptionProposal["status"] }) {
  const classes: Record<AssistedDescriptionProposal["status"], string> = {
    Pending: "bg-[#1d3b66] text-[#85b8ff]",
    Accepted: "bg-[#183f2e] text-[#7ee2a8]",
    Rejected: "bg-[#403f46] text-[#b7bbc4]",
    Partial: "bg-[#533f04] text-[#f5cd47]"
  };
  const labels: Record<AssistedDescriptionProposal["status"], string> = {
    Pending: "Pending",
    Accepted: "Accepted",
    Rejected: "Rejected",
    Partial: "Partial"
  };
  return <span className={cn("rounded px-2 py-1 text-xs font-medium", classes[status])}>{labels[status]}</span>;
}

function ProposalItemStatusBadge({ status }: { status: AssistedDescriptionProposalItem["status"] }) {
  const classes: Record<AssistedDescriptionProposalItem["status"], string> = {
    pending: "bg-[#1d3b66] text-[#85b8ff]",
    accepted: "bg-[#183f2e] text-[#7ee2a8]",
    rejected: "bg-[#403f46] text-[#b7bbc4]"
  };
  const labels: Record<AssistedDescriptionProposalItem["status"], string> = {
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Rejected"
  };
  return <span className={cn("rounded px-2 py-1 text-xs font-medium", classes[status])}>{labels[status]}</span>;
}

function ProviderModelLabel({ model, provider }: { model?: string | null; provider?: string | null }) {
  const label = [provider, model].filter(Boolean).join(" / ");
  if (!label) return null;
  return <span className="rounded bg-[#303238] px-2 py-1 text-xs text-[#b7bbc4]">{label}</span>;
}

function formatProposalLogTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildGenerationContext(changeRequest: string, sectionIds: AssistedDescriptionSectionId[]) {
  const request = changeRequest.trim();
  const sectionLabels = sectionIds.map((sectionId) => getAssistedDescriptionSectionLabel(sectionId)).join(", ");
  const scope =
    sectionIds.length === assistedDescriptionSectionDefinitions.length
      ? "Generate a complete proposal for all fixed Jira/SRS Lite sections."
      : `Revise only these fixed Jira/SRS Lite sections: ${sectionLabels}. Leave other sections unchanged.`;

  return [
    request,
    scope,
    "Use these fixed sections: User story, Problem, Objective, Scope, Out of scope, Main flows, Functional requirements, Non-functional requirements, Constraints and dependencies, Acceptance criteria, Risks and open questions."
  ].filter(Boolean).join("\n\n");
}
