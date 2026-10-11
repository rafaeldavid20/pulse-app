# TES-341 — actualización automática de datos

## Implementación y latencia

Las colecciones legibles del cliente mantienen `onSnapshot`: issues, proyectos,
ciclos, etiquetas, equipos, miembros, comentarios y notificaciones. Se agregaron
listeners a los documentos de workspace y perfil; antes solo se volvían a leer
cuando cambiaba la membresía o se iniciaba sesión. El equipo seleccionado ahora
recibe el objeto actualizado, conservando su ID.

Agentes, Runners, jobs, GitHub, claves (solo metadatos), entornos, presupuesto,
calibración y consumo usan las acciones autorizadas existentes. No se abren
lecturas de colecciones que contienen secretos. `useLiveQuery` consulta al montar
y cada 3 segundos **después de terminar la petición anterior** en pestañas visibles
y conectadas. La latencia es ese intervalo más la duración de la consulta; no es
un stream instantáneo. También consulta al recuperar conexión, foco o visibilidad.
Las mutaciones locales exitosas invalidan las consultas montadas inmediatamente;
si hay una petición pendiente, se programa una consulta adicional sin solaparlas.

Cada consulta pertenece al usuario, workspace y filtros del consumidor. Al
cambiar ese contexto o desmontar se cancelan timers/listeners y se ignoran
respuestas tardías. Los errores descartan los datos anteriores y el próximo éxito
restablece la vista. Los errores terminales de los listeners globales también
limpian la colección afectada. Firestore reanuda sus listeners tras desconexiones
transitorias. Si la comprobación inicial de claims falla, se reintenta al recuperar
conexión/foco, sin recrear listeners que ya estaban activos.

## Matriz de cobertura

“Código” significa revisión de la ruta y sus fuentes, no una sesión autenticada
contra Firebase. “Automática” significa pruebas locales con fuentes simuladas.

| Pantalla / datos | Fuente actual | Escenarios revisados | Evidencia / límite |
| --- | --- | --- | --- |
| Issues, lista, board, timeline, calendario y Mis Issues | `AuthGuard` → issueStore → filtros y vistas | Altas, edición, borrado; equipo, filtros, permisos | Código: `useIssues`, `issueFilters`, stores; listeners existentes |
| Detalle de issue, jerarquía, progreso, QA, comentarios | Issue store y `subscribeIssueComments` | Cambios de propiedades/contadores, comentarios, borrado | Código; título y descripción ahora siguen snapshots sin sustituir el borrador local |
| Proyectos, detalle y métricas QA | Project e issue stores | Altas/edición/borrado y contadores | Código; modal captura una versión al abrir y conserva cambios durante snapshots |
| Épicas | Issue store | Hijos, estado, progreso | Código: cálculos derivados de la misma colección |
| Ciclos, detalle y configuración de ciclo | Cycle/team/issue stores | Cambios de ciclo, settings, issues y contadores | Código; `activeTeam` recibe cada versión nueva |
| Inbox y badge | Listeners del usuario, no del workspace | Alta, lectura, borrado y preferencias | Código; conserva el alcance global del Inbox y permisos del usuario |
| Configuración / workspace | Documentos de workspace por membresía | Renombrado externo/local, revocación, borrado, cambio de workspace | Automática: `workspace-selection.test.mjs`; campo intacto sigue la fuente, campo editado se conserva |
| Configuración / cuenta | Perfil y miembros | Cambios de nombre y preferencias externas | Código: listener de perfil y listener existente de miembros |
| Configuración / agentes y archivados | `agents.list`, `runners.list` | Alta/edición/archivo, visibilidad/ownership | Código + mecanismo automático; siempre vuelve a aplicar permisos del backend |
| Configuración / Runners y jobs | `runners.list`, `runners.listJobs` | Estado, heartbeat, job, cancelación, revocación | Código + mecanismo automático; ya no consulta solo cuando hay cancelaciones pendientes |
| Configuración / guardarraíles y calibración | `getAgentBudget`, `getQaCalibration`, workspace | Pausa, gasto, límites y QA | Código + mecanismo automático; campos modificados se preservan |
| Configuración / GitHub, API keys y Salesforce | `github.status`, `apikeys.list`, `environments.list` | Alta/edición/borrado, conexión/revocación | Código + mecanismo automático; selección de repos y modales no se reinician con cada consulta |
| Agentes / consumo | `agents.getUsage` con período vigente | Nuevos runs, finalización, costo/tokens, cambio de período | Código + mecanismo automático; el rango temporal se recalcula en cada consulta |
| Selectores de infraestructura en issues/proyectos | `useWorkspaceInfra` | Nuevos agentes/repos/entornos, cambio de workspace | Código + mecanismo automático; eliminado el caché permanente; modal cerrado no consulta |
| Paleta de comandos | Presupuesto autorizado mientras está abierta | Pausar/reanudar desde otra sesión | Código + mecanismo automático |

La verificación de preparación de Runner sigue siendo una acción explícita:
`runners.preflight` envía trabajo a la máquina y no es una lectura periódica. Su
resultado expira a los dos minutos como antes.

## Validación ejecutada

- `node --test scripts/*.test.mjs`: 18 pruebas pasan. Dos lectores independientes
  del mismo origen simulado reciben altas, modificaciones y eliminaciones sin
  refresh. Además se comprueban offline/reconexión, pestaña oculta/visible,
  permisos, invalidación durante consultas lentas, desmontaje, resuscripción y
  descarte de respuestas antiguas. La prueba de workspaces verifica listeners
  de documentos, renombrado externo y liberación de scopes revocados.
- `npm run lint` y `npx tsc --noEmit`: pasan.
- El chequeo estándar de tipos omite el backend por su nombre de carpeta en este
  worktree. Se comparó explícitamente el modelo con el worktree autorizado
  `rafaeldavid20__pulse-backend`: coincide exactamente, incluido el header/hash.
- `npx next build --webpack`: compilación y generación de todas las rutas pasan.
  `npm run build` (Turbopack) falla al abrir el puerto del worker de PostCSS por
  `Operation not permitted`; se reprodujo también con escalación. No se cambió
  el bundler predeterminado del proyecto.

## Límite de validación y procedimiento pendiente para QA

### Rework — intento 1

Se corrigieron ambos hallazgos de QA: el nombre sincronizado de workspace usa
el mismo valor vacío al comparar y actualizar cuando no queda workspace; el
título deja de estar marcado como editado al volver al valor actual del issue.
Así puede seguir recibiendo cambios externos sin perder un borrador pendiente.

`scripts/realtime-drafts.test.mjs` agrega tres regresiones: render de la pantalla
con workspace nulo (React SSR), edición B y vuelta a A antes del autosave seguida
de un título externo C, y preservación de B durante un cambio externo con limpieza
del estado editado al recibir el guardado propio. Los dos primeros tests fallan
contra `7903544` y pasan con la corrección; el tercero pasa en ambas versiones.
El test de título ejecuta los hooks y handler originales con renders/timers
simulados, no un navegador. La suite completa ahora tiene 21 pruebas que pasan;
lint y TypeScript pasan. El chequeo de sincronización de tipos omite backend
porque no existe el checkout esperado; este rework no cambia tipos de dominio.

### Corrección del intento 2

Se corrigió `DescriptionSection` para calcular el estado editado comparando con
la descripción vigente. Revertir al valor original cancela el autosave; un
borrador distinto sigue protegido ante cambios externos. Se agregaron tres
regresiones de descripción al harness existente: cambio externo antes y después
del timer cancelado, y preservación del borrador con reconocimiento del guardado
propio. Las dos primeras fallan sobre `529d69e` y pasan con la corrección.

Validación: 24 pruebas aprobadas con Node 22.23.2, ESLint, TypeScript y build
webpack aprobados. Node 20.11.1 falla en seis pruebas previas de mock timers;
Node 22 ejecuta toda la suite correctamente. El chequeo de tipos del script
estándar encuentra el backend primario local desactualizado; se verificó que el
modelo coincide exactamente con `pulse-backend` en `origin/main`. No se alteró
ningún modelo de dominio ni el checkout primario.

La validación con dos sesiones autenticadas sigue pendiente, con los límites
y procedimiento indicados a continuación.

No se ejecutaron dos sesiones de navegador autenticadas contra Firebase: este
job no aporta sesiones de prueba. Las pruebas de dos lectores son simuladas y no
certifican las reglas desplegadas, claims, latencia real ni todos los formularios
interactivos. El criterio de dos sesiones reales se reporta como no verificable.

En un workspace de prueba, abrir sesiones A y B con permisos distintos. Mantener
cada fila de la matriz abierta en A y hacer altas/ediciones/borrados desde B (y
una actualización de estado de Runner desde backend). Verificar filtros y
contadores; esperar snapshot o 3 segundos más latencia según la fuente. Repetir
con un campo sin guardar en A, offline/online, cambio de workspace con petición
pendiente, salida de la pantalla y revocación de acceso. Comprobar que no hay
datos del workspace anterior, sobrescritura de borradores, navegación inesperada
ni peticiones periódicas tras desmontar. Revisar carga de callables con varios
tabs/agentes: las consultas son por lector montado y no usan un stream compartido.
