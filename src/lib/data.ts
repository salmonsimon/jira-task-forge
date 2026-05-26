import type { Category, JqlFavorite, JqlResult, Tray } from "./types";

export const projects: Category[] = [
  { categoryType: "project", id: "project-stt", name: "STT", source: "jira" },
  { categoryType: "project", id: "project-pilotlab", name: "PilotLab", source: "jira" },
  { categoryType: "project", id: "project-mr-studio", name: "MR Studio", source: "jira" },
  { categoryType: "project", id: "project-transversal", name: "Transversal", source: "jira" },
  { categoryType: "project", id: "project-legacy", name: "Legacy Sandbox", source: "jira", hidden: true }
];

export const areas: Category[] = [
  { categoryType: "area", id: "area-bug", name: "Bug", source: "jira" },
  { categoryType: "area", id: "area-3d", name: "3D", source: "jira" },
  { categoryType: "area", id: "area-polish", name: "Polish", source: "jira" },
  { categoryType: "area", id: "area-programacion", name: "Programacion", source: "jira" },
  { categoryType: "area", id: "area-iluminacion", name: "Iluminacion", source: "jira" },
  { categoryType: "area", id: "area-texturas", name: "Texturas", source: "jira" },
  { categoryType: "area", id: "area-localizacion", name: "Localizacion", source: "jira" },
  { categoryType: "area", id: "area-refactorizacion", name: "Refactorizacion", source: "jira" },
  { categoryType: "area", id: "area-tutorial", name: "Tutorial", source: "jira" },
  { categoryType: "area", id: "area-feeling", name: "Feeling", source: "jira" },
  { categoryType: "area", id: "area-diseno", name: "Diseno", source: "jira" },
  { categoryType: "area", id: "area-deprecated", name: "Deprecated", source: "jira", hidden: true }
];

export const trays: Tray[] = [
  {
    id: "tray-week-20",
    name: "Semana 20 STT + PilotLab",
    state: "Needs attention",
    summary: "12 tasks · 10 sub-tasks · 8 pending · 1 failed · 3 created",
    updatedAt: "Today",
    tasks: [
      {
        id: "ltask-timer",
        project: "STT",
        area: "Bug",
        title: "Resolver problema timer",
        priority: "Highest",
        issueType: "Bug",
        syncStatus: "Created",
        descriptionStatus: "Ready",
        language: "Spanish",
        jiraKey: "DTS-901",
        epic: "DTS-831 [STT] Bug",
        description:
          "## Historia de usuario\n\nYo como usuario de STT,\nquiero que el timer se detenga correctamente al completar objetivos,\npara evitar estados inconsistentes durante la experiencia.\n\n## SRS Lite\n\n### 1. Problema\nEl timer puede seguir corriendo cuando el flujo ya deberia haber cerrado el objetivo.\n\n### 2. Objetivo\nAsegurar que el timer refleje correctamente el estado de avance.",
        attachments: [
          {
            id: "att-timer",
            filename: "timer-stuck-state.png",
            purpose: "AI + Jira attachment",
            size: "482 KB"
          }
        ],
        syncLog: [
          {
            id: "log-timer-1",
            timestamp: "Today 10:14",
            event: "story.create.succeeded",
            detail: "Created Jira issue DTS-901"
          }
        ]
      },
      {
        id: "ltask-input",
        project: "STT",
        area: "Bug",
        title: "Bloquear input acorde avance objetivos",
        priority: "Highest",
        issueType: "Bug",
        syncStatus: "Failed",
        descriptionStatus: "Draft",
        language: "Spanish",
        epic: "DTS-831 [STT] Bug",
        notes: "El input debe dejar de aceptar interacciones cuando el objetivo ya avanzo a estado cerrado.",
        syncLog: [
          {
            id: "log-input-1",
            timestamp: "Today 10:22",
            event: "story.create.failed",
            detail: "Jira auth expired before creating issue"
          }
        ]
      },
      {
        id: "ltask-vending",
        project: "STT",
        area: "3D",
        title: "Maquinas expendedoras",
        priority: "Medium",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Missing",
        language: "Spanish",
        epic: "DTS-832 [STT] 3D"
      },
      {
        id: "ltask-vending-reference",
        project: "STT",
        area: "3D",
        title: "Recolectar referencias",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-vending"
      },
      {
        id: "ltask-vending-scale",
        project: "STT",
        area: "3D",
        title: "Definir escala y restricciones",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-vending"
      },
      {
        id: "ltask-vending-model",
        project: "STT",
        area: "3D",
        title: "Modelar base del asset",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-vending"
      },
      {
        id: "ltask-vending-texture",
        project: "STT",
        area: "3D",
        title: "Texturizar",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-vending"
      },
      {
        id: "ltask-vending-review",
        project: "STT",
        area: "3D",
        title: "Revisar en contexto",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-vending"
      },
      {
        id: "ltask-score-timer-map",
        project: "STT",
        area: "Polish",
        title: "Reubicar pantallas Score y Timer mapa simulacion",
        priority: "High",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        epic: "DTS-812 [STT] Polish",
        description:
          "## Historia de usuario\n\nYo como usuario de la simulacion,\nquiero ver Score y Timer en una posicion clara,\npara leer informacion critica sin tapar la accion principal."
      },
      {
        id: "ltask-audio-feedback",
        project: "STT",
        area: "Polish",
        title: "Agregar feedback sonoro a objetivos completados",
        priority: "Medium",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Missing",
        language: "Spanish",
        epic: "DTS-812 [STT] Polish"
      },
      {
        id: "ltask-save-progress",
        project: "STT",
        area: "Programacion",
        title: "Persistir avance local entre escenas",
        priority: "High",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Draft",
        language: "Spanish",
        epic: "DTS-829 [STT] Programacion",
        notes: "Evitar que el usuario pierda objetivos completados si vuelve al menu y reingresa."
      },
      {
        id: "ltask-metro",
        project: "PilotLab",
        area: "3D",
        title: "Panel de informacion Metro",
        priority: "High",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Draft",
        language: "Spanish",
        epic: "DTS-825 [PilotLab] 3D",
        notes: "Debe servir como referencia visual para el equipo antes de modelar."
      },
      {
        id: "ltask-ticket-machine",
        project: "PilotLab",
        area: "3D",
        title: "Modelar maquina de carga tarjeta Bip",
        priority: "Medium",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Missing",
        language: "Spanish",
        epic: "DTS-825 [PilotLab] 3D"
      },
      {
        id: "ltask-ticket-machine-reference",
        project: "PilotLab",
        area: "3D",
        title: "Recolectar referencias",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-ticket-machine"
      },
      {
        id: "ltask-ticket-machine-scale",
        project: "PilotLab",
        area: "3D",
        title: "Definir escala y restricciones",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-ticket-machine"
      },
      {
        id: "ltask-ticket-machine-model",
        project: "PilotLab",
        area: "3D",
        title: "Modelar base del asset",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-ticket-machine"
      },
      {
        id: "ltask-ticket-machine-texture",
        project: "PilotLab",
        area: "3D",
        title: "Texturizar",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-ticket-machine"
      },
      {
        id: "ltask-ticket-machine-review",
        project: "PilotLab",
        area: "3D",
        title: "Revisar en contexto",
        priority: "Medium",
        issueType: "Sub-task",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        parentTaskId: "ltask-ticket-machine"
      },
      {
        id: "ltask-refactor-flow",
        project: "PilotLab",
        area: "Refactorizacion",
        title: "Ordenar estados del flujo de entrenamiento",
        priority: "High",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Draft",
        language: "Spanish",
        epic: "DTS-827 [PilotLab] Refactorizacion",
        notes: "Separar estados de UI, progreso y evaluacion para reducir bugs cruzados."
      },
      {
        id: "ltask-texture-pass",
        project: "PilotLab",
        area: "Texturas",
        title: "Primera pasada texturas anden y señalética",
        priority: "Medium",
        issueType: "Story",
        syncStatus: "Exported",
        descriptionStatus: "Ready",
        language: "Spanish",
        epic: "DTS-826 [PilotLab] Texturas",
        description:
          "## Historia de usuario\n\nYo como usuario,\nquiero que el anden tenga texturas consistentes,\npara reconocer mejor el entorno de entrenamiento."
      },
      {
        id: "ltask-localization",
        project: "PilotLab",
        area: "Localizacion",
        title: "Revisar textos flujo onboarding",
        priority: "Low",
        issueType: "Story",
        syncStatus: "Created",
        descriptionStatus: "Ready",
        language: "Spanish",
        jiraKey: "DTS-902",
        epic: "DTS-822 [PilotLab] Localizacion",
        description:
          "## Historia de usuario\n\nYo como usuario nuevo,\nquiero textos claros durante el onboarding,\npara entender que debo hacer sin apoyo externo."
      },
      {
        id: "ltask-ui-hints",
        project: "PilotLab",
        area: "Localizacion",
        title: "Revisar hints contextuales de interacción",
        priority: "Low",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Missing",
        language: "Spanish",
        epic: "DTS-822 [PilotLab] Localizacion"
      }
    ]
  },
  {
    id: "tray-mr-polish",
    name: "MR Studio polish",
    state: "Active",
    summary: "7 tasks · 7 pending",
    updatedAt: "Yesterday",
    tasks: [
      {
        id: "ltask-menu",
        project: "MR Studio",
        area: "Polish",
        title: "Ajustar botones menu",
        priority: "High",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Missing",
        language: "Spanish",
        epic: "DTS-835 [MR Studio] Polish"
      },
      {
        id: "ltask-lighting",
        project: "MR Studio",
        area: "Iluminacion",
        title: "Balancear luces escena tutorial",
        priority: "Medium",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Draft",
        language: "Spanish",
        epic: "DTS-832 [MR Studio] Iluminacion"
      },
      {
        id: "ltask-splash",
        project: "MR Studio",
        area: "Polish",
        title: "Pulir transicion splash screens",
        priority: "Low",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        epic: "DTS-835 [MR Studio] Polish",
        description:
          "## Historia de usuario\n\nYo como usuario,\nquiero una transicion fluida entre splash screens,\npara sentir una carga mas consistente y profesional."
      },
      {
        id: "ltask-tutorial-copy",
        project: "MR Studio",
        area: "Tutorial",
        title: "Ajustar copy del paso inicial del tutorial",
        priority: "Medium",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Draft",
        language: "Spanish",
        epic: "DTS-836 [MR Studio] Tutorial",
        notes: "El texto actual explica la accion, pero no deja claro el objetivo final del paso."
      },
      {
        id: "ltask-feeling-haptics",
        project: "MR Studio",
        area: "Feeling",
        title: "Probar micro feedback al confirmar acciones",
        priority: "Low",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Missing",
        language: "Spanish",
        epic: "DTS-834 [MR Studio] Feeling"
      },
      {
        id: "ltask-light-bake",
        project: "MR Studio",
        area: "Iluminacion",
        title: "Revisar bake luces zona de interacción",
        priority: "High",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Ready",
        language: "Spanish",
        epic: "DTS-832 [MR Studio] Iluminacion",
        description:
          "## Historia de usuario\n\nYo como usuario,\nquiero que la zona interactiva tenga lectura clara,\npara identificar rapidamente donde debo actuar."
      },
      {
        id: "ltask-design-pass",
        project: "MR Studio",
        area: "Diseno",
        title: "Revisar jerarquia visual de tarjetas de ayuda",
        priority: "Medium",
        issueType: "Story",
        syncStatus: "Pending",
        descriptionStatus: "Draft",
        language: "Spanish",
        epic: "DTS-830 [MR Studio] Diseno",
        notes: "Comparar tamaño de titulo, descripcion y CTA en contexto de uso real."
      }
    ]
  },
  {
    id: "tray-pilotlab-sync",
    name: "PilotLab sync mayo",
    state: "Completed",
    summary: "12 created",
    updatedAt: "May 10",
    tasks: []
  }
];

export const jqlFavorites: JqlFavorite[] = [
  {
    id: "fav-bugs",
    name: "Urgent open bugs",
    jql: 'project = DTS AND labels = "Bug" AND priority in (High, Highest) AND statusCategory != Done ORDER BY priority DESC'
  },
  {
    id: "fav-3d",
    name: "3D pending by project",
    jql: 'project = DTS AND labels = "3D" AND statusCategory != Done ORDER BY updated DESC'
  }
];

export const jqlResults: JqlResult[] = [
  {
    key: "DTS-901",
    project: "STT",
    issueType: "Bug",
    priority: "Highest",
    status: "To Do",
    summary: "Resolver problema timer",
    assignee: "Saimon"
  },
  {
    key: "DTS-825",
    project: "PilotLab",
    issueType: "Epic",
    priority: "Medium",
    status: "In Progress",
    summary: "[PilotLab] 3D",
    assignee: "Unassigned"
  },
  {
    key: "DTS-835",
    project: "MR Studio",
    issueType: "Epic",
    priority: "Medium",
    status: "To Do",
    summary: "[MR Studio] Polish",
    assignee: "Unassigned"
  }
];
