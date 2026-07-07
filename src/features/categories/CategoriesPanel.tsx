import { AlertTriangle, Check, CheckCircle2, Eye, EyeOff, Pencil, Plus, RefreshCw, Tags, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, DrawerShell, FeedbackNote, PanelHeader } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { isNotionSyncedProjectReadOnly } from "../../lib/categoryPolicy";
import type { AppSettings, CatalogSyncResult, Category } from "../../lib/types";
import { cn } from "../../lib/utils";


export function CategoriesPanel({
  projects,
  areas,
  catalogSourceMode,
  catalogSourceUrl,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSyncAreaCatalog,
  onConfigureCatalogSource,
  onClose
}: {
  projects: Category[];
  areas: Category[];
  catalogSourceMode: AppSettings["catalogSourceMode"];
  catalogSourceUrl: string;
  onCreateCategory: (categoryType: "project" | "area", name: string) => void | Promise<void>;
  onUpdateCategory: (categoryId: string, patch: Partial<Pick<Category, "hidden" | "name">>) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
  onSyncAreaCatalog: (sourceUrl?: string) => Promise<CatalogSyncResult | null>;
  onConfigureCatalogSource: (target?: "settings" | "notion-synchronization") => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [catalogNotice, setCatalogNotice] = useState<CatalogSyncResult | null>(null);

  const overlay = useAppOverlay({
    layer: appOverlayLayers.sidePanel,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef: panelRef
  });

  return (
    <DrawerShell overlay={overlay} surfaceRef={panelRef}>
      <PanelHeader title="Categories" subtitle="Projects and areas available in capture controls" onClose={onClose} />
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        <CategoryList
          categoryType="project"
          title="Projects"
          categories={projects}
          catalogSourceMode={catalogSourceMode}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
        />
        <CategoryList
          categoryType="area"
          title="Areas"
          categories={areas}
          isCatalogManaged={catalogSourceMode !== "manual"}
          catalogSourceMode={catalogSourceMode}
          catalogSourceUrl={catalogSourceUrl}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
          onSyncAreaCatalog={onSyncAreaCatalog}
          onConfigureCatalogSource={onConfigureCatalogSource}
          onSyncResult={setCatalogNotice}
        />
      </div>
      {catalogNotice ? <CatalogSyncNotice result={catalogNotice} onClose={() => setCatalogNotice(null)} /> : null}
    </DrawerShell>
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
  onConfigureCatalogSource,
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
  onCreateCategory: (categoryType: "project" | "area", name: string) => void | Promise<void>;
  onUpdateCategory: (categoryId: string, patch: Partial<Pick<Category, "hidden" | "name">>) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
  onSyncAreaCatalog?: (sourceUrl?: string) => Promise<CatalogSyncResult | null>;
  onConfigureCatalogSource?: (target?: "settings" | "notion-synchronization") => void;
  onSyncResult?: (result: CatalogSyncResult | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newName, setNewName] = useState("");

  async function createCategory() {
    const nextName = newName.trim();
    if (!nextName) return;

    await onCreateCategory(categoryType, nextName);
    setNewName("");
    setIsAdding(false);
  }

  async function syncCatalog() {
    if (!onSyncAreaCatalog || isSyncing) return;
    if (catalogSourceMode !== "manual" && !catalogSourceUrl.trim()) {
      onConfigureCatalogSource?.(catalogSourceMode === "notion" ? "notion-synchronization" : "settings");
      return;
    }

    setIsSyncing(true);
    const startedAt = performance.now();
    try {
      const result = await onSyncAreaCatalog();
      await waitForMinimumElapsed(startedAt, 650);
      if (isMissingNotionSynchronizationSetup(catalogSourceMode, result)) {
        onConfigureCatalogSource?.("notion-synchronization");
        return;
      }
      if (result) onSyncResult?.(result);
    } catch (error) {
      await waitForMinimumElapsed(startedAt, 650);
      const result = createCatalogSyncErrorResult(error);
      if (isMissingNotionSynchronizationSetup(catalogSourceMode, result)) {
        onConfigureCatalogSource?.("notion-synchronization");
        return;
      }
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
            isReadOnly={isNotionSyncedProjectReadOnly(category, catalogSourceMode)}
            onDeleteCategory={onDeleteCategory}
            onUpdateCategory={onUpdateCategory}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogSyncNotice({ result, onClose }: { result: CatalogSyncResult; onClose: () => void }) {
  const noticeRef = useRef<HTMLElement | null>(null);
  const isOk = result.ok;
  const overlay = useAppOverlay({
    layer: appOverlayLayers.centeredNotice,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef: noticeRef
  });

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-[rgba(9,30,66,0.66)] px-4"
      data-overlay-scrim="catalog-sync-notice"
      {...overlay.backdropProps}
    >
      <section
        ref={noticeRef}
        className="catalog-sync-notice-surface w-full max-w-[520px] rounded border border-[#dfe1e6] bg-white p-4 text-[#172b4d] shadow-2xl"
        {...overlay.surfaceProps}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {isOk ? <CheckCircle2 size={16} className="text-[#1f845a]" /> : <AlertTriangle size={16} className="text-[#e56910]" />}
          {isOk ? "Catalog sync completed" : "Catalog sync needs attention"}
        </div>
        <button className="catalog-sync-notice-close text-[#6b778c] hover:text-[#172b4d]" onClick={onClose} title="Close" type="button">
          <X size={16} />
        </button>
      </div>
      {isOk ? (
        <FeedbackNote variant="success">
          {result.sourceUrl === "manual"
            ? `${result.syncedAreaCount} manual fallback areas are available.`
            : `${result.syncedAreaCount} areas, ${result.deliveryFormatCount} delivery formats, and ${result.ruleCount} rules validated.`}
        </FeedbackNote>
      ) : (
        <FeedbackNote variant="error">
          <ul className="max-h-40 list-disc overflow-y-auto pl-4">
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </FeedbackNote>
      )}
      {result.warnings.length > 0 ? (
        <FeedbackNote className="mt-2" variant="warning">
          <ul className="max-h-24 list-disc overflow-y-auto pl-4">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </FeedbackNote>
      ) : null}
      </section>
    </div>
  );
}

async function waitForMinimumElapsed(startedAt: number, minimumMs: number): Promise<void> {
  const remainingMs = minimumMs - (performance.now() - startedAt);
  if (remainingMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
  }
}


export function createCatalogSyncErrorResult(error: unknown): CatalogSyncResult {
  return {
    ok: false,
    sourceUrl: "",
    syncedAreaCount: 0,
    deliveryFormatCount: 0,
    ruleCount: 0,
    warnings: [],
    errors: [catalogSyncErrorMessage(error)],
    areas: [],
    deliveryFormats: [],
    areaFormatRules: []
  };
}

function catalogSyncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Catalog sync failed.";
}

export function isMissingNotionSynchronizationSetup(
  catalogSourceMode: AppSettings["catalogSourceMode"],
  result: CatalogSyncResult | null
): boolean {
  if (catalogSourceMode !== "notion" || !result || result.ok) return false;

  return result.errors.some((error) => {
    const normalizedError = error.toLowerCase();
    return (
      normalizedError.includes("save a notion integration token") ||
      normalizedError.includes("notion integration token is empty") ||
      normalizedError.includes("notion integration token is required") ||
      normalizedError.includes("paste a notion page url")
    );
  });
}

function CategoryRow({
  category,
  onDeleteCategory,
  onUpdateCategory,
  isCatalogManaged = false,
  isReadOnly = false
}: {
  category: Category;
  isCatalogManaged?: boolean;
  isReadOnly?: boolean;
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
        {category.hidden && !isReadOnly ? (
          <EyeOff size={14} className="shrink-0 text-[#6b778c]" />
        ) : (
          <Tags size={14} className="shrink-0 text-[#6b778c]" />
        )}
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
        <span className="mr-1 text-xs text-[#6b778c]">{isReadOnly ? "Official" : category.hidden ? "Hidden" : category.source}</span>
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
            {!isCatalogManaged && !isReadOnly ? (
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] opacity-0 transition hover:bg-[#ebecf0] group-hover:opacity-100 focus:opacity-100"
                onClick={() => setIsEditing(true)}
                title={`Rename ${category.name}`}
                type="button"
              >
                <Pencil size={14} />
              </button>
            ) : null}
            {!isReadOnly ? (
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] transition hover:bg-[#ebecf0]"
                onClick={() => void onUpdateCategory(category.id, { hidden: !category.hidden })}
                title={category.hidden ? `Show ${category.name}` : `Hide ${category.name}`}
                type="button"
              >
                {category.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            ) : null}
            {!isCatalogManaged && !isReadOnly ? (
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
