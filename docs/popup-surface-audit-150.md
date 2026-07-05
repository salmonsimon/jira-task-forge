# Popup Surface Audit for Issue #150

Status: audit-only slice. No visual standard has been selected or implemented. Final standard remains awaiting Saimon HITL choice.

Worktree preflight:
- Source checkout: `/home/saimon/Development/jira-task-forge` on `main`, clean.
- Worktree path: `/home/saimon/Development/jira-task-forge-popup-audit`
- Branch: `codex/popup-surface-audit-150`
- The branch was fast-forwarded from `main` at `954cf758bf611a982ff9054093f00469761bcfe0`.
- Existing untracked audit content was rescued and reconciled into this file.

Issue source:
- Related Issue #150: standardize app popups and modal surfaces.
- This file covers the requested audit-first slice only. The broader implementation acceptance criteria still require Saimon HITL pattern choice, shared component work, migration, and visual QA of migrated surfaces.

Visual evidence:
- Screenshot capture should use repo-local tooling only, such as Vite plus Playwright from the project dev dependencies.
- Static code inspection below identifies the reachable surfaces and observed focus/Escape/backdrop behavior from current source.
- Final screenshot status for this branch is recorded near the end of the file.

## Shared Overlay Stack

Source: `src/lib/app-overlays.ts`

- Layers: side panel 30, focused task 40, modal 50, notice 60, centered notice 65, nested modal 70.
- Only the topmost registered overlay can dismiss from Escape, backdrop, or outside pointer.
- Scroll lock is global when any registered overlay sets `lockScroll`.
- Most modal-like surfaces use `useAppOverlay`, but several dropdowns and the categories sync notice use local `mousedown`/`pointerdown` handling.

## Side Panels

Settings sidebar:
- Source: `src/features/settings/SettingsPanel.tsx`
- Pattern: right fixed `aside`, 420px wide, white surface, no visible backdrop.
- Behavior from code: `dismissOnEscape: true`, `dismissOnOutsidePointer: true`, `lockScroll: true` through `useAppOverlay`.
- Nested surfaces: Jira connection guide and Notion synchronization guide render as centered nested modals over the sidebar.

Categories sidebar:
- Source: `src/features/categories/CategoriesPanel.tsx`
- Pattern: right fixed `aside`, 420px wide, white surface, no visible backdrop.
- Behavior from code: hand-rolled outside `pointerdown` closes; hand-rolled Escape closes. It does not register with `useAppOverlay`, so it does not participate in overlay stack ordering or scroll locking.
- Nested surface: catalog sync notice is a centered modal-like surface rendered inside the sidebar component.

Task focus window:
- Source: `src/features/task-detail/TaskFocusWindow.tsx`
- Pattern: full-screen dark backdrop, centered wide floating work surface, max width 1240px.
- Behavior from code: `dismissOnEscape: true`, `dismissOnBackdrop: true`, `lockScroll: true`; Escape is intentionally ignored when focus is inside assisted description editors.
- Nested surfaces: description prompt modal and proposal review modal.

## Centered Modals and Dialogs

Jira connection guide:
- Source: `src/features/settings/JiraConnectionGuide.tsx`
- Pattern: centered white wizard, max width 800px, stepper header, nested over Settings.
- Behavior from code: `dismissOnEscape: true`, `dismissOnOutsidePointer: true`, `lockScroll: true`. It also adds a capture-phase Escape listener that closes directly, duplicating overlay-stack handling.
- Notes: includes Privacy & Diagnostics secondary view inside the same modal surface.

Notion synchronization guide:
- Source: `src/features/settings/NotionSynchronizationGuide.tsx`
- Pattern: centered white wizard, max width 760px, three-step header.
- Behavior from code: `dismissOnEscape: true`, `dismissOnOutsidePointer: true`, `lockScroll: true`; backdrop mouse down closes when target is backdrop.
- Nested dropdown: catalog mode menu is an absolute light dropdown inside the modal.

Jira create preflight:
- Source: `src/features/jira-preflight/JiraPreflightDialog.tsx`
- Pattern: centered dark modal, max width 620px, scrollable body, sticky footer actions.
- Behavior from code: `dismissOnEscape` and `dismissOnBackdrop` are disabled while busy; scroll lock enabled.
- Includes nested `details` disclosure groups for blocking warnings, review warnings, sub-task creation, and epic targets.
- Loading state overlays an absolute busy panel inside the modal.

Tray delete confirmation:
- Source: `src/App.tsx` `ConfirmDialog`
- Pattern: centered dark destructive confirmation modal, max width 440px.
- Behavior from code: `dismissOnEscape: true`, `dismissOnBackdrop: true`, `lockScroll: true`.
- Variant: strong delete confirmation adds a required `DELETE` text input.

Backup notice dialog:
- Source: `src/App.tsx` `BackupNoticeDialog`
- Pattern: centered dark modal, max width 520px.
- Behavior from code: `dismissOnEscape: true`, `dismissOnBackdrop: true`, `lockScroll: true`.

Jira creation notice dialog:
- Source: `src/App.tsx` `JiraCreationNoticeDialog`
- Pattern: centered dark alert dialog, max width 620px, z-index 70.
- Behavior from code: `dismissOnEscape: false`, `dismissOnBackdrop: false`, `lockScroll: true`; must use Continue or recovery action.

Description prompt modal:
- Source: `src/features/task-detail/AssistedDescriptionSection.tsx`
- Pattern: nested dark centered modal, max width 520px, over task focus window.
- Behavior from code: `dismissOnEscape: true`, `dismissOnBackdrop: true`, but `shouldDismiss` blocks close while generating.
- Keyboard: textarea handler supports Ctrl/Cmd+Enter generation; Escape closes unless busy through overlay handling.

Assisted description proposal review modal:
- Source: `src/features/task-detail/AssistedDescriptionSection.tsx`
- Pattern: large nested dark review modal, max width 1040px, over task focus window.
- Behavior from code: `dismissOnEscape: true`, `dismissOnBackdrop: true`; no explicit scroll lock in its `useAppOverlay` call.
- Busy states add internal absolute overlays while generating revisions.

Catalog sync notice:
- Source: `src/features/categories/CategoriesPanel.tsx`
- Pattern: centered light modal-like notice, max width 520px, inside Categories panel.
- Behavior from code: hand-rolled backdrop `onMouseDown` closes; close button closes. It has no direct Escape handling and no `useAppOverlay` registration. Escape bubbles to the Categories panel listener and closes the entire panel instead of only the notice.

## Notices and Toasts

Connection notice toast:
- Source: `src/App.tsx` `ConnectionNoticeToast`
- Pattern: top-centered light success/error notice.
- Behavior from code: `dismissOnEscape: true`, `dismissOnBackdrop: true`; no scroll lock.
- The full-screen invisible backdrop can receive backdrop dismissal.

CSV export notice toast:
- Source: `src/App.tsx` `CsvExportNoticeToast`
- Pattern: centered green notice, max width 580px.
- Behavior from code: `dismissOnEscape: true`, `dismissOnBackdrop: true`; auto-closes after 6000ms; no scroll lock.

JQL loading overlay:
- Source: `src/features/jql/JqlView.tsx`
- Pattern: centered status overlay for loading state.
- Behavior from code: plain fixed status element; not an interactive modal and not registered with `useAppOverlay`.

## Dropdowns and Popovers

Quick capture select menus:
- Source: `src/features/trays/QuickCapture.tsx`
- Pattern: compact dark absolute listbox under select button.
- Behavior from code: outside `mousedown` closes; Escape closes local menu; ArrowUp/ArrowDown change selected value while open; Enter/Space toggles.
- Scroll behavior: menu has max height, `overflow-y-auto`, and `overscroll-contain`.

Inline task selects:
- Source: `src/features/trays/ProjectTaskGroup.tsx`
- Pattern: compact dark listbox on table cells, z-index 400, may open up when lower viewport space is insufficient.
- Behavior from code: outside `mousedown` closes; Escape closes local menu; arrows mutate selected value while menu is open.
- Risk to standardize: z-index is much higher than shared overlay layer numbers and not registered with overlay stack.

Task details selects:
- Source: `src/features/task-detail/TaskDetailsPanel.tsx`
- Pattern: dark absolute listbox in task focus right rail.
- Behavior from code: outside `mousedown` closes; Escape closes local menu; arrows mutate selected value.

Attachment purpose select:
- Source: `src/features/task-detail/TaskAttachmentsSection.tsx`
- Pattern: dark absolute listbox in task focus attachments section.
- Behavior from code: outside `mousedown` closes; Escape closes local menu; arrows mutate selected value.

Relationship selects:
- Source: `src/features/task-detail/TaskRelationshipsSection.tsx`
- Pattern: dark absolute listbox in relationship composer.
- Behavior from code: outside `mousedown` closes; Escape closes local menu; arrows mutate selected value.

Settings select:
- Source: `src/features/settings/SettingsPanel.tsx`
- Pattern: light absolute dropdown for AI provider/theme-like settings.
- Behavior from code: local open state and blur timeout close.

Jira connection project select:
- Source: `src/features/settings/JiraConnectionGuide.tsx`
- Pattern: light absolute menu inside setup wizard.
- Behavior from code: local menu state and blur timeout close.

Notion catalog mode select:
- Source: `src/features/settings/NotionSynchronizationGuide.tsx`
- Pattern: light absolute menu inside setup wizard.
- Behavior from code: local menu state and blur timeout close.

## Inline Editors That Behave Like Transient Surfaces

Tray rename:
- Source: `src/features/trays/TraysView.tsx`
- Behavior: inline input, Enter saves, Escape cancels.

Tray selector rename:
- Source: `src/features/trays/TraySelector.tsx`
- Behavior: inline input, Enter saves, Escape cancels.

Task row title edit:
- Source: `src/features/trays/ProjectTaskGroup.tsx`
- Behavior: inline input, blur/Enter saves, Escape cancels.

Task focus title edit:
- Source: `src/features/task-detail/TaskFocusWindow.tsx`
- Behavior: inline input, blur/Enter saves, Escape cancels.

Category add/edit:
- Source: `src/features/categories/CategoriesPanel.tsx`
- Behavior: inline input, Enter saves/creates, Escape cancels.

Sub-task add:
- Source: `src/features/task-detail/TaskSubtasksSection.tsx`
- Behavior: inline input, Enter creates, Escape cancels.

Assisted description section edit:
- Source: `src/features/task-detail/AssistedDescriptionSection.tsx`
- Behavior: textarea, Ctrl/Cmd+Enter saves, Escape cancels. Task focus window intentionally does not close on Escape from this editor.

## Audit Findings

1. Surface taxonomy is inconsistent: side panels, focus windows, centered modals, notices, and dropdowns all exist, but only some participate in `useAppOverlay`.
2. Categories panel and catalog sync notice are the clearest outliers because they hand-roll outside click/Escape/backdrop behavior instead of using the shared overlay stack. Current `main` added Categories Escape handling, but the panel still bypasses overlay layer ordering and scroll lock.
3. Dropdowns are independently implemented across Quick Capture, task table, task focus details, attachments, relationships, Settings, Jira guide, and Notion guide.
4. Some dropdowns mutate values on arrow navigation rather than only moving an active option before confirmation; standardization should decide whether that is intentional.
5. `JiraConnectionGuide` has both `useAppOverlay` Escape handling and a separate capture-phase Escape listener, which may make it behave differently from other nested modals.
6. `AssistedDescriptionProposalReviewModal` is nested over task focus but does not request scroll lock itself; it may rely on the task focus window lock.
7. Z-index values are mixed between named overlay layers and direct high values such as task table dropdown z-index 400.
8. Notices vary between top toast, centered status notice, and modal-like blocking alert. This should be an explicit design choice rather than incidental per feature.

## Static Surface Groups

Recommended target taxonomy before implementation:
- Drawer: Settings and Categories side panels. Decide whether drawers get a visible scrim or remain scrimless right panels.
- Focus window: Task focus window. Keep separate from normal dialogs because it is a large workspace, not a confirmation or setup flow.
- Setup wizard modal: Jira connection and Notion synchronization. These should likely share one setup-shell component if Saimon likes the current centered wizard family.
- Blocking dialog: Jira create preflight, destructive delete, backup/import notices, Jira creation/recovery notices.
- Toast/status notice: connection notice, CSV export notice, JQL loading status. These should not all inherit modal dismissal behavior.
- Listbox/dropdown: Quick Capture, inline task fields, task detail fields, attachment purpose, relationship type, Settings provider, Jira project picker, Notion catalog mode.

## Screenshot Plan

Screenshots to capture before standardization implementation:
- Main tray with Quick Capture dropdown open.
- Settings drawer.
- Settings drawer with Jira connection setup wizard.
- Settings drawer with Notion synchronization wizard and catalog-mode dropdown.
- Categories drawer.
- Categories drawer with catalog sync notice.
- Task focus window.
- Task focus window with description prompt modal.
- Task focus window with proposal review modal.
- Jira create preflight dialog.
- Tray delete confirmation, including strong delete when created Jira links exist.
- Connection notice and CSV export notice.

If the local dev environment cannot generate these states without secrets or live Jira writes, use fixtures or UI story harnesses in a later implementation slice rather than mutating DTS. JTFTEST remains the only allowed Jira write target.

## Screenshot Result

Captured with repo-local Vite and Playwright at 1366x768. Artifacts are temporary local evidence under `/tmp/codex-visual-evidence/jira-task-forge-popup-audit/`.

Captured:
- `01-main-trays.png`: baseline tray selector.
- `02-categories-drawer.png`: Categories drawer.
- `03-settings-drawer.png`: Settings drawer.
- `04-jira-setup-modal.png`: Jira connection setup modal over Settings.
- `05-notion-setup-modal.png` and `10-notion-setup-modal.png`: Notion synchronization setup modal over Settings.
- `06-open-tray.png`: active tray surface.
- `07-quick-capture-dropdown.png`: Quick Capture dropdown/listbox.
- `08-task-focus-window.png`: task focus window.
- `09-settings-provider-dropdown.png`: Settings AI provider dropdown.
- `11-jira-create-preflight.png`: Jira create preflight dialog.

Screenshot blockers and gaps:
- Catalog sync notice was not captured because the visible fixture routes missing Notion setup to the Notion setup guide before producing a sync result notice.
- Assisted description prompt and proposal review modals were not captured because the seeded task state did not expose a safe, no-secret path to open proposal generation/review.
- Tray delete confirmation was not captured in the browser fixture because the available row delete controls did not expose the expected safe selector during the screenshot run.
- Connection notice and CSV export notice were not captured because they require triggering backend/native actions; this audit avoided native dialogs and Jira/API mutations.

## Validation

- `npm test -- --runInBand` was attempted first as requested, but Vitest rejected `--runInBand` as an unknown option.
- `TMPDIR=/tmp npm test` passed with 29 test files and 121 tests.
- `TMPDIR=/tmp npm run build` passed.
- Local Vite needed `--configLoader runner` and writable Vite cache directories in the worktree. Non-escalated Vite/Vitest/build attempts failed on `node_modules/.vite-temp/...` with `EROFS: read-only file system`.

## Awaiting HITL Choice

No final visual standard is selected in this slice. Recommended HITL decision prompts:
- Should side panels remain no-backdrop drawers, or should they use a visible scrim like modals?
- Should dropdown/listbox controls be unified into one shared component with consistent keyboard behavior?
- Should notices be split into toast, centered confirmation, and blocking alert categories, or reduced to fewer patterns?
- Should every modal-like surface use `useAppOverlay`, including categories sync notice?
- Should nested task-detail modals share one dark modal shell with consistent max-width, header, footer, and busy state?
- Should setup/configuration flows standardize on the current Jira/Notion centered wizard shell, or should some setup remain inside the Settings drawer?
