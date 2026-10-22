import { GameDefinition } from '../core/models/game.model';

export const JUEGOS_DISPONIBLES: GameDefinition[] = [
  {
    id: 'precio-justo',
    nombre: 'El Precio Justo',
    descripcion: 'Adivina el precio de productos del catálogo de Mercadona sin pasarte. ¡El más cercano gana!',
    icono: '🛒',
    modosSoportados: ['individual'],
    minJugadores: 1,
    configDefecto: {
      rondasTotales: 5
    }
  }
];

export function getJuegoById(id: string): GameDefinition | undefined {
  return JUEGOS_DISPONIBLES.find(j => j.id === id);
}
