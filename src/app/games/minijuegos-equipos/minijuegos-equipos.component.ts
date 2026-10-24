import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sala, EstadoMinijuegos } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';
import { NOMBRE_MINIJUEGO, SEG_TURNO_DEFAULT, TIPOS_MINIJUEGO } from './minijuegos.logic';

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
            <div *ngSwitchCase="'secuencia'" class="text-2xl font-black text-center tracking-widest">{{ t.panel.secuencia.join('  ') }}</div>
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
            <div *ngSwitchCase="'mapa'" class="space-y-3">
              <div class="text-xs text-slate-400">
                Llega desde <b>S</b> hasta <b>G</b>. Usa las flechas para marcar el camino. Tu equipo te dirá dónde hay muros.
              </div>
              <div class="grid gap-1 mx-auto" [style.grid-template-columns]="'repeat(' + t.panel.tamano + ', 2.75rem)'">
                <div *ngFor="let c of celdasMapa" class="w-11 h-11 rounded-lg flex items-center justify-center text-sm font-black" [ngClass]="c.clase">
                  {{ c.texto }}
                </div>
              </div>
              <div *ngIf="esCapitan" class="flex flex-col items-center gap-1">
                <button (click)="mover('U')" class="bg-slate-800 hover:bg-slate-700 border border-slate-600 w-12 h-10 rounded-lg text-lg">⬆️</button>
                <div class="flex gap-1">
                  <button (click)="mover('L')" class="bg-slate-800 hover:bg-slate-700 border border-slate-600 w-12 h-10 rounded-lg text-lg">⬅️</button>
                  <button (click)="mover('D')" class="bg-slate-800 hover:bg-slate-700 border border-slate-600 w-12 h-10 rounded-lg text-lg">⬇️</button>
                  <button (click)="mover('R')" class="bg-slate-800 hover:bg-slate-700 border border-slate-600 w-12 h-10 rounded-lg text-lg">➡️</button>
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
                      <div class="text-[11px] text-slate-300">Necesita {{ a.total }} controles · {{ a.listos }}/{{ a.total }} bien</div>
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

        <!-- Equipo activo: el capitán responde, los ayudantes ven su pista -->
        <ng-container *ngIf="enEquipoActivo">
          <div *ngIf="esCapitan && t.tipo !== 'mapa' && t.tipo !== 'cableado' && t.tipo !== 'fraude' && t.tipo !== 'reactor' && !esInteractivo(t.tipo)" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
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
            <div *ngIf="t.tipo === 'mapa'" class="space-y-3">
              <div *ngFor="let l of lineasMapa" class="space-y-1">
                <div class="text-xs text-slate-300">{{ l.eje === 'fila' ? 'Fila' : 'Columna' }} {{ l.indice }}</div>
                <div class="flex gap-1">
                  <div *ngFor="let m of l.muros" class="w-7 h-7 rounded" [ngClass]="m ? 'bg-slate-950 border border-slate-700' : 'bg-cyan-200/70'"></div>
                </div>
              </div>
              <div class="text-[11px] text-slate-500">Oscuro = muro · Claro = paso libre</div>
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
              <div class="text-xs text-slate-400">Tus controles. Gira cada uno hasta la posición que te indique tu pista.</div>
              <div *ngFor="let c of controlesMios" class="flex flex-wrap items-center gap-3 bg-slate-950 rounded-xl px-3 py-2 border border-slate-700">
                <div>
                  <div class="text-sm font-black text-white">{{ c.icono }} {{ c.nombre }}</div>
                  <div *ngIf="pistaDe(c) as p" class="text-[11px] text-slate-300">Sirve para: <b>{{ p.alerta }}</b> · posición objetivo <b>{{ p.pos }}</b></div>
                </div>
                <div class="flex gap-1">
                  <span *ngFor="let k of posiciones" class="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center border-2"
                        [ngClass]="k === c.pos ? 'bg-cyan-400 text-slate-950 border-cyan-300' : (pistaDe(c)?.pos - 1 === k ? 'border-yellow-400 text-yellow-300' : 'border-slate-700 text-slate-500')">{{ k + 1 }}</span>
                </div>
                <button (click)="tocarControl(c.id)" class="ml-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-3 py-1 rounded-lg text-xs uppercase">↻ Girar</button>
              </div>
              <div class="text-xs text-slate-400 pt-1">Tus pistas:</div>
              <div *ngFor="let p of pistasReactorMias" class="text-sm text-slate-200 bg-slate-800 rounded-lg px-3 py-2">
                {{ p.nombre }} → posición <b>{{ p.pos }}</b> para: <b>{{ p.alerta }}</b>
              </div>
            </div>

            <div *ngIf="t.tipo === 'fraude' && !reglasFraude.length" class="text-sm text-white whitespace-pre-line">{{ miPista || 'No tienes normas en este tramo.' }}</div>

            <!-- Pista de texto para el resto de minijuegos -->
            <div *ngIf="t.tipo !== 'mapa' && t.tipo !== 'metro' && t.tipo !== 'pinta' && t.tipo !== 'deslizante' && t.tipo !== 'fraude' && t.tipo !== 'reactor'" class="text-sm text-white whitespace-pre-line">{{ miPista }}</div>
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

  get juegosMarcadosCount(): number {
    return TIPOS_MINIJUEGO.filter(t => this.juegosMarcados[t]).length;
  }
  capitanBorrador: Record<string, string> = {};
  segundosBorrador = SEG_TURNO_DEFAULT;

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
      total: (a.reqs || []).length,
      listos: (a.reqs || []).filter((r: any) => (st?.controles || []).find((c: any) => c.id === r.control)?.pos === r.pos).length
    }));
  }

/** Pista que corresponde a un control concreto de este ayudante (qué alerta sirve y en qué posición). */
  pistaDe(c: any): any {
    return this.pistasReactorMias.find(p => p.control === c.id) || null;
  }

  async tocarControl(id: string): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.accionControlMinijuego(this.sala.codigo, this.currentName, id);
    if (!ok) this.error = 'No se pudo girar el control.';
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
    const [rr, rc] = this.posicionRobot();
    const celdas: CeldaMapa[] = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const esRobot = r === rr && c === rc;
        const texto = esRobot ? '🤖' : (r === ir && c === ic) ? 'S' : (r === gr && c === gc) ? 'G' : '';
        const clase = esRobot ? 'bg-yellow-300 text-slate-900' :
          (r === gr && c === gc) ? 'bg-emerald-600 text-white' :
          (r === ir && c === ic) ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400';
        celdas.push({ texto, clase });
      }
    }
    return celdas;
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
    if ((this.est?.turno?.errores ?? antes) > antes) {
      this.error = 'Choque con un muro: se restan 5 segundos y el robot vuelve a la S.';
    }
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
    const ok = await this.salaService.iniciarMinijuegos(this.sala.codigo, { ...this.capitanBorrador }, Number(this.segundosBorrador), elegidos);
    if (!ok) this.error = 'No se pudo iniciar la partida. Revisa los capitanes.';
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
      this.error = 'Respuesta incorrecta: se restan 5 segundos.';
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
