[English](notion-oauth-public-connection.md) | [Español](notion-oauth-public-connection.es.md) · [Volver al README](../README.es.md)

# Crear y alojar tu propia conexión pública OAuth de Notion

> Esta es una guía avanzada para quienes mantienen un fork o una versión
> autohospedada de Jira Task Forge. Si utilizas la aplicación estándar desde
> GitHub Releases, no sigas la configuración de publicación o backend descrita
> abajo. Selecciona `Connect Notion` en la aplicación y continúa con la
> [guía de sincronización del catálogo](catalog-sync.es.md).

Este documento explica cómo crear y alojar la conexión pública OAuth de Notion
que necesita un despliegue independiente de Jira Task Forge. La aplicación de
escritorio nunca debe contener el secreto de cliente de Notion.

La persona que publica Jira Task Forge crea una única conexión pública. Las
personas usuarias no crean sus propias integraciones, no pegan secretos de
integración y no agregan manualmente la conexión desde el menú de una página.
Solo seleccionan `Connect Notion`, autorizan Jira Task Forge en la página OAuth
de Notion y eligen el catálogo en el selector de páginas.

El catálogo debe ser una página propia del espacio de trabajo que autoriza la
conexión. La [guía de sincronización](catalog-sync.es.md) explica cómo copiar el
ejemplo público, mantenerlo como una página dedicada de nivel superior y
seleccionar únicamente esa página.

## Por qué Jira Task Forge necesita un backend

- Notion entrega la página de autorización en
  `https://api.notion.com/v1/oauth/authorize`.
- Jira Task Forge necesita una URI de redirección a la que Notion pueda volver
  después de la autorización.
- El código temporal debe intercambiarse por tokens desde un servidor confiable,
  porque ese intercambio utiliza el secreto de cliente de Notion.
- `https://notion-oauth.salmonsimon.com` recibe el retorno y ejecuta el
  intercambio. No reemplaza la página OAuth de Notion.

## Configuración de la persona publicadora

1. Crea una conexión pública de Notion para Jira Task Forge en el portal de
   desarrolladores de Notion.
2. Selecciona `Any workspace` como ámbito de instalación.
3. Registra
   `https://notion-oauth.salmonsimon.com/notion/oauth/callback` como URI de
   redirección.
4. Despliega las rutas de `api/notion/oauth/` detrás de
   `https://notion-oauth.salmonsimon.com`.
5. Mantén el id y el secreto de cliente como secretos del backend.

El archivo `vercel.json` del repositorio redirige las rutas públicas
`/notion/oauth/...` hacia las funciones `/api/notion/oauth/...` de Vercel.

## Flujo de la persona usuaria

1. Selecciona `Connect Notion` en Jira Task Forge.
2. Autoriza la conexión pública en la página de Notion.
3. Selecciona únicamente la página dedicada del catálogo.
4. Copia el código temporal mostrado por la página de retorno.
5. Completa ese código en Jira Task Forge.
6. Confirma la URL o el id de la página seleccionada.
7. Jira Task Forge valida la página y guarda los tokens OAuth en Windows
   Credential Manager.

## Acceso a una página propia de nivel superior

- Cada persona autoriza su propio espacio de trabajo y recibe sus propios tokens.
- El ejemplo público pertenece a otro espacio de trabajo y solo sirve como
  plantilla.
- La copia debe estar dentro del espacio de trabajo que se está autorizando.
- Para facilitar su selección y limitar el permiso, se recomienda una página
  dedicada en el nivel superior del espacio de trabajo.
- No selecciones como origen una wiki o página padre amplia. Autorizar una página
  padre puede dar acceso a sus páginas hijas.
- Una persona del equipo puede necesitar `Full access` sobre el catálogo para
  que Notion permita compartirlo con la conexión.
- Seleccionar únicamente el catálogo dedicado no debería conceder acceso a su
  página padre.

## Configuración de la aplicación de escritorio

- `JTF_NOTION_OAUTH_BACKEND_BASE_URL`: URL base opcional. El valor
  predeterminado es `https://notion-oauth.salmonsimon.com`. Las URLs no locales
  deben utilizar HTTPS.
- `JTF_NOTION_OAUTH_START_URL`: endpoint completo opcional para iniciar la
  autorización. El valor predeterminado es
  `{backendBaseUrl}/notion/oauth/start`.
- `JTF_NOTION_OAUTH_EXCHANGE_URL`: endpoint completo opcional para intercambiar
  el código. El valor predeterminado es
  `{backendBaseUrl}/notion/oauth/exchange`.

La construcción local mediante `JTF_NOTION_OAUTH_CLIENT_ID` y
`JTF_NOTION_OAUTH_REDIRECT_URI` es solo una facilidad de desarrollo. En
producción, el backend debe administrar el id de cliente, la URI de redirección
y el secreto de cliente.

## Configuración del backend OAuth

- `JTF_NOTION_OAUTH_CLIENT_ID`: id de cliente de la conexión pública.
- `JTF_NOTION_OAUTH_CLIENT_SECRET`: secreto de cliente de la conexión pública.
- `JTF_NOTION_OAUTH_REDIRECT_URI`: URI de retorno registrada en Notion.
- `JTF_NOTION_OAUTH_BACKEND_PORT`: puerto opcional para desarrollo local. El
  valor predeterminado es `5177`.

En producción, configura estas variables en Vercel y registra
`https://notion-oauth.salmonsimon.com/notion/oauth/callback` tanto en Vercel
como en la conexión pública de Notion.

## Desarrollo local

Utiliza localhost únicamente para probar deliberadamente sin el backend
desplegado.

Inicia el backend de intercambio:

```bash
JTF_NOTION_OAUTH_CLIENT_ID="<client-id>" \
JTF_NOTION_OAUTH_CLIENT_SECRET="<client-secret>" \
JTF_NOTION_OAUTH_REDIRECT_URI="http://127.0.0.1:5177/notion/oauth/callback" \
npm run notion:oauth-backend
```

En otra terminal, inicia la aplicación con la URL local:

```bash
JTF_NOTION_OAUTH_BACKEND_BASE_URL="http://127.0.0.1:5177" \
npm run tauri dev
```

## Secuencia de seguridad

1. El backend de Tauri genera un estado OAuth y lo guarda temporalmente en
   Windows Credential Manager.
2. El backend OAuth construye la URL de autorización de Notion.
3. La persona autoriza la conexión y selecciona el catálogo.
4. Notion vuelve a la página de retorno, que muestra un código temporal sin
   almacenar tokens.
5. La aplicación verifica el estado e intercambia el código mediante el backend.
6. La aplicación prueba el acceso a la página seleccionada.
7. Los tokens se guardan únicamente si la página supera la validación.

Los tokens nunca deben escribirse en SQLite, respaldos, registros, capturas ni
archivos versionados. Un intercambio fallido o una página inválida no deben
persistir credenciales.

## Validación pendiente para un despliegue propio

- Crear la conexión pública con el ámbito de instalación `Any workspace`.
- Desplegar las rutas OAuth con el secreto de cliente almacenado en el servidor.
- Ejecutar una prueba funcional contra un catálogo de prueba dedicado.
- Evitar imprimir el código de autorización, el token de acceso o el secreto de
  cliente durante la validación.
