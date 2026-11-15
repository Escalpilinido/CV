---
name: generalizar
description: Convierte la instrucción que acompaña a la palabra en una regla para todos los proyectos, la guarda en el kit del repositorio CV para instalarla en otros equipos y hace commit y push de CV. Usar cuando el usuario diga «generalizar: …», «generaliza esto», «que esto valga para todos los proyectos» o invoque /generalizar.
---

# /generalizar

La instrucción es lo que sigue a la palabra; si no sigue nada, la última instrucción del usuario. El repositorio CV (`github.com/Escalpilinido/CV`) es la fuente única; su ruta local la da `~/AGENTS.md`.

1. **Redactar la regla:** breve, comprobable, sin nada propio de un proyecto. Si ya existe una que la cubre, se actualiza esa; no se duplica.
2. **Elegir dónde vive:**
   - **Regla siempre vigente** (cómo se trabaja o se programa): una línea en la sección que toque de `~/AGENTS.md` y en `_directrices/guia-desarrollo.md` de CV.
   - **Procedimiento que se invoca por su nombre:** skill en `_directrices/contexto/skills/<nombre>/SKILL.md` de CV, con nombre de una palabra, añadida a `COPIES` de `instalar.mjs` y a las listas de skills de `README.md` y `APLICAR.md`.
   - Las dos cosas si la regla debe cumplirse siempre y además citarse en un prompt.
3. **Proyecto actual:** si su `AGENTS.md` repite o contradice la regla, ajustarlo para que apunte a la global.
4. **Instalar:** `node _directrices/contexto/instalar.mjs` en CV si se ha tocado el kit.
5. **Commit y push de CV:** `git add` sólo de `_directrices/`, commit con la regla y su porqué, y `git push`. Si CV tiene otros cambios sin commit, decirlo y no incluirlos sin el OK del usuario.
6. **Cerrar** diciendo la regla tal como ha quedado, los archivos tocados y que en otro equipo se aplica con `git pull` y `node instalar.mjs`. `~/AGENTS.md` no viaja con el kit: en otro equipo esa línea se añade a mano.
