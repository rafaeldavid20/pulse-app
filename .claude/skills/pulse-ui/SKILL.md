---
name: pulse-ui
description: Convenciones de UI de Pulse — tokens de color, componentes base, densidad, estados vacíos, updates optimistas y UX de teclado. Usalo al crear o modificar cualquier pantalla, panel, modal o componente del frontend de pulse-app.
---

# UI de Pulse

Pulse es un issue tracker estilo Linear: **denso, oscuro y manejable con el teclado**. La mayoría de los errores de UI acá no son "feo", son "no se parece al resto de la app".

Antes de escribir una pantalla nueva, abrí una parecida que ya exista y copiá su estructura. `IssueList`, `IssuePeekPanel` y `AgentsSection` son buenas referencias.

## Colores: sólo tokens

Todos los colores salen de `@theme` en `src/app/globals.css`. **Nunca escribas un hex en un `className`.** La única excepción son los colores que vienen de los datos (el color que el usuario eligió para una etiqueta o un proyecto), que van por `style`.

Superficies, de atrás hacia adelante: `bg-base` (fondo de la app) → `bg-surface` (tarjetas, paneles) → `bg-elevated` (inputs, selects) → `bg-hover` → `bg-active`.

Bordes: `border-subtle` (separadores), `border-default` (bordes de caja), `border-strong` (énfasis).

Texto, en orden de importancia: `text-primary` (contenido) → `text-secondary` (etiquetas, apoyo) → `text-tertiary` (estados vacíos, metadata) → `text-muted` (casi invisible, usalo poco).

`text-accent` / `bg-accent` para lo seleccionado o activo. Prioridades y estados tienen sus propios tokens (`text-priority-urgent`, `text-status-done`, …): usá esos y no inventes equivalencias.

**Pulse es dark-only.** No hay tema claro ni `prefers-color-scheme` en el CSS, así que no escribas variantes `dark:` ni pruebes contraste "en claro" — no existe.

## Componentes base

Usá `Button`, `Input` y `Modal` de `src/components/ui/`. No armes un `<button>` con clases a mano: `Button` ya trae variantes (`primary`, `secondary`, `ghost`, `danger`) y tamaños (`sm`, `md`, `lg`) con su estado `disabled` y su `active:scale`.

Para combinar clases, `cn()` de `@/lib/utils`.

Iconos: `lucide-react`, tamaño `w-3.5 h-3.5` o `w-4 h-4` en línea con texto chico.

## Densidad

Es una herramienta de trabajo, no una landing. El texto de interfaz es `text-xs` o `text-sm`; `text-base` es para títulos de sección. Las etiquetas de formulario van `text-xs font-semibold text-secondary`. Los espaciados típicos son `gap-1`/`gap-1.5` dentro de una fila, `gap-4` entre bloques. Una fila de lista ronda `px-3 py-2.5`.

Si tu pantalla se siente aireada comparada con `IssueList`, está mal.

## El texto largo desborda

Es el bug más repetido de esta app. Todo lo que venga de datos —nombres de repo `owner/repo`, mensajes de error de una API, comandos para copiar, emails, nombres de proyecto— puede ser más largo que su caja.

- `min-w-0` en el contenedor flex (sin esto, `truncate` no hace nada).
- `truncate` + `title={valor}` en identificadores, para que el valor completo siga disponible al pasar el mouse.
- `break-words` o `break-all` cuando el valor completo importa y no se puede cortar (comandos, IDs).

Probalo con el string real más largo que pueda aparecer, no con "Proyecto 1".

## Estados vacíos, de carga y de error

Ninguna lista puede quedar en blanco sin explicación.

- Vacío: `<p className="text-xs text-tertiary py-2">Todavía no hay …</p>`, en el mismo tono resignado del resto ("Todavía no creaste ninguna clave").
- Cargando: `<Loader2 className="w-4 h-4 animate-spin" />` centrado.
- Error: `text-priority-urgent`, con el motivo, no "algo salió mal".

Distinguí "no hay nada" de "todavía no cargó": son mensajes distintos y el usuario los lee distinto.

## Mutaciones: optimista con rollback

Toda escritura pasa por `callPlatformAction`. El patrón de la casa es: actualizar el estado local primero, llamar, y si falla **volver al valor anterior** y avisar con `toast.error('No se pudo …')` de `sonner`.

Nunca dejes la UI mostrando un estado que el servidor rechazó, y nunca falles en silencio: si el usuario tocó algo y no pasó nada, es un bug.

## Teclado

Es una app keyboard-first. `J`/`K` (y flechas) navegan listas, `Escape` cierra lo que esté abierto, `Cmd/Ctrl+K` abre la paleta. Si agregás una lista navegable, seguí `J`/`K`.

Una fila enfocada tiene que **verse** enfocada, y el foco se deriva en el render: si el elemento enfocado desaparece de la lista, el foco efectivo pasa al primero. No lo corrijas con un `setState` dentro de un `useEffect` — el lint lo rechaza y provoca renders en cascada.

## Responsive

Desktop y mobile comparten pantallas. Verificá a **375px**: sin scroll horizontal, sin texto cortado, sin controles apilados que se pisen. `flex-col sm:flex-row` y `flex-wrap` son los recursos habituales. Una tira de pestañas larga va con `overflow-x-auto` y `shrink-0 whitespace-nowrap` en los ítems.

## Navegación: rutas, no estado

Si una pantalla tiene secciones, que sean **rutas reales** con `<Link>` de Next, no pestañas guardadas en estado. Así el link se puede compartir, el botón "atrás" funciona y se puede mandar a alguien directo a donde tiene que tocar.

## Antes de dar por terminada una pantalla

- ¿Hay algún hex hardcodeado? (`grep -nE '#[0-9a-fA-F]{3,8}'` sobre lo que tocaste)
- ¿El texto largo desborda en alguna parte?
- ¿Qué se ve cuando la lista está vacía, cuando carga y cuando falla?
- ¿Se ve bien a 375px?
- ¿Quedó algún control que no hace nada? Un botón sin `onClick`, un filtro que no filtra, un campo que no se guarda. **Un control que promete una acción inexistente es peor que no tenerlo.**
- ¿Pasa `npm run lint`? Está en cero y tiene que seguir así.
