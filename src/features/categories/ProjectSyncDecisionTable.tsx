import { Check } from "lucide-react";
import type { ProjectSyncCandidate, ProjectSyncReview } from "../../lib/types";

export function mergeProjectSyncCandidates(review: ProjectSyncReview) {
  const merged = new Map<string, ProjectSyncCandidate>();
  for (const candidate of [
    ...review.sections.active,
    ...review.sections.newlyAvailable,
    ...review.sections.ignored,
    ...review.sections.archived
  ]) {
    merged.set(candidate.normalizedName, candidate);
  }
  return Array.from(merged.values()).sort((left, right) => {
    if (left.normalizedName === "transversal") return -1;
    if (right.normalizedName === "transversal") return 1;
    return left.name.localeCompare(right.name);
  });
}

export function ProjectSyncDecisionTable({
  candidates,
  activeNames,
  maxVisibleRows,
  onChange
}: {
  candidates: ProjectSyncCandidate[];
  activeNames: Set<string>;
  maxVisibleRows?: number;
  onChange: (candidate: ProjectSyncCandidate, checked: boolean) => void;
}) {
  const visibleCandidates = candidates.filter((candidate) => candidate.normalizedName !== "transversal");
  const visibleRows = maxVisibleRows && maxVisibleRows > 0 ? maxVisibleRows : visibleCandidates.length;
  const shouldScroll = visibleCandidates.length > visibleRows;
  const tableStyle = shouldScroll ? { maxHeight: `${visibleRows * 44}px` } : undefined;

  return (
    <div className="overflow-hidden rounded border border-[#dfe1e6] bg-white">
      <div className={shouldScroll ? "overflow-y-auto" : undefined} style={tableStyle}>
        {visibleCandidates.map((candidate) => (
          <ProjectSyncDecisionRow activeNames={activeNames} candidate={candidate} key={candidate.normalizedName} onChange={onChange} />
        ))}
      </div>
      {shouldScroll ? (
        <div className="border-t border-[#ebecf0] bg-[#f7f8fa] px-3 py-1.5 text-xs text-[#6b778c]">
          Showing {visibleRows} of {visibleCandidates.length} Projects. Scroll to review the rest.
        </div>
      ) : null}
    </div>
  );
}

function ProjectSyncDecisionRow({
  candidate,
  activeNames,
  onChange
}: {
  candidate: ProjectSyncCandidate;
  activeNames: Set<string>;
  onChange: (candidate: ProjectSyncCandidate, checked: boolean) => void;
}) {
  const isTransversal = candidate.normalizedName === "transversal";
  const isActive = isTransversal || activeNames.has(candidate.name);
  const stateLabel = isActive ? "Active" : candidate.status === "archived" ? "Archived" : "Ignored";
  const sourceLabel = candidate.willPromoteLocal ? "Local" : "Jira";

  return (
    <button
      aria-pressed={isActive}
      className="group grid min-h-11 w-full grid-cols-[minmax(0,1fr)_124px_36px] items-center gap-3 border-b border-[#ebecf0] px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-[#f4f8ff] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#deebff] disabled:cursor-default disabled:hover:bg-white"
      disabled={isTransversal}
      onClick={() => onChange(candidate, !isActive)}
      type="button"
    >
      <span className="min-w-0 truncate font-medium text-[#172b4d]">{candidate.name}</span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-xs">
        <span className="truncate text-[#6b778c]">{sourceLabel}</span>
        <span className={`inline-flex h-5 shrink-0 items-center rounded px-2 font-medium ${isActive ? "bg-[#deebff] text-[#0747a6]" : "border border-[#b6c2cf] bg-transparent text-[#6b778c]"}`}>
          {stateLabel}
        </span>
      </span>
      <span
        className={`justify-self-end inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
          isActive ? "border-[#0c66e4] bg-[#0c66e4] text-white" : "border-[#b6c2cf] bg-white text-transparent group-hover:border-[#85b8ff]"
        }`}
      >
        <Check size={16} strokeWidth={3} />
      </span>
    </button>
  );
}
