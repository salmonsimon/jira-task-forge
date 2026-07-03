import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, Pencil, Plus, RefreshCw, Tags, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button, PanelHeader } from "../../components/ui";
import type { AppSettings, CatalogSyncResult, Category, NotionCatalogConnectionTestResult } from "../../lib/types";
import { cn } from "../../lib/utils";

const NOTION_DEVELOPER_PORTAL_URL = "https://www.notion.so/developers";

export function CategoriesPanel({
  projects,
  areas,
  catalogSourceMode,
  catalogSourceUrl,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onChangeCatalogSettings,
  onSyncAreaCatalog,
  hasNotionIntegrationToken,
  onSaveNotionIntegrationToken,
  onDeleteNotionIntegrationToken,
  onTestNotionCatalogConnection,
  onClose
}: {
  projects: Category[];
  areas: Category[];
  catalogSourceMode: AppSettings["catalogSourceMode"];
  catalogSourceUrl: string;
  onCreateCategory: (categoryType: "project", name: string) => void | Promise<void>;
  onUpdateCategory: (categoryId: string, patch: Partial<Pick<Category, "hidden" | "name">>) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
  onChangeCatalogSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  onSyncAreaCatalog: (sourceUrl?: string) => Promise<CatalogSyncResult | null>;
  hasNotionIntegrationToken: () => Promise<boolean>;
  onSaveNotionIntegrationToken: (token: string) => Promise<void>;
  onDeleteNotionIntegrationToken: () => Promise<void>;
  onTestNotionCatalogConnection: (pageUrlOrId: string) => Promise<NotionCatalogConnectionTestResult>;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [isCatalogSetupOpen, setIsCatalogSetupOpen] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState<CatalogSyncResult | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current || panelRef.current.contains(event.target as Node)) return;
      onClose();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <aside ref={panelRef} className="fixed right-0 top-0 z-30 flex h-screen w-[420px] flex-col overscroll-contain border-l border-[#dfe1e6] bg-white shadow-xl">
      <PanelHeader title="Categories" subtitle="Projects and areas available in capture controls" onClose={onClose} />
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        <CategoryList
          categoryType="project"
          title="Projects"
          categories={projects}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
        />
        <CategoryList
          categoryType="area"
          title="Areas"
          categories={areas}
          isCatalogManaged
          catalogSourceMode={catalogSourceMode}
          catalogSourceUrl={catalogSourceUrl}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
          onSyncAreaCatalog={onSyncAreaCatalog}
          onOpenCatalogSetup={() => setIsCatalogSetupOpen(true)}
          onSyncResult={setCatalogNotice}
        />
      </div>
      {catalogNotice ? <CatalogSyncNotice result={catalogNotice} onClose={() => setCatalogNotice(null)} /> : null}
      {isCatalogSetupOpen ? (
        <CatalogSetupModal
          catalogSourceMode={catalogSourceMode}
          catalogSourceUrl={catalogSourceUrl}
          hasNotionIntegrationToken={hasNotionIntegrationToken}
          onChangeCatalogSettings={onChangeCatalogSettings}
          onClose={() => setIsCatalogSetupOpen(false)}
          onDeleteNotionIntegrationToken={onDeleteNotionIntegrationToken}
          onSaveNotionIntegrationToken={onSaveNotionIntegrationToken}
          onSyncAreaCatalog={onSyncAreaCatalog}
          onSyncResult={setCatalogNotice}
          onTestNotionCatalogConnection={onTestNotionCatalogConnection}
        />
      ) : null}
    </aside>
  );
}

function CategoryList({
  categoryType,
  title,
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSyncAreaCatalog,
  onOpenCatalogSetup,
  onSyncResult,
  catalogSourceMode = "notion",
  catalogSourceUrl = "",
  isCatalogManaged = false
}: {
  categoryType: "project" | "area";
  title: string;
  categories: Category[];
  isCatalogManaged?: boolean;
  catalogSourceMode?: AppSettings["catalogSourceMode"];
  catalogSourceUrl?: string;
  onCreateCategory: (categoryType: "project", name: string) => void | Promise<void>;
  onUpdateCategory: (categoryId: string, patch: Partial<Pick<Category, "hidden" | "name">>) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
  onSyncAreaCatalog?: (sourceUrl?: string) => Promise<CatalogSyncResult | null>;
  onOpenCatalogSetup?: () => void;
  onSyncResult?: (result: CatalogSyncResult | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newName, setNewName] = useState("");

  async function createCategory() {
    const nextName = newName.trim();
    if (!nextName) return;

    if (categoryType !== "project") return;
    await onCreateCategory(categoryType, nextName);
    setNewName("");
    setIsAdding(false);
  }

  async function syncCatalog() {
    if (!onSyncAreaCatalog || isSyncing) return;
    if (catalogSourceMode !== "manual" && !catalogSourceUrl.trim()) {
      onOpenCatalogSetup?.();
      return;
    }

    setIsSyncing(true);
    const startedAt = performance.now();
    try {
      const result = await onSyncAreaCatalog();
      await waitForMinimumElapsed(startedAt, 650);
      onSyncResult?.(result);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {isCatalogManaged ? (
          <Button
            variant="ghost"
            icon={<RefreshCw size={13} className={isSyncing ? "animate-spin" : undefined} />}
            disabled={isSyncing}
            onClick={() => void syncCatalog()}
            title="Update official area catalog"
          >
            {isSyncing ? "Syncing..." : "Sync"}
          </Button>
        ) : (
          <Button variant="ghost" icon={<Plus size={13} />} onClick={() => setIsAdding(true)}>
            New
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded border border-[#dfe1e6]">
        {isAdding && !isCatalogManaged ? (
          <div className="flex items-center gap-2 border-b border-[#ebecf0] bg-[#f7f8fa] px-3 py-2">
            <Tags size={14} className="shrink-0 text-[#6b778c]" />
            <input
              autoFocus
              className="h-8 min-w-0 flex-1 rounded border border-[#4c9aff] bg-white px-2 text-sm outline-none ring-2 ring-[#deebff]"
              placeholder={`New ${categoryType}`}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createCategory();
                if (event.key === "Escape") {
                  setIsAdding(false);
                  setNewName("");
                }
              }}
            />
            <button
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#42526e] hover:bg-[#ebecf0]"
              onClick={() => void createCategory()}
              title="Create category"
              type="button"
            >
              <Check size={14} />
            </button>
            <button
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#42526e] hover:bg-[#ebecf0]"
              onClick={() => {
                setIsAdding(false);
                setNewName("");
              }}
              title="Cancel"
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
        {categories.map((category) => (
          <CategoryRow
            category={category}
            key={category.id}
            isCatalogManaged={isCatalogManaged}
            onDeleteCategory={onDeleteCategory}
            onUpdateCategory={onUpdateCategory}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogSyncNotice({ result, onClose }: { result: CatalogSyncResult; onClose: () => void }) {
  const isOk = result.ok;
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] rounded border border-[#dfe1e6] bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {isOk ? <CheckCircle2 size={16} className="text-[#1f845a]" /> : <AlertTriangle size={16} className="text-[#e56910]" />}
          {isOk ? "Catalog sync completed" : "Catalog sync needs attention"}
        </div>
        <button className="text-[#6b778c] hover:text-[#172b4d]" onClick={onClose} title="Close" type="button">
          <X size={16} />
        </button>
      </div>
      {isOk ? (
        <p className="text-xs text-[#42526e]">
          {result.syncedAreaCount} areas, {result.deliveryFormatCount} delivery formats, and {result.ruleCount} rules validated.
        </p>
      ) : (
        <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-xs text-[#42526e]">
          {result.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {result.warnings.length > 0 ? (
        <ul className="mt-2 max-h-24 list-disc overflow-y-auto pl-5 text-xs text-[#6b778c]">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Feedback({ children, kind }: { children: ReactNode; kind: "success" | "warning" }) {
  return (
    <div
      className={cn(
        "rounded border px-3 py-2 text-xs",
        kind === "success"
          ? "border-[#abf5d1] bg-[#e3fcef] text-[#164b35]"
          : "border-[#f5cd47] bg-[#fff7d6] text-[#533f04]"
      )}
    >
      {children}
    </div>
  );
}

function CatalogSetupModal({
  catalogSourceMode,
  catalogSourceUrl,
  hasNotionIntegrationToken,
  onChangeCatalogSettings,
  onClose,
  onDeleteNotionIntegrationToken,
  onSaveNotionIntegrationToken,
  onSyncAreaCatalog,
  onSyncResult,
  onTestNotionCatalogConnection
}: {
  catalogSourceMode: AppSettings["catalogSourceMode"];
  catalogSourceUrl: string;
  hasNotionIntegrationToken: () => Promise<boolean>;
  onChangeCatalogSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  onClose: () => void;
  onDeleteNotionIntegrationToken: () => Promise<void>;
  onSaveNotionIntegrationToken: (token: string) => Promise<void>;
  onSyncAreaCatalog: (sourceUrl?: string) => Promise<CatalogSyncResult | null>;
  onSyncResult: (result: CatalogSyncResult | null) => void;
  onTestNotionCatalogConnection: (pageUrlOrId: string) => Promise<NotionCatalogConnectionTestResult>;
}) {
  const [step, setStep] = useState<"guide" | "connect" | "sync">("guide");
  const [mode, setMode] = useState<AppSettings["catalogSourceMode"]>(catalogSourceMode);
  const [sourceUrl, setSourceUrl] = useState(catalogSourceUrl);
  const [notionToken, setNotionToken] = useState("");
  const [hasNotionToken, setHasNotionToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<CatalogSyncResult | null>(null);
  const [notionTestResult, setNotionTestResult] = useState<NotionCatalogConnectionTestResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasNotionIntegrationToken().then((available) => {
      if (!cancelled) setHasNotionToken(available);
    });
    return () => {
      cancelled = true;
    };
  }, [hasNotionIntegrationToken]);

  async function copyTemplate() {
    await navigator.clipboard?.writeText(CATALOG_SOURCE_TEMPLATE);
  }

  async function testSource() {
    setIsTesting(true);
    const startedAt = performance.now();
    try {
      await onChangeCatalogSettings({ catalogSourceMode: mode, catalogSourceUrl: sourceUrl.trim() });
      if (mode === "notion") {
        if (notionToken.trim()) {
          await onSaveNotionIntegrationToken(notionToken);
          setHasNotionToken(true);
          setNotionToken("");
          setCredentialMessage("Notion token saved in the OS credential store.");
        }
        const notionResult = await onTestNotionCatalogConnection(sourceUrl.trim());
        await waitForMinimumElapsed(startedAt, 650);
        setNotionTestResult(notionResult);
        if (notionResult.ok) setStep("sync");
        return;
      }

      const result = mode === "manual" ? null : await onSyncAreaCatalog(sourceUrl.trim());
      await waitForMinimumElapsed(startedAt, 650);
      setTestResult(result);
      onSyncResult(result);
      if (result?.ok || mode === "manual") setStep("sync");
    } finally {
      setIsTesting(false);
    }
  }

  async function finish() {
    await onChangeCatalogSettings({ catalogSourceMode: mode, catalogSourceUrl: sourceUrl.trim() });
    onClose();
  }

  async function syncFromConfiguredSource() {
    setIsTesting(true);
    const startedAt = performance.now();
    try {
      const result = mode === "manual" ? null : await onSyncAreaCatalog(sourceUrl.trim());
      await waitForMinimumElapsed(startedAt, 650);
      setTestResult(result);
      onSyncResult(result);
      if (result?.ok || mode === "manual") await finish();
    } finally {
      setIsTesting(false);
    }
  }

  async function removeNotionToken() {
    await onDeleteNotionIntegrationToken();
    setHasNotionToken(false);
    setCredentialMessage("Notion token removed.");
  }

  const hasNotionTokenInput = notionToken.trim().length > 0;
  const canTestSource =
    !isTesting &&
    (mode === "manual" ||
      (sourceUrl.trim().length > 0 && (mode !== "notion" || hasNotionToken || hasNotionTokenInput)));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#091e42]/45 p-6">
      <div className="flex max-h-[88vh] w-[760px] max-w-full flex-col rounded border border-[#dfe1e6] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#dfe1e6] p-4">
          <div>
            <h2 className="text-base font-semibold">Catalog setup</h2>
            <p className="text-sm text-[#6b778c]">Connect the Notion source of truth, or use a JSON/manual fallback.</p>
          </div>
          <button className="text-[#6b778c] hover:text-[#172b4d]" onClick={onClose} title="Close" type="button">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-2 border-b border-[#dfe1e6] px-4 py-3">
          {(["guide", "connect", "sync"] as const).map((item, index) => (
            <button
              className={cn(
                "h-8 flex-1 rounded border px-3 text-sm",
                step === item ? "border-[#0c66e4] bg-[#0c66e4] text-white" : "border-[#dfe1e6] text-[#42526e]"
              )}
              key={item}
              onClick={() => setStep(item)}
              type="button"
            >
              {index + 1}. {item === "guide" ? "Guide" : item === "connect" ? "Connect" : "Sync"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {step === "guide" ? (
            <div className="space-y-4">
              <p className="text-sm text-[#42526e]">
                Use the existing Notion page as the source of truth. Create a Notion integration token, share the page with that integration, add one JSON code block with the JTF catalog contract, then paste the token and page URL in the next step.
              </p>
              <pre className="max-h-72 overflow-auto rounded bg-[#f7f8fa] p-3 text-xs text-[#172b4d]">{CATALOG_SOURCE_TEMPLATE}</pre>
              <Button icon={<Copy size={14} />} onClick={() => void copyTemplate()}>
                Copy template
              </Button>
            </div>
          ) : null}
          {step === "connect" ? (
            <div className="space-y-4">
              <label className="block text-sm font-semibold">Catalog mode</label>
              <select className="h-9 w-full rounded border border-[#dfe1e6] px-2 text-sm" value={mode} onChange={(event) => setMode(event.target.value as AppSettings["catalogSourceMode"])}>
                <option value="notion">Sync from Notion page</option>
                <option value="public-exportable">Sync with public/exportable source</option>
                <option value="manual">Manual catalog</option>
              </select>
              {mode !== "manual" ? (
                <>
                  {mode === "notion" ? (
                    <>
                      <div className="rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-[#172b4d]">{hasNotionToken ? "Notion token saved" : "No Notion token saved"}</div>
                            <p className="mt-1 text-xs text-[#6b778c]">The token stays in the OS credential store and is excluded from SQLite, backups, and logs.</p>
                          </div>
                          <a
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0c66e4] hover:underline"
                            href={NOTION_DEVELOPER_PORTAL_URL}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Create token
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        {hasNotionToken ? (
                          <button className="mt-2 text-xs font-semibold text-[#0c66e4]" onClick={() => void removeNotionToken()} type="button">
                            Remove token
                          </button>
                        ) : null}
                      </div>
                      <label className="block text-sm font-semibold">Integration token</label>
                      <input
                        className="secret-input h-9 w-full rounded border border-[#dfe1e6] px-2 text-sm"
                        placeholder={hasNotionToken ? "Enter a new token to replace it" : "Paste Notion integration token"}
                        type="password"
                        value={notionToken}
                        onChange={(event) => setNotionToken(event.target.value)}
                      />
                      <label className="block text-sm font-semibold">Notion page URL or ID</label>
                      <input
                        className="h-9 w-full rounded border border-[#dfe1e6] px-2 text-sm"
                        placeholder="https://www.notion.so/... or page id"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                      />
                      {credentialMessage ? <Feedback kind="success">{credentialMessage}</Feedback> : null}
                      {notionTestResult ? (
                        <Feedback kind={notionTestResult.ok ? "success" : "warning"}>
                          {notionTestResult.message}
                          {notionTestResult.title ? ` Page: ${notionTestResult.title}.` : ""}
                        </Feedback>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-semibold">Source URL</label>
                      <input
                        className="h-9 w-full rounded border border-[#dfe1e6] px-2 text-sm"
                        placeholder="https://.../jtf-sync-catalog.json"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                      />
                    </>
                  )}
                </>
              ) : null}
              <Button className="settings-button-test" disabled={!canTestSource} icon={isTesting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} onClick={() => void testSource()}>
                {isTesting ? "Testing..." : mode === "manual" ? "Use manual catalog" : "Test source"}
              </Button>
              {testResult ? <CatalogSyncNotice result={testResult} onClose={() => setTestResult(null)} /> : null}
            </div>
          ) : null}
          {step === "sync" ? (
            <div className="space-y-3 text-sm text-[#42526e]">
              <p>{mode === "manual" ? "Manual catalog mode is configured. Projects remain manually editable and areas use the local fallback catalog." : "The source was validated and synchronized. Future Sync clicks will use the saved URL directly."}</p>
              {mode === "notion" && notionTestResult?.ok ? (
                <p>
                  Notion connection is ready{notionTestResult.title ? ` for ${notionTestResult.title}` : ""}. Sync will read the JSON code block from that page.
                </p>
              ) : null}
              {testResult?.ok ? (
                <p>
                  Synced {testResult.syncedAreaCount} areas, {testResult.deliveryFormatCount} delivery formats, and {testResult.ruleCount} rules.
                </p>
              ) : null}
              <Button className="settings-button-primary" disabled={isTesting} icon={isTesting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} onClick={() => void syncFromConfiguredSource()}>
                {isTesting ? "Syncing..." : mode === "manual" ? "Finish" : "Sync catalog"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const CATALOG_SOURCE_TEMPLATE = JSON.stringify(
  {
    areas: [
      {
        areaDisplayName: "Programación",
        jiraLabel: "Programación",
        enabledInJTF: true,
        issueType: "Story",
        defaultDeliveryFormat: "Feature de Programación",
        safeAliases: ["Programacion"],
        notes: "Implementación técnica, código, Blueprints, sistemas, features."
      }
    ],
    deliveryFormats: [
      {
        formatName: "Feature de Programación",
        issueType: "Story",
        storyHeadings: ["Historia de usuario", "Contexto", "Alcance", "Criterios de aceptación", "Entregable mínimo", "Checklist antes de Review"],
        minimumDeliverable: "PR/MR al proyecto o plugin correspondiente.",
        reviewChecklist: ["PR/MR creado.", "Rama correcta.", "Si toca Blueprints, Snapshot Unreal exportado y linkeado."]
      }
    ],
    areaFormatRules: [
      {
        areaDisplayName: "Programación",
        priority: 1,
        condition: "fallback",
        deliveryFormat: "Feature de Programación",
        blocking: false
      }
    ]
  },
  null,
  2
);

async function waitForMinimumElapsed(startedAt: number, minimumMs: number): Promise<void> {
  const remainingMs = minimumMs - (performance.now() - startedAt);
  if (remainingMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
  }
}

function CategoryRow({
  category,
  onDeleteCategory,
  onUpdateCategory,
  isCatalogManaged = false
}: {
  category: Category;
  isCatalogManaged?: boolean;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
  onUpdateCategory: (categoryId: string, patch: Partial<Pick<Category, "hidden" | "name">>) => void | Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(category.name);

  useEffect(() => {
    if (!isEditing) setDraftName(category.name);
  }, [category.name, isEditing]);

  async function acceptEditing() {
    const nextName = draftName.trim();
    if (nextName && nextName !== category.name) {
      await onUpdateCategory(category.id, { name: nextName });
    }
    setIsEditing(false);
  }

  function cancelEditing() {
    setDraftName(category.name);
    setIsEditing(false);
  }

  return (
    <div className="group flex min-w-0 items-center justify-between gap-2 border-b border-[#ebecf0] px-3 py-2 last:border-b-0">
      <div className={cn("flex min-w-0 flex-1 items-center gap-2 text-sm", category.hidden && "text-[#6b778c]")}>
        {category.hidden ? <EyeOff size={14} className="shrink-0 text-[#6b778c]" /> : <Tags size={14} className="shrink-0 text-[#6b778c]" />}
        {isEditing ? (
          <input
            autoFocus
            className="h-8 min-w-0 flex-1 rounded border border-[#4c9aff] bg-white px-2 text-sm outline-none ring-2 ring-[#deebff]"
            value={draftName}
            onBlur={() => void acceptEditing()}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void acceptEditing();
              if (event.key === "Escape") cancelEditing();
            }}
          />
        ) : (
          <span className="truncate">{category.name}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="mr-1 text-xs text-[#6b778c]">{category.hidden ? "Hidden" : category.source}</span>
        {isEditing ? (
          <>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] hover:bg-[#ebecf0]"
              onClick={() => void acceptEditing()}
              title="Save category name"
              type="button"
            >
              <Check size={14} />
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] hover:bg-[#ebecf0]"
              onClick={cancelEditing}
              title="Cancel"
              type="button"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            {!isCatalogManaged ? (
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] opacity-0 transition hover:bg-[#ebecf0] group-hover:opacity-100 focus:opacity-100"
                onClick={() => setIsEditing(true)}
                title={`Rename ${category.name}`}
                type="button"
              >
                <Pencil size={14} />
              </button>
            ) : null}
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] transition hover:bg-[#ebecf0]"
              onClick={() => void onUpdateCategory(category.id, { hidden: !category.hidden })}
              title={category.hidden ? `Show ${category.name}` : `Hide ${category.name}`}
              type="button"
            >
              {category.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            {!isCatalogManaged ? (
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] opacity-0 transition hover:bg-[#ffebe6] hover:text-[#bf2600] group-hover:opacity-100 focus:opacity-100"
                onClick={() => void onDeleteCategory(category.id)}
                title={`Delete ${category.name}`}
                type="button"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
