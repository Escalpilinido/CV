# Contexto entre sesiones (Claude Code)

Kit para gastar menos tokens: el contexto de cada zona del producto vive en un archivo corto (`docs/planes/<zona>.md`) y cada tarea se hace en una sesión limpia que lo lee, en vez de en una sesión larga cuyo contexto no para de crecer.

## Cuándo cambiar de sesión

| Situación | Qué hacer |
|---|---|
| Tarea terminada | Sesión nueva (`/clear`). El plan ya guarda el contexto. |
| Tema nuevo, sin relación con lo anterior | Sesión nueva. |
| El contexto pasa de 100.000 tokens y queda trabajo | Cerrar la tarea o dejarla anotada en el plan, y `/clear`. |
| Vuelves tras más de una hora y el contexto es grande | Sesión nueva: la caché caducó y se reescribe entera. |
| Retoque de lo recién hecho, sobre los mismos archivos | Seguir en la sesión. |
| Pregunta corta sobre lo que hay en pantalla | Seguir en la sesión. |

Regla rápida: seguir compensa si quedan menos de unas 15 llamadas a herramientas sobre lo ya leído. Con más, sale más barato empezar limpio. El tamaño del contexto se ve con `/context`.

Por qué: cada llamada a una herramienta relee todo el contexto. Arrancar una sesión cuesta poco y una sola vez; un contexto grande se paga en cada llamada.

**Acrónimos:**
- USD: dólar estadounidense
- API: interfaz de programación de aplicaciones

## Datos que lo respaldan

Medido en Pokédexter con `medir-tokens.mjs` (119 sesiones, 6.478 peticiones, 280 USD a precio de API, hasta el 2026-11-14):

- Releer contexto, 39 % del coste; escribir caché, 34 %; salida, 26 %.
- Las sesiones de 60 peticiones o más son el 16 % de las sesiones y el 67 % del coste.
- Coste por petición según el contexto: 0,035 USD de 50.000 a 100.000 tokens; 0,048 hasta 200.000; 0,075 por encima.
- Arrancar una sesión: 0,09 USD (54.000 tokens de base). Todos los arranques suman el 6 % del coste.
- Caché caducada por pausas: 4 %.

La regla de las 15 llamadas sale de ahí: empezar limpio cuesta el arranque más volver a leer el plan y el código (unos 0,35 USD con Opus), y cada llamada con 250.000 tokens de contexto cuesta unos 0,03 USD más que con 90.000. Es una estimación.

Para repetir la medición en cualquier proyecto:

```
node medir-tokens.mjs <carpeta-del-proyecto> [--dias 7] [--top 10]
```

## Cómo funciona

- **`docs/planes/<zona>.md`**: un archivo por zona del producto, con `Carpetas` (el código que cubre), `Pruebas` (sus archivos de pruebas), `Contexto` (cómo es hoy), `Decisiones` (con su porqué), las tareas pendientes y los bloqueos. Tope: 6.000 caracteres sin contar las tareas.
- **Qué no se puede romper lo dicen las pruebas**, no el plan: fallan solas cuando algo se rompe. El plan sólo apunta a ellas.
- **«destila: …»** (skill `destilar`): crea o actualiza el plan de una zona.
- **«Vamos a continuar con \<zona\>»** (skill `tarea`): una sesión nueva lee el plan, hace la siguiente tarea y deja el plan al día.
- **Lo hecho no se queda en el plan.** Al terminar una tarea va a «Hecho (sin commit)», que se acumula entre sesiones hasta el commit. Se recupera con `git log --grep "<palabra>"` o `git log -p -- docs/planes/<zona>.md`.
- **Al commitear** (`planes-commit.mjs`, en la sesión que sea): borra «Hecho (sin commit)» de los planes e imprime los bloques `Hecho (<zona>):` para el cuerpo del mensaje de commit. También lista los planes tocados que hay que condensar antes: los que pasan del tope o conservan el formato antiguo. Con `--simular` no modifica nada.
- **Hook de bienvenida** (`planes-bienvenida.mjs`): al abrir sesión lista los planes con su siguiente tarea, avisa de los que pasan del tope y recuerda llevar «Hecho (sin commit)» al commit. En un proyecto sin `docs/planes/` no escribe nada.

Lo propio de cada proyecto (pruebas, comprobaciones, cómo explorar el código, deuda técnica) va en su `AGENTS.md`, no en las skills.

## Instalar en otro equipo

Requiere Node y Claude Code. Lo más cómodo: abrir Claude Code en esta carpeta y decirle «lee `APLICAR.md` y aplícalo»; instala el kit y prepara los proyectos que le digas. A mano:

```
git clone https://github.com/Escalpilinido/CV
node CV/_directrices/contexto/instalar.mjs
```

Copia las skills y los scripts de planes a `~/.claude/` y registra el hook en `~/.claude/settings.json` (deja copia en `settings.json.antes-del-kit`). Con `--simular` dice lo que haría sin tocar nada. Este repositorio es la fuente única: los cambios se hacen aquí y se vuelve a ejecutar el instalador.

Un proyecto que tenga copia propia de las skills o del hook en su `.claude/` debe quitarla; si no, la lista de planes sale dos veces.
