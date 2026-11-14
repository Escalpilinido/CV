# Aplicar el kit de contexto

Instrucciones para un agente (Claude Code) en un equipo o un proyecto donde el kit todavía no está. El usuario dirá algo como «lee esta carpeta y aplica estas mejoras». Qué es el kit y por qué existe está en `README.md`: léelo primero.

## Reglas

- Todo en español.
- Antes de borrar o sobrescribir algo, di qué es y qué se pierde, y espera el OK del usuario.
- No toques nada que estos pasos no nombren. No hagas commit salvo que se pida.
- Al terminar, di qué has hecho, qué no has podido comprobar y qué queda por decidir.

## 1. Instalar en el equipo (una vez por equipo)

1. Comprueba que hay Node 18 o posterior (`node --version`) y Claude Code.
2. Ejecuta `node instalar.mjs --simular` desde esta carpeta y enseña la salida al usuario.
3. Con su OK, ejecuta `node instalar.mjs`. Copia las skills `tarea` y `destilar` a `~/.claude/skills/` y los scripts de planes a `~/.claude/hooks/`, y registra el hook de bienvenida en `~/.claude/settings.json`. Antes de modificarlo deja una copia en `settings.json.antes-del-kit`.
4. Comprueba que existen los cinco archivos copiados, que `settings.json` sigue siendo JSON válido y que tiene una entrada `SessionStart` que llama a `planes-bienvenida.mjs`.

## 2. Preparar un proyecto (sólo en los que el usuario diga)

1. **Copias propias.** Busca en el proyecto `.claude/skills/tarea`, `.claude/skills/destilar`, `.claude/hooks/planes-*.mjs` y, en `.claude/settings.json`, una entrada que llame a `planes-bienvenida.mjs`. Si hay alguna, propón quitarla: con copia propia y global a la vez, la lista de planes sale dos veces.
2. **Reglas del proyecto.** Añade a su `AGENTS.md` (o a `CLAUDE.md` si no tiene) el bloque de abajo. Si ya tiene un apartado de planes o de commits, intégralo sin duplicar.
3. **No crees planes.** Ni `docs/planes/` ni ningún plan: nacen cuando el usuario diga «destila: …».
4. **Planes con otro formato.** Si el proyecto ya tiene planes, no los reescribas: `planes-commit.mjs` lista los que hay que condensar en el primer commit que los toque.

### Bloque para el `AGENTS.md` del proyecto

```markdown
## Planes entre sesiones (`docs/planes/`)
- El contexto de cada zona del producto vive en `docs/planes/<zona>.md` y cada tarea se hace en una sesión limpia que lo lee. Formato: skill `/destilar`. Para continuar: «Vamos a continuar con <zona>» (skill `/tarea`).
- Crear o refinar un plan sólo si el usuario lo pide (gatillo: la palabra «destila»). Una vez existe, el modelo que trabaja lo actualiza al terminar cada tarea.
- Leer sólo el plan de la zona que se va a tocar o el que cite la petición; nunca todos.
- Lo hecho no se queda en el plan: va a «Hecho (sin commit)», se acumula entre sesiones y al commitear pasa al mensaje de commit. Qué no se puede romper lo dicen las pruebas de la línea `Pruebas:` del plan.
- Las skills y los scripts de planes son globales (`~/.claude/`), instalados desde el kit `_directrices/contexto` del repositorio CV: este proyecto no guarda copia.

## Commits
- Antes del `git add`: `node "$HOME/.claude/hooks/planes-commit.mjs"`. Los bloques `Hecho (<zona>):` que imprime van al cuerpo del mensaje de commit, y los planes que liste se condensan antes, con el estilo de `/destilar`. El plan entra en el mismo commit que el código.
```

## 3. Comprobar

- En el proyecto, `node "$HOME/.claude/hooks/planes-bienvenida.mjs"`: lista los planes, o no escribe nada si no hay `docs/planes/`.
- En el proyecto, `node "$HOME/.claude/hooks/planes-commit.mjs" --simular`: no modifica nada y dice qué pasaría al commit.
- En una sesión nueva de Claude Code, las skills `tarea` y `destilar` aparecen en la lista.

## 4. Medir (opcional)

`node medir-tokens.mjs <carpeta-del-proyecto>` da el coste por sesión, la base de arranque y cuánto se va en releer contexto. Sirve para comparar antes y después; la guía de cuándo cambiar de sesión está en `README.md`.
