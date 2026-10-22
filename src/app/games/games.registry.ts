import { GameDefinition } from '../core/models/game.model';

export const JUEGOS_DISPONIBLES: GameDefinition[] = [
  {
    id: 'precio-justo',
    nombre: 'El Precio Justo',
    descripcion: 'Adivina el precio de productos del catálogo de Mercadona. ¡El más cercano gana!',
    icono: '🛒',
    modosSoportados: ['individual'],
    minJugadores: 1,
    configDefecto: {
      rondasTotales: 5
    }
  },
  {
    id: 'palabra-mas-larga',
    nombre: 'La Palabra Más Larga',
    descripcion: 'Genera letras aleatorias en 45 segundos y encuentra la palabra más larga en español. ¡Compite por equipos o individual!',
    icono: '🔤',
    modosSoportados: ['equipos_multiusuario', 'individual'],
    minJugadores: 1,
    configDefecto: {
      rondasTotales: 5,
      numLetras: 10,
      tiempoSegundos: 45,
      modoPuntuacion: 'por_letras'
    }
  },
  {
    id: 'subasta-respuestas',
    nombre: 'La Subasta de Respuestas',
    descripcion: 'Se propone una categoría y todos escribís respuestas. Elegís las mejores, el árbitro valida y cada respuesta válida suma puntos. ¡Por equipos o individual!',
    icono: '🧠',
    modosSoportados: ['equipos_multiusuario', 'individual'],
    minJugadores: 1,
    configDefecto: {
      rondasTotales: 5,
      tiempoSegundos: 45,
      dificultad: 'facil'
    }
  }
];

export function getJuegoById(id: string): GameDefinition | undefined {
  return JUEGOS_DISPONIBLES.find(j => j.id === id);
}
