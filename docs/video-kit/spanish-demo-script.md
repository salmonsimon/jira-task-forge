# Guion Espanol De Demo

Duracion objetivo: 60-90 segundos.

> Jira Task Forge es una app local para preparar tareas antes de crearlas en
> Jira.
>
> La idea es simple: primero capturo el trabajo en una bandeja local, reviso el
> nombre, el area, la prioridad y el alcance, y solo despues decido que se envia
> a Jira.
>
> Para cada tarea puedo pedir una descripcion asistida por IA. La app soporta
> OpenAI, Claude y Gemini con mi propia API key guardada en Windows Credential
> Manager. La IA no sube nada automaticamente: genera una propuesta.
>
> En Proposal Review reviso seccion por seccion. Puedo aceptar una parte,
> rechazarla, editarla a mano o pedir una nueva revision. El formato final queda
> forzado al estilo que uso en Jira: historias con contexto, alcance, criterios
> de aceptacion y checklist; bugs con problema, pasos para reproducir,
> resultado actual, resultado esperado y evidencia.
>
> La app tambien normaliza nombres. Por ejemplo, un proyecto ficticio como F1 Car
> Simulator puede crear una epic como `[F1 Car Simulator] [Gameplay] Pit Stop
> Polish`, y una historia como `[Gameplay] Smooth pit entry steering assist`.
>
> Las areas pueden manejarse manualmente o sincronizarse desde una pagina propia
> de Notion. El ejemplo publico sirve para copiar la estructura, pero cada
> usuario debe duplicarlo en su workspace, compartir esa pagina en el OAuth
> picker, validar el catalogo y luego sincronizar.
>
> Cuando todo esta revisado, Jira Task Forge puede crear epics, stories o bugs,
> subtareas aceptadas y adjuntos seleccionados. Tambien incluye JQL asistido por
> IA para consultar Jira sin abrir todo el flujo del navegador.
>
> Esta beta es publica, Windows-only y puede tener errores. El objetivo es que la
> preparacion de tareas sea mas ordenada, revisable y segura antes de tocar Jira.
