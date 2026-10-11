# TES-340: selección del workspace al recargar

La causa era `appStore`: la selección solo existía en memoria y la primera
snapshot de membresías elegía siempre el primer workspace. Ahora se persiste
solo el ID en `localStorage`, bajo `pulse:active-workspace:<userId>`. La sesión
restaura ese ID únicamente si figura en los workspaces accesibles. Una selección
inválida vuelve al primero disponible (o a `null` si no hay ninguno), y actualiza
la preferencia guardada.

`AuthGuard` bloquea el contenido hasta validar la lista de membresías y limpiar
los stores para el nuevo usuario/workspace. Cancela las suscripciones anteriores
y sigue comprobando los claims antes de iniciar las nuevas. Las lecturas
asíncronas de membresías descartan respuestas obsoletas y respuestas recibidas
después de cancelar la suscripción.

## Evidencia automatizada

- `node --test scripts/workspace-selection.test.mjs scripts/workspace-access.test.mjs`:
  12 pruebas aprobadas. El usuario de prueba tiene dos workspaces. Se selecciona
  el segundo, se recrea el store diez veces (simulando recargas), se alterna el
  orden de las membresías y se comprueba que sigue seleccionado. Después se
  cambia al primero y se comprueba otra recarga.
- También se cubren ID eliminado, pérdida de membresía, lista vacía, metadata
  actualizada, aislamiento por usuario, logout, respuestas asíncronas fuera de
  orden, ausencia de almacenamiento y cancelación durante el refresh de claims.
- La prueba de render de `AuthGuard` usa snapshots simuladas del store y comprueba
  que oculta el contenido antes de validar membresías y durante cambios,
  revocación de acceso y cambio de usuario. Una vez limpiados los datos, permite
  el contenido en rutas de issues, proyectos y configuración.
- `npm run lint` y `npx tsc --noEmit`: aprobados. El script de sincronización de
  tipos omite la comparación porque busca el backend con otro nombre de carpeta;
  se comprobó directamente que `domain.generated.ts` del worktree autorizado
  termina con el contenido exacto de `src/types/domain.ts`.
- `npx next build --webpack`: aprobado, incluyendo TypeScript y generación de
  las 15 páginas estáticas. `npm run build` (Turbopack) falla al abrir un puerto
  local para procesar CSS: `Operation not permitted`. También sucede al solicitar
  ejecución fuera del sandbox; no se cambió la configuración del proyecto.

## Límites y comprobación con una sesión real

Las recargas automatizadas recrean el store y conservan el almacenamiento de un
usuario simulado. La prueba de render no monta efectos ni conecta con Firebase.
No se verificó una sesión real con múltiples workspaces ni una recarga completa
del navegador autenticado. Si el navegador bloquea `localStorage`, la selección
funciona en memoria, pero no puede persistir entre recargas.

Para completar la comprobación manual, usar una cuenta con acceso a dos
workspaces: seleccionar el segundo y recargar repetidamente desde issues,
proyectos y configuración, comprobando tanto el selector como los datos.
Cambiar al primero y repetir. Finalmente, revocar el acceso al workspace activo
o eliminarlo: la recarga debe elegir uno accesible y no mostrar los datos del
anterior. Sin membresías, no debe aparecer contenido de otro workspace.
