import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/shell";
import { CategoriesPanel } from "./features/categories";
import { JqlView } from "./features/jql";
import { SettingsPanel } from "./features/settings";
import { TaskFocusWindow } from "./features/task-detail";
import { TraysView } from "./features/trays";
import { jqlFavorites, trays } from "./lib/data";
import type { LocalTask, MainTab, Panel, Tray } from "./lib/types";
import { cn } from "./lib/utils";

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
