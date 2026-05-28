import { Link2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, IssueTypeBadge, SyncBadge } from "../../components/ui";
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
    () => getAvailableIssueRelationshipTargets(trayTasks, task.id),
    [task.id, trayTasks]
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
          <div className="space-y-2">
            {relationships.map((relationship) => (
              <RelationshipRow
                key={relationship.id}
                relationship={relationship}
                targetTask={findIssueRelationshipTarget(trayTasks, relationship)}
                readOnly={readOnly}
                onRemove={() => removeRelationship(relationship.id)}
              />
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
              <select
                aria-label="Relationship type"
                className="h-9 rounded border border-[#5c606a] bg-[#1f2126] px-2 text-sm text-[#f4f5f7] outline-none focus:border-[#85b8ff]"
                onChange={(event) => setRelationshipType(event.target.value as IssueRelationshipType)}
                value={relationshipType}
              >
                {issueRelationshipTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatIssueRelationshipTypeLabel(type)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Relationship target"
                className="h-9 min-w-0 rounded border border-[#5c606a] bg-[#1f2126] px-2 text-sm text-[#f4f5f7] outline-none focus:border-[#85b8ff]"
                disabled={!availableTargets.length}
                onChange={(event) => setTargetTaskId(event.target.value)}
                value={targetTaskId}
              >
                {availableTargets.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {formatIssueRelationshipTargetLabel(candidate)}
                  </option>
                ))}
              </select>
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

function RelationshipRow({
  relationship,
  targetTask,
  readOnly,
  onRemove
}: {
  relationship: LocalIssueRelationship;
  targetTask: LocalTask | null;
  readOnly: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded border border-[#454852] bg-[#22252a] px-3 py-2 text-sm text-[#dfe1e6]">
      <span className="shrink-0 rounded bg-[#352c63] px-2 py-1 text-xs font-medium text-[#c0b6f2]">
        {formatIssueRelationshipTypeLabel(relationship.type)}
      </span>
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
