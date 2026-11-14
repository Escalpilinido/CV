---
name: tarea
description: Continúa el archivo de una zona `docs/planes/<zona>.md` en una sesión nueva, con cualquier modelo, y lo deja actualizado al terminar. Usar cuando el usuario diga «Vamos a continuar con X», «seguimos con X», «continúa X» o invoque /tarea X [N | N-M], donde X es el nombre de una zona; también sin zona («Vamos a continuar», «continuar por donde lo dejamos», «seguimos», /tarea): el último plan que se tocó, tenga pendientes o no.
---

# /tarea

Las reglas del proyecto (alcance, pruebas, comprobaciones, cómo explorar el código, dónde va la deuda técnica) están en su `AGENTS.md` y mandan sobre esta skill.

## Pasos

1. **Localizar la zona:** `docs/planes/<X>.md`; los espacios dictados por voz equivalen a guiones («ficha counters» → `ficha-counters`). Si no existe, listar `docs/planes/` y preguntar cuál. **Sin zona** («Vamos a continuar», «por donde lo dejamos»): el último plan que se tocó, tenga pendientes o no: el que nombra la línea «Para seguir por donde lo dejamos» del hook `SessionStart` (`planes-bienvenida.mjs`); si no está en el contexto, ejecutar ese hook con `node`. Decir en una línea qué plan se retoma y seguir.
2. **Elegir tareas:** las que diga el usuario (`3`, `1-3`); si no dice ninguna, **la siguiente pendiente** (`## [ ] N.`), sólo una. Si tiene subtareas hechas, sigue por las pendientes (`### [ ] N.M`). Si no hay pendientes, decirlo y no hacer nada.
3. **Leer el archivo entero.** Es corto y es todo el contexto de partida.
4. **Comprobar antes de empezar:** si una tarea elegida depende de otra pendiente o la afecta un bloqueo abierto, parar y decirlo. Reunir las dudas de todas las tareas elegidas y resolverlas con el paso 6 antes de ejecutar nada: al usuario se le pregunta en una sola ronda, todo junto.
5. **Ejecutar la tarea**, con las reglas de `AGENTS.md`. No ampliar el alcance ni «mejorar» nada que la tarea no pida.
   - **Sin subtareas:** la hace el modelo de la sesión. Si tiene varias partes, puede crearlas antes, con las reglas de «Subtareas» de la skill `destilar`.
   - **Con subtareas:** avisar del reparto en una línea y lanzar un subagente Haiku (`model: haiku`) por subtarea, a la vez sólo las marcadas «en paralelo». También si la sesión es Haiku, aunque no sea lo ideal.
   - **Prompt del subagente:** la ruta del archivo y el número de subtarea («lee su Contexto y la subtarea N.M»), sin copiar su texto, y la regla de exploración de código del `AGENTS.md` del proyecto si la tiene (por ejemplo, consultar el grafo antes de buscar o leer). No edita el plan, no hace `git add` ni ejecuta comprobaciones. Devuelve en 5 líneas como mucho, sin pegar código, qué ha hecho, los archivos tocados y sus dudas, sin resolverlas.
   - **Al volver cada subagente:** el modelo de la sesión comprueba el «Hecho cuando» contra el `git diff` de los archivos tocados, sin releer el resto, anota el resultado en la subtarea y la marca `### [x] N.M`. Las dudas siguen el paso 6.
6. **Si hay dudas de intención o comportamiento** (un paso ambiguo, el archivo contradice el código): **no improvisar**. Las imprevistas que surjan al ejecutar siguen el mismo orden.
   1. Buscar en el archivo de la zona.
   2. Subir por el nombre a la zona superior (`ficha-counters` → `ficha`), que se lee sólo entonces, y seguir subiendo si hay más niveles.
   3. Si sigue la duda o no hay zona superior, preguntar al usuario. Si la respuesta sirve para más adelante, va a «Decisiones». Queda como bloqueo sólo si no se puede avanzar tras preguntar.

   Lo que se pueda comprobar en el código se comprueba ahí.
7. **Curar el archivo al terminar cada tarea** (obligatorio, también si no se ha podido acabar; lo hace el modelo de la sesión), con el estilo y el filtro de la skill `destilar`. Reescribir en su sitio; nunca añadir un diario:
   - Tarea terminada: se quita de la lista con sus subtareas y las pendientes se renumeran desde 1. Lo que ha cambiado para quien usa el producto va en una línea a «Hecho (sin commit)», al final del archivo, escrita para valer tal cual en el mensaje de commit. Tarea sin acabar: sigue en la lista, diciendo lo que falta; sus subtareas se conservan.
   - «Contexto», «Carpetas» y «Pruebas»: se reescriben si cambia cómo funciona la zona, aparece una trampa vigente o se toca una carpeta o un archivo de pruebas nuevos. «Contexto» dice cómo es la zona hoy, no lo que se hizo.
   - «Decisiones»: las tomadas dentro del margen de la tarea que alguien podría deshacer sin saberlo, con su porqué. La que deja de ser cierta se borra.
   - Tareas siguientes que citen algo que esta tarea ha cambiado (un nombre, una ruta): corregir la referencia.
   - «Bloqueos»: `- Tarea N: qué pasa · qué hay que decidir`. Quitar los resueltos.
   - **Fuera:** tests corregidos, errores ya resueltos, comprobaciones sin lanzar (se dicen al cerrar), comandos, modelo, fechas, costes, sugerencias y mejoras no pedidas. Lo que debería tocarse y no se ha pedido, a la deuda técnica del proyecto.
8. **No hacer `git add`:** el archivo queda sin stage hasta el commit.
9. **Cerrar** diciendo qué se ha hecho, los bloqueos si los hay, qué comprobaciones quedan sin lanzar, que revise el archivo con `git diff docs/planes/<X>.md` y la frase para la próxima sesión: «Vamos a continuar con <X>». Si quedan tareas, proponer seguir en una sesión limpia (`/clear`): el archivo ya tiene el contexto.

## Al commitear

Commit sólo si lo pide el usuario, en la sesión que sea: lo pendiente de pasar al commit vive en los planes, no en la conversación. Antes del `git add`:

1. Ejecutar `node <carpeta>/planes-commit.mjs`, que está junto al hook de bienvenida (`.claude/hooks/` del proyecto o `~/.claude/hooks/`). Borra «Hecho (sin commit)» de todos los planes e imprime su contenido en bloques `Hecho (<zona>):`, que van tal cual al cuerpo del mensaje de commit. Lo hecho sin pasar por `/tarea` no está anotado: se añade al mensaje desde el diff.
2. Condensar los planes que el script liste (los tocados que pasan del tope o conservan el formato antiguo), con el estilo y el filtro de la skill `destilar`, y decir en una línea qué se ha quitado de cada uno. Los demás planes no se tocan.
3. El plan entra en el mismo commit que el código.

Así el historial guarda lo hecho y el plan sólo lo vigente; se recupera con `git log --grep "<palabra>"` o `git log -p -- docs/planes/<zona>.md`.
