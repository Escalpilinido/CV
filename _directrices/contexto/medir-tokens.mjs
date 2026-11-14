// Mide en qué se gastan los tokens de Claude Code en un proyecto, para decidir con datos
// cuándo conviene cambiar de sesión y qué recortar.
// Lee los registros de sesión (`~/.claude/projects/<proyecto>/*.jsonl`) y los de sus subagentes
// (`<sesión>/subagents/agent-*.jsonl`), cuenta una vez cada petición a la API (por id de mensaje)
// y la valora a precio de API. No modifica nada.
// Uso: node medir-tokens.mjs [carpeta-del-proyecto] [--dias N] [--top N]
//   carpeta-del-proyecto: por defecto, la actual. --dias: sólo sesiones de los últimos N días.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// USD por millón de tokens. Tabla a mano, la misma de `~/.claude/skills/delegar/coste.mjs`
// (platform.claude.com/docs/en/about-claude/pricing, consultada el 2026-10-31): verificar al cambiar precios.
// w5m / w1h = escritura de caché a 5 min / 1 h; read = lectura de caché.
// `largo`: tarifa cuando el prompt supera `umbral` tokens. Los más específicos, primero (se busca por prefijo).
const PRECIOS = {
  'claude-opus-5-5': { in: 4, out: 20, w5m: 5, w1h: 8, read: 0.2 },
  'claude-sonnet-5-5': { in: 2, out: 10, w5m: 2.5, w1h: 4, read: 0.1 },
  'claude-sonnet-5': { in: 2, out: 10, w5m: 2.5, w1h: 4, read: 0.2 },
  'claude-haiku-5-5': {
    in: 0.1, out: 0.5, w5m: 0.125, w1h: 0.2, read: 0.01,
    umbral: 100_000, largo: { in: 0.5, out: 2.5, w5m: 0.625, w1h: 1, read: 0.05 },
  },
  'claude-haiku-4-5': { in: 1, out: 5, w5m: 1.25, w1h: 2, read: 0.1 },
};
const CATEGORIAS = ['read', 'w5m', 'w1h', 'in', 'out'];
const NOMBRE_CATEGORIA = {
  read: 'Releer contexto (caché leída)',
  w5m: 'Escribir caché 5 min',
  w1h: 'Escribir caché 1 h',
  in: 'Entrada sin caché',
  out: 'Salida',
};
// Tramos de tamaño del contexto de una petición, en tokens.
const TRAMOS = [50_000, 100_000, 200_000, Infinity];
const MINUTOS_CADUCIDAD = 5;

/**
 * Tarifa de un modelo, buscada por prefijo (los ids pueden llevar fecha).
 * @param {string} modelo Id del modelo.
 * @param {number} prompt Tokens de prompt de la petición, para elegir el tramo largo si lo hay.
 * @returns {{in:number,out:number,w5m:number,w1h:number,read:number}|undefined}
 */
function tarifa(modelo, prompt) {
  const clave = Object.keys(PRECIOS).find((prefijo) => modelo.startsWith(prefijo));
  const precio = PRECIOS[clave];
  const usaTramoLargo = precio?.largo !== undefined && prompt > precio.umbral;
  return usaTramoLargo ? precio.largo : precio;
}

/**
 * Lee un JSONL y devuelve sus objetos; las líneas que no son JSON se ignoran.
 * @param {string} ruta Archivo JSONL.
 * @returns {object[]}
 */
function leerJsonl(ruta) {
  const objetos = [];
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const estaVacia = linea.trim() === '';
    if (estaVacia) continue;
    try {
      objetos.push(JSON.parse(linea));
    } catch {
      // Línea cortada (sesión interrumpida): se ignora.
    }
  }
  return objetos;
}

/**
 * Peticiones a la API de un registro: una por id de mensaje, en orden de tiempo.
 * Cada bloque de una respuesta repite el mismo `usage`; se queda el último.
 * @param {object[]} entradas Objetos del JSONL.
 * @returns {{ts:number,modelo:string,read:number,w5m:number,w1h:number,in:number,out:number,prompt:number,usd:Record<string,number>|undefined}[]}
 */
function peticiones(entradas) {
  const porId = new Map();
  for (const entrada of entradas) {
    const uso = entrada.message?.usage;
    const modelo = entrada.message?.model ?? '';
    const esRespuestaReal = entrada.type === 'assistant' && uso !== undefined && modelo.startsWith('claude');
    if (!esRespuestaReal) continue;
    const escritura1h = uso.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    const escrituraTotal = uso.cache_creation_input_tokens ?? 0;
    const tokens = {
      read: uso.cache_read_input_tokens ?? 0,
      w1h: escritura1h,
      w5m: uso.cache_creation?.ephemeral_5m_input_tokens ?? escrituraTotal - escritura1h,
      in: uso.input_tokens ?? 0,
      out: uso.output_tokens ?? 0,
    };
    const prompt = tokens.read + tokens.w5m + tokens.w1h + tokens.in;
    const precio = tarifa(modelo, prompt);
    const usd = precio
      ? Object.fromEntries(CATEGORIAS.map((c) => [c, (tokens[c] * precio[c]) / 1e6]))
      : undefined;
    porId.set(entrada.message.id ?? entrada.uuid, {
      ts: Date.parse(entrada.timestamp),
      modelo,
      ...tokens,
      prompt,
      usd,
    });
  }
  return [...porId.values()].sort((a, b) => a.ts - b.ts);
}

/**
 * Suma los USD de una lista de peticiones (las que no tienen tarifa no suman).
 * @param {{usd:Record<string,number>|undefined}[]} lista Peticiones.
 * @returns {number}
 */
function usdDe(lista) {
  return lista.reduce((total, p) => total + (p.usd ? CATEGORIAS.reduce((s, c) => s + p.usd[c], 0) : 0), 0);
}

/**
 * Mediana de una lista de números; 0 si está vacía.
 * @param {number[]} numeros Valores.
 * @returns {number}
 */
function mediana(numeros) {
  const orden = [...numeros].sort((a, b) => a - b);
  return orden.length === 0 ? 0 : orden[Math.floor(orden.length / 2)];
}

/** @param {number} tokens @returns {string} Miles de tokens, sin decimales. */
const k = (tokens) => `${Math.round(tokens / 1000)}k`;
/** @param {number} usd @returns {string} */
const dolares = (usd) => usd.toFixed(2).padStart(8);
/** @param {number} parte @param {number} total @returns {string} */
const pct = (parte, total) => `${total === 0 ? 0 : Math.round((parte / total) * 100)} %`.padStart(5);

/**
 * Lee el valor numérico de una opción `--nombre N`.
 * @param {string} nombre Nombre de la opción, sin guiones.
 * @param {number} porDefecto Valor si no se pasa.
 * @returns {number}
 */
function opcion(nombre, porDefecto) {
  const posicion = process.argv.indexOf(`--${nombre}`);
  const valor = posicion === -1 ? NaN : Number(process.argv[posicion + 1]);
  return Number.isNaN(valor) ? porDefecto : valor;
}

// La carpeta es el primer argumento que no es una opción ni el valor de una (`--dias 7`), esté donde esté.
const argumentos = process.argv.slice(2);
const carpetaIndicada = argumentos.find((argumento, i) => {
  const esOpcion = argumento.startsWith('--');
  const esValorDeOpcion = (argumentos[i - 1] ?? '').startsWith('--');
  return !esOpcion && !esValorDeOpcion;
});
const carpetaProyecto = resolve(carpetaIndicada ?? process.cwd());
const dias = opcion('dias', Infinity);
const top = opcion('top', 10);

// Claude Code guarda cada proyecto en una carpeta con su ruta, cambiando lo no alfanumérico por guiones.
const raizRegistros = join(homedir(), '.claude', 'projects');
const nombreRegistro = carpetaProyecto.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
const carpetaRegistro = existsSync(raizRegistros)
  ? readdirSync(raizRegistros).find((nombre) => nombre.toLowerCase() === nombreRegistro)
  : undefined;
if (carpetaRegistro === undefined) {
  console.error(`Sin registros de Claude Code para ${carpetaProyecto} (se buscó ${nombreRegistro} en ${raizRegistros}).`);
  process.exit(1);
}
const dirRegistro = join(raizRegistros, carpetaRegistro);
const desde = Date.now() - dias * 24 * 3600 * 1000;

const sesiones = [];
for (const archivo of readdirSync(dirRegistro).filter((nombre) => nombre.endsWith('.jsonl'))) {
  const id = archivo.replace('.jsonl', '');
  const principal = peticiones(leerJsonl(join(dirRegistro, archivo)));
  const dirSubagentes = join(dirRegistro, id, 'subagents');
  const subagentes = existsSync(dirSubagentes)
    ? readdirSync(dirSubagentes)
        .filter((nombre) => nombre.endsWith('.jsonl'))
        .map((nombre) => peticiones(leerJsonl(join(dirSubagentes, nombre))))
        .filter((lista) => lista.length > 0)
    : [];
  const estaVacia = principal.length === 0;
  const esAntigua = !estaVacia && principal[0].ts < desde;
  if (estaVacia || esAntigua) continue;
  sesiones.push({ id, principal, subagentes });
}
if (sesiones.length === 0) {
  console.error('Ninguna sesión con peticiones en ese periodo.');
  process.exit(1);
}

const todasPrincipal = sesiones.flatMap((s) => s.principal);
const todasSubagentes = sesiones.flatMap((s) => s.subagentes.flat());
const todas = [...todasPrincipal, ...todasSubagentes];
const total = usdDe(todas);
const sinTarifa = [...new Set(todas.filter((p) => !p.usd).map((p) => p.modelo))];
const peticionesSinTarifa = todas.filter((p) => !p.usd).length;

console.log(`Proyecto: ${carpetaProyecto}`);
console.log(`Sesiones: ${sesiones.length} · peticiones a la API: ${todas.length} · coste a precio de API: ${total.toFixed(2)} USD`);
if (sinTarifa.length > 0) {
  console.log(`Sin tarifa en la tabla (no suman USD): ${sinTarifa.join(', ')} · ${peticionesSinTarifa} peticiones`);
}

console.log('\n1. En qué se va el coste');
for (const categoria of CATEGORIAS) {
  const usd = todas.reduce((s, p) => s + (p.usd?.[categoria] ?? 0), 0);
  console.log(`${dolares(usd)} USD ${pct(usd, total)}  ${NOMBRE_CATEGORIA[categoria]}`);
}
console.log(`${dolares(usdDe(todasPrincipal))} USD ${pct(usdDe(todasPrincipal), total)}  Sesión principal (${todasPrincipal.length} peticiones)`);
console.log(`${dolares(usdDe(todasSubagentes))} USD ${pct(usdDe(todasSubagentes), total)}  Subagentes (${todasSubagentes.length} peticiones)`);

console.log('\n2. Base de arranque (contexto de la primera petición, se paga en cada sesión nueva)');
const bases = sesiones.map((s) => s.principal[0].prompt);
const basesSubagente = sesiones.flatMap((s) => s.subagentes.map((lista) => lista[0].prompt));
console.log(`Sesión: mediana ${k(mediana(bases))}, mínimo ${k(Math.min(...bases))}, máximo ${k(Math.max(...bases))}`);
if (basesSubagente.length > 0) {
  console.log(`Subagente (${basesSubagente.length}): mediana ${k(mediana(basesSubagente))}`);
}
const arranquesSesion = sesiones.map((s) => s.principal[0]);
const arranquesSubagente = sesiones.flatMap((s) => s.subagentes.map((lista) => lista[0]));
const usdArranques = usdDe([...arranquesSesion, ...arranquesSubagente]);
const usdPorArranque = mediana(arranquesSesion.filter((p) => p.usd).map((p) => usdDe([p])));
const usdPorSubagente = mediana(arranquesSubagente.filter((p) => p.usd).map((p) => usdDe([p])));
console.log(
  `Coste de arrancar: mediana ${usdPorArranque.toFixed(2)} USD por sesión, ${usdPorSubagente.toFixed(2)} USD por subagente · ` +
    `en total ${usdArranques.toFixed(2)} USD ${pct(usdArranques, total)}`,
);

console.log('\n3. Coste según el tamaño del contexto de cada petición (sesión principal)');
let minimo = 0;
for (const maximo of TRAMOS) {
  const enTramo = todasPrincipal.filter((p) => p.prompt >= minimo && p.prompt < maximo);
  const usd = usdDe(enTramo);
  const conTarifa = enTramo.filter((p) => p.usd).length;
  const porPeticion = conTarifa === 0 ? 0 : usd / conTarifa;
  const etiqueta = maximo === Infinity ? `más de ${k(minimo)}` : `${k(minimo)}-${k(maximo)}`;
  console.log(
    `${etiqueta.padEnd(12)} ${String(enTramo.length).padStart(6)} peticiones ${dolares(usd)} USD ${pct(usd, usdDe(todasPrincipal))}  ${porPeticion.toFixed(3)} USD/petición`,
  );
  minimo = maximo;
}

console.log(`\n4. Caché caducada (pausa de más de ${MINUTOS_CADUCIDAD} min y más de medio contexto reescrito)`);
const reescrituras = sesiones.flatMap((s) =>
  s.principal.filter((p, i) => {
    const anterior = s.principal[i - 1];
    const huboPausa = anterior !== undefined && p.ts - anterior.ts > MINUTOS_CADUCIDAD * 60_000;
    const reescribeMedioContexto = p.w5m + p.w1h > p.prompt / 2;
    return huboPausa && reescribeMedioContexto;
  }),
);
const usdReescrituras = reescrituras.reduce((s, p) => s + (p.usd ? p.usd.w5m + p.usd.w1h : 0), 0);
console.log(`${reescrituras.length} veces · ${usdReescrituras.toFixed(2)} USD ${pct(usdReescrituras, total)} del total`);

console.log('\n5. Sesiones según su longitud (peticiones de la sesión principal)');
const LONGITUDES = [20, 60, 150, Infinity];
let desdeLongitud = 0;
for (const hasta of LONGITUDES) {
  const grupo = sesiones.filter((s) => s.principal.length >= desdeLongitud && s.principal.length < hasta);
  const usd = grupo.reduce((s, sesion) => s + usdDe(sesion.principal) + usdDe(sesion.subagentes.flat()), 0);
  const picos = grupo.map((s) => Math.max(...s.principal.map((p) => p.prompt)));
  const etiqueta = hasta === Infinity ? `${desdeLongitud} o más` : `${desdeLongitud}-${hasta - 1}`;
  console.log(
    `${etiqueta.padEnd(10)} ${String(grupo.length).padStart(4)} sesiones ${dolares(usd)} USD ${pct(usd, total)}  pico mediano ${k(mediana(picos))}`,
  );
  desdeLongitud = hasta;
}

console.log(`\n6. Las ${top} sesiones más caras`);
console.log('fecha       sesión    modelo               petic.  base   pico  subag.      USD');
const filas = sesiones
  .map((s) => ({
    fecha: new Date(s.principal[0].ts).toLocaleDateString('sv-SE'),
    id: s.id.slice(0, 8),
    modelo: s.principal.at(-1).modelo.replace('claude-', ''),
    peticiones: s.principal.length,
    base: s.principal[0].prompt,
    pico: Math.max(...s.principal.map((p) => p.prompt)),
    subagentes: s.subagentes.length,
    usd: usdDe(s.principal) + usdDe(s.subagentes.flat()),
  }))
  .sort((a, b) => b.usd - a.usd)
  .slice(0, top);
for (const f of filas) {
  console.log(
    `${f.fecha}  ${f.id}  ${f.modelo.padEnd(18)} ${String(f.peticiones).padStart(7)} ${k(f.base).padStart(5)} ${k(f.pico).padStart(6)} ${String(f.subagentes).padStart(7)} ${dolares(f.usd)}`,
  );
}
