// Lo que comparten los scripts de planes (`planes-bienvenida.mjs` y `planes-commit.mjs`):
// los encabezados del formato de la skill `/destilar` y la medida del contexto estable de un plan.
// Único sitio donde vive el tope de tamaño.

// Tope del contexto estable de un plan (todo menos las tareas), en caracteres: skill `/destilar`.
export const MAX_CONTEXT_CHARS = 6000;
export const SECTION_HEADING = /^## /;
export const UNCOMMITTED_DONE = /^## Hecho \(sin commit\)/;
export const TASK_HEADING = /^## \[[ x]\] /;

/**
 * Caracteres del contexto estable de un plan: todas sus líneas menos lo temporal, que son las tareas
 * (desde un `## [ ] N.` hasta el siguiente apartado que no sea tarea) y «Hecho (sin commit)».
 * @param {string[]} lines Líneas del plan.
 * @returns {number}
 */
export function contextChars(lines) {
  let isInsideTemporary = false;
  let chars = 0;
  for (const line of lines) {
    const isTemporaryHeading = TASK_HEADING.test(line) || UNCOMMITTED_DONE.test(line);
    const isOtherHeading = SECTION_HEADING.test(line) && !isTemporaryHeading;
    if (isTemporaryHeading) isInsideTemporary = true;
    if (isOtherHeading) isInsideTemporary = false;
    if (!isInsideTemporary) chars += line.length;
  }
  return chars;
}
