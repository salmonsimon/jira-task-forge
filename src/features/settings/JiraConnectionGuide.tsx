import { Check, ChevronDown, ChevronLeft, ExternalLink, Info, KeyRound, Pencil, RefreshCw } from "lucide-react";
import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FeedbackNote, LoadingOrb, PanelHeader, ToggleSwitch } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { validateJiraSiteUrlDraft } from "../../lib/domain";
import { getModalMouseNavigationIntent, isMouseNavigationButton, shouldHandleEnterAsWizardAdvance } from "../../lib/modal-navigation";
import type { AppSettings, JiraConnectionTestResult, JiraProjectOption, ProjectSyncApplyRequest, ProjectSyncCandidate, ProjectSyncDiscoveryRequest, ProjectSyncReview } from "../../lib/types";
import { hasSyncableProjectCandidates, mergeProjectSyncCandidates, ProjectSyncDecisionTable, ProjectSyncEmptyState } from "../categories/ProjectSyncDecisionTable";

type GuideStep = "site" | "account" | "token" | "verify" | "project" | "project-sync" | "review";

export const jiraConnectionGuideSteps: Array<{ id: GuideStep; label: string }> = [
  { id: "site", label: "Site" },
  { id: "account", label: "Account" },
  { id: "token", label: "Token" },
  { id: "verify", label: "Verify" },
  { id: "project", label: "Project" },
  { id: "project-sync", label: "Decide" },
  { id: "review", label: "Review" }
];

export const jiraConnectionGuideCopy = {
  tokenDescription:
    "Save or replace the Jira API token before running full Jira checks. The token stays in the OS credential store.",
  tokenDraftPending: "Test this key, then save it before continuing.",
  tokenDraftPassed: "This key passed Test key. Save it so Verify can use it.",
  savedTokenReady: "A saved Jira API token is available. You can test it, replace it, or continue to Verify.",
  verifyDescription:
    "The app runs a full Jira Cloud connection check with the saved API token, draft site, and account email. Nothing is saved during this step.",
  verifyTokenReady: "Verify uses the credential saved by the Token step.",
  verifyTokenMissing: "Complete the Token step first to save a credential. Verify does not test site and email by themselves."
};

export function buildProjectSyncDiscoveryRequest(
  jiraSiteUrl: string,
  jiraAccountEmail: string,
  jiraCreationProjectKey: string
): ProjectSyncDiscoveryRequest {
  return {
    jiraSiteUrl,
    jiraAccountEmail: jiraAccountEmail.trim(),
    jiraCreationProjectKey: jiraCreationProjectKey.trim().toUpperCase()
  };
}

export function getProjectSyncReviewForProject(
  review: ProjectSyncReview | null,
  jiraCreationProjectKey: string
): ProjectSyncReview | null {
  const projectKey = jiraCreationProjectKey.trim().toUpperCase();
  if (!review || review.jiraProjectKey.trim().toUpperCase() !== projectKey) return null;
  return review;
}

export function shouldShowManualProjectKeyInput(
  discoveryState: "idle" | "loading" | "loaded" | "failed",
  discoveredProjectCount: number
): boolean {
  return discoveredProjectCount === 0 && (discoveryState === "loaded" || discoveryState === "failed");
}

export function canContinueJiraConnectionGuideStep({
  step,
  hasValidSiteUrl,
  hasAccountEmail,
  hasJiraApiToken,
  hasUnsavedTokenDraft,
  isSavingToken,
  hasProjectKey
}: {
  step: GuideStep;
  hasValidSiteUrl: boolean;
  hasAccountEmail: boolean;
  hasJiraApiToken: boolean;
  hasUnsavedTokenDraft: boolean;
  isSavingToken: boolean;
  hasProjectKey: boolean;
}) {
  return (
    (step === "site" && hasValidSiteUrl) ||
    (step === "account" && hasAccountEmail) ||
    (step === "token" && hasJiraApiToken && !hasUnsavedTokenDraft && !isSavingToken) ||
    (step === "verify" && hasJiraApiToken) ||
    (step === "project" && hasProjectKey) ||
    step === "project-sync" ||
    step === "review"
  );
}

export function JiraConnectionGuide({
  settings,
  hasJiraApiToken,
  isTestingJiraConnection,
  onSave,
  onSaveJiraApiToken,
  onDeleteJiraApiToken,
  onTestConnection,
  onTestJiraApiToken,
  onListProjects,
  onDiscoverProjectSync,
  onApplyProjectSync,
  onOpenJiraApiTokens,
  initialStep = "site",
  onClose
}: {
  settings: AppSettings;
  hasJiraApiToken: boolean;
  isTestingJiraConnection: boolean;
  onSave: (settings: Pick<AppSettings, "jiraSiteUrl" | "jiraAccountEmail" | "jiraCreationProjectKey" | "projectSyncEnabled">) => Promise<boolean>;
  onSaveJiraApiToken: (token: string) => Promise<boolean>;
  onDeleteJiraApiToken: () => void;
  onTestConnection: (siteUrl: string, accountEmail: string) => Promise<JiraConnectionTestResult>;
  onTestJiraApiToken: (token: string, siteUrl: string, accountEmail: string) => Promise<JiraConnectionTestResult>;
  onListProjects: (siteUrl: string, accountEmail: string) => Promise<JiraProjectOption[]>;
  onDiscoverProjectSync?: (request?: ProjectSyncDiscoveryRequest) => Promise<ProjectSyncReview>;
  onApplyProjectSync?: (request: ProjectSyncApplyRequest) => Promise<void>;
  onOpenJiraApiTokens: () => void;
  initialStep?: GuideStep;
  onClose: () => void;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const projectSyncRequestIdRef = useRef(0);
  const [step, setStep] = useState<GuideStep>(initialStep);
  const [siteUrlDraft, setSiteUrlDraft] = useState(settings.jiraSiteUrl);
  const [accountEmailDraft, setAccountEmailDraft] = useState(settings.jiraAccountEmail);
  const [jiraApiTokenDraft, setJiraApiTokenDraft] = useState("");
  const [jiraTokenStatus, setJiraTokenStatus] = useState<"idle" | "testing" | "success" | "failed" | "saving">("idle");
  const [jiraTokenMessage, setJiraTokenMessage] = useState<string | null>(null);
  const [projectKeyDraft, setProjectKeyDraft] = useState(settings.jiraCreationProjectKey);
  const [projectSyncEnabledDraft, setProjectSyncEnabledDraft] = useState(settings.projectSyncEnabled !== false);
  const [connectionResult, setConnectionResult] = useState<JiraConnectionTestResult | null>(null);
  const [projects, setProjects] = useState<JiraProjectOption[]>([]);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [projectDiscoveryState, setProjectDiscoveryState] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [projectDiscoveryMessage, setProjectDiscoveryMessage] = useState<string | null>(null);
  const [projectSyncReview, setProjectSyncReview] = useState<ProjectSyncReview | null>(null);
  const [projectSyncActiveNames, setProjectSyncActiveNames] = useState<Set<string>>(() => new Set());
  const [projectSyncArchivedNames, setProjectSyncArchivedNames] = useState<Set<string>>(() => new Set());
  const [projectSyncReviewState, setProjectSyncReviewState] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [projectSyncReviewMessage, setProjectSyncReviewMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const siteUrlValidation = useMemo(() => validateJiraSiteUrlDraft(siteUrlDraft), [siteUrlDraft]);
  const normalizedSiteUrl = siteUrlValidation.ok ? siteUrlValidation.value : siteUrlDraft.trim();
  const accountEmail = accountEmailDraft.trim();
  const projectKey = projectKeyDraft.trim().toUpperCase();
  const currentProjectSyncReview = getProjectSyncReviewForProject(projectSyncReview, projectKey);
  const hasUnsavedTokenDraft = Boolean(jiraApiTokenDraft.trim());
  const canContinue = canContinueJiraConnectionGuideStep({
    step,
    hasValidSiteUrl: siteUrlValidation.ok,
    hasAccountEmail: Boolean(accountEmail),
    hasJiraApiToken,
    hasUnsavedTokenDraft,
    isSavingToken: jiraTokenStatus === "saving",
    hasProjectKey: Boolean(projectKey)
  });
  const currentStepIndex = jiraConnectionGuideSteps.findIndex((candidate) => candidate.id === step);
  const overlay = useAppOverlay({
    layer: appOverlayLayers.nestedModal,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef
  });

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }

    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [onClose]);

  function moveNext() {
    const nextStep = jiraConnectionGuideSteps[currentStepIndex + 1]?.id;
    if (nextStep) setStep(nextStep);
  }

  function moveBack() {
    const previousStep = jiraConnectionGuideSteps[currentStepIndex - 1]?.id;
    if (previousStep) setStep(previousStep);
  }

  async function testJiraTokenDraft() {
    const token = jiraApiTokenDraft.trim();
    if (!siteUrlValidation.ok || !accountEmail) return;
    setJiraTokenStatus("testing");
    setJiraTokenMessage(null);
    const result = token ? await onTestJiraApiToken(token, siteUrlValidation.value, accountEmail) : await onTestConnection(siteUrlValidation.value, accountEmail);
    setJiraTokenStatus(result.ok ? "success" : "failed");
    setJiraTokenMessage(result.message);
  }

  async function saveJiraTokenDraft() {
    const token = jiraApiTokenDraft.trim();
    if (!token || jiraTokenStatus !== "success") return;
    setJiraTokenStatus("saving");
    const saved = await onSaveJiraApiToken(token);
    if (saved) {
      setJiraApiTokenDraft("");
      setJiraTokenStatus("idle");
      setJiraTokenMessage("Jira API token saved in the OS credential store.");
      return;
    }
    setJiraTokenStatus("failed");
    setJiraTokenMessage("Could not save Jira API token.");
  }

  async function testDraftConnection() {
    if (!siteUrlValidation.ok || !accountEmail || !hasJiraApiToken) return;
    const result = await onTestConnection(siteUrlValidation.value, accountEmail);
    setConnectionResult(result);
    if (result.ok && result.accountEmail && !accountEmailDraft.trim()) {
      setAccountEmailDraft(result.accountEmail);
    }
  }

  async function discoverProjects() {
    if (!siteUrlValidation.ok || !accountEmail) return;
    setProjectDiscoveryState("loading");
    setProjectDiscoveryMessage(null);
    try {
      const discoveredProjects = await onListProjects(siteUrlValidation.value, accountEmail);
      setProjects(discoveredProjects);
      setProjectDiscoveryState("loaded");
      setProjectDiscoveryMessage(
        discoveredProjects.length
          ? `${discoveredProjects.length} Jira projects found.`
          : "No projects were returned. Enter a project key manually."
      );
      if (!projectKeyDraft.trim() && discoveredProjects[0]) {
        changeProjectKey(discoveredProjects[0].key);
      }
    } catch (error) {
      setProjects([]);
      setProjectDiscoveryState("failed");
      setProjectDiscoveryMessage(error instanceof Error ? error.message : "Project discovery failed. Enter a project key manually.");
    }
  }

  function changeProjectKey(value: string) {
    if (value.trim().toUpperCase() === projectKey) {
      setProjectKeyDraft(value);
      return;
    }
    projectSyncRequestIdRef.current += 1;
    setProjectKeyDraft(value);
    setProjectSyncReview(null);
    setProjectSyncActiveNames(new Set());
    setProjectSyncArchivedNames(new Set());
    setProjectSyncReviewState("idle");
    setProjectSyncReviewMessage(null);
  }

  async function discoverProjectSyncDecisions() {
    if (!onDiscoverProjectSync || !projectSyncEnabledDraft || projectSyncReviewState === "loading") return;
    const requestId = projectSyncRequestIdRef.current + 1;
    projectSyncRequestIdRef.current = requestId;
    setProjectSyncReviewState("loading");
    setProjectSyncReviewMessage(null);
    try {
      const review = await onDiscoverProjectSync({
        ...buildProjectSyncDiscoveryRequest(siteUrlValidation.value, accountEmail, projectKey)
      });
      if (requestId !== projectSyncRequestIdRef.current) return;
      setProjectSyncReview(review);
      setProjectSyncActiveNames(new Set(review.defaultActiveNames));
      setProjectSyncArchivedNames(new Set(review.sections.archived.map((candidate) => candidate.name)));
      setProjectSyncReviewState("loaded");
    } catch (error) {
      if (requestId !== projectSyncRequestIdRef.current) return;
      setProjectSyncReview(null);
      setProjectSyncReviewState("failed");
      setProjectSyncReviewMessage(error instanceof Error ? error.message : "Project sync discovery failed.");
    }
  }

  function setProjectSyncCandidateActive(candidate: ProjectSyncCandidate, checked: boolean) {
    if (candidate.normalizedName === "transversal") return;
    setProjectSyncActiveNames((current) => {
      const next = new Set(current);
      if (checked) next.add(candidate.name);
      else next.delete(candidate.name);
      return next;
    });
    setProjectSyncArchivedNames((current) => {
      const next = new Set(current);
      if (checked) next.delete(candidate.name);
      return next;
    });
  }

  function buildProjectSyncApplyRequest(review: ProjectSyncReview): ProjectSyncApplyRequest {
    const candidates = mergeProjectSyncCandidates(review);
    const activeProjectNames = Array.from(projectSyncActiveNames);
    const archivedProjectNames = Array.from(projectSyncArchivedNames).filter((name) => !projectSyncActiveNames.has(name));
    const ignoredProjectNames = candidates
      .map((candidate) => candidate.name)
      .filter((name) => !projectSyncActiveNames.has(name) && !archivedProjectNames.includes(name));
    return { activeProjectNames, archivedProjectNames, ignoredProjectNames, candidates };
  }

  useEffect(() => {
    if (step !== "project-sync" || !projectSyncEnabledDraft || currentProjectSyncReview || projectSyncReviewState !== "idle") return;
    void discoverProjectSyncDecisions();
  }, [currentProjectSyncReview, projectKey, projectSyncEnabledDraft, projectSyncReviewState, step]);

  async function saveConnection() {
    if (!siteUrlValidation.ok || !accountEmail || !projectKey) return;
    setIsSaving(true);
    setSaveError(null);
    const saved = await onSave({
      jiraSiteUrl: siteUrlValidation.value,
      jiraAccountEmail: accountEmail,
      jiraCreationProjectKey: projectKey,
      projectSyncEnabled: projectSyncEnabledDraft
    });
    if (saved && projectSyncEnabledDraft && currentProjectSyncReview && hasSyncableProjectCandidates(currentProjectSyncReview) && onApplyProjectSync) {
      await onApplyProjectSync(buildProjectSyncApplyRequest(currentProjectSyncReview));
    }
    setIsSaving(false);
    if (saved) {
      onClose();
      return;
    }
    setSaveError("Could not save Jira connection settings.");
  }

  function handleWizardEnter(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!shouldHandleEnterAsWizardAdvance(event.target)) return;
    if (step === "review") {
      if (!canContinue || isSaving) return;
      event.preventDefault();
      void saveConnection();
      return;
    }
    if (!canContinue) return;
    event.preventDefault();
    moveNext();
  }

  function handleModalMouseUp(event: MouseEvent<HTMLElement>) {
    const intent = getModalMouseNavigationIntent(event.button, {
      canGoBack: currentStepIndex > 0,
      canGoForward: step === "review" ? canContinue && !isSaving : canContinue
    });
    if (!intent) return;
    event.preventDefault();
    event.stopPropagation();
    if (intent === "back") {
      moveBack();
      return;
    }
    if (step === "review") {
      void saveConnection();
      return;
    }
    moveNext();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(9,30,66,0.54)] px-4"
      {...overlay.backdropProps}
      onAuxClick={preventMouseNavigation}
      onMouseDown={(event) => {
        preventMouseNavigation(event);
        if (event.defaultPrevented || event.target !== event.currentTarget) return;
        onClose();
      }}
      onMouseUp={handleModalMouseUp}
    >
      <section
        ref={surfaceRef}
        className="flex max-h-[86vh] w-full max-w-[800px] flex-col overflow-hidden rounded border border-[#c1c7d0] bg-white shadow-2xl"
        {...overlay.surfaceProps}
        onAuxClick={preventMouseNavigation}
        onKeyDown={handleWizardEnter}
        onMouseDown={preventMouseNavigation}
        onMouseUp={handleModalMouseUp}
      >
        <PanelHeader
          title={showPrivacyDetails ? "Privacy & Diagnostics" : "Set Jira Connection"}
          subtitle={showPrivacyDetails ? "What leaves the machine and what stays local." : "Save Jira connection settings only after review."}
          onClose={onClose}
        />
        {showPrivacyDetails ? (
          <PrivacyDiagnosticsView onBack={() => setShowPrivacyDetails(false)} />
        ) : (
          <>
            <div className="border-b border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
              <div className="grid grid-cols-7 gap-2">
                {jiraConnectionGuideSteps.map((candidate, index) => (
                  <button
                    className={`h-8 min-w-0 rounded border px-2 text-xs font-medium leading-none whitespace-nowrap ${
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
            <div className="min-h-[430px] flex-1 overflow-y-auto p-6">
              {step === "site" ? (
                <GuideSection title="Jira site" description="Use the canonical Atlassian Cloud site root. Paths and issue URLs are rejected before saving.">
                  <GuideInput
                    label="Jira Site URL"
                    placeholder="https://your-site.atlassian.net"
                    value={siteUrlDraft}
                    onChange={(value) => {
                      setSiteUrlDraft(value);
                      setConnectionResult(null);
                      setProjectDiscoveryState("idle");
                    }}
                  />
                  <FeedbackNote variant={siteUrlValidation.ok ? "success" : "error"}>{siteUrlValidation.message}</FeedbackNote>
                </GuideSection>
              ) : null}
              {step === "account" ? (
                <GuideSection title="Account email" description="Use the email address associated with the Jira API token saved in the OS credential store.">
                  <GuideInput
                    label="Account email"
                    placeholder="name@example.com"
                    value={accountEmailDraft}
                    onChange={(value) => {
                      setAccountEmailDraft(value);
                      setConnectionResult(null);
                      setProjectDiscoveryState("idle");
                    }}
                  />
                </GuideSection>
              ) : null}
              {step === "token" ? (
                <GuideSection title="Jira API token" description={jiraConnectionGuideCopy.tokenDescription}>
                  <div className="mb-6 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#172b4d]">{hasJiraApiToken ? "Credential saved" : "No credential saved"}</div>
                        <p className="text-xs leading-relaxed text-[#6b778c]">
                          {hasJiraApiToken
                            ? "Test the saved token or paste a new one to replace it."
                            : "Create an Atlassian API token, paste it here, test it, then save it."}
                        </p>
                      </div>
                      <Button className="settings-button-secondary" icon={<ExternalLink size={13} />} variant="secondary" onClick={onOpenJiraApiTokens}>
                        Manage token
                      </Button>
                    </div>
                  </div>
                  <GuideInput
                    label="New API token"
                    placeholder={hasJiraApiToken ? "Enter a new token to replace it" : "Paste API token"}
                    secret
                    value={jiraApiTokenDraft}
                    onChange={(value) => {
                      setJiraApiTokenDraft(value);
                      setJiraTokenStatus("idle");
                      setJiraTokenMessage(null);
                      setConnectionResult(null);
                    }}
                  />
                  <div className="mt-6 flex gap-2">
                    <Button
                      className="settings-button-test"
                      disabled={(!jiraApiTokenDraft.trim() && !hasJiraApiToken) || jiraTokenStatus === "testing" || isTestingJiraConnection || !siteUrlValidation.ok || !accountEmail}
                      icon={jiraTokenStatus === "testing" ? <LoadingOrb size="xs" /> : <KeyRound size={14} />}
                      variant="secondary"
                      onClick={testJiraTokenDraft}
                    >
                      {jiraTokenStatus === "testing" ? "Testing..." : jiraApiTokenDraft.trim() ? "Test new key" : hasJiraApiToken ? "Test saved key" : "Test key"}
                    </Button>
                    <Button
                      className="settings-button-primary"
                      disabled={!jiraApiTokenDraft.trim() || jiraTokenStatus !== "success"}
                      icon={jiraTokenStatus === "saving" ? <LoadingOrb size="xs" /> : undefined}
                      variant="secondary"
                      onClick={saveJiraTokenDraft}
                    >
                      {jiraTokenStatus === "saving" ? "Saving..." : "Save key"}
                    </Button>
                    <Button
                      className="settings-button-danger"
                      disabled={!hasJiraApiToken || jiraTokenStatus === "testing" || jiraTokenStatus === "saving"}
                      variant="secondary"
                      onClick={onDeleteJiraApiToken}
                    >
                      Remove key
                    </Button>
                  </div>
                  <div className="mt-4">
                    {jiraTokenStatus === "testing" ? (
                      <FeedbackNote variant="info">Testing Jira API token...</FeedbackNote>
                    ) : jiraTokenStatus === "success" ? (
                      <FeedbackNote variant="success">
                        {jiraApiTokenDraft ? jiraConnectionGuideCopy.tokenDraftPassed : "Saved Jira API token test succeeded."}
                        {jiraTokenMessage ? ` ${jiraTokenMessage}` : ""}
                      </FeedbackNote>
                    ) : jiraTokenStatus === "failed" ? (
                      <FeedbackNote variant="error">
                        {jiraTokenMessage || "Update this key or Jira connection details, then test again."}
                      </FeedbackNote>
                    ) : hasUnsavedTokenDraft ? (
                      <FeedbackNote variant="warning">{jiraConnectionGuideCopy.tokenDraftPending}</FeedbackNote>
                    ) : hasJiraApiToken ? (
                      <FeedbackNote variant="success">{jiraConnectionGuideCopy.savedTokenReady}</FeedbackNote>
                    ) : null}
                  </div>
                </GuideSection>
              ) : null}
              {step === "verify" ? (
                <GuideSection title="Verify connection" description={jiraConnectionGuideCopy.verifyDescription}>
                  <div className="rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#172b4d]">{hasJiraApiToken ? "API token saved" : "API token missing"}</div>
                        <p className="text-xs text-[#6b778c]">
                          {hasJiraApiToken ? jiraConnectionGuideCopy.verifyTokenReady : jiraConnectionGuideCopy.verifyTokenMissing}
                        </p>
                      </div>
                      <Button className="settings-button-secondary" icon={<ExternalLink size={13} />} variant="secondary" onClick={onOpenJiraApiTokens}>
                        Manage token
                      </Button>
                    </div>
                  </div>
                  <Button
                    className="settings-button-test mt-5"
                    disabled={!hasJiraApiToken || isTestingJiraConnection || !siteUrlValidation.ok || !accountEmail}
                    icon={isTestingJiraConnection ? <LoadingOrb size="xs" /> : <KeyRound size={14} />}
                    variant="secondary"
                    onClick={testDraftConnection}
                  >
                    {isTestingJiraConnection ? "Testing..." : "Test draft connection"}
                  </Button>
                  {connectionResult ? (
                    <div className="mt-4">
                      <FeedbackNote variant={connectionResult.ok ? "success" : "error"}>
                        {connectionResult.message}
                        {connectionResult.ok && connectionResult.accountDisplayName ? ` Connected as ${connectionResult.accountDisplayName}.` : ""}
                      </FeedbackNote>
                    </div>
                  ) : null}
                </GuideSection>
              ) : null}
              {step === "project" ? (
                <GuideSection title="Jira creation project" description="Choose the single Jira project key used when creating issues. If discovery fails, enter the key manually.">
                  <div className="mb-5 flex gap-2">
                    <Button
                      className="settings-button-test"
                      disabled={projectDiscoveryState === "loading" || !siteUrlValidation.ok || !accountEmail}
                      icon={projectDiscoveryState === "loading" ? <LoadingOrb size="xs" /> : <RefreshCw size={14} />}
                      variant="secondary"
                      onClick={discoverProjects}
                    >
                      {projectDiscoveryState === "loading" ? "Discovering..." : "Discover projects"}
                    </Button>
                  </div>
                  {projects.length ? (
                    <ProjectSelect
                      isOpen={isProjectMenuOpen}
                      label="Discovered project"
                      options={projects}
                      value={projectKey}
                      onChange={changeProjectKey}
                      onOpenChange={setIsProjectMenuOpen}
                    />
                  ) : null}
                  {!projects.length && !shouldShowManualProjectKeyInput(projectDiscoveryState, projects.length) ? (
                    <FeedbackNote className="mt-3" variant="warning">
                      Discover Jira projects before choosing where Jira Task Forge creates issues.
                    </FeedbackNote>
                  ) : null}
                  {shouldShowManualProjectKeyInput(projectDiscoveryState, projects.length) ? (
                    <div className="mt-4 rounded border border-[#ffab00] bg-[#fffae6] p-3">
                      <GuideInput
                        label="Manual Jira project key"
                        placeholder="SCRUM"
                        value={projectKeyDraft}
                        onChange={changeProjectKey}
                      />
                      <p className="text-xs leading-relaxed text-[#42526e]">
                        Discovery did not provide a project to select. Confirm this key in Jira before saving the connection.
                      </p>
                    </div>
                  ) : null}
                  {projectDiscoveryMessage ? (
                    <FeedbackNote className="mt-3" variant={projectDiscoveryState === "failed" ? "warning" : "success"}>{projectDiscoveryMessage}</FeedbackNote>
                  ) : null}
                  <div className="mt-5 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
                    <ToggleSwitch
                      checked={projectSyncEnabledDraft}
                      checkedIcon={<RefreshCw size={13} strokeWidth={2.6} />}
                      label="Use Project sync"
                      description="When enabled, Categories can sync Projects from Jira epics under the Jira creation project. When disabled, Projects stay fully manual."
                      onChange={setProjectSyncEnabledDraft}
                      uncheckedIcon={<Pencil size={13} strokeWidth={2.6} />}
                    />
                  </div>
                </GuideSection>
              ) : null}
              {step === "project-sync" ? (
                <GuideSection title="Project decisions" description="Accept the synced Projects you want to keep active and ignore the rest.">
                  <JiraProjectSyncDecisionStep
                    activeNames={projectSyncActiveNames}
                    isProjectSyncEnabled={projectSyncEnabledDraft}
                    onChange={setProjectSyncCandidateActive}
                    onDiscoverProjectSync={onDiscoverProjectSync ? discoverProjectSyncDecisions : undefined}
                    review={currentProjectSyncReview}
                    reviewState={projectSyncReviewState}
                  />
                  {projectSyncReviewMessage ? <FeedbackNote className="mt-3" variant="error">{projectSyncReviewMessage}</FeedbackNote> : null}
                </GuideSection>
              ) : null}
              {step === "review" ? (
                <GuideSection title="Review and save" description="These settings are saved together. API tokens remain separate and are never written to SQLite or backups.">
                  <ReviewRows
                    rows={[
                      ["Jira Site URL", normalizedSiteUrl || "Missing"],
                      ["Account email", accountEmail || "Missing"],
                      ["Jira creation project key", projectKey || "Missing"],
                      ["Project sync", projectSyncEnabledDraft ? "On" : "Off"]
                    ]}
                  />
                  {saveError ? <FeedbackNote className="mt-3" variant="error">{saveError}</FeedbackNote> : null}
                </GuideSection>
              ) : null}
            </div>
            <div className="relative flex items-center justify-between border-t border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
              <Button disabled={currentStepIndex === 0} icon={<ChevronLeft size={14} />} variant="secondary" onClick={moveBack}>
                Back
              </Button>
              <button className="absolute left-1/2 -translate-x-1/2 px-3 text-xs font-semibold text-[#0052cc] hover:underline" onClick={() => setShowPrivacyDetails(true)} type="button">
                Privacy & Diagnostics
              </button>
              {step === "review" ? (
                <Button className="settings-button-primary" disabled={!canContinue || isSaving} icon={isSaving ? <LoadingOrb size="xs" /> : <Check size={14} />} onClick={saveConnection}>
                  {isSaving ? "Saving..." : "Save connection"}
                </Button>
              ) : (
                <Button className="settings-button-primary" disabled={!canContinue} onClick={moveNext}>
                  Continue
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function JiraProjectSyncDecisionStep({
  activeNames,
  isProjectSyncEnabled,
  onChange,
  onDiscoverProjectSync,
  review,
  reviewState
}: {
  activeNames: Set<string>;
  isProjectSyncEnabled: boolean;
  onChange: (candidate: ProjectSyncCandidate, checked: boolean) => void;
  onDiscoverProjectSync?: () => void | Promise<void>;
  review: ProjectSyncReview | null;
  reviewState: "idle" | "loading" | "loaded" | "failed";
}) {
  if (!isProjectSyncEnabled) {
    return <FeedbackNote variant="warning">Project sync is disabled. Enable it in the previous step to review Jira Projects.</FeedbackNote>;
  }

  if (review && hasSyncableProjectCandidates(review)) {
    return (
      <ProjectSyncDecisionTable
        activeNames={activeNames}
        candidates={mergeProjectSyncCandidates(review)}
        maxVisibleRows={7}
        onChange={onChange}
      />
    );
  }

  if (review) {
    return (
      <ProjectSyncEmptyState
        jiraProjectKey={review.jiraProjectKey}
        isRetrying={reviewState === "loading"}
        onRetry={onDiscoverProjectSync}
      />
    );
  }

  return (
    <div className="rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
      <div className="mb-3 text-sm font-semibold text-[#172b4d]">Load Jira Projects</div>
      <p className="mb-4 text-xs leading-relaxed text-[#6b778c]">Use the saved Jira connection to find Projects from Jira epics and choose which stay active.</p>
      <Button
        className="settings-button-test"
        disabled={!onDiscoverProjectSync || reviewState === "loading"}
        icon={reviewState === "loading" ? <LoadingOrb size="xs" /> : <RefreshCw size={14} />}
        variant="secondary"
        onClick={() => void onDiscoverProjectSync?.()}
      >
        {reviewState === "loading" ? "Loading..." : "Load Projects"}
      </Button>
    </div>
  );
}

function PrivacyDiagnosticsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <Button className="mb-4" icon={<ChevronLeft size={14} />} variant="secondary" onClick={onBack}>
        Back to setup
      </Button>
      <div className="grid gap-3">
        <PrivacyDetail title="External calls" text="Jira actions call Jira Cloud. AI actions use the selected provider only after you trigger them." />
        <PrivacyDetail title="Secrets" text="Jira and AI keys stay in the OS credential store and are excluded from SQLite, backups, and logs." />
        <PrivacyDetail title="Diagnostics" text="Manual npm audit sends dependency metadata to the configured npm registry when agents run it." />
        <PrivacyDetail title="Jira permissions" text="Only use Jira projects where you are authorized to create and modify issues." />
      </div>
    </div>
  );
}

function PrivacyDetail({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#172b4d]">
        <Info size={14} />
        {title}
      </div>
      <p className="text-sm leading-relaxed text-[#42526e]">{text}</p>
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

function ProjectSelect({
  label,
  value,
  options,
  isOpen,
  onChange,
  onOpenChange
}: {
  label: string;
  value: string;
  options: JiraProjectOption[];
  isOpen: boolean;
  onChange: (value: string) => void;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const selectedProject = options.find((project) => project.key === value);

  return (
    <div className="relative mb-5" onBlur={(event) => closeProjectSelectOnBlur(event, onOpenChange)}>
      <div className="mb-2 block text-xs font-medium text-[#6b778c]">{label}</div>
      <button
        className="flex h-10 w-full items-center justify-between gap-2 rounded border border-[#c1c7d0] bg-white px-3 text-left text-sm text-[#172b4d] outline-none hover:bg-[#f4f5f7] focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
        onClick={() => onOpenChange(!isOpen)}
        type="button"
      >
        <span className="truncate">
          {selectedProject ? `${selectedProject.key} - ${selectedProject.name}` : value ? `${value} - Manual key` : "Select project"}
        </span>
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div className="app-select-menu absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded border py-1 text-sm shadow-xl">
          {options.map((project) => (
            <button
              aria-selected={project.key === value}
              className="app-select-option flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              key={project.key}
              onClick={() => {
                onChange(project.key);
                onOpenChange(false);
              }}
              type="button"
            >
              <span className="truncate">
                {project.key} - {project.name}
              </span>
              {project.key === value ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function closeProjectSelectOnBlur(event: FocusEvent<HTMLDivElement>, onOpenChange: (isOpen: boolean) => void) {
  const nextFocusedElement = event.relatedTarget;
  if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) return;
  onOpenChange(false);
}

function preventMouseNavigation(event: MouseEvent<HTMLElement>) {
  if (!isMouseNavigationButton(event.button)) return;
  event.preventDefault();
  event.stopPropagation();
}

function ReviewRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="rounded border border-[#dfe1e6]">
      {rows.map(([label, value]) => (
        <div className="grid grid-cols-[190px_1fr] border-b border-[#ebecf0] px-3 py-2 last:border-b-0" key={label}>
          <div className="text-xs font-semibold text-[#6b778c]">{label}</div>
          <div className="break-words text-sm text-[#172b4d]">{value}</div>
        </div>
      ))}
    </div>
  );
}
