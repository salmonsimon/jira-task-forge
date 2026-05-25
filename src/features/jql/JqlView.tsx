import { Bot, Check, History, Loader2, Pencil, Search, Star, X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Button, IssueTypeBadge, PriorityBadge, SegmentedControl } from "../../components/ui";
import type { JqlFavorite, JqlRecentQuery, JqlResult, JqlRunState } from "../../lib/types";
import { cn } from "../../lib/utils";

export function JqlView({
  jqlMode,
  setJqlMode,
  selectedFavoriteId,
  setSelectedFavoriteId,
  favorites,
  recentQueries,
  onSaveFavorite,
  onRenameFavorite,
  onDeleteFavorite,
  onSelectRecent,
  results,
  runState,
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
  recentQueries: JqlRecentQuery[];
  onSaveFavorite: () => void | Promise<void>;
  onRenameFavorite: (favoriteId: string, name: string) => void | Promise<void>;
  onDeleteFavorite: (favoriteId: string) => void | Promise<void>;
  onSelectRecent: (recentQuery: JqlRecentQuery) => void;
  results: JqlResult[];
  runState: JqlRunState;
  jqlQuery: string;
  setJqlQuery: (query: string) => void;
  jqlPrompt: string;
  setJqlPrompt: (prompt: string) => void;
  generatedJqlPreview: string;
  onRunQuery: () => void;
  isRunningQuery: boolean;
  queryMessage: string | null;
}) {
  const selectedFavorite = favorites.find((favorite) => favorite.id === selectedFavoriteId);
  const isAskAiMode = jqlMode === "ai";
  const currentQueryFavorite = isAskAiMode ? undefined : favorites.find((favorite) => favorite.jql.trim() === jqlQuery.trim());

  function handleRunShortcut(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented) return;
    if (!isAskAiMode && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      onRunQuery();
    }
  }

  return (
    <section className="grid flex-1 grid-cols-[280px_1fr] gap-4 px-5 py-4" onKeyDown={handleRunShortcut}>
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
            <FavoriteListItem
              favorite={favorite}
              key={favorite.id}
              selected={selectedFavorite?.id === favorite.id}
              onRenameFavorite={onRenameFavorite}
              onDeleteFavorite={onDeleteFavorite}
              onSelect={() => setSelectedFavoriteId(favorite.id)}
            />
          ))}
        </div>
        <div className="border-t border-[#dfe1e6] px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <History size={15} />
            Recent
          </div>
          {recentQueries.length ? (
            <div className="space-y-1">
              {recentQueries.map((recentQuery) => (
                <RecentQueryItem
                  key={recentQuery.id}
                  recentQuery={recentQuery}
                  onSelect={() => onSelectRecent(recentQuery)}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#6b778c]">No recent queries this session</div>
          )}
        </div>
      </aside>

      <div className="min-w-0 rounded border border-[#dfe1e6] bg-white">
        <div className="flex items-center justify-between border-b border-[#dfe1e6] px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">JQL</h1>
            <p className="text-xs text-[#6b778c]">Run direct JQL now. Ask AI is coming later.</p>
          </div>
          <Button
            variant="secondary"
            disabled={isAskAiMode}
            icon={<Star className={currentQueryFavorite ? "fill-current" : undefined} size={14} />}
            onClick={() => {
              if (isAskAiMode) return;
              if (currentQueryFavorite) {
                void onDeleteFavorite(currentQueryFavorite.id);
                return;
              }
              void onSaveFavorite();
            }}
          >
            {currentQueryFavorite ? "Unsave favorite" : "Save favorite"}
          </Button>
        </div>

        <div className="border-b border-[#dfe1e6] p-4">
          <SegmentedControl
            value={jqlMode}
            options={[
              { label: "Ask AI (soon)", value: "ai" },
              { label: "Direct JQL", value: "direct" }
            ]}
            onChange={(value) => setJqlMode(value as "ai" | "direct")}
          />
          {isAskAiMode ? (
            <div className="mt-3 rounded border border-dashed border-[#c1c7d0] bg-[#f7f8fa] px-4 py-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#dfe1e6] bg-white text-[#6b778c]">
                  <Bot size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#172b4d]">Ask AI is not available yet</div>
                  <p className="mt-1 max-w-[560px] text-xs leading-relaxed text-[#6b778c]">
                    Use Direct JQL to search Jira issues. AI-assisted query drafting will be wired in a later slice.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <textarea
                className="mt-3 h-24 w-full resize-none rounded border border-[#c1c7d0] p-3 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
                value={jqlQuery}
                onChange={(event) => setJqlQuery(event.target.value)}
                onKeyDown={handleRunShortcut}
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 text-xs leading-relaxed text-[#6b778c]">{queryMessage}</div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
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
            </>
          )}
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
            <JqlResultsEmptyState queryMessage={queryMessage} runState={runState} />
          )}
        </div>
      </div>
    </section>
  );
}

function JqlResultsEmptyState({
  queryMessage,
  runState
}: {
  queryMessage: string | null;
  runState: JqlRunState;
}) {
  const copyByState: Record<JqlRunState, { title: string; detail?: string }> = {
    idle: {
      title: "Run a JQL query to populate this table."
    },
    running: {
      title: "Running JQL query..."
    },
    success: {
      title: "No issues matched this JQL query.",
      detail: queryMessage ?? undefined
    },
    error: {
      title: "JQL query failed.",
      detail: queryMessage ?? undefined
    }
  };
  const copy = copyByState[runState];

  return (
    <div className="rounded border border-dashed border-[#c1c7d0] bg-[#f7f8fa] px-4 py-6 text-sm text-[#6b778c]">
      <div className="font-medium text-[#172b4d]">{copy.title}</div>
      {copy.detail ? <div className="mt-1 text-xs leading-relaxed">{copy.detail}</div> : null}
    </div>
  );
}

function RecentQueryItem({
  recentQuery,
  onSelect
}: {
  recentQuery: JqlRecentQuery;
  onSelect: () => void;
}) {
  return (
    <button
      className="block w-full rounded px-2 py-2 text-left hover:bg-[#f4f8ff] focus:outline-none focus:ring-2 focus:ring-[#4c9aff]"
      onClick={onSelect}
      type="button"
    >
      <div className="truncate text-xs font-medium text-[#172b4d]">{recentQuery.jql}</div>
      <div className="mt-1 text-[11px] text-[#6b778c]">{formatRecentQueryMeta(recentQuery)}</div>
    </button>
  );
}

function formatRecentQueryMeta(recentQuery: JqlRecentQuery) {
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(recentQuery.ranAt));

  if (recentQuery.status === "error") return `Error · ${time}`;

  const resultCount = recentQuery.resultCount ?? 0;
  return `${resultCount} ${resultCount === 1 ? "result" : "results"} · ${time}`;
}

function FavoriteListItem({
  favorite,
  selected,
  onRenameFavorite,
  onDeleteFavorite,
  onSelect
}: {
  favorite: JqlFavorite;
  selected: boolean;
  onRenameFavorite: (favoriteId: string, name: string) => void | Promise<void>;
  onDeleteFavorite: (favoriteId: string) => void | Promise<void>;
  onSelect: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(favorite.name);

  useEffect(() => {
    if (!isEditing) setDraftName(favorite.name);
  }, [favorite.name, isEditing]);

  function beginEditing(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setDraftName(favorite.name);
    setIsEditing(true);
  }

  function cancelEditing(event?: ReactMouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    setDraftName(favorite.name);
    setIsEditing(false);
  }

  function acceptEditing() {
    const nextName = draftName.trim();
    if (nextName && nextName !== favorite.name) {
      void onRenameFavorite(favorite.id, nextName);
    }
    setIsEditing(false);
  }

  return (
    <div
      className={cn(
        "group mb-1 w-full rounded px-3 py-2 text-left hover:bg-[#f4f8ff]",
        selected && "bg-[#deebff]"
      )}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {isEditing ? (
          <input
            autoFocus
            className="h-7 min-w-0 flex-1 rounded border border-[#4c9aff] bg-white px-2 text-sm font-medium outline-none ring-2 ring-[#deebff]"
            value={draftName}
            onBlur={acceptEditing}
            onChange={(event) => setDraftName(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") acceptEditing();
              if (event.key === "Escape") cancelEditing();
            }}
          />
        ) : (
          <div className="min-w-0 flex-1 truncate text-sm font-medium">{favorite.name}</div>
        )}
        {isEditing ? (
          <>
            <button
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#42526e] hover:bg-[#ebecf0]"
              onClick={(event) => {
                event.stopPropagation();
                acceptEditing();
              }}
              type="button"
            >
              <Check size={12} />
            </button>
            <button
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#42526e] hover:bg-[#ebecf0]"
              onClick={cancelEditing}
              type="button"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <button
              aria-label={`Remove favorite ${favorite.name}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#ffab00] transition hover:bg-[#ebecf0] hover:text-[#ffab00]"
              onClick={(event) => {
                event.stopPropagation();
                void onDeleteFavorite(favorite.id);
              }}
              type="button"
            >
              <Star className="fill-current" size={12} />
            </button>
            <button
              aria-label={`Rename favorite ${favorite.name}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#6b778c] opacity-0 transition hover:bg-[#ebecf0] hover:text-[#172b4d] group-hover:opacity-100 focus:opacity-100"
              onClick={beginEditing}
              type="button"
            >
              <Pencil size={12} />
            </button>
          </>
        )}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-[#6b778c]">{favorite.jql}</div>
    </div>
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
