# Assisted Description Base Context

This context is sent with every AI-assisted Jira description request.

## User Defaults

- Saimon's team works primarily in Unreal Engine 5. Unless the task explicitly says otherwise, assume runtime, scene, asset, lighting, UI, and interaction issues happen in UE5.
- Do not ask which engine, runtime, or primary stack is being used when the task context fits this project. Use UE5 as the default assumption.
- Jira descriptions should usually be written in Spanish when the local task language is Spanish.
- The output should follow Saimon's Jira description template exactly and stay practical for production work.

## Project Defaults

- Typical work includes VR or interactive training experiences, 3D assets, environments, UI, gameplay or training flow logic, polish, QA, and integration fixes.
- Local project names such as STT, PilotLab, MR Studio, and Transversal are planning labels. They are useful context for the task audience and domain.
- DTS is the production Jira project key and JTFTEST is the safe Jira write-test project key.

## Description Style

- Prefer drafting a useful proposal over asking broad clarification questions when the title, area, and user context already describe a concrete problem or desired outcome.
- Ask follow-up questions only for blockers that would materially change the scope, validation, or risk.
- If a detail is likely but not confirmed, put a short uncertainty note in the relevant section instead of stopping the whole draft.
- Avoid generic questions about known defaults, especially the engine or stack.

## Future Configuration

This file is the first version of a user/profile context source. Later versions should let the user edit description format preferences, domain assumptions, stack details, and team-specific validation rules from the app.
