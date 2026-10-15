# Configuración efectiva de Runner

En Configuración > Agentes, el dueño autorizado o un administrador puede
consultar el perfil confirmado del Runner vinculado y solicitar cambios de
modelo y checkout por repositorio. Las carpetas se muestran mediante alias
`Checkout N`; no se envían rutas a Pulse.

El formulario conserva los valores confirmados mientras espera a la máquina.
Guardar una solicitud no significa que haya sido aplicada. La aplicación
consulta su ID hasta recibir confirmación; después de una interrupción permite
reintentar ese mismo ID explícitamente. Sin conexión o capacidad v1 no se pueden
crear cambios nuevos. Un snapshot desconectado se identifica como histórico.
Los conflictos con cambios locales requieren recargar el perfil.

Los candidatos se registran desde la máquina con:

```sh
pulse-runner profile register --agent AGENT --repo owner/repo --directory LOCAL_GIT_ROOT
```

Quitar un override restaura el comportamiento predeterminado. Cada agente tiene
su propio perfil en cada instalación. Cambiar el Runner consulta la nueva
máquina, sin copiar carpetas. Los cambios confirmados rigen para jobs futuros;
los activos conservan su configuración y QA conserva sus snapshots.

Se requiere el backend y Runner coordinados de TES-294. Un Runner anterior
continúa ejecutando sus perfiles locales y muestra actualización requerida para
la edición remota. El contrato y la reproducción de las pruebas de integración
están documentados en `pulse-backend/docs/runner-profiles-v1.md`.

Verificación del frontend:

```sh
node --test scripts/runner-profile.test.mjs
npm run lint
npx tsc --noEmit
npx next build --webpack
```
