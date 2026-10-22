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
  createdAt?: number;
  updatedAt?: number;
}
