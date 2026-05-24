import { Check, Eye, EyeOff, Pencil, Plus, Tags, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, PanelHeader } from "../../components/ui";
import type { Category } from "../../lib/types";
import { cn } from "../../lib/utils";

export function CategoriesPanel({
  projects,
  areas,
  onCreateCategory,
  onUpdateCategory,
  onClose
}: {
  projects: Category[];
  areas: Category[];
  onCreateCategory: (categoryType: "project" | "area", name: string) => void | Promise<void>;
  onUpdateCategory: (categoryId: string, patch: Partial<Pick<Category, "hidden" | "name">>) => void | Promise<void>;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current || panelRef.current.contains(event.target as Node)) return;
      onClose();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  return (
    <aside ref={panelRef} className="fixed right-0 top-0 z-30 flex h-screen w-[420px] flex-col border-l border-[#dfe1e6] bg-white shadow-xl">
      <PanelHeader title="Categories" subtitle="Projects and areas available in capture controls" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        <CategoryList
          categoryType="project"
          title="Projects"
          categories={projects}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
        />
        <CategoryList
          categoryType="area"
          title="Areas"
          categories={areas}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
        />
      </div>
    </aside>
  );
}

function CategoryList({
  categoryType,
  title,
  categories,
  onCreateCategory,
  onUpdateCategory
}: {
  categoryType: "project" | "area";
  title: string;
  categories: Category[];
  onCreateCategory: (categoryType: "project" | "area", name: string) => void | Promise<void>;
  onUpdateCategory: (categoryId: string, patch: Partial<Pick<Category, "hidden" | "name">>) => void | Promise<void>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  async function createCategory() {
    const nextName = newName.trim();
    if (!nextName) return;

    await onCreateCategory(categoryType, nextName);
    setNewName("");
    setIsAdding(false);
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="ghost" icon={<Plus size={13} />} onClick={() => setIsAdding(true)}>
          New
        </Button>
      </div>
      <div className="overflow-hidden rounded border border-[#dfe1e6]">
        {isAdding ? (
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
          <CategoryRow category={category} key={category.id} onUpdateCategory={onUpdateCategory} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  onUpdateCategory
}: {
  category: Category;
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
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] opacity-0 transition hover:bg-[#ebecf0] group-hover:opacity-100 focus:opacity-100"
              onClick={() => setIsEditing(true)}
              title={`Rename ${category.name}`}
              type="button"
            >
              <Pencil size={14} />
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] transition hover:bg-[#ebecf0]"
              onClick={() => void onUpdateCategory(category.id, { hidden: !category.hidden })}
              title={category.hidden ? `Show ${category.name}` : `Hide ${category.name}`}
              type="button"
            >
              {category.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
