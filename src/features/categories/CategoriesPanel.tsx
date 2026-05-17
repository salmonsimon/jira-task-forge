import { EyeOff, Plus, RefreshCw, Tags } from "lucide-react";
import { Button, PanelHeader } from "../../components/ui";
import type { Category } from "../../lib/types";

export function CategoriesPanel({
  projects,
  areas,
  onClose
}: {
  projects: Category[];
  areas: Category[];
  onClose: () => void;
}) {
  return (
    <aside className="fixed right-0 top-0 z-30 flex h-screen w-[420px] flex-col border-l border-[#dfe1e6] bg-white shadow-xl">
      <PanelHeader title="Categories" subtitle="Projects and areas available in capture controls" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        <CategoryList title="Projects" categories={projects} />
        <CategoryList title="Areas" categories={areas} />
        <div className="mt-4 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <RefreshCw size={15} />
            Jira sync suggestions
          </div>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input defaultChecked type="checkbox" />
              Add area: Tutorial
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Ignore area: Deprecated
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary">Add selected</Button>
            <Button variant="ghost">Ignore</Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function CategoryList({ title, categories }: { title: string; categories: Category[] }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="ghost" icon={<Plus size={13} />}>
          New
        </Button>
      </div>
      <div className="overflow-hidden rounded border border-[#dfe1e6]">
        {categories.map((category) => (
          <div className="flex items-center justify-between border-b border-[#ebecf0] px-3 py-2 last:border-b-0" key={category.id}>
            <div className="flex items-center gap-2 text-sm">
              {category.hidden ? <EyeOff size={14} className="text-[#6b778c]" /> : <Tags size={14} className="text-[#6b778c]" />}
              {category.name}
            </div>
            <span className="text-xs text-[#6b778c]">{category.hidden ? "Hidden" : category.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
