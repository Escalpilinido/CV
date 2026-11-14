// Da la bienvenida al abrir una sesión con los planes de `docs/planes/` del proyecto.
// Es el hook SessionStart de Claude Code. Lee de cada plan las tareas pendientes (`## [ ] N. …`),
// con el formato de la skill `/destilar`; las hechas ya no están en la lista: pasan a
// «Hecho (sin commit)» y, al commitear, al mensaje de commit. Al usuario le muestra la lista
// (`systemMessage`): primero los pendientes con su siguiente tarea, del último que se tocó al más
// antiguo, luego los que están al día, y cuál fue el último que se tocó. Avisa de los planes que
// pasan del tope de tamaño (hay que condensarlos). Al modelo le da el mismo resumen
// (`additionalContext`) para que ofrezca continuar con ese y, si algún plan tiene «Hecho (sin commit)»,
// le recuerda pasarlo al mensaje de commit. Los de `historico/` no se leen. Sin índice que mantener:
// la fecha sale de git (ver `lastChange`). En un proyecto sin `docs/planes/` no escribe nada.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { MAX_CONTEXT_CHARS, UNCOMMITTED_DONE, contextChars } from './planes-util.mjs';

const PENDING_TASK = /^## \[ \] (\d+)\. (.+)$/;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const plansDir = join(projectDir, 'docs', 'planes');

/**
 * Ejecuta git en el proyecto y devuelve su salida sin espacios al final.
 * @param {...string} args Argumentos de git.
 * @returns {string}
 */
function git(...args) {
  return execFileSync('git', args, {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Fecha del último cambio de un plan: la del archivo si tiene cambios sin commit (o git no está);
 * si no, la de su último commit. La del archivo sola no sirve: un checkout la renueva.
 * @param {string} file Ruta del plan.
 * @returns {Date}
 */
function lastChange(file) {
  const fileTime = statSync(file).mtime;
  try {
    const hasUncommittedChanges = git('status', '--porcelain', '--', file) !== '';
    const committedAt = hasUncommittedChanges ? '' : git('log', '-1', '--format=%cI', '--', file);
    const hasCommit = committedAt !== '';
    return hasCommit ? new Date(committedAt) : fileTime;
  } catch {
    return fileTime;
  }
}

/**
 * Resume un plan: nombre, fecha del último cambio, tareas pendientes, la siguiente, tamaño de su
 * contexto estable y si tiene «Hecho (sin commit)».
 * @param {string} file Ruta del plan.
 * @returns {{ name: string, changedAt: Date, pendingCount: number, next: string | undefined, contextChars: number, hasUncommittedDone: boolean }}
 */
function summarize(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const tasks = lines
    .map((line) => PENDING_TASK.exec(line))
    .filter((match) => match !== null)
    .map(([, number, text]) => `${number}. ${text.trim()}`);
  return {
    name: basename(file, '.md'),
    changedAt: lastChange(file),
    pendingCount: tasks.length,
    next: tasks[0],
    contextChars: contextChars(lines),
    hasUncommittedDone: lines.some((line) => UNCOMMITTED_DONE.test(line)),
  };
}

const hasPlansDir = existsSync(plansDir);
if (!hasPlansDir) {
  // Proyecto sin planes: el hook, instalado para todos los proyectos, no gasta contexto.
  process.exit(0);
}
const plans = readdirSync(plansDir)
  .filter((file) => file.endsWith('.md'))
  .map((file) => summarize(join(plansDir, file)))
  .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
const pending = plans.filter((plan) => plan.next !== undefined);
const upToDate = plans.filter((plan) => plan.next === undefined);
const oversized = plans.filter((plan) => plan.contextChars > MAX_CONTEXT_CHARS);
const withUncommittedDone = plans.filter((plan) => plan.hasUncommittedDone);
const hasPending = pending.length > 0;
const hasUpToDate = upToDate.length > 0;
const hasOversized = oversized.length > 0;
const hasUncommittedDone = withUncommittedDone.length > 0;
// El último que se tocó, tenga pendientes o esté al día.
const lastTouched = plans[0];
const hasPlans = lastTouched !== undefined;
const lastTouchedNote = lastTouched?.next === undefined ? ', al día' : '';

const lines = ['Planes (docs/planes/):'];
for (const plan of pending) {
  // Fecha local (sv-SE da AAAA-MM-DD), no la UTC de toISOString.
  const changedOn = plan.changedAt.toLocaleDateString('sv-SE');
  lines.push(
    `- ${plan.name} · último cambio: ${changedOn} · pendientes: ${plan.pendingCount} · ` +
      `siguiente: ${plan.next}`,
  );
}
if (hasUpToDate) {
  lines.push(`- Al día: ${upToDate.map((plan) => plan.name).join(', ')}`);
}
if (hasOversized) {
  const names = oversized.map((plan) => `${plan.name} (${plan.contextChars} caracteres)`).join(', ');
  lines.push(`Para condensar, pasan de ${MAX_CONTEXT_CHARS} caracteres de contexto: ${names}. Con «destila <zona>».`);
}
if (hasPlans) {
  lines.push(
    `Para seguir por donde lo dejamos: «Vamos a continuar» (${lastTouched.name}${lastTouchedNote}); ` +
      'con otro: «Vamos a continuar con <zona>»',
  );
}
if (!hasPending) {
  lines.push('Sin tareas pendientes.');
}
const systemMessage = lines.join('\n');
const offer = hasPlans
  ? `Si el primer mensaje del usuario no dice qué hacer, ofrécele continuar con el último que se tocó ` +
    `(«¿Continuamos con ${lastTouched.name}?»). Para continuar un plan, usa la skill tarea.`
  : 'Crea o actualiza un plan sólo si el usuario lo pide, con la skill destilar.';
const commitReminder = hasUncommittedDone
  ? `\nAl commitear: «Hecho (sin commit)» de ${withUncommittedDone.map((plan) => plan.name).join(', ')} ` +
    'pasa al cuerpo del mensaje de commit con `planes-commit.mjs`, que está junto a este hook (skill tarea, «Al commitear»).'
  : '';
const additionalContext = `${systemMessage}\n${offer}${commitReminder}`;

process.stdout.write(
  JSON.stringify({
    systemMessage,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext },
  }),
);
