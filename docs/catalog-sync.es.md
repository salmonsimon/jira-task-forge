[English](catalog-sync.md) | [Español](catalog-sync.es.md) · [Volver al README](../README.es.md)

# Guía de sincronización del catálogo

Jira Task Forge utiliza un catálogo de áreas para mantener consistentes las
opciones de captura, las etiquetas de Jira, los tipos de tarea y los formatos de
entrega de las descripciones asistidas. Puedes mantener ese catálogo
manualmente o sincronizarlo desde Notion.

## Elegir un modo de catálogo

Usa **Manual** cuando quieras la configuración más corta, solo necesites una
lista pequeña de áreas o no quieras conectar Notion. Las áreas manuales forman
parte de los datos locales y se incluyen en los respaldos JSON.

Usa **Sync from Notion page** cuando quieras un catálogo reutilizable que pueda
mantenerse fuera de la aplicación o compartirse entre instalaciones.

## Modo Manual

1. Abre `Categories`.
2. Mantén el modo del catálogo en `Manual`.
3. Agrega las áreas que quieras utilizar durante la captura.
4. Revisa cada área antes de utilizarla para crear tareas en Jira.

Este modo no requiere Notion ni OAuth.

## Sincronizar desde Notion

El ejemplo público muestra la estructura esperada, pero no puede utilizarse
directamente como tu fuente OAuth. La página seleccionada mediante OAuth debe
pertenecer a tu propio espacio de trabajo de Notion y ser accesible para la
conexión de Jira Task Forge.

Comienza con estas referencias públicas:

- [Requisitos de la fuente del catálogo JTF](https://app.notion.com/p/salmonsimon-workflow/JTF-Catalog-Source-Requirements-395c335aece48144b2dbe2cc2e0de298)
- [Ejemplo público del catálogo JTF](https://app.notion.com/p/salmonsimon-workflow/JTF-Sync-Catalog-Public-Example-397c335aece481818013f3fe51cd2030)

### Conectar una página propia

1. Abre `JTF Sync Catalog Public Example`.
2. Duplica la página o copia el contenido del catálogo a tu propio espacio de
   trabajo.
3. Mantén o mueve la copia al nivel superior de ese espacio de trabajo.
4. En Jira Task Forge, abre `Categories` y elige `Sync from Notion page`.
5. Selecciona `Connect Notion`.
6. En la página de autorización de Notion, selecciona únicamente tu catálogo.
7. Vuelve a Jira Task Forge e ingresa la URL o el id de la página seleccionada.
8. Valida el catálogo.
9. Revisa las áreas y los formatos de entrega detectados.
10. Guarda el catálogo y ejecuta la sincronización.

## Por qué debe ser una página propia y de nivel superior

El selector de páginas OAuth controla qué contenido de Notion puede leer la
conexión de Jira Task Forge. Una página pública de otro espacio de trabajo es solo una
referencia y no puede agregarse automáticamente a tu autorización.

Una página dedicada de nivel superior también es más fácil de encontrar y
mantiene el permiso acotado. Evita seleccionar como origen una wiki o página de
proyecto amplia: autorizar una página padre también puede exponer sus páginas
hijas a la conexión.

## Qué información lee la aplicación

Jira Task Forge lee el bloque JSON legible por máquina dentro de la página
seleccionada. Ese contrato define:

- nombres visibles y alias seguros para las áreas;
- etiquetas de Jira;
- áreas habilitadas y deshabilitadas;
- asignación del tipo Story o Bug;
- formatos de entrega predeterminados;
- reglas condicionales para los formatos de entrega.

La aplicación no considera como datos oficiales del catálogo el texto
explicativo, los ejemplos, los comentarios ni las tablas decorativas.

## Solución de problemas

**La página no aparece en Notion**

Confirma que esté en tu propio espacio de trabajo, que tengas permiso para
compartirla y que se encuentre en el nivel superior. Reinicia la conexión y
selecciona esa página en el flujo OAuth.

**La validación falla**

Compara el bloque JSON con los requisitos públicos. Confirma que exista un solo
bloque de catálogo válido y que los campos obligatorios no hayan cambiado de
nombre.

**Ya no quieres sincronizar con Notion**

Cambia el modo del catálogo a `Manual` y mantén las áreas directamente en Jira
Task Forge.
