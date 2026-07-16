[English](installation-security.md) | [Español](installation-security.es.md) · [Volver al README](../README.es.md)

# Instalación y seguridad

## Instalar la beta actual

Descarga Jira Task Forge únicamente desde el
[versión oficial de GitHub](https://github.com/salmonsimon/jira-task-forge/releases/tag/v0.1.0-beta.1).

El instalador de Windows todavía no está firmado. Windows SmartScreen puede
mostrar una advertencia, por lo que debes confirmar que el instalador provenga
de este repositorio.

## Credenciales

Jira Task Forge guarda estos secretos en Windows Credential Manager:

- tokens de API de Jira;
- tokens OAuth de Notion;
- claves de API de OpenAI, Anthropic Claude o Google Gemini.

El diseño mantiene los secretos fuera de SQLite, los respaldos JSON, los registros de
la aplicación, las capturas y los archivos versionados. Un respaldo recupera el
trabajo local y la configuración, pero las credenciales deben conectarse
nuevamente en la instalación restaurada.

## Datos locales

La aplicación almacena localmente las Preparation Trays, tareas, descripciones
aceptadas, categorías, configuraciones no secretas, historial de sincronización
y metadatos de adjuntos. Los adjuntos seleccionados se copian al almacenamiento
local administrado por la aplicación.

El detalle sobre almacenamiento y limpieza está en el
[inventario de datos locales](local-data-storage-inventory.md).

## Conexiones de red

Según las acciones que ejecutes, Jira Task Forge puede conectarse con:

- Jira Cloud para probar la conexión, leer metadatos, ejecutar JQL y crear tareas;
- el proveedor de IA seleccionado para asistir JQL o descripciones;
- Notion y el backend OAuth de Jira Task Forge cuando habilitas la
  sincronización del catálogo.

El backend OAuth de Notion intercambia el código temporal sin incluir el client
secret de Notion dentro de la aplicación de escritorio. Consulta
[Conexión pública OAuth de Notion](notion-oauth-public-connection.es.md).

## Antes de conectar cuentas reales

- Revisa las [limitaciones conocidas de la beta](beta-limitations.es.md).
- Utiliza tokens y claves de API con los permisos mínimos necesarios.
- No compartas registros ni capturas que expongan códigos de autorización o
  tokens.
- Mantén un respaldo JSON actualizado de las bandejas importantes.

Reporta problemas reproducibles de seguridad o privacidad mediante
[GitHub Issues](https://github.com/salmonsimon/jira-task-forge/issues).
