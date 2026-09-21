# Procedencia de este skill

No es código de Pulse. Es una copia de terceros, vendorizada a mano.

- **Origen**: plugin `impeccable`, https://github.com/pbakaus/impeccable
- **Versión copiada**: 4.3.1
- **Licencia**: Apache 2.0 (declarada en el frontmatter de `SKILL.md`)
- **Copiado el**: 2026-09-21

## Qué se copió y qué no

- `SKILL.md` y `reference/` (37 archivos): sí — es la parte de texto, la que el modelo lee.
- `scripts/` (1.7 MB): **no**. Es automatización de navegador (`live-browser*.js`,
  captura de pantalla) que no puede correr en un runner headless de GitHub
  Actions. El modo `live` del skill, que depende de eso, no funciona acá.

## Por qué esto es provisorio

Es una **foto**. Si el plugin se actualiza, esta copia no se entera: no hay
versión fijada que se pueda comparar, ni diff al actualizar, ni registro de
quién la aprobó. Un skill es una instrucción ejecutable que un agente con
permiso de escritura sobre este repo va a seguir, así que eso importa.

Ese es exactamente el flujo que tienen que resolver **TES-231 (M4)** —agregar un
skill escribiéndolo en Pulse— y **TES-237 (M10)** —importarlo desde una URL de
GitHub con versión fijada y revisión previa—. Cuando exista, esta copia manual
se reemplaza por ese mecanismo.
