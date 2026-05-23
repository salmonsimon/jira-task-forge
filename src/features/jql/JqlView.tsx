import { Bot, History, Loader2, Search, Sparkles, Star } from "lucide-react";
import { Button, IssueTypeBadge, PriorityBadge, SegmentedControl } from "../../components/ui";
import type { JqlFavorite, JqlResult } from "../../lib/types";
import { cn } from "../../lib/utils";

export function JqlView({
  jqlMode,
  setJqlMode,
  selectedFavoriteId,
  setSelectedFavoriteId,
  favorites,
  results,
  jqlQuery,
  setJqlQuery,
  jqlPrompt,
  setJqlPrompt,
  generatedJqlPreview,
  onRunQuery,
  isRunningQuery,
  queryMessage
}: {
  jqlMode: "direct" | "ai";
  setJqlMode: (mode: "direct" | "ai") => void;
  selectedFavoriteId: string | undefined;
  setSelectedFavoriteId: (id: string) => void;
  favorites: JqlFavorite[];
  results: JqlResult[];
  jqlQuery: string;
  setJqlQuery: (query: string) => void;
  jqlPrompt: string;
  setJqlPrompt: (prompt: string) => void;
  generatedJqlPreview: string;
  onRunQuery: () => void;
  isRunningQuery: boolean;
  queryMessage: string | null;
}) {
  const selectedFavorite = favorites.find((favorite) => favorite.id === selectedFavoriteId) ?? favorites[0];

  return (
    <section className="grid flex-1 grid-cols-[280px_1fr] gap-4 px-5 py-4">
      {isRunningQuery ? <JqlLoadingOverlay /> : null}
      <aside className="rounded border border-[#dfe1e6] bg-white">
        <div className="border-b border-[#dfe1e6] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Star size={15} />
            Favorites
          </div>
        </div>
        <div className="p-2">
          {favorites.map((favorite) => (
            <button
              className={cn(
                "mb-1 w-full rounded px-3 py-2 text-left hover:bg-[#f4f8ff]",
                selectedFavorite?.id === favorite.id && "bg-[#deebff]"
              )}
              key={favorite.id}
              onClick={() => setSelectedFavoriteId(favorite.id)}
            >
              <div className="text-sm font-medium">{favorite.name}</div>
              <div className="mt-1 line-clamp-2 text-xs text-[#6b778c]">{favorite.jql}</div>
            </button>
          ))}
        </div>
        <div className="border-t border-[#dfe1e6] px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <History size={15} />
            Recent
          </div>
          <div className="space-y-2 text-xs text-[#6b778c]">
            <div>project = DTS AND statusCategory != Done</div>
            <div>issuetype = Epic ORDER BY updated DESC</div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 rounded border border-[#dfe1e6] bg-white">
        <div className="flex items-center justify-between border-b border-[#dfe1e6] px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">JQL</h1>
            <p className="text-xs text-[#6b778c]">Run direct JQL or ask AI to draft it first.</p>
          </div>
          <Button variant="secondary" icon={<Star size={14} />}>
            Save favorite
          </Button>
        </div>

        <div className="border-b border-[#dfe1e6] p-4">
          <SegmentedControl
            value={jqlMode}
            options={[
              { label: "Ask AI", value: "ai" },
              { label: "Direct JQL", value: "direct" }
            ]}
            onChange={(value) => setJqlMode(value as "ai" | "direct")}
          />
          <textarea
            className="mt-3 h-24 w-full resize-none rounded border border-[#c1c7d0] p-3 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
            value={jqlMode === "ai" ? jqlPrompt : jqlQuery}
            onChange={(event) => (jqlMode === "ai" ? setJqlPrompt(event.target.value) : setJqlQuery(event.target.value))}
          />
          {jqlMode === "ai" ? (
            <div className="mt-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-[#6b778c]">
                <Bot size={14} />
                Generated JQL preview
              </div>
              <code className="text-sm text-[#172b4d]">{generatedJqlPreview}</code>
            </div>
          ) : null}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-xs leading-relaxed text-[#6b778c]">{queryMessage}</div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {jqlMode === "ai" ? (
                <Button variant="secondary" icon={<Sparkles size={14} />}>
                  Generate JQL
                </Button>
              ) : null}
              <Button
                className="min-w-[112px] shrink-0 whitespace-nowrap"
                disabled={isRunningQuery}
                icon={isRunningQuery ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                onClick={onRunQuery}
              >
                {isRunningQuery ? "Running" : "Run query"}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-2 text-sm font-semibold">Results</div>
          {results.length > 0 ? (
            <div className="overflow-hidden rounded border border-[#dfe1e6]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f4f5f7] text-left text-xs font-semibold text-[#6b778c]">
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Summary</th>
                    <th className="px-3 py-2">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr className="border-t border-[#ebecf0] hover:bg-[#f4f8ff]" key={result.key}>
                      <td className="px-3 py-2 font-medium text-[#0052cc]">{result.key}</td>
                      <td className="px-3 py-2">{result.project}</td>
                      <td className="px-3 py-2">
                        <IssueTypeBadge type={result.issueType} />
                      </td>
                      <td className="px-3 py-2">
                        <PriorityBadge priority={result.priority} />
                      </td>
                      <td className="px-3 py-2">{result.status}</td>
                      <td className="px-3 py-2">{result.summary}</td>
                      <td className="px-3 py-2 text-[#6b778c]">{result.assignee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded border border-dashed border-[#c1c7d0] bg-[#f7f8fa] px-4 py-6 text-sm text-[#6b778c]">
              {queryMessage ?? "Run a JQL query to populate this table."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function JqlLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/45 px-4 backdrop-blur-[2px]" role="status" aria-live="polite">
      <div className="flex min-h-[132px] w-full max-w-[360px] flex-col items-center justify-center rounded border border-[#3b4454] bg-[#202328] px-6 py-5 text-center text-[#dfe1e6] shadow-2xl">
        <Loader2 className="mb-3 animate-spin text-[#85b8ff]" size={30} />
        <div className="text-sm font-semibold text-[#f4f5f7]">Running JQL query</div>
        <p className="mt-1 text-xs leading-relaxed text-[#aeb3bd]">Fetching Jira issues and refreshing the results table.</p>
      </div>
    </div>
  );
}
