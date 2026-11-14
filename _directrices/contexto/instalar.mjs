// Instala el kit de contexto en Claude Code para todos los proyectos del equipo en el que se ejecuta.
// Copia las skills `tarea` y `destilar` a `~/.claude/skills/` y los scripts de planes a `~/.claude/hooks/`
// (`planes-bienvenida.mjs`, `planes-commit.mjs` y `planes-util.mjs`), y registra el primero como hook
// SessionStart en `~/.claude/settings.json` si no lo está.
// Se puede repetir: sobrescribe las copias con las de este repositorio, que es la fuente única.
// Uso: node instalar.mjs [--simular]   (--simular dice lo que haría, sin tocar nada)
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kitDir = dirname(fileURLToPath(import.meta.url));
const claudeDir = join(homedir(), '.claude');
const isDryRun = process.argv.includes('--simular');
const HOOK_FILE = 'planes-bienvenida.mjs';
const COPIES = [
  ['skills/tarea/SKILL.md', 'skills/tarea/SKILL.md'],
  ['skills/destilar/SKILL.md', 'skills/destilar/SKILL.md'],
  [`hooks/${HOOK_FILE}`, `hooks/${HOOK_FILE}`],
  ['hooks/planes-commit.mjs', 'hooks/planes-commit.mjs'],
  ['hooks/planes-util.mjs', 'hooks/planes-util.mjs'],
];

/**
 * Copia un archivo del kit a `~/.claude/`, creando la carpeta de destino si falta.
 * @param {string} from Ruta relativa al kit.
 * @param {string} to Ruta relativa a `~/.claude/`.
 */
function copy(from, to) {
  const target = join(claudeDir, to);
  console.log(`${isDryRun ? 'Copiaría' : 'Copiado'}: ${to}`);
  if (isDryRun) return;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(kitDir, from), target);
}

/**
 * Registra el hook de bienvenida en `~/.claude/settings.json` si ninguna entrada SessionStart lo llama ya.
 */
function registerHook() {
  const settingsFile = join(claudeDir, 'settings.json');
  const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {};
  const sessionStart = settings.hooks?.SessionStart ?? [];
  const isRegistered = sessionStart.some((entry) =>
    (entry.hooks ?? []).some((hook) => (hook.command ?? '').includes(HOOK_FILE)),
  );
  if (isRegistered) {
    console.log('Hook SessionStart: ya estaba registrado.');
    return;
  }
  const hookPath = join(claudeDir, 'hooks', HOOK_FILE).replaceAll('\\', '/');
  sessionStart.push({
    matcher: 'startup|clear',
    hooks: [{ type: 'command', command: `node "${hookPath}"`, timeout: 10 }],
  });
  console.log(`Hook SessionStart: ${isDryRun ? 'se registraría' : 'registrado'} en settings.json.`);
  if (isDryRun) return;
  // Copia del archivo tal como estaba, por si hay que deshacer.
  if (existsSync(settingsFile)) copyFileSync(settingsFile, `${settingsFile}.antes-del-kit`);
  settings.hooks = { ...settings.hooks, SessionStart: sessionStart };
  writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
}

for (const [from, to] of COPIES) copy(from, to);
registerHook();
console.log('Un proyecto con copia propia en su `.claude/` (skills u hook) debe quitarla: si no, el hook sale dos veces.');
