import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SalaService } from '../../sala.service';
import { getJuegoById } from '../../games/games.registry';
import { GameDefinition, ModoJuego } from '../../core/models/game.model';
import { Equipo, DificultadPalabras } from '../../core/models/sala.model';

@Component({
  selector: 'app-configurar-sala',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-radial-gradient from-purple-900 to-slate-900 p-4 flex flex-col items-center justify-center text-white">
      <div class="w-full max-w-lg bg-slate-800 rounded-3xl border-4 border-purple-500 shadow-2xl p-6 sm:p-8">

        <!-- Header -->
        <div class="text-center mb-6">
          <span class="text-4xl">{{ juego?.icono || '🏛️' }}</span>
          <h2 class="text-2xl font-black text-yellow-400 uppercase tracking-wide mt-2">
            Configurar Sala: {{ juego?.nombre || 'Juego' }}
          </h2>
          <p class="text-xs text-slate-400 mt-1">Define las reglas para esta partida</p>
        </div>

        <div class="space-y-4">
          <!-- Room name -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre de la Sala</label>
            <input [(ngModel)]="nombre" type="text" placeholder="Ej: Sala de los Cracks"
                   class="w-full bg-slate-700 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:border-yellow-400 transition" />
          </div>

          <!-- Game mode selector (if multiple are supported) -->
          <div *ngIf="juego && juego.modosSoportados.length > 1">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Modo de Juego</label>
            <select [(ngModel)]="modoSeleccionado"
                    class="w-full bg-slate-700 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:border-yellow-400 transition">
              <option *ngFor="let modo of juego.modosSoportados" [value]="modo">
                {{ getEtiquetaModo(modo) }}
              </option>
            </select>
          </div>

          <!-- Ajustes específicos para La Palabra Más Larga: Dificultad y Nº de Letras fijo -->
          <div *ngIf="juegoId === 'palabra-mas-larga'" class="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
            <div class="text-xs font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
              <span>🔤</span>
              <span>Ajustes de Palabras (Fijos para toda la partida)</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Dificultad</label>
                <select [(ngModel)]="dificultadPalabras"
                        class="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white font-semibold text-xs focus:outline-none focus:border-yellow-400 transition">
                  <option value="facil">🟢 Fácil (Muchas vocales y letras comunes)</option>
                  <option value="media">🟡 Media (Equilibrada)</option>
                  <option value="dificil">🔴 Difícil (Menos vocales y consonantes raras)</option>
                </select>
                <p class="text-[10px] text-slate-400 mt-1">
                  {{ getDescripcionDificultad() }}
                </p>
              </div>

              <div>
                <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Nº de Letras por Ronda</label>
                <select [(ngModel)]="numLetrasFijo"
                        class="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white font-semibold text-xs focus:outline-none focus:border-yellow-400 transition">
                  <option [ngValue]="8">8 letras</option>
                  <option [ngValue]="9">9 letras</option>
                  <option [ngValue]="10">10 letras (Estándar)</option>
                  <option [ngValue]="11">11 letras</option>
                  <option [ngValue]="12">12 letras</option>
                </select>
                <p class="text-[10px] text-slate-400 mt-1">
                  Cantidad fija de fichas que se repartirán en cada ronda.
                </p>
              </div>
            </div>
          </div>

          <!-- Total rounds (specific to precio-justo or round-based games) -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Rondas Totales</label>
            <input [(ngModel)]="rondas" type="number" min="1" max="50"
                   class="w-28 bg-slate-700 border-2 border-slate-600 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-yellow-400 transition" />
            <p class="text-xs text-slate-400 mt-1">Número de rondas de la partida (ej: 5)</p>
          </div>

          <!-- Team setup if mode requires teams -->
          <div *ngIf="requiereEquipos()" class="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
            <label class="block text-xs font-bold uppercase tracking-wider text-yellow-400">Configuración de Equipos</label>
            <div *ngFor="let eq of equipos; let idx = index" class="flex gap-2 items-center">
              <input type="text" [(ngModel)]="eq.nombre" placeholder="Nombre equipo"
                     class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm" />
              <button *ngIf="equipos.length > 2" (click)="quitarEquipo(idx)" class="text-rose-400 hover:text-rose-300 text-xs px-2">✕</button>
            </div>
            <button (click)="agregarEquipo()" class="text-xs text-cyan-400 hover:text-cyan-300 font-bold">+ Añadir equipo</button>
          </div>

          <!-- Submit -->
          <button (click)="generar()" [disabled]="creando"
                  class="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-purple-950 font-black text-lg py-3 rounded-xl shadow-lg hover:from-yellow-300 hover:to-amber-400 active:translate-y-0.5 transition uppercase tracking-wider mt-4 disabled:opacity-60">
            {{ creando ? '⏳ Creando Sala...' : '🚀 Generar Sala' }}
          </button>

          <!-- feedback area -->
          <div *ngIf="resultado" class="mt-4 p-4 rounded-xl bg-slate-900 text-sm border border-slate-700">
            <div *ngIf="resultado.creado" class="text-green-400 font-bold flex flex-col gap-2">
              <span>✅ Sala creada con éxito: código <strong class="text-white text-base font-mono tracking-widest bg-slate-800 px-2 py-0.5 rounded">{{ resultado.sala?.codigo }}</strong></span>
              <button (click)="entrarDirectoComoAdmin()"
                      class="mt-2 w-full bg-cyan-400 text-slate-900 font-black py-2.5 rounded-lg hover:bg-cyan-300 transition uppercase tracking-wide">
                Entrar a la Sala como Admin 👉
              </button>
            </div>
            <div *ngIf="resultado.error" class="text-rose-400">Error: {{ resultado.error }}</div>
          </div>

          <!-- Mantenimiento / Limpieza de salas inactivas (como estaba antes en admin) -->
          <div class="mt-6 pt-4 border-t border-slate-700">
            <div *ngIf="!cleanupPreview">
              <button (click)="checkCleanup()"
                      class="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1">
                🧹 Comprobar y limpiar salas inactivas (>1 día)
              </button>
              <div *ngIf="cleanupResult" class="mt-2 text-xs text-slate-300 text-center">{{ cleanupResult }}</div>
            </div>

            <div *ngIf="cleanupPreview" class="p-3 bg-slate-900 rounded-xl border border-slate-700">
              <div class="text-xs text-slate-200 mb-2 font-semibold">Se eliminarían {{ cleanupPreview.eliminadas }} sala(s) inactivas:</div>
              <ul class="text-xs text-slate-400 space-y-1 max-h-28 overflow-auto mb-3">
                <li *ngFor="let c of cleanupPreview.removedCodes">• Sala código: <span class="font-mono text-yellow-300">{{ c }}</span></li>
              </ul>
              <div class="flex gap-2">
                <button (click)="executeCleanup()" [disabled]="cleaning"
                        class="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 rounded-lg text-xs transition">
                  Confirmar eliminación
                </button>
                <button (click)="cancelCleanup()" [disabled]="cleaning"
                        class="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 rounded-lg text-xs">
                  Cancelar
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 text-center">
            <a routerLink="/juegos" class="text-xs text-slate-400 hover:text-slate-300 underline">
              ← Cambiar de juego
            </a>
          </div>
        </div>

      </div>
    </div>
  `
})
export class ConfigurarSalaComponent implements OnInit {
  juegoId = 'precio-justo';
  juego: GameDefinition | null = null;

  nombre = '';
  rondas = 5;
  modoSeleccionado: ModoJuego = 'individual';
  equipos: Equipo[] = [
    { id: 'eq1', nombre: 'Equipo Alfa', color: '#38bdf8' },
    { id: 'eq2', nombre: 'Equipo Beta', color: '#f43f5e' }
  ];

  // Configuración específica de La Palabra Más Larga
  dificultadPalabras: DificultadPalabras = 'facil';
  numLetrasFijo = 10;

  resultado: any = null;
  creando = false;

  // Cleanup section
  cleanupResult: string | null = null;
  cleanupPreview: { eliminadas: number; removedCodes: string[] } | null = null;
  cleaning = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private salaService: SalaService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.juegoId = params.get('juegoId') || 'precio-justo';
      const j = getJuegoById(this.juegoId);
      if (!j) {
        this.router.navigate(['/juegos']);
        return;
      }
      this.juego = j;
      this.modoSeleccionado = j.modosSoportados[0] || 'individual';
      if (j.configDefecto?.['rondasTotales']) {
        this.rondas = j.configDefecto['rondasTotales'];
      }
    });
  }

  requiereEquipos(): boolean {
    return this.modoSeleccionado === 'equipos_sesion_unica' || this.modoSeleccionado === 'equipos_multiusuario';
  }

  agregarEquipo() {
    const num = this.equipos.length + 1;
    this.equipos.push({ id: `eq${num}`, nombre: `Equipo ${num}` });
  }

  quitarEquipo(idx: number) {
    if (this.equipos.length > 2) {
      this.equipos.splice(idx, 1);
    }
  }

  getEtiquetaModo(modo: ModoJuego): string {
    switch (modo) {
      case 'individual':
        return '👤 Individual (Todos contra todos)';
      case 'equipos_sesion_unica':
        return '👥 Equipos (1 sesión por equipo)';
      case 'equipos_multiusuario':
        return '👥 Equipos (Múltiples participantes por equipo)';
      default:
        return modo;
    }
  }

  getDescripcionDificultad(): string {
    switch (this.dificultadPalabras) {
      case 'facil':
        return 'Aproximadamente 50% vocales y letras más amigables (A, E, O, R, S, L, T). Ideal para encontrar palabras largas fácilmente.';
      case 'media':
        return 'Aproximadamente 40% vocales con distribución clásica y equilibrada.';
      case 'dificil':
        return 'Aproximadamente 30-35% vocales e inclusión de consonantes más complejas (Z, X, J, K, etc.).';
      default:
        return '';
    }
  }

  async generar() {
    if (!this.nombre || !this.nombre.trim()) {
      this.resultado = { error: 'Introduce un nombre válido para la sala' };
      return;
    }
    const rounds = Number(this.rondas) || 5;
    const equiposConfig = this.requiereEquipos() ? this.equipos : undefined;

    const configPalabras = this.juegoId === 'palabra-mas-larga' ? {
      numLetras: Number(this.numLetrasFijo) || 10,
      dificultad: this.dificultadPalabras
    } : undefined;

    this.creando = true;
    this.resultado = null;
    try {
      this.resultado = await this.salaService.crearSala(
        this.nombre,
        rounds,
        this.juegoId,
        this.modoSeleccionado,
        equiposConfig,
        configPalabras
      );
    } catch (e: any) {
      this.resultado = { error: e?.message || 'Error al crear la sala' };
    } finally {
      this.creando = false;
    }
  }

  async checkCleanup() {
    this.cleanupResult = null;
    this.cleanupPreview = null;
    try {
      const preview = (this.salaService as any).previewEliminarSalasInactivas(1);
      this.cleanupPreview = { eliminadas: preview.eliminadas || 0, removedCodes: preview.removedCodes || [] };
      if (!this.cleanupPreview.eliminadas) {
        this.cleanupResult = 'No hay salas inactivas de más de 1 día.';
        this.cleanupPreview = null;
      }
    } catch (e) {
      this.cleanupResult = 'Error comprobando salas inactivas';
    }
  }

  async executeCleanup() {
    if (!confirm('¿Confirmar eliminación de las salas inactivas mostradas?')) return;
    this.cleaning = true;
    this.cleanupResult = null;
    try {
      const eliminadas = (this.salaService as any).eliminarSalasInactivas(1);
      this.cleanupResult = `Se eliminaron ${eliminadas} sala(s) inactiva(s).`;
      this.cleanupPreview = null;
    } catch (e) {
      this.cleanupResult = 'Error al ejecutar limpieza';
    } finally {
      this.cleaning = false;
      setTimeout(() => (this.cleanupResult = null), 6000);
    }
  }

  cancelCleanup() {
    this.cleanupPreview = null;
  }

  async entrarDirectoComoAdmin() {
    if (!this.resultado?.sala?.codigo) return;
    const codigo = this.resultado.sala.codigo;
    const adminName = 'Admin';
    await this.salaService.unirComoAdmin(codigo, adminName);
    try {
      localStorage.setItem('mpj_current', JSON.stringify({ codigo, nombre: adminName, esAdmin: true }));
    } catch (e) {}
    this.router.navigate(['/sala', codigo]);
  }
}
