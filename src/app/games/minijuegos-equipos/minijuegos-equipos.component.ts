import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sala, EstadoMinijuegos } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';
import { NOMBRE_MINIJUEGO } from './minijuegos.logic';

@Component({
  selector: 'app-minijuegos-equipos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="w-full max-w-3xl mx-auto space-y-4" *ngIf="sala">

      <!-- ===================== ESPERANDO ===================== -->
      <div *ngIf="!est || est.fase === 'esperando'" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
        <div class="text-sm font-bold text-cyan-300">🧩 Minijuegos por equipos</div>
        <div class="text-xs text-slate-400">Cada equipo elige un capitán. Es el único que escribe la respuesta durante toda la partida.</div>

        <div *ngFor="let eq of equipos" class="flex items-center justify-between gap-2">
          <span class="text-sm text-white">🛡️ {{ eq.nombre }}</span>
          <select *ngIf="isAdmin" [(ngModel)]="capitanBorrador[eq.id]"
                  class="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm">
            <option [ngValue]="undefined" disabled>Elegir capitán</option>
            <option *ngFor="let m of miembros(eq.id)" [ngValue]="m">{{ m }}</option>
          </select>
          <span *ngIf="!isAdmin" class="text-xs text-slate-300">Capitán: {{ est?.capitanes?.[eq.id] || 'pendiente' }}</span>
        </div>

        <div *ngIf="isAdmin" class="text-center">
          <button (click)="guardarCapitanes()"
                  class="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold mr-2">
            Guardar capitanes
          </button>
          <button (click)="iniciar()"
                  class="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-5 py-2 rounded-xl uppercase text-xs tracking-wide">
            ▶ Empezar
          </button>
        </div>
        <div *ngIf="!isAdmin" class="text-center text-xs text-slate-500">Esperando a que el admin empiece la partida.</div>
      </div>

      <!-- ===================== JUGANDO ===================== -->
      <ng-container *ngIf="est && est.fase === 'jugando' && est.turno as t">
        <div class="bg-slate-900 p-3 rounded-2xl border border-slate-700 flex flex-wrap justify-between gap-2 text-xs">
          <span class="font-bold text-cyan-300">Ronda {{ est.ronda }} de {{ est.totalRondas }}</span>
          <span class="text-slate-300">{{ nombreMinijuego[t.tipo] }}</span>
          <span class="font-mono" [class.text-rose-400]="segundosRestantes <= 30">⏱️ {{ formatear(segundosRestantes) }}</span>
        </div>

        <div class="bg-slate-900 p-4 rounded-2xl border-2 text-center space-y-1"
             [class.border-sky-500]="esEquipoUno(t.equipoId)" [class.border-rose-500]="!esEquipoUno(t.equipoId)">
          <div class="text-xs uppercase text-slate-400 tracking-wider">Turno de</div>
          <div class="text-xl font-black text-white">🛡️ {{ nombreEquipo(t.equipoId) }}</div>
          <div class="text-xs text-slate-400">Capitán: {{ est.capitanes[t.equipoId] }} · Errores: {{ t.errores }}/3</div>
        </div>

        <!-- Panel: lo ve el capitán activo y el equipo que observa -->
        <div *ngIf="puedeVerPanel(t)" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
          <div class="text-xs uppercase text-slate-400 tracking-wider">Panel</div>
          <ng-container [ngSwitch]="t.tipo">
            <div *ngSwitchCase="'secuencia'" class="text-2xl font-black text-center tracking-widest">{{ t.panel.secuencia.join('  ') }}</div>
            <div *ngSwitchCase="'cableado'" class="space-y-1">
              <div *ngFor="let h of t.panel.hilos; let i = index" class="text-sm text-slate-200">
                Cable {{ i + 1 }}: <span class="font-bold">{{ h }}</span>
              </div>
              <div class="text-xs text-slate-500">¿Qué cable cortas? Escribe el número (1-5).</div>
            </div>
            <div *ngSwitchCase="'mapa'" class="text-sm text-slate-200 space-y-1">
              <div>Sale de la <b>fila 1, columna 1</b> y debe llegar a la <b>fila {{ t.panel.tamano }}, columna {{ t.panel.tamano }}</b>.</div>
              <div class="text-xs text-slate-500">Escribe los movimientos: U (arriba), D (abajo), L (izquierda), R (derecha). Ejemplo: DDRR</div>
            </div>
            <div *ngSwitchCase="'codigo'" class="text-sm text-slate-200">Introduce el código de 3 dígitos.</div>
            <div *ngSwitchCase="'metro'" class="text-sm text-slate-200">
              De <b>{{ t.panel.origen }}</b> a <b>{{ t.panel.destino }}</b>. ¿Cuántos transbordos mínimos hacen falta?
            </div>
          </ng-container>
        </div>

        <!-- Equipo activo: el capitán responde, los demás ven su pista -->
        <ng-container *ngIf="enEquipoActivo">
          <div *ngIf="esCapitan" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
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
            <div class="text-sm text-white whitespace-pre-line">{{ miPista }}</div>
            <div class="text-xs text-slate-500">Dásela a tu capitán. Solo él ve el panel y escribe la respuesta.</div>
          </div>
        </ng-container>

        <!-- Equipo que observa -->
        <div *ngIf="!enEquipoActivo && miEquipoId" class="text-center text-sm text-slate-400">
          👀 Observas el turno del otro equipo. Después te toca a ti con otra versión de este minijuego.
        </div>

        <div *ngIf="error" class="p-2 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs text-center">⚠️ {{ error }}</div>
      </ng-container>

      <!-- Marcador -->
      <div *ngIf="est && est.fase !== 'esperando'" class="bg-slate-900 p-3 rounded-2xl border border-slate-700">
        <div class="text-xs uppercase text-slate-400 tracking-wider mb-2">Marcador</div>
        <div class="grid grid-cols-2 gap-2 text-center">
          <div *ngFor="let eq of equipos" class="bg-slate-800 rounded-lg p-2">
            <div class="text-xs text-slate-300">{{ eq.nombre }}</div>
            <div class="text-xl font-black text-yellow-300">{{ est.puntos[eq.id] || 0 }}</div>
          </div>
        </div>
      </div>

      <!-- Final -->
      <div *ngIf="est && est.fase === 'terminado'" class="bg-slate-900 p-5 rounded-2xl border-2 border-yellow-400 text-center space-y-2">
        <div class="text-xs uppercase text-slate-400">Partida terminada</div>
        <div class="text-xl font-black text-yellow-300">
          {{ est.ganadorEquipoId ? '🏆 Gana ' + nombreEquipo(est.ganadorEquipoId) : '🤝 Empate' }}
        </div>
        <div class="text-xs text-slate-400">Tiempo total por equipo: <span *ngFor="let eq of equipos">{{ eq.nombre }} {{ formatear(((est.tiempoTotalMs[eq.id] || 0) / 1000)) }} · </span></div>
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
  capitanBorrador: Record<string, string> = {};
  private timer: any = null;

  constructor(private salaService: SalaService) {}

  ngOnInit(): void {
    this.timer = setInterval(() => {
      this.ahora = Date.now();
      this.comprobarTiempo();
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
    return Math.max(0, Math.ceil((t.inicioMs + t.limiteMs - this.ahora) / 1000));
  }

  get miPista(): string {
    const t = this.est?.turno;
    if (!t) return '';
    const ayudantes = this.ayudantes(t.equipoId);
    if (ayudantes.length === 0) return t.pistas[0] || '';
    const i = ayudantes.indexOf(this.currentName || '');
    return i >= 0 ? (t.pistas[i] || 'Sin pista extra: ayuda a tu capitán con lo que veas.') : '';
  }

  /** Miembros del equipo que dan pistas (todos menos el capitán). */
  ayudantes(equipoId: string): string[] {
    const capitan = this.est?.capitanes?.[equipoId];
    return this.miembros(equipoId).filter(n => n !== capitan);
  }

  get soloCapitan(): boolean {
    const t = this.est?.turno;
    return !!t && this.esCapitan && this.ayudantes(t.equipoId).length === 0;
  }

  miembros(equipoId: string): string[] {
    return (this.sala?.jugadores || []).filter(j => j.equipoId === equipoId).map(j => j.nombre);
  }

  nombreEquipo(id: string): string {
    return this.sala?.equipos?.find(e => e.id === id)?.nombre || id;
  }

  /** Solo el primer equipo de la lista se pinta de azul; el resto de rojo. */
  esEquipoUno(id: string): boolean {
    return this.est?.equiposOrden?.[0] === id;
  }

  /** Panel visible para el capitán activo y para quien observa; no para el resto del equipo activo. */
  puedeVerPanel(t: { equipoId: string }): boolean {
    return this.esCapitan || !this.enEquipoActivo;
  }

  placeholderRespuesta(tipo: string): string {
    switch (tipo) {
      case 'mapa': return 'Movimientos, ej. DDRR';
      case 'cableado': return 'Número del cable (1-5)';
      case 'metro': return 'Número de transbordos';
      default: return 'Respuesta';
    }
  }

  formatear(segundos: number): string {
    const s = Math.max(0, Math.floor(segundos));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private comprobarTiempo(): void {
    const t = this.est?.turno;
    if (!this.sala || !t || t.estado !== 'activo') return;
    if (this.ahora >= t.inicioMs + t.limiteMs) {
      this.salaService.expirarTurnoMinijuego(this.sala.codigo);
    }
  }

  async guardarCapitanes(): Promise<void> {
    if (!this.sala) return;
    this.error = null;
    if (!this.equipos.every(eq => !!this.capitanBorrador[eq.id])) {
      this.error = 'Elige un capitán para cada equipo.';
      return;
    }
    await this.salaService.asignarCapitanesMinijuegos(this.sala.codigo, { ...this.capitanBorrador });
  }

  async iniciar(): Promise<void> {
    if (!this.sala) return;
    this.error = null;
    const ok = await this.salaService.iniciarMinijuegos(this.sala.codigo);
    if (!ok) this.error = 'Guarda un capitán en cada equipo antes de empezar.';
  }

  async enviar(): Promise<void> {
    if (!this.sala || !this.currentName || !this.respuesta.trim()) return;
    this.error = null;
    const antes = this.est?.turno?.errores ?? 0;
    const ok = await this.salaService.resolverMinijuego(this.sala.codigo, this.currentName, this.respuesta);
    this.respuesta = '';
    if (!ok) this.error = 'No puedes responder ahora.';
    else if ((this.est?.turno?.errores ?? antes) > antes) this.error = 'Respuesta incorrecta.';
  }

  async reiniciar(): Promise<void> {
    if (!this.sala || !this.isAdmin) return;
    if (!window.confirm('¿Reiniciar los minijuegos? Se perderán los puntos.')) return;
    await this.salaService.reiniciarMinijuegos(this.sala.codigo);
  }
}
