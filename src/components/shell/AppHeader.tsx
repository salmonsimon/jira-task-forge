import { FlaskConical, Settings, Tags } from "lucide-react";
import type { MainTab, Panel } from "../../lib/types";
import { TabButton, TopChip } from "../ui";

export function AppHeader({
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
