import { Check, ChevronDown, Eye, Loader2, MessageCircle, Pencil, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BlockingBusyOverlay, Button, FeedbackNote, IconButton, useListboxDropdown } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { formatUnknownError } from "../../lib/domain";
import {
  applyManualAssistedDescriptionSectionEdit,
  buildAssistedDescriptionGenerationContext,
  buildAssistedDescriptionParagraphDiff,
  buildAssistedDescriptionProposal,
  buildResolveAssistedDescriptionProposalItemPatch,
  buildResolveAssistedDescriptionProposalPatch,
  createAssistedDescriptionSectionStatusesForTask,
  formatAssistedDescriptionSectionScopeLabel,
  getAssistedDescriptionProposalItems,
  getAssistedDescriptionSectionDefinitions,
  getAssistedDescriptionSectionIds,
  hasAcceptedAssistedDescriptionProposalSections,
  hasCompletePolishedAssistedDescription,
  hasMeaningfulAssistedDescriptionContent,
  hasRejectedAssistedDescriptionProposalSections,
  hasReviewableAssistedDescriptionProposalItems,
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
import { getDeliveryFormatGateForArea, type CatalogDeliveryFormatGate } from "../../lib/domain/catalog";
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

type DescriptionPromptStep = "context" | "delivery_format";
type DeliveryFormatPromptAction =
  | { kind: "generate"; deliveryFormat: string | null }
  | { kind: "confirm"; selectedDeliveryFormat: string; message: string }
  | { kind: "blocked"; message: string };

export function resolveDeliveryFormatPromptAction(
  gate: CatalogDeliveryFormatGate,
  options: { autoSelectFirstConfirmationOption?: boolean } = {}
): DeliveryFormatPromptAction {
  if (gate.kind === "unknown") {
    return { kind: "blocked", message: gate.message };
  }
  if (gate.kind === "needs_confirmation") {
    if (gate.options.length === 1) {
      return { kind: "generate", deliveryFormat: gate.options[0] };
    }
    if (options.autoSelectFirstConfirmationOption && gate.options.length) {
      const suggestedFormatIsValid = Boolean(gate.suggestedFormat && gate.options.includes(gate.suggestedFormat));
      return { kind: "generate", deliveryFormat: suggestedFormatIsValid ? gate.suggestedFormat : gate.options[0] };
    }
    return {
      kind: "confirm",
      selectedDeliveryFormat: gate.suggestedFormat ?? "",
      message: gate.suggestedFormat
        ? "Review the selected delivery format before continuing."
        : "Choose the delivery format for this description proposal."
    };
  }
  return { kind: "generate", deliveryFormat: gate.format ?? null };
}

export function buildProposalTransitionRequest(
  proposal: AssistedDescriptionProposal,
  accepted: boolean
): {
  status: AssistedDescriptionProposalStatus;
  reviewerComment?: string;
  applyToTaskDescription: boolean;
} {
  const status = accepted
    ? hasRejectedAssistedDescriptionProposalSections(proposal)
      ? "Partial"
      : "Accepted"
    : hasAcceptedAssistedDescriptionProposalSections(proposal)
      ? "Partial"
      : "Rejected";

  return {
    status,
    reviewerComment:
      status === "Partial"
        ? accepted
          ? "Accepted remaining proposal sections."
          : "Rejected remaining proposal sections."
        : undefined,
    applyToTaskDescription: accepted || status === "Partial"
  };
}

export function AssistedDescriptionSection({
  task,
  readOnly,
  isGeneratingDescription,
  onGenerateDescription,
  onResolveDeliveryFormatGate,
  onConfigureAiProvider,
  onListProposals,
  onListProposalLog,
  onSaveDescription,
  onCreateProposal,
  onRefreshTask,
  onTransitionProposal,
  onUpdateProposalSection,
  proposalPanelContainer,
  proposalModel,
  proposalProvider
}: {
  task: LocalTask;
  readOnly: boolean;
  isGeneratingDescription: boolean;
  onGenerateDescription: (taskId: string, additionalContext: string, deliveryFormat?: string | null) => Promise<AssistedDescriptionDraft>;
  onResolveDeliveryFormatGate?: (area: string, descriptionOrDeliverable: string) => Promise<CatalogDeliveryFormatGate>;
  onConfigureAiProvider?: () => void;
  onListProposals?: (taskId: string) => Promise<AssistedDescriptionProposal[]>;
  onListProposalLog?: (taskId: string) => Promise<DescriptionProposalLogEntry[]>;
  onSaveDescription: (taskId: string, description: string, descriptionStatus?: LocalTask["descriptionStatus"]) => void | Promise<void>;
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
  proposalPanelContainer?: HTMLElement | null;
  proposalModel?: string | null;
  proposalProvider?: string | null;
}) {
  const activeSectionDefinitions = useMemo(() => getAssistedDescriptionSectionDefinitions(task.issueType), [task.issueType]);
  const allSectionIds = useMemo(() => getAssistedDescriptionSectionIds(task.issueType), [task.issueType]);
  const [localDescriptionOverride, setLocalDescriptionOverride] = useState<string | null>(null);
  const sections = useMemo(
    () => parseAssistedDescriptionMarkdown(localDescriptionOverride ?? task.description, task.issueType),
    [localDescriptionOverride, task.description, task.issueType]
  );
  const hasDescriptionContent = hasMeaningfulAssistedDescriptionContent(sections);
  const hasEmptySections = activeSectionDefinitions.some((section) => !sections[section.id].trim());
  const canLoadPersistedProposals = Boolean(onListProposals || onListProposalLog);
  const [sectionStatuses, setSectionStatuses] = useState<AssistedDescriptionSectionStatuses>(() =>
    createAssistedDescriptionSectionStatusesForTask(sections, task.descriptionStatus, task.issueType)
  );
  const allSectionsPolished = hasCompletePolishedAssistedDescription({ sections, sectionStatuses }, task.issueType);
  const canMarkAllSectionsPolished = hasDescriptionContent && !hasEmptySections && !allSectionsPolished;
  const [showEmptySections, setShowEmptySections] = useState(false);
  const [descriptionContext, setDescriptionContext] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState<string | null>(null);
  const [deliveryFormatGate, setDeliveryFormatGate] = useState<CatalogDeliveryFormatGate | null>(null);
  const [selectedDeliveryFormat, setSelectedDeliveryFormat] = useState("");
  const [lastConfirmedDeliveryFormat, setLastConfirmedDeliveryFormat] = useState<string | null>(null);
  const [descriptionPromptStep, setDescriptionPromptStep] = useState<DescriptionPromptStep>("context");
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptSectionIds, setPromptSectionIds] = useState<AssistedDescriptionSectionId[]>(allSectionIds);
  const [proposalPanelOpen, setProposalPanelOpen] = useState(true);
  const [proposals, setProposals] = useState<AssistedDescriptionProposal[]>([]);
  const [proposalLog, setProposalLog] = useState<DescriptionProposalLogEntry[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [proposalLoadMessage, setProposalLoadMessage] = useState<string | null>(null);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [savingSectionId, setSavingSectionId] = useState<AssistedDescriptionSectionId | "all" | null>(null);
  const [sectionMessages, setSectionMessages] = useState<Partial<Record<AssistedDescriptionSectionId, string>>>({});
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [resolvingProposalAction, setResolvingProposalAction] = useState<"accept" | "reject" | null>(null);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);
  const [isRequestingProposalChanges, setIsRequestingProposalChanges] = useState(false);
  const [requestingProposalChangeLabel, setRequestingProposalChangeLabel] = useState<string | null>(null);
  const [editingProposalItemId, setEditingProposalItemId] = useState<string | null>(null);

  useEffect(() => {
    const nextSections = parseAssistedDescriptionMarkdown(task.description, task.issueType);
    setLocalDescriptionOverride(null);
    setSectionStatuses(createAssistedDescriptionSectionStatusesForTask(nextSections, task.descriptionStatus, task.issueType));
    setShowEmptySections(false);
    setDescriptionContext("");
    setDescriptionMessage(null);
    setDeliveryFormatGate(null);
    setSelectedDeliveryFormat("");
    setLastConfirmedDeliveryFormat(null);
    setDescriptionPromptStep("context");
    setClarificationQuestions([]);
    setPromptOpen(false);
    setPromptSectionIds(allSectionIds);
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
    setRequestingProposalChangeLabel(null);
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
  }, [task.id, task.issueType, task.description, task.descriptionStatus, canLoadPersistedProposals]);

  const activeProposal = activeProposalId ? proposals.find((proposal) => proposal.id === activeProposalId) ?? null : null;

  function clearDescriptionPrompt() {
    setDescriptionContext("");
    setDescriptionMessage(null);
    setDeliveryFormatGate(null);
    setSelectedDeliveryFormat("");
    setDescriptionPromptStep("context");
    setClarificationQuestions([]);
    setPromptSectionIds(allSectionIds);
    setPromptOpen(false);
  }

  async function openDescriptionPrompt(sectionIds: AssistedDescriptionSectionId[] = allSectionIds, initialContext = "") {
    const isPartialSectionRequest = sectionIds.length !== allSectionIds.length;
    setPromptSectionIds(sectionIds);
    setDescriptionContext(initialContext);
    setDescriptionMessage(null);
    setDeliveryFormatGate(null);
    setSelectedDeliveryFormat("");
    setClarificationQuestions([]);
    setPromptOpen(true);

    try {
      const deliveryFormatContext = `${task.title}\n${task.description ?? ""}`;
      const deliveryFormatResolution = onResolveDeliveryFormatGate
        ? await onResolveDeliveryFormatGate(task.area, deliveryFormatContext)
        : getDeliveryFormatGateForArea(task.area, deliveryFormatContext);
      const deliveryFormatAction = resolveDeliveryFormatPromptAction(deliveryFormatResolution, {
        autoSelectFirstConfirmationOption: isPartialSectionRequest
      });
      if (deliveryFormatAction.kind === "blocked") {
        setDescriptionMessage(deliveryFormatAction.message);
        setDescriptionPromptStep("context");
        return;
      }
      if (deliveryFormatAction.kind === "confirm") {
        setDeliveryFormatGate(deliveryFormatResolution);
        setSelectedDeliveryFormat(deliveryFormatAction.selectedDeliveryFormat);
        setDescriptionMessage(deliveryFormatAction.message);
        setDescriptionPromptStep("delivery_format");
        return;
      }
      setSelectedDeliveryFormat(deliveryFormatAction.deliveryFormat ?? "");
      setDescriptionPromptStep("context");
    } catch (error) {
      setDescriptionMessage(error instanceof Error ? error.message : "Could not resolve delivery format.");
      setDescriptionPromptStep("context");
    }
  }

  async function generateProposalWithOptionalDeliveryFormat(
    sectionIds: AssistedDescriptionSectionId[],
    changeRequest: string,
    deliveryFormat: string | null
  ) {
    setDescriptionMessage("Generating proposal...");
    setClarificationQuestions([]);
    setReviewMessage(null);

    try {

      const draft = await onGenerateDescription(
        task.id,
        buildAssistedDescriptionGenerationContext({ changeRequest, issueType: task.issueType, sectionIds }),
        deliveryFormat
      );
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
        currentMarkdown: serializeAssistedDescriptionSections(sections, task.issueType),
        issueType: task.issueType,
        model: proposalModel,
        proposedMarkdown: draft.description,
        provider: proposalProvider,
        sectionIds,
        taskId: task.id
      });
      if (!hasReviewableAssistedDescriptionProposalItems(proposal)) {
        setDescriptionMessage("The proposal did not include changes to review. Add more context or ask for a specific modification.");
        setProposalPanelOpen(true);
        setPromptOpen(true);
        return false;
      }
      const savedProposal = onCreateProposal
        ? await onCreateProposal(toNewAssistedDescriptionProposal(proposal))
        : proposal;
      setProposals((currentProposals) => insertAssistedDescriptionProposal(currentProposals, savedProposal));
      await refreshProposalLog();
      setActiveProposalId(savedProposal.id);
      setDescriptionContext("");
      setDescriptionMessage(null);
      setDeliveryFormatGate(null);
      setLastConfirmedDeliveryFormat(deliveryFormat);
      setSelectedDeliveryFormat("");
      setDescriptionPromptStep("context");
      setClarificationQuestions([]);
      setPromptOpen(false);
      setPromptSectionIds(allSectionIds);
      setProposalPanelOpen(true);
      return true;
    } catch (error) {
      setDescriptionMessage(formatUnknownError(error, "Could not generate a description proposal."));
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
    setRequestingProposalChangeLabel(formatAssistedDescriptionSectionScopeLabel(sectionIds, task.issueType));
    setReviewMessage(null);
    try {
      if (isEmptySectionChangeRequest(changeRequest)) {
        const emptyRevision = buildAssistedDescriptionProposal({
          changeRequest,
          currentMarkdown: serializeAssistedDescriptionSections(sections, task.issueType),
          issueType: task.issueType,
          model: proposalModel,
          proposedMarkdown: serializeAssistedDescriptionSections({
            ...sections,
            ...Object.fromEntries(sectionIds.map((sectionId) => [sectionId, ""]))
          } as AssistedDescriptionSections, task.issueType),
          provider: proposalProvider,
          sectionIds,
          taskId: task.id
        });
        let revisedProposal = reviseAssistedDescriptionProposal(proposal, emptyRevision, sectionIds);
        if (onUpdateProposalSection) {
          for (const sectionId of sectionIds) {
            const persistedProposal = await onUpdateProposalSection(proposal.id, sectionId, {
              proposedContent: "",
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
      }

      const revisionDeliveryFormat = await resolveDeliveryFormatForRevision(changeRequest, sectionIds);
      const draft = await onGenerateDescription(
        task.id,
        buildAssistedDescriptionGenerationContext({ changeRequest, issueType: task.issueType, sectionIds }),
        revisionDeliveryFormat
      );
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
        currentMarkdown: serializeAssistedDescriptionSections(sections, task.issueType),
        issueType: task.issueType,
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
      setReviewMessage(formatUnknownError(error, "Could not request changes for this proposal."));
      return false;
    } finally {
      setIsRequestingProposalChanges(false);
      setRequestingProposalChangeLabel(null);
    }
  }

  async function resolveDeliveryFormatForRevision(
    changeRequest: string,
    sectionIds: AssistedDescriptionSectionId[]
  ): Promise<string | null> {
    if (lastConfirmedDeliveryFormat) return lastConfirmedDeliveryFormat;
    const deliveryFormatContext = `${task.title}\n${changeRequest}\n${task.description ?? ""}`;
    const deliveryFormatResolution = onResolveDeliveryFormatGate
      ? await onResolveDeliveryFormatGate(task.area, deliveryFormatContext)
      : getDeliveryFormatGateForArea(task.area, deliveryFormatContext);
    const action = resolveDeliveryFormatPromptAction(deliveryFormatResolution, {
      autoSelectFirstConfirmationOption: sectionIds.length !== allSectionIds.length
    });
    if (action.kind === "blocked") throw new Error(action.message);
    if (action.kind === "confirm") {
      throw new Error("This proposal needs a delivery format selected before requesting AI changes.");
    }
    return action.deliveryFormat;
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
      const nextDescriptionStatus = hasCompletePolishedAssistedDescription(nextState, task.issueType) ? "Ready" : "Draft";
      const nextMarkdown = serializeAssistedDescriptionSections(nextState.sections, task.issueType);
      await onSaveDescription(task.id, nextMarkdown, nextDescriptionStatus);
      setLocalDescriptionOverride(nextMarkdown);
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

  async function markAllSectionsPolished() {
    if (readOnly || savingSectionId || !hasDescriptionContent) return;
    if (!canMarkAllSectionsPolished) {
      setReviewMessage("Complete every description section before marking the task as ready.");
      return;
    }
    const nextStatuses = { ...sectionStatuses };
    for (const section of activeSectionDefinitions) {
      nextStatuses[section.id] = sections[section.id].trim() ? "Polished" : "Raw";
    }
    setSavingSectionId("all");
    setSectionMessages({});
    try {
      await onSaveDescription(task.id, serializeAssistedDescriptionSections(sections, task.issueType), "Ready");
      setLocalDescriptionOverride(serializeAssistedDescriptionSections(sections, task.issueType));
      setSectionStatuses(nextStatuses);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Could not mark all sections polished.");
    } finally {
      setSavingSectionId(null);
    }
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
        const pendingItems = getAssistedDescriptionProposalItems(proposal).filter((candidate) => candidate.status === "pending");
        if (accepted) {
          if (pendingItems.length <= 1 && onTransitionProposal) {
            const nextStatus = hasRejectedAssistedDescriptionProposalSections(proposal) ? "Partial" : "Accepted";
            persistedProposal = await onTransitionProposal(proposal.id, nextStatus, {
              reviewerComment: `Accepted remaining proposal sections.`,
              applyToTaskDescription: true
            });
          } else {
            persistedProposal = onUpdateProposalSection
              ? await onUpdateProposalSection(proposal.id, item.sectionId, {
                  status: "Polished",
                  reviewerComment: `Accepted ${item.label}.`,
                  applyToTaskDescription: true
                })
              : null;
          }
          await refreshTaskDescription();
        } else {
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
        if (patch.shouldApplyDescription) setLocalDescriptionOverride(patch.markdown);
        setSectionStatuses(patch.sectionStatuses);
        if (persistedProposal) {
          setProposals((currentProposals) => replaceAssistedDescriptionProposal(currentProposals, persistedProposal));
          if (persistedProposal.status !== "Pending" || !hasReviewableAssistedDescriptionProposalItems(persistedProposal)) {
            setActiveProposalId(null);
          }
        }
        await refreshProposalLog();
        return;
      }

      if (patch.shouldApplyDescription) await onSaveDescription(task.id, patch.markdown, "Draft");
      if (patch.shouldApplyDescription) setLocalDescriptionOverride(patch.markdown);
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
        const transition = buildProposalTransitionRequest(proposal, accepted);
        const persistedProposal = await onTransitionProposal(proposal.id, transition.status, {
          reviewerComment: transition.reviewerComment,
          applyToTaskDescription: transition.applyToTaskDescription
        });
        if (transition.applyToTaskDescription) await refreshTaskDescription();
        if (patch.shouldApplyDescription) setLocalDescriptionOverride(patch.markdown);
        setSectionStatuses(patch.sectionStatuses);
        if (persistedProposal) {
          setProposals((currentProposals) => replaceAssistedDescriptionProposal(currentProposals, persistedProposal));
        }
        await refreshProposalLog();
        setActiveProposalId(null);
        return;
      }

      if (patch.shouldApplyDescription) await onSaveDescription(task.id, patch.markdown, accepted ? "Ready" : "Draft");
      if (patch.shouldApplyDescription) setLocalDescriptionOverride(patch.markdown);
      setSectionStatuses(patch.sectionStatuses);
      setProposals((currentProposals) => replaceAssistedDescriptionProposal(currentProposals, patch.proposal));
      setActiveProposalId(null);
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
      void generateProposalWithOptionalDeliveryFormat(promptSectionIds, descriptionContext, selectedDeliveryFormat || null);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      clearDescriptionPrompt();
    }
  }

  const proposalPanel = (
    <AssistedDescriptionProposalPanel
      isLoadingProposals={isLoadingProposals}
      isGeneratingDescription={isGeneratingDescription}
      onOpenProposal={(proposalId) => setActiveProposalId(proposalId)}
      onOpenPrompt={() => {
        void openDescriptionPrompt();
      }}
      onToggle={() => setProposalPanelOpen((current) => !current)}
      open={proposalPanelOpen}
      proposalLoadMessage={proposalLoadMessage}
      proposalLog={proposalLog}
      proposals={proposals}
      readOnly={readOnly}
    />
  );

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
              {hasDescriptionContent ? (
                <Button
                  variant="darkSecondary"
                  icon={savingSectionId ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                  disabled={!canMarkAllSectionsPolished || Boolean(savingSectionId)}
                  onClick={() => {
                    void markAllSectionsPolished();
                  }}
                  title={
                    allSectionsPolished
                      ? "Every description section is already polished"
                      : hasEmptySections
                        ? "Complete every description section before marking the task as ready"
                        : "Mark every description section as polished"
                  }
                >
                  Set all as polished
                </Button>
              ) : null}
              <Button
                variant="darkSecondary"
                icon={<Sparkles size={14} />}
                onClick={() => {
                  void openDescriptionPrompt();
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
            void openDescriptionPrompt([sectionId]);
          }}
          onSaveSection={saveSection}
          readOnly={readOnly}
          savingSectionId={savingSectionId === "all" ? null : savingSectionId}
          sectionMessages={sectionMessages}
          sectionStatuses={sectionStatuses}
          sectionDefinitions={activeSectionDefinitions}
          sections={sections}
          showEmptySections={showEmptySections}
        />
      </TaskFocusSection>

      {proposalPanelContainer ? createPortal(proposalPanel, proposalPanelContainer) : proposalPanel}

      {promptOpen ? (
        <DescriptionPromptModal
          clarificationQuestions={clarificationQuestions}
          descriptionContext={descriptionContext}
          descriptionMessage={descriptionMessage}
          deliveryFormatGate={deliveryFormatGate}
          isGeneratingDescription={isGeneratingDescription}
          onCancel={clearDescriptionPrompt}
          onChange={(nextContext) => {
            setDescriptionContext(nextContext);
            setDeliveryFormatGate(null);
            setDescriptionMessage(null);
          }}
          onConfigureAiProvider={onConfigureAiProvider}
          onSelectDeliveryFormat={setSelectedDeliveryFormat}
          onGenerate={() => {
            if (descriptionPromptStep === "delivery_format") {
              setDescriptionMessage(null);
              setDescriptionPromptStep("context");
              return;
            }
            void generateProposalWithOptionalDeliveryFormat(promptSectionIds, descriptionContext, selectedDeliveryFormat || null);
          }}
          onKeyDown={handleDescriptionContextKeyDown}
          selectedDeliveryFormat={selectedDeliveryFormat}
          step={descriptionPromptStep}
        />
      ) : null}

      {activeProposal ? (
        <AssistedDescriptionProposalReviewModal
          editingItemId={editingProposalItemId}
          isBusy={Boolean(resolvingProposalAction || resolvingItemId || editingProposalItemId || isRequestingProposalChanges || isGeneratingDescription)}
          loadingScopeLabel={requestingProposalChangeLabel}
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
  sectionDefinitions,
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
  sectionDefinitions: ReturnType<typeof getAssistedDescriptionSectionDefinitions>;
  sections: AssistedDescriptionSections;
  showEmptySections: boolean;
}) {
  const visibleSections = showEmptySections
    ? sectionDefinitions
    : sectionDefinitions.filter((section) => sections[section.id].trim());

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
      {!showEmptySections && sectionDefinitions.some((section) => !sections[section.id].trim()) ? (
        <div className="rounded border border-dashed border-[#454852] bg-[#22252a] px-4 py-3 text-xs text-[#9aa0aa]">
          Empty Jira description sections are hidden in read mode.
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
  isLoadingProposals,
  isGeneratingDescription,
  onOpenProposal,
  onOpenPrompt,
  onToggle,
  open,
  proposalLoadMessage,
  proposalLog,
  proposals,
  readOnly
}: {
  isLoadingProposals: boolean;
  isGeneratingDescription: boolean;
  onOpenProposal: (proposalId: string) => void;
  onOpenPrompt: () => void;
  onToggle: () => void;
  open: boolean;
  proposalLoadMessage: string | null;
  proposalLog: DescriptionProposalLogEntry[];
  proposals: AssistedDescriptionProposal[];
  readOnly: boolean;
}) {
  const pendingProposals = proposals.filter((proposal) => proposal.status === "Pending");

  return (
    <section className="mt-4 overflow-hidden rounded border border-[#454852] bg-[#25272c]">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#303238]"
        onClick={onToggle}
        type="button"
      >
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
          <Sparkles size={15} className="text-[#85b8ff]" />
          AI
          <span className="rounded bg-[#1d3b66] px-2 py-1 text-xs font-medium text-[#85b8ff]">Proposals</span>
          <span className="rounded bg-[#303238] px-2 py-1 text-xs font-medium text-[#dfe1e6]">
            {pendingProposals.length} pending
          </span>
        </span>
        <ChevronDown className={cn("shrink-0 text-[#aeb3bd] transition", open && "rotate-180")} size={16} />
      </button>

      {open ? (
        <>
          {!readOnly ? (
            <div className="border-t border-[#454852] px-4 py-3">
              <Button
                disabled={isGeneratingDescription}
                icon={isGeneratingDescription ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                onClick={onOpenPrompt}
                variant="darkPrimary"
              >
                New proposal
              </Button>
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

          {pendingProposals.length ? (
            <div className="space-y-2 border-t border-[#454852] p-4">
              {pendingProposals.map((proposal) => (
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
                        {proposal.summary ?? "Review proposed Jira description changes."}
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
              <div className="border-t border-[#454852] px-4 py-3 text-sm text-[#aeb3bd]">No pending proposals.</div>
            ) : null
          )}

          {proposalLog.length ? <ProposalLogList entries={proposalLog} /> : null}
        </>
      ) : null}
    </section>
  );
}

function ProposalLogList({ entries }: { entries: DescriptionProposalLogEntry[] }) {
  const visibleEntries = dedupeProposalLogEntries(entries.filter((entry) => entry.eventType !== "description.proposal.created"));
  if (!visibleEntries.length) return null;

  return (
    <div className="border-t border-[#454852] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9aa0aa]">Proposal log</div>
      <div className="space-y-2">
        {[...visibleEntries].reverse().map((entry) => (
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

export function dedupeProposalLogEntries(entries: DescriptionProposalLogEntry[]): DescriptionProposalLogEntry[] {
  const entriesByProposal = new Map<string, DescriptionProposalLogEntry>();
  for (const entry of entries) {
    const key = entry.proposalId || entry.id;
    const current = entriesByProposal.get(key);
    if (!current || compareProposalLogEntries(entry, current) >= 0) {
      entriesByProposal.set(key, entry);
    }
  }
  return [...entriesByProposal.values()].sort(compareProposalLogEntries);
}

function compareProposalLogEntries(left: DescriptionProposalLogEntry, right: DescriptionProposalLogEntry): number {
  const occurredAtComparison = left.occurredAt.localeCompare(right.occurredAt);
  if (occurredAtComparison !== 0) return occurredAtComparison;
  return left.id.localeCompare(right.id);
}

type TaskDetailNestedModalShellProps = {
  badges?: ReactNode;
  busyOverlay?: ReactNode;
  children: ReactNode;
  dataDescriptionEditor?: boolean;
  footer?: ReactNode;
  icon: ReactNode;
  maxWidthClassName: string;
  onClose: () => void;
  overlay: ReturnType<typeof useAppOverlay>;
  subtitle?: ReactNode;
  surfaceClassName?: string;
  title: string;
};

export function TaskDetailNestedModalShell({
  badges,
  busyOverlay,
  children,
  dataDescriptionEditor = false,
  footer,
  icon,
  maxWidthClassName,
  onClose,
  overlay,
  subtitle,
  surfaceClassName,
  title
}: TaskDetailNestedModalShellProps) {
  const titleId = `${overlay.id}-title`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#091e42]/70 px-4 py-6 backdrop-blur-sm"
      {...overlay.backdropProps}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "relative w-full overflow-hidden rounded border border-[#5d6470] bg-[#25272c] text-[#dfe1e6] shadow-2xl",
          maxWidthClassName,
          surfaceClassName
        )}
        data-description-editor={dataDescriptionEditor ? true : undefined}
        role="dialog"
        {...overlay.surfaceProps}
      >
        {busyOverlay}

        <div className="flex items-start justify-between gap-4 border-b border-[#454852] px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#f4f5f7]" id={titleId}>
              {icon}
              {title}
              {badges}
            </div>
            {subtitle ? <p className="mt-1 truncate text-sm text-[#aeb3bd]">{subtitle}</p> : null}
          </div>
          <IconButton title="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        {children}

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#454852] bg-[#22252a] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function DescriptionPromptModal({
  clarificationQuestions,
  descriptionContext,
  descriptionMessage,
  deliveryFormatGate,
  isGeneratingDescription,
  onCancel,
  onChange,
  onConfigureAiProvider,
  onGenerate,
  onKeyDown,
  onSelectDeliveryFormat,
  selectedDeliveryFormat,
  step = "context"
}: {
  clarificationQuestions: string[];
  descriptionContext: string;
  descriptionMessage: string | null;
  deliveryFormatGate?: CatalogDeliveryFormatGate | null;
  isGeneratingDescription: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onConfigureAiProvider?: () => void;
  onGenerate: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onSelectDeliveryFormat?: (value: string) => void;
  selectedDeliveryFormat?: string;
  step?: DescriptionPromptStep;
}) {
  const overlay = useAppOverlay({
    layer: appOverlayLayers.nestedModal,
    onDismiss: onCancel,
    dismissOnEscape: true,
    dismissOnBackdrop: true,
    lockScroll: true,
    shouldDismiss: () => !isGeneratingDescription
  });
  const canConfigureAiProvider = Boolean(onConfigureAiProvider && descriptionMessage && isAiProviderSetupMessage(descriptionMessage));
  const aiProviderSetupActionLabel = descriptionMessage ? getAiProviderSetupActionLabel(descriptionMessage) : "Configure OpenAI";
  const isDeliveryFormatStep = step === "delivery_format";
  const hasValidSelectedDeliveryFormat = Boolean(
    deliveryFormatGate?.kind === "needs_confirmation" &&
      selectedDeliveryFormat &&
      deliveryFormatGate.options.includes(selectedDeliveryFormat)
  );
  const messageVariant = descriptionPromptMessageVariant(descriptionMessage);

  return (
    <TaskDetailNestedModalShell
      busyOverlay={
        isGeneratingDescription ? (
          <BlockingBusyOverlay title="Generating proposal" detail="Creating a structured Jira description proposal." />
        ) : null
      }
      dataDescriptionEditor
      footer={
        <>
          <Button disabled={isGeneratingDescription} variant="darkSecondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={isGeneratingDescription || (isDeliveryFormatStep && !hasValidSelectedDeliveryFormat)}
            icon={isGeneratingDescription ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
            variant="darkPrimary"
            onClick={onGenerate}
          >
            {isGeneratingDescription ? "Generating" : isDeliveryFormatStep ? "Continue" : "Generate proposal"}
          </Button>
        </>
      }
      icon={<Sparkles size={15} className="text-[#85b8ff]" />}
      maxWidthClassName="max-w-[520px]"
      onClose={() => {
        if (!isGeneratingDescription) onCancel();
      }}
      overlay={overlay}
      subtitle={isDeliveryFormatStep ? "Select the catalog format for this proposal." : "You can leave the request empty."}
      title={isDeliveryFormatStep ? "Choose delivery format" : "Description context"}
    >

        <div className="space-y-3 px-5 py-4">
          {!isDeliveryFormatStep ? (
            <textarea
              autoFocus
              className="min-h-[150px] w-full resize-y rounded border border-[#454852] bg-[#1f2126] p-3 text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:border-[#85b8ff]"
              disabled={isGeneratingDescription}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Optional context to guide the proposal..."
              value={descriptionContext}
            />
          ) : null}
          {descriptionMessage ? (
            <FeedbackNote surface="dark" variant={messageVariant}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{descriptionMessage}</span>
                {canConfigureAiProvider ? (
                  <Button
                    className="shrink-0"
                    variant="darkPrimary"
                    onClick={() => {
                      onConfigureAiProvider?.();
                    }}
                  >
                    {aiProviderSetupActionLabel}
                  </Button>
                ) : null}
              </div>
            </FeedbackNote>
          ) : null}
          {isDeliveryFormatStep && deliveryFormatGate?.kind === "needs_confirmation" ? (
            <div className="rounded border border-[#454852] bg-[#22252a] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9aa0aa]">Delivery format</div>
              <DeliveryFormatDropdown
                disabled={isGeneratingDescription}
                gate={deliveryFormatGate}
                onChange={(format) => onSelectDeliveryFormat?.(format)}
                value={selectedDeliveryFormat ?? ""}
              />
            </div>
          ) : null}
          {clarificationQuestions.length ? (
            <FeedbackNote className="py-3 text-sm" surface="dark" variant="warning">
              <div className="mb-2 text-xs font-semibold">More context needed</div>
              <ul className="space-y-1">
                {clarificationQuestions.map((question) => (
                  <li className="flex gap-2" key={question}>
                    <span>-</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </FeedbackNote>
          ) : null}
        </div>
    </TaskDetailNestedModalShell>
  );
}

function DeliveryFormatDropdown({
  disabled,
  gate,
  onChange,
  value
}: {
  disabled: boolean;
  gate: Extract<CatalogDeliveryFormatGate, { kind: "needs_confirmation" }>;
  onChange: (value: string) => void;
  value: string;
}) {
  const options = gate.options;
  const selectedLabel = value || "Choose delivery format";
  const listbox = useListboxDropdown({
    disabled,
    onChange,
    options,
    value
  });

  return (
    <div className="relative" ref={listbox.containerRef}>
      <button
        aria-label="Delivery format"
        className={cn(
          "flex h-9 w-full items-center justify-between rounded border border-[#454852] bg-[#1f2126] px-3 text-left text-sm normal-case text-[#dfe1e6] outline-none transition focus:border-[#85b8ff] focus:ring-2 focus:ring-[#1d355c] disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-[#9aa0aa]"
        )}
        disabled={disabled}
        onClick={listbox.toggleMenu}
        type="button"
        {...listbox.buttonProps}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={15} className="shrink-0 text-[#dfe1e6]" />
      </button>

      {listbox.isOpen ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-56 w-full overflow-y-auto overscroll-contain rounded border border-[#5c606a] bg-[#2b2d31] py-1 text-sm text-[#f4f5f7] shadow-xl"
          {...listbox.listboxProps}
        >
          {options.map((format) => {
            const isSelected = format === value;
            const isSuggested = format === gate.suggestedFormat;
            return (
              <button
                className={cn(
                  "flex h-8 w-full min-w-0 items-center justify-between gap-2 px-3 text-left hover:bg-[#1d355c]",
                  isSelected ? "bg-[#0c66e4] text-white" : "text-[#dfe1e6]"
                )}
                key={format}
                type="button"
                {...listbox.getOptionProps(format)}
              >
                <span className="min-w-0 truncate">
                  {format}
                  {isSuggested ? " (suggested)" : ""}
                </span>
                {isSelected ? <Check size={14} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AssistedDescriptionProposalReviewModal({
  editingItemId,
  isBusy,
  isRequestingChanges,
  loadingScopeLabel,
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
  loadingScopeLabel: string | null;
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
    <TaskDetailNestedModalShell
      badges={
        <>
          <ProposalStatusBadge status={proposal.status} />
          <ProviderModelLabel model={proposal.model} provider={proposal.provider} />
        </>
      }
      busyOverlay={
        isRequestingChanges ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#091e42]/70 px-6 backdrop-blur-[2px]">
            <div className="w-full max-w-sm rounded border border-[#454852] bg-[#25272c] px-5 py-4 text-center shadow-2xl">
              <Loader2 className="mx-auto mb-3 animate-spin text-[#85b8ff]" size={24} />
              <div className="text-sm font-semibold text-[#f4f5f7]">Generating revision</div>
              <div className="mt-1 text-xs leading-relaxed text-[#aeb3bd]">
                Updating {loadingScopeLabel ?? "the requested sections"} with your adjustment.
              </div>
            </div>
          </div>
        ) : null
      }
      footer={
        <>
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
        </>
      }
      icon={<Sparkles size={16} className="text-[#85b8ff]" />}
      maxWidthClassName="max-w-[1040px]"
      onClose={onClose}
      overlay={overlay}
      subtitle={proposal.title}
      surfaceClassName="flex h-full max-h-[840px] flex-col"
      title="Proposal review"
    >
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-4 rounded border border-[#454852] bg-[#1f2126] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#f4f5f7]">
                {proposal.summary ?? "Review proposed Jira description changes."}
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
          <FeedbackNote className="mb-4 px-4 py-3 text-sm" surface="dark" variant="error">
            {reviewMessage}
          </FeedbackNote>
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
    </TaskDetailNestedModalShell>
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
  const isModified = Boolean(item.reviewerComment?.trim());

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
          {isModified ? <ModifiedProposalItemBadge comment={item.reviewerComment} /> : null}
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

function ModifiedProposalItemBadge({ comment }: { comment?: string | null }) {
  const title = comment?.trim()
    ? `Modified after reviewer feedback: ${comment.trim()}`
    : "Modified after reviewer feedback.";
  return (
    <span
      className="rounded bg-[#303238] px-2 py-1 text-xs font-medium text-[#dfe1e6]"
      title={title}
    >
      Modified
    </span>
  );
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

export function isAiProviderSetupMessage(message: string): boolean {
  return /Select an AI provider|Save a .* API key/i.test(message);
}

export function getAiProviderSetupActionLabel(message: string): string {
  return /Save a .* API key/i.test(message) ? "Save API key" : "Configure OpenAI";
}

function descriptionPromptMessageVariant(message: string | null): "info" | "warning" {
  if (!message) return "info";
  if (/generating/i.test(message)) return "info";
  return "warning";
}

function isEmptySectionChangeRequest(changeRequest: string): boolean {
  const normalized = changeRequest
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const asksForEmpty = /\b(empty|blank|vacia|vacio|sin contenido)\b/.test(normalized);
  const asksForClearing = /\b(clear|remove|delete|leave|deja|dejar|dejala|dejalo|mantener|manten|queda|quede)\b/.test(normalized);

  return asksForEmpty && asksForClearing;
}
