import { TipoMinijuego } from '../../core/models/sala.model';

export const TIPOS_MINIJUEGO: TipoMinijuego[] = ['secuencia', 'cableado', 'mapa', 'codigo', 'metro', 'ecuacion', 'palabra', 'carrera'];

export const NOMBRE_MINIJUEGO: Record<TipoMinijuego, string> = {
  secuencia: '🔣 Símbolos en secuencia',
  cableado: '✂️ Cableado',
  mapa: '🗺️ Mapa a ciegas',
  codigo: '🔐 Código de dígitos',
  metro: '🚇 Ruta de metro',
  ecuacion: '➗ Ecuación oculta',
  palabra: '🔤 Palabra desordenada',
  carrera: '🏁 Orden de llegada'
};

export interface Puzle {
  panel: any;        // lo que ve el capitán
  pistas: string[];  // piezas para los ayudantes (líneas separadas por \n)
  solucion: any;     // solución (no se muestra en pantalla)
}

export const SEG_TURNO_DEFAULT = 60;
export const PENALIZACION_ERROR_MS = 5000;

const rnd = (n: number): number => Math.floor(Math.random() * n);
const pick = <T>(lista: T[]): T => lista[rnd(lista.length)];

export function barajar<T>(lista: T[]): T[] {
  const c = [...lista];
  for (let i = c.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

/** Reparte las piezas entre los ayudantes. Si hay menos piezas que personas, se repiten. */
function repartir(items: string[], n: number): string[] {
  const base = items.length ? items : ['Sin datos adicionales.'];
  const piezas = base.length >= n ? base : Array.from({ length: n }, (_, i) => base[i % base.length]);
  return Array.from({ length: n }, (_, i) => piezas.filter((_, j) => j % n === i).join('\n'));
}

/** Genera un puzle del tipo indicado. El nivel sube la dificultad; el resultado es aleatorio. */
export function generarPuzle(tipo: TipoMinijuego, nivel: number, ayudantes: number): Puzle {
  const n = Math.max(1, ayudantes);
  const L = Math.max(1, nivel);
  switch (tipo) {
    case 'secuencia': return generarSecuencia(L, n);
    case 'cableado': return generarCableado(L, n);
    case 'mapa': return generarMapa(L, n);
    case 'codigo': return generarCodigo(L, n);
    case 'metro': return generarMetro(L, n);
    case 'ecuacion': return generarEcuacion(L, n);
    case 'palabra': return generarPalabra(L, n);
    case 'carrera': return generarCarrera(L, n);
  }
}

// ------------------------------------------------------------------
// Códigos de dígitos: las pistas se eligen al azar, y se comprueba
// que el código quede determinado. No hay una plantilla fija.
// ------------------------------------------------------------------
interface PistaCodigo { texto: string; comprueba: (x: number[]) => boolean; }

function generarCodigo(L: number, n: number): Puzle {
  const D = Math.min(L + 1, 5);
  // Tipos de pista según el nivel: al principio, solo el valor exacto de cada dígito
  const permitidos = L === 1 ? [0] : L === 2 ? [0, 1, 3] : L === 3 ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5, 6];
  const d = Array.from({ length: D }, () => rnd(10));
  const total = Math.pow(10, D);

  const crear = (): PistaCodigo => {
    const i = rnd(D);
    let j = rnd(D);
    if (j === i) j = (i + 1) % D;
    switch (permitidos[rnd(permitidos.length)]) {
      case 0: {
        const v = d[i];
        return { texto: pick([`El dígito ${i + 1} es ${v}.`, `En el puesto ${i + 1} hay un ${v}.`]),
          comprueba: x => x[i] === v };
      }
      case 1: {
        const par = d[i] % 2 === 0;
        return { texto: `El dígito ${i + 1} es ${par ? 'par' : 'impar'}.`,
          comprueba: x => (x[i] % 2 === 0) === par };
      }
      case 2: {
        const mayor = d[i] > d[j];
        return { texto: `El dígito ${i + 1} es ${mayor ? 'mayor' : 'menor o igual'} que el ${j + 1}.`,
          comprueba: x => (x[i] > x[j]) === mayor };
      }
      case 3: {
        const s = d.reduce((a, b) => a + b, 0);
        return { texto: `La suma de todos los dígitos es ${s}.`,
          comprueba: x => x.reduce((a, b) => a + b, 0) === s };
      }
      case 4: {
        const u = d[i] + rnd(10 - d[i]);
        return { texto: `El dígito ${i + 1} es menor o igual que ${u}.`, comprueba: x => x[i] <= u };
      }
      case 5: {
        const iguales = d[i] === d[j];
        return { texto: iguales ? `Los dígitos ${i + 1} y ${j + 1} son iguales.` : `Los dígitos ${i + 1} y ${j + 1} son distintos.`,
          comprueba: x => (x[i] === x[j]) === iguales };
      }
      default: {
        const v = pick(d);
        return { texto: `Aparece un ${v} en el código.`, comprueba: x => x.includes(v) };
      }
    }
  };

  const candidatos = (pistas: PistaCodigo[]): number => {
    let k = 0;
    for (let x = 0; x < total; x++) {
      const arr: number[] = [];
      let r = x;
      for (let p = 0; p < D; p++) { arr.unshift(r % 10); r = Math.floor(r / 10); }
      if (pistas.every(q => q.comprueba(arr))) k++;
      if (k > 1) return k;
    }
    return k;
  };

  const pistas: PistaCodigo[] = [];
  let intentos = 0;
  while (candidatos(pistas) !== 1 && intentos++ < 40) pistas.push(crear());
  // Pistas extra: en el nivel 1 no hay, para que empiece sencillo
  const extras = L === 1 ? 0 : rnd(2);
  for (let e = 0; e < extras; e++) pistas.push(crear());
  const textos = barajar([...new Set(pistas.map(p => p.texto))]);

  return { panel: { longitud: D }, pistas: repartir(textos, n), solucion: d.join('') };
}

// ------------------------------------------------------------------
// Símbolos en secuencia: crece la longitud, el número de símbolos
// de la tabla y aparecen símbolos señuelo (no están en la secuencia).
// ------------------------------------------------------------------
function generarSecuencia(L: number, n: number): Puzle {
  const glifos = ['▲', '●', '■', '★', '◆', '✚', '♠', '♣', '♥', '✦'];
  const Q = Math.min(2 + L, 7);                 // longitud de la secuencia
  const S = Math.min(Math.max(Q, 3 + L), 9);    // símbolos distintos en la tabla
  const simbolos = barajar(glifos).slice(0, S);
  const digitos = barajar([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, S);
  const tabla = simbolos.map((s, i) => ({ s, d: digitos[i] }));
  const seq = Array.from({ length: Q }, () => pick(tabla));
  const usados = new Set(seq.map(x => x.s));

  const textoPar = (m: { s: string; d: number }) => pick([
    `${m.s} vale ${m.d}.`, `${m.d} es ${m.s}.`, `El símbolo ${m.s} representa el ${m.d}.`
  ]);
  // Los símbolos de la secuencia siempre tienen pista. Los señuelos aparecen desde el nivel 2.
  const pistas = tabla
    .filter(m => usados.has(m.s) || L >= 2)
    .map(textoPar);

  return {
    panel: { secuencia: seq.map(x => x.s) },
    pistas: repartir(barajar(pistas), n),
    solucion: seq.map(x => String(x.d)).join('')
  };
}

// ------------------------------------------------------------------
function generarCableado(L: number, n: number): Puzle {
  const COLORES = ['rojo', 'azul', 'verde', 'amarillo', 'blanco', 'negro', 'naranja'];
  const W = Math.min(5 + 2 * Math.floor((L - 1) / 2), 9);
  const hilos = Array.from({ length: W }, () => pick(COLORES));
  const X = pick(COLORES);
  if (hilos.every(h => h === X)) hilos[rnd(W)] = pick(COLORES.filter(c => c !== X));
  const k = 1 + rnd(W);
  let solucion: number;
  let pistas: string[];
  switch (rnd(3)) {
    case 0: {
      const p = hilos.indexOf(X);
      solucion = (p >= 0 ? p : W - 1) + 1;
      pistas = [`Color a buscar: ${X}.`,
        'Si aparece ese color, corta el PRIMERO de ese color. Si no aparece, corta el ÚLTIMO.'];
      break;
    }
    case 1: {
      const p = hilos.lastIndexOf(X);
      solucion = (p >= 0 ? p : k - 1) + 1;
      pistas = [`Color a buscar: ${X}.`,
        `Si aparece ese color, corta el ÚLTIMO de ese color. Si no aparece, corta el cable número ${k}.`];
      break;
    }
    default: {
      const p = hilos.findIndex(h => h !== X);
      solucion = p + 1;
      pistas = [`Evita el color ${X}.`, 'Corta el primer cable que NO sea de ese color.'];
    }
  }
  // Hechos verdaderos y aleatorios sobre los cables: cada ayudante recibe piezas distintas
  const hechos: string[] = [];
  const cantidad = Math.max(0, n - pistas.length) + 1 + rnd(3);
  for (let e = 0; e < cantidad; e++) {
    const i = rnd(W);
    const otro = pick(COLORES.filter(c => c !== hilos[i]));
    switch (rnd(3)) {
      case 0: hechos.push(`El cable ${i + 1} es de color ${hilos[i]}.`); break;
      case 1: hechos.push(`El cable ${i + 1} NO es ${otro}.`); break;
      default: {
        const veces = hilos.filter(h => h === X).length;
        hechos.push(`Hay ${veces} cable(s) de color ${X}.`);
      }
    }
  }
  return { panel: { hilos }, pistas: repartir(barajar([...pistas, ...hechos]), n), solucion };
}

// ------------------------------------------------------------------
function existeCamino(muros: boolean[][], ini: number[], fin: number[], N: number): boolean {
  const visto = new Set<string>([ini.join(',')]);
  const cola: number[][] = [ini];
  while (cola.length) {
    const [r, c] = cola.shift()!;
    if (r === fin[0] && c === fin[1]) return true;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      const k = `${nr},${nc}`;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N || muros[nr][nc] || visto.has(k)) continue;
      visto.add(k);
      cola.push([nr, nc]);
    }
  }
  return false;
}

function generarMapa(L: number, n: number): Puzle {
  const N = Math.min(4 + Math.floor((L - 1) / 2), 7);
  const ini = [rnd(N), rnd(N)];
  let fin = [rnd(N), rnd(N)];
  while (Math.abs(fin[0] - ini[0]) + Math.abs(fin[1] - ini[1]) < N - 1) fin = [rnd(N), rnd(N)];
  let muros: boolean[][];
  do {
    const densidad = 0.2 + Math.random() * 0.15;
    muros = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.random() < densidad));
    muros[ini[0]][ini[1]] = false;
    muros[fin[0]][fin[1]] = false;
  } while (!existeCamino(muros, ini, fin, N));

  // Pistas visuales: cada ayudante recibe filas (o columnas) para dibujarlas
  const pistas: string[] = [];
  if (Math.random() < 0.5) {
    for (let r = 0; r < N; r++) pistas.push(JSON.stringify({ eje: 'fila', indice: r + 1, muros: muros[r] }));
  } else {
    for (let c = 0; c < N; c++) pistas.push(JSON.stringify({ eje: 'columna', indice: c + 1, muros: muros.map(f => f[c]) }));
  }
  return {
    panel: { tamano: N, inicio: [ini[0] + 1, ini[1] + 1], meta: [fin[0] + 1, fin[1] + 1] },
    pistas: repartir(pistas, n),
    solucion: { muros, inicio: ini, meta: fin, tamano: N }
  };
}

// ------------------------------------------------------------------
// Ruta de metro: estaciones inventadas al azar, cada vez más líneas.
// Las pistas son visuales (líneas dibujadas) y hay tantas piezas
// como ayudantes, para que nadie se quede sin pista.
// ------------------------------------------------------------------
const COLORES_LINEA = ['azul', 'rojo', 'verde', 'amarillo', 'morado', 'naranja', 'rosa', 'turquesa', 'gris'];
const PREFIJOS = ['Plaza', 'Parque', 'Estación', 'Barrio', 'Calle', 'Avenida', 'Mercado', 'Puerto', 'Glorieta', 'Puente'];
const SUFIJOS = ['Norte', 'Sur', 'Este', 'Oeste', 'Central', 'Viejo', 'Nuevo', 'del Río', 'de la Paz', 'del Sol', 'Alto', 'Bajo', 'Mayor', 'Real'];

function nombreEstacion(usados: Set<string>): string {
  let nombre: string;
  do {
    nombre = pick(PREFIJOS) + ' ' + pick(SUFIJOS);
  } while (usados.has(nombre));
  usados.add(nombre);
  return nombre;
}

function calcularTransbordos(lineas: Record<string, string[]>, origen: string, destino: string): number {
  const clave = (est: string, l: string) => est + '|' + l;
  const dist = new Map<string, number>();
  const cola: [string, string, number][] = [];
  const relajar = (est: string, l: string, c: number) => {
    const k = clave(est, l);
    if (!dist.has(k) || c < dist.get(k)!) {
      dist.set(k, c);
      cola.push([est, l, c]);
    }
  };
  for (const [l, sts] of Object.entries(lineas)) {
    if (sts.includes(origen)) relajar(origen, l, 0);
  }
  let mejor = Infinity;
  while (cola.length) {
    cola.sort((a, b) => a[2] - b[2]);
    const [est, l, c] = cola.shift()!;
    if (dist.get(clave(est, l)) !== c) continue;
    if (est === destino) mejor = Math.min(mejor, c);
    const sts = lineas[l];
    const i = sts.indexOf(est);
    for (const j of [i - 1, i + 1]) {
      if (j >= 0 && j < sts.length) relajar(sts[j], l, c);
    }
    for (const [l2, s2] of Object.entries(lineas)) {
      if (l2 !== l && s2.includes(est)) relajar(est, l2, c + 1);
    }
  }
  return mejor;
}

function generarMetro(L: number, n: number): Puzle {
  // Hay como mínimo una línea activa por ayudante. El nivel añade líneas y, desde el nivel 2,
  // líneas cerradas por obras que no cuentan para la respuesta pero sí despistan.
  const numActivas = Math.max(Math.min(2 + Math.floor((L - 1) / 2), 6), n);
  const numCerradas = L >= 2 ? rnd(2) + (L >= 4 ? 1 : 0) : 0;
  const tamMax = 3 + Math.min(Math.floor((L - 1) / 2), 2);
  const total = numActivas + numCerradas;

  let lineasActivas: Record<string, string[]> = {};
  let lineasCerradas: Record<string, string[]> = {};
  let colores: Record<string, string> = {};
  let origen = '';
  let destino = '';
  let distancia = 1;

  for (let intento = 0; intento < 300; intento++) {
    const usados = new Set<string>();
    const pool = Array.from({ length: total * tamMax }, () => nombreEstacion(usados));
    const coloresB = barajar(COLORES_LINEA);
    lineasActivas = {};
    lineasCerradas = {};
    colores = {};
    for (let i = 0; i < total; i++) {
      const id = `L${i + 1}`;
      const sts = barajar(pool).slice(0, 3 + rnd(tamMax - 2));
      if (i < numActivas) lineasActivas[id] = sts;
      else lineasCerradas[id] = sts;
      colores[id] = coloresB[i % coloresB.length];
    }

    // Todas las distancias posibles dentro de la red activa
    const todas = [...new Set(Object.values(lineasActivas).flat())];
    const porDistancia = new Map<number, [string, string][]>();
    for (const a of todas) {
      for (const b of todas) {
        if (a === b) continue;
        const dist = calcularTransbordos(lineasActivas, a, b);
        if (!isFinite(dist) || dist < 1) continue;
        if (!porDistancia.has(dist)) porDistancia.set(dist, []);
        porDistancia.get(dist)!.push([a, b]);
      }
    }
    if (porDistancia.size === 0) continue;

    // Se elige la distancia al azar entre las posibles: 1, 2, 3... sin patrón
    distancia = pick([...porDistancia.keys()]);
    [origen, destino] = pick(porDistancia.get(distancia)!);
    break;
  }

  const piezas: string[] = [];
  for (const [id, sts] of Object.entries(lineasActivas)) {
    const orden = Math.random() < 0.5 ? sts : [...sts].reverse();
    piezas.push(JSON.stringify({ tipo: 'linea', color: colores[id], estaciones: orden }));
  }
  for (const [id, sts] of Object.entries(lineasCerradas)) {
    const orden = Math.random() < 0.5 ? sts : [...sts].reverse();
    piezas.push(JSON.stringify({ tipo: 'linea', color: colores[id], estaciones: orden, cerrada: true }));
  }

  return {
    panel: { origen, destino },
    pistas: repartir(barajar(piezas), n),
    solucion: distancia
  };
}

// ------------------------------------------------------------------
// Ecuación oculta: cada símbolo es una operación. Hay que calcular el resultado.
// ------------------------------------------------------------------
interface Operacion { nombre: string; calc: (a: number, b: number) => number | null; }
const OPERACIONES: Operacion[] = [
  { nombre: 'la suma', calc: (a, b) => a + b },
  { nombre: 'la resta', calc: (a, b) => a - b },
  { nombre: 'la multiplicación', calc: (a, b) => a * b },
  { nombre: 'la división exacta', calc: (a, b) => (b !== 0 && a % b === 0 ? a / b : null) }
];

function generarEcuacion(L: number, n: number): Puzle {
  const SIMBOLOS = ['◆', '▲', '●', '■'];
  const numOps = L === 1 ? 2 : L <= 3 ? 3 : 4;
  const ops = barajar(OPERACIONES).slice(0, numOps).map((o, i) => ({ ...o, simbolo: SIMBOLOS[i] }));
  const op = pick(ops);
  let a = 0, b = 0;
  let res: number | null = null;
  for (let i = 0; i < 200 && res === null; i++) {
    a = 2 + rnd(L <= 2 ? 9 : 20);
    b = 2 + rnd(L <= 2 ? 8 : 12);
    res = op.calc(a, b);
  }
  // La pista del símbolo usado siempre está; los demás, afirmaciones verdaderas al azar
  const pistas = [`${op.simbolo} es ${op.nombre}.`];
  for (const o of ops) {
    if (o === op) continue;
    pistas.push(rnd(2) === 0 ? `${o.simbolo} NO es ${op.nombre}.` : `${o.simbolo} es ${o.nombre}.`);
  }
  return {
    panel: { ecuacion: [a, op.simbolo, b] },
    pistas: repartir(barajar(pistas), n),
    solucion: String(res)
  };
}

// ------------------------------------------------------------------
// Palabra desordenada: pistas sobre posiciones y letras. Se comprueba
// que solo una palabra del diccionario cumpla todas las pistas.
// ------------------------------------------------------------------
const PALABRAS = ['casa', 'mesa', 'perro', 'gato', 'sol', 'luna', 'mar', 'rio', 'flor', 'arbol', 'libro',
  'playa', 'nube', 'viento', 'puerta', 'ventana', 'reloj', 'pared', 'cielo', 'tierra', 'fuego', 'agua',
  'piedra', 'camino', 'bosque', 'sombra', 'estrella', 'jardin', 'silla', 'cuchara', 'sopa', 'queso',
  'uva', 'pera', 'lapiz', 'cesta', 'globo', 'barco', 'tren', 'avion', 'bicicleta', 'zapato', 'cometa',
  'manzana', 'naranja'];
const LETRAS = 'abcdefghilmnoprstuv'.split('');

function normalizarPalabra(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}

interface PistaPalabra { texto: string; comprueba: (w: string) => boolean; }

function generarPalabra(L: number, n: number): Puzle {
  const longitud = Math.min(3 + L, 8);
  let candidatas = PALABRAS.filter(p => p.length === longitud);
  if (!candidatas.length) candidatas = PALABRAS;
  const palabra = pick(candidatas);
  const diccionario = PALABRAS.filter(p => p.length === palabra.length);

  const crear = (): PistaPalabra => {
    switch (rnd(4)) {
      case 0: {
        const i = rnd(palabra.length);
        const x = palabra[i];
        return { texto: `La letra ${i + 1} es ${x.toUpperCase()}.`, comprueba: w => w[i] === x };
      }
      case 1: {
        const i = rnd(palabra.length);
        const x = pick(LETRAS.filter(l => l !== palabra[i]));
        return { texto: `La letra ${i + 1} NO es ${x.toUpperCase()}.`, comprueba: w => w[i] !== x };
      }
      case 2: {
        const x = pick(palabra.split(''));
        return { texto: `La letra ${x.toUpperCase()} aparece en la palabra.`, comprueba: w => w.includes(x) };
      }
      default: {
        const x = pick(LETRAS.filter(l => !palabra.includes(l)));
        return { texto: `La letra ${x.toUpperCase()} NO aparece en la palabra.`, comprueba: w => !w.includes(x) };
      }
    }
  };

  const pistas: PistaPalabra[] = [];
  const cuantas = () => diccionario.filter(w => pistas.every(h => h.comprueba(w))).length;
  for (let intento = 0; intento < 60 && cuantas() !== 1; intento++) pistas.push(crear());
  if (rnd(2) === 0) pistas.push(crear());

  // Letras desordenadas, distintas de la palabra original
  let letras = barajar(palabra.split(''));
  for (let i = 0; i < 20 && letras.join('') === palabra; i++) letras = barajar(palabra.split(''));
  const textos = barajar([...new Set(pistas.map(p => p.texto))]);

  return {
    panel: { letras: letras.map(l => l.toUpperCase()) },
    pistas: repartir(textos, n),
    solucion: palabra.toUpperCase()
  };
}

// ------------------------------------------------------------------
// Orden de llegada: se pregunta la posición final de un corredor.
// Las pistas son comparaciones verdaderas; se comprueba que la posición
// quede determinada.
// ------------------------------------------------------------------
const CORREDORES = ['Ana', 'Luis', 'Marta', 'Pablo', 'Lucia', 'Hugo', 'Sara', 'Ivan', 'Nora', 'Raul'];

function permutaciones<T>(lista: T[]): T[][] {
  if (lista.length <= 1) return [lista];
  const res: T[][] = [];
  lista.forEach((x, i) => {
    const resto = [...lista.slice(0, i), ...lista.slice(i + 1)];
    for (const p of permutaciones(resto)) res.push([x, ...p]);
  });
  return res;
}

interface PistaCarrera { texto: string; comprueba: (orden: string[]) => boolean; }

function generarCarrera(L: number, n: number): Puzle {
  const k = Math.min(3 + Math.floor((L - 1) / 2), 6);
  const nombres = barajar(CORREDORES).slice(0, k);
  const llegada = barajar(nombres);
  const objetivo = pick(nombres);
  const pos = (orden: string[], x: string) => orden.indexOf(x) + 1;
  const posReal = pos(llegada, objetivo);

  const crear = (): PistaCarrera => {
    const x = pick(nombres);
    let y = pick(nombres);
    if (y === x) y = nombres[(nombres.indexOf(x) + 1) % nombres.length];
    switch (rnd(4)) {
      case 0: {
        const antes = pos(llegada, x) < pos(llegada, y);
        return {
          texto: antes ? `${x} llegó antes que ${y}.` : `${x} llegó después de ${y}.`,
          comprueba: o => (pos(o, x) < pos(o, y)) === antes
        };
      }
      case 1: {
        const p = pos(llegada, x);
        return { texto: `${x} llegó en la posición ${p}.`, comprueba: o => pos(o, x) === p };
      }
      case 2: {
        const p = pos(llegada, x);
        return { texto: `${x} NO llegó en la posición ${p}.`, comprueba: o => pos(o, x) !== p };
      }
      default: {
        const entre = pos(llegada, x) <= 3;
        return {
          texto: entre ? `${x} llegó entre los tres primeros.` : `${x} NO llegó entre los tres primeros.`,
          comprueba: o => (pos(o, x) <= 3) === entre
        };
      }
    }
  };

  const perms = permutaciones(nombres);
  const pistas: PistaCarrera[] = [];
  const posiciones = () => {
    const s = new Set<number>();
    for (const o of perms) if (pistas.every(h => h.comprueba(o))) s.add(pos(o, objetivo));
    return s;
  };
  for (let intento = 0; intento < 60 && posiciones().size !== 1; intento++) pistas.push(crear());
  if (rnd(2) === 0) pistas.push(crear());
  const textos = barajar([...new Set(pistas.map(p => p.texto))]);

  return {
    panel: { corredores: nombres, objetivo },
    pistas: repartir(textos, n),
    solucion: String(posReal)
  };
}

/** Comprueba la respuesta según el tipo de puzle. */
export function validarRespuesta(tipo: TipoMinijuego, solucion: any, respuesta: string): boolean {
  const texto = (respuesta || '').trim();
  switch (tipo) {
    case 'secuencia':
    case 'codigo':
      return texto.replace(/\D/g, '') === String(solucion);
    case 'cableado':
    case 'metro':
    case 'ecuacion':
    case 'carrera':
      return Number(texto) === Number(solucion);
    case 'palabra':
      return normalizarPalabra(texto) === normalizarPalabra(String(solucion));
    case 'mapa': {
      const muros: boolean[][] = solucion.muros;
      const N = solucion.tamano;
      let r = solucion.inicio[0], c = solucion.inicio[1];
      for (const ch of texto.toUpperCase().replace(/\s/g, '')) {
        const d = ch === 'U' ? [-1, 0] : ch === 'D' ? [1, 0] : ch === 'L' ? [0, -1] : ch === 'R' ? [0, 1] : null;
        if (!d) return false;
        r += d[0];
        c += d[1];
        if (r < 0 || c < 0 || r >= N || c >= N || muros[r][c]) return false;
      }
      return r === solucion.meta[0] && c === solucion.meta[1];
    }
  }
}
