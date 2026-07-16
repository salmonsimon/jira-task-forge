[English](README.md) | [Español](README.es.md)

# Jira Task Forge

Jira Task Forge es una aplicación local para Windows que permite preparar y
revisar trabajo antes de crear cualquier contenido en Jira Cloud.

Está pensada para personas que convierten notas de producción, hallazgos de QA,
acuerdos de reuniones o conversaciones con IA en tareas de Jira y quieren una
revisión deliberada entre la idea inicial y Jira.

## Descargar la beta

Descarga la beta pública actual desde
[GitHub Releases](https://github.com/salmonsimon/jira-task-forge/releases/tag/v0.1.0-beta.1).

El instalador no está firmado, por lo que Windows SmartScreen puede mostrar una
advertencia. Esta es una beta pública y puede contener errores. Reporta
problemas reproducibles mediante
[GitHub Issues](https://github.com/salmonsimon/jira-task-forge/issues).

## Preparar primero, crear en Jira cuando esté listo

El trabajo comienza en una **Preparation Tray** local. Puedes capturar tareas,
organizarlas mediante los campos `Project` y `Area`, agregar evidencia,
preparar descripciones y revisar el resultado sin crear tareas incompletas en
Jira.

Cuando la bandeja está lista, Jira Task Forge puede crear:

- las Epics necesarias;
- Stories y Bugs principales;
- subtareas aceptadas;
- adjuntos seleccionados.

El respaldo en JSON y la exportación CSV están disponibles como alternativas
locales y rutas de respaldo.

## Revisar los cambios de IA antes de usarlos en Jira

Jira Task Forge puede asistir la redacción de Stories y Bugs mediante OpenAI,
Anthropic Claude o Google Gemini. El resultado de la IA permanece local como una
propuesta. **Proposal review** permite aceptar, rechazar, editar o solicitar
cambios sección por sección antes de utilizar la descripción.

![Revisión de una propuesta en Jira Task Forge](docs/assets/proposal-review.gif)

La estructura de las descripciones se mantiene predecible:

| Story | Bug |
| --- | --- |
| Historia de usuario | Problema |
| Contexto | Contexto e impacto |
| Alcance | Pasos para reproducir |
| Criterios de aceptación | Resultado actual y esperado |
| Entregable mínimo | Evidencia |
| Checklist antes de Review | Criterios de aceptación, entregable mínimo y checklist |

## Mantener nombres consistentes en Jira

Jira Task Forge deriva los nombres de Jira desde los campos locales revisados:

- Epic: `[{Project}] [{Area}] {Scope}`
- Story o Bug: `[{Area}] {Nombre de la tarea}`

Los siguientes ejemplos utilizan datos ficticios.

![Nombres automáticos de Jira derivados desde campos locales](docs/assets/automatic-naming.gif)

## Administrar categorías manualmente o con Notion

Las áreas pueden mantenerse directamente en Jira Task Forge o sincronizarse
desde un catálogo de Notion. El modo Manual ofrece la configuración más corta.
La sincronización con Notion es útil cuando quieres una fuente reutilizable para
áreas, etiquetas de Jira, tipos de tarea y formatos de entrega.

![Categorías cambiando desde el modo Manual a un catálogo validado de Notion](docs/assets/catalog-sync.gif)

El ejemplo público de Notion es una plantilla, no una página que pueda utilizarse
directamente mediante OAuth. Cópiala a tu propio espacio de trabajo y selecciona
esa página propia de nivel superior al conectar Jira Task Forge. La
[Guía de sincronización del catálogo](docs/catalog-sync.es.md) explica el flujo
completo.

## Consultar Jira con JQL asistido

El espacio de JQL permite ejecutar consultas de solo lectura, guardar favoritas
y consultas recientes, y redactar JQL con el proveedor de IA configurado.
Siempre revisas la consulta antes de ejecutarla.

## Datos locales y credenciales

Las bandejas, tareas, descripciones aceptadas, configuraciones, categorías y el
historial de sincronización se almacenan localmente. Los tokens de Jira, los
tokens OAuth de Notion y las claves de API de los proveedores de IA se guardan en
Windows Credential Manager y se excluyen de los respaldos JSON.

Lee [Instalación y seguridad](docs/installation-security.es.md) antes de
conectar cuentas personales o claves de API.

## Documentación

- [Instalación y seguridad](docs/installation-security.es.md)
- [Limitaciones conocidas de la beta](docs/beta-limitations.es.md)
- [Guía de sincronización del catálogo](docs/catalog-sync.es.md)
- [Conexión pública OAuth de Notion](docs/notion-oauth-public-connection.es.md)

Jira Task Forge es un proyecto personal y abierto, pensado para que otras
personas puedan usarlo, inspeccionarlo, adaptarlo y crear sus propias versiones.
Actualmente la aplicación solo funciona en Windows.
