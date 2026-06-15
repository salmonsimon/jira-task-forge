import type { Attachment, IssueType, LocalTask, Priority, SyncStatus, Tray } from "../types";

type TaskTemplate = {
  area: string;
  title: string;
  descriptionSeed: string;
};
type DescriptionStatus = LocalTask["descriptionStatus"];

const projects = ["Transversal", "STT", "PilotLab", "MR Studio"] as const;
const priorities: Priority[] = ["Lowest", "Low", "Medium", "High", "Highest"];
const parentStatuses: SyncStatus[] = [
  "Pending",
  "Pending",
  "Pending",
  "Failed",
  "Exported",
  "Created",
  "Pending",
  "Exported",
  "Pending",
  "Failed"
];
const descriptionStatuses: DescriptionStatus[] = ["Ready", "Draft", "Missing", "Ready", "Ready", "Draft"];
const taskTemplates: TaskTemplate[] = [
  {
    area: "Bug",
    title: "Corregir estado inconsistente de objetivo",
    descriptionSeed: "El objetivo queda marcado como activo despues de completar el flujo principal."
  },
  {
    area: "3D",
    title: "Preparar asset modular para entorno",
    descriptionSeed: "El asset necesita referencias, escala y revision en contexto antes de modelado final."
  },
  {
    area: "Polish",
    title: "Ajustar feedback visual de interaccion",
    descriptionSeed: "El feedback actual no comunica con claridad cuando la accion queda disponible."
  },
  {
    area: "Programacion",
    title: "Persistir avance local de sesion",
    descriptionSeed: "La sesion debe conservar progreso al cambiar entre escenas y volver al menu."
  },
  {
    area: "Iluminacion",
    title: "Balancear luces de sala principal",
    descriptionSeed: "La lectura de volumen y puntos de interes cambia demasiado entre escenas."
  },
  {
    area: "Texturas",
    title: "Normalizar materiales de superficie",
    descriptionSeed: "Los materiales usan escalas distintas y producen ruido visual en camara cercana."
  },
  {
    area: "Localizacion",
    title: "Revisar textos de onboarding",
    descriptionSeed: "Los textos mezclan tono tutorial con instrucciones tecnicas y deben quedar consistentes."
  },
  {
    area: "Refactorizacion",
    title: "Separar adaptador de flujo de tareas",
    descriptionSeed: "La logica de UI y persistencia esta acoplada y dificulta pruebas de regresion."
  },
  {
    area: "Tutorial",
    title: "Guiar primer paso del usuario",
    descriptionSeed: "El usuario necesita una senal clara para ejecutar la primera accion sin bloquearse."
  },
  {
    area: "Diseno",
    title: "Alinear layout compacto de panel",
    descriptionSeed: "El panel debe mantener densidad de trabajo sin ocultar los controles importantes."
  }
];

export function createLargeTraySmokeScenario(): Tray {
  const tasks: LocalTask[] = [];

  for (let index = 0; index < 160; index += 1) {
    const template = taskTemplates[index % taskTemplates.length];
    const project = projects[index % projects.length];
    const syncStatus = parentStatuses[index % parentStatuses.length];
    const descriptionStatus = descriptionStatuses[index % descriptionStatuses.length];
    const issueType: IssueType = template.area === "Bug" ? "Bug" : "Story";
    const taskNumber = index + 1;
    const taskId = `smoke-parent-${taskNumber.toString().padStart(3, "0")}`;

    tasks.push({
      id: taskId,
      project,
      area: template.area,
      title: `${template.title} ${taskNumber.toString().padStart(3, "0")}`,
      priority: priorities[index % priorities.length],
      issueType,
      syncStatus,
      descriptionStatus,
      language: "Spanish",
      epic: syncStatus === "Created" && index % 4 === 1 ? undefined : `JTFTEST-${800 + (index % 37)} [${project}] ${template.area}`,
      description: descriptionStatus === "Ready" ? formatSmokeDescription(project, template, taskNumber) : undefined,
      notes: descriptionStatus === "Draft" ? `${template.descriptionSeed} Pendiente cerrar criterios de aceptacion.` : undefined,
      jiraKey: syncStatus === "Created" ? `JTFTEST-${1200 + taskNumber}` : undefined,
      jiraUrl: syncStatus === "Created" ? `https://salmonsimondts.atlassian.net/browse/JTFTEST-${1200 + taskNumber}` : undefined,
      attachments: buildSmokeAttachments(taskId, index),
      syncLog: buildSmokeSyncLog(taskId, syncStatus)
    });
  }

  for (let index = 0; index < 40; index += 1) {
    const parentIndex = (index * 4) % 160;
    const parent = tasks[parentIndex];
    tasks.splice(parentIndex + 1, 0, {
      id: `smoke-subtask-${(index + 1).toString().padStart(3, "0")}`,
      project: parent.project,
      area: parent.area,
      title: `${["Recolectar referencias", "Validar en escena", "Preparar checklist", "Revisar resultado"][index % 4]} ${(index + 1).toString().padStart(3, "0")}`,
      priority: parent.priority,
      issueType: "Sub-task",
      syncStatus: index % 7 === 0 ? "Exported" : "Pending",
      descriptionStatus: index % 3 === 0 ? "Draft" : "Ready",
      language: "Spanish",
      parentTaskId: parent.id,
      notes: index % 3 === 0 ? "Sub-task preparado para revisar durante el smoke test." : undefined,
      attachments: index % 5 === 0 ? buildSmokeAttachments(`smoke-subtask-${index + 1}`, index + 200) : undefined
    });
  }

  return {
    id: "tray-large-smoke-200",
    name: "Large tray smoke - 200 Local Tasks",
    state: "Needs attention",
    summary: "160 parent tasks · 40 sub-tasks · mixed statuses · attachment metadata only",
    updatedAt: "Smoke fixture",
    tasks
  };
}

export const largeTraySmokeScenario = createLargeTraySmokeScenario();

function formatSmokeDescription(project: string, template: TaskTemplate, taskNumber: number): string {
  return [
    "## Historia de usuario",
    "",
    `Yo como responsable de ${project},`,
    `quiero preparar la tarea ${taskNumber} con contexto suficiente,`,
    "para revisar la bandeja antes de crear issues en Jira.",
    "",
    "## Contexto",
    "",
    template.descriptionSeed,
    "",
    "## Alcance",
    "",
    "Incluye:",
    "- Mantener una descripcion realista que permita probar busqueda, detalle y preflight sin escribir en Jira.",
    "",
    "No incluye:",
    "- Crear issues reales durante el smoke.",
    "",
    "## Criterios de aceptacion",
    "",
    "- La tarea conserva contexto suficiente para revisar la bandeja."
  ].join("\n");
}

function buildSmokeAttachments(taskId: string, index: number): Attachment[] | undefined {
  if (index % 4 !== 0) return undefined;

  const attachments: Attachment[] = [
    {
      id: `${taskId}-reference`,
      filename: `reference-${(index + 1).toString().padStart(3, "0")}.png`,
      purpose: index % 8 === 0 ? "AI + Jira attachment" : "AI only",
      size: `${420 + (index % 29) * 13} KB`,
      mimeType: "image/png",
      sizeBytes: (420 + (index % 29) * 13) * 1024
    }
  ];

  if (index % 12 === 0) {
    attachments.push({
      id: `${taskId}-brief`,
      filename: `brief-${(index + 1).toString().padStart(3, "0")}.pdf`,
      purpose: "Jira attachment",
      size: `${1 + (index % 9)} MB`,
      mimeType: "application/pdf",
      sizeBytes: (1 + (index % 9)) * 1024 * 1024
    });
  }

  return attachments;
}

function buildSmokeSyncLog(taskId: string, syncStatus: SyncStatus) {
  if (syncStatus === "Pending") return undefined;

  if (syncStatus === "Failed") {
    return [
      {
        id: `${taskId}-sync-failed`,
        timestamp: "Smoke fixture",
        event: "story.create.failed",
        detail: "Synthetic failure for preflight retry review; no Jira request was sent."
      }
    ];
  }

  return [
    {
      id: `${taskId}-sync-${syncStatus.toLowerCase()}`,
      timestamp: "Smoke fixture",
      event: syncStatus === "Created" ? "story.create.succeeded" : "csv.export.succeeded",
      detail: syncStatus === "Created" ? "Synthetic created JTFTEST issue link." : "Synthetic CSV export marker."
    }
  ];
}
