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

// ==========================================
// JUEGO: LA SUBASTA DE RESPUESTAS
// ==========================================

export type FaseSubasta = 'esperando' | 'respondiendo' | 'seleccion' | 'revelacion';

export interface RespuestaSubastaAportada {
  jugador: string;
  equipoId?: string | null;
  respuesta: string;   // texto tal como lo escribió el jugador
  clave: string;       // normalizada (sin tildes, minúsculas) para deduplicar
  ts: number;
}

export interface RespuestaElegida {
  clave: string;
  texto: string;
}

export interface SeleccionSubasta {
  grupoId: string;               // nombre del jugador (individual) o id del equipo
  nombreGrupo: string;
  elegidas: RespuestaElegida[];  // respuestas que el grupo presenta
  invalidas: string[];           // claves marcadas como inválidas por el árbitro
  confirmada: boolean;
  seleccionadaPor: string;
}

export interface EstadoSubastaRespuestas {
  fase: FaseSubasta;
  dificultad: DificultadPalabras;
  categoriaId?: string | null;
  categoria?: string | null;
  descripcion?: string | null;
  tiempoLimite: number;
  tiempoFin?: number;
  puntosPorRespuesta: number;    // 1 en fácil/media, 2 en difícil
  puntosEntregados?: boolean;    // evita adjudicar dos veces la misma ronda
  categoriasUsadas?: string[];   // ids ya jugados en la partida
  respuestasAportadas?: RespuestaSubastaAportada[];
  selecciones?: Record<string, SeleccionSubasta>;
}

// ==========================================
// JUEGO: CÓDIGO SECRETO (solo equipos, 2 equipos)
// ==========================================

export type FaseCodigoSecreto = 'esperando' | 'jugando' | 'terminado';

/** 'neutra' | 'negra' | id de equipo dueño de la casilla */
export type BandoCasilla = string;

export interface CasillaCodigoSecreto {
  idPalabra: string;     // id del JSON palabras.json
  palabra: string;
  bando: BandoCasilla;   // solo lo ven los capitanes mientras no esté descubierta
  descubierta: boolean;
}

export interface PistaCodigoSecreto {
  texto: string;         // palabra pista que dice el capitán
  numero: number;        // cuántas casillas del equipo
  intentosRestantes: number;
  equipoId: string;
}

export interface EstadoCodigoSecreto {
  fase: FaseCodigoSecreto;
  casillas: CasillaCodigoSecreto[];       // 25 casillas (5x5)
  equipoInicialId: string;                // equipo con 9 casillas, empieza
  turnoEquipoId: string;                  // equipo que tiene el turno
  capitanes: Record<string, string>;      // equipoId -> nombre del capitán
  pista: PistaCodigoSecreto | null;       // pista activa del turno
  palabrasUsadas: string[];               // ids de palabras.json ya jugadas en la sala
  ganadorEquipoId: string | null;
  motivoFin?: 'todas_descubiertas' | 'negra' | null;
}

// ==========================================
// JUEGO: PREGUNTAS ANÓNIMAS (solo individual)
// ==========================================

export type FasePreguntasAnonimas = 'esperando' | 'haciendo-preguntas' | 'respondiendo' | 'revision';

export interface PreguntaAportada {
  idJugador: string;           // hash anónimo interno
  pregunta: string;
  index: number;               // orden en el que aparece
}

export interface RespuestaAportada {
  idJugador: string;           // hash anónimo interno
  indexPregunta: number;
  respuesta: string;
}

export interface RespuestaAgrupada {
  texto: string;
  cantidad: number;
  porcentaje: number;
}

export interface EstadoPreguntasAnonimas {
  fase: FasePreguntasAnonimas;
  preguntas: PreguntaAportada[];
  respuestas: RespuestaAportada[];
  indexPreguntaActual: number;  // para la revisión
  respuestasAgrupadas: Record<number, RespuestaAgrupada[]>; // indexPregunta -> array de respuestas agrupadas
}

export type TipoMinijuego = 'secuencia' | 'cableado' | 'mapa' | 'codigo' | 'metro' | 'ecuacion' | 'palabra' | 'carrera' | 'torres' | 'pinta' | 'mezcla' | 'deslizante' | 'balanza' | 'fraude';

export interface TurnoMinijuego {
  equipoId: string;
  ronda: number;
  tipo: TipoMinijuego;
  nivel: number;
  panel: any;
  pistas: string[];
  solucion: any;
  aciertos: number;
  errores: number;
  inicioMs: number;
  finMs: number;
  recorrido?: string[];
  estadoJ?: string;
  /** false mientras el capitán no ha pulsado Empezar: el reloj no corre y no se puede responder. */
  iniciado?: boolean;
}

export interface ResultadoTurnoMinijuego {
  ronda: number;
  equipoId: string;
  tipo: TipoMinijuego;
  aciertos: number;
  errores: number;
}

export interface EstadoMinijuegos {
  fase: 'esperando' | 'jugando' | 'terminado';
  ronda: number;
  totalRondas: number;
  tiempoTurnoSeg: number;
  tiposRonda: TipoMinijuego[];
  equiposOrden: string[];
  capitanes: Record<string, string>;
  turno: TurnoMinijuego | null;
  resultados: ResultadoTurnoMinijuego[];
  puntos: Record<string, number>;
  aciertosTotales: Record<string, number>;
  ganadorEquipoId: string | null;
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
  // Estado específico para "La Subasta de Respuestas"
  estadoSubasta?: EstadoSubastaRespuestas | null;
  // Estado específico para "Código Secreto"
  estadoCodigoSecreto?: EstadoCodigoSecreto | null;
  // Estado específico para "Preguntas Anónimas"
  estadoPreguntasAnonimas?: EstadoPreguntasAnonimas | null;
  // Estado específico para "Minijuegos por equipos"
  estadoMinijuegos?: EstadoMinijuegos | null;
  createdAt?: number;
  updatedAt?: number;
}
