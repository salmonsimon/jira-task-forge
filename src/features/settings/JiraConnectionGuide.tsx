import { Check, CheckCircle2, ChevronDown, ChevronLeft, ExternalLink, Info, KeyRound, RefreshCw } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, LoadingOrb, PanelHeader } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { validateJiraSiteUrlDraft } from "../../lib/domain";
import type { AppSettings, JiraConnectionTestResult, JiraProjectOption } from "../../lib/types";

type GuideStep = "site" | "account" | "verify" | "project" | "token" | "review";

const guideSteps: Array<{ id: GuideStep; label: string }> = [
  { id: "site", label: "Site" },
  { id: "account", label: "Account" },
  { id: "verify", label: "Verify" },
  { id: "project", label: "Project" },
  { id: "token", label: "Token" },
  { id: "review", label: "Review" }
];

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
  onOpenJiraApiTokens,
  onClose
}: {
  settings: AppSettings;
  hasJiraApiToken: boolean;
  isTestingJiraConnection: boolean;
  onSave: (settings: Pick<AppSettings, "jiraSiteUrl" | "jiraAccountEmail" | "jiraCreationProjectKey">) => Promise<boolean>;
  onSaveJiraApiToken: (token: string) => Promise<boolean>;
  onDeleteJiraApiToken: () => void;
  onTestConnection: (siteUrl: string, accountEmail: string) => Promise<JiraConnectionTestResult>;
  onTestJiraApiToken: (token: string) => Promise<JiraConnectionTestResult>;
  onListProjects: (siteUrl: string, accountEmail: string) => Promise<JiraProjectOption[]>;
  onOpenJiraApiTokens: () => void;
  onClose: () => void;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState<GuideStep>("site");
  const [siteUrlDraft, setSiteUrlDraft] = useState(settings.jiraSiteUrl);
  const [accountEmailDraft, setAccountEmailDraft] = useState(settings.jiraAccountEmail);
  const [jiraApiTokenDraft, setJiraApiTokenDraft] = useState("");
  const [jiraTokenStatus, setJiraTokenStatus] = useState<"idle" | "testing" | "success" | "failed" | "saving">("idle");
  const [jiraTokenMessage, setJiraTokenMessage] = useState<string | null>(null);
  const [projectKeyDraft, setProjectKeyDraft] = useState(settings.jiraCreationProjectKey);
  const [connectionResult, setConnectionResult] = useState<JiraConnectionTestResult | null>(null);
  const [projects, setProjects] = useState<JiraProjectOption[]>([]);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [projectDiscoveryState, setProjectDiscoveryState] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [projectDiscoveryMessage, setProjectDiscoveryMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const siteUrlValidation = useMemo(() => validateJiraSiteUrlDraft(siteUrlDraft), [siteUrlDraft]);
  const normalizedSiteUrl = siteUrlValidation.ok ? siteUrlValidation.value : siteUrlDraft.trim();
  const accountEmail = accountEmailDraft.trim();
  const projectKey = projectKeyDraft.trim().toUpperCase();
  const canContinue =
    (step === "site" && siteUrlValidation.ok) ||
    (step === "account" && Boolean(accountEmail)) ||
    step === "verify" ||
    (step === "project" && Boolean(projectKey)) ||
    (step === "token" && (hasJiraApiToken || jiraTokenStatus === "success")) ||
    step === "review";
  const currentStepIndex = guideSteps.findIndex((candidate) => candidate.id === step);
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
    const nextStep = guideSteps[currentStepIndex + 1]?.id;
    if (nextStep) setStep(nextStep);
  }

  function moveBack() {
    const previousStep = guideSteps[currentStepIndex - 1]?.id;
    if (previousStep) setStep(previousStep);
  }

  async function testJiraTokenDraft() {
    const token = jiraApiTokenDraft.trim();
    if (!siteUrlValidation.ok || !accountEmail) return;
    setJiraTokenStatus("testing");
    setJiraTokenMessage(null);
    const result = token ? await onTestJiraApiToken(token) : await onTestConnection(siteUrlValidation.value, accountEmail);
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
        setProjectKeyDraft(discoveredProjects[0].key);
      }
    } catch (error) {
      setProjects([]);
      setProjectDiscoveryState("failed");
      setProjectDiscoveryMessage(error instanceof Error ? error.message : "Project discovery failed. Enter a project key manually.");
    }
  }

  async function saveConnection() {
    if (!siteUrlValidation.ok || !accountEmail || !projectKey) return;
    setIsSaving(true);
    setSaveError(null);
    const saved = await onSave({
      jiraSiteUrl: siteUrlValidation.value,
      jiraAccountEmail: accountEmail,
      jiraCreationProjectKey: projectKey
    });
    setIsSaving(false);
    if (saved) {
      onClose();
      return;
    }
    setSaveError("Could not save Jira connection settings.");
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
    >
      <section
        ref={surfaceRef}
        className="flex max-h-[86vh] w-full max-w-[800px] flex-col overflow-hidden rounded border border-[#c1c7d0] bg-white shadow-2xl"
        {...overlay.surfaceProps}
        onAuxClick={preventMouseNavigation}
        onMouseDown={preventMouseNavigation}
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
              <div className="grid grid-cols-6 gap-2">
                {guideSteps.map((candidate, index) => (
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
                  <Feedback kind={siteUrlValidation.ok ? "success" : "error"}>{siteUrlValidation.message}</Feedback>
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
                <GuideSection title="Jira API token" description="Save or replace the Jira API token used by the selected site, account, and project. The token stays in the OS credential store.">
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
                      <Feedback kind="warning">Testing Jira API token...</Feedback>
                    ) : jiraTokenStatus === "success" ? (
                      <Feedback kind="success">
                        {jiraApiTokenDraft ? "This key passed Test key and can be saved." : "Saved Jira API token test succeeded."}
                        {jiraTokenMessage ? ` ${jiraTokenMessage}` : ""}
                      </Feedback>
                    ) : jiraTokenStatus === "failed" ? (
                      <Feedback kind="error">
                        {jiraTokenMessage || "Update this key or Jira connection details, then test again."}
                      </Feedback>
                    ) : jiraApiTokenDraft ? (
                      <Feedback kind="warning">Test this key before saving it.</Feedback>
                    ) : hasJiraApiToken ? (
                      <Feedback kind="success">A saved Jira API token is available. You can test it or continue to review.</Feedback>
                    ) : null}
                  </div>
                </GuideSection>
              ) : null}
              {step === "verify" ? (
                <GuideSection title="Verify connection" description="The app tests the draft site and email using the saved Jira API token. Nothing is saved during this step.">
                  <div className="rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#172b4d]">{hasJiraApiToken ? "API token saved" : "API token missing"}</div>
                        <p className="text-xs text-[#6b778c]">The Token step saves or replaces the credential in the OS credential store.</p>
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
                      <Feedback kind={connectionResult.ok ? "success" : "error"}>
                        {connectionResult.message}
                        {connectionResult.ok && connectionResult.accountDisplayName ? ` Connected as ${connectionResult.accountDisplayName}.` : ""}
                      </Feedback>
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
                      onChange={(value) => {
                        setProjectKeyDraft(value);
                        setIsProjectMenuOpen(false);
                      }}
                      onToggle={() => setIsProjectMenuOpen((currentValue) => !currentValue)}
                    />
                  ) : null}
                  <GuideInput
                    label={projects.length ? "Manual fallback project key" : "Project key"}
                    placeholder="JTFTEST"
                    value={projectKeyDraft}
                    onChange={(value) => setProjectKeyDraft(value.toUpperCase())}
                  />
                  {projectDiscoveryMessage ? (
                    <Feedback kind={projectDiscoveryState === "failed" ? "warning" : "success"}>{projectDiscoveryMessage}</Feedback>
                  ) : null}
                </GuideSection>
              ) : null}
              {step === "review" ? (
                <GuideSection title="Review and save" description="These settings are saved together. API tokens remain separate and are never written to SQLite or backups.">
                  <ReviewRows
                    rows={[
                      ["Jira Site URL", normalizedSiteUrl || "Missing"],
                      ["Account email", accountEmail || "Missing"],
                      ["Jira creation project key", projectKey || "Missing"]
                    ]}
                  />
                  {saveError ? <Feedback kind="error">{saveError}</Feedback> : null}
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
                <Button className="settings-button-primary" disabled={!canContinue || isSaving} icon={isSaving ? <LoadingOrb size="xs" /> : <CheckCircle2 size={14} />} onClick={saveConnection}>
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
        <PrivacyDetail title="QA boundary" text="JTFTEST is writable for live QA. DTS remains read-only reference data." />
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
  onToggle
}: {
  label: string;
  value: string;
  options: JiraProjectOption[];
  isOpen: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  const selectedProject = options.find((project) => project.key === value) ?? options[0];

  return (
    <div className="relative mb-5">
      <div className="mb-2 block text-xs font-medium text-[#6b778c]">{label}</div>
      <button
        className="flex h-10 w-full items-center justify-between gap-2 rounded border border-[#c1c7d0] bg-white px-3 text-left text-sm text-[#172b4d] outline-none hover:bg-[#f4f5f7] focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
        onBlur={() => window.setTimeout(() => isOpen && onToggle(), 120)}
        onClick={onToggle}
        type="button"
      >
        <span className="truncate">
          {selectedProject ? `${selectedProject.key} - ${selectedProject.name}` : "Select project"}
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
              onClick={() => onChange(project.key)}
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

function Feedback({ kind, children }: { kind: "success" | "warning" | "error"; children: ReactNode }) {
  const className =
    kind === "success"
      ? "border-[#abf5d1] bg-[#e3fcef] text-[#006644]"
      : kind === "warning"
        ? "border-[#f5cd47] bg-[#fff7d6] text-[#974f0c]"
        : "border-[#ffbdad] bg-[#ffebe6] text-[#bf2600]";
  return <p className={`rounded border px-2 py-1.5 text-xs leading-relaxed ${className}`}>{children}</p>;
}

function preventMouseNavigation(event: MouseEvent<HTMLElement>) {
  if (event.button !== 3 && event.button !== 4) return;
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
