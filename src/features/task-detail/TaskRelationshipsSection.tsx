import { Check, ChevronDown, Link2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, IssueTypeBadge, SyncBadge, useListboxDropdown } from "../../components/ui";
import {
  addLocalIssueRelationship,
  findIssueRelationshipTarget,
  formatIssueRelationshipTargetLabel,
  formatIssueRelationshipTypeLabel,
  getAvailableIssueRelationshipTargets,
  issueRelationshipTypes,
  removeLocalIssueRelationship
} from "../../lib/domain/issueRelationships";
import type { IssueRelationshipType, LocalIssueRelationship, LocalTask } from "../../lib/types";
import { TaskFocusSection } from "./TaskFocusSection";

export function TaskRelationshipsSection({
  task,
  trayTasks,
  readOnly,
  onUpdateRelationships
}: {
  task: LocalTask;
  trayTasks: LocalTask[];
  readOnly: boolean;
  onUpdateRelationships: (taskId: string, relationships: LocalIssueRelationship[]) => void | Promise<void>;
}) {
  const relationships = task.issueRelationships ?? [];
  const availableTargets = useMemo(
    () => getAvailableIssueRelationshipTargets(trayTasks, task.id, relationships),
    [relationships, task.id, trayTasks]
  );
  const relationshipGroups = useMemo(
    () =>
      relationshipGroupOrder
        .map((type) => ({
          type,
          relationships: relationships.filter((relationship) => relationship.type === type)
        }))
        .filter((group) => group.relationships.length > 0),
    [relationships]
  );
  const targetOptions = useMemo(
    () =>
      availableTargets.map((candidate) => ({
        value: candidate.id,
        label: formatIssueRelationshipTargetLabel(candidate)
      })),
    [availableTargets]
  );
  const [relationshipType, setRelationshipType] = useState<IssueRelationshipType>("blocks");
  const [targetTaskId, setTargetTaskId] = useState(availableTargets[0]?.id ?? "");

  useEffect(() => {
    setRelationshipType("blocks");
    setTargetTaskId(availableTargets[0]?.id ?? "");
  }, [availableTargets, task.id]);

  const hasDuplicateRelationship = relationships.some(
    (relationship) => relationship.type === relationshipType && relationship.targetTaskId === targetTaskId
  );
  const canAddRelationship = !readOnly && Boolean(targetTaskId) && !hasDuplicateRelationship;

  function addRelationship() {
    if (!canAddRelationship) return;
    void onUpdateRelationships(task.id, addLocalIssueRelationship(task, relationshipType, targetTaskId));
  }

  function removeRelationship(relationshipId: string) {
    if (readOnly) return;
    void onUpdateRelationships(task.id, removeLocalIssueRelationship(relationships, relationshipId));
  }

  return (
    <TaskFocusSection title="Issue relationships" count={relationships.length}>
      <div className="space-y-3">
        {relationships.length ? (
          <div className="space-y-3">
            {relationshipGroups.map((group) => (
              <div className="space-y-2" data-relationship-group={group.type} key={group.type}>
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-[#aeb3bd]">
                  <span>{formatIssueRelationshipTypeLabel(group.type)}</span>
                  <span className="rounded bg-[#454852] px-2 py-0.5 text-[#dfe1e6]">{group.relationships.length}</span>
                </div>
                {group.relationships.map((relationship) => (
                  <RelationshipRow
                    key={relationship.id}
                    targetTask={findIssueRelationshipTarget(trayTasks, relationship)}
                    readOnly={readOnly}
                    onRemove={() => removeRelationship(relationship.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border border-dashed border-[#454852] bg-[#22252a]/60 px-3 py-3 text-sm text-[#aeb3bd]">
            No local issue relationships yet.
          </div>
        )}

        {!readOnly ? (
          <div className="rounded border border-[#454852] bg-[#22252a] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[#aeb3bd]">
              <Link2 size={13} />
              Local Jira link intent
            </div>
            <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
              <RelationshipSelect
                aria-label="Relationship type"
                options={issueRelationshipTypes.map((type) => ({
                  value: type,
                  label: formatIssueRelationshipTypeLabel(type)
                }))}
                onChange={(value) => setRelationshipType(value as IssueRelationshipType)}
                value={relationshipType}
              />
              <RelationshipSelect
                aria-label="Relationship target"
                disabled={!availableTargets.length}
                emptyLabel="No available tasks"
                options={targetOptions}
                onChange={setTargetTaskId}
                value={targetTaskId}
              />
              <Button disabled={!canAddRelationship} icon={<Plus size={14} />} variant="darkSecondary" onClick={addRelationship}>
                Add
              </Button>
            </div>
            <div className="mt-2 text-xs text-[#8f96a3]">
              Draft only. Jira sync does not send these links yet.
            </div>
          </div>
        ) : null}
      </div>
    </TaskFocusSection>
  );
}

const relationshipGroupOrder: IssueRelationshipType[] = ["blocked_by", "blocks"];

function RelationshipSelect({
  "aria-label": ariaLabel,
  disabled = false,
  emptyLabel = "Select an option",
  options,
  value,
  onChange
}: {
  "aria-label": string;
  disabled?: boolean;
  emptyLabel?: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const selectedLabel = selectedOption?.label ?? emptyLabel;
  const optionValues = options.map((option) => option.value);
  const listbox = useListboxDropdown({
    disabled: disabled || !options.length,
    onChange,
    options: optionValues,
    value
  });

  return (
    <div className="relative min-w-0" ref={listbox.containerRef}>
      <button
        aria-label={ariaLabel}
        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded border border-[#5c606a] bg-[#1f2126] px-3 text-left text-sm text-[#f4f5f7] outline-none transition hover:bg-[#2b2d31] focus:border-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || !options.length}
        onClick={listbox.toggleMenu}
        title={selectedLabel}
        type="button"
        {...listbox.buttonProps}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown size={15} className="shrink-0 text-[#dfe1e6]" />
      </button>

      {listbox.isOpen ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-60 w-full min-w-0 overflow-y-auto overscroll-contain rounded border border-[#5c606a] bg-[#2b2d31] py-1 text-sm text-[#f4f5f7] shadow-xl"
          {...listbox.listboxProps}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                className={`flex h-8 w-full min-w-0 items-center justify-between gap-2 px-3 text-left hover:bg-[#1d355c] ${
                  isSelected ? "bg-[#0c66e4] text-white" : "text-[#dfe1e6]"
                }`}
                key={option.value}
                title={option.label}
                type="button"
                {...listbox.getOptionProps(option.value)}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected ? <Check size={14} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RelationshipRow({
  targetTask,
  readOnly,
  onRemove
}: {
  targetTask: LocalTask | null;
  readOnly: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded border border-[#454852] bg-[#22252a] px-3 py-2 text-sm text-[#dfe1e6]">
      {targetTask ? (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-[#f4f5f7]" title={targetTask.title}>
              {targetTask.title || "(untitled)"}
            </div>
            <div className="truncate text-xs text-[#8f96a3]">
              {[targetTask.project || "No project", targetTask.area || "No area"].join(" · ")}
            </div>
          </div>
          <IssueTypeBadge type={targetTask.issueType} dark />
          <SyncBadge status={targetTask.syncStatus} dark />
          {targetTask.jiraKey ? <span className="shrink-0 text-xs font-medium text-[#85b8ff]">{targetTask.jiraKey}</span> : null}
        </>
      ) : (
        <div className="min-w-0 flex-1 text-[#ffb4a8]">Missing local target task</div>
      )}
      {!readOnly ? (
        <button
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#aeb3bd] hover:bg-[#3a3d43] hover:text-[#ffb4a8]"
          onClick={onRemove}
          title="Remove relationship"
          type="button"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}
