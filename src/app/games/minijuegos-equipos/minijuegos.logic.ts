import { TipoMinijuego } from '../../core/models/sala.model';

export const TIPOS_MINIJUEGO: TipoMinijuego[] = ['secuencia', 'cableado', 'mapa', 'codigo', 'metro', 'ecuacion', 'palabra', 'carrera', 'torres', 'pinta', 'mezcla', 'deslizante', 'balanza'];

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

/** Aplica una acción del capitán sobre el estado del juego interactivo. */
export function aplicarAccionJuego(tipo: TipoMinijuego, estado: any, accion: any): { estado: any; ok: boolean } {
  const e = JSON.parse(JSON.stringify(estado));
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
