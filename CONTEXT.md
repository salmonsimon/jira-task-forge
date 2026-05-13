# Jira Task Forge

Una app local de Windows para capturar, preparar, consultar y enviar tareas a Jira sin depender de que Jira sea el unico lugar donde existen los borradores de trabajo.

User-facing UI copy is English. Jira task content, descriptions, areas, epics, and user-authored text may remain Spanish.

## Language

**Preparation Tray**:
Una bandeja editable de tareas locales que se revisan antes de crearse en Jira.
_Avoid_: Board, sprint

**Tray Draft**:
Una version guardada de una **Preparation Tray** que puede retomarse, exportarse o importarse despues.
_Avoid_: CSV export

**Tray State**:
El estado local de un **Tray Draft**, como Active, Needs attention, Completed o Archived.
_Avoid_: Jira workflow status

**Local Task**:
Una tarea capturada en la app antes de exportarse o sincronizarse con Jira.
_Avoid_: Draft issue, raw line

**Sync Status**:
El estado local de subida/exportacion de una **Local Task**, como Pending, Failed, Exported o Created.
_Avoid_: Jira workflow status

**Jira Issue**:
Una tarea que ya existe en Jira y puede consultarse o modificarse mediante la API de Jira.
_Avoid_: Local task

**Project**:
El destino de trabajo al que pertenecen las tareas, como STT, PilotLab, MR Studio o Transversal.
_Avoid_: Board

**Area**:
La categoria funcional o disciplinaria que agrupa tareas dentro de un proyecto, como Bug, 3D, Polish o Programacion.
_Avoid_: Type, tag

**Category**:
Una opcion guardada de **Project** o **Area** que aparece en los controles de captura.
_Avoid_: Label

**Epic Mapping**:
La asociacion local entre **Project** + **Area** y una epic existente o nueva de Jira con nombre `[{Project}] {Area}`.
_Avoid_: hardcoded Jira key

**Priority**:
La urgencia de una tarea expresada con valores Jira: Lowest, Low, Medium, High o Highest.
_Avoid_: Stars

**Assisted Description**:
Una descripcion de Jira generada con ayuda de IA para una **Local Task**, usando historia de usuario y SRS Lite.
_Avoid_: freeform notes only

**Attachment Purpose**:
El uso previsto de una imagen o archivo adjunto de una **Local Task**: AI only, Jira attachment o AI + Jira attachment.
_Avoid_: implicit upload

**JQL Query**:
Una consulta Jira ejecutada desde la app, escrita directamente o generada por IA.
_Avoid_: full Jira browser

**JQL Favorite**:
Una **JQL Query** guardada con nombre para reutilizarla.
_Avoid_: JQL history

**CSV Export**:
Un archivo importable en Jira que actua como respaldo o alternativa cuando la API no esta disponible.
_Avoid_: Source of truth

**Jira Sync**:
El envio o consulta de informacion entre la app local y Jira mediante la REST API.
_Avoid_: CSV import

**Sync Audit Log**:
Un registro tecnico estructurado de intentos de exportacion o sincronizacion de trays y tasks.
_Avoid_: content version history

## Relationships

- A **Preparation Tray** contains one or more **Local Tasks**
- A **Preparation Tray** may be saved as one **Tray Draft**
- A **Tray Draft** has one **Tray State**
- A **Tray Draft** may be exported to or imported from JSON
- A **Local Task** belongs to exactly one **Project**
- A **Local Task** has exactly one **Area**
- A **Local Task** has exactly one **Priority**
- A **Local Task** has exactly one **Sync Status**
- A **Local Task** may become one **Jira Issue**
- A **Local Task** may have one **Assisted Description**
- A **Local Task** may have zero or more attachments with **Attachment Purpose**
- A **Local Task** may have zero or more sub-tasks
- A **Project** and **Area** may resolve to one **Epic Mapping**
- A **CSV Export** contains one or more **Local Tasks**
- **Jira Sync** reads and writes **Jira Issues**
- **Jira Sync** writes one or more **Sync Audit Log** entries
- A **JQL Favorite** stores one reusable **JQL Query**

## Example Dialogue

> **Dev:** "When I press Enter after writing a task, should it immediately become a **Jira Issue**?"
> **Domain expert:** "No. It should enter the **Preparation Tray** first. Jira is only touched when I press Crear en Jira."

> **Dev:** "Should app UI and Jira content use the same language?"
> **Domain expert:** "No. The app UI should be English, but Jira cards and generated descriptions should usually be Spanish."

## Flagged Ambiguities

- "tarea" can mean both **Local Task** and **Jira Issue**. Resolved: use **Local Task** for app-owned drafts and **Jira Issue** for records already in Jira.
- Asterisks are an input shorthand, not the canonical domain concept. Resolved: the app stores **Priority** as Jira priority values.
- "bandeja" means **Preparation Tray**, not a Jira board.
- "label" can mean UI categories or Jira labels. Resolved: use **Category** for saved Projects/Areas and generated Jira labels for Area-derived issue labels.
- "status" can mean local sync status or Jira workflow status. Resolved: use **Sync Status** for upload/export state; Jira workflow status is out of scope for v1.
