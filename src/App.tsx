import {
  Archive,
  Bot,
  Bug,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Copy,
  Database,
  Download,
  EyeOff,
  FileText,
  Filter,
  FlaskConical,
  FolderKanban,
  History,
  Image,
  KeyRound,
  Layers3,
  Link2,
  Loader2,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  Tags,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { areas, jqlFavorites, jqlResults, projects, trays } from "./lib/data";
import type { Category, JqlFavorite, LocalTask, MainTab, Panel, Priority, SyncStatus, Tray } from "./lib/types";
import { cn } from "./lib/utils";

const priorities: Priority[] = ["Lowest", "Low", "Medium", "High", "Highest"];

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("trays");
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>("ltask-timer");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState(jqlFavorites[0]?.id);
  const [jqlMode, setJqlMode] = useState<"direct" | "ai">("ai");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("dark");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  const selectedTray = useMemo(
    () => trays.find((tray) => tray.id === selectedTrayId) ?? null,
    [selectedTrayId]
  );

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return trays.flatMap((tray) => tray.tasks).find((task) => task.id === selectedTaskId) ?? null;
  }, [selectedTaskId]);

  useEffect(() => {
    if (openPanel !== "detail") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openPanel]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updatePreference = () => setSystemPrefersDark(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const resolvedTheme = themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : themeMode;

  function openTask(task: LocalTask) {
    setSelectedTaskId(task.id);
    setOpenPanel("detail");
  }

  function openTray(tray: Tray) {
    setSelectedTrayId(tray.id);
    setActiveTab("trays");
    const firstTask = tray.tasks[0];
    if (firstTask) setSelectedTaskId(firstTask.id);
  }

  return (
    <div className={cn("min-h-screen bg-[#f7f8fa] text-[#172b4d]", resolvedTheme === "dark" && "theme-dark")}>
      <div className="flex min-h-screen">
        <main className="flex min-w-0 flex-1 flex-col">
          <AppHeader activeTab={activeTab} setActiveTab={setActiveTab} openPanel={setOpenPanel} />
          {activeTab === "trays" ? (
            <TraysView
              selectedTray={selectedTray}
              onOpenTray={openTray}
              onBackToSelector={() => setSelectedTrayId(null)}
              onOpenTask={openTask}
            />
          ) : (
            <JqlView
              jqlMode={jqlMode}
              setJqlMode={setJqlMode}
              selectedFavoriteId={selectedFavoriteId}
              setSelectedFavoriteId={setSelectedFavoriteId}
            />
          )}
        </main>

        {openPanel === "detail" && selectedTask ? (
          <TaskFocusWindow task={selectedTask} onClose={() => setOpenPanel(null)} />
        ) : null}
        {openPanel === "categories" ? <CategoriesPanel onClose={() => setOpenPanel(null)} /> : null}
        {openPanel === "settings" ? (
          <SettingsPanel themeMode={themeMode} setThemeMode={setThemeMode} onClose={() => setOpenPanel(null)} />
        ) : null}
      </div>
    </div>
  );
}

function AppHeader({
  activeTab,
  setActiveTab,
  openPanel
}: {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  openPanel: (panel: Panel) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#dfe1e6] bg-white">
      <div className="flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#0052cc] text-white">
            <FlaskConical size={17} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Jira Task Forge</div>
            <div className="text-xs text-[#6b778c]">Local-first Jira preparation</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TopChip icon={<Tags size={14} />} label="Categories" onClick={() => openPanel("categories")} />
          <TopChip icon={<Settings size={14} />} label="Settings" onClick={() => openPanel("settings")} />
        </div>
      </div>
      <nav className="flex h-10 items-end gap-1 px-5">
        <TabButton active={activeTab === "trays"} onClick={() => setActiveTab("trays")}>
          Trays
        </TabButton>
        <TabButton active={activeTab === "jql"} onClick={() => setActiveTab("jql")}>
          JQL
        </TabButton>
      </nav>
    </header>
  );
}

function TraysView({
  selectedTray,
  onOpenTray,
  onBackToSelector,
  onOpenTask
}: {
  selectedTray: Tray | null;
  onOpenTray: (tray: Tray) => void;
  onBackToSelector: () => void;
  onOpenTask: (task: LocalTask) => void;
}) {
  if (!selectedTray) {
    return <TraySelector onOpenTray={onOpenTray} />;
  }

  const grouped = groupTasksByProject(selectedTray.tasks);

  return (
    <section className="flex-1 px-5 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <button className="mb-1 text-xs font-medium text-[#0052cc] hover:underline" onClick={onBackToSelector}>
            Back to tray selector
          </button>
          <div className="flex items-center gap-2">
            <input
              className="h-8 w-[340px] rounded border border-transparent bg-transparent px-1 text-xl font-semibold outline-none hover:border-[#dfe1e6] focus:border-[#4c9aff] focus:bg-white"
              defaultValue={selectedTray.name}
            />
            <TrayStateBadge state={selectedTray.state} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Download size={14} />}>
            Export CSV
          </Button>
          <Button variant="secondary" icon={<Archive size={14} />}>
            Archive
          </Button>
          <Button icon={<UploadCloud size={14} />}>Create in Jira</Button>
        </div>
      </div>

      <QuickCapture />

      <div className="mt-4 rounded border border-[#dfe1e6] bg-white">
        <div className="flex items-center justify-between border-b border-[#dfe1e6] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Preparation tray</h2>
            <p className="text-xs text-[#6b778c]">Grouped by project. Created tasks stay read-only.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6b778c]">
            <span className="inline-flex items-center gap-1">
              <Loader2 size={13} /> Sync ready
            </span>
            <Button variant="ghost" icon={<Filter size={14} />}>
              Review order
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-4">
          {Object.entries(grouped).map(([project, tasks]) => (
            <ProjectTaskGroup key={project} project={project} tasks={tasks} onOpenTask={onOpenTask} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TraySelector({ onOpenTray }: { onOpenTray: (tray: Tray) => void }) {
  const activeTrays = trays.filter((tray) => tray.state !== "Archived");

  return (
    <section className="flex-1 px-5 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Trays</h1>
          <p className="text-sm text-[#6b778c]">Open a saved tray or start a focused one.</p>
        </div>
        <Button icon={<Plus size={14} />}>New tray</Button>
      </div>

      <div className="grid gap-3">
        {activeTrays.map((tray) => (
          <button
            className="flex items-center justify-between rounded border border-[#dfe1e6] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#4c9aff] hover:bg-[#f4f8ff]"
            key={tray.id}
            onClick={() => onOpenTray(tray)}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-[#42526e]" />
                <span className="font-medium">{tray.name}</span>
                <TrayStateBadge state={tray.state} />
              </div>
              <div className="mt-1 text-xs text-[#6b778c]">{tray.summary}</div>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#6b778c]">
              <span>{tray.updatedAt}</span>
              <PanelRightOpen size={16} />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <Button variant="secondary" icon={<Archive size={14} />}>
          View archived
        </Button>
      </div>
    </section>
  );
}

function QuickCapture() {
  return (
    <div className="rounded border border-[#dfe1e6] bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FolderKanban size={16} />
          Active project
          <SelectLike value="STT" width="w-44" />
        </div>
        <span className="text-xs text-[#6b778c]">Project can be changed before adding the next group of tasks.</span>
      </div>
      <div className="grid grid-cols-[160px_1fr_150px_auto] gap-2">
        <SelectLike value="Bug" />
        <input
          className="h-9 rounded border border-[#c1c7d0] px-3 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
          placeholder="Task title"
          defaultValue=""
        />
        <SelectLike value="Medium" />
        <Button icon={<Plus size={14} />}>Add task</Button>
      </div>
    </div>
  );
}

function ProjectTaskGroup({
  project,
  tasks,
  onOpenTask
}: {
  project: string;
  tasks: LocalTask[];
  onOpenTask: (task: LocalTask) => void;
}) {
  return (
    <div className="overflow-hidden rounded border border-[#dfe1e6] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#dfe1e6] bg-[#f4f5f7] px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#42526e]">
          <Layers3 size={14} />
          {project}
        </div>
        <span className="text-xs text-[#6b778c]">{tasks.length} tasks</span>
      </div>
      <div>
      <div className="overflow-hidden bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white text-left text-xs font-semibold text-[#6b778c]">
              <th className="w-24 px-3 py-2">Area</th>
              <th className="w-20 px-3 py-2">Type</th>
              <th className="px-3 py-2">Title</th>
              <th className="w-28 px-3 py-2">Priority</th>
              <th className="w-28 px-3 py-2">Desc</th>
              <th className="w-28 px-3 py-2">Sync</th>
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                className="cursor-pointer border-t border-[#ebecf0] bg-white hover:bg-[#f4f8ff]"
                key={task.id}
                onClick={() => onOpenTask(task)}
              >
                <td className="px-3 py-2">
                  <AreaBadge area={task.area} />
                </td>
                <td className="px-3 py-2">
                  <IssueTypeBadge type={task.issueType} />
                </td>
                <td className="px-3 py-2">
                    <span className="text-left font-medium group-hover:text-[#0052cc]">
                      {task.title}
                    </span>
                  {task.jiraKey ? (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[#0052cc]">
                      <Link2 size={12} />
                      {task.jiraKey}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="px-3 py-2">
                  <DescriptionBadge status={task.descriptionStatus} />
                </td>
                <td className="px-3 py-2">
                  <SyncBadge status={task.syncStatus} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <IconButton title="Duplicate task" onClick={(event) => event.stopPropagation()}>
                      <Copy size={14} />
                    </IconButton>
                    <IconButton title="Open detail" onClick={(event) => {
                      event.stopPropagation();
                      onOpenTask(task);
                    }}>
                      <PanelRightOpen size={14} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

function JqlView({
  jqlMode,
  setJqlMode,
  selectedFavoriteId,
  setSelectedFavoriteId
}: {
  jqlMode: "direct" | "ai";
  setJqlMode: (mode: "direct" | "ai") => void;
  selectedFavoriteId: string | undefined;
  setSelectedFavoriteId: (id: string) => void;
}) {
  const selectedFavorite = jqlFavorites.find((favorite) => favorite.id === selectedFavoriteId) ?? jqlFavorites[0];

  return (
    <section className="grid flex-1 grid-cols-[280px_1fr] gap-4 px-5 py-4">
      <aside className="rounded border border-[#dfe1e6] bg-white">
        <div className="border-b border-[#dfe1e6] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Star size={15} />
            Favorites
          </div>
        </div>
        <div className="p-2">
          {jqlFavorites.map((favorite) => (
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
            defaultValue={
              jqlMode === "ai"
                ? "Show me high and highest open bugs for STT, sorted by priority"
                : selectedFavorite?.jql
            }
          />
          {jqlMode === "ai" ? (
            <div className="mt-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-[#6b778c]">
                <Bot size={14} />
                Generated JQL preview
              </div>
              <code className="text-sm text-[#172b4d]">
                project = DTS AND labels = "Bug" AND priority in (High, Highest) AND statusCategory != Done ORDER BY
                priority DESC
              </code>
            </div>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            {jqlMode === "ai" ? <Button variant="secondary" icon={<Sparkles size={14} />}>Generate JQL</Button> : null}
            <Button icon={<Search size={14} />}>Run query</Button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-2 text-sm font-semibold">Results</div>
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
                {jqlResults.map((result) => (
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
        </div>
      </div>
    </section>
  );
}

function TaskFocusWindow({ task, onClose }: { task: LocalTask; onClose: () => void }) {
  const readOnly = task.syncStatus === "Created";

  return (
    <div className="fixed inset-0 z-40 bg-[#091e42]/60 px-8 py-8 backdrop-blur-[1px]" onMouseDown={onClose}>
      <section
        className="mx-auto flex h-full max-h-[900px] w-full max-w-[1240px] overflow-hidden rounded border border-[#3b4454] bg-[#2b2d31] text-[#dfe1e6] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#454852] px-7 py-4">
            <div className="flex items-center gap-2 text-sm text-[#aeb3bd]">
              <Sparkles size={15} className="text-[#9f8fef]" />
              <span>{task.epic ?? `[${task.project}] ${task.area}`}</span>
              <span>/</span>
              <span>{task.jiraKey ?? task.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="darkGhost" icon={<Link2 size={14} />}>
                Copy link
              </Button>
              <IconButton title="Close" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-7 py-7">
            <div className="mb-5 flex items-center gap-2">
              <IssueTypeBadge type={task.issueType} dark />
              <SyncBadge status={task.syncStatus} dark />
              {readOnly ? <span className="rounded bg-[#403f46] px-2 py-1 text-xs text-[#b7bbc4]">Read-only</span> : null}
            </div>
            <h2 className="mb-4 text-2xl font-semibold leading-tight text-[#f4f5f7]">
              [{task.area}] {task.title}
            </h2>

            <FocusSection title="Description">
              {task.description ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#dfe1e6]">{task.description}</pre>
              ) : (
                <div className="text-sm text-[#aeb3bd]">
                  No final description yet.
                  {task.notes ? <div className="mt-2 text-[#dfe1e6]">{task.notes}</div> : null}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="darkSecondary" icon={<CircleAlert size={14} />}>
                  Review missing info
                </Button>
                <Button variant="darkSecondary" icon={<Sparkles size={14} />}>
                  Generate description
                </Button>
              </div>
            </FocusSection>

            <FocusSection title="Attachments" count={task.attachments?.length ?? 0}>
              {task.attachments?.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {task.attachments.map((attachment) => (
                    <div className="overflow-hidden rounded border border-[#454852] bg-[#22252a]" key={attachment.id}>
                      <div className="flex h-24 items-center justify-center bg-[#3a3d43]">
                        <Image size={24} className="text-[#aeb3bd]" />
                      </div>
                      <div className="px-3 py-2 text-xs">
                        <div className="font-medium text-[#f4f5f7]">{attachment.filename}</div>
                        <div className="text-[#aeb3bd]">{attachment.purpose} · {attachment.size}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#aeb3bd]">No attachments yet.</div>
              )}
            </FocusSection>

            <FocusSection title="Sub-tasks">
              {task.subtasks?.length ? (
                <div className="space-y-2">
                  {task.subtasks.map((subtask) => (
                    <label className="flex items-center gap-2 text-sm text-[#dfe1e6]" key={subtask}>
                      <input defaultChecked type="checkbox" />
                      {subtask}
                    </label>
                  ))}
                  <div className="mt-3 flex gap-2">
                    <Button variant="darkSecondary">Add selected</Button>
                    <Button variant="darkGhost">Discard</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#aeb3bd]">No sub-tasks proposed yet.</div>
              )}
            </FocusSection>

            <FocusSection title="Activity">
              {task.syncLog?.length ? (
                <div className="space-y-2">
                  {task.syncLog.map((entry) => (
                    <div className="rounded bg-[#22252a] p-2 text-xs" key={entry.id}>
                      <div className="font-semibold text-[#f4f5f7]">{entry.timestamp}</div>
                      <div>{entry.event}</div>
                      <div className="text-[#aeb3bd]">{entry.detail}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#aeb3bd]">No sync attempts yet.</div>
              )}
            </FocusSection>
          </div>
        </div>

        <aside className="w-[360px] overflow-y-auto border-l border-[#454852] bg-[#303238] p-5">
          <div className="mb-5 flex items-center gap-2">
            <Button variant="darkPrimary">Ready for Jira</Button>
            <Button variant="darkSecondary" icon={<Sparkles size={14} />}>
              AI
            </Button>
          </div>
          <FocusDetails task={task} />
        </aside>
      </section>
    </div>
  );
}

function FocusSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2 text-base font-semibold text-[#f4f5f7]">
        <ChevronDown size={16} />
        {title}
        {typeof count === "number" ? (
          <span className="rounded bg-[#454852] px-1.5 py-0.5 text-xs text-[#dfe1e6]">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FocusDetails({ task }: { task: LocalTask }) {
  return (
    <div className="rounded border border-[#454852]">
      <div className="flex items-center justify-between border-b border-[#454852] px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-[#f4f5f7]">
          <ChevronDown size={16} />
          Details
        </div>
        <Settings size={15} className="text-[#aeb3bd]" />
      </div>
      <div className="space-y-4 px-4 py-4 text-sm">
        <FocusDetailRow label="Project" value={task.project} />
        <FocusDetailRow label="Area" value={task.area} />
        <FocusDetailRow label="Priority" value={<PriorityBadge priority={task.priority} dark />} />
        <FocusDetailRow label="Epic" value={task.epic ?? "None"} />
        <FocusDetailRow label="Labels" value={task.area} />
        <FocusDetailRow label="Language" value={`${task.language} · inherited`} />
        <FocusDetailRow label="Description" value={<DescriptionBadge status={task.descriptionStatus} dark />} />
        <FocusDetailRow label="Sync" value={<SyncBadge status={task.syncStatus} dark />} />
        <FocusDetailRow label="Reporter" value="Simon Bahamonde" />
      </div>
    </div>
  );
}

function FocusDetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <div className="font-medium text-[#aeb3bd]">{label}</div>
      <div className="min-w-0 text-[#dfe1e6]">{value}</div>
    </div>
  );
}

function CategoriesPanel({ onClose }: { onClose: () => void }) {
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

function SettingsPanel({
  themeMode,
  setThemeMode,
  onClose
}: {
  themeMode: "light" | "dark" | "system";
  setThemeMode: (theme: "light" | "dark" | "system") => void;
  onClose: () => void;
}) {
  return (
    <aside className="fixed right-0 top-0 z-30 flex h-screen w-[420px] flex-col border-l border-[#dfe1e6] bg-white shadow-xl">
      <PanelHeader title="Settings" subtitle="Local configuration without secrets in backups" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        <DetailBlock icon={<Settings size={15} />} title="Appearance">
          <div className="mb-2 text-xs font-medium text-[#6b778c]">Theme</div>
          <SegmentedControl
            value={themeMode}
            options={[
              { label: "Dark", value: "dark" },
              { label: "Light", value: "light" },
              { label: "System", value: "system" }
            ]}
            onChange={(value) => setThemeMode(value as "light" | "dark" | "system")}
          />
        </DetailBlock>

        <DetailBlock icon={<KeyRound size={15} />} title="Jira connection">
          <Field label="Site URL" value="https://dts.atlassian.net" />
          <Field label="Auth method" value="OAuth 2.0 preferred · API token fallback" />
          <div className="mt-3">
            <Button variant="secondary">Test connection</Button>
          </div>
        </DetailBlock>

        <DetailBlock icon={<Bot size={15} />} title="AI provider">
          <Field label="Provider" value="OpenAI" />
          <Field label="Model" value="Selected in app settings" />
          <Field label="Default content language" value="Spanish" />
        </DetailBlock>

        <DetailBlock icon={<Download size={15} />} title="Backup and restore">
          <p className="mb-3 text-sm text-[#6b778c]">
            Backups include trays, descriptions, attachments, categories, epic mappings, favorites, and sync logs. Secrets are excluded.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={14} />}>
              Export backup
            </Button>
            <Button variant="secondary" icon={<UploadCloud size={14} />}>
              Import backup
            </Button>
          </div>
        </DetailBlock>
      </div>
    </aside>
  );
}

function PanelHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-[#dfe1e6] px-4 py-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-[#6b778c]">{subtitle}</p>
      </div>
      <IconButton title="Close" onClick={onClose}>
        <X size={16} />
      </IconButton>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-[#6b778c]">{label}</div>
      <div className="rounded border border-[#dfe1e6] bg-[#f7f8fa] px-2 py-1.5 text-sm">{value}</div>
    </div>
  );
}

function DetailBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded border border-[#dfe1e6] p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Button({
  children,
  icon,
  variant = "primary"
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "darkPrimary" | "darkSecondary" | "darkGhost";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 text-sm font-medium transition",
        variant === "primary" && "bg-[#0052cc] text-white hover:bg-[#0747a6]",
        variant === "secondary" && "border border-[#c1c7d0] bg-white text-[#172b4d] hover:bg-[#f4f5f7]",
        variant === "ghost" && "text-[#42526e] hover:bg-[#f4f5f7]",
        variant === "darkPrimary" && "bg-[#0c66e4] text-white hover:bg-[#0052cc]",
        variant === "darkSecondary" && "border border-[#5c606a] bg-[#303238] text-[#dfe1e6] hover:bg-[#3a3d43]",
        variant === "darkGhost" && "text-[#dfe1e6] hover:bg-[#3a3d43]"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function IconButton({
  children,
  title,
  onClick
}: {
  children: React.ReactNode;
  title: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] hover:bg-[#ebecf0] hover:text-[#172b4d]"
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TopChip({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#dfe1e6] bg-white px-3 text-xs font-medium text-[#42526e] hover:bg-[#f4f5f7]"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={cn(
        "h-9 border-b-2 px-3 text-sm font-medium",
        active ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-[#42526e] hover:text-[#172b4d]"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SelectLike({ value, width = "w-full" }: { value: string; width?: string }) {
  return (
    <button className={cn("flex h-9 items-center justify-between rounded border border-[#c1c7d0] bg-white px-3 text-sm", width)}>
      <span>{value}</span>
      <ChevronDown size={14} className="text-[#6b778c]" />
    </button>
  );
}

function SegmentedControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded border border-[#c1c7d0] bg-[#f4f5f7] p-0.5">
      {options.map((option) => (
        <button
          className={cn(
            "h-7 rounded px-3 text-xs font-medium",
            value === option.value ? "bg-white text-[#172b4d] shadow-sm" : "text-[#42526e]"
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AreaBadge({ area }: { area: string }) {
  return <span className="rounded bg-[#deebff] px-2 py-1 text-xs font-medium text-[#0747a6]">{area}</span>;
}

function IssueTypeBadge({ type, dark = false }: { type: string; dark?: boolean }) {
  const icon = type === "Bug" ? <Bug size={12} /> : type === "Epic" ? <Sparkles size={12} /> : <ClipboardList size={12} />;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
        dark ? "bg-[#454852] text-[#dfe1e6]" : "bg-[#f4f5f7] text-[#42526e]"
      )}
    >
      {icon}
      {type}
    </span>
  );
}

function PriorityBadge({ priority, dark = false }: { priority: Priority; dark?: boolean }) {
  const classes: Record<Priority, string> = {
    Lowest: "bg-[#f4f5f7] text-[#6b778c]",
    Low: "bg-[#e3fcef] text-[#006644]",
    Medium: "bg-[#deebff] text-[#0747a6]",
    High: "bg-[#fff0b3] text-[#974f0c]",
    Highest: "bg-[#ffebe6] text-[#bf2600]"
  };
  const darkClasses: Record<Priority, string> = {
    Lowest: "bg-[#454852] text-[#aeb3bd]",
    Low: "bg-[#183f2e] text-[#7ee2a8]",
    Medium: "bg-[#1d3b66] text-[#85b8ff]",
    High: "bg-[#533f04] text-[#f5cd47]",
    Highest: "bg-[#5d1f1a] text-[#ff9c8f]"
  };
  return <span className={cn("rounded px-2 py-1 text-xs font-medium", dark ? darkClasses[priority] : classes[priority])}>{priority}</span>;
}

function SyncBadge({ status, dark = false }: { status: SyncStatus; dark?: boolean }) {
  const classes: Record<SyncStatus, string> = {
    Pending: "bg-[#f4f5f7] text-[#42526e]",
    Failed: "bg-[#ffebe6] text-[#bf2600]",
    Exported: "bg-[#fff0b3] text-[#974f0c]",
    Created: "bg-[#e3fcef] text-[#006644]"
  };
  const darkClasses: Record<SyncStatus, string> = {
    Pending: "bg-[#454852] text-[#dfe1e6]",
    Failed: "bg-[#5d1f1a] text-[#ff9c8f]",
    Exported: "bg-[#533f04] text-[#f5cd47]",
    Created: "bg-[#183f2e] text-[#7ee2a8]"
  };
  return <span className={cn("rounded px-2 py-1 text-xs font-medium", dark ? darkClasses[status] : classes[status])}>{status}</span>;
}

function DescriptionBadge({ status, dark = false }: { status: "Ready" | "Missing" | "Draft"; dark?: boolean }) {
  if (status === "Ready") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
          dark ? "bg-[#183f2e] text-[#7ee2a8]" : "bg-[#e3fcef] text-[#006644]"
        )}
      >
        <CheckCircle2 size={12} />
        Ready
      </span>
    );
  }
  if (status === "Draft") {
    return <span className={cn("rounded px-2 py-1 text-xs font-medium", dark ? "bg-[#533f04] text-[#f5cd47]" : "bg-[#fff0b3] text-[#974f0c]")}>Draft</span>;
  }
  return <span className={cn("rounded px-2 py-1 text-xs font-medium", dark ? "bg-[#454852] text-[#aeb3bd]" : "bg-[#f4f5f7] text-[#6b778c]")}>Missing</span>;
}

function TrayStateBadge({ state }: { state: string }) {
  return <span className="rounded bg-[#f4f5f7] px-2 py-1 text-xs font-medium text-[#42526e]">{state}</span>;
}

function groupTasksByProject(tasks: LocalTask[]) {
  return tasks.reduce<Record<string, LocalTask[]>>((groups, task) => {
    groups[task.project] ??= [];
    groups[task.project].push(task);
    return groups;
  }, {});
}
