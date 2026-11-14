// Prepara los planes de `docs/planes/` para un commit. Se ejecuta antes del `git add`, en la sesión
// que sea: lo pendiente de pasar al commit vive en los planes, no en la conversación.
// 1) Borra «Hecho (sin commit)» de cada plan e imprime su contenido en bloques `Hecho (<zona>):`,
//    que van tal cual al cuerpo del mensaje de commit.
// 2) Lista los planes con cambios que hay que condensar antes del commit: los que pasan del tope de
//    tamaño y los que conservan el formato antiguo («Hecho» fijo o apartados con fecha).
// Uso: node planes-commit.mjs [--simular]   (--simular lo dice todo sin modificar los planes)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { MAX_CONTEXT_CHARS, SECTION_HEADING, TASK_HEADING, UNCOMMITTED_DONE, contextChars } from './planes-util.mjs';

// «## Hecho» a secas: el apartado fijo del formato antiguo. Con fecha lo detecta DATED_HEADING.
const OLD_DONE = /^## Hecho\s*$/;
const DATED_HEADING = /^## .+\(\d{4}-\d{2}-\d{2}\)/;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const plansDir = join(projectDir, 'docs', 'planes');
const isDryRun = process.argv.includes('--simular');

/**
 * Nombres de archivo de los planes con cambios sin commit; `undefined` si git no responde
 * (entonces se miran todos).
 * @returns {Set<string> | undefined}
 */
function touchedPlans() {
  try {
    // Sin entrecomillar los nombres con tildes y con cada archivo nuevo por separado (no sólo su carpeta).
    const args = ['-c', 'core.quotePath=false', 'status', '--porcelain', '--untracked-files=all', '--', 'docs/planes'];
    const status = execFileSync('git', args, {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const names = status
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => basename(line.slice(3).split(' -> ').at(-1).trim().replaceAll('"', '')));
    return new Set(names);
  } catch {
    return undefined;
  }
}

/**
 * Separa de un plan las líneas de «Hecho (sin commit)» del resto, que queda sin esa sección
 * y con una sola línea vacía al final.
 * @param {string[]} lines Líneas del plan.
 * @returns {{ done: string[], rest: string[], hadSection: boolean }}
 */
function splitDone(lines) {
  const done = [];
  const rest = [];
  let isInsideDone = false;
  let hadSection = false;
  for (const line of lines) {
    const isDoneHeading = UNCOMMITTED_DONE.test(line);
    const isOtherHeading = SECTION_HEADING.test(line) && !isDoneHeading;
    const isEmpty = line.trim() === '';
    if (isDoneHeading) {
      isInsideDone = true;
      hadSection = true;
      continue;
    }
    if (isOtherHeading) isInsideDone = false;
    if (!isInsideDone) rest.push(line);
    if (isInsideDone && !isEmpty) done.push(line);
  }
  while (rest.length > 0 && rest.at(-1).trim() === '') rest.pop();
  rest.push('');
  return { done, rest, hadSection };
}

if (!existsSync(plansDir)) {
  console.log('Este proyecto no tiene docs/planes/: nada que preparar.');
  process.exit(0);
}

const touched = touchedPlans();
const blocks = [];
const toCondense = [];
for (const file of readdirSync(plansDir).filter((name) => name.endsWith('.md'))) {
  const path = join(plansDir, file);
  const text = readFileSync(path, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const { done, rest, hadSection } = splitDone(text.split(/\r?\n/));
  const zone = basename(file, '.md');
  const hasDone = done.length > 0;
  if (hasDone) blocks.push(`Hecho (${zone}):\n${done.join('\n')}`);
  const mustRewrite = hadSection && !isDryRun;
  if (mustRewrite) writeFileSync(path, rest.join(eol));

  // Un plan al que se le acaba de quitar la sección cuenta como tocado.
  const isTouched = touched === undefined || touched.has(file) || hadSection;
  const chars = contextChars(rest);
  const isOversized = chars > MAX_CONTEXT_CHARS;
  // Los títulos de tarea pueden llevar una fecha entre paréntesis: no cuentan como formato antiguo.
  const hasOldFormat = rest
    .filter((line) => !TASK_HEADING.test(line))
    .some((line) => OLD_DONE.test(line) || DATED_HEADING.test(line));
  if (isTouched && isOversized) toCondense.push(`- ${zone}: ${chars} caracteres de contexto (tope ${MAX_CONTEXT_CHARS})`);
  if (isTouched && !isOversized && hasOldFormat) toCondense.push(`- ${zone}: formato antiguo («Hecho» fijo o apartados con fecha)`);
}

const hasBlocks = blocks.length > 0;
const hasToCondense = toCondense.length > 0;
if (hasBlocks) {
  const action = isDryRun ? 'Se quitaría de los planes' : 'Quitado de los planes';
  console.log(`${action}. Para el cuerpo del mensaje de commit:\n\n${blocks.join('\n\n')}`);
} else {
  console.log('Sin «Hecho (sin commit)» en los planes.');
}
if (hasToCondense) {
  console.log(`\nCondensar antes del commit (skill destilar):\n${toCondense.join('\n')}`);
}
