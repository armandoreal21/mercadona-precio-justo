import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sala, EstadoMinijuegos } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';
import { NOMBRE_MINIJUEGO, SEG_TURNO_DEFAULT, TIPOS_MINIJUEGO, PROTOCOLO_REACTOR } from './minijuegos.logic';

interface LineaMapa { eje: 'fila' | 'columna'; indice: number; muros: boolean[]; }
interface LineaMetro { tipo: 'linea' | 'hecho'; color?: string; estaciones?: string[]; texto?: string; cerrada?: boolean; }
interface CeldaMapa { texto: string; clase: string; }

const INSTRUCCIONES: Record<string, { resumen: string; ejemplo: string }> = {
  secuencia: { resumen: 'Os mostramos una secuencia de símbolos. Hay que decir cuál va después.', ejemplo: 'Ejemplo: ▲ ● ▲ ● ▲ → la respuesta es ●' },
  cableado: { resumen: 'Hay varios cables. El capitán toca el que indica la pista.', ejemplo: 'Ejemplo: si la pista dice "corta el cable 3", se toca el cable nº 3.' },
  mapa: { resumen: 'El robot sale de la S y tiene que llegar a la G sin chocar con muros. El capitán lo mueve con las flechas.', ejemplo: 'Ejemplo: tus pistas indican dónde hay muros. Avanza solo por casillas libres.' },
  codigo: { resumen: 'Hay que introducir un código de dígitos. Cada pista da un dígito.', ejemplo: 'Ejemplo: "primer dígito: el doble de 4" → 8.' },
  metro: { resumen: 'Hay que calcular los transbordos mínimos entre dos estaciones usando el mapa de líneas.', ejemplo: 'Ejemplo: de Origen a Destino con un transbordo → respuesta: 1.' },
  ecuacion: { resumen: 'Hay que resolver una operación cuyo resultado falta.', ejemplo: 'Ejemplo: 7 + 5 = ? → 12.' },
  palabra: { resumen: 'Os dan letras desordenadas. Hay que ordenarlas para formar una palabra.', ejemplo: 'Ejemplo: A-S-O-C → CASO.' },
  carrera: { resumen: 'Hay corredores y un objetivo. Hay que decir en qué posición llegó.', ejemplo: 'Ejemplo: si el objetivo llegó 2º → respuesta: 2.' },
  torres: { resumen: 'Hay que pasar todos los discos a otra torre. Un disco grande nunca va sobre uno pequeño.', ejemplo: 'Ejemplo: toca la torre de origen y después la de destino.' },
  pinta: { resumen: 'Hay que pintar la cuadrícula igual que el patrón de la pista. El capitán toca las casillas para cambiar su color.', ejemplo: 'Ejemplo: la fila 1 de la pista es azul, rojo, azul.' },
  mezcla: { resumen: 'Hay que mezclar colores hasta igualar el objetivo. El capitán sube o baja cada color.', ejemplo: 'Ejemplo: más azul y menos rojo para igualar el color objetivo.' },
  deslizante: { resumen: 'Puzle de fichas numeradas con un hueco. Hay que deslizarlas hasta ordenarlas.', ejemplo: 'Ejemplo: toca una ficha que esté junto al hueco para moverla.' },
  fraude: { resumen: 'Pasan piezas por la cinta. Sin ver las especificaciones, decide si cada pieza se ACEPTA o se RECHAZA según las normas que os dictan vuestros compañeros. Las normas cambian a mitad de cinta.', ejemplo: 'Ejemplo: "Se RECHAZAN las piezas de forma cuadrada y con arandela." Pieza cuadrada con arandela → Rechazar.' },
  reactor: { resumen: 'El reactor se está quedando sin presión. El capitán ve las alertas; cada persona tiene sus propios controles y hay que girarlos a la posición correcta. Cada alerta necesita dos controles de personas distintas.', ejemplo: 'Ejemplo: "Fuga en Refrigeración" necesita la Válvula 2 en la posición 3 y el Interruptor 5 en la posición 1.' },
  puntero: { resumen: 'Hay que llevar el cursor láser a la diana antes de que acabe el tiempo. El capitán ve el mapa; cada persona tiene uno o varios botones, y los controles rotan tras cada acierto.', ejemplo: 'Ejemplo: "¡X a la derecha! ¡Y arriba! ¡Cuidado con la mina!"' },
  semaforo: { resumen: 'Hay un cruce con coches que llegan de cuatro calles. Cada persona controla un semáforo y el tráfico avanza con cada cambio de luz. Si dos coches se cruzan sin verde, chocan.', ejemplo: 'Ejemplo: "¡Norte, verde! ¡Sur, rojo, que viene uno del Este!"' },
  barco: { resumen: 'Un barco avanza por un canal con rocas. Los remos de avance lo llevan una fila más abajo; los de atrás, una fila más arriba. Una roca hace perder 5 segundos; la orilla solo frena el barco. Llegar al puerto es el acierto.', ejemplo: 'Ejemplo: "¡Derecha! ¡Izquierda! ¡Cuidado, roca a la derecha!"' },
  cocina: { resumen: 'Hay que preparar un plato: echar los ingredientes en el orden de la receta, cada uno en su sartén, y dejar cada fuego en su punto. El plato sale solo cuando está listo. Un error resta 5 segundos.', ejemplo: 'Ejemplo: "¡Tomate en el fuego 1! ¡Fuego 2, sube una! ¡Ya está, sale el plato!"' },
  grua: { resumen: 'Hay que llevar una caja del suelo a la zona de destino con una grúa. Cada persona tiene un control: mover el gancho, subir o bajar el cable, o agarrar y soltar. Los edificios solo se cruzan con el cable arriba. Un error resta 5 segundos.', ejemplo: 'Ejemplo: "¡Adelante! ¡Bajar cable, que ya estamos encima! ¡Pinza, agarra!"' },
  quien: { resumen: 'La pantalla muestra una palabra y el módulo tiene seis botones. El manual está repartido entre el equipo: cada persona tiene una parte. Hay que averiguar qué botón pulsar en cada etapa, y solo el capitán pulsa. Un fallo resta 5 segundos.', ejemplo: 'Ejemplo: "La pantalla dice MONITOR. ¿Quién tiene MONITOR? Posición 6. ¿Qué botón hay en la 6? VA. ¿Quién tiene VA?"' },
  simon: { resumen: 'El módulo muestra un código y una secuencia de destellos de colores. Cada destello hay que responderlo con el color que indica la tabla de ese código. Hay códigos parecidos que sirven de trampa: hay que mirar siempre el código que dice el capitán. Solo el capitán pulsa; un error resta 5 segundos.', ejemplo: 'Ejemplo: "Código 263: el destello rojo se responde con el azul. ¿Quién tiene el rojo?"' },
  balanza: { resumen: 'Hay objetos con peso. Hay que repartirlos para que las dos bandejas pesen lo mismo.', ejemplo: 'Ejemplo: pasa objetos de la mesa a cada bandeja hasta que pesen igual.' }
};

@Component({
  selector: 'app-minijuegos-equipos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="w-full max-w-3xl mx-auto space-y-4" *ngIf="sala">

      <!-- ===================== ESPERANDO ===================== -->
      <div *ngIf="!est || est.fase === 'esperando'" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
        <div class="text-sm font-bold text-cyan-300">🧩 Minijuegos por equipos</div>
        <div class="text-xs text-slate-400">
          Cada equipo elige un capitán. Durante su turno, el equipo resuelve todos los puzles que pueda antes de que se acabe el tiempo.
        </div>

        <div *ngFor="let eq of equipos" class="flex items-center justify-between gap-2">
          <span class="text-sm text-white">🛡️ {{ eq.nombre }}</span>
          <select *ngIf="isAdmin" [(ngModel)]="capitanBorrador[eq.id]"
                  class="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm">
            <option [ngValue]="undefined" disabled>Elegir capitán</option>
            <option *ngFor="let m of miembros(eq.id)" [ngValue]="m">{{ m }}</option>
          </select>
          <span *ngIf="!isAdmin" class="text-xs text-slate-300">Capitán: {{ est?.capitanes?.[eq.id] || 'pendiente' }}</span>
        </div>

        <div *ngIf="isAdmin" class="space-y-1">
          <button type="button" (click)="juegosAbiertos = !juegosAbiertos" class="w-full flex justify-between items-center text-left">
            <span class="text-sm text-white">🎲 Juegos que pueden salir <span class="text-xs text-slate-400">({{ juegosMarcadosCount }}/{{ todosLosJuegos.length }})</span></span>
            <span class="text-xs text-slate-400">{{ juegosAbiertos ? '▲' : '▼' }}</span>
          </button>
          <ng-container *ngIf="juegosAbiertos">
            <button type="button" (click)="toggleTodosJuegos()" class="text-xs text-cyan-300 hover:text-cyan-200 underline">
              {{ juegosMarcadosCount === todosLosJuegos.length ? 'Deseleccionar todo' : 'Seleccionar todo' }}
            </button>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <label *ngFor="let j of todosLosJuegos" class="flex items-center gap-2 text-xs text-slate-200">
                <input type="checkbox" [(ngModel)]="juegosMarcados[j]" class="accent-cyan-500" />
                {{ nombreMinijuego[j] }}
              </label>
            </div>
            <div class="text-[11px] text-slate-500">Con 5 o más marcados no se repite ninguno. Con menos, alguno se repetirá.</div>
          </ng-container>
        </div>

        <div *ngIf="isAdmin" class="flex items-center justify-between gap-2">
          <label class="flex items-center gap-2 text-sm text-white"><input type="checkbox" [(ngModel)]="mostrarMetaBorrador" class="accent-cyan-500" />🗺️ En el mapa, los ayudantes ven la S y la G</label>
        </div>
        <div *ngIf="isAdmin" class="flex items-center justify-between gap-2">
          <span class="text-sm text-white">⏱️ Segundos por turno</span>
          <input type="number" min="15" max="300" [(ngModel)]="segundosBorrador"
                 class="w-24 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm text-center" />
        </div>

        <div *ngIf="isAdmin" class="text-center">
          <button (click)="iniciar()"
                  class="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-5 py-2 rounded-xl uppercase text-xs tracking-wide">
            ▶ Empezar
          </button>
        </div>
        <div *ngIf="!isAdmin" class="text-center text-xs text-slate-500">Esperando a que el admin empiece la partida.</div>
        <div *ngIf="error" class="p-2 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs text-center">⚠️ {{ error }}</div>
      </div>

      <!-- ===================== JUGANDO ===================== -->
      <div *ngIf="est && est.fase === 'jugando' && est.turno && !est.turno.iniciado" class="bg-slate-900 p-5 rounded-2xl border-2 border-cyan-500 space-y-4">
        <div class="text-center space-y-1">
          <div class="text-xs uppercase text-slate-400 tracking-wider">Siguiente turno</div>
          <div class="text-xl font-black text-white">🛡️ {{ nombreEquipo(est.turno.equipoId) }}</div>
          <div class="text-sm text-cyan-300">🧩 {{ nombreMinijuego[est.turno.tipo] }}</div>
        </div>
        <div class="text-sm text-slate-200">{{ instruccionActual.resumen }}</div>
        <div class="text-xs text-slate-300 bg-slate-800 rounded-lg p-3">{{ instruccionActual.ejemplo }}</div>
        <div class="text-xs text-slate-400 text-center">⏱️ {{ est.tiempoTurnoSeg }} segundos. El reloj empieza cuando el capitán pulse Empezar.</div>
        <div *ngIf="puedeEmpezar()" class="text-center">
          <button (click)="empezarTurno()"
                  class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl uppercase text-sm tracking-wide">
            ▶ Empezar turno
          </button>
        </div>
        <div *ngIf="!puedeEmpezar() && enEquipoActivo" class="text-center text-sm text-amber-300 animate-pulse">
          ⏳ Esperad a que el capitán dé la salida cuando estéis listos.
        </div>
        <div *ngIf="!enEquipoActivo && miEquipoId" class="text-center text-sm text-slate-400">
          👀 Observas el turno del otro equipo. Empezará cuando su capitán lo indique.
        </div>
        <div *ngIf="error" class="p-2 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs text-center">⚠️ {{ error }}</div>
      </div>

      <ng-container *ngIf="est && est.fase === 'jugando' && est.turno?.iniciado && est.turno as t">
        <div class="bg-slate-900 p-3 rounded-2xl border border-slate-700 flex flex-wrap justify-between gap-2 text-xs">
          <span class="font-bold text-cyan-300">Ronda {{ est.ronda }} de {{ est.totalRondas }}</span>
          <span class="text-slate-300">{{ nombreMinijuego[t.tipo] }} · nivel {{ t.nivel }}</span>
          <span class="font-mono" [class.text-rose-400]="segundosRestantes <= 10">⏱️ {{ formatear(segundosRestantes) }}</span>
        </div>

        <div class="bg-slate-900 p-4 rounded-2xl border-2 text-center space-y-1"
             [class.border-sky-500]="esEquipoUno(t.equipoId)" [class.border-rose-500]="!esEquipoUno(t.equipoId)">
          <div class="text-xs uppercase text-slate-400 tracking-wider">Turno de</div>
          <div class="text-xl font-black text-white">🛡️ {{ nombreEquipo(t.equipoId) }}</div>
          <div class="text-xs text-slate-400">
            Capitán: {{ est.capitanes[t.equipoId] }} · Aciertos: <span class="text-emerald-300 font-bold">{{ t.aciertos }}</span> · Errores: {{ t.errores }}
          </div>
        </div>

        <!-- Panel: lo ve el capitán activo y el equipo que observa -->
        <div *ngIf="puedeVerPanel()" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
          <div class="text-xs uppercase text-slate-400 tracking-wider">Panel</div>
          <ng-container [ngSwitch]="t.tipo">
            <div *ngSwitchCase="'secuencia'" class="space-y-3">
              <div class="text-xs text-slate-400 text-center">Memoriza el orden y pide a tu equipo el valor de cada símbolo.</div>
              <div class="flex flex-wrap justify-center gap-2">
                <div *ngFor="let s of t.panel.secuencia; let i = index" class="flex flex-col items-center gap-1">
                  <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 border border-cyan-500/40 shadow-[0_0_14px_rgba(34,211,238,0.2)] flex items-center justify-center text-2xl text-white" style="font-variant-emoji: text">{{ s }}</div>
                  <span class="text-[10px] text-slate-500">{{ i + 1 }}</span>
                </div>
              </div>
            </div>
            <div *ngSwitchCase="'cableado'" class="space-y-3">
              <div class="text-xs text-slate-400">Toca el cable que hay que cortar.</div>
              <div class="flex items-end justify-center gap-2 sm:gap-3 py-2 flex-wrap">
                <button *ngFor="let h of t.panel.hilos; let i = index" (click)="cortar(i + 1)" [disabled]="!esCapitan"
                        class="flex flex-col items-center gap-2 group disabled:cursor-default">
                  <span class="w-5 sm:w-6 h-40 sm:h-48 rounded-full shadow-lg transition group-enabled:group-hover:scale-y-105" [ngClass]="colorCable(h)"></span>
                  <span class="text-xs font-black text-slate-300">{{ i + 1 }}</span>
                </button>
              </div>
            </div>
            <div *ngSwitchCase="'mapa'" class="space-y-3 flex flex-col items-center">
              <div class="text-xs text-slate-400">
                Llega desde <b>S</b> hasta <b>G</b>. Usa las flechas para marcar el camino. Tu equipo te dirá dónde hay muros.
              </div>
              <div class="grid gap-1.5 mx-auto w-full max-w-xs p-3 rounded-2xl bg-slate-950/80 border border-slate-700 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]" [style.grid-template-columns]="'repeat(' + t.panel.tamano + ', minmax(0, 1fr))'">
                <div *ngFor="let c of celdasMapa" class="aspect-square w-full rounded-xl border flex items-center justify-center text-base font-black transition-all duration-200" [ngClass]="c.clase">
                  {{ c.texto }}
                </div>
              </div>
              <div *ngIf="esCapitan" class="flex flex-col items-center gap-1">
                <button (click)="mover('U')" class="group w-14 h-12 rounded-2xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500 shadow-lg text-cyan-300 text-xl font-black hover:brightness-125 active:scale-95 transition">↑</button>
                <div class="flex gap-1">
                  <button (click)="mover('L')" class="w-14 h-12 rounded-2xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500 shadow-lg text-cyan-300 text-xl font-black hover:brightness-125 active:scale-95 transition">←</button>
                  <button (click)="mover('D')" class="w-14 h-12 rounded-2xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500 shadow-lg text-cyan-300 text-xl font-black hover:brightness-125 active:scale-95 transition">↓</button>
                  <button (click)="mover('R')" class="w-14 h-12 rounded-2xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500 shadow-lg text-cyan-300 text-xl font-black hover:brightness-125 active:scale-95 transition">→</button>
                </div>
                <button (click)="deshacer()" class="text-xs text-slate-400 hover:text-slate-200 mt-1">↩️ Deshacer último paso</button>
              </div>
            </div>
            <div *ngSwitchCase="'codigo'" class="text-sm text-slate-200">Introduce el código de {{ t.panel.longitud }} dígitos.</div>
            <div *ngSwitchCase="'ecuacion'" class="flex items-center justify-center gap-3 text-3xl font-black">
              <span class="px-4 py-2 rounded-xl bg-slate-800 border-2 border-slate-600">{{ t.panel.ecuacion[0] }}</span>
              <span class="px-4 py-2 rounded-xl bg-cyan-700 border-2 border-cyan-400">{{ t.panel.ecuacion[1] }}</span>
              <span class="px-4 py-2 rounded-xl bg-slate-800 border-2 border-slate-600">{{ t.panel.ecuacion[2] }}</span>
              <span class="text-slate-400">= ?</span>
            </div>
            <div *ngSwitchCase="'palabra'" class="space-y-2">
              <div class="text-xs text-slate-400">Ordena estas letras para formar una palabra:</div>
              <div class="flex flex-wrap justify-center gap-2">
                <span *ngFor="let l of t.panel.letras" class="w-10 h-10 rounded-lg bg-slate-800 border-2 border-cyan-500 flex items-center justify-center font-black text-lg">{{ l }}</span>
              </div>
            </div>
            <div *ngSwitchCase="'carrera'" class="space-y-2">
              <div class="text-xs text-slate-400">Corredores. ¿En qué posición llegó <b>{{ t.panel.objetivo }}</b>?</div>
              <div class="flex flex-wrap justify-center gap-2">
                <span *ngFor="let c of t.panel.corredores" class="px-3 py-2 rounded-xl bg-slate-800 border-2 font-bold"
                      [class.border-yellow-400]="c === t.panel.objetivo" [class.border-slate-600]="c !== t.panel.objetivo">{{ c }}</span>
              </div>
            </div>
            <div *ngSwitchCase="'torres'" class="space-y-3">
              <div class="text-xs text-slate-400">{{ esCapitan ? 'Toca una torre para coger su disco y otra para dejarlo. Un disco grande no puede ir sobre uno pequeño.' : 'El capitán mueve los discos.' }}</div>
              <div class="flex items-end justify-center gap-4 py-2">
                <button *ngFor="let torre of estadoJuego; let i = index" (click)="tocarTorre(i)" [disabled]="!esCapitan"
                        class="flex flex-col-reverse items-center gap-1 w-28 min-h-[12rem] px-2 py-2 rounded-xl border-2"
                        [ngClass]="torreSeleccionada === i ? 'border-yellow-400 bg-slate-800' : 'border-slate-700 bg-slate-900'">
                  <div *ngFor="let d of torre" class="h-4 rounded-full bg-cyan-500" [style.width.%]="35 + d * 65 / t.panel.discos"></div>
                  <span class="text-xs text-slate-400 mb-1">Torre {{ i + 1 }}</span>
                </button>
              </div>
            </div>
            <div *ngSwitchCase="'pinta'" class="space-y-3">
              <div class="text-xs text-slate-400">{{ esCapitan ? 'Toca una casilla para cambiar su color.' : 'El capitán pinta la cuadrícula.' }}</div>
              <div class="grid gap-1 mx-auto" [style.grid-template-columns]="'repeat(' + t.panel.tamano + ', 2.75rem)'">
                <ng-container *ngFor="let fila of estadoJuego; let r = index">
                  <button *ngFor="let celda of fila; let c = index" (click)="pintar(r, c)" [disabled]="!esCapitan"
                          class="w-11 h-11 rounded-lg border-2 border-slate-700" [ngClass]="colorPintura(celda)"></button>
                </ng-container>
              </div>
            </div>
            <div *ngSwitchCase="'mezcla'" class="space-y-3">
              <div class="flex items-center justify-center gap-6">
                <div class="text-center">
                  <div class="w-20 h-20 rounded-2xl border-2 border-slate-600 mx-auto" [style.background]="t.panel.colorObjetivo"></div>
                  <div class="text-xs text-slate-400 mt-1">Objetivo</div>
                </div>
                <div class="text-center">
                  <div class="w-20 h-20 rounded-2xl border-2 border-slate-600 mx-auto" [style.background]="colorMezcla()"></div>
                  <div class="text-xs text-slate-400 mt-1">Tu mezcla</div>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div *ngFor="let c of ['rojo', 'azul', 'amarillo']" class="space-y-1">
                  <div class="text-xs text-slate-300 capitalize">{{ c }}: {{ estadoJuego[c] }}</div>
                  <div *ngIf="esCapitan" class="flex justify-center gap-1">
                    <button (click)="cambiarMezcla(c, -1)" class="w-8 h-8 rounded bg-slate-800 border border-slate-600">−</button>
                    <button (click)="cambiarMezcla(c, 1)" class="w-8 h-8 rounded bg-slate-800 border border-slate-600">+</button>
                  </div>
                </div>
              </div>
            </div>
            <div *ngSwitchCase="'deslizante'" class="space-y-3">
              <div class="text-xs text-slate-400">{{ esCapitan ? 'Toca una ficha que esté junto al hueco para deslizarla.' : 'El capitán desliza las fichas.' }}</div>
              <div class="grid gap-1 mx-auto" [style.grid-template-columns]="'repeat(' + t.panel.tamano + ', 3rem)'">
                <button *ngFor="let v of estadoJuego; let i = index" (click)="deslizar(i)" [disabled]="!esCapitan || v === 0"
                        class="w-12 h-12 rounded-lg font-black text-lg" [ngClass]="v === 0 ? 'bg-slate-950' : 'bg-cyan-600 text-white'">{{ v === 0 ? '' : v }}</button>
              </div>
            </div>
            <div *ngSwitchCase="'balanza'" class="space-y-3">
              <div class="text-xs text-slate-400">{{ esCapitan ? 'Toca un objeto para cambiarlo de sitio: mesa → izquierda → derecha → mesa. Las dos bandejas tienen que pesar lo mismo y no puede quedar nada en la mesa.' : 'El capitán reparte los objetos en la balanza.' }}</div>
              <div class="flex flex-wrap justify-center gap-2 min-h-[3rem]">
                <button *ngFor="let it of itemsMesa" (click)="cambiarLado(it.id)" [disabled]="!esCapitan"
                        class="px-3 py-2 rounded-xl bg-slate-800 border-2 border-slate-600 text-xl">{{ it.icono }}</button>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-xl border-2 border-sky-500 p-2 min-h-[4rem]">
                  <div class="text-xs text-sky-300 mb-1">Izquierda</div>
                  <button *ngFor="let it of itemsIzq" (click)="cambiarLado(it.id)" [disabled]="!esCapitan" class="text-xl mr-1">{{ it.icono }}</button>
                </div>
                <div class="rounded-xl border-2 border-rose-500 p-2 min-h-[4rem]">
                  <div class="text-xs text-rose-300 mb-1">Derecha</div>
                  <button *ngFor="let it of itemsDer" (click)="cambiarLado(it.id)" [disabled]="!esCapitan" class="text-xl mr-1">{{ it.icono }}</button>
                </div>
              </div>
            </div>
            <div *ngSwitchCase="'fraude'" class="space-y-4">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Decide sin mirar las especificaciones: acepta o rechaza cada pieza según lo que os dicten vuestras normas.' : 'El capitán decide cada pieza. Vosotros tenéis las normas: dictadlas.' }}</div>
              <div *ngIf="cambioNormaActivo" class="text-center text-xs font-black text-amber-300 bg-amber-950/50 border border-amber-600/40 rounded-lg py-1">🔔 Cambio de normativa: ahora aplican las normas nuevas</div>

              <!-- Cinta transportadora -->
              <div class="overflow-x-auto rounded-xl bg-slate-950 border-y-4 border-slate-700 py-4 px-3">
                <div class="flex items-end gap-3 min-w-max">
                  <ng-container *ngFor="let p of piezasFraude; let i = index">
                    <div *ngIf="i === cambioFraude" class="flex flex-col items-center gap-1 px-1">
                      <div class="h-20 border-l-2 border-dashed border-amber-400"></div>
                      <div class="text-[10px] font-black text-amber-300 whitespace-nowrap">⚠ NORMA B</div>
                    </div>
                    <div class="flex flex-col items-center gap-1 transition-all"
                         [ngClass]="i === idxFraude ? 'opacity-100 scale-110' : (i < idxFraude ? 'opacity-40' : 'opacity-75')">
                      <div class="text-yellow-300 text-lg leading-none h-5" *ngIf="i === idxFraude">▼</div>
                      <div class="h-5" *ngIf="i !== idxFraude"></div>
                      <div class="relative w-16 h-16 flex items-center justify-center">
                        <div class="w-14 h-14 shadow-lg"
                             [ngClass]="formaClase(p) + ' ' + colorClase(p)"
                             [style.clip-path]="p.forma === 'triangular' ? 'polygon(50% 0, 100% 100%, 0 100%)' : null"></div>
                        <div *ngIf="p.arandela" class="absolute w-6 h-6 rounded-full border-4 border-white/90"></div>
                        <div *ngIf="i < idxFraude" class="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">✓</div>
                      </div>
                      <div class="text-[10px] text-slate-400 font-bold">{{ i + 1 }}</div>
                    </div>
                  </ng-container>
                </div>
              </div>

              <!-- Leyenda -->
              <div class="flex flex-wrap justify-center items-center gap-3 text-[11px] text-slate-400">
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-slate-400 inline-block"></span> cuadrada</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-slate-400 inline-block"></span> redonda</span>
                <span class="flex items-center gap-1"><span class="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-slate-400 inline-block"></span> triangular</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full border-2 border-slate-300 inline-block"></span> con arandela</span>
              </div>

              <div *ngIf="esCapitan" class="flex justify-center gap-3">
                <button (click)="decidir('aceptar')" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl uppercase text-sm tracking-wide">✅ Aceptar</button>
                <button (click)="decidir('rechazar')" class="bg-rose-500 hover:bg-rose-400 text-white font-black px-6 py-3 rounded-xl uppercase text-sm tracking-wide">❌ Rechazar</button>
              </div>
            </div>
            <div *ngSwitchCase="'reactor'" class="space-y-4">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Ves las alertas, no los controles. Dicta a tu equipo qué mover y quién.' : 'El capitán ve las alertas. Vosotros tenéis los controles.' }}</div>
              <div class="space-y-1">
                <div class="flex justify-between text-xs font-black"><span>PRESIÓN</span><span>{{ presionPct | number:'1.0-0' }}%</span></div>
                <div class="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full transition-all" [ngClass]="presionPct < 25 ? 'bg-rose-500' : 'bg-cyan-400'" [style.width.%]="presionPct"></div>
                </div>
              </div>
              <div class="grid gap-2">
                <ng-container *ngFor="let a of alertasReactor">
                  <div *ngIf="a.activa" class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 transition"
                       [ngClass]="a.resuelta ? 'border-emerald-500 bg-emerald-950/40' : 'border-rose-500 bg-rose-950/40 animate-pulse'">
                    <div>
                      <div class="text-sm font-bold text-white">{{ a.resuelta ? '✅' : '🚨' }} {{ a.texto }}</div>
                      <div class="text-[11px] text-slate-300 space-y-0.5">
                        <div *ngFor="let r of a.chuleta" [ngClass]="r.ok ? 'text-emerald-300' : 'text-amber-200'">{{ r.ok ? '✓' : '○' }} {{ r.tipo }} → posición <b>{{ r.pos }}</b></div>
                        <div class="text-slate-400">{{ a.listos }}/{{ a.total }} bien · activa hace {{ a.hace }} s</div>
                      </div>
                    </div>
                    <span class="text-xs font-black" [ngClass]="a.resuelta ? 'text-emerald-300' : 'text-rose-300'">{{ a.resuelta ? 'RESUELTA' : 'ACTIVA' }}</span>
                  </div>
                  <div *ngIf="!a.activa" class="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 opacity-60">
                    <span class="text-sm text-slate-400">⏳ Próxima alerta</span>
                    <span class="text-xs text-slate-500">en {{ a.faltan }} s</span>
                  </div>
                </ng-container>
              </div>
            </div>
            <div *ngSwitchCase="'puntero'" class="space-y-3">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Ves el mapa, no tienes mandos. Dirige a tu equipo: quién mueve qué.' : 'El capitán ve el mapa y os dirige.' }}</div>
              <div class="flex flex-col items-center gap-2">
                <div class="grid gap-1" [style.grid-template-columns]="'repeat(' + punteroN + ', 2.5rem)'">
                  <div *ngFor="let c of punteroCeldas" class="w-10 h-10 rounded-md flex items-center justify-center text-lg border transition-colors" [ngClass]="c.clase">{{ c.icono }}</div>
                </div>
                <div class="text-xs text-slate-300">{{ punteroDentro ? '¡Encima de la diana!' : 'Aún no' }}</div>
                <div *ngIf="punteroAviso" class="text-xs font-black text-rose-300">{{ punteroAviso }}</div>
                <div class="text-[11px] text-slate-400">🏁 salida · 🎯 diana · 💣 mina (vuelve a la salida) · casilla oscura = muro</div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div *ngFor="let h of punteroTitulares" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200">{{ h.rol }}: <b class="text-white">{{ h.nombre }}</b></div>
              </div>
            </div>
            <div *ngSwitchCase="'semaforo'" class="space-y-3">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Ves el cruce. Dile a cada persona qué luz cambiar y cuándo.' : 'El capitán ve el cruce y os dirige.' }}</div>
              <div class="grid grid-cols-3 gap-2 w-64 mx-auto text-center text-xs">
                <div></div>
                <div class="bg-slate-950 rounded-xl p-2 border border-slate-700">
                  <div class="font-black text-white">Norte</div>
                  <span class="inline-block w-5 h-5 rounded-full my-1" [ngClass]="colorLuz(semaforoLuces[0])"></span>
                  <div class="text-slate-300">🚗 {{ semaforoColas[0] }}</div>
                </div>
                <div></div>
                <div class="bg-slate-950 rounded-xl p-2 border border-slate-700">
                  <div class="font-black text-white">Oeste</div>
                  <span class="inline-block w-5 h-5 rounded-full my-1" [ngClass]="colorLuz(semaforoLuces[3])"></span>
                  <div class="text-slate-300">🚗 {{ semaforoColas[3] }}</div>
                </div>
                <div class="bg-slate-800 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500 min-h-[5rem]">cruce</div>
                <div class="bg-slate-950 rounded-xl p-2 border border-slate-700">
                  <div class="font-black text-white">Este</div>
                  <span class="inline-block w-5 h-5 rounded-full my-1" [ngClass]="colorLuz(semaforoLuces[2])"></span>
                  <div class="text-slate-300">🚗 {{ semaforoColas[2] }}</div>
                </div>
                <div></div>
                <div class="bg-slate-950 rounded-xl p-2 border border-slate-700">
                  <div class="font-black text-white">Sur</div>
                  <span class="inline-block w-5 h-5 rounded-full my-1" [ngClass]="colorLuz(semaforoLuces[1])"></span>
                  <div class="text-slate-300">🚗 {{ semaforoColas[1] }}</div>
                </div>
                <div></div>
              </div>
              <div class="text-xs text-slate-300 text-center">Pasados: <b>{{ semaforoPasados }}</b>/{{ semaforoTotal }} · Choques: <b>{{ semaforoChoques }}</b></div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div *ngFor="let h of semaforoTitulares" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200">{{ h.aprox }}: <b class="text-white">{{ h.nombre }}</b></div>
              </div>
            </div>
            <div *ngSwitchCase="'barco'" class="space-y-3 flex flex-col items-center">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Ves el canal. Dile a cada persona cuándo remar a babor o a estribor.' : 'El capitán ve el canal y os dirige.' }}</div>
              <div class="grid gap-1.5 w-full max-w-xs p-3 rounded-2xl bg-slate-950/80 border border-slate-700 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]" [style.grid-template-columns]="'repeat(' + barcoW + ', minmax(0, 1fr))'">
                <div *ngFor="let c of barcoCeldas" class="aspect-square w-full border flex items-center justify-center text-lg transition-all duration-200" [ngClass]="c.clase">{{ c.icono }}</div>
              </div>
              <div class="text-xs text-slate-300 text-center">Avance: <b>{{ barcoProgreso }}%</b> · Bloqueos: <b>{{ barcoBloqueos }}</b></div>
              <div *ngIf="barcoAviso" class="text-xs font-black text-rose-300 text-center">{{ barcoAviso }}</div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div *ngFor="let h of barcoTitulares" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200">{{ h.remo }}: <b class="text-white">{{ h.nombre }}</b></div>
              </div>
            </div>
            <div *ngSwitchCase="'cocina'" class="space-y-3">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Dile a cada persona qué ingrediente echar y en qué sartén. El plato sale solo cuando está listo.' : 'El capitán os dirige.' }}</div>

              <div class="grid grid-cols-2 gap-3">
                <div *ngFor="let p of cocinaSartenesVista; trackBy: trackPan" class="rounded-2xl border-2 p-3 space-y-2 bg-slate-900" [ngClass]="cocinaFalloS === p.idx ? 'border-rose-500 animate-pulse' : (p.nivel === p.objetivo ? 'border-emerald-500' : 'border-slate-600')">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-black text-white">🍳 Fuego {{ p.idx + 1 }}</span>
                    <span [ngClass]="p.nivel === p.objetivo ? 'text-emerald-300' : 'text-amber-200'">{{ p.nivel === p.objetivo ? '✓ en su punto' : 'ajustar' }}</span>
                  </div>
                  <div class="flex justify-center gap-0.5 flex-wrap">
                    <span *ngFor="let k of llamaSlots" class="w-3.5 h-3.5 rounded-full border" [ngClass]="k < p.nivel ? 'bg-orange-500 border-orange-300' : 'bg-slate-950 border-slate-700'"></span>
                  </div>
                  <div class="text-center text-[11px] text-slate-300">nivel {{ p.nivel }} · objetivo <b class="text-white">{{ p.objetivo }}</b></div>
                  <div class="flex flex-wrap justify-center gap-1 min-h-[2.5rem]">
                    <div *ngFor="let ing of p.ingredientes" class="relative flex flex-col items-center justify-center w-14 py-1.5 rounded-xl border-2 transition-all duration-300" [ngClass]="cocinaFalloI === ing.i ? 'bg-rose-900/70 border-rose-500 animate-pulse' : (ing.anadido ? 'border-emerald-500 bg-emerald-900/30' : (ing.orden === cocinaAnadidos + 1 ? 'border-cyan-300 bg-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.45)] animate-pulse' : 'border-slate-700 bg-slate-950/60 opacity-70'))"><span class="text-2xl leading-none">{{ ing.icono }}</span><span class="text-[10px] text-slate-300 mt-1">{{ ing.nombre }}</span><span *ngIf="ing.anadido" class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black flex items-center justify-center">✓</span></div>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap items-stretch justify-center gap-2 pt-2">
                <ng-container *ngFor="let o of cocinaOrdenVista; let last = last; trackBy: trackOrden">
                  <div class="flex items-center gap-2">
                    <div class="relative flex flex-col items-center justify-center w-16 py-2 rounded-xl border-2 transition-all duration-300"
                         [ngClass]="o.anadido ? 'border-emerald-500 bg-emerald-900/30' : (o.orden === cocinaAnadidos + 1 ? 'border-cyan-300 bg-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.45)] animate-pulse' : 'border-slate-700 bg-slate-950/60 opacity-70')">
                      <span class="text-2xl leading-none">{{ o.icono }}</span>
                      <span class="text-[10px] text-slate-300 mt-1">{{ o.nombre }}</span>
                      <span class="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-slate-800 border border-slate-500 text-[10px] font-black flex items-center justify-center text-white">{{ o.orden }}</span>
                      <span class="absolute -bottom-2 px-1.5 rounded-full text-[10px] font-black" [ngClass]="o.sarten === 0 ? 'bg-amber-500 text-slate-950' : 'bg-sky-500 text-slate-950'">F{{ o.sarten + 1 }}</span>
                      <span *ngIf="o.anadido" class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black flex items-center justify-center">✓</span>
                    </div>
                    <span *ngIf="!last" class="text-slate-500 text-lg">›</span>
                  </div>
                </ng-container>
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs">
                <div *ngFor="let h of cocinaTitulares" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200">{{ h.nombre }}: <b class="text-white">{{ h.persona }}</b></div>
              </div>
            </div>
            <div *ngSwitchCase="'grua'" class="space-y-3">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Ves la obra. Dile a cada persona qué mover y cuándo.' : 'El capitán ve la obra y os dirige.' }}</div>
              <div class="grid gap-1 mx-auto" [style.grid-template-columns]="'repeat(' + gruaW + ', 2.5rem)'">
                <div *ngFor="let c of gruaCeldas" class="w-10 h-10 rounded-md flex items-center justify-center text-lg border" [ngClass]="c.clase">{{ c.icono }}</div>
              </div>
              <div class="flex items-center gap-3 bg-slate-950 rounded-xl p-3 border border-slate-700">
                <div class="flex flex-col gap-1">
                  <div *ngFor="let nivel of gruaNiveles" class="w-16 h-5 rounded text-[10px] flex items-center justify-center" [ngClass]="gruaAltura === nivel ? 'bg-cyan-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-500'">{{ nivel === 2 ? 'Alto' : nivel === 1 ? 'Medio' : 'Suelo' }}</div>
                </div>
                <div class="text-xs text-slate-200 space-y-1">
                  <div>🏗️ Cable: <b>{{ gruaTextoAltura }}</b></div>
                  <div>📦 Caja: <b>{{ gruaCaja }}</b></div>
                  <div class="text-cyan-200">💡 {{ gruaPista }}</div>
                </div>
              </div>
              <div class="text-[11px] text-slate-400 text-center">🏗️ gancho · 📦 caja · 🎯 entrega · 🏢 edificio (solo se cruza con el cable arriba)</div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div *ngFor="let h of gruaTitulares" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200">{{ h.nombre }}: <b class="text-white">{{ h.persona }}</b></div>
              </div>
            </div>
            <div *ngSwitchCase="'quien'" class="space-y-3">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Ves la pantalla y los botones. Pregunta a tu equipo y pulsa.' : 'El capitán ve el módulo y os dirige.' }}</div>
              <div class="flex items-center justify-center gap-2 text-xs"><span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"></span><span class="text-slate-300">Aciertos <b class="text-white">{{ t.aciertos }}</b> · sigue hasta que se acabe el tiempo</span></div>
              <div *ngIf="qvpEtapa as et" class="space-y-3">
                <div class="relative rounded-2xl border-4 bg-gradient-to-b from-slate-950 to-slate-900 p-5 text-center transition-all duration-300" [ngClass]="qvpExitoActivo ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.6)]' : 'border-slate-700 shadow-[0_0_30px_rgba(34,211,238,0.25)]'"><div class="text-[10px] uppercase tracking-[0.3em] mb-1" [ngClass]="qvpExitoActivo ? 'text-emerald-300 font-black' : 'text-cyan-500/70'">{{ qvpExitoActivo ? '✓ ¡acierto!' : 'pantalla' }}</div><div class="font-mono text-3xl font-black text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)] tracking-widest">{{ et.pantalla }}</div></div>
                <div class="grid grid-cols-3 gap-2 max-w-sm mx-auto">
                  <button *ngFor="let b of et.botones; let i = index" (click)="pulsarQVP(i)" [disabled]="!esCapitan" class="relative rounded-2xl border-2 py-3 sm:py-4 px-1 text-sm sm:text-base font-black text-white shadow-lg hover:brightness-125 active:scale-95 transition disabled:opacity-60 disabled:active:scale-100" [ngClass]="qvpBotonFallo === i ? 'bg-rose-700 border-rose-400 animate-pulse' : 'bg-slate-800 border-slate-500'"><span class="absolute top-1 left-2 text-[10px] text-slate-400">{{ i + 1 }}</span>{{ b }}</button>
                </div>
              </div>
            </div>
            <div *ngSwitchCase="'simon'" class="space-y-3">
              <div class="text-xs text-slate-400 text-center">{{ esCapitan ? 'Ves el código y los destellos. Pregunta a tu equipo y pulsa.' : 'El capitán ve el módulo y os dirige.' }}</div>
              <div class="flex items-center justify-center gap-3 text-xs"><span class="px-3 py-1 rounded-full bg-slate-800 border border-slate-600 text-slate-200">{{ simonResueltos > 0 ? 'Repite todo desde el principio' : 'Pulsa el primer destello' }}</span><span class="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-black">Aciertos {{ t.aciertos }}</span></div>
              <div class="flex justify-center gap-2">
                <div *ngFor="let c of simonSecuencia; let i = index" class="flex flex-col items-center gap-1">
                  <span class="relative w-14 h-14 rounded-full border-4 flex items-center justify-center transition-all duration-300" [ngClass]="[simonFondoColor(c.color), simonFalloActivo ? 'border-rose-500 animate-pulse' : (i === simonPulsadas ? 'border-white ring-4 ring-white/40 animate-pulse scale-110' : (i < simonResueltos ? 'border-emerald-400' : (i === simonResueltos ? 'border-slate-300' : 'border-slate-700 opacity-50')))]"></span>
                  <span class="text-xs font-black text-white">{{ c.codigo }}</span>
                  <span class="w-8 h-1 rounded-full" [ngClass]="i < simonResueltos ? 'bg-emerald-400' : 'bg-transparent'"></span>
                </div>
              </div>
              <div class="text-center text-xs text-slate-300">{{ simonPasoTexto }}</div>
              <div class="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                <svg viewBox="0 0 200 200" class="col-span-2 justify-self-center w-64 h-64 drop-shadow-2xl" [class.ring-4]="simonFalloActivo" [class.ring-rose-500]="simonFalloActivo" [class.rounded-full]="simonFalloActivo" [style.pointer-events]="esCapitan ? 'auto' : 'none'">
                  <defs>
                    <radialGradient id="simonBisel" cx="50%" cy="40%" r="60%">
                      <stop offset="0%" stop-color="#64748b"/>
                      <stop offset="60%" stop-color="#1e293b"/>
                      <stop offset="100%" stop-color="#020617"/>
                    </radialGradient>
                    <radialGradient id="simonCentro" cx="40%" cy="35%" r="70%">
                      <stop offset="0%" stop-color="#475569"/>
                      <stop offset="100%" stop-color="#0f172a"/>
                    </radialGradient>
                    <linearGradient id="simonReflejo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
                      <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
                    </linearGradient>
                    <filter id="simonResplandor" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="4" result="halo"/>
                      <feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  <circle cx="100" cy="100" r="99" fill="url(#simonBisel)"/>
                  <circle cx="100" cy="100" r="94" fill="#020617"/>
                  <g *ngFor="let c of simonCunas">
                    <path [attr.d]="c.d" [attr.fill]="simonRelleno(c.color)" [attr.filter]="simonIluminado === c.color ? 'url(#simonResplandor)' : null" stroke="#020617" stroke-width="2.5" class="cursor-pointer transition-colors duration-150" (click)="pulsarSimon(c.color)"/>
                    <path [attr.d]="c.d" fill="url(#simonReflejo)" class="pointer-events-none"/>
                  </g>
                  <circle cx="100" cy="100" r="22" fill="url(#simonCentro)" stroke="#475569" stroke-width="2"/>
                  <circle cx="100" cy="100" r="8" [attr.fill]="simonIluminado ? '#f8fafc' : '#334155'" [attr.filter]="simonIluminado ? 'url(#simonResplandor)' : null"/>
                </svg>
              </div>
            </div>
            <div *ngSwitchCase="'metro'" class="space-y-3">
              <div class="text-xs text-slate-400">¿Cuántos transbordos mínimos hacen falta para ir del origen al destino?</div>
              <div class="flex items-center justify-center gap-3">
                <span class="px-3 py-2 rounded-xl bg-slate-800 border-2 border-emerald-500 font-black text-white">🟢 {{ t.panel.origen }}</span>
                <span class="text-slate-400">→</span>
                <span class="px-3 py-2 rounded-xl bg-slate-800 border-2 border-rose-500 font-black text-white">🔴 {{ t.panel.destino }}</span>
              </div>
            </div>
          </ng-container>
        </div>

        <div *ngIf="esCapitan && esInteractivo(t.tipo)" class="bg-slate-900 p-4 rounded-2xl border border-slate-700">
          <button (click)="comprobar()"
                  class="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2 rounded-lg uppercase text-xs tracking-wide">
            ✅ Comprobar
          </button>
        </div>

        <!-- Respuesta de Símbolos en secuencia: flechas y teclado, con el error dentro del propio panel -->
        <div *ngIf="esCapitan && t.tipo === 'secuencia'" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
          <div class="text-xs text-emerald-300 font-bold text-center">Escribe el valor de cada símbolo, en orden:</div>
          <div class="flex justify-center gap-2 flex-wrap">
            <div *ngFor="let d of digitosSecuencia; let i = index" class="flex flex-col items-center gap-1">
              <button (click)="ajustarDigito(i, 1)" class="w-10 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-black">▲</button>
              <div (click)="tocarDigito(i)" class="w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black cursor-pointer transition-all duration-200"
                   [ngClass]="falloSecuencia ? 'border-rose-500 bg-rose-950/50 text-rose-300 animate-pulse' : (digitoActivo === i ? 'border-cyan-300 bg-slate-950 text-white shadow-[0_0_14px_rgba(34,211,238,0.5)]' : 'border-cyan-500/50 bg-slate-950 text-white')">{{ d }}</div>
              <button (click)="ajustarDigito(i, -1)" class="w-10 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-black">▼</button>
            </div>
          </div>
          <div class="grid grid-cols-5 gap-2 max-w-xs mx-auto" *ngIf="mostrarTecladoSecuencia">
            <button *ngFor="let n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]" (click)="pulsarDigito(n)" class="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-black active:scale-95 transition">{{ n }}</button>
          </div>
          <button (click)="enviarSecuencia()" class="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2 rounded-lg uppercase text-xs tracking-wide">Enviar</button>
        </div>

        <!-- Equipo activo: el capitán responde, los ayudantes ven su pista -->
        <ng-container *ngIf="enEquipoActivo">
          <div *ngIf="esCapitan && t.tipo !== 'mapa' && t.tipo !== 'cableado' && t.tipo !== 'fraude' && t.tipo !== 'reactor' && t.tipo !== 'puntero' && t.tipo !== 'semaforo' && t.tipo !== 'barco' && t.tipo !== 'cocina' && t.tipo !== 'grua' && t.tipo !== 'quien' && t.tipo !== 'simon' && t.tipo !== 'secuencia' && !esInteractivo(t.tipo)" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
            <div class="text-xs text-emerald-300 font-bold">Eres el capitán: escribe la respuesta cuando tu equipo te la dé.</div>
            <input [(ngModel)]="respuesta" (keyup.enter)="enviar()" [placeholder]="placeholderRespuesta(t.tipo)"
                   class="w-full bg-slate-800 border-2 border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400" />
            <button (click)="enviar()" [disabled]="!respuesta.trim()"
                    class="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 text-slate-950 font-black py-2 rounded-lg uppercase text-xs tracking-wide">
              Enviar respuesta
            </button>
          </div>

          <div *ngIf="!esCapitan || soloCapitan" class="bg-slate-900 p-4 rounded-2xl border border-cyan-700 space-y-2">
            <div class="text-xs uppercase text-cyan-300 font-bold">Tu pista (solo para ti)</div>
            <div *ngIf="t.tipo === 'fraude'" class="inline-block text-xs font-bold px-2 py-1 rounded-lg bg-slate-800 border border-slate-600">{{ etiquetaNorma }}</div>

            <!-- Pista visual del metro: líneas dibujadas -->
            <div *ngIf="t.tipo === 'metro'" class="space-y-3">
              <ng-container *ngFor="let p of lineasMetro">
                <div *ngIf="p.tipo === 'linea'" class="space-y-1" [class.opacity-40]="p.cerrada">
                  <div class="text-xs text-slate-300">Línea {{ p.color }} <span *ngIf="p.cerrada" class="text-rose-400 font-bold">· CERRADA por obras: no se puede usar</span></div>
                  <div class="flex flex-wrap items-center gap-1">
                    <ng-container *ngFor="let e of p.estaciones; let last = last">
                      <span class="px-2 py-1 rounded-full text-xs font-bold text-white" [ngClass]="colorLinea(p.color)">{{ e }}</span>
                      <span *ngIf="!last" class="h-1 w-3 rounded" [ngClass]="colorLinea(p.color)"></span>
                    </ng-container>
                  </div>
                </div>
                <div *ngIf="p.tipo === 'hecho'" class="text-sm text-slate-200">• {{ p.texto }}</div>
              </ng-container>
            </div>

            <!-- Pista visual del mapa -->
            <div *ngIf="t.tipo === 'mapa'" class="space-y-2 flex flex-col items-center">
              <div class="grid gap-[3px] w-full max-w-xs" [style.grid-template-columns]="'repeat(' + tableroMapaN + ', minmax(0, 1fr))'">
                <div *ngFor="let c of tableroAyudante" class="aspect-square w-full rounded flex items-center justify-center text-[11px] font-black" [ngClass]="c.clase">{{ c.texto }}</div>
              </div>
              <div class="text-[11px] text-slate-500">Solo ves tu parte: el resto está tapado. Oscuro = muro · Claro = paso libre</div>
            </div>

            <!-- Pista visual de pinta y deslizante: filas dibujadas -->
            <div *ngIf="t.tipo === 'pinta' || t.tipo === 'deslizante'" class="space-y-2">
              <div *ngFor="let f of filasPista" class="flex items-center gap-2">
                <span class="text-xs text-slate-400 w-14">Fila {{ f.indice }}</span>
                <div class="flex gap-1">
                  <div *ngFor="let c of f.celdas" class="w-8 h-8 rounded flex items-center justify-center text-xs font-black"
                       [ngClass]="t.tipo === 'pinta' ? colorPintura(c) : (c === 0 ? 'bg-slate-950' : 'bg-cyan-600 text-white')">{{ t.tipo === 'deslizante' && c !== 0 ? c : '' }}</div>
                </div>
              </div>
            </div>

            <div *ngIf="t.tipo === 'fraude'" class="space-y-2">
              <div *ngFor="let r of reglasFraude" class="flex flex-wrap items-center gap-3 bg-slate-950 rounded-xl px-3 py-2 border border-slate-700">
                <span class="text-xs font-black uppercase" [ngClass]="r.v === 'A' ? 'text-emerald-300' : 'text-rose-300'">{{ r.v === 'A' ? 'Aceptar si' : 'Rechazar si' }}</span>
                <span *ngIf="r.forma" class="flex items-center gap-1 text-xs font-bold text-white">
                  <span class="w-5 h-5 bg-slate-300 inline-block" [ngClass]="formaClase(r)" [style.clip-path]="r.forma === 'triangular' ? 'polygon(50% 0, 100% 100%, 0 100%)' : null"></span>
                  {{ r.forma }}
                </span>
                <span *ngIf="r.color" class="flex items-center gap-1 text-xs font-bold text-white">
                  <span class="w-5 h-5 rounded-full inline-block" [ngClass]="colorClase(r)"></span>
                  {{ r.color }}
                </span>
                <span *ngIf="r.arandela !== undefined" class="flex items-center gap-1 text-xs font-bold text-white">
                  <span class="w-5 h-5 rounded-full border-4 inline-block" [ngClass]="r.arandela ? 'border-white' : 'border-slate-500 border-dashed'"></span>
                  {{ r.arandela ? 'con arandela' : 'sin arandela' }}
                </span>
              </div>
            </div>

            <div *ngIf="t.tipo === 'reactor' && miOwner >= 0" class="space-y-3">
              <div class="text-xs text-slate-400">Tus controles. Tu capitán te dirá a qué posición ponerlo. Gira hasta esa posición.</div>
              <div *ngFor="let c of controlesMios" class="flex flex-wrap items-center gap-3 bg-slate-950 rounded-xl px-3 py-2 border border-slate-700">
                <div>
                  <div class="text-sm font-black text-white">{{ c.icono }} {{ c.nombre }}</div>
                  <div *ngIf="c.alerta" class="text-[11px] text-cyan-200">Pertenece a: <b>{{ c.alerta }}</b></div>
                  
                  
                </div>
                <div class="flex gap-1">
                  <span *ngFor="let k of posiciones" class="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center border-2"
                        [ngClass]="k === c.pos ? 'bg-cyan-400 text-slate-950 border-cyan-300' : 'border-slate-600 text-slate-300'">{{ k + 1 }}</span>
                </div>
                <button (click)="tocarControl(c.id)" class="ml-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-3 py-1 rounded-lg text-xs uppercase">↻ Girar</button>
              </div>
            </div>

            <div *ngIf="t.tipo === 'simon' && misFilasSimon.length" class="space-y-3">
              <div class="text-xs text-slate-400">Tu parte. Cuando el capitán diga un código y un color, busca ese código y mira el color que le toca.</div>
              <div *ngFor="let g of simonGruposAyudante; trackBy: trackSimonGrupo" class="bg-slate-950 rounded-2xl border-2 border-slate-700 p-3 space-y-2">
                <div class="text-center text-2xl font-black text-cyan-300 tracking-widest">{{ g.codigo }}</div>
                <div class="grid grid-cols-2 gap-2">
                  <div *ngFor="let f of g.filas" class="flex items-center justify-center gap-2 bg-slate-900 rounded-xl py-2">
                    <div class="flex flex-col items-center"><span class="text-2xl">{{ simonEmoji(f.entrada) }}</span><span class="text-[10px] text-slate-400">{{ f.entrada }}</span></div>
                    <span class="text-slate-400 font-black">→</span>
                    <div class="flex flex-col items-center"><span class="text-2xl">{{ simonEmoji(f.salida) }}</span><span class="text-[10px] font-bold text-white">{{ f.salida }}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="t.tipo === 'simon' && !misFilasSimon.length" class="text-sm text-slate-300">Ahora mismo no tienes filas en la tabla. Espera a que el capitán pida un código.</div>

            <div *ngIf="t.tipo === 'quien' && (misEntradasQVP.pantalla.length || misEntradasQVP.botones.length)" class="space-y-3">
              <div class="text-xs text-slate-400">Tu parte del manual. Cuando el capitán diga una palabra o una etiqueta, respóndele con lo que tengas.</div>
              <div class="bg-slate-950 rounded-xl p-2 border border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                <div class="font-black text-slate-300 uppercase col-span-full">Pantalla → botón a leer</div>
                <div *ngFor="let e of misEntradasQVP.pantalla" class="bg-slate-900 rounded-lg px-2 py-1.5 flex items-center justify-between gap-2"><span class="font-black text-white text-sm truncate">{{ e.palabra }}</span><div class="grid grid-cols-3 gap-[2px] shrink-0"><span *ngFor="let k of [1, 2, 3, 4, 5, 6, 7, 8, 9]" class="w-2.5 h-2.5 rounded-[2px] border" [ngClass]="k === e.pos ? 'bg-cyan-400 border-cyan-200' : 'border-slate-600'"></span></div></div>
              </div>
              <div class="bg-slate-950 rounded-xl p-3 border border-slate-700 space-y-2 text-xs">
                <div class="font-black text-slate-300 uppercase">Etiqueta → orden de pulsado</div>
                <details *ngFor="let e of misEntradasQVP.botones" class="bg-slate-900 rounded-xl px-3 py-2 group"><summary class="flex items-center justify-between cursor-pointer list-none"><span class="font-black text-white">{{ e.etiqueta }}</span><span class="text-[11px] text-slate-400 group-open:hidden">ver orden ▾</span></summary><div class="flex flex-wrap gap-1 mt-2"><span *ngFor="let w of e.lista; let k = index" class="px-2 py-0.5 rounded-md text-[11px]" [ngClass]="k === 0 ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'"><span class="text-[9px] text-slate-500 mr-1">{{ k + 1 }}</span>{{ w }}</span></div></details>
              </div>
            </div>

            <div *ngIf="t.tipo === 'grua' && misControlesGrua.length" class="space-y-3">
              <div class="flex items-center gap-3 bg-slate-950 rounded-xl p-3 border border-slate-700">
                <div class="flex flex-col gap-1">
                  <div *ngFor="let nivel of gruaNiveles" class="w-16 h-5 rounded text-[10px] flex items-center justify-center" [ngClass]="gruaAltura === nivel ? 'bg-cyan-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-500'">{{ nivel === 2 ? 'Alto' : nivel === 1 ? 'Medio' : 'Suelo' }}</div>
                </div>
                <div class="text-xs text-slate-200 space-y-1">
                  <div>🏗️ Cable: <b>{{ gruaTextoAltura }}</b></div>
                  <div>📦 Caja: <b>{{ gruaCaja }}</b></div>
                  <div class="text-cyan-200">💡 {{ gruaPista }}</div>
                </div>
              </div>

              <div class="text-xs text-slate-400">Tus controles. Muévelos cuando tu capitán te lo pida.</div>
              <div *ngFor="let c of misControlesGrua; trackBy: trackGrua" class="bg-slate-950 rounded-xl p-3 border border-slate-700">
                <button (click)="accionGrua(c.accion)" class="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-4 py-3 rounded-lg text-sm">{{ c.nombre }}</button>
              </div>
            </div>

            <div *ngIf="t.tipo === 'cocina' && misControlesCocina.length" class="space-y-3">
              <div class="text-xs text-slate-400">Tus controles. Cuando tu capitán te lo pida, echa o ajusta.</div>
              <div *ngFor="let c of misControlesCocina; trackBy: trackCocina" class="bg-slate-900 rounded-2xl p-4 border-2 border-slate-700 flex items-center gap-3 flex-wrap">
                <ng-container *ngIf="esIngrediente(c.id); else fuego">
                  <div class="w-full flex items-center gap-3">
                    <div class="text-4xl">{{ iconoIngrediente(c.nombre) }}</div>
                    <div class="text-base font-black text-white">{{ c.nombre }}</div>
                  </div>
                  <div class="flex gap-2 w-full">
                    <button (click)="accionCocina({ tipo: 'ingrediente', i: c.id, sarten: 0 })" class="flex-1 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black px-3 py-3 rounded-xl text-sm">🍳 Fuego 1</button>
                    <button (click)="accionCocina({ tipo: 'ingrediente', i: c.id, sarten: 1 })" class="flex-1 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black px-3 py-3 rounded-xl text-sm">🍳 Fuego 2</button>
                  </div>
                </ng-container>
                <ng-template #fuego>
                  <div class="flex-1">
                    <div class="text-base font-black text-white">🍳 {{ c.nombre }}</div>
                    <div class="flex flex-wrap gap-1 mt-2">
                      <span *ngFor="let k of llamaSlots" class="w-5 h-5 rounded-full border-2" [ngClass]="k < nivelDe(c.id) ? 'bg-orange-500 border-orange-300' : 'bg-slate-950 border-slate-700'"></span>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button (click)="accionCocina({ tipo: 'fuego', f: indiceFuego(c.id), delta: -1 })" class="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-black text-xl">−</button>
                    <button (click)="accionCocina({ tipo: 'fuego', f: indiceFuego(c.id), delta: 1 })" class="w-12 h-12 rounded-full bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xl">+</button>
                  </div>
                </ng-template>
              </div>
            </div>

            <div *ngIf="t.tipo === 'barco' && misRemos.length" class="space-y-3">
              <div class="text-xs text-slate-400">Tu remo. Rema cuando tu capitán te lo pida.</div>
              <div *ngFor="let r of misRemos; trackBy: trackRemo" class="w-full max-w-sm mx-auto">
                <button (click)="remar(r.lado)" class="group w-full flex items-center justify-center gap-4 py-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.35)] active:scale-95 transition hover:brightness-110"><span class="flex items-center justify-center w-12 h-12 rounded-full bg-slate-950/25 text-3xl font-black">{{ flechaRemo(r.lado) }}</span><span class="text-base font-black">{{ r.texto }}</span></button>
              </div>
            </div>

            <div *ngIf="t.tipo === 'semaforo' && misAproximaciones.length" class="space-y-3">
              <div class="text-xs text-slate-400">Tu semáforo. Cámbialo cuando tu capitán te lo pida.</div>
              <div *ngFor="let a of misAproximaciones; trackBy: trackIdx" class="bg-slate-950 rounded-xl p-3 border border-slate-700 flex items-center gap-3">
                <span class="w-6 h-6 rounded-full" [ngClass]="colorLuz(semaforoLuces[a])"></span>
                <button (click)="cambiarSemaforo(a)" class="ml-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-3 py-2 rounded-lg text-sm">Cambiar luz</button>
              </div>
            </div>

            <div *ngIf="t.tipo === 'puntero' && misRolesPuntero.length" class="space-y-3">
              <div class="text-xs text-slate-400">Tu control. Mueve solo cuando tu capitán te lo pida.</div>
              <div *ngFor="let r of misRolesPuntero; trackBy: trackRolId" class="bg-slate-950 rounded-xl p-3 border border-slate-700 space-y-2">
                
                
                <div class="flex flex-wrap gap-2">
                  <button *ngFor="let b of r.botones" (click)="pulsarPuntero(b.mov)" class="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-3 py-2 rounded-lg text-sm">{{ b.texto }}</button>
                </div>
              </div>
            </div>

            <div *ngIf="t.tipo === 'fraude' && !reglasFraude.length" class="text-sm text-white whitespace-pre-line">{{ miPista || 'No tienes normas en este tramo.' }}</div>

            <!-- Símbolos de la secuencia: tarjetas con su valor -->
            <div *ngIf="t.tipo === 'secuencia'" class="space-y-3">
              <div class="text-xs text-slate-400">Cuando el capitán pida un símbolo, dile su valor.</div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div *ngFor="let s of simbolosMios" class="flex items-center gap-3 bg-slate-950 rounded-xl p-2 border border-slate-700">
                  <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center text-xl text-white" style="font-variant-emoji: text">{{ s.g }}</div>
                  <div class="flex-1 text-right">
                    <div class="text-[10px] uppercase text-slate-500">vale</div>
                    <div class="text-xl font-black text-cyan-300">{{ s.valor }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pista de texto para el resto de minijuegos -->
            <div *ngIf="t.tipo !== 'mapa' && t.tipo !== 'metro' && t.tipo !== 'pinta' && t.tipo !== 'deslizante' && t.tipo !== 'fraude' && t.tipo !== 'reactor' && t.tipo !== 'puntero' && t.tipo !== 'semaforo' && t.tipo !== 'barco' && t.tipo !== 'cocina' && t.tipo !== 'grua' && t.tipo !== 'quien' && t.tipo !== 'simon' && t.tipo !== 'secuencia'" class="text-sm text-white whitespace-pre-line">{{ miPista }}</div>
            <div class="text-xs text-slate-500">Dásela a tu capitán. Solo él ve el panel y responde.</div>
          </div>
        </ng-container>

        <div *ngIf="!enEquipoActivo && miEquipoId" class="text-center text-sm text-slate-400">
          👀 Observas el turno del otro equipo. Después te toca a ti, con otra versión de este minijuego.
        </div>

        <div *ngIf="error" class="p-2 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs text-center">⚠️ {{ error }}</div>
      </ng-container>

      <!-- Marcador -->
      <div *ngIf="est && est.fase !== 'esperando'" class="bg-slate-900 p-3 rounded-2xl border border-slate-700">
        <div class="text-xs uppercase text-slate-400 tracking-wider mb-2">Marcador (rondas ganadas)</div>
        <div class="grid grid-cols-2 gap-2 text-center">
          <div *ngFor="let eq of equipos" class="bg-slate-800 rounded-lg p-2">
            <div class="text-xs text-slate-300">{{ eq.nombre }}</div>
            <div class="text-xl font-black text-yellow-300">{{ est.puntos[eq.id] || 0 }}</div>
            <div class="text-[11px] text-slate-400">Aciertos totales: {{ est.aciertosTotales[eq.id] || 0 }}</div>
          </div>
        </div>
      </div>

      <!-- Final -->
      <div *ngIf="est && est.fase === 'terminado'" class="bg-slate-900 p-5 rounded-2xl border-2 border-yellow-400 text-center space-y-2">
        <div class="text-xs uppercase text-slate-400">Partida terminada</div>
        <div class="text-xl font-black text-yellow-300">
          {{ est.ganadorEquipoId ? '🏆 Gana ' + nombreEquipo(est.ganadorEquipoId) : '🤝 Empate' }}
        </div>
      </div>

      <div *ngIf="isAdmin && est && est.fase !== 'esperando'" class="text-center">
        <button (click)="reiniciar()"
                class="bg-orange-500 hover:bg-orange-400 text-slate-950 font-black px-4 py-2 rounded-xl uppercase text-xs tracking-wide">
          🔄 Reiniciar minijuegos
        </button>
      </div>
    </div>
  `
})
export class MinijuegosEquiposComponent implements OnInit, OnDestroy {
  @Input() sala: Sala | null = null;
  @Input() currentName: string | null = null;
  @Input() isAdmin = false;

  readonly nombreMinijuego = NOMBRE_MINIJUEGO;
  respuesta = '';
  error: string | null = null;
  ahora = Date.now();
  readonly todosLosJuegos = TIPOS_MINIJUEGO;
  juegosAbiertos = false;
  juegosMarcados: Record<string, boolean> = Object.fromEntries(TIPOS_MINIJUEGO.map(t => [t, true]));

/** Marca todos los juegos, o los desmarca si ya estaban todos marcados. */
  toggleTodosJuegos(): void {
    const todosMarcados = this.juegosMarcadosCount === this.todosLosJuegos.length;
    for (const j of this.todosLosJuegos) this.juegosMarcados[j] = !todosMarcados;
  }

  get juegosMarcadosCount(): number {
    return TIPOS_MINIJUEGO.filter(t => this.juegosMarcados[t]).length;
  }
  capitanBorrador: Record<string, string> = {};
  segundosBorrador = SEG_TURNO_DEFAULT;
  /** Si los ayudantes del mapa ven la S y la G (lo decide el admin al empezar). */
  mostrarMetaBorrador = true;

  /** Camino que va marcando el capitán con las flechas (solo mapa). */
  recorrido: string[] = [];
  private claveTurno = '';
  private timer: any = null;

  constructor(private salaService: SalaService) {}

  ngOnInit(): void {
    this.timer = setInterval(() => {
      this.ahora = Date.now();
      this.controlarTurno();
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  get est(): EstadoMinijuegos | null {
    return this.sala?.estadoMinijuegos ?? null;
  }

  get equipos() {
    return (this.sala?.equipos || []).filter(eq => this.miembros(eq.id).length > 0);
  }

  get miEquipoId(): string | null {
    return (this.sala?.jugadores || []).find(j => j.nombre === this.currentName)?.equipoId ?? null;
  }

  get esCapitan(): boolean {
    const t = this.est?.turno;
    return !!t && this.est!.capitanes[t.equipoId] === this.currentName;
  }

  get enEquipoActivo(): boolean {
    const t = this.est?.turno;
    return !!t && this.miEquipoId === t.equipoId;
  }

  get segundosRestantes(): number {
    const t = this.est?.turno;
    if (!t) return 0;
    return Math.max(0, Math.ceil((t.finMs - this.ahora) / 1000));
  }

  get soloCapitan(): boolean {
    const t = this.est?.turno;
    return !!t && this.esCapitan && this.ayudantes(t.equipoId).length === 0;
  }

  /** Pista que ve este jugador. En el fraude, solo las normas vigentes en cada momento. */
  get miPista(): string {
    const base = this.miPistaBase;
    if (this.est?.turno?.tipo !== 'fraude') return base;
    const norma = this.cambioNormaActivo ? 'B' : 'A';
    return base.split('\n').filter(l => { try { return JSON.parse(l).n === norma; } catch { return true; } }).join('\n');
  }

  /** Normas del fraude que ve este ayudante, ya parseadas (solo las vigentes). */
  get reglasFraude(): any[] {
    return this.miPista.split('\n').map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(r => !!r);
  }

  /** Posiciones posibles de un control del reactor. */
  readonly posiciones = [0, 1, 2];

  /** Dueño del reactor (ayudante) de este jugador: su posición entre los ayudantes, o -1. */
  get miOwner(): number {
    const t = this.est?.turno;
    if (!t) return -1;
    const ayudantes = this.ayudantes(t.equipoId);
    const i = ayudantes.indexOf(this.currentName || '');
    if (i >= 0) return i;
    return this.esCapitan && ayudantes.length === 0 ? 0 : -1;
  }

  get controlesMios(): any[] {
    const owner = this.miOwner;
    return (this.estadoJuego?.controles || []).filter((c: any) => c.owner === owner);
  }

  get pistasReactorMias(): any[] {
    return this.miPistaBase.split('\n').map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(p => !!p);
  }

  /** Presión del turno: tiempo que queda sobre el total. */
  get presionPct(): number {
    const t = this.est?.turno;
    if (!t || !t.inicioMs || !t.finMs) return 100;
    const total = t.finMs - t.inicioMs;
    if (total <= 0) return 100;
    return Math.max(0, Math.min(100, ((t.finMs - this.ahora) / total) * 100));
  }

  /** Alertas del reactor con su estado en este momento. */
  get alertasReactor(): any[] {
    if (this.est?.turno?.tipo !== 'reactor') return [];
    const st = this.estadoJuego;
    const t0 = typeof st?.t0 === 'number' ? st.t0 : null;
    const transcurrido = t0 === null ? 0 : (this.ahora - t0) / 1000;
    return (st?.alertas || []).map((a: any) => ({
      texto: a.texto,
      resuelta: a.resuelta,
      activa: transcurrido >= a.aparecerEn,
      faltan: Math.max(0, Math.ceil(a.aparecerEn - transcurrido)),
      hace: Math.max(0, Math.floor(transcurrido - a.aparecerEn)),
      chuleta: (a.reqs || []).map((r: any) => { const c = (st?.controles || []).find((x: any) => x.id === r.control); return { tipo: c?.tipo, pos: r.pos + 1, ok: c?.pos === r.pos }; }),
      requisito: (() => { const p = PROTOCOLO_REACTOR.find(x => x.tipo === a.tipo); return p ? `${p.icono} ${(a.reqs || []).length} ${p.control}${(a.reqs || []).length > 1 ? 's' : ''} en la posición ${p.pos}` : ''; })(),
      tipo: a.tipo,
      total: (a.reqs || []).length,
      listos: (a.reqs || []).filter((r: any) => (st?.controles || []).find((c: any) => c.id === r.control)?.pos === r.pos).length
    }));
  }

/** Pista que corresponde a un control concreto de este ayudante (qué alerta sirve y en qué posición). */
  pistaDe(c: any): any {
    return this.pistasReactorMias.find(p => p.control === c.id) || null;
  }

/** Todas las pistas que hablan de un control concreto de este ayudante. */
  pistasDe(c: any): any[] {
    return this.pistasReactorMias.filter(p => p.control === c.id);
  }

  /** Una posición está descartada si alguna pista de ese control dice que NO está ahí. */
  excluidaDe(c: any, k: number): boolean {
    return this.pistasDe(c).some(p => p.excluye === k + 1);
  }

/** Protocolo de seguridad (visible para todos). */
  get protocolo(): any[] {
    return PROTOCOLO_REACTOR;
  }

  async tocarControl(id: string): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionControlMinijuego(this.sala.codigo, this.currentName, id);
    if (!ok) this.error = 'No se pudo girar el control.';
  }

  /** Diana del puntero láser: tablero, cursor y potencia. */
  readonly punteroRoles = [
    { id: 0, nombre: '◀ Izquierda', botones: [{ mov: 'izq', texto: '◀ Izquierda' }] },
    { id: 1, nombre: 'Derecha ▶', botones: [{ mov: 'der', texto: 'Derecha ▶' }] },
    { id: 2, nombre: '▲ Arriba', botones: [{ mov: 'arriba', texto: '▲ Arriba' }] },
    { id: 3, nombre: '▼ Abajo', botones: [{ mov: 'abajo', texto: '▼ Abajo' }] }
  ];

  get punteroN(): number {
    return this.estadoJuego?.n ?? 5;
  }

  get punteroDentro(): boolean {
    const s = this.estadoJuego;
    return !!s && s.cursor?.x === s.target?.x && s.cursor?.y === s.target?.y;
  }

/** Casillas del tablero: muros, minas, salida, diana y cursor. */
  get punteroCeldas(): { icono: string; clase: string }[] {
    const s = this.estadoJuego;
    const N = this.punteroN;
    const celdas: { icono: string; clase: string }[] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const muro = !!s?.muros?.[y]?.[x];
        const mina = (s?.minas || []).some((m: any) => m.x === x && m.y === y);
        const diana = s?.target?.x === x && s?.target?.y === y;
        const cursor = s?.cursor?.x === x && s?.cursor?.y === y;
        const salida = s?.inicio?.x === x && s?.inicio?.y === y;
        let icono = '';
        if (cursor) icono = '🔴';
        else if (diana) icono = '🎯';
        else if (mina) icono = '💣';
        else if (salida) icono = '🏁';
        const clase = muro ? 'bg-slate-950 border-slate-800' : (diana ? 'bg-emerald-900/60 border-emerald-500' : 'bg-slate-800 border-slate-700');
        celdas.push({ icono, clase });
      }
    }
    return celdas;
  }

  get punteroAviso(): string {
    const a = this.estadoJuego?.aviso;
    return a === 'mina' ? '💥 ¡Mina! Vuelta a la salida' : a === 'muro' ? '🧱 Muro: el cursor se para' : '';
  }

  get punteroCeldasAntiguo(): { icono: string; clase: string }[] {
    const s = this.estadoJuego;
    const N = this.punteroN;
    const celdas: { icono: string; clase: string }[] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const esDiana = s?.target?.x === x && s?.target?.y === y;
        const esCursor = s?.cursor?.x === x && s?.cursor?.y === y;
        celdas.push({
          icono: esCursor ? '🔴' : (esDiana ? '🎯' : ''),
          clase: esDiana ? 'bg-emerald-900/60 border-emerald-500' : 'bg-slate-800 border-slate-700'
        });
      }
    }
    return celdas;
  }

  /** Lista de quién tiene cada control ahora mismo (lo ve todo el equipo). */
  get punteroTitulares(): { rol: string; nombre: string }[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s) return [];
    const duenos = this.duenosPuntero(t.equipoId);
    return this.punteroRoles.map(r => ({ rol: r.nombre, nombre: duenos[((s.rot || 0) + r.id) % duenos.length] || '—' }));
  }

  /** Controles que tiene este jugador ahora mismo. */
  get misRolesPuntero(): any[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'puntero') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    const yo = duenos.indexOf(this.currentName || '');
    if (yo < 0) return [];
    return this.punteroRoles
      .filter(r => ((s.rot || 0) + r.id) % duenos.length === yo);
  }

  private duenosPuntero(equipoId: string): string[] {
    const ayudantes = this.ayudantes(equipoId);
    return ayudantes.length ? ayudantes : [this.est?.capitanes?.[equipoId] || ''];
  }

  trackRolId(_: number, r: any): number {
    return r.id;
  }

  async pulsarPuntero(mov: string): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionPunteroMinijuego(this.sala.codigo, this.currentName, mov);
    if (!ok) this.error = 'Ese control no es tuyo ahora.';
  }

/** Simón dice: código, destellos y tabla propia de cada persona. */
  readonly simonColores = ['Rojo', 'Azul', 'Verde', 'Amarillo'];

  get simonCodigo(): string {
    return this.estadoJuego?.codigo ?? '';
  }

  get simonSecuencia(): any[] {
    const s = this.estadoJuego;
    // Compatibilidad: partidas en curso con destellos antiguos (solo color)
    return (s?.secuencia ?? []).map((x: any) => (typeof x === 'string' ? { color: x, codigo: s?.codigo ?? '' } : x));
  }

  get simonResueltos(): number {
    return this.estadoJuego?.resueltos ?? 0;
  }

  /** Texto del paso actual de la cadena para el capitán. */
  get simonPasoTexto(): string {
    const r = this.simonResueltos;
    const p = this.simonPulsadas;
    if (r === 0) return 'Responde el destello 1';
    return `Paso ${p + 1} de ${r + 1}: responde el destello ${p + 1}${p === r ? ' (nuevo)' : ''}`;
  }

  get simonPulsadas(): number {
    return this.estadoJuego?.pulsadas ?? 0;
  }

  simonEmoji(c: string): string {
    const mapa: Record<string, string> = { Rojo: '🔴', Azul: '🔵', Verde: '🟢', Amarillo: '🟡' };
    return mapa[c] ?? '⚪';
  }

  simonClaseBoton(c: string): string {
    return c === 'Rojo' ? 'bg-rose-400 border-rose-300' : c === 'Azul' ? 'bg-sky-400 border-sky-300' : c === 'Verde' ? 'bg-emerald-400 border-emerald-300' : 'bg-amber-300 border-amber-200';
  }

  /** Filas de la tabla que tiene este jugador (cada fila pertenece a una sola persona). */
  get misFilasSimon(): any[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'simon') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    const yo = duenos.indexOf(this.currentName || '');
    if (yo < 0) return [];
    const n = duenos.length;
    return (s.filas || []).filter((_: any, k: number) => ((s.rot || 0) + k) % n === yo);
  }

  /** Filas del jugador agrupadas por código (en orden) y ordenadas por color dentro de cada grupo. */
  get simonGruposAyudante(): { codigo: string; filas: any[] }[] {
    const orden = this.simonColores;
    const grupos = new Map<string, any[]>();
    for (const f of this.misFilasSimon) {
      if (!grupos.has(f.codigo)) grupos.set(f.codigo, []);
      grupos.get(f.codigo)!.push(f);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([codigo, filas]) => ({ codigo, filas: [...filas].sort((x, y) => orden.indexOf(x.entrada) - orden.indexOf(y.entrada)) }));
  }

  trackSimonGrupo(_: number, g: any): string {
    return g.codigo;
  }

  /** Cuñas del aparato de Simón (cuatro cuartos del círculo). */
  readonly simonCunas = [
    { color: 'Rojo', d: 'M100,100 L100,5 A95,95 0 0 0 5,100 Z', lx: 52, ly: 52 },
    { color: 'Azul', d: 'M100,100 L195,100 A95,95 0 0 0 100,5 Z', lx: 148, ly: 52 },
    { color: 'Verde', d: 'M100,100 L5,100 A95,95 0 0 0 100,195 Z', lx: 52, ly: 148 },
    { color: 'Amarillo', d: 'M100,100 L100,195 A95,95 0 0 0 195,100 Z', lx: 148, ly: 148 }
  ];

  /** Color que se está iluminando ahora mismo (tras pulsar). */
  simonIluminado: string | null = null;

  /** Fallo reciente de Simón: se muestra un momento para que todos lo vean. */
  private simonFalloVisto = 0;
  simonFalloActivo = false;
  simonColorFallo: string | null = null;
  qvpBotonFallo: number | null = null;
  qvpExitoActivo = false;
  cocinaFalloI: number | null = null;
  cocinaFalloS: number | null = null;
  private qvpExitoVisto = 0;

  /** Detecta un fallo nuevo del módulo Simón (de los últimos 2 segundos) y lo muestra 1,5 s. */
  ngDoCheck(): void {
    // Acierto nuevo de Quién va primero: pantalla en verde un segundo
    const ex = this.estadoJuego?.exito;
    if (ex?.t && ex.t !== this.qvpExitoVisto && Date.now() - ex.t < 2000) {
      this.qvpExitoVisto = ex.t;
      this.qvpExitoActivo = true;
      setTimeout(() => (this.qvpExitoActivo = false), 1000);
    }
    const f = this.estadoJuego?.fallo;
    if (f?.t && f.t !== this.simonFalloVisto && Date.now() - f.t < 2000) {
      this.simonFalloVisto = f.t;
      this.simonFalloActivo = true;
      this.simonColorFallo = f.color ?? null;
      this.qvpBotonFallo = f.boton ?? null;
      this.cocinaFalloI = f.i ?? null;
      this.cocinaFalloS = f.sarten ?? null;
      setTimeout(() => {
        this.simonFalloActivo = false;
        this.simonColorFallo = null;
        this.qvpBotonFallo = null;
        this.cocinaFalloI = null;
        this.cocinaFalloS = null;
      }, 1500);
    }
  }

  simonRelleno(c: string): string {
    const base: Record<string, string> = { Rojo: '#e11d48', Azul: '#0284c7', Verde: '#059669', Amarillo: '#ca8a04' };
    const vivo: Record<string, string> = { Rojo: '#fda4af', Azul: '#7dd3fc', Verde: '#6ee7b7', Amarillo: '#fde047' };
    if (this.simonColorFallo === c) return '#ef4444';
    return this.simonIluminado === c ? vivo[c] : base[c];
  }

  /** Color de fondo y brillo de cada destello. */
  simonFondoColor(c: string): string {
    return c === 'Rojo' ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.7)]'
      : c === 'Azul' ? 'bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.7)]'
      : c === 'Verde' ? 'bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.7)]'
      : 'bg-amber-300 shadow-[0_0_20px_rgba(252,211,77,0.7)]';
  }

  get simonProgreso(): number {
    const total = this.simonSecuencia.length || 1;
    return Math.round((this.simonResueltos / total) * 100);
  }

  async pulsarSimon(color: string): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    this.simonIluminado = color;
    setTimeout(() => (this.simonIluminado = null), 300);
    const ok = await this.salaService.accionSimonMinijuego(this.sala.codigo, this.currentName, color);
    if (!ok) this.error = 'Solo el capitán puede pulsar.';
  }

/** Quién va primero: etapa actual, pantalla y parte del manual que tiene cada persona. */
  get qvpEtapa(): any {
    const s = this.estadoJuego;
    return s?.etapa ?? null;
  }

  get qvpTotal(): number {
    return this.estadoJuego?.etapas?.length ?? 0;
  }

  get qvpActual(): number {
    return (this.estadoJuego?.etapa ?? 0) + 1;
  }

  /** Cada entrada del manual pertenece a una sola persona (sin repetir). */
  get misEntradasQVP(): { pantalla: any[]; botones: any[] } {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    const vacio = { pantalla: [], botones: [] };
    if (!t || !s || t.tipo !== 'quien') return vacio;
    const duenos = this.duenosPuntero(t.equipoId);
    const yo = duenos.indexOf(this.currentName || '');
    if (yo < 0) return vacio;
    const n = duenos.length;
    return {
      pantalla: (s.manual1 || []).filter((_: any, i: number) => ((s.rot || 0) + i) % n === yo),
      botones: (s.manual2 || []).filter((_: any, i: number) => ((s.rot || 0) + i) % n === yo)
    };
  }

  async pulsarQVP(boton: number): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionQuienVaPrimeroMinijuego(this.sala.codigo, this.currentName, boton);
    if (!ok) this.error = 'Solo el capitán puede pulsar.';
  }

  /** Grúa: controles, tablero y estado. */
  readonly gruaControles = [
    { accion: 'izq', nombre: '◀ Izquierda' },
    { accion: 'der', nombre: 'Derecha ▶' },
    { accion: 'adel', nombre: '▲ Adelante' },
    { accion: 'atras', nombre: '▼ Atrás' },
    { accion: 'subir', nombre: '⬆ Subir cable' },
    { accion: 'bajar', nombre: '⬇ Bajar cable' },
    { accion: 'pinza', nombre: '🤏 Agarrar / soltar' }
  ];

  get gruaW(): number {
    return this.estadoJuego?.W ?? 5;
  }

  get gruaH(): number {
    return this.estadoJuego?.H ?? 5;
  }

  get gruaAltura(): number {
    return this.estadoJuego?.z ?? 0;
  }

  /** Niveles del cable, de arriba abajo. */
  readonly gruaNiveles = [2, 1, 0];

  get gruaTextoAltura(): string {
    return this.gruaAltura === 2 ? 'Alto' : this.gruaAltura === 1 ? 'Medio' : 'Suelo';
  }

  /** Qué toca hacer ahora mismo, según el estado de la grúa. */
  get gruaPista(): string {
    const s = this.estadoJuego;
    if (!s) return '';
    if (s.pinza) {
      return s.z > 0
        ? 'Llevas la caja colgando. Baja el cable hasta el suelo para poder soltarla.'
        : 'Llevas la caja. Llévala a la zona 🎯 y suelta la pinza con el cable abajo.';
    }
    return s.z > 0
      ? 'Pinza libre y cable arriba. Para agarrar la caja: mueve el gancho encima de ella y baja el cable.'
      : 'Pinza libre y cable abajo. Mueve el gancho encima de la caja y agarra.';
  }

  get gruaCaja(): string {
    return this.estadoJuego?.pinza ? 'agarrada' : 'en el suelo';
  }

  get gruaCeldas(): { icono: string; clase: string }[] {
    const s = this.estadoJuego;
    const celdas: { icono: string; clase: string }[] = [];
    for (let y = 0; y < this.gruaH; y++) {
      for (let x = 0; x < this.gruaW; x++) {
        const gancho = s?.x === x && s?.y === y;
        const caja = s?.bx === x && s?.by === y;
        const destino = s?.tx === x && s?.ty === y;
        const edificio = (s?.edificios || []).some((b: any) => b.x === x && b.y === y);
        let icono = '';
        if (gancho) icono = s?.pinza ? '📦' : '🏗️';
        else if (caja) icono = '📦';
        else if (destino) icono = '🎯';
        else if (edificio) icono = '🏢';
        const clase = edificio ? 'bg-slate-700 border-slate-500' : (destino ? 'bg-emerald-900/60 border-emerald-500' : 'bg-slate-800 border-slate-700');
        celdas.push({ icono, clase });
      }
    }
    return celdas;
  }

  /** Quién tiene cada control ahora mismo (lo ve todo el equipo). */
  get gruaTitulares(): { nombre: string; persona: string }[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'grua') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    return this.gruaControles.map((c, i) => ({ nombre: c.nombre, persona: duenos[((s.rot || 0) + i) % duenos.length] || '—' }));
  }

  /** Controles que tiene este jugador ahora mismo. */
  get misControlesGrua(): { accion: string; nombre: string }[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'grua') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    const yo = duenos.indexOf(this.currentName || '');
    if (yo < 0) return [];
    return this.gruaControles.filter((c, i) => ((s.rot || 0) + i) % duenos.length === yo);
  }

  trackGrua(_: number, c: any): string {
    return c.accion;
  }

  async accionGrua(accion: string): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionGruaMinijuego(this.sala.codigo, this.currentName, accion);
    if (!ok) this.error = 'Ese control no es tuyo ahora.';
  }

  /** Cocina: ingredientes y fuegos. */
  readonly cocinaFuegosIdx = [0, 1];

  get cocinaIngredientes(): string[] {
    return this.estadoJuego?.ingredientes || [];
  }

  get cocinaObjetivos(): number[] {
    return this.estadoJuego?.objetivos || [0, 0];
  }

  get cocinaFuegos(): number[] {
    return this.estadoJuego?.fuegos || [0, 0];
  }

  /** Niveles de llama de un fuego (3 posiciones). */
  readonly llamaSlots = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  readonly cocinaIconos: Record<string, string> = { Tomate: '🍅', Cebolla: '🧅', Zanahoria: '🥕', Huevo: '🥚', Arroz: '🍚', Queso: '🧀' };

  iconoIngrediente(nombre: string): string {
    return this.cocinaIconos[nombre] || '🥄';
  }

  objetivoDe(id: number): number {
    return this.cocinaObjetivos[this.indiceFuego(id)] ?? 0;
  }

  /** Cada sartén con su nivel, su objetivo y los ingredientes que van dentro, en orden. */
  get cocinaSartenesVista(): any[] {
    return [0, 1].map(p => ({
      idx: p,
      nivel: this.cocinaFuegos[p] ?? 0,
      objetivo: this.cocinaObjetivos[p] ?? 0,
      ingredientes: this.cocinaIngredientes
        .map((nombre, i) => ({ nombre, icono: this.iconoIngrediente(nombre), orden: i + 1, anadido: i < this.cocinaAnadidos, i }))
        .filter(x => this.cocinaSartenes[x.i] === p)
    }));
  }

  /** Orden de la receta con la sartén de cada ingrediente. */
  get cocinaOrdenVista(): any[] {
    return this.cocinaIngredientes.map((nombre, i) => ({
      nombre,
      icono: this.iconoIngrediente(nombre),
      orden: i + 1,
      sarten: this.cocinaSartenes[i] ?? 0,
      anadido: i < this.cocinaAnadidos
    }));
  }

  trackOrden(_: number, o: any): number {
    return o.orden;
  }

  trackPan(_: number, p: any): number {
    return p.idx;
  }

  get cocinaSartenes(): number[] {
    return this.estadoJuego?.sartenes || [];
  }

  get cocinaAnadidos(): number {
    return this.estadoJuego?.anadidos ?? 0;
  }

  /** Todos los controles de la cocina: primero los ingredientes, después los fuegos. */
  get cocinaControles(): { id: number; nombre: string }[] {
    const ings = this.cocinaIngredientes.map((nombre, i) => ({ id: i, nombre }));
    const fuegos = this.cocinaFuegosIdx.map(f => ({ id: this.cocinaIngredientes.length + f, nombre: `Fuego ${f + 1}` }));
    return [...ings, ...fuegos];
  }

  /** Quién tiene cada control ahora mismo (lo ve todo el equipo). */
  get cocinaTitulares(): { nombre: string; persona: string }[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'cocina') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    return this.cocinaControles.map(c => ({ nombre: c.nombre, persona: duenos[((s.rot || 0) + c.id) % duenos.length] || '—' }));
  }

  /** Controles que tiene este jugador ahora mismo. */
  get misControlesCocina(): { id: number; nombre: string }[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'cocina') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    const yo = duenos.indexOf(this.currentName || '');
    if (yo < 0) return [];
    return this.cocinaControles.filter(c => ((s.rot || 0) + c.id) % duenos.length === yo);
  }

  esIngrediente(id: number): boolean {
    return id < this.cocinaIngredientes.length;
  }

  indiceFuego(id: number): number {
    return id - this.cocinaIngredientes.length;
  }

  nivelDe(id: number): number {
    return this.cocinaFuegos[this.indiceFuego(id)] ?? 0;
  }

  trackCocina(_: number, c: any): number {
    return c.id;
  }

  async accionCocina(accion: any): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionCocinaMinijuego(this.sala.codigo, this.currentName, accion);
    if (!ok) this.error = 'No se pudo hacer esa acción.';
  }

  /** Canal del barco: ancho, filas y rocas. */
  get barcoW(): number {
    return this.estadoJuego?.W ?? 5;
  }

  get barcoH(): number {
    return this.estadoJuego?.H ?? 5;
  }

  get barcoBloqueos(): number {
    return this.estadoJuego?.bloqueos ?? 0;
  }

  get barcoProgreso(): number {
    const y = this.estadoJuego?.barco?.y ?? 0;
    return Math.round((y / Math.max(1, this.barcoH - 1)) * 100);
  }

  get barcoCeldas(): { icono: string; clase: string }[] {
    const s = this.estadoJuego;
    const W = this.barcoW;
    const H = this.barcoH;
    const celdas: { icono: string; clase: string }[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const barco = s?.barco?.x === x && s?.barco?.y === y;
        const roca = (s?.rocas || []).some((r: any) => r.x === x && r.y === y);
        const puerto = y === H - 1;
        let icono = '';
        if (barco) icono = '🚤';
        else if (roca) icono = '';
        else if (puerto) icono = '⚓';
        const g = s?.golpe;
        const golpeRoca = g?.tipo === 'roca' && g.x === x && g.y === y;
        const golpeOrilla = g?.tipo === 'orilla' && ((g.lado === 'izquierda' && x === 0) || (g.lado === 'derecha' && x === W - 1) || (g.lado === 'arriba' && y === 0) || (g.lado === 'abajo' && y === H - 1));
        if (golpeRoca) icono = '💥';
        let clase = roca ? 'bg-gradient-to-br from-slate-500 via-slate-600 to-slate-800 border-slate-400/50 rounded-[42%_38%_46%_40%] shadow-[inset_-4px_-6px_10px_rgba(0,0,0,0.55),inset_3px_3px_6px_rgba(255,255,255,0.14)]' : 'bg-gradient-to-br from-sky-900/80 to-slate-900 border-sky-800/70 rounded-xl';
        if (golpeRoca) clase = 'bg-rose-900/70 border-rose-500 rounded-xl animate-pulse';
        if (golpeOrilla) clase = 'bg-rose-900/50 border-rose-500 rounded-xl animate-pulse';
        celdas.push({ icono, clase });
      }
    }
    return celdas;
  }

  /** Aviso del último golpe del barco. */
  get barcoAviso(): string {
    const g = this.estadoJuego?.golpe;
    return g?.tipo === 'roca' ? '💥 ¡Roca! -5 s' : g?.tipo === 'orilla' ? '🧱 Orilla: el barco se frena' : '';
  }

  readonly barcoRemos = [
    { lado: 'derecha', nombre: 'Derecha', texto: 'Derecha' },
    { lado: 'izquierda', nombre: 'Izquierda', texto: 'Izquierda' },
    { lado: 'izquierda_atras', nombre: 'Izquierda atrás', texto: 'Izquierda atrás' },
    { lado: 'derecha_atras', nombre: 'Derecha atrás', texto: 'Derecha atrás' }
  ];

  /** Quién tiene cada remo ahora mismo (lo ve todo el equipo). */
  get barcoTitulares(): { remo: string; nombre: string }[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'barco') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    return this.barcoRemos.map((r, i) => ({ remo: r.nombre, nombre: duenos[((s.rot || 0) + i) % duenos.length] || '—' }));
  }

  /** Remos que controla este jugador ahora mismo. */
  get misRemos(): { lado: string; texto: string }[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'barco') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    const yo = duenos.indexOf(this.currentName || '');
    if (yo < 0) return [];
    return this.barcoRemos.filter((r, i) => ((s.rot || 0) + i) % duenos.length === yo);
  }

  trackRemo(_: number, r: any): string {
    return r.lado;
  }

  /** Flecha de la dirección en la que avanza el barco con cada remo. */
  flechaRemo(lado: string): string {
    return lado === 'derecha' ? '↘' : lado === 'izquierda' ? '↙' : lado === 'izquierda_atras' ? '↖' : '↗';
  }

  async remar(lado: string): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionBarcoMinijuego(this.sala.codigo, this.currentName, lado);
    if (!ok) this.error = 'Ese remo no es tuyo ahora.';
  }

/** Aproximaciones del cruce, en el mismo orden que el estado (0 Norte, 1 Sur, 2 Este, 3 Oeste). */
  readonly semaforoAprox = ['Norte', 'Sur', 'Este', 'Oeste'];

  get semaforoLuces(): string[] {
    return this.estadoJuego?.luces || [];
  }

  get semaforoColas(): number[] {
    return this.estadoJuego?.colas || [0, 0, 0, 0];
  }

  get semaforoPasados(): number {
    return this.estadoJuego?.pasados ?? 0;
  }

  get semaforoChoques(): number {
    return this.estadoJuego?.choques ?? 0;
  }

  get semaforoTotal(): number {
    return this.est?.turno?.panel?.total ?? 0;
  }

  /** Quién tiene cada semáforo ahora mismo (lo ve todo el equipo). */
  get semaforoTitulares(): { aprox: string; nombre: string }[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'semaforo') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    return this.semaforoAprox.map((aprox, a) => ({ aprox, nombre: duenos[((s.rot || 0) + a) % duenos.length] || '—' }));
  }

  /** Semáforos que controla este jugador ahora mismo. */
  get misAproximaciones(): number[] {
    const t = this.est?.turno;
    const s = this.estadoJuego;
    if (!t || !s || t.tipo !== 'semaforo') return [];
    const duenos = this.duenosPuntero(t.equipoId);
    const yo = duenos.indexOf(this.currentName || '');
    if (yo < 0) return [];
    return [0, 1, 2, 3].filter(a => ((s.rot || 0) + a) % duenos.length === yo);
  }

  colorLuz(l: string | undefined): string {
    return l === 'verde' ? 'bg-emerald-500' : l === 'ambar' ? 'bg-amber-400' : 'bg-rose-500';
  }

  trackIdx(_: number, a: number): number {
    return a;
  }

  async cambiarSemaforo(a: number): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionSemaforoMinijuego(this.sala.codigo, this.currentName, a);
    if (!ok) this.error = 'Ese semáforo no es tuyo ahora.';
  }

  /** Posición donde empieza la normativa B en la cinta (pieza indexada desde 0). */
  get cambioFraude(): number {
    return this.estadoJuego?.cambio ?? -1;
  }

  /** Forma de la pieza como clase visual. */
  formaClase(p: any): string {
    if (p.forma === 'cuadrada') return 'rounded-md';
    if (p.forma === 'redonda') return 'rounded-full';
    return '';
  }

  /** Color de la pieza como clase visual. */
  colorClase(p: any): string {
    switch (p.color) {
      case 'azul': return 'bg-sky-500';
      case 'rojo': return 'bg-rose-500';
      case 'verde': return 'bg-emerald-500';
      default: return 'bg-slate-500';
    }
  }

  get etiquetaNorma(): string {
    const c = this.estadoJuego?.cambio ?? 0;
    return this.cambioNormaActivo ? `📘 Normativa B: piezas ${c + 1} en adelante` : `📗 Normativa A: piezas 1 a ${c}`;
  }

  get piezasFraude(): any[] {
    return this.est?.turno?.panel?.piezas || [];
  }

  get idxFraude(): number {
    return this.estadoJuego?.idx ?? 0;
  }

  get cambioNormaActivo(): boolean {
    return this.est?.turno?.tipo === 'fraude' && (this.estadoJuego?.idx ?? 0) >= (this.estadoJuego?.cambio ?? Infinity);
  }

  get miPistaBase(): string {
    const t = this.est?.turno;
    if (!t) return '';
    const ayudantes = this.ayudantes(t.equipoId);
    if (ayudantes.length === 0) return t.pistas[0] || '';
    const i = ayudantes.indexOf(this.currentName || '');
    return i >= 0 && t.pistas.length ? (t.pistas[i % t.pistas.length] || '') : '';
  }

  /** Tablero que ve el ayudante: el tamaño completo, pero solo se descubren las casillas de sus líneas. */
  get tableroAyudante(): CeldaMapa[] {
    const t = this.est?.turno;
    if (!t || t.tipo !== 'mapa') return [];
    const N: number = t.panel.tamano;
    const verMeta = !!(this.est as any)?.mostrarMetaAyudantes;
    const [ir, ic] = [t.panel.inicio[0] - 1, t.panel.inicio[1] - 1];
    const [gr, gc] = [t.panel.meta[0] - 1, t.panel.meta[1] - 1];
    const conocida = new Map<string, boolean>();
    for (const l of this.lineasMapa) {
      const k = l.indice - 1;
      l.muros.forEach((m, i) => {
        const r = l.eje === 'fila' ? k : i;
        const c = l.eje === 'fila' ? i : k;
        conocida.set(`${r},${c}`, m);
      });
    }
    const celdas: CeldaMapa[] = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const visible = conocida.has(`${r},${c}`);
        let texto = '';
        let clase = 'bg-slate-900 border border-slate-800';
        if (verMeta && r === ir && c === ic) { texto = 'S'; clase = 'bg-cyan-600 text-white'; }
        else if (verMeta && r === gr && c === gc) { texto = 'G'; clase = 'bg-emerald-600 text-white'; }
        else if (visible) clase = conocida.get(`${r},${c}`) ? 'bg-slate-950 border border-slate-700' : 'bg-cyan-200/70';
        celdas.push({ texto, clase });
      }
    }
    return celdas;
  }

  get tableroMapaN(): number {
    return this.est?.turno?.panel?.tamano ?? 4;
  }

  /** Etiqueta de las líneas que le tocan a este ayudante (p. ej. "fila 3"). */
  get etiquetaLineasMapa(): string {
    return this.lineasMapa.map(l => `${l.eje === 'fila' ? 'fila' : 'columna'} ${l.indice}`).join(', ');
  }

  /** Símbolos de la secuencia que ve este ayudante, con su valor (se lee la pista "X vale N."). */
  get simbolosMios(): { g: string; valor: string }[] {
    return this.miPista.split('\n').map(l => {
      const m = /^(.+) vale (\d+)\.$/.exec(l.trim());
      return m ? { g: m[1], valor: m[2] } : null;
    }).filter((x): x is { g: string; valor: string } => !!x);
  }

  /** Líneas del mapa que le tocan a este jugador (ya parseadas). */
  get lineasMapa(): LineaMapa[] {
    return this.miPista.split('\n').map(linea => {
      try {
        return JSON.parse(linea) as LineaMapa;
      } catch {
        return null;
      }
    }).filter((l): l is LineaMapa => !!l);
  }

  /** Piezas del metro para este jugador (líneas dibujadas y hechos). */
  get lineasMetro(): LineaMetro[] {
    return this.miPista.split('\n').map(linea => {
      try {
        return JSON.parse(linea) as LineaMetro;
      } catch {
        return null;
      }
    }).filter((l): l is LineaMetro => !!l);
  }

  colorLinea(color: string | undefined): string {
    switch (color) {
      case 'azul': return 'bg-sky-600';
      case 'rojo': return 'bg-rose-600';
      case 'verde': return 'bg-emerald-600';
      case 'amarillo': return 'bg-amber-400 text-slate-900';
      case 'morado': return 'bg-violet-600';
      case 'naranja': return 'bg-orange-500';
      case 'rosa': return 'bg-pink-500';
      case 'turquesa': return 'bg-teal-500';
      case 'gris': return 'bg-zinc-500';
      default: return 'bg-slate-600';
    }
  }

  /** Corta el cable indicado: el capitán lo toca y se envía la respuesta. */
  cortar(numero: number): void {
    if (!this.esCapitan) return;
    this.respuesta = String(numero);
    this.enviar();
  }

  colorCable(color: string): string {
    switch (color) {
      case 'rojo': return 'bg-rose-500';
      case 'azul': return 'bg-sky-500';
      case 'verde': return 'bg-emerald-500';
      case 'amarillo': return 'bg-amber-300';
      case 'blanco': return 'bg-slate-100';
      case 'negro': return 'bg-slate-900 border border-slate-500';
      case 'naranja': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  }

  // ----- Juegos interactivos: torres, pinta, mezcla, deslizante y balanza -----
  torreSeleccionada: number | null = null;
  private cacheEstadoTxt = '';
  private cacheEstado: any = null;

  esInteractivo(tipo: string): boolean {
    return ['torres', 'pinta', 'mezcla', 'deslizante', 'balanza'].includes(tipo);
  }

  /** Estado actual del juego interactivo (solo se parsea cuando cambia). */
  get estadoJuego(): any {
    const txt = this.est?.turno?.estadoJ;
    if (!txt) return null;
    if (txt !== this.cacheEstadoTxt) {
      this.cacheEstadoTxt = txt;
      this.cacheEstado = JSON.parse(txt);
    }
    return this.cacheEstado;
  }

  /** Filas de la pista visual (pinta y deslizante). */
  get filasPista(): any[] {
    return this.miPista.split('\n').map(linea => {
      try {
        return JSON.parse(linea);
      } catch {
        return null;
      }
    }).filter((f: any) => !!f && f.tipo === 'fila');
  }

  get itemsMesa(): any[] {
    return this.itemsDe('mesa');
  }

  get itemsIzq(): any[] {
    return this.itemsDe('izq');
  }

  get itemsDer(): any[] {
    return this.itemsDe('der');
  }

  private itemsDe(lado: 'mesa' | 'izq' | 'der'): any[] {
    const st = this.estadoJuego;
    const items: any[] = this.est?.turno?.panel?.items || [];
    if (!st) return [];
    return (st[lado] as number[]).map(id => items.find(x => x.id === id)).filter(x => !!x);
  }

  colorPintura(c: string): string {
    switch (c) {
      case 'azul': return 'bg-sky-600';
      case 'rojo': return 'bg-rose-600';
      case 'verde': return 'bg-emerald-600';
      case 'amarillo': return 'bg-amber-300';
      default: return 'bg-slate-800';
    }
  }

  /** Color de la mezcla actual, con la misma fórmula que el generador. */
  colorMezcla(): string {
    const st = this.estadoJuego;
    if (!st) return 'rgb(60,60,70)';
    const total = st.rojo + st.azul + st.amarillo;
    if (total === 0) return 'rgb(60,60,70)';
    const R = [220, 38, 38], A = [37, 99, 235], Y = [250, 204, 21];
    const rgb = [0, 1, 2].map(k => Math.round((st.rojo * R[k] + st.azul * A[k] + st.amarillo * Y[k]) / total));
    return `rgb(${rgb.join(',')})`;
  }

  tocarTorre(i: number): void {
    if (!this.esCapitan) return;
    const st = this.estadoJuego;
    if (!st) return;
    if (this.torreSeleccionada === null) {
      if (st[i].length) this.torreSeleccionada = i;
      return;
    }
    if (this.torreSeleccionada === i) {
      this.torreSeleccionada = null;
      return;
    }
    const de = this.torreSeleccionada;
    this.torreSeleccionada = null;
    this.accion({ de, a: i });
  }

  pintar(r: number, c: number): void {
    if (this.esCapitan) this.accion({ r, c });
  }

  cambiarMezcla(color: string, delta: number): void {
    if (this.esCapitan) this.accion({ color, delta });
  }

  deslizar(indice: number): void {
    if (this.esCapitan) this.accion({ indice });
  }

  cambiarLado(id: number): void {
    if (!this.esCapitan) return;
    const st = this.estadoJuego;
    if (!st) return;
    const lado = st.mesa.includes(id) ? 'izq' : st.izq.includes(id) ? 'der' : 'mesa';
    this.accion({ id, lado });
  }

  private async accion(a: any): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionJuegoMinijuego(this.sala.codigo, this.currentName, a);
    if (!ok) this.error = 'Ese movimiento no es válido.';
  }

  async comprobar(): Promise<void> {
    if (!this.sala || !this.currentName || !this.esCapitan) return;
    this.error = null;
    const antes = this.est?.turno?.errores ?? 0;
    const ok = await this.salaService.comprobarJuegoMinijuego(this.sala.codigo, this.currentName);
    if (!ok) {
      this.error = 'No puedes comprobar ahora.';
      return;
    }
    if ((this.est?.turno?.errores ?? antes) > antes) {
      this.error = 'Todavía no es la solución: se restan 5 segundos.';
    }
  }

  /** Cuadrícula del capitán: S inicio, G meta y el robot siguiendo el camino. */
  get celdasMapa(): CeldaMapa[] {
    const t = this.est?.turno;
    if (!t || t.tipo !== 'mapa') return [];
    const N: number = t.panel.tamano;
    const [ir, ic] = [t.panel.inicio[0] - 1, t.panel.inicio[1] - 1];
    const [gr, gc] = [t.panel.meta[0] - 1, t.panel.meta[1] - 1];
    const golpe = this.mapaGolpe;
    // Casillas por las que ha pasado el robot (el camino marcado)
    const trail = new Set<string>();
    let tr = ir, tc = ic;
    for (const d of (t.recorrido || [])) {
      const [a, b] = this.delta(d);
      tr += a;
      tc += b;
      trail.add(`${tr},${tc}`);
    }
    const [rr, rc] = this.posicionRobot();
    const celdas: CeldaMapa[] = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const esRobot = r === rr && c === rc;
        let texto = esRobot ? '🤖' : (r === ir && c === ic) ? 'S' : (r === gr && c === gc) ? 'G' : '';
        let clase = esRobot ? 'bg-gradient-to-br from-yellow-200 to-amber-400 text-slate-900 border-yellow-100 shadow-[0_0_18px_rgba(250,204,21,0.7)] scale-105 z-10' :
          (r === gr && c === gc) ? 'bg-gradient-to-br from-emerald-400 to-emerald-700 text-white border-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.6)]' :
          (r === ir && c === ic) ? 'bg-gradient-to-br from-cyan-400 to-cyan-700 text-white border-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.5)]' :
          trail.has(`${r},${c}`) ? 'bg-gradient-to-br from-cyan-900/70 to-slate-900 text-cyan-300 border-cyan-700/60' :
          'bg-gradient-to-br from-slate-800 to-slate-900 text-slate-500 border-slate-700/50';
        // Choque reciente: el muro se marca en rojo y el robot muestra los segundos perdidos
        if (golpe && golpe.r === r && golpe.c === c) {
          texto = '💥';
          clase = 'bg-rose-700 text-white ring-2 ring-rose-400 animate-pulse';
        }
        if (esRobot && golpe) {
          texto = '−5 s';
          clase = 'bg-rose-600 text-white text-[10px] font-black animate-pulse';
        }
        celdas.push({ texto, clase });
      }
    }
    return celdas;
  }

  /** Último choque con un muro, mientras sigue siendo reciente (1,5 s). */
  get mapaGolpe(): { r: number; c: number } | null {
    const g = (this.est?.turno as any)?.golpe;
    if (!g || this.ahora - g.t > 1500) return null;
    return { r: g.r, c: g.c };
  }

  /** Posición del robot tras aplicar el camino marcado (sin muros: el equipo vigila eso). */
  posicionRobot(): [number, number] {
    const t = this.est?.turno;
    if (!t) return [0, 0];
    let r = t.panel.inicio[0] - 1;
    let c = t.panel.inicio[1] - 1;
    const N: number = t.panel.tamano;
    for (const d of (t.recorrido || [])) {
      const [dr, dc] = this.delta(d);
      if (r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N) { r += dr; c += dc; }
    }
    return [r, c];
  }

  private delta(d: string): [number, number] {
    return d === 'U' ? [-1, 0] : d === 'D' ? [1, 0] : d === 'L' ? [0, -1] : [0, 1];
  }

  /** Mueve el robot una casilla: el servidor comprueba muros, meta y errores. */
  async mover(d: string): Promise<void> {
    const t = this.est?.turno;
    if (!t || t.tipo !== 'mapa' || !this.esCapitan || !this.sala || !this.currentName) return;
    const antes = t.errores;
    this.error = null;
    await this.salaService.moverMinijuego(this.sala.codigo, this.currentName, d);
  }

  async deshacer(): Promise<void> {
    if (!this.sala || !this.currentName) return;
    await this.salaService.deshacerMinijuego(this.sala.codigo, this.currentName);
  }

  get ayudantesActuales(): string[] {
    return this.ayudantes(this.est?.turno?.equipoId || '');
  }

  /** Miembros del equipo que dan pistas (todos menos el capitán). */
  ayudantes(equipoId: string): string[] {
    const capitan = this.est?.capitanes?.[equipoId];
    return this.miembros(equipoId).filter(n => n !== capitan);
  }

  miembros(equipoId: string): string[] {
    return (this.sala?.jugadores || []).filter(j => j.equipoId === equipoId).map(j => j.nombre);
  }

  nombreEquipo(id: string): string {
    return this.sala?.equipos?.find(e => e.id === id)?.nombre || id;
  }

  esEquipoUno(id: string): boolean {
    return this.est?.equiposOrden?.[0] === id;
  }

  /** Panel visible para el capitán activo y para quien observa; no para el resto del equipo activo. */
  puedeVerPanel(): boolean {
    return this.esCapitan || !this.enEquipoActivo;
  }

  placeholderRespuesta(tipo: string): string {
    switch (tipo) {
      case 'cableado': return 'Número del cable';
      case 'metro': return 'Número de transbordos';
      case 'ecuacion': return 'Resultado';
      case 'carrera': return 'Posición (número)';
      case 'palabra': return 'Escribe la palabra';
      default: return 'Respuesta';
    }
  }

  formatear(segundos: number): string {
    const s = Math.max(0, Math.floor(segundos));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Cada vez que cambia el puzle, se borra el camino que llevaba marcado. */
  private controlarTurno(): void {
    const t = this.est?.turno;
    const clave = t ? `${t.ronda}|${t.nivel}|${t.inicioMs}` : '';
    if (clave !== this.claveTurno) {
      this.claveTurno = clave;
      this.recorrido = [];
    }
    if (this.sala && t && this.ahora >= t.finMs) {
      this.salaService.expirarTurnoMinijuego(this.sala.codigo);
    }
  }

  /** Resumen y ejemplo del minijuego del turno actual. */
  get instruccionActual(): { resumen: string; ejemplo: string } {
    return INSTRUCCIONES[this.est?.turno?.tipo || ''] || { resumen: '', ejemplo: '' };
  }

  /** Empezar lo pulsa el capitán del equipo en turno; el admin también, como respaldo. */
  puedeEmpezar(): boolean {
    const t = this.est?.turno;
    return !!t && !t.iniciado && (this.esCapitan || this.isAdmin);
  }

  /** Decisión del capitán en el fraude: aceptar o rechazar la pieza que está en la cinta. */
  async decidir(d: 'aceptar' | 'rechazar'): Promise<void> {
    if (!this.sala || !this.currentName || !this.esCapitan) return;
    this.error = null;
    const antes = this.est?.turno?.errores ?? 0;
    const ok = await this.salaService.accionJuegoMinijuego(this.sala.codigo, this.currentName, { decision: d });
    if (!ok) {
      this.error = 'No puedes decidir ahora.';
      return;
    }
    if ((this.est?.turno?.errores ?? antes) > antes) this.error = 'Decisión incorrecta: se restan 5 segundos.';
  }

  async empezarTurno(): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.empezarTurnoMinijuego(this.sala.codigo, this.currentName);
    if (!ok) this.error = 'No se pudo empezar el turno.';
  }

  async iniciar(): Promise<void> {
    if (!this.sala) return;
    this.error = null;
    if (!this.equipos.every(eq => !!this.capitanBorrador[eq.id])) {
      this.error = 'Elige un capitán para cada equipo.';
      return;
    }
    const elegidos = TIPOS_MINIJUEGO.filter(t => this.juegosMarcados[t]);
    if (elegidos.length === 0) {
      this.error = 'Marca al menos un juego.';
      return;
    }
    const ok = await this.salaService.iniciarMinijuegos(this.sala.codigo, { ...this.capitanBorrador }, Number(this.segundosBorrador), elegidos, this.mostrarMetaBorrador);
    if (!ok) this.error = 'No se pudo iniciar la partida. Revisa los capitanes.';
  }

  /** Dígitos de la respuesta de Símbolos en secuencia (uno por símbolo). */
  digitosRespuesta: number[] = [];
  digitoActivo = 0;
  falloSecuencia = false;
  /** Teclado numérico para Símbolos en secuencia. Desactivado de momento: se activa cuando haga falta. */
  mostrarTecladoSecuencia = false;

  get digitosSecuencia(): number[] {
    const n = this.est?.turno?.panel?.secuencia?.length ?? 0;
    while (this.digitosRespuesta.length < n) this.digitosRespuesta.push(0);
    if (this.digitosRespuesta.length > n) this.digitosRespuesta.length = n;
    return this.digitosRespuesta;
  }

  ajustarDigito(i: number, delta: number): void {
    const d = this.digitosSecuencia;
    d[i] = (d[i] + delta + 10) % 10;
  }

  tocarDigito(i: number): void {
    this.digitoActivo = i;
  }

  pulsarDigito(n: number): void {
    const d = this.digitosSecuencia;
    if (!d.length) return;
    d[this.digitoActivo] = n;
    this.digitoActivo = Math.min(d.length - 1, this.digitoActivo + 1);
  }

  /** Error visual dentro del panel de respuesta, durante un momento. */
  marcarFalloSecuencia(): void {
    this.falloSecuencia = true;
    setTimeout(() => (this.falloSecuencia = false), 1200);
  }

  async enviarSecuencia(): Promise<void> {
    this.respuesta = this.digitosSecuencia.join('');
    await this.enviar();
    if (!this.falloSecuencia) {
      this.digitosRespuesta = [];
      this.digitoActivo = 0;
    }
  }

  async enviar(): Promise<void> {
    if (!this.sala || !this.currentName) return;
    const t = this.est?.turno;
    const texto = t?.tipo === 'mapa' ? this.recorrido.join('') : this.respuesta;
    if (!texto.trim()) return;
    this.error = null;
    const antes = t?.errores ?? 0;
    const aciertosAntes = t?.aciertos ?? 0;
    const ok = await this.salaService.resolverMinijuego(this.sala.codigo, this.currentName, texto);
    this.respuesta = '';
    this.recorrido = [];
    if (!ok) {
      this.error = 'No puedes responder ahora.';
    } else if ((this.est?.turno?.errores ?? antes) > antes) {
      if (t?.tipo === 'secuencia') this.marcarFalloSecuencia();
      else this.error = 'Respuesta incorrecta: se restan 5 segundos.';
    } else if ((this.est?.turno?.aciertos ?? aciertosAntes) > aciertosAntes) {
      this.error = null;
    }
  }

  async reiniciar(): Promise<void> {
    if (!this.sala || !this.isAdmin) return;
    if (!window.confirm('¿Reiniciar los minijuegos? Se perderán los puntos.')) return;
    await this.salaService.reiniciarMinijuegos(this.sala.codigo);
  }
}
