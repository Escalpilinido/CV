# Guía de desarrollo

Normas de desarrollo para cualquier proyecto (personas y agentes de IA). Fuente única: este archivo. La carpeta empieza por `_` para que GitHub Pages no la publique en la web.

Cada norma lleva su porqué: ante un caso que no encaje, manda la intención, no la letra.

## 1. Principios

- **La solución más simple y limpia.** Sin abstracciones prematuras, sin capas «por si acaso», sin duplicar lógica.
- **Código descriptivo, nunca críptico.** Nombres que digan qué es y para qué sirve; nada de abreviaturas, trucos ni encadenados ilegibles. Si hace falta un comentario para entender *qué* hace, el nombre está mal; el comentario explica el *porqué*.
- **Arquitectura antes que rapidez.** Antes de escribir, decidir dónde encaja; una sola pieza responsable de cada cosa.
- **Reutilizar antes que crear.** Buscar primero utilidades, componentes y servicios existentes. Extraer a algo común cuando se usa en 3 sitios o más.
- **Resolver en origen.** Que el error no llegue a ocurrir, en vez de taparlo después.

## 2. Modelos: clases, no interfaces

- **No se usan interfaces ni `type` para modelos de datos: sólo clases.** Una clase se puede instanciar, así que cada objeto nace con su forma completa y sus valores por defecto; una interfaz sólo describe y desaparece al compilar.
- **Cada clase hace su propio mapeo en el constructor.** Recibe `data`, un objeto, y en el constructor asigna cada propiedad de la instancia.
- **Toda propiedad tiene valor por defecto**, para que un dato que no llega no rompa nada después:
  - texto → `''`
  - array → `[]` (como mínimo, siempre)
  - número → `0` (o el neutro que tenga sentido)
  - booleano → `false`
  - objeto anidado → `new SuClase(data.campo)`, que ya trae sus propios valores por defecto
  - lista de objetos → `(data.lista ?? []).map((item) => new SuClase(item))`
- **Las respuestas del servidor pasan siempre por una de estas clases (DTO).** Los cálculos de adaptación viven ahí; si cambia el servidor, sólo se toca esa clase. Si la respuesta cruda tiene otra forma, se describe también con una clase (`PokemonRespuesta`) y el DTO la recibe.

```ts
export class Pokemon {
  name: string;
  types: string[];
  weight: number;
  isLegendary: boolean;
  species: Species;
  moves: Move[];

  /**
   * @param data Datos de origen; lo que no venga toma su valor por defecto.
   */
  constructor(data: Partial<Pokemon> = {}) {
    this.name = data.name ?? '';
    this.types = data.types ?? [];
    this.weight = data.weight ?? 0;
    this.isLegendary = data.isLegendary ?? false;
    this.species = new Species(data.species);
    this.moves = (data.moves ?? []).map((move) => new Move(move));
  }
}
```

- Tipos de texto con valores cerrados → `enum` (sirve también como tipo), no uniones de literales sueltos.

## 3. Condiciones: el `if` sólo compara constantes

- **Dentro de un `if` no se calcula nada.** Cada condición se calcula antes en una constante con nombre, y el `if` usa esa constante o, como mucho, compara constantes entre sí. El nombre documenta la regla de negocio.

```ts
// Mal
if (user.roles.includes('admin') && order.total > 100 && !order.paid) { … }

// Bien
const isAdmin = user.roles.includes(Role.Admin);
const isBigOrder = order.total > BIG_ORDER_LIMIT;
const isPending = !order.paid;
const needsReview = isAdmin && isBigOrder && isPending;
if (needsReview) { … }
```

- Lo mismo en ternarios, `filter`, `@if` de plantillas: si la expresión no es trivial, constante (o `computed`) con nombre.

## 4. Errores y peticiones

Lección de origen (Pokédexter, 2026-11-13): una ficha que PokeAPI no encontraba dejaba cientos de errores en la consola al mover el ratón, y la pantalla dejaba de cargar las siguientes.

- **Todo lo que puede fallar tiene su fallo previsto en origen**: se captura donde se hace la petición y se convierte en un valor (`null`, vacío, un estado de error), no se deja escapar.
- **Un error nunca debe matar un flujo largo.** En RxJS, el `catchError` va *dentro* del `switchMap`/`mergeMap` de cada petición, no fuera: fuera, el primer fallo completa el flujo y las navegaciones siguientes ya no cargan nada.
- **Angular `toSignal` relanza el error en cada lectura de la señal.** Cada ciclo de detección de cambios (mover el ratón) vuelve a lanzarlo y lo registra. Lo que llega a un `toSignal` ya va con el error capturado.
- **Un fallo se ve, no deja la pantalla en blanco.** Estado de error con mensaje traducido («No se ha encontrado…», «Sin conexión…») y, si tiene sentido, forma de reintentar.
- **Nada de reintentos ni peticiones en bucle.** Ni por renderizado, ni por eventos de ratón, ni por suscripciones duplicadas. Las peticiones en vuelo se comparten; una caché no guarda fallos para siempre, pero tampoco se pide otra vez en cada pintado.
- **Suscripciones siempre finitas y controladas** (`takeUntilDestroyed`, `first`, `take`…).
- **Identificadores de APIs externas: usar los que la API da para ese recurso**, no deducirlos de otro. Ejemplo: en PokeAPI la especie `palafin` no es un Pokémon (`/pokemon/palafin` da 404); su Pokémon por defecto es la variedad `is_default` de la especie (`palafin-zero`).
- El backend valida siempre, aunque el frontend ya lo impida.

## 5. Interfaz (frontend)

- Sin textos literales en la UI: siempre traducciones.
- Medidas relativas antes que absolutas. Sin estilos inline.
- Pensar como experto UX/UI: estados de carga, vacío y error en todo lo que pide datos.
- Borrados importantes con diálogo de confirmación, nunca `window.alert`.
- El control se elige por lo que representa:
  - Sí o no (el resultado depende de verdadero o falso): casilla (checkbox).
  - Dos opciones con nombre, y sólo dos (por ejemplo «Incluir» y «Solo»): veleta, un conmutador de dos posiciones que enseña las dos y, al pulsar cualquiera, invierte la selección. Es la opción buena cuando hace falta una mejora semántica: «Incluir» podría ser una casilla, pero cambia el sentido de todas las demás y conviene que se distinga de ellas.
  - Más de dos opciones: stepper (como el de tamaños de pantalla de la cabecera) o combo, lo que se decida en el momento.
- Formularios públicos: honeypot siempre; acciones sensibles con rate-limit y CAPTCHA.

## 6. Angular

- Control flow `@if`/`@for`; signals antes que observables cuando se pueda; `inject()`; sin getters/setters.
- `effect` desde el constructor.
- Rutas desde una constante (`routingPaths`), nunca escritas a mano.
- Componentes presentadores: los pequeños que sólo muestran información (y a lo sumo la formatean) no llevan lógica de negocio. Reciben datos por `input()` y emiten cada evento con un `output()`; quien los usa lo escucha y aplica la lógica que necesite. Así el mismo componente sirve en cualquier sitio y la lógica vive en un único punto: el contenedor.

## 7. Documentación y pruebas

- JSDoc en métodos y funciones; cada archivo TypeScript empieza con un comentario de propósito y funcionamiento.
- Cada requisito tiene una prueba cuyo nombre lo describe en una frase legible; leídas en orden, cuentan qué hace el producto. Las pruebas no dependen de la red (APIs mockeadas).
- Toda tarea definida deja una prueba (skill `/probar`). Si una prueba falla, se corrige el código, nunca la prueba, salvo que la tarea pidiera cambiar ese comportamiento; entonces se actualiza esa prueba.
