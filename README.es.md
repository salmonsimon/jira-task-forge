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

La exportación CSV ofrece una alternativa transportable para el contenido revisado
de las tareas.

## Revisar los cambios de IA antes de usarlos en Jira

Jira Task Forge puede asistir la redacción de Stories y Bugs mediante OpenAI,
Anthropic Claude o Google Gemini. El resultado de la IA permanece local como una
propuesta. **Proposal review** permite aceptar, rechazar, editar o solicitar
cambios sección por sección antes de utilizar la descripción.

![Revisión de una propuesta en Jira Task Forge](docs/assets/proposal-review.gif)

La estructura de las descripciones se mantiene predecible. Las plantillas de
Story y Bug usan secciones Markdown independientes para que el resultado sea
legible en Jira y fácil de revisar antes de crearlo:

<table>
<tr>
<th width="50%">Story</th>
<th width="50%">Bug</th>
</tr>
<tr>
<td width="50%" valign="top"><pre><code>&#35;&#35; Historia de usuario&#10;&#10;&#35;&#35; Contexto&#10;&#10;&#35;&#35; Alcance&#10;&#10;&#35;&#35; Criterios de aceptación&#10;&#10;&#35;&#35; Entregable mínimo&#10;&#10;&#35;&#35; Checklist antes de Review</code></pre></td>
<td width="50%" valign="top"><pre><code>&#35;&#35; Problema&#10;&#10;&#35;&#35; Contexto e impacto&#10;&#10;&#35;&#35; Pasos para reproducir&#10;&#10;&#35;&#35; Resultado actual&#10;&#10;&#35;&#35; Resultado esperado&#10;&#10;&#35;&#35; Evidencia&#10;&#10;&#35;&#35; Criterios de aceptación&#10;&#10;&#35;&#35; Entregable mínimo&#10;&#10;&#35;&#35; Checklist antes de Review</code></pre></td>
</tr>
</table>

## Mantener nombres consistentes en Jira

Jira Task Forge deriva los nombres de Jira desde los campos locales revisados:

- Epic: `[{Project}] [{Area}] {Scope}`
- Story o Bug: `[{Area}] {Nombre de la tarea}`

La siguiente animación muestra cómo esos campos se convierten en nombres de
Jira en la práctica.

![Nombres automáticos de Jira derivados desde campos locales](docs/assets/automatic-naming.gif)

## Administrar categorías desde sus fuentes reales

### Áreas: modo manual o Notion

Las áreas pueden mantenerse directamente en Jira Task Forge o sincronizarse
desde un catálogo de Notion. El modo manual ofrece la configuración más corta.
La sincronización con Notion es útil cuando quieres una fuente reutilizable para
áreas, etiquetas de Jira, tipos de tarea y formatos de entrega.

![Categorías cambiando desde el modo manual a un catálogo validado de Notion](docs/assets/catalog-sync.gif)

El ejemplo público de Notion es una plantilla, no una página que pueda utilizarse
directamente mediante OAuth. Cópiala a tu propio espacio de trabajo y selecciona
esa página propia de nivel superior al conectar Jira Task Forge. La
[Guía de sincronización del catálogo](docs/catalog-sync.es.md) explica el flujo
completo.

### Proyectos: modo manual o Jira

Los proyectos también pueden mantenerse manualmente o descubrirse desde Jira.
La sincronización de proyectos analiza los nombres de las Epics de Jira mediante el formato
definido arriba: `[{Project}] [{Area}] {Scope}`. El asistente de revisión permite
elegir qué proyectos descubiertos quedan activos y cuáles permanecen ignorados,
pero recuperables.

![Proyectos descubiertos desde los nombres de Epics en Jira](docs/assets/project-sync.gif)

## Consultar Jira con JQL asistido

El espacio de JQL ofrece dos caminos. Puedes escribir JQL directamente cuando
conoces la sintaxis, o describir las tareas en lenguaje normal para que el
proveedor de IA configurado redacte el JQL equivalente. La consulta generada se
carga en **Direct JQL** para revisión y no se ejecuta automáticamente.

Por ejemplo, `Muéstrame los bugs abiertos High y Highest de STT, ordenados por
prioridad` puede convertirse en:

```jql
project = STT AND issuetype = Bug AND priority in (High, Highest)
AND statusCategory != Done ORDER BY priority DESC
```

![Una búsqueda en lenguaje normal convertida en JQL revisable](docs/assets/assisted-jql.gif)

Las consultas son de solo lectura. Después de revisar el JQL final puedes
ejecutarlo, guardarlo como favorito y volver a las consultas recientes.

## Datos locales y credenciales

Las bandejas, tareas, descripciones aceptadas, configuraciones no secretas,
categorías y el historial de sincronización permanecen en este computador. Los
tokens de Jira, los tokens OAuth de Notion y las claves de API de los proveedores
de IA se guardan en Windows Credential Manager, no en la base de datos local de
la aplicación. Así se utiliza el almacén de credenciales de Windows y la
aplicación no necesita exponer los secretos en su interfaz ni en sus datos
locales habituales.

Los adjuntos seleccionados se copian al almacenamiento administrado por la
aplicación mientras se prepara una tarea. Cuando un adjunto destinado a Jira se
sube correctamente, Jira Task Forge elimina sus bytes locales administrados y
conserva solamente los metadatos necesarios para el historial local. Los
archivos usados solo por IA se eliminan cuando la tarea alcanza el estado
`Created`; eliminar una tarea editable, una bandeja o un adjunto también elimina
sus archivos administrados.

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
