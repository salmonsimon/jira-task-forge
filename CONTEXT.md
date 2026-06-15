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

**Recovery Tray**:
Una **Preparation Tray** creada despues de una sync parcial para continuar solo con las **Local Tasks** fallidas o pausadas.
_Avoid_: duplicate tray

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
_Avoid_: Board, Jira project key

**Jira Creation Project Key**:
La key del proyecto Jira real donde se crean los issues, como DTS o JTFTEST. Es una configuracion de sync independiente de **Project**.
_Avoid_: Project

**Jira Connection**:
La configuracion que permite a la app hablar con un sitio Jira Cloud: **Jira Site URL**, account email, **Jira Creation Project Key** y credencial guardada en el OS credential store.
_Avoid_: API token only, Project

**Jira Site URL**:
La raiz canonica del sitio Jira Cloud usado por la app, con forma `https://<site>.atlassian.net`.
_Avoid_: Jira issue URL, arbitrary HTTPS URL

**Area**:
La categoria funcional o disciplinaria que agrupa tareas dentro de un proyecto, como Bug, 3D, Polish o Programacion.
_Avoid_: Type, tag

**Category**:
Una opcion guardada de **Project** o **Area** que aparece en los controles de captura.
_Avoid_: Label

**Epic Mapping**:
La asociacion local entre **Project** + **Area** y una epic existente o nueva de Jira con nombre `[{Project}] {Area}`. **Jira Sync** debe resolver esta asociacion antes de crear las tareas hijas.
_Avoid_: hardcoded Jira key

**Priority**:
La urgencia de una tarea expresada con valores Jira: Lowest, Low, Medium, High o Highest.
_Avoid_: Stars

**Assisted Description**:
Una descripcion de Jira generada con ayuda de IA para una **Local Task**, usando el formato Jira DTS: historia de usuario, contexto, alcance y criterios de aceptacion.
_Avoid_: freeform notes only

**Assisted Description Proposal**:
Una propuesta local para cambiar una **Assisted Description**, separada por secciones del formato Jira DTS para aceptar, rechazar, editar o pedir iteraciones antes de convertirla en descripcion final.
_Avoid_: final Jira description

**Description Proposal Log**:
Historial local y cronologico de iteraciones, comentarios y decisiones sobre **Assisted Description Proposals**.
_Avoid_: Sync Audit Log, Jira comments

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

**Jira Creation Metadata**:
La metadata leida desde Jira para saber que issue types, campos requeridos, prioridades, labels y relacion con epic acepta el **Jira Creation Project Key**.
_Avoid_: hardcoded Jira payload

**Remote Correlation Marker**:
Metadata casi invisible escrita en un **Jira Issue** para conectar ese issue con una **Local Task** y un intento de sync.
_Avoid_: visible local id in summary, description, or labels

**Sync Audit Log**:
Un registro tecnico estructurado de intentos de exportacion o sincronizacion de trays y tasks.
_Avoid_: content version history

## Relationships

- A **Preparation Tray** contains one or more **Local Tasks**
- A **Preparation Tray** may be saved as one **Tray Draft**
- A **Recovery Tray** moves problem **Local Tasks** out of the original
  **Preparation Tray** without duplicating their local identity
- A **Tray Draft** has one **Tray State**
- A **Tray Draft** may be exported to or imported from JSON
- A **Local Task** belongs to exactly one **Project**
- **Jira Connection** supplies the Jira site, account email, credential, and
  **Jira Creation Project Key** used by **Jira Sync**
- **Jira Sync** creates **Jira Issues** under one configured **Jira Creation
  Project Key**
- **Jira Sync** validates **Jira Creation Metadata** before creating any
  **Jira Issues**
- A **Local Task** has exactly one **Area**
- A **Local Task** has exactly one **Priority**
- A **Local Task** has exactly one **Sync Status**
- A **Local Task** may become one **Jira Issue**
- A **Jira Issue** created by the app should receive one **Remote Correlation
  Marker** when Jira permissions allow it
- A **Local Task** may have one **Assisted Description**
- A **Local Task** may have one or more **Assisted Description Proposals**
- Accepted or edited **Assisted Description Proposal** sections update the
  **Assisted Description**
- A **Description Proposal Log** belongs to one **Local Task** and is not
  uploaded to Jira as issue content or comments
- A **Local Task** may have zero or more attachments with **Attachment Purpose**
- A **Local Task** may have zero or more sub-tasks
- A **Project** and **Area** may resolve to one **Epic Mapping**
- A **Local Task** must have a resolved **Epic Mapping** before **Jira Sync**
  creates its linked **Jira Issue**
- A **CSV Export** contains one or more **Local Tasks**
- **Jira Sync** reads and writes **Jira Issues**
- **Jira Sync** writes one or more **Sync Audit Log** entries
- **Jira Sync** pauses a **Local Task** for manual recovery when it cannot prove
  whether that task already became a **Jira Issue**
- **Jira Sync** uses **Remote Correlation Markers** to recover ambiguous writes
  without exposing local ids in normal Jira fields
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
- "project" can mean internal work destination or Jira project key. Resolved:
  use **Project** for local grouping and **Jira Creation Project Key** for the
  Jira target configured in Settings.
- "new tray with failed tasks" means **Recovery Tray** only when tasks are moved
  with their same local identity, not copied.
