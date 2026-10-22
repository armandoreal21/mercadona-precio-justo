import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SalaService } from '../../sala.service';
import { Sala, Jugador } from '../../core/models/sala.model';
import { PrecioJustoComponent } from '../../games/precio-justo/precio-justo.component';
import { PalabraMasLargaComponent } from '../../games/palabra-mas-larga/palabra-mas-larga.component';
import { SubastaRespuestasComponent } from '../../games/subasta-respuestas/subasta-respuestas.component';

@Component({
  selector: 'app-sala-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PrecioJustoComponent, PalabraMasLargaComponent, SubastaRespuestasComponent],
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
          <div class="flex items-center gap-4">
            <button (click)="abrirClasificacion()"
                    class="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wide flex items-center gap-1.5 shadow-md transition">
              <span>🏆</span>
              <span>Clasificación</span>
            </button>
            <div class="text-right">
              <div class="text-sm">Ronda {{ (sala.rondaActual ?? 0) }} / {{ sala.rondasTotales }}</div>
              <div class="text-xs text-slate-400">Participantes: {{ sala.jugadores.length || 0 }}</div>
            </div>
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
          <div *ngIf="sala.modoJuego !== 'individual' && sala.equipos">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div *ngFor="let eq of sala.equipos" class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <div class="font-bold text-sm text-cyan-300 mb-2 flex justify-between items-center">
                  <span>🛡️ {{ eq.nombre }}</span>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400">({{ getJugadoresEquipo(eq.id).length }})</span>
                    <!-- Eliminar equipo si no tiene participantes (solo Admin) -->
                    <button *ngIf="isCurrentAdmin() && getJugadoresEquipo(eq.id).length === 0"
                            (click)="eliminarEquipo(eq.id, eq.nombre)"
                            title="Eliminar equipo vacío"
                            class="text-rose-400 hover:text-rose-300 text-xs px-1.5 py-0.5 bg-rose-950/60 rounded border border-rose-800 font-bold">
                      🗑️
                    </button>
                  </div>
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
                  <div *ngIf="getJugadoresEquipo(eq.id).length === 0" class="text-[11px] text-slate-500 italic py-1 text-center">
                    Sin participantes aún
                  </div>
                </div>
              </div>
            </div>

            <!-- Admin: Agregar nuevo equipo en caliente -->
            <div *ngIf="isCurrentAdmin()" class="mt-3 pt-3 border-t border-slate-800 flex gap-2 items-center">
              <input type="text" [(ngModel)]="nuevoEquipoNombre" placeholder="Nombre de nuevo equipo..."
                     class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-xs text-white flex-1 focus:outline-none focus:border-cyan-400" />
              <button (click)="agregarNuevoEquipo()"
                      class="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs uppercase tracking-wide transition">
                + Añadir Equipo
              </button>
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

          <app-palabra-mas-larga *ngSwitchCase="'palabra-mas-larga'"
                                 [sala]="sala"
                                 [currentName]="currentName"
                                 [isAdmin]="isCurrentAdmin()"
                                 (clasificacionRequested)="abrirClasificacion()"
                                 (endOfGameReached)="onFinPartida()">
          </app-palabra-mas-larga>

          <app-subasta-respuestas *ngSwitchCase="'subasta-respuestas'"
                                  [sala]="sala"
                                  [currentName]="currentName"
                                  [isAdmin]="isCurrentAdmin()"
                                  (clasificacionRequested)="abrirClasificacion()"
                                  (endOfGameReached)="onFinPartida()">
          </app-subasta-respuestas>

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
          <div class="relative max-w-md w-full bg-slate-800 rounded-xl p-5 border border-slate-700 text-white shadow-2xl">
            <h4 class="text-lg font-bold mb-3 text-yellow-400 flex items-center justify-between">
              <span>🏆 Clasificación {{ sala.modoJuego !== 'individual' ? 'por Equipos' : 'General' }}</span>
              <span *ngIf="sala.modoJuego !== 'individual'" class="text-xs text-purple-300 bg-purple-900/60 border border-purple-600/40 px-2 py-0.5 rounded-full font-semibold">Equipos</span>
            </h4>
            <ul class="space-y-2 max-h-72 overflow-auto">
              <li *ngFor="let c of clasificacionList; let pos = index"
                  class="p-2.5 bg-slate-900 rounded-lg flex flex-col gap-1 border border-slate-700/50">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-2">
                    <span class="font-black text-sm"
                          [ngClass]="pos === 0 ? 'text-yellow-400' : (pos === 1 ? 'text-slate-300' : (pos === 2 ? 'text-amber-600' : 'text-slate-500'))">
                      #{{ pos + 1 }}
                    </span>
                    <span class="font-bold text-sm text-white">{{ c.nombre }}</span>
                  </div>
                  <div class="text-yellow-300 font-black text-base">{{ c.puntos }} pts</div>
                </div>
                <div *ngIf="c.miembros && c.miembros.length" class="text-[11px] text-slate-400 pl-6">
                  Miembros: {{ c.miembros.join(', ') }}
                </div>
              </li>
              <li *ngIf="clasificacionList.length === 0" class="text-center text-slate-400 py-4 text-xs italic">
                No hay puntuaciones registradas aún.
              </li>
            </ul>
            <div class="mt-4 flex justify-end">
              <button (click)="cerrarClasificacion()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold text-xs transition">
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
            <p class="text-sm text-slate-300 mb-4">¿Qué deseos hacer con la sala?</p>
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

  nuevoEquipoNombre = '';

  showClasificacion = false;
  clasificacionList: { nombre: string; puntos: number; miembros?: string[] }[] = [];
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
      case 'palabra-mas-larga':
        return '🔤 La Palabra Más Larga';
      case 'subasta-respuestas':
        return '🧠 La Subasta de Respuestas';
      default:
        return tipoJuego;
    }
  }

  getJugadoresEquipo(equipoId: string): Jugador[] {
    if (!this.sala) return [];
    return this.sala.jugadores.filter(j => j.equipoId === equipoId);
  }

  agregarNuevoEquipo(): void {
    if (!this.isCurrentAdmin() || !this.nuevoEquipoNombre.trim()) return;
    this.salaService.agregarEquipoASala(this.codigo, this.nuevoEquipoNombre);
    this.nuevoEquipoNombre = '';
    this.refreshSala();
  }

  eliminarEquipo(equipoId: string, nombreEquipo: string): void {
    if (!this.isCurrentAdmin()) return;
    if (!confirm(`¿Eliminar el equipo "${nombreEquipo}"?`)) return;
    const ok = this.salaService.eliminarEquipoDeSala(this.codigo, equipoId);
    if (!ok) {
      alert('No se puede eliminar un equipo con participantes asignados.');
    }
    this.refreshSala();
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

    if (this.sala.modoJuego !== 'individual' && Array.isArray(this.sala.equipos) && this.sala.equipos.length > 0) {
      // Modo por Equipos: La puntuación del equipo es la suma o puntuación consolidada del equipo
      this.clasificacionList = this.sala.equipos.map(eq => {
        const miembros = (this.sala?.jugadores || []).filter(j => j.equipoId === eq.id);
        // Cada jugador del equipo acumula los mismos puntos del equipo o la suma
        // En el sistema de puntos de palabra-mas-larga y precio-justo, cada jugador del equipo recibe la puntuación completa.
        // Tomamos el max o suma representativa (si reciben la misma puntuación, max o promedio coincide, o sumamos si cada uno anota).
        // Dado que entregarPuntosPalabras asigna `puntosOtorgados` a cada jugador de ese equipo:
        const puntosEquipo = miembros.length > 0
          ? Math.max(...miembros.map(m => m.puntuacion || 0))
          : 0;

        return {
          nombre: `🛡️ ${eq.nombre}`,
          puntos: puntosEquipo,
          miembros: miembros.map(m => m.nombre)
        };
      }).sort((a, b) => b.puntos - a.puntos);
    } else {
      // Modo Individual: Puntuación individual por jugador
      this.clasificacionList = (this.sala.jugadores || [])
        .map(p => ({ nombre: p.nombre, puntos: p.puntuacion || 0 }))
        .sort((a, b) => b.puntos - a.puntos);
    }

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
