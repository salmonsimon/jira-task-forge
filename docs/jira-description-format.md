# Jira Description Format

This document captures the Personal v1 target format for AI-assisted Jira
descriptions in Jira Task Forge.

## Decision

Personal v1 uses the practical DTS Jira description style, not SRS Lite or SRE
Lite.

Story descriptions should include only:

```markdown
## Historia de usuario

Como [usuario o rol],
quiero [accion o resultado],
para [beneficio].

## Contexto

[Contexto suficiente para entender el problema o la necesidad.]

## Alcance

Incluye:

- [Trabajo incluido.]

No incluye:

- [Trabajo explicitamente fuera de alcance.]

## Criterios de aceptacion

- [Resultado verificable.]
```

Bug descriptions should include only:

```markdown
## Problema

[Que falla.]

## Contexto / impacto

[A quien afecta y por que importa.]

## Pasos para reproducir

1. [Paso verificable.]

## Resultado actual

[Comportamiento observado.]

## Resultado esperado

[Comportamiento correcto.]

## Evidencia

- [Captura, video, log, PR, build, o referencia accesible.]

## Criterios de aceptacion

- [Resultado verificable.]

## Entregable minimo

- [Cambio minimo necesario para resolver el problema.]

## Checklist antes de Review

- [Evidencia disponible para revisar.]
```

## Rules

- Jira content defaults to Spanish when the task language is Spanish.
- UI copy remains English.
- Do not include mandatory `SRS Lite`, `SRE Lite`, validation, risk,
  observability, rollback, or open-question sections.
- Use the Bug template when the task resolves to Bug/Error. Use the Story
  template for other parent issue types.
- If missing information would materially change scope or acceptance criteria,
  ask targeted clarification questions before drafting.
- Do not include suggested sub-tasks in the Jira description. Sub-task
  suggestions belong in the separate sub-task proposal flow.
- Keep the result practical for production work: clear context, explicit scope,
  and acceptance criteria are more important than formal specification language.
- Review requires accessible evidence. A code change should not be considered
  ready to close unless the relevant PR/MR has been merged or the equivalent
  reviewed artifact is available.
