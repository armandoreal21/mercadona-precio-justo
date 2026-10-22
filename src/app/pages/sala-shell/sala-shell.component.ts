import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SalaService } from '../../sala.service';
import { Sala, Jugador } from '../../core/models/sala.model';
import { PrecioJustoComponent } from '../../games/precio-justo/precio-justo.component';

@Component({
  selector: 'app-sala-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PrecioJustoComponent],
  template: `
    <div class="min-h-screen bg-slate-900 p-4 text-white mpj-theme">
      <div *ngIf="!sala" class="max-w-2xl mx-auto p-6 bg-slate-800 rounded-xl text-center">
        <p class="text-lg">Sala no encontrada o cargando...</p>
      </div>

      <div *ngIf="sala" class="w-full max-w-4xl mx-auto p-6 bg-slate-800 rounded-3xl shadow-2xl border-4 border-purple-600">
        <!-- Top bar: Room info -->
        <div class="flex flex-col sm:flex-row items-center justify-between mb-4 border-b border-slate-700 pb-4 gap-3">
          <div>
            <h2 class="text-2xl font-black text-yellow-400">Sala: {{ sala.nombre }}</h2>
            <div class="text-sm text-slate-300">
              Código: <span class="font-mono font-bold text-cyan-400 text-base">{{ sala.codigo }}</span>
              <span class="ml-2 px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                Juego: {{ getNombreJuego(sala.tipoJuego) }}
              </span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm">Ronda {{ (sala.rondaActual ?? 0) }} / {{ sala.rondasTotales }}</div>
            <div class="text-xs text-slate-400">Participantes: {{ sala.jugadores.length || 0 }}</div>
          </div>
        </div>

        <!-- Current User Badge -->
        <div *ngIf="currentName" class="mb-4 text-sm text-slate-200 text-center">
          <span class="font-semibold text-white">
            Conectado como: {{ currentName }}
            <span *ngIf="isCurrentAdmin()" class="text-yellow-300 font-bold ml-1">(admin 👑)</span>
          </span>
        </div>

        <!-- Participants & Team Management (Admin control) -->
        <div class="mb-6 bg-slate-900 p-4 rounded-2xl border border-slate-700">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Participantes en sala</span>
            <span *ngIf="sala.modoJuego !== 'individual'" class="text-xs text-purple-300 font-semibold">
              Modo Equipos Activo
            </span>
          </div>

          <!-- Individual mode participants list -->
          <div *ngIf="sala.modoJuego === 'individual'" class="flex flex-wrap gap-2">
            <div *ngFor="let j of sala.jugadores"
                 class="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-sm">
              <span [class.text-yellow-300]="j.esAdmin" class="font-semibold">{{ j.nombre }}</span>
              <span *ngIf="j.esAdmin" class="text-xs">👑</span>
              <button *ngIf="isCurrentAdmin() && !j.esAdmin" (click)="expulsarJugador(j.nombre)"
                      title="Expulsar jugador" class="text-rose-400 hover:text-rose-300 text-xs ml-1 font-bold">
                ✕
              </button>
            </div>
          </div>

          <!-- Team mode: Participants grouped by team -->
          <div *ngIf="sala.modoJuego !== 'individual' && sala.equipos" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div *ngFor="let eq of sala.equipos" class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <div class="font-bold text-sm text-cyan-300 mb-2 flex justify-between">
                <span>🛡️ {{ eq.nombre }}</span>
                <span class="text-xs text-slate-400">({{ getJugadoresEquipo(eq.id).length }})</span>
              </div>
              <div class="space-y-1.5">
                <div *ngFor="let j of getJugadoresEquipo(eq.id)"
                     class="flex justify-between items-center text-xs bg-slate-900/80 p-1.5 rounded-lg">
                  <span class="font-semibold">{{ j.nombre }}</span>
                  <div class="flex items-center gap-1">
                    <!-- Admin team mover -->
                    <select *ngIf="isCurrentAdmin()" [ngModel]="j.equipoId"
                            (ngModelChange)="cambiarEquipo(j.nombre, $event)"
                            class="bg-slate-800 text-slate-200 text-[10px] rounded px-1 py-0.5 border border-slate-600">
                      <option *ngFor="let targetEq of sala.equipos" [value]="targetEq.id">
                        → {{ targetEq.nombre }}
                      </option>
                    </select>
                    <button *ngIf="isCurrentAdmin() && !j.esAdmin" (click)="expulsarJugador(j.nombre)"
                            title="Expulsar" class="text-rose-400 hover:text-rose-300 px-1 font-bold">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dynamic Game Container -->
        <ng-container [ngSwitch]="sala.tipoJuego">
          <app-precio-justo *ngSwitchCase="'precio-justo'"
                            [sala]="sala"
                            [currentName]="currentName"
                            [isAdmin]="isCurrentAdmin()"
                            (clasificacionRequested)="abrirClasificacion()"
                            (endOfGameReached)="onFinPartida()">
          </app-precio-justo>

          <!-- Fallback or future game -->
          <div *ngSwitchDefault class="p-8 text-center bg-slate-900 rounded-xl">
            <p class="text-slate-400">Juego en preparación: {{ sala.tipoJuego }}</p>
          </div>
        </ng-container>

        <!-- Admin End of Game Quick Actions (when room reached final round) -->
        <div *ngIf="isCurrentAdmin() && ((sala.rondaActual ?? 0) + 1) >= (sala.rondasTotales ?? 0)"
             class="mt-6 p-4 bg-slate-900 rounded-2xl border border-slate-700">
          <div class="text-sm text-slate-300 font-semibold mb-2">Fin de la partida</div>
          <div class="flex gap-2 flex-col sm:flex-row">
            <button (click)="handleRestartGame()"
                    class="w-full sm:w-auto px-4 py-2 bg-orange-400 hover:bg-orange-300 text-slate-950 rounded-lg font-bold transition">
              Reiniciar partida
            </button>
            <button (click)="handleDeleteRoom()"
                    class="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition">
              Eliminar sala
            </button>
          </div>
        </div>

        <!-- Clasificación modal -->
        <div *ngIf="showClasificacion" class="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" (click)="cerrarClasificacion()"></div>
          <div class="relative max-w-md w-full bg-slate-800 rounded-xl p-5 border border-slate-700 text-white">
            <h4 class="text-lg font-bold mb-3 text-yellow-400">🏆 Clasificación General</h4>
            <ul class="space-y-2 max-h-64 overflow-auto">
              <li *ngFor="let c of clasificacionList; let pos = index"
                  class="flex justify-between items-center p-2.5 bg-slate-900 rounded-lg">
                <div class="flex items-center gap-2">
                  <span class="font-black text-slate-500">#{{ pos + 1 }}</span>
                  <span class="font-semibold">{{ c.nombre }}</span>
                </div>
                <div class="text-yellow-300 font-bold">{{ c.puntos }} pts</div>
              </li>
            </ul>
            <div class="mt-4 flex justify-end">
              <button (click)="cerrarClasificacion()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold">
                Cerrar
              </button>
            </div>
          </div>
        </div>

        <!-- Admin Final choice modal -->
        <div *ngIf="showFinalChoiceModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70" (click)="showFinalChoiceModal = false"></div>
          <div class="relative max-w-md w-full bg-slate-800 rounded-2xl p-6 border border-slate-700 text-white">
            <h4 class="text-xl font-bold mb-2 text-yellow-400">Fin de la partida</h4>
            <p class="text-sm text-slate-300 mb-4">¿Qué deseas hacer con la sala?</p>
            <div class="flex flex-col gap-2">
              <button (click)="handleRestartGame()" class="px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-purple-950 rounded-xl font-bold">
                Reiniciar partida
              </button>
              <button (click)="handleDeleteRoom()" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-white font-bold">
                Eliminar sala
              </button>
              <button (click)="showFinalChoiceModal = false" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold">
                Cerrar
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class SalaShellComponent implements OnInit, OnDestroy {
  sala: Sala | null = null;
  codigo = '';
  currentName: string | null = null;

  showClasificacion = false;
  clasificacionList: { nombre: string; puntos: number }[] = [];
  showFinalChoiceModal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private salaService: SalaService
  ) {
    this.codigo = String(this.route.snapshot.paramMap.get('codigo') || '').toUpperCase();
    this.currentName = this.readCurrentName();
  }

  async ngOnInit(): Promise<void> {
    let s = this.salaService.obtenerSalaPorCodigo(this.codigo);
    if (!s) {
      // try to sync latest state from Firebase / backend before redirecting
      await this.salaService.requestServerState();
      s = this.salaService.obtenerSalaPorCodigo(this.codigo);
    }
    if (!s) {
      this.router.navigate(['/unirse']);
      return;
    }
    this.refreshSala();

    if (typeof window !== 'undefined') {
      window.addEventListener('mpj_state_updated', this.onRemoteUpdate as EventListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mpj_state_updated', this.onRemoteUpdate as EventListener);
    }
  }

  private onRemoteUpdate = () => this.refreshSala();

  refreshSala(): void {
    this.sala = this.salaService.obtenerSalaPorCodigo(this.codigo);
    this.currentName = this.readCurrentName();
  }

  readCurrentName(): string | null {
    try {
      const raw = localStorage.getItem('mpj_current');
      if (!raw) return null;
      const cur = JSON.parse(raw);
      return cur?.nombre || null;
    } catch (e) {
      return null;
    }
  }

  isCurrentAdmin(): boolean {
    try {
      const raw = localStorage.getItem('mpj_current');
      if (!raw) return false;
      const cur = JSON.parse(raw);
      return !!(cur && cur.codigo === this.codigo && cur.esAdmin);
    } catch (e) {
      return false;
    }
  }

  getNombreJuego(tipoJuego: string): string {
    switch (tipoJuego) {
      case 'precio-justo':
        return '🛒 El Precio Justo';
      default:
        return tipoJuego;
    }
  }

  getJugadoresEquipo(equipoId: string): Jugador[] {
    if (!this.sala) return [];
    return this.sala.jugadores.filter(j => j.equipoId === equipoId);
  }

  expulsarJugador(nombre: string): void {
    if (!this.isCurrentAdmin()) return;
    if (!confirm(`¿Expulsar a "${nombre}" de la sala?`)) return;
    this.salaService.removePlayer(this.codigo, nombre);
    this.refreshSala();
  }

  cambiarEquipo(nombreJugador: string, nuevoEquipoId: string): void {
    if (!this.isCurrentAdmin()) return;
    this.salaService.cambiarEquipoJugador(this.codigo, nombreJugador, nuevoEquipoId);
    this.refreshSala();
  }

  abrirClasificacion(): void {
    if (!this.sala) return;
    this.clasificacionList = (this.sala.jugadores || [])
      .map(p => ({ nombre: p.nombre, puntos: p.puntuacion || 0 }))
      .sort((a, b) => b.puntos - a.puntos);
    this.showClasificacion = true;
  }

  cerrarClasificacion(): void {
    this.showClasificacion = false;
  }

  onFinPartida(): void {
    this.showFinalChoiceModal = true;
  }

  handleRestartGame(): void {
    this.showFinalChoiceModal = false;
    this.salaService.reiniciarSala(this.codigo);
    this.refreshSala();
  }

  handleDeleteRoom(): void {
    this.showFinalChoiceModal = false;
    this.salaService.eliminarSala(this.codigo);
    this.router.navigate(['/unirse']);
  }
}
