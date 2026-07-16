[English](beta-limitations.md) | [Español](beta-limitations.es.md) · [Volver al README](../README.es.md)

# Limitaciones conocidas de la beta

Jira Task Forge es una beta pública. Revisa estos límites antes de utilizarla
para trabajo importante en Jira:

- Actualmente solo se distribuye para Windows.
- El instalador no está firmado, por lo que Windows SmartScreen puede mostrar
  una advertencia.
- Jira utiliza un token de API proporcionado por la persona usuaria; Jira OAuth
  todavía no está implementado.
- Los proveedores de IA utilizan claves de API proporcionadas por la persona usuaria;
  el OAuth de esos proveedores todavía no está implementado.
- La creación de relaciones `blocks` y `blocked by` en Jira sigue pendiente
  en el [Issue #200](https://github.com/salmonsimon/jira-task-forge/issues/200).
- La sincronización con Notion requiere una página propia seleccionada durante
  el flujo OAuth. El ejemplo público no puede utilizarse directamente como
  fuente.
- La exportación CSV es una alternativa para importación administrativa, no un
  reemplazo del flujo controlado de creación mediante la API de Jira.
- El instalador todavía no cuenta con firma, actualización automática ni el
  pulido final de distribución.

Verifica las tareas creadas y los adjuntos subidos a Jira antes de eliminar
material fuente importante.
