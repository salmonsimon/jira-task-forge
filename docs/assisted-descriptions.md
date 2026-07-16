# Assisted Descriptions

Assisted Descriptions help turn a Local Task into a reviewed Jira description.
The app can call OpenAI, Anthropic Claude, or Google Gemini, but the AI result is
always a proposal until you accept or edit it.

## Flow

1. Capture a Local Task in a Preparation Tray.
2. Add any useful context, evidence, or attachment notes.
3. Generate an Assisted Description proposal.
4. Review the proposal by section.
5. Accept useful sections, reject bad sections, edit manually, or request an AI
   revision.
6. Only accepted or manually edited content becomes the final Jira description.
7. `Create in Jira` uploads the final accepted description through the normal
   Jira sync flow.

The app should not silently upload AI text to Jira.

## Providers

Supported provider setup follows the same local secret pattern:

- OpenAI
- Anthropic Claude
- Google Gemini

API keys are stored in Windows Credential Manager and excluded from JSON
backups.

## Story And Bug Templates

Story tasks use user value, scope, acceptance criteria, a minimum deliverable,
and review evidence.

Bug tasks use problem, impact, reproduction steps, current result, expected
result, evidence, acceptance criteria, a minimum deliverable, and review
evidence.

The exact canonical template is maintained in
[docs/jira-description-format.md](jira-description-format.md).

## Fictitious Example

Local Task:

- Project: `F1 Car Simulator`
- Area: `Gameplay`
- Scope: `Pit Stop Polish`
- Title: `Smooth pit entry steering assist`

Generated Jira names:

- Epic: `[F1 Car Simulator] [Gameplay] Pit Stop Polish`
- Story: `[Gameplay] Smooth pit entry steering assist`

The Assisted Description proposal should explain the user value, the expected
pit-entry behavior, what is in scope, what is out of scope, and how review
evidence will prove the change.

## What AI Does Not Decide

AI does not decide when to create Jira issues. The user still reviews the tray,
warnings, missing descriptions, attachments, sub-tasks, and sync preflight
before creation.

AI does not replace the Area catalog. Catalog Areas and delivery-format mappings
come from Manual mode or the selected Notion catalog source.
