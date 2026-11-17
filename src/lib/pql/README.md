# PQL v1

El motor es puro: recibe una consulta, los issues ya autorizados y un contexto
con catálogos autorizados, identidad, equipo opcional y reloj ISO. El ámbito
de ruta, equipo y permisos debe aplicarse **antes** de invocar `execute`.
Una consulta vacía incluye todo ese ámbito; un diagnóstico nunca equivale a
una consulta vacía. La lectura y sus límites corresponden al consumidor.

La gramática usa `OR`, `AND`, `NOT`, paréntesis y las comparaciones `=`,
`!=`, `<`, `<=`, `>`, `>=`, `IN`, `NOT IN`, `IS EMPTY`, `IS NOT EMPTY` y
`~`. Las listas no pueden estar vacías. Strings entre comillas simples o
dobles permiten escapar su propia comilla y barra invertida. Los nombres de
campos, funciones y palabras clave no distinguen mayúsculas. `ORDER BY` acepta
hasta cinco campos escalares con `ASC` o `DESC`.

| Tipo | Campos | Operadores |
| --- | --- | --- |
| Enum | `status`, `type`, `agent.state`, `git.prState`, `review.state` | `=`, `!=`, `IN`, `NOT IN`, `IS [NOT] EMPTY` |
| Número | `priority`, `estimate` | Los anteriores y `<`, `<=`, `>`, `>=` |
| Fecha | `created`, `updated`, `due` | Los anteriores y `<`, `<=`, `>`, `>=` |
| Referencia | `assignee`, `creator`, `project`, `parent`, `team`, `cycle`, `epic`, `review.reviewer` | `=`, `!=`, `IN`, `NOT IN`, `IS [NOT] EMPTY` |
| Conjunto | `label` | Como referencia, por pertenencia |
| Texto | `text`, `review.verdict` | `=`, `!=`, `~`, `IS [NOT] EMPTY` |

`text` consulta título e identificador, no descripción; `~` busca un substring
literal sin distinguir mayúsculas. `epic` incluye la propia épica y sus
descendientes. Las referencias aceptan ID o nombre exacto no ambiguo; las
personas se identifican por su `userId`, no por el ID del documento miembro.
El contexto separa `members` y `agents`; ambos catálogos autorizados participan
en las referencias de persona. `me()` falla con diagnóstico de contexto si el
actor no aparece en ninguno de esos catálogos.
Un valor escalar vacío no satisface comparaciones ordinarias, ni siquiera `!=`;
un conjunto vacío sí satisface `label != x` y `label NOT IN (x)`.

`me()` resuelve la identidad de ejecución. `now()` y `startOfWeek()` usan el
reloj inyectado; `currentCycle()` y `endOfCycle()` requieren equipo explícito.
Si no hay ciclo activo, `currentCycle()` es una referencia vacía que no coincide
con issues bajo `=`, `!=`, `IN` ni `NOT IN`; `endOfCycle()` da error de contexto.
Las fechas son UTC: `YYYY-MM-DD` es medianoche UTC y los instantes requieren
`Z` u offset. Relativos como `-7d`, `+2w`, `-1m` usan días de 24 horas,
semanas de siete días y meses de calendario UTC con ajuste de fin de mes.
`updated < -2d` describe la última modificación, no el tiempo en un estado.

Sin orden explícito se usa `created DESC`; siempre se desempata por ID
ascendente. Los vacíos van al final en ambas direcciones. La comparación de
prioridad es numérica (0 a 4), pero al ordenar se usa el ranking visual
1, 2, 3, 4, 0 en ascendente. El motor no altera los arrays de entrada.
El texto admite hasta 4096 caracteres, 500 tokens y 20 niveles de anidación.
Los diagnósticos incluyen código, mensaje, rango UTF-16 y línea/columna.

Ejemplo:

```pql
status in (todo, in_progress) AND assignee = me() AND epic = TES-122
  AND priority <= 2 AND label in ("backend", "urgente") AND updated > -7d
ORDER BY priority ASC, updated DESC
```

Para repetir la medición local: `PQL_BENCH=1 npm test -- src/lib/pql/performance.test.ts`.
Una ejecución sobre macOS arm64 con Node 22.23.2 evaluó y ordenó 5000
fixtures en 7,34 ms; es una observación local, no una garantía de latencia.
El corpus exportable de `fixtures.ts` incluye resultados de consulta, errores con
rango completo y casos de referencias ambiguas/ajenas, límites y ciclos ausentes.

Para paridad, importar `fixtureCases`, `fixtureIssues` y `fixtureContexts` de
`fixtures.ts`. Cada caso usa `fixtureContexts[case.context ?? 'default']`;
los casos válidos declaran `ids` en el orden esperado y los inválidos declaran
`code` y `diagnostic` (rango UTF-16, línea y columna). Todos los contextos
y datos se exportan sin dependencias de UI ni Firestore.
