import { ModoJuego } from './game.model';

export interface Jugador {
  nombre: string;
  apuesta?: number;
  esAdmin?: boolean;
  puntuacion?: number;
  equipoId?: string;
}

export interface Equipo {
  id: string;
  nombre: string;
  color?: string;
}

export interface ResultadoRonda {
  nombre: string;
  puntos: number;
  delta: number;
  apuesta?: number;
}

export interface HistorialRonda {
  ronda: number;
  producto?: any;
  resultados: ResultadoRonda[];
  ts: number;
}

export interface PalabraAportada {
  jugador: string;
  equipoId?: string;
  palabra: string;
  longitud: number;
  ts: number;
}

export interface SeleccionEquipoPalabra {
  equipoId: string;
  nombreEquipo?: string;
  palabra: string;
  longitud: number;
  seleccionadaPor: string;
  descartada?: boolean;
}

export type ModoPuntuacionPalabras = 'por_letras' | 'por_ganar';

export type DificultadPalabras = 'facil' | 'media' | 'dificil';

export interface EstadoPalabraMasLarga {
  fase: 'esperando' | 'jugando' | 'seleccion' | 'revelacion';
  letras: string[];
  numLetras?: number; // Cantidad fija de letras para la partida (ej: 10)
  tiempoLimite: number; // Segundos (ej. 45)
  tiempoFin?: number; // Timestamp en ms en el que acaba la cuenta atrás
  dificultad?: DificultadPalabras; // Dificultad fija de la partida
  palabrasAportadas: PalabraAportada[];
  selecciones: Record<string, SeleccionEquipoPalabra>; // clave: equipoId o nombre de jugador
  modoPuntuacion: ModoPuntuacionPalabras;
  puntosPorGanar?: number;
}

export interface Sala {
  codigo: string;
  nombre: string;
  tipoJuego: string;
  modoJuego: ModoJuego;
  equipos?: Equipo[];
  estado: string;
  jugadores: Jugador[];
  rondasTotales?: number;
  rondaActual?: number;
  // Campos específicos de partida / juegos
  productoActualId?: number | string | null;
  productoActual?: any;
  historialRondas?: HistorialRonda[];
  lastResults?: { ts: number; price: number; results: ResultadoRonda[] } | null;
  // Estado específico para "La Palabra Más Larga"
  estadoPalabras?: EstadoPalabraMasLarga | null;
  createdAt?: number;
  updatedAt?: number;
}
