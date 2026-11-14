---
name: destilar
description: Crea o actualiza el archivo de una zona del producto en `docs/planes/<zona>.md`, el contexto para retomar sesiones (cómo es la zona hoy y qué falta). Gatillo principal, la palabra «destila» en el mensaje del usuario, normalmente seguida de una o varias tareas («destila: …»). También con /destilar o un cambio pedido en un plan. No se lanza por iniciativa propia al plantear una tarea.
---

# /destilar

Cada archivo describe una zona del producto y sirve para retomar sesiones sin ruido: quien lo lea sabe cómo es la zona hoy, qué se decidió y qué falta. El usuario lo revisa: tiene que leerse limpio y claro. Destila el modelo de la sesión, sea cual sea.

Propósito: que otro modelo lea el archivo y empiece con el contexto limpio, en vez de que uno solo haga una tarea grande con un contexto que no para de crecer. Lo que no ayude a eso, no se escribe. Las reglas del proyecto están en su `AGENTS.md` y mandan sobre esta skill.

## Estilo (obligatorio)

- Preferiblemente una línea por entrada; no es regla dura. Telegráfico: sin artículos ni relleno si se entiende igual.
- Especificidad justa para que quien retome sepa qué hacer. Rutas, nombres y cifras sólo si hacen falta para actuar; nada de líneas aproximadas (`~195`): anclas por nombre.
- Afirmar: «X hace Y», «Usar Z». Nada de «debería», «quizá», «se podría», «conviene».
- El porqué, tras ` — `, en pocas palabras.
- **Tope:** unos 6.000 caracteres sin contar las tareas pendientes, que son temporales. El hook de bienvenida avisa si se pasa: entonces se condensa o se separa una zona más profunda.
- Si una frase sobra sin perder información, se borra.

## Qué entra

Pregunta: **¿lo necesita quien retome y no lo dice el código?**

- **Entra:** cómo funciona la zona hoy, sus trampas, las decisiones con su porqué, las tareas pendientes y los errores sin resolver.
- **No entra:** el historial de lo hecho (va al mensaje de commit, ver «Hecho (sin commit)»), lo que se ve leyendo el código (ids, clases, listas de pruebas), tests corregidos, errores ya resueltos, comprobaciones sin lanzar (se dicen al cerrar, no son tareas), comandos, modelo, fechas, costes, sugerencias o mejoras no pedidas. Lo que debería tocarse y no se ha pedido va a la deuda técnica del proyecto.

## Primero, las preguntas

Antes de escribir nada, reunir lo que falta en todas las tareas del prompt, para que Haiku programe a la primera:

1. Lo que se pueda comprobar en el código se comprueba ahí.
2. Dudas de intención o comportamiento: buscar en el archivo de la zona; después, subiendo por el nombre, en la zona superior (`ficha-counters` → `ficha`), que se lee sólo entonces.
3. Lo que siga abierto, o si no hay zona superior, se pregunta al usuario en una sola ronda, todo junto. Si la respuesta sirve para más adelante, va a «Decisiones».

## Pasos

1. **Zona:** el nivel más profundo del producto que abarca todo el cambio, con formato `pantalla[-parte]`, en minúsculas, sin tildes y fácil de decir por voz. Archivos sueltos en `docs/planes/`, sin subcarpetas. Una zona puede cubrir varios componentes; no hay un archivo por carpeta de código.
   - Tabla de counters de la ficha: `ficha-counters`.
   - Filtros, sólo en la ficha: `ficha-filtros`.
   - Filtros compartidos por ficha y comparador: `filtros`.
   - Toda la calculadora de tipos: `calculadora`.
2. **Reutilizar antes que crear:** listar `docs/planes/`. Si la zona existe, se actualiza. Si no, se usa la zona superior cuando exista y el cambio encaje. Sólo si no, se crea y se dice el nombre en la respuesta.
3. **Varias tareas en un prompt:** cada una va a su zona. Las que tengan varias partes se dividen en subtareas (ver «Subtareas»).
4. **Lo común va arriba:** lo que afecta a varias subzonas se escribe en la zona superior y no se repite en cada una.
5. **Al editar:** leer el archivo entero y reescribir en su sitio lo que cambie. Nunca añadir un diario ni apartados con fecha. Una línea de «Contexto» o «Decisiones» que deja de ser cierta se reescribe o se borra; «Carpetas» se mantiene al día.
6. **Comprobar contra el código** antes de guardar: cada ruta, función y nombre citado existe.
7. **Cerrar** diciendo qué ha cambiado, que lo revise con `git diff docs/planes/<zona>.md` y la frase para seguir: «Vamos a continuar con <zona>».

`docs/planes/historico/` guarda planes antiguos con otro formato: no se editan ni se leen salvo que el usuario los cite.

## Subtareas

Las ejecutan subagentes Haiku con `/tarea`, que no han visto la conversación. Aquí sí va todo el detalle que necesiten; se borra al curar.

- **Autocontenida:** se entiende con «Contexto» y la propia subtarea, sin leer las demás.
- **Pequeña:** de 1 a 3 archivos de código más sus pruebas. Si es más grande, se parte.
- **Sin elecciones abiertas:** nombre, ubicación, texto y comportamiento quedan decididos con «Primero, las preguntas».
- **Contenido:** archivos, pasos numerados (con el fragmento de código si no es obvio), textos de interfaz con su clave y su valor en cada idioma, pruebas (archivo y nombre de cada una), qué no tocar y cuándo está hecha.
- **Anclas por nombre**, nunca por número de línea.
- **Orden:** se numeran en el orden de ejecución. «En paralelo» sólo si no comparten archivos.

## Plantilla (`docs/planes/<zona>.md`)

El hook de bienvenida (`planes-bienvenida.mjs`) lee las tareas pendientes (`## [ ] N. …`) y la sección «Hecho (sin commit)»: respetar ese formato exacto. Las subtareas (`### [ ] N.M …`) no las cuenta. Sin apartados vacíos: lo que no tenga contenido no se escribe. «Carpetas» son las rutas del código que cubre la zona, relativas a la raíz del código (en Angular, `src/app/`); en carpetas genéricas (`core/services`, `core/utils`), el archivo: así se encuentra el plan buscando lo que se va a tocar. «Pruebas» son los archivos de pruebas de la zona: los nombres de sus pruebas dicen qué hace y qué no se puede romper, y por eso el plan no lo repite. Lo que no deba romperse y no tenga prueba va a «Contexto» como trampa.

```markdown
# <Pantalla · parte>

Carpetas: `<ruta>`, `<ruta>`
Pruebas: `<archivo de pruebas>`, `<archivo de pruebas>`

## Contexto
(La primera línea dice de qué va la zona y se entiende sola; después, cómo funciona hoy y sus trampas vigentes. Es el contexto estable: se reescribe, no crece con cada tarea.)

## Decisiones
- (Sólo las que alguien podría deshacer sin saberlo; también lo descartado si evita repetirlo.) — porque …

## [ ] 1. <Tarea en una línea>

(Debajo, sólo lo que no se deduzca del título y del contexto.)

### [ ] 1.1 <Subtarea, si la tarea tiene varias partes>

- **Archivos:** …
- **Qué hacer:**
  1. …
- **Pruebas:** `<archivo de pruebas>` — «…»
- **No tocar:** …
- **Hecho cuando:** …

## Bloqueos
- Tarea 1: qué pasa · qué hay que decidir

## Hecho (sin commit)
- (Una línea por tarea terminada desde el último commit, escrita para el mensaje de commit. Al commitear pasa al cuerpo del mensaje y la sección se borra: ver «Al commitear» en la skill `tarea`.)
```
