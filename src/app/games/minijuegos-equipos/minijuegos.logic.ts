import { TipoMinijuego } from '../../core/models/sala.model';

export const TIPOS_MINIJUEGO: TipoMinijuego[] = ['secuencia', 'cableado', 'mapa', 'codigo', 'metro'];

export const NOMBRE_MINIJUEGO: Record<TipoMinijuego, string> = {
  secuencia: '🔣 Símbolos en secuencia',
  cableado: '✂️ Cableado',
  mapa: '🗺️ Mapa a ciegas',
  codigo: '🔐 Código de tres dígitos',
  metro: '🚇 Ruta de metro'
};

export interface GeneracionMinijuego {
  panel: any;        // lo que ve el capitán
  pistas: string[];  // una pista por miembro del equipo (cíclico)
  solucion: any;     // solución (no se muestra en pantalla)
}

const SIMBOLOS = ['▲', '●', '■', '★', '◆', '✚'];
const COLORES = ['rojo', 'azul', 'verde', 'amarillo', 'blanco'];
const ESTACIONES = ['Sol', 'Opera', 'Retiro', 'Atocha', 'Chamartín', 'Nuevos Ministerios',
  'Usera', 'Vallecas', 'Canillas', 'Tirso de Molina', 'Legazpi', 'Goya'];
const N_MAPA = 4;

export function barajar<T>(lista: T[]): T[] {
  const c = [...lista];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function al(n: number): number {
  return Math.floor(Math.random() * n);
}

/** Reparte las piezas entre los miembros: cada persona recibe una parte distinta. */
function repartir(items: string[], n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const mias = items.filter((_, j) => j % n === i);
    return mias.length ? mias.join('\n') : 'Sin pista extra: ayuda a tu capitán con lo que veas.';
  });
}

export function generarMinijuego(tipo: TipoMinijuego, numPersonas: number): GeneracionMinijuego {
  const n = Math.max(1, numPersonas);
  switch (tipo) {
    case 'secuencia': return generarSecuencia(n);
    case 'cableado': return generarCableado(n);
    case 'mapa': return generarMapa(n);
    case 'codigo': return generarCodigo(n);
    case 'metro': return generarMetro(n);
  }
}

function generarSecuencia(n: number): GeneracionMinijuego {
  const digitos = barajar([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, SIMBOLOS.length);
  const tabla = SIMBOLOS.map((s, i) => ({ s, d: digitos[i] }));
  const secuencia = Array.from({ length: 4 }, () => tabla[al(tabla.length)]);
  return {
    panel: { secuencia: secuencia.map(x => x.s) },
    pistas: repartir(tabla.map(x => `${x.s} = ${x.d}`), n),
    solucion: secuencia.map(x => String(x.d)).join('')
  };
}

function generarCodigo(n: number): GeneracionMinijuego {
  const d = [al(10), al(10), al(10)];
  const pistas = [
    `El primer dígito es ${d[0]}.`,
    `El dígito del medio es ${d[1] % 2 === 0 ? 'par' : 'impar'}.`,
    `El tercer dígito es ${d[2]}.`,
    `La suma de los tres dígitos es ${d[0] + d[1] + d[2]}.`,
    `El primer dígito es ${d[0] > d[2] ? 'mayor' : 'menor o igual'} que el tercero.`
  ];
  return { panel: { longitud: 3 }, pistas: repartir(barajar(pistas), n), solucion: d.join('') };
}

function generarCableado(n: number): GeneracionMinijuego {
  const hilos = Array.from({ length: 5 }, () => COLORES[al(COLORES.length)]);
  const regla = COLORES[al(COLORES.length)];
  const pos = hilos.indexOf(regla);
  const objetivo = pos >= 0 ? pos : 4;
  const pistas = [
    `Color a buscar: ${regla}.`,
    `Regla: si aparece algún cable ${regla}, corta el PRIMERO de ese color. Si NO aparece ninguno, corta el ÚLTIMO cable.`
  ];
  return { panel: { hilos }, pistas: repartir(pistas, n), solucion: objetivo + 1 };
}

function existeCamino(muros: boolean[][]): boolean {
  const visto = new Set<string>(['0,0']);
  const cola: [number, number][] = [[0, 0]];
  while (cola.length) {
    const [r, c] = cola.shift()!;
    if (r === N_MAPA - 1 && c === N_MAPA - 1) return true;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      const k = `${nr},${nc}`;
      if (nr < 0 || nc < 0 || nr >= N_MAPA || nc >= N_MAPA || muros[nr][nc] || visto.has(k)) continue;
      visto.add(k);
      cola.push([nr, nc]);
    }
  }
  return false;
}

function generarMapa(n: number): GeneracionMinijuego {
  let muros: boolean[][];
  do {
    muros = Array.from({ length: N_MAPA }, () => Array.from({ length: N_MAPA }, () => Math.random() < 0.25));
    muros[0][0] = false;
    muros[N_MAPA - 1][N_MAPA - 1] = false;
  } while (!existeCamino(muros));
  const pistas = Array.from({ length: N_MAPA }, (_, r) => {
    const cols: number[] = [];
    for (let c = 0; c < N_MAPA; c++) if (muros[r][c]) cols.push(c + 1);
    return `Fila ${r + 1}: ${cols.length ? 'muros en las columnas ' + cols.join(', ') : 'sin muros'}.`;
  });
  return {
    panel: { tamano: N_MAPA },
    pistas: repartir(pistas, n),
    solucion: { muros }
  };
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

function generarMetro(n: number): GeneracionMinijuego {
  const p = barajar(ESTACIONES);
  const lineas: Record<string, string[]> = {
    L1: [p[0], p[1], p[2], p[3]],
    L2: [p[1], p[4], p[5], p[6]],
    L3: [p[6], p[7], p[8], p[9]]
  };
  const todas = [...new Set([...lineas.L1, ...lineas.L2, ...lineas.L3])];
  const origen = todas[al(todas.length)];
  let destino = origen;
  while (destino === origen) destino = todas[al(todas.length)];
  const pistas = Object.entries(lineas).map(([l, s]) => `Línea ${l}: ${s.join(' → ')}`);
  return {
    panel: { origen, destino },
    pistas: repartir(pistas, n),
    solucion: calcularTransbordos(lineas, origen, destino)
  };
}

/** Comprueba la respuesta del capitán según el tipo de minijuego. */
export function validarRespuesta(tipo: TipoMinijuego, solucion: any, respuesta: string): boolean {
  const texto = (respuesta || '').trim();
  switch (tipo) {
    case 'secuencia':
    case 'codigo':
      return texto.replace(/\D/g, '') === String(solucion);
    case 'cableado':
    case 'metro':
      return Number(texto) === Number(solucion);
    case 'mapa': {
      const muros: boolean[][] = solucion.muros;
      const N = muros.length;
      let r = 0, c = 0;
      for (const ch of texto.toUpperCase().replace(/\s/g, '')) {
        const d = ch === 'U' ? [-1, 0] : ch === 'D' ? [1, 0] : ch === 'L' ? [0, -1] : ch === 'R' ? [0, 1] : null;
        if (!d) return false;
        r += d[0];
        c += d[1];
        if (r < 0 || c < 0 || r >= N || c >= N || muros[r][c]) return false;
      }
      return r === N - 1 && c === N - 1;
    }
  }
}

export const TIEMPO_TURNO_MS = 180000;
export const PENALIZACION_ERROR_MS = 15000;
export const MAX_ERRORES = 3;
