import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sala, EstadoMinijuegos } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';
import { NOMBRE_MINIJUEGO, SEG_TURNO_DEFAULT, TIPOS_MINIJUEGO } from './minijuegos.logic';

interface LineaMapa { eje: 'fila' | 'columna'; indice: number; muros: boolean[]; }
interface LineaMetro { tipo: 'linea' | 'hecho'; color?: string; estaciones?: string[]; texto?: string; cerrada?: boolean; }
interface CeldaMapa { texto: string; clase: string; }

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
      <ng-container *ngIf="est && est.fase === 'jugando' && est.turno as t">
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

        <!-- Equipo activo: el capitán responde, los ayudantes ven su pista -->
        <ng-container *ngIf="enEquipoActivo">
          <div *ngIf="esCapitan && t.tipo !== 'mapa' && t.tipo !== 'cableado'" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
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

            <!-- Pista de texto para el resto de minijuegos -->
            <div *ngIf="t.tipo !== 'mapa' && t.tipo !== 'metro'" class="text-sm text-white whitespace-pre-line">{{ miPista }}</div>
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

  get miPista(): string {
    const t = this.est?.turno;
    if (!t) return '';
    const ayudantes = this.ayudantes(t.equipoId);
    if (ayudantes.length === 0) return t.pistas[0] || '';
    const i = ayudantes.indexOf(this.currentName || '');
    return i >= 0 ? (t.pistas[i] || '') : '';
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
