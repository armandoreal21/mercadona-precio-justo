export type ModoJuego = 'individual' | 'equipos_sesion_unica' | 'equipos_multiusuario';

export interface GameDefinition {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  modosSoportados: ModoJuego[];
  minJugadores?: number;
  maxJugadores?: number;
  configDefecto?: Record<string, any>;
}
