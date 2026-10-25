import { TipoMinijuego } from '../../core/models/sala.model';

export const TIPOS_MINIJUEGO: TipoMinijuego[] = ['secuencia', 'cableado', 'mapa', 'codigo', 'metro', 'ecuacion', 'palabra', 'carrera', 'torres', 'pinta', 'mezcla', 'deslizante', 'balanza', 'fraude', 'reactor', 'puntero', 'semaforo', 'barco', 'cocina', 'grua', 'quien', 'simon'];

export const NOMBRE_MINIJUEGO: Record<TipoMinijuego, string> = {
  secuencia: '🔣 Símbolos en secuencia',
  cableado: '✂️ Cableado',
  mapa: '🗺️ Mapa a ciegas',
  codigo: '🔐 Código de dígitos',
  metro: '🚇 Ruta de metro',
  ecuacion: '➗ Ecuación oculta',
  palabra: '🔤 Palabra desordenada',
  carrera: '🏁 Orden de llegada',
  torres: '🗼 Torres de Hanói',
  pinta: '🎨 Pinta el patrón',
  mezcla: '🧪 Mezcla de colores',
  deslizante: '🧩 Puzle deslizante',
  fraude: '🏭 Fraude en la cadena',
  reactor: '☢️ Reactor en peligro',
  puntero: '🎯 Puntero láser',
  semaforo: '🚦 Semáforo de cruce',
  barco: '🚤 Barco por el canal',
  cocina: '🍳 Cocina a cuatro manos',
  grua: '🏗️ Grúa de carga',
  quien: '🔤 Quién va primero',
  simon: '🔴 Simón dice',
  balanza: '⚖️ Balanza'
};

export interface Puzle {
  panel: any;        // lo que ve el capitán
  pistas: string[];  // piezas para los ayudantes (líneas separadas por \n)
  solucion: any;     // solución (no se muestra en pantalla)
  estadoInicial?: any; // solo juegos interactivos: estado con el que empieza el capitán
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
    case 'torres': return generarTorres(L, n);
    case 'pinta': return generarPinta(L, n);
    case 'mezcla': return generarMezcla(L, n);
    case 'deslizante': return generarDeslizante(L, n);
    case 'balanza': return generarBalanza(L, n);
    case 'fraude': return generarFraude(L, n);
    case 'reactor': return generarReactor(L, n);
    case 'puntero': return generarPuntero(L, n);
    case 'semaforo': return generarSemaforo(L, n);
    case 'barco': return generarBarco(L, n);
    case 'cocina': return generarCocina(L, n);
    case 'grua': return generarGrua(L, n);
    case 'quien': return generarQuienVaPrimero(L, n);
    case 'simon': return generarSimon(L, n);
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
// Símbolos complejos: el capitán los ve y tiene que describirlos; el equipo solo conoce la descripción
const SIMBOLOS_COMPLEJOS: { g: string; desc: string }[] = [
  { g: '⬡', desc: 'un hexágono vacío' },
  { g: '✦', desc: 'una estrella de cuatro puntas' },
  { g: '☯', desc: 'el yin y el yang' },
  { g: '⌘', desc: 'el símbolo de la tecla comando' },
  { g: '◈', desc: 'un rombo con otro rombo dentro' },
  { g: '⧫', desc: 'un rombo negro' },
  { g: '⬢', desc: 'un hexágono lleno' },
  { g: '✪', desc: 'una estrella con un círculo en el centro' },
  { g: '⚑', desc: 'una bandera' },
  { g: '☽', desc: 'una luna creciente' },
  { g: '♆', desc: 'el símbolo de Neptuno' },
  { g: '⚘', desc: 'una flor pequeña' },
  { g: '⚛', desc: 'un átomo' },
  { g: '⛨', desc: 'un escudo con una cruz' },
  { g: '⊛', desc: 'un círculo con una estrella dentro' },
  { g: '⎈', desc: 'el timón de un barco' },
  { g: '⌬', desc: 'un hexágono con líneas dentro' },
  { g: '✹', desc: 'una estrella explosiva' },
  { g: '⚜', desc: 'una flor de lis' },
  { g: '⧉', desc: 'dos cuadrados encajados' },
  { g: '⎔', desc: 'un hexágono de esquinas redondeadas' },
  { g: '⟁', desc: 'un triángulo hueco' },
  { g: '✵', desc: 'una estrella de seis puntas' },
  { g: '♒', desc: 'el signo de Acuario' }
];

// Cada ayudante recibe sus símbolos necesarios y 2 señuelos (símbolos que no aparecen en la secuencia)
function generarSecuencia(L: number, n: number): Puzle {
  const D = Math.min(2 + L, 6);                       // símbolos distintos que hacen falta
  const Q = Math.max(Math.min(2 + L, 7), D);          // longitud de la secuencia
  const tabla = barajar(SIMBOLOS_COMPLEJOS).slice(0, Math.min(D + 2 * n, SIMBOLOS_COMPLEJOS.length));
  const necesarios = tabla.slice(0, D).map(s => ({ ...s, valor: rnd(10) }));
  const señuelos = tabla.slice(D).map(s => ({ ...s, valor: rnd(10) }));
  const seq = barajar([...necesarios, ...Array.from({ length: Q - D }, () => pick(necesarios))]);

  const lineas: string[][] = Array.from({ length: n }, () => []);
  necesarios.forEach((s, i) => lineas[i % n].push(`${s.g} vale ${s.valor}.`));
  señuelos.forEach((s, i) => lineas[i % n].push(`${s.g} vale ${s.valor}.`));

  return {
    panel: { secuencia: seq.map(x => x.g) },
    pistas: lineas.map(l => barajar(l).join('\n')),
    solucion: seq.map(x => String(x.valor)).join('')
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

// ------------------------------------------------------------------
// Juegos interactivos: el capitán manipula algo visible y pulsa Comprobar.
// El estado se guarda como texto JSON para no perder arrays vacíos en Firebase.
// ------------------------------------------------------------------
export const INTERACTIVOS: TipoMinijuego[] = ['torres', 'pinta', 'mezcla', 'deslizante', 'balanza'];

const sumaArr = (a: number[]): number => a.reduce((x, y) => x + y, 0);

// Torres de Hanói: el capitán mueve discos; el equipo conoce la torre final
function generarTorres(L: number, n: number): Puzle {
  const discos = Math.min(2 + L, 6);
  const tamanos = Array.from({ length: discos }, (_, i) => discos - i); // el mayor primero
  const destino: number[][] = [[], [], []];
  for (const t of tamanos) destino[rnd(3)].push(t);
  const inicio: number[][] = [[...tamanos], [], []];
  const pistas = destino.map((t, i) =>
    t.length ? `Torre ${i + 1}, de abajo a arriba: ${t.join(', ')}.` : `Torre ${i + 1}: vacía.`);
  return {
    panel: { discos },
    pistas: repartir(barajar(pistas), n),
    solucion: JSON.stringify(destino),
    estadoInicial: inicio
  };
}

// Pinta el patrón: el capitán colorea la cuadrícula; el equipo ve el dibujo
const COLORES_PINTA = ['azul', 'rojo', 'verde', 'amarillo'];
function generarPinta(L: number, n: number): Puzle {
  const N = Math.min(3 + Math.floor((L - 1) / 2), 5);
  const objetivo: string[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => (rnd(4) === 0 ? '' : pick(COLORES_PINTA))));
  const vacio: string[][] = Array.from({ length: N }, () => Array.from({ length: N }, () => ''));
  const filas = objetivo.map((celdas, r) => JSON.stringify({ tipo: 'fila', indice: r + 1, celdas }));
  return {
    panel: { tamano: N },
    pistas: repartir(filas, n),
    solucion: JSON.stringify(objetivo),
    estadoInicial: vacio
  };
}

// Mezcla de colores: hay que añadir las partes exactas de cada color
const MEZCLA_RGB: Record<string, number[]> = { rojo: [220, 38, 38], azul: [37, 99, 235], amarillo: [250, 204, 21] };
function generarMezcla(L: number, n: number): Puzle {
  const total = Math.min(2 + L, 10);
  let r = 0, a = 0, y = 0;
  do {
    r = rnd(total + 1);
    a = rnd(total - r + 1);
    y = total - r - a;
  } while ((r > 0 ? 1 : 0) + (a > 0 ? 1 : 0) + (y > 0 ? 1 : 0) < 2);
  const rgb = [0, 1, 2].map(k =>
    Math.round((r * MEZCLA_RGB.rojo[k] + a * MEZCLA_RGB.azul[k] + y * MEZCLA_RGB.amarillo[k]) / total));
  const plural = (x: number) => (x === 1 ? 'parte' : 'partes');
  const pistas = [`Rojo: ${r} ${plural(r)}.`, `Azul: ${a} ${plural(a)}.`, `Amarillo: ${y} ${plural(y)}.`];
  return {
    panel: { colorObjetivo: `rgb(${rgb.join(',')})`, partes: total },
    pistas: repartir(barajar(pistas), n),
    solucion: JSON.stringify({ rojo: r, azul: a, amarillo: y }),
    estadoInicial: { rojo: 0, azul: 0, amarillo: 0 }
  };
}

// Puzle deslizante: el tablero se mezcla con movimientos legales
function generarDeslizante(L: number, n: number): Puzle {
  const N = L <= 2 ? 3 : 4;
  const final = Array.from({ length: N * N - 1 }, (_, i) => i + 1).concat([0]);
  const tablero = [...final];
  let blank = N * N - 1;
  let prev = -1;
  for (let k = 0; k < 300; k++) {
    const r = Math.floor(blank / N), c = blank % N;
    const vec: number[] = [];
    if (r > 0) vec.push(blank - N);
    if (r < N - 1) vec.push(blank + N);
    if (c > 0) vec.push(blank - 1);
    if (c < N - 1) vec.push(blank + 1);
    const opts = vec.filter(v => v !== prev);
    const to = pick(opts.length ? opts : vec);
    [tablero[blank], tablero[to]] = [tablero[to], tablero[blank]];
    prev = blank;
    blank = to;
  }
  const filas = Array.from({ length: N }, (_, r) =>
    JSON.stringify({ tipo: 'fila', indice: r + 1, celdas: final.slice(r * N, r * N + N) }));
  return {
    panel: { tamano: N },
    pistas: repartir(filas, n),
    solucion: JSON.stringify(final),
    estadoInicial: tablero
  };
}

// Balanza: hay que repartir los objetos para que las dos bandejas pesen lo mismo
const ICONOS_BALANZA = ['🍎', '🧱', '📦', '🍐', '🥔', '🪨', '🧃', '🍋'];
function generarBalanza(L: number, n: number): Puzle {
  const k = Math.min(3 + Math.floor((L - 1) / 2), 6);
  const izqN = 1 + rnd(k - 1);
  const derN = k - izqN;
  let pIzq: number[] = [];
  let S = 0;
  do {
    pIzq = Array.from({ length: izqN }, () => 1 + rnd(9));
    S = sumaArr(pIzq);
  } while (S < derN);
  // La suma de la izquierda se reparte en partes positivas para la derecha
  const cortes = new Set<number>();
  while (cortes.size < derN - 1) cortes.add(1 + rnd(S - 1));
  const cs = [0, ...[...cortes].sort((x, y) => x - y), S];
  const pDer = Array.from({ length: derN }, (_, i) => cs[i + 1] - cs[i]);
  const pesos = [...pIzq, ...pDer];
  const iconos = barajar(ICONOS_BALANZA).slice(0, k);
  const items = barajar(Array.from({ length: k }, (_, i) => i)).map(i => ({ id: i, icono: iconos[i] }));
  const pistas = pesos.map((p, i) => `${iconos[i]} pesa ${p}.`);
  return {
    panel: { items },
    pistas: repartir(barajar(pistas), n),
    solucion: JSON.stringify(pesos),
    estadoInicial: { mesa: items.map(x => x.id), izq: [], der: [] }
  };
}

// ------------------------------------------------------------------
// Fraude en la cadena de montaje: el capitán decide (aceptar o rechazar) cada pieza de la cinta
// según las normas que le dictan sus compañeros. Hay dos normativas: la A rige hasta la mitad de
// la cinta y la B desde ahí hasta el final (cambio de normativa por pieza, no por tiempo).
// Cada ayudante recibe fragmentos de ambas normativas, repartidos entre todos.
// ------------------------------------------------------------------
const FORMAS_FRAUDE = ['cuadrada', 'redonda', 'triangular'];
const COLORES_FRAUDE = ['azul', 'rojo', 'verde'];

interface PiezaFraude { forma: string; color: string; arandela: boolean; }
type ReglaFraude = Partial<PiezaFraude>;

function coincideRegla(r: ReglaFraude, p: PiezaFraude): boolean {
  return (r.forma === undefined || r.forma === p.forma)
    && (r.color === undefined || r.color === p.color)
    && (r.arandela === undefined || r.arandela === p.arandela);
}

function textoRegla(r: ReglaFraude): string {
  const condiciones: string[] = [];
  if (r.forma !== undefined) condiciones.push(`de forma ${r.forma}`);
  if (r.color !== undefined) condiciones.push(`de color ${r.color}`);
  if (r.arandela !== undefined) condiciones.push(r.arandela ? 'con arandela' : 'sin arandela');
  return `Se RECHAZAN las piezas ${condiciones.join(' y ')}.`;
}

function reglaAleatoria(): ReglaFraude {
  const todas: ('forma' | 'color' | 'arandela')[] = ['forma', 'color', 'arandela'];
  const r: ReglaFraude = {};
  for (const c of barajar(todas).slice(0, 1 + rnd(2))) {
    if (c === 'forma') r.forma = pick(FORMAS_FRAUDE);
    else if (c === 'color') r.color = pick(COLORES_FRAUDE);
    else r.arandela = Math.random() < 0.5;
  }
  return r;
}

// ------------------------------------------------------------------
// Fraude v2: cada pieza tiene un veredicto fijo en su tramo (A o B), y cada veredicto queda
// explicado por una regla real (ACEPTAR o RECHAZAR) que la cubre. Piezas del mismo tipo comparten
// veredicto, así nunca hay contradicciones. Las pistas falsas son reglas que no coinciden con
// ninguna pieza de la cinta: parecen normas, pero no cambian la solución.
// ------------------------------------------------------------------
type VeredictoFraude = 'R' | 'A';
interface ReglaFraudeV2 extends Partial<PiezaFraude> { v: VeredictoFraude; }

/** Todas las reglas posibles de 1 a 3 atributos. */
function todasLasReglas(): Partial<PiezaFraude>[] {
  const res: Partial<PiezaFraude>[] = [];
  for (const f of [undefined, ...FORMAS_FRAUDE]) {
    for (const c of [undefined, ...COLORES_FRAUDE]) {
      for (const a of [undefined, true, false]) {
        const r: Partial<PiezaFraude> = {};
        if (f !== undefined) r.forma = f;
        if (c !== undefined) r.color = c;
        if (a !== undefined) r.arandela = a;
        if (Object.keys(r).length > 0) res.push(r);
      }
    }
  }
  return res;
}

function generarFraude(L: number, n: number): Puzle {
  const P = Math.min(4 + L, 9);
  const cambio = Math.max(1, Math.floor(P / 2));
  const tramos: [number, number][] = [[0, cambio], [cambio, P]];
  const piezas: PiezaFraude[] = Array.from({ length: P }, () => ({
    forma: pick(FORMAS_FRAUDE), color: pick(COLORES_FRAUDE), arandela: Math.random() < 0.5
  }));

  // Mismo tipo de pieza, mismo veredicto
  const veredictoPorTipo = new Map<string, VeredictoFraude>();
  const veredictos: VeredictoFraude[] = piezas.map(p => {
    const clave = `${p.forma}|${p.color}|${p.arandela}`;
    if (!veredictoPorTipo.has(clave)) veredictoPorTipo.set(clave, Math.random() < 0.5 ? 'R' : 'A');
    return veredictoPorTipo.get(clave)!;
  });

  // Una regla es válida para un tramo si no contradice el veredicto de ninguna pieza de ese tramo
  const consistente = (r: Partial<PiezaFraude>, v: VeredictoFraude, seg: number[]): boolean =>
    seg.every(i => !coincideRegla(r, piezas[i]) || veredictos[i] === v);

  const normas: ReglaFraudeV2[][] = [[], []];
  tramos.forEach(([ini, fin], s) => {
    const seg = Array.from({ length: fin - ini }, (_, k) => ini + k);
    const lista = normas[s];
    // 1) Cada pieza del tramo queda explicada por una regla de su propio veredicto
    for (const i of seg) {
      const p = piezas[i];
      const v = veredictos[i];
      if (lista.some(r => r.v === v && coincideRegla(r, p))) continue;
      const candidatas = todasLasReglas().filter(r => coincideRegla(r, p) && consistente(r, v, seg));
      lista.push({ ...pick(candidatas), v });
    }
    // 2) Reglas extra para que cada ayudante reciba al menos una real de cada tramo
    const minimo = Math.max(2, n);
    while (lista.length < minimo) {
      const i = pick(seg);
      const candidatas = todasLasReglas().filter(r => coincideRegla(r, piezas[i]) && consistente(r, veredictos[i], seg));
      lista.push({ ...pick(candidatas), v: veredictos[i] });
    }
  });

  // Pistas falsas: reglas que no coinciden con ninguna pieza de la cinta
  const falsas = todasLasReglas().filter(r => !piezas.some(p => coincideRegla(r, p)));
  const porAyudante: string[][] = Array.from({ length: n }, () => []);
  normas[0].forEach((r, j) => porAyudante[j % n].push(JSON.stringify({ n: 'A', ...r })));
  normas[1].forEach((r, j) => porAyudante[j % n].push(JSON.stringify({ n: 'B', ...r })));
  for (let i = 0; i < n; i++) {
    const f = pick(falsas);
    porAyudante[i].push(JSON.stringify({ n: Math.random() < 0.5 ? 'A' : 'B', ...f, v: Math.random() < 0.5 ? 'R' : 'A' }));
  }

  return {
    panel: { piezas, cambio },
    pistas: porAyudante.map(l => barajar(l).join('\n')),
    solucion: veredictos.map(v => v === 'R'),
    estadoInicial: { idx: 0, cambio }
  };
}

function generarFraudeV1(L: number, n: number): Puzle {
  const P = Math.min(4 + L, 9);
  const cambio = Math.max(1, Math.floor(P / 2));
  const numReglas = Math.max(2, n);
  let piezas: PiezaFraude[] = [];
  let normaA: ReglaFraude[] = [];
  let normaB: ReglaFraude[] = [];
  let solucion: boolean[] = [];
  for (let intento = 0; intento < 200; intento++) {
    normaA = Array.from({ length: numReglas }, () => reglaAleatoria());
    normaB = Array.from({ length: numReglas }, () => reglaAleatoria());
    piezas = Array.from({ length: P }, () => ({
      forma: pick(FORMAS_FRAUDE), color: pick(COLORES_FRAUDE), arandela: Math.random() < 0.5
    }));
    // true = rechazar. Cada pieza se juzga con la normativa vigente cuando llega a la cinta.
    solucion = piezas.map((p, i) => (i < cambio ? normaA : normaB).some(r => coincideRegla(r, p)));
    const hayRechazoA = solucion.slice(0, cambio).some(x => x);
    const hayRechazoB = solucion.slice(cambio).some(x => x);
    if (hayRechazoA && hayRechazoB && solucion.some(x => !x)) break;
  }
  // Cada ayudante recibe al menos una regla real de cada normativa y, ademas, una pista falsa
  // (una regla que no cambia la solucion). Nadie se queda sin pistas, tenga o no normas reales.
  const porAyudante: string[][] = Array.from({ length: n }, () => []);
  normaA.forEach((r, j) => porAyudante[j % n].push(JSON.stringify({ n: 'A', ...r })));
  normaB.forEach((r, j) => porAyudante[j % n].push(JSON.stringify({ n: 'B', ...r })));
  for (let i = 0; i < n; i++) {
    porAyudante[i].push(JSON.stringify({ n: Math.random() < 0.5 ? 'A' : 'B', ...reglaAleatoria() }));
  }
  return {
    panel: { piezas, cambio },
    pistas: porAyudante.map(l => barajar(l).join('\n')),
    solucion,
    estadoInicial: { idx: 0, cambio }
  };
}

// ------------------------------------------------------------------
// Reactor: alertas que hay que resolver girando controles de distintas personas.
// Cada alerta exige dos controles reales de dueños distintos (uno, si solo hay una persona).
// Cada ayudante tiene al menos un control real y uno falso, que no afecta a ninguna alerta.
// El capitán ve las alertas; cada ayudante ve sus controles y sus pistas. La presión es el tiempo.
// ------------------------------------------------------------------
export const POSICIONES_REACTOR = 3;
const PROBLEMAS_REACTOR = ['Sobrecalentamiento en', 'Pérdida de presión en', 'Fuga en', 'Cortocircuito en'];
const MODULOS_REACTOR = ['el Módulo B', 'el Motor 1', 'Refrigeración', 'el Motor 2', 'la Turbina', 'el Compresor', 'la Bomba principal', 'el Núcleo'];
const CONTROLES_REACTOR = [
  { nombre: 'Válvula', icono: '🔧' }, { nombre: 'Interruptor', icono: '🔘' }, { nombre: 'Palanca', icono: '🕹️' },
  { nombre: 'Compuerta', icono: '🚪' }, { nombre: 'Regulador', icono: '🎚️' }, { nombre: 'Purga', icono: '💧' }
];

interface ControlReactor { id: string; nombre: string; icono: string; owner: number; pos: number; real: boolean; tipo?: string; alerta?: string; }
interface AlertaReactor { id: string; texto: string; aparecerEn: number; resuelta: boolean; reqs: { control: string; pos: number }[]; tipo?: string; }

/** Protocolo de seguridad: cada tipo de alerta pide controles de un tipo concreto en una posición fija. Es visible para todos. */
export const PROTOCOLO_REACTOR: { tipo: string; problema: string; control: string; pos: number; icono: string; motivo: string }[] = [
  { tipo: 'Temperatura', problema: 'Sobrecalentamiento en', control: 'Válvula', pos: 3, icono: '🔥', motivo: 'abrir el refrigerante al máximo' },
  { tipo: 'Presión', problema: 'Pérdida de presión en', control: 'Válvula', pos: 1, icono: '💧', motivo: 'cerrar para retener la presión' },
  { tipo: 'Fuga', problema: 'Fuga en', control: 'Compuerta', pos: 2, icono: '🌊', motivo: 'sellar el conducto' },
  { tipo: 'Eléctrico', problema: 'Cortocircuito en', control: 'Interruptor', pos: 1, icono: '⚡', motivo: 'cortar la corriente' }
];
const TIPOS_CONTROL_REACTOR = ['Válvula', 'Compuerta', 'Interruptor', 'Palanca'];
const ICONO_CONTROL_REACTOR: Record<string, string> = { 'Válvula': '🔧', 'Compuerta': '🚪', 'Interruptor': '🔘', 'Palanca': '🕹️' };

// Chuleta: cada alerta pide varios controles, de tipos distintos y en posiciones concretas.
// Esa información solo la tiene el capitán. Cada ayudante ve su control y espera su orden.
function generarReactor(L: number, n: number): Puzle {
  const E = 2 + (L >= 3 ? 1 : 0);                             // controles que pide cada alerta
  const porNivel = Math.min(1 + Math.floor((L - 1) / 2), 3);  // alertas a la vez
  const A = Math.min(4, Math.max(Math.ceil(n / E), porNivel));
  const modulos = barajar(MODULOS_REACTOR);
  const problemas = barajar(PROBLEMAS_REACTOR);
  const alertas: AlertaReactor[] = Array.from({ length: A }, (_, j) => ({
    id: `A${j + 1}`,
    texto: `${problemas[j % problemas.length]} ${modulos[j % modulos.length]}`,
    aparecerEn: j * 12,
    resuelta: false,
    reqs: []
  }));

  const controles: ControlReactor[] = [];
  const reales = A * E;
  // Cada alerta pide tipos distintos: un solo tipo de control por alerta (una sola compuerta, una sola válvula...)
  const tiposPorAlerta = alertas.map(() => barajar(TIPOS_CONTROL_REACTOR).slice(0, E));
  for (let i = 0; i < reales; i++) {
    const alerta = alertas[Math.floor(i / E)];
    const tipo = tiposPorAlerta[Math.floor(i / E)][i % E];
    const id = `C${i + 1}`;
    const objetivo = rnd(POSICIONES_REACTOR);
    const pos = (objetivo + 1 + rnd(POSICIONES_REACTOR - 1)) % POSICIONES_REACTOR;
    controles.push({ id, nombre: `${tipo} ${i + 1}`, icono: ICONO_CONTROL_REACTOR[tipo], owner: i % n, pos, real: true, tipo, alerta: alerta.texto });
    alerta.reqs.push({ control: id, pos: objetivo });
  }

  // Controles extra (uno por persona): su alerta no aparece en la pantalla del capitán
  const todosTextos = PROBLEMAS_REACTOR.flatMap(p => MODULOS_REACTOR.map(m => `${p} ${m}`));
  const fuera = barajar(todosTextos).filter(t => !alertas.some(a => a.texto === t));
  for (let o = 0; o < n; o++) {
    const k = reales + o;
    const tipo = pick(TIPOS_CONTROL_REACTOR);
    controles.push({ id: `F${o + 1}`, nombre: `${tipo} ${k + 1}`, icono: ICONO_CONTROL_REACTOR[tipo], owner: o, pos: rnd(POSICIONES_REACTOR), real: false, tipo, alerta: fuera[o % fuera.length] });
  }

  return {
    panel: { alertas: alertas.map(a => ({ id: a.id, texto: a.texto, aparecerEn: a.aparecerEn })) },
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { t0: null, controles, alertas }
  };
}

function generarReactorProtocolo(L: number, n: number): Puzle {
  const porNivel = Math.min(2 + Math.floor((L - 1) / 2), 4);
  const A = Math.min(4, Math.max(n === 1 ? 1 : Math.ceil(n / 2), porNivel));
  const req = n === 1 ? 1 : 2;
  const reales = A * req;
  const modulos = barajar(MODULOS_REACTOR);

  // Alertas: cada una pide 'req' controles del tipo que marca el protocolo, en su posición
  const alertas: AlertaReactor[] = Array.from({ length: A }, (_, j) => {
    const p = PROTOCOLO_REACTOR[j % PROTOCOLO_REACTOR.length];
    return { id: `A${j + 1}`, texto: `${p.problema} ${modulos[j % modulos.length]}`, tipo: p.tipo, aparecerEn: j * 12, resuelta: false, reqs: [] };
  });

  const controles: ControlReactor[] = [];
  const pistas: object[][] = Array.from({ length: n }, () => []);

  // Controles reales: repartidos en círculo, así todas las personas tienen alguno
  for (let i = 0; i < reales; i++) {
    const id = `C${i + 1}`;
    const owner = i % n;
    const alerta = alertas[Math.floor(i / req)];
    const p = PROTOCOLO_REACTOR.find(x => x.tipo === alerta.tipo)!;
    const etiqueta = `${p.control} ${i + 1}`;
    const objetivo = p.pos - 1;
    const pos = (objetivo + 1 + rnd(2)) % POSICIONES_REACTOR;
    controles.push({ id, nombre: etiqueta, icono: ICONO_CONTROL_REACTOR[p.control], owner, pos, real: true, tipo: p.control });
    alerta.reqs.push({ control: id, pos: objetivo });
    pistas[owner].push({ control: id, nombre: etiqueta, alerta: alerta.texto });
  }

  // Controles falsos: uno por persona, con una pista sobre una alerta que no está en la sala
  const todos = PROTOCOLO_REACTOR.flatMap(p => MODULOS_REACTOR.map(m => `${p.problema} ${m}`));
  const fuera = barajar(todos).filter(t => !alertas.some(a => a.texto === t));
  for (let o = 0; o < n; o++) {
    const id = `F${o + 1}`;
    const k = reales + o;
    const tipo = TIPOS_CONTROL_REACTOR[k % TIPOS_CONTROL_REACTOR.length];
    const etiqueta = `${tipo} ${k + 1}`;
    controles.push({ id, nombre: etiqueta, icono: ICONO_CONTROL_REACTOR[tipo], owner: o, pos: rnd(POSICIONES_REACTOR), real: false, tipo });
    pistas[o].push({ control: id, nombre: etiqueta, alerta: fuera[o % fuera.length] });
  }

  return {
    panel: { alertas: alertas.map(a => ({ id: a.id, texto: a.texto, tipo: a.tipo, aparecerEn: a.aparecerEn })) },
    pistas: pistas.map(l => barajar(l).map(x => JSON.stringify(x)).join('\n')),
    solucion: null,
    estadoInicial: { t0: null, controles, alertas }
  };
}

function generarReactorAntiguo(L: number, n: number): Puzle {
  const porNivel = Math.min(2 + Math.floor((L - 1) / 2), 4);
  const A = Math.min(6, Math.max(n === 1 ? 1 : Math.ceil(n / 2), porNivel));
  const req = n === 1 ? 1 : 2;
  const reales = A * req;
  const textos = barajar(PROBLEMAS_REACTOR.flatMap(p => MODULOS_REACTOR.map(m => `${p} ${m}`)));
  const alertas: AlertaReactor[] = Array.from({ length: A }, (_, j) => ({
    id: `A${j + 1}`, texto: textos[j], aparecerEn: j * 12, resuelta: false, reqs: []
  }));
  const controles: ControlReactor[] = [];
  const pistas: object[][] = Array.from({ length: n }, () => []);

  // Controles reales: el reparto en círculo garantiza que todas las personas tengan alguno
  for (let i = 0; i < reales; i++) {
    const id = `C${i + 1}`;
    const owner = i % n;
    const { nombre, icono } = CONTROLES_REACTOR[i % CONTROLES_REACTOR.length];
    const etiqueta = `${nombre} ${i + 1}`;
    const objetivo = rnd(POSICIONES_REACTOR);
    const pos = (objetivo + 1 + rnd(POSICIONES_REACTOR - 1)) % POSICIONES_REACTOR;
    controles.push({ id, nombre: etiqueta, icono, owner, pos, real: true });
    const alerta = alertas[Math.floor(i / req)];
    alerta.reqs.push({ control: id, pos: objetivo });
    pistas[owner].push({ control: id, nombre: etiqueta, alerta: alerta.texto, excluye: (objetivo + 1) % POSICIONES_REACTOR + 1 });
    pistas[owner].push({ control: id, nombre: etiqueta, alerta: alerta.texto, excluye: (objetivo + 2) % POSICIONES_REACTOR + 1 });
  }

  // Controles falsos: uno por persona, con una pista sobre una alerta que no existe en la sala
  const falsas = textos.slice(A);
  for (let o = 0; o < n; o++) {
    const id = `F${o + 1}`;
    const k = reales + o;
    const { nombre, icono } = CONTROLES_REACTOR[k % CONTROLES_REACTOR.length];
    const etiqueta = `${nombre} ${k + 1}`;
    controles.push({ id, nombre: etiqueta, icono, owner: o, pos: rnd(POSICIONES_REACTOR), real: false });
    pistas[o].push({ control: id, nombre: etiqueta, alerta: falsas[o % falsas.length], excluye: rnd(POSICIONES_REACTOR) + 1 });
    pistas[o].push({ control: id, nombre: etiqueta, alerta: falsas[(o + 1) % falsas.length], excluye: rnd(POSICIONES_REACTOR) + 1 });
  }

  return {
    panel: { alertas: alertas.map(a => ({ id: a.id, texto: a.texto, aparecerEn: a.aparecerEn })) },
    pistas: pistas.map(l => barajar(l).map(x => JSON.stringify(x)).join('\n')),
    solucion: null,
    estadoInicial: { t0: null, controles, alertas }
  };
}

/** Gira un control del reactor. Solo puede girarlo su dueño. Indica si todas las alertas quedan resueltas. */
export function aplicarControlReactor(estado: any, controlId: string, owner: number, ahora: number): { estado: any; ok: boolean; completado?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  const control = (e.controles || []).find((c: ControlReactor) => c.id === controlId);
  if (!control || control.owner !== owner) return { estado: e, ok: false };
  control.pos = (control.pos + 1) % POSICIONES_REACTOR;
  const controles: ControlReactor[] = e.controles;
  const alertas: AlertaReactor[] = e.alertas;
  for (const a of alertas) {
    // Una alerta solo se resuelve cuando ya ha aparecido, y se queda resuelta
    if (a.resuelta || typeof e.t0 !== 'number' || ahora - e.t0 < a.aparecerEn * 1000) continue;
    a.resuelta = a.reqs.every(r => controles.find(c => c.id === r.control)?.pos === r.pos);
  }
  return { estado: e, ok: true, completado: alertas.every(a => a.resuelta) };
}

/** Puntero láser: el cursor debe llegar a la diana. Cada control (eje X, eje Y, potencia) lo tiene una persona distinta, y rotan tras cada acierto. */
/** Puntero láser con laberinto y minas (desde el nivel 2). Siempre hay un camino sin minas hasta la diana. */
function generarPuntero(L: number, n: number): Puzle {
  const N = Math.min(5 + L, 9);
  const laberinto = L >= 2;
  const densidad = laberinto ? Math.min(0.1 + 0.04 * L, 0.3) : 0;
  const numMinas = laberinto ? Math.min(1 + L, 6) : 0;
  for (let intento = 0; intento < 400; intento++) {
    const muros: boolean[][] = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.random() < densidad));
    const libres: { x: number; y: number }[] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!muros[y][x]) libres.push({ x, y });
    if (libres.length < 4) continue;
    const inicio = pick(libres);
    const lejanos = libres.filter(c => Math.abs(c.x - inicio.x) + Math.abs(c.y - inicio.y) >= Math.floor(N / 2) + 1);
    if (!lejanos.length) continue;
    const target = pick(lejanos);
    const candidatas = libres.filter(c => !(c.x === inicio.x && c.y === inicio.y) && !(c.x === target.x && c.y === target.y));
    const minas = barajar(candidatas).slice(0, numMinas);
    if (!caminoPuntero(N, muros, inicio, target, minas)) continue;
    return {
      panel: { n: N },
      pistas: Array.from({ length: n }, () => ''),
      solucion: null,
      estadoInicial: { n: N, target, inicio, cursor: { ...inicio }, rot: 0, muros, minas, aviso: null }
    };
  }
  // Si no sale una combinación válida, tablero abierto y sin minas
  const inicio = { x: 0, y: 0 };
  const target = { x: N - 1, y: N - 1 };
  return {
    panel: { n: N },
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { n: N, target, inicio, cursor: { ...inicio }, rot: 0, muros: Array.from({ length: N }, () => Array(N).fill(false)), minas: [], aviso: null }
  };
}

/** ¿Se puede llegar a la diana sin pisar muros ni minas? */
function caminoPuntero(N: number, muros: boolean[][], ini: { x: number; y: number }, fin: { x: number; y: number }, minas: { x: number; y: number }[]): boolean {
  const bloqueada = (x: number, y: number) => muros[y][x] || minas.some(m => m.x === x && m.y === y);
  const visto = new Set<string>([`${ini.x},${ini.y}`]);
  const cola: { x: number; y: number }[] = [ini];
  while (cola.length) {
    const c = cola.shift()!;
    if (c.x === fin.x && c.y === fin.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || bloqueada(nx, ny)) continue;
      const k = `${nx},${ny}`;
      if (visto.has(k)) continue;
      visto.add(k);
      cola.push({ x: nx, y: ny });
    }
  }
  return false;
}

function generarPunteroAntiguo(L: number, n: number): Puzle {
  const N = Math.min(5 + L, 9);
  const target = { x: rnd(N), y: rnd(N) };
  let cursor = { x: rnd(N), y: rnd(N) };
  while (cursor.x === target.x && cursor.y === target.y) cursor = { x: rnd(N), y: rnd(N) };
  return {
    panel: { n: N },
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { n: N, target, cursor, potencia: 1, rot: 0 }
  };
}

/** Mueve el cursor del puntero. Solo puede moverlo la persona que tiene ese control en este momento. */
/** Mueve el cursor del puntero casilla a casilla. Los muros lo paran y las minas lo devuelven a la salida. */
export function aplicarAccionPuntero(estado: any, mov: string, owner: number, nDuenos: number): { estado: any; ok: boolean; completado?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  const boton = mov === 'izq' ? 0 : mov === 'der' ? 1 : mov === 'arriba' ? 2 : mov === 'abajo' ? 3 : -1;
  if (boton < 0 || ((e.rot || 0) + boton) % nDuenos !== owner) return { estado: e, ok: false };
  e.aviso = null;
  const dx = mov === 'izq' ? -1 : mov === 'der' ? 1 : 0;
  const dy = mov === 'arriba' ? -1 : mov === 'abajo' ? 1 : 0;
  const N = e.n;
  const nx = e.cursor.x + dx, ny = e.cursor.y + dy;
  if (nx < 0 || ny < 0 || nx >= N || ny >= N) return { estado: e, ok: true, completado: false };
  if (e.muros?.[ny]?.[nx]) {
    e.aviso = 'muro';
    return { estado: e, ok: true, completado: false };
  }
  e.cursor = { x: nx, y: ny };
  if ((e.minas || []).some((m: any) => m.x === nx && m.y === ny)) {
    e.cursor = { ...(e.inicio || e.cursor) };
    e.aviso = 'mina';
  }
  return { estado: e, ok: true, completado: e.cursor.x === e.target.x && e.cursor.y === e.target.y };
}

export function aplicarAccionPunteroAntigua(estado: any, mov: string, owner: number, nDuenos: number): { estado: any; ok: boolean; completado?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  const rol = mov === 'izq' || mov === 'der' ? 0 : (mov === 'arriba' || mov === 'abajo') ? 1 : mov === 'potencia' ? 2 : -1;
  if (rol < 0 || ((e.rot || 0) + rol) % nDuenos !== owner) return { estado: e, ok: false };
  const N = e.n;
  if (mov === 'izq') e.cursor.x = Math.max(0, e.cursor.x - e.potencia);
  else if (mov === 'der') e.cursor.x = Math.min(N - 1, e.cursor.x + e.potencia);
  else if (mov === 'arriba') e.cursor.y = Math.max(0, e.cursor.y - e.potencia);
  else if (mov === 'abajo') e.cursor.y = Math.min(N - 1, e.cursor.y + e.potencia);
  else e.potencia = (e.potencia % 3) + 1;
  return { estado: e, ok: true, completado: e.cursor.x === e.target.x && e.cursor.y === e.target.y };
}

// ------------------------------------------------------------------
// Semáforo de cruce: 4 aproximaciones (0 Norte, 1 Sur, 2 Este, 3 Oeste).
// Cada cambio de luz hace avanzar el tráfico un paso. Un coche en verde cruza.
// Si un coche sin verde coincide con uno que cruza del eje contrario, choca (-5 s y desaparece).
// Si los dos ejes cruzan a la vez, choca el horizontal.
// ------------------------------------------------------------------
const ORDEN_LUZ = ['rojo', 'verde', 'ambar'];

function generarSemaforo(L: number, n: number): Puzle {
  const K = Math.min(6 + 2 * (L - 1), 14);
  const llegadas = Array.from({ length: K }, () => rnd(4));
  return {
    panel: { total: K },
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { luces: ['rojo', 'rojo', 'rojo', 'rojo'], colas: [0, 0, 0, 0], pendientes: llegadas, porPaso: L >= 3 ? 2 : 1, pasados: 0, choques: 0, rot: 0 }
  };
}

/** Cambia una luz y avanza el tráfico un paso. Solo puede cambiarla la persona que tiene ese semáforo. */
export function aplicarSemaforo(estado: any, a: number, owner: number, nDuenos: number): { estado: any; ok: boolean; completado?: boolean; choque?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  if (a < 0 || a > 3 || ((e.rot || 0) + a) % nDuenos !== owner) return { estado: e, ok: false };
  e.luces[a] = ORDEN_LUZ[(ORDEN_LUZ.indexOf(e.luces[a]) + 1) % ORDEN_LUZ.length];
  for (let i = 0; i < e.porPaso && e.pendientes.length; i++) e.colas[e.pendientes.shift()]++;
  const eje = (x: number) => (x < 2 ? 0 : 1);
  let choque = false;
  const cruza = [0, 1, 2, 3].map(x => e.colas[x] > 0 && e.luces[x] === 'verde');
  // 1) Coches sin verde que coinciden con uno que cruza del eje contrario: chocan y desaparecen
  for (let x = 0; x < 4; x++) {
    if (e.colas[x] > 0 && !cruza[x] && [0, 1, 2, 3].some(y => cruza[y] && eje(y) !== eje(x))) {
      e.colas[x]--;
      e.choques++;
      choque = true;
    }
  }
  // 2) Los dos ejes cruzando a la vez: choca el horizontal
  if ((cruza[0] || cruza[1]) && (cruza[2] || cruza[3])) {
    const h = cruza[2] ? 2 : 3;
    e.colas[h]--;
    e.choques++;
    choque = true;
    cruza[h] = false;
  }
  // 3) Los que cruzan, pasan
  for (let x = 0; x < 4; x++) {
    if (cruza[x]) {
      e.colas[x]--;
      e.pasados++;
    }
  }
  const completado = e.pendientes.length === 0 && e.colas.every((c: number) => c === 0);
  return { estado: e, ok: true, completado, choque };
}

// ------------------------------------------------------------------
// Barco por el canal: cada remada avanza una fila. Babor empuja el barco a la derecha y
// estribor, a la izquierda. Una roca o una orilla bloquea la remada (-5 s). Llegar al puerto es el acierto.
// ------------------------------------------------------------------
/** Remos del barco: los de avance bajan una fila; los de atrás, una fila hacia arriba. dx = columna que se mueve. */
const BARCO_REMOS = [
  { lado: 'derecha', dx: 1, dy: 1 },
  { lado: 'izquierda', dx: -1, dy: 1 },
  { lado: 'izquierda_atras', dx: -1, dy: -1 },
  { lado: 'derecha_atras', dx: 1, dy: -1 }
];

function generarBarco(L: number, n: number): Puzle {
  const W = 5;
  const H = Math.min(5 + L, 9);
  const densidad = Math.min(0.08 + 0.04 * L, 0.3);
  const ini = { x: 2, y: 0 };
  for (let intento = 0; intento < 400; intento++) {
    const rocas: { x: number; y: number }[] = [];
    for (let y = 1; y <= H - 2; y++) for (let x = 0; x < W; x++) if (Math.random() < densidad) rocas.push({ x, y });
    if (!caminoBarco(W, H, ini.x, rocas)) continue;
    return {
      panel: { W, H },
      pistas: Array.from({ length: n }, () => ''),
      solucion: null,
      estadoInicial: { W, H, barco: ini, rocas, rot: 0, bloqueos: 0 }
    };
  }
  return {
    panel: { W, H },
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { W, H, barco: ini, rocas: [], rot: 0, bloqueos: 0 }
  };
}

/** ¿Existe una ruta del barco hasta el puerto sin pisar rocas ni salir del canal? */
function caminoBarco(W: number, H: number, x0: number, rocas: { x: number; y: number }[]): boolean {
  let alcanzables: number[] = [x0];
  for (let y = 1; y < H; y++) {
    const siguientes = new Set<number>();
    for (const x of alcanzables) {
      for (const nx of [x - 1, x + 1]) {
        if (nx < 0 || nx >= W || rocas.some(r => r.x === nx && r.y === y)) continue;
        siguientes.add(nx);
      }
    }
    if (siguientes.size === 0) return false;
    alcanzables = [...siguientes];
  }
  return true;
}

/** Una remada de babor (derecha) o estribor (izquierda). Solo puede remar la persona que tiene ese remo. */
export function aplicarBarco(estado: any, lado: string, owner: number, nDuenos: number): { estado: any; ok: boolean; bloqueo?: boolean; completado?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  const rol = BARCO_REMOS.findIndex(r => r.lado === lado);
  if (rol < 0 || ((e.rot || 0) + rol) % nDuenos !== owner) return { estado: e, ok: false };
  const remo = BARCO_REMOS[rol];
  const nx = e.barco.x + remo.dx;
  const ny = e.barco.y + remo.dy;
  const orilla = nx < 0 || nx >= e.W || ny < 0 || ny >= e.H;
  const roca = (e.rocas || []).some((r: any) => r.x === nx && r.y === ny);
  e.golpe = null;
  if (orilla) {
    const lado = nx < 0 ? 'izquierda' : nx >= e.W ? 'derecha' : ny < 0 ? 'arriba' : 'abajo';
    e.golpe = { tipo: 'orilla', lado };
    return { estado: e, ok: true, bloqueo: false, completado: false };
  }
  if (roca) {
    e.bloqueos += 1;
    e.golpe = { tipo: 'roca', x: nx, y: ny };
    return { estado: e, ok: true, bloqueo: true, completado: false };
  }
  e.barco = { x: nx, y: ny };
  return { estado: e, ok: true, bloqueo: false, completado: ny === e.H - 1 };
}

// ------------------------------------------------------------------
// Cocina a cuatro manos: los ingredientes se añaden en el orden de la receta y cada fuego
// debe quedar en su punto. Cada ingrediente y cada fuego lo controla una persona. Solo el capitán sirve.
// ------------------------------------------------------------------
const INGREDIENTES_COCINA = ['Tomate', 'Cebolla', 'Zanahoria', 'Huevo', 'Arroz', 'Queso'];

function generarCocina(L: number, n: number): Puzle {
  const K = Math.min(2 + Math.floor((L - 1) / 2), 4);
  const ingredientes = barajar(INGREDIENTES_COCINA).slice(0, K);
  const objetivos = [1 + rnd(9), 1 + rnd(9)];
  const sartenes = ingredientes.map(() => rnd(2));
  // Fuegos: arrancan en un nivel distinto del objetivo, así siempre hay que ajustarlos
  const fuegosIniciales = objetivos.map(o => {
    let v = rnd(10);
    while (v === o) v = rnd(10);
    return v;
  });
  return {
    panel: { ingredientes, objetivos },
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { ingredientes, objetivos, sartenes, anadidos: 0, fuegos: fuegosIniciales, rot: 0 }
  };
}

/** Acciones: añadir un ingrediente, subir/bajar un fuego o servir. Cada control solo lo mueve su dueño. */
export function aplicarCocina(estado: any, accion: any, owner: number, nDuenos: number): { estado: any; ok: boolean; error?: boolean; completado?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  const K = e.ingredientes.length;
  const duenoDe = (c: number) => ((e.rot || 0) + c) % nDuenos;
  // El plato sale solo cuando todos los ingredientes están echados y cada fuego está en su punto
  const listo = () => e.anadidos === K && e.fuegos[0] === e.objetivos[0] && e.fuegos[1] === e.objetivos[1];
  if (accion.tipo === 'ingrediente') {
    const i = accion.i;
    if (i < 0 || i >= K || duenoDe(i) !== owner) return { estado: e, ok: false };
    if (i !== e.anadidos || accion.sarten !== e.sartenes[i]) return { estado: e, ok: true, error: true, completado: false };
    e.anadidos += 1;
    return { estado: e, ok: true, error: false, completado: listo() };
  }
  if (accion.tipo === 'fuego') {
    const f = accion.f;
    if (f < 0 || f > 1 || duenoDe(K + f) !== owner) return { estado: e, ok: false };
    e.fuegos[f] = Math.max(0, Math.min(9, e.fuegos[f] + accion.delta));
    return { estado: e, ok: true, error: false, completado: listo() };
  }
  return { estado: e, ok: false };
}

// ------------------------------------------------------------------
// Grúa de carga: llevar la caja del suelo a la zona de destino. Cada control (mover, cable, pinza) lo tiene
// una persona. Los edificios (altura 2) solo se cruzan con el cable arriba. Soltar fuera del destino es un error.
// ------------------------------------------------------------------
const GRUA_ACCIONES = ['izq', 'der', 'adel', 'atras', 'subir', 'bajar', 'pinza'];
const GRUA_W = 5;
const GRUA_H = 5;
const GRUA_ALTURA_EDIFICIO = 2;

function esEdificio(e: any, x: number, y: number): boolean {
  return (e.edificios || []).some((b: any) => b.x === x && b.y === y);
}

/** Un paso de la grúa. Devuelve el nuevo estado, si hubo error (penalización) y si la caja está entregada. */
function pasoGrua(estado: any, accion: string): { estado: any; error: boolean; completado: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  const dir: Record<string, [number, number]> = { izq: [-1, 0], der: [1, 0], adel: [0, -1], atras: [0, 1] };
  const sinCambio = { estado: e, error: false, completado: false };
  const error = { estado: e, error: true, completado: false };
  if (dir[accion]) {
    const [dx, dy] = dir[accion];
    const nx = e.x + dx;
    const ny = e.y + dy;
    if (nx < 0 || ny < 0 || nx >= GRUA_W || ny >= GRUA_H) return sinCambio;
    if (esEdificio(e, nx, ny) && e.z < GRUA_ALTURA_EDIFICIO) return error;
    e.x = nx;
    e.y = ny;
    if (e.pinza) {
      e.bx = nx;
      e.by = ny;
    }
    return sinCambio;
  }
  if (accion === 'subir') {
    if (e.z < GRUA_ALTURA_EDIFICIO) e.z += 1;
    return sinCambio;
  }
  if (accion === 'bajar') {
    if (e.z <= 0) return sinCambio;
    if (esEdificio(e, e.x, e.y) && e.z - 1 < GRUA_ALTURA_EDIFICIO) return error;
    e.z -= 1;
    return sinCambio;
  }
  if (accion === 'pinza') {
    if (!e.pinza) {
      // Agarrar: solo a nivel del suelo y encima de la caja
      if (e.z !== 0 || e.x !== e.bx || e.y !== e.by) return error;
      e.pinza = true;
      return sinCambio;
    }
    // Soltar: solo a nivel del suelo y fuera de un edificio
    if (e.z !== 0 || esEdificio(e, e.x, e.y)) return error;
    e.pinza = false;
    e.bx = e.x;
    e.by = e.y;
    const entregada = e.x === e.tx && e.y === e.ty;
    return { estado: e, error: !entregada, completado: entregada };
  }
  return sinCambio;
}

/** ¿Se puede entregar la caja siguiendo las reglas? Se comprueba antes de crear el tablero. */
function resolubleGrua(estado: any): boolean {
  const clave = (e: any) => `${e.x},${e.y},${e.z},${e.pinza},${e.bx},${e.by}`;
  const visto = new Set<string>([clave(estado)]);
  const cola: any[] = [estado];
  while (cola.length) {
    const e = cola.shift()!;
    for (const accion of GRUA_ACCIONES) {
      const r = pasoGrua(e, accion);
      if (r.completado) return true;
      if (r.error) continue;
      const k = clave(r.estado);
      if (visto.has(k)) continue;
      visto.add(k);
      cola.push(r.estado);
    }
  }
  return false;
}

function generarGrua(L: number, n: number): Puzle {
  const numEdificios = L >= 2 ? Math.min(1 + L, 5) : 0;
  for (let intento = 0; intento < 300; intento++) {
    const libres: { x: number; y: number }[] = [];
    for (let y = 0; y < GRUA_H; y++) for (let x = 0; x < GRUA_W; x++) if (!(x === 0 && y === 0)) libres.push({ x, y });
    const mezcla = barajar(libres);
    const edificios = mezcla.slice(0, numEdificios);
    const resto = mezcla.slice(numEdificios);
    if (resto.length < 2) continue;
    const caja = resto[0];
    const destino = resto[1];
    const estado = {
      W: GRUA_W, H: GRUA_H, x: 0, y: 0, z: GRUA_ALTURA_EDIFICIO, pinza: false,
      bx: caja.x, by: caja.y, tx: destino.x, ty: destino.y, edificios, rot: 0, panel: null
    };
    if (!resolubleGrua(estado)) continue;
    return {
      panel: { W: GRUA_W, H: GRUA_H },
      pistas: Array.from({ length: n }, () => ''),
      solucion: null,
      estadoInicial: estado
    };
  }
  // Sin edificios, siempre se puede entregar la caja
  return {
    panel: { W: GRUA_W, H: GRUA_H },
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { W: GRUA_W, H: GRUA_H, x: 0, y: 0, z: GRUA_ALTURA_EDIFICIO, pinza: false, bx: 0, by: 4, tx: 4, ty: 4, edificios: [], rot: 0, panel: null }
  };
}

/** Un control de la grúa. Solo puede moverlo la persona que lo tiene en este momento. */
export function aplicarGrua(estado: any, accion: string, owner: number, nDuenos: number): { estado: any; ok: boolean; error?: boolean; completado?: boolean } {
  const c = GRUA_ACCIONES.indexOf(accion);
  if (c < 0 || ((estado.rot || 0) + c) % nDuenos !== owner) return { estado: JSON.parse(JSON.stringify(estado)), ok: false };
  const r = pasoGrua(estado, accion);
  return { estado: r.estado, ok: true, error: r.error, completado: r.completado };
}

// ------------------------------------------------------------------
// Quién va primero: la pantalla muestra una palabra. El manual (repartido entre los ayudantes, sin repetir)
// dice qué botón leer y en qué orden pulsar. Solo el capitán pulsa.
// ------------------------------------------------------------------
/** Tabla 1: palabra de pantalla -> posición del botón a leer (1-6, por filas). */
const QVP_PANTALLA: { palabra: string; pos: number }[] = [
  { palabra: 'PRÓXIMA', pos: 3 }, { palabra: 'VOY', pos: 2 }, { palabra: 'PRIMERO', pos: 6 },
  { palabra: 'HAYA', pos: 2 }, { palabra: 'VAYA', pos: 6 }, { palabra: 'VA', pos: 3 },
  { palabra: 'ESPERA', pos: 5 }, { palabra: 'RÁPIDO', pos: 4 }, { palabra: 'MONITOR', pos: 6 },
  { palabra: 'ÚLTIMA', pos: 3 }, { palabra: 'SÍ', pos: 6 }, { palabra: 'DALE', pos: 4 },
  { palabra: 'HAY', pos: 4 }, { palabra: 'OTRA', pos: 5 }, { palabra: 'BIEN', pos: 5 },
  { palabra: 'PALABRA', pos: 6 }, { palabra: 'NADA', pos: 4 }, { palabra: 'BAYA', pos: 6 },
  { palabra: 'LISTO', pos: 4 }, { palabra: 'OKAY', pos: 4 }, { palabra: 'BUENO', pos: 1 },
  { palabra: 'NO', pos: 6 }, { palabra: 'ALLÁ', pos: 5 }, { palabra: 'EXPLOTÓ', pos: 4 },
  { palabra: 'AHÍ', pos: 3 }, { palabra: 'HALLA', pos: 6 }, { palabra: 'VALLA', pos: 4 },
  { palabra: 'OTRO', pos: 6 }
];

/** Tabla 2: etiqueta del botón -> orden de pulsado (se pulsa la primera palabra de la lista que esté en el módulo). */
const QVP_BOTONES: { etiqueta: string; lista: string[] }[] = [
  { etiqueta: 'ESPERA', lista: ['LISTO', 'VA', '¿ÉSTA?', 'VALE', 'NO ESTÁ', '¿ESA?', 'OKAY', 'OTRO', 'ESPERA', 'NO', '¿QUÉ?', 'ESTA', '¿CÓMO?', 'NO ES'] },
  { etiqueta: '¿QUÉ?', lista: ['NO ESTÁ', 'VA', 'LISTO', 'VALE', 'NO', 'OKAY', '¿CÓMO?', 'ESTA', 'NO ES', 'ESPERA', 'OTRO', '¿ÉSTA?', '¿ESA?', '¿QUÉ?'] },
  { etiqueta: 'NO', lista: ['OTRO', 'ESTA', 'NO ES', '¿QUÉ?', '¿ÉSTA?', 'ESPERA', 'OKAY', 'LISTO', '¿CÓMO?', 'NO ESTÁ', '¿ESA?', 'VA', 'NO', 'VALE'] },
  { etiqueta: 'OTRO', lista: ['NO ES', 'OKAY', 'VA', 'VALE', 'OTRO', '¿ESA?', 'ESPERA', '¿CÓMO?', 'NO', '¿ÉSTA?', 'NO ESTÁ', 'ESTA', 'LISTO', '¿QUÉ?'] },
  { etiqueta: '¿CÓMO?', lista: ['ESTA', 'OKAY', 'VA', 'VALE', 'LISTO', 'OTRO', 'NO', '¿ESA?', 'NO ESTÁ', '¿ÉSTA?', 'NO ES', '¿QUÉ?', '¿CÓMO?', 'ESPERA'] },
  { etiqueta: 'LISTO', lista: ['VA', 'OKAY', 'ESTA', 'VALE', '¿QUÉ?', '¿ÉSTA?', '¿ESA?', 'ESPERA', '¿CÓMO?', 'LISTO', 'NO ESTÁ', 'OTRO', 'NO', 'NO ES'] },
  { etiqueta: '¿ÉSTA?', lista: ['ESTA', '¿ÉSTA?', 'NO ESTÁ', '¿CÓMO?', 'ESPERA', 'OTRO', 'VALE', 'NO', 'VA', '¿QUÉ?', 'NO ES', 'LISTO', '¿ESA?', 'OKAY'] },
  { etiqueta: 'ESTA', lista: ['ESPERA', '¿CÓMO?', 'NO ESTÁ', '¿ÉSTA?', 'VA', 'LISTO', 'OKAY', 'NO', '¿ESA?', 'OTRO', 'ESTA', 'VALE', 'NO ES', '¿QUÉ?'] },
  { etiqueta: 'NO ESTÁ', lista: ['OKAY', 'NO ESTÁ', '¿QUÉ?', 'NO', 'VALE', 'LISTO', 'OTRO', '¿ÉSTA?', 'ESTA', 'NO ES', '¿ESA?', 'ESPERA', 'VA', '¿CÓMO?'] },
  { etiqueta: 'OKAY', lista: ['LISTO', '¿CÓMO?', 'ESPERA', '¿ESA?', 'NO', '¿ÉSTA?', 'OKAY', 'VALE', 'NO ESTÁ', 'ESTA', 'OTRO', 'VA', '¿QUÉ?'] },
  { etiqueta: 'VALE', lista: ['OTRO', 'ESPERA', 'VA', '¿ÉSTA?', '¿CÓMO?', '¿ESA?', 'NO', 'NO ES', 'NO ESTÁ', 'VALE', 'OKAY', '¿QUÉ?', 'LISTO'] },
  { etiqueta: 'VA', lista: ['VALE', 'NO', '¿QUÉ?', 'LISTO', 'ESTA', '¿CÓMO?', 'NO ES', 'VA', 'NO ESTÁ', 'ESPERA', 'OTRO', '¿ESA?', '¿ÉSTA?', 'OKAY'] },
  { etiqueta: 'NO ES', lista: ['ESTA', 'NO', 'OTRO', 'VA', 'LISTO', 'NO ESTÁ', '¿QUÉ?', '¿ESA?', '¿ÉSTA?', 'NO ES', '¿CÓMO?', 'ESPERA', 'OKAY', 'VALE'] },
  { etiqueta: '¿ESA?', lista: ['OKAY', 'VALE', 'LISTO', 'ESPERA', '¿ESA?', 'VA', '¿CÓMO?', 'ESTA', 'OTRO', 'NO ESTÁ', '¿QUÉ?', '¿ÉSTA?', 'NO', 'NO ES'] },
  { etiqueta: 'OK', lista: ['DALE', '¿DÓNDE?', 'BUENO', 'ÉSTA', 'BIEN', 'RÁPIDO', 'ESTÁ', 'YA ESTÁ', 'SÍ', 'OK', '¿CUÁL?', '¿SEGURO?', 'OTRA', 'NO SÉ'] },
  { etiqueta: '¿DÓNDE?', lista: ['BUENO', 'BIEN', '¿SEGURO?', 'RÁPIDO', 'SÍ', 'OTRA', '¿CUÁL?', 'YA ESTÁ', 'OK', 'NO SÉ', 'ÉSTA', 'DALE', 'ESTÁ', '¿DÓNDE?'] },
  { etiqueta: 'BUENO', lista: ['¿CUÁL?', '¿DÓNDE?', 'RÁPIDO', 'BUENO', 'BIEN', 'ESTÁ', 'DALE', 'NO SÉ', 'ÉSTA', 'OK', 'SÍ', 'YA ESTÁ', '¿SEGURO?', 'OTRA'] },
  { etiqueta: 'ÉSTA', lista: ['OK', 'ÉSTA', 'ESTÁ', 'BIEN', '¿CUÁL?', '¿DÓNDE?', 'NO SÉ', 'BUENO', 'SÍ', 'RÁPIDO', 'DALE', 'OTRA', '¿SEGURO?', 'YA ESTÁ'] },
  { etiqueta: 'ESTÁ', lista: ['OTRA', 'NO SÉ', 'ESTÁ', 'RÁPIDO', 'SÍ', 'DALE', 'BUENO', 'YA ESTÁ', 'ÉSTA', '¿SEGURO?', 'BIEN', '¿CUÁL?', '¿DÓNDE?', 'OK'] },
  { etiqueta: 'NO SÉ', lista: ['RÁPIDO', 'DALE', 'BIEN', 'SÍ', 'ÉSTA', 'ESTÁ', '¿CUÁL?', 'OTRA', 'NO SÉ', 'OK', '¿SEGURO?', 'YA ESTÁ', '¿DÓNDE?', 'BUENO'] },
  { etiqueta: 'RÁPIDO', lista: ['RÁPIDO', 'BUENO', '¿DÓNDE?', 'OK', 'OTRA', 'YA ESTÁ', '¿CUÁL?', 'BIEN', 'DALE', '¿SEGURO?', 'ÉSTA', 'NO SÉ', 'SÍ', 'ESTÁ'] },
  { etiqueta: '¿CUÁL?', lista: ['ESTÁ', 'NO SÉ', '¿DÓNDE?', 'ÉSTA', 'BIEN', '¿CUÁL?', 'OTRA', 'OK', 'RÁPIDO', 'DALE', '¿SEGURO?', 'BUENO', 'YA ESTÁ', 'SÍ'] },
  { etiqueta: 'SÍ', lista: ['OK', 'YA ESTÁ', 'ÉSTA', 'BUENO', 'NO SÉ', 'OTRA', '¿CUÁL?', '¿SEGURO?', '¿DÓNDE?', 'RÁPIDO', 'ESTÁ', 'BIEN', 'SÍ', 'DALE'] },
  { etiqueta: 'OTRA', lista: ['DALE', 'RÁPIDO', 'BIEN', 'SÍ', 'BUENO', 'ESTÁ', 'ÉSTA', 'YA ESTÁ', '¿SEGURO?', 'OK', 'NO SÉ', '¿DÓNDE?', '¿CUÁL?', 'OTRA'] },
  { etiqueta: 'BIEN', lista: ['SÍ', 'RÁPIDO', '¿CUÁL?', 'BUENO', 'YA ESTÁ', 'DALE', 'BIEN', '¿SEGURO?', 'OTRA', '¿DÓNDE?', 'ESTÁ', 'ÉSTA', 'NO SÉ', 'OK'] },
  { etiqueta: 'YA ESTÁ', lista: ['¿DÓNDE?', 'NO SÉ', 'OTRA', '¿CUÁL?', 'OK', 'ESTÁ', 'DALE', 'SÍ', 'ÉSTA', 'BIEN', 'YA ESTÁ', 'RÁPIDO', 'BUENO', '¿SEGURO?'] },
  { etiqueta: 'DALE', lista: ['¿DÓNDE?', 'OTRA', '¿SEGURO?', 'ÉSTA', 'OK', 'YA ESTÁ', 'RÁPIDO', 'ESTÁ', 'DALE', 'NO SÉ', 'SÍ', 'BIEN', 'BUENO', '¿CUÁL?'] },
  { etiqueta: '¿SEGURO?', lista: ['ÉSTA', 'BIEN', 'NO SÉ', 'ESTÁ', 'YA ESTÁ', 'OTRA', '¿CUÁL?', 'SÍ', 'RÁPIDO', 'OK', '¿SEGURO?', 'DALE', '¿DÓNDE?', 'BUENO'] }
];

/** Qué botón pulsar: la primera palabra de la lista que esté en el módulo. -1 si no hay ninguna. */
function objetivoQVP(pantalla: string, botones: string[]): number {
  const p1 = QVP_PANTALLA.find(e => e.palabra === pantalla);
  if (!p1) return -1;
  const etiqueta = botones[p1.pos - 1];
  const p2 = QVP_BOTONES.find(e => e.etiqueta === etiqueta);
  if (!p2) return -1;
  const destino = p2.lista.find(w => botones.includes(w));
  return destino === undefined ? -1 : botones.indexOf(destino);
}

/** Un módulo nuevo: pantalla y botones, con una pulsación correcta posible. */
export function nuevaEtapaQVP(): { pantalla: string; botones: string[]; objetivo: number } {
  for (;;) {
    const pantalla = pick(QVP_PANTALLA).palabra;
    const botones = barajar(QVP_BOTONES.map(b => b.etiqueta)).slice(0, 6);
    const objetivo = objetivoQVP(pantalla, botones);
    if (objetivo >= 0) return { pantalla, botones, objetivo };
  }
}

function generarQuienVaPrimero(L: number, n: number): Puzle {
  return {
    panel: {},
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { etapa: nuevaEtapaQVP(), rot: 0, manual1: QVP_PANTALLA, manual2: QVP_BOTONES }
  };
}

/** El capitán pulsa un botón. Si es el correcto es un acierto (el módulo cambia). Si no, es un error. */
export function aplicarQuienVaPrimero(estado: any, boton: number): { estado: any; ok: boolean; error?: boolean; acierto?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  if (!e.etapa) return { estado: e, ok: false };
  if (boton === e.etapa.objetivo) return { estado: e, ok: true, error: false, acierto: true };
  return { estado: e, ok: true, error: true, acierto: false };
}

// ------------------------------------------------------------------
// Simón dice: el módulo muestra un código y una secuencia de destellos. Cada destello se responde con el
// color que dice la tabla de ese código. La tabla se reparte entre el equipo: cada persona tiene un color.
// Solo el capitán pulsa.
// ------------------------------------------------------------------
const SIMON_COLORES = ['Rojo', 'Azul', 'Verde', 'Amarillo'];

/** Un código parecido al real (cambia un dígo) para que sirva de trampa. */
function codigoSenuelo(base: string, usados: string[]): string {
  for (;;) {
    const pos = rnd(3);
    const cand = base.slice(0, pos) + String(rnd(10)) + base.slice(pos + 1);
    if (cand !== base && !usados.includes(cand)) return cand;
  }
}

function nuevoModuloSimon(longitud: number, nDuenos: number): any {
  const codigo = String(100 + rnd(900));
  const senuelos = Math.min(longitud - 1, 2);
  const codigos = [codigo];
  const totalCodigos = Math.max(1 + senuelos, Math.ceil(nDuenos / 4));
  while (codigos.length < totalCodigos) codigos.push(codigoSenuelo(codigo, codigos));
  // Todas las filas de todos los códigos, mezcladas: cada persona tiene filas de varios códigos
  const filas: { codigo: string; entrada: string; salida: string }[] = [];
  for (const c of codigos) {
    const salidas = barajar(SIMON_COLORES);
    SIMON_COLORES.forEach((entrada, k) => filas.push({ codigo: c, entrada, salida: salidas[k] }));
  }
  // Cada destello tiene su color y su código (puede ser el real o un señuelo)
  const secuencia = Array.from({ length: longitud }, () => ({ color: pick(SIMON_COLORES), codigo: pick(codigos) }));
  return { filas: barajar(filas), secuencia, pulsadas: 0, resueltos: 0 };
}

function generarSimon(L: number, n: number): Puzle {
  return {
    panel: {},
    pistas: Array.from({ length: n }, () => ''),
    solucion: null,
    estadoInicial: { ...nuevoModuloSimon(2, n), rot: 0 }
  };
}

/** El capitán pulsa un color. Si es el correcto avanza; si no, reinicia la secuencia (error). */
export function aplicarSimon(estado: any, color: string, nDuenos: number): { estado: any; ok: boolean; error?: boolean; acierto?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  const bruto = e.secuencia[e.pulsadas];
  // Compatibilidad: módulos en curso creados antes, con destellos sin código
  const destello = typeof bruto === 'string' ? { color: bruto, codigo: e.codigo } : bruto;
  const esperado = e.filas.find((f: any) => f.codigo === destello.codigo && f.entrada === destello.color)?.salida;
  if (!esperado) return { estado: e, ok: false };
  if (color !== esperado) {
    e.pulsadas = 0;
    e.fallo = { t: Date.now(), color };
    return { estado: e, ok: true, error: true, acierto: false };
  }
  // Cadena: para cada destello nuevo hay que pulsar desde el principio las respuestas de todos los ya resueltos
  e.pulsadas += 1;
  if (e.pulsadas <= (e.resueltos ?? 0)) return { estado: e, ok: true, error: false, acierto: false };
  e.resueltos = (e.resueltos ?? 0) + 1;
  e.pulsadas = 0;
  if (e.resueltos < e.secuencia.length) return { estado: e, ok: true, error: false, acierto: false };
  // Todos los destellos resueltos: módulo nuevo con una secuencia más larga (hasta 5)
  const siguiente = nuevoModuloSimon(Math.min(e.secuencia.length + 1, 5), nDuenos);
  return { estado: siguiente, ok: true, error: false, acierto: true };
}

/** Aplica una acción del capitán sobre el estado del juego interactivo. */
export function aplicarAccionJuego(tipo: TipoMinijuego, estado: any, accion: any, solucion?: any): { estado: any; ok: boolean; fallo?: boolean; completado?: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
  if (tipo === 'fraude') {
    const i = e.idx;
    const decision = accion?.decision;
    if ((decision !== 'aceptar' && decision !== 'rechazar') || !Array.isArray(solucion) || i >= solucion.length) {
      return { estado: e, ok: false };
    }
    const acierto = (decision === 'rechazar') === (solucion[i] === true);
    if (!acierto) return { estado: e, ok: true, fallo: true };
    e.idx = i + 1;
    return { estado: e, ok: true, completado: e.idx >= solucion.length };
  }
  switch (tipo) {
    case 'torres': {
      const de = accion.de, a = accion.a;
      if (de === a || !e[de] || !e[de].length) return { estado: e, ok: false };
      const disco = e[de][e[de].length - 1];
      if (e[a].length && e[a][e[a].length - 1] < disco) return { estado: e, ok: false };
      e[de].pop();
      e[a].push(disco);
      return { estado: e, ok: true };
    }
    case 'pinta': {
      const orden = ['', ...COLORES_PINTA];
      const r = accion.r, c = accion.c;
      e[r][c] = orden[(orden.indexOf(e[r][c]) + 1) % orden.length];
      return { estado: e, ok: true };
    }
    case 'mezcla': {
      const color = accion.color;
      if (!['rojo', 'azul', 'amarillo'].includes(color)) return { estado: e, ok: false };
      e[color] = Math.min(10, Math.max(0, e[color] + (accion.delta > 0 ? 1 : -1)));
      return { estado: e, ok: true };
    }
    case 'deslizante': {
      const N = Math.round(Math.sqrt(e.length));
      const i = accion.indice, b = e.indexOf(0);
      const ri = Math.floor(i / N), ci = i % N, rb = Math.floor(b / N), cb = b % N;
      const adyacente = (ri === rb && Math.abs(ci - cb) === 1) || (ci === cb && Math.abs(ri - rb) === 1);
      if (!adyacente) return { estado: e, ok: false };
      [e[i], e[b]] = [e[b], e[i]];
      return { estado: e, ok: true };
    }
    case 'balanza': {
      const id = accion.id;
      e.mesa = e.mesa.filter((x: number) => x !== id);
      e.izq = e.izq.filter((x: number) => x !== id);
      e.der = e.der.filter((x: number) => x !== id);
      if (accion.lado === 'izq') e.izq.push(id);
      else if (accion.lado === 'der') e.der.push(id);
      else e.mesa.push(id);
      return { estado: e, ok: true };
    }
  }
  return { estado: e, ok: false };
}

/** Comprueba si el estado del juego interactivo es la solución. */
export function comprobarJuego(tipo: TipoMinijuego, estado: any, solucionTxt: string): boolean {
  const sol = JSON.parse(solucionTxt);
  switch (tipo) {
    case 'torres':
    case 'pinta':
    case 'deslizante':
      return JSON.stringify(estado) === JSON.stringify(sol);
    case 'mezcla':
      return estado.rojo === sol.rojo && estado.azul === sol.azul && estado.amarillo === sol.amarillo;
    case 'balanza': {
      if (estado.mesa.length > 0) return false;
      const pesoDe = (ids: number[]) => sumaArr(ids.map((id: number) => sol[id]));
      return pesoDe(estado.izq) === pesoDe(estado.der) && estado.izq.length > 0 && estado.der.length > 0;
    }
  }
  return false;
}

/** Comprueba la respuesta según el tipo de puzle. */
export function validarRespuesta(tipo: TipoMinijuego, solucion: any, respuesta: string): boolean {
  if (tipo === 'fraude' || tipo === 'reactor' || tipo === 'puntero' || tipo === 'semaforo' || tipo === 'barco' || tipo === 'cocina' || tipo === 'grua' || tipo === 'quien' || tipo === 'simon') return false; // se decide con botones, no con respuesta escrita
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
    case 'torres':
    case 'pinta':
    case 'mezcla':
    case 'deslizante':
    case 'balanza':
      return false; // se resuelven con Comprobar, no con respuesta escrita
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
