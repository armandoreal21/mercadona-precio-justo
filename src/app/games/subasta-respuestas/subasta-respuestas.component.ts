import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Sala, DificultadPalabras, EstadoSubastaRespuestas, RespuestaSubastaAportada, SeleccionSubasta } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';

export interface CategoriaSubasta {
  id: string;
  categoria: string;
  descripcion: string;
  ejemplos_validos: string[];
  regla_arbitro: string;
  dificultad: string;
}

interface RespuestaUnica {
  clave: string;
  texto: string;
  jugador: string;
}

interface GrupoSubasta {
  id: string;
  nombre: string;
  esMiGrupo: boolean;
  respuestas: RespuestaUnica[];
  seleccion?: SeleccionSubasta;
}

@Component({
  selector: 'app-subasta-respuestas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col items-center gap-4 w-full">

      <!-- ============================================================== -->
      <!-- FASE 0: ESPERANDO QUE EL ADMIN INICIE LA RONDA -->
      <!-- ============================================================== -->
      <div *ngIf="!estado || estado.fase === 'esperando'" class="bg-slate-900 p-6 sm:p-8 rounded-2xl w-full max-w-xl mx-auto text-center border border-slate-700">
        <span class="text-5xl">🧠</span>
        <h3 class="text-2xl font-black text-yellow-400 mt-2 uppercase tracking-wide">
          La Subasta de Respuestas
        </h3>
        <p class="text-slate-300 text-sm mt-2 max-w-md mx-auto">
          Se propone una categoría. Cada participante escribe todas las respuestas que se le ocurran antes de que acabe el tiempo.
          Después elegís las que presentaréis y el árbitro valida cada una.
        </p>

        <div class="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          <span class="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
            Dificultad: <strong class="text-yellow-400 capitalize">{{ getEtiquetaDificultad() }}</strong>
          </span>
          <span class="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
            Tiempo: <strong class="text-emerald-400">{{ tiempoSegundos }}s</strong>
          </span>
          <span class="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
            Puntos por respuesta válida: <strong class="text-cyan-400">{{ puntosPorRespuesta }}</strong>
          </span>
        </div>

        <!-- Ajustes (solo Admin) -->
        <div *ngIf="isAdmin" class="mt-5 p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-left space-y-3">
          <span class="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚙️</span>
            <span>Ajustes de la Partida (Admin)</span>
          </span>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] uppercase text-slate-400 font-bold mb-1">Dificultad</label>
              <select [(ngModel)]="dificultadEdit" (ngModelChange)="guardarAjustes()"
                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-yellow-400 transition">
                <option value="facil">🟢 Fácil</option>
                <option value="media">🟡 Media</option>
                <option value="dificil">🔴 Difícil</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] uppercase text-slate-400 font-bold mb-1">Tiempo (seg)</label>
              <select [(ngModel)]="tiempoSegundosEdit" (ngModelChange)="guardarAjustes()"
                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-yellow-400 transition">
                <option [ngValue]="30">30 seg</option>
                <option [ngValue]="45">45 seg (Estándar)</option>
                <option [ngValue]="60">60 seg</option>
                <option [ngValue]="90">90 seg</option>
              </select>
            </div>
          </div>

          <p class="text-[10px] text-slate-400 italic">{{ getDescripcionDificultadEdit() }}</p>

          <div *ngIf="errorCarga" class="p-2 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs">
            ⚠️ {{ errorCarga }}
          </div>

          <button (click)="iniciarRonda()" [disabled]="cargando"
                  class="w-full mt-2 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 disabled:opacity-60 text-purple-950 font-black py-3 rounded-xl transition uppercase tracking-wider shadow-lg text-sm">
            {{ cargando ? '⏳ Cargando categoría...' : '🚀 Iniciar Ronda Ahora' }}
          </button>
        </div>

        <div *ngIf="!isAdmin" class="mt-6 p-4 bg-slate-800/60 rounded-xl text-slate-400 text-sm animate-pulse">
          ⏳ Esperando a que el administrador dé la salida a la ronda...
        </div>

        <div class="mt-4">
          <button (click)="clasificacionRequested.emit()" class="text-xs text-slate-400 hover:text-white underline">
            🏆 Ver clasificación actual
          </button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- FASE 1: RESPONDIENDO / CUENTA ATRÁS Y ENVÍO DE RESPUESTAS -->
      <!-- ============================================================== -->
      <div *ngIf="estado && estado.fase === 'respondiendo'" class="w-full max-w-2xl mx-auto space-y-4">

        <div class="bg-slate-900 p-5 rounded-2xl border-2 border-indigo-500 text-center shadow-xl">
          <div class="flex items-center justify-between mb-3 px-2">
            <span class="text-xs uppercase font-bold text-slate-400 tracking-wider">Categoría</span>
            <div class="flex items-center gap-1.5 font-mono text-xl font-black"
                 [ngClass]="segundosRestantes <= 10 ? 'text-rose-400 animate-pulse' : 'text-yellow-400'">
              <span>⏱️</span>
              <span>{{ segundosRestantes }}s</span>
            </div>
          </div>

          <h3 class="text-2xl sm:text-3xl font-black text-yellow-300 leading-tight">{{ estado.categoria }}</h3>
          <p *ngIf="estado.descripcion" class="text-sm text-slate-300 mt-1">{{ estado.descripcion }}</p>

          <p class="text-xs text-slate-400 mt-3">
            Escribe todas las respuestas que se te ocurran. ¡Al finalizar el tiempo se unificarán!
          </p>

          <!-- Botón descartar categoría (solo admin) -->
          <button *ngIf="isAdmin" (click)="descartarCategoriaActual()" [disabled]="cargando"
                  class="mt-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-slate-100 font-semibold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition">
            {{ cargando ? '⏳ Cargando nueva categoría...' : '🔄 No me gusta, cambiar' }}
          </button>
        </div>

        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
          <label class="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">
            Escribe una respuesta
          </label>
          <div class="flex gap-2">
            <input type="text" [(ngModel)]="respuestaBorrador" (keyup.enter)="enviarRespuesta()"
                   placeholder="Escribe tu respuesta..."
                   autocomplete="off" autocorrect="off" spellcheck="false"
                   class="flex-1 bg-slate-900 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-cyan-400" />
            <button (click)="enviarRespuesta()"
                    class="bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-black px-6 py-3 rounded-xl transition uppercase tracking-wide">
              Añadir ➕
            </button>
          </div>
          <div *ngIf="errorRespuesta" class="mt-2 text-rose-400 text-xs font-semibold">
            ⚠️ {{ errorRespuesta }}
          </div>

          <div class="mt-4 pt-3 border-t border-slate-700">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Mis respuestas ({{ misRespuestas.length }}):</span>
            <div class="flex flex-wrap gap-2 mt-2">
              <div *ngFor="let r of misRespuestas"
                   class="bg-slate-900 border border-slate-700 text-emerald-400 font-bold px-3 py-1 rounded-lg text-sm">
                {{ r.respuesta }}
              </div>
              <div *ngIf="misRespuestas.length === 0" class="text-xs text-slate-500 italic">
                Aún no has añadido respuestas en esta ronda.
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="isAdmin" class="text-right">
          <button (click)="pasarASeleccion()"
                  class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 transition">
            ⏭️ Parar tiempo y pasar a selección
          </button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- FASE 2: SELECCIÓN DE RESPUESTAS POR GRUPO -->
      <!-- ============================================================== -->
      <div *ngIf="estado && estado.fase === 'seleccion'" class="w-full max-w-3xl mx-auto space-y-4">

        <div class="bg-slate-900 p-5 rounded-2xl border-2 border-purple-500 text-center shadow-xl">
          <span class="text-4xl">🎯</span>
          <h3 class="text-2xl font-black text-yellow-400 uppercase tracking-wide mt-1">Fase de Selección</h3>
          <p class="text-sm text-slate-300 mt-1">
            Categoría: <strong class="text-white">{{ estado.categoria }}</strong>
          </p>
          <p class="text-xs text-slate-400 mt-2">
            Elegid las respuestas que queréis presentar. Podéis elegir varias. Cuando estéis conformes, confirmad vuestra selección.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div *ngFor="let g of gruposSubasta"
               class="bg-slate-800 rounded-2xl p-5 border-2 transition"
               [ngClass]="g.seleccion?.confirmada ? 'border-emerald-500' : 'border-slate-700'">

            <div class="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
              <h4 class="font-black text-lg text-white flex items-center gap-2">
                <span>🛡️ {{ g.nombre }}</span>
                <span *ngIf="g.esMiGrupo" class="text-[10px] bg-purple-700 text-white px-2 py-0.5 rounded-full uppercase">Tu equipo</span>
              </h4>
              <span *ngIf="g.seleccion?.confirmada" class="text-xs bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-2 py-1 rounded-lg font-bold">
                ✓ Confirmada
              </span>
              <span *ngIf="!g.seleccion?.confirmada" class="text-xs bg-amber-950/80 text-amber-300 border border-amber-600/40 px-2 py-1 rounded-lg font-semibold animate-pulse">
                ⏳ Eligiendo...
              </span>
            </div>

            <!-- Vista completa: mi grupo o árbitro sin equipo -->
            <ng-container *ngIf="puedeVerDetallesGrupo(g); else ocultoTpl">
              <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                <div *ngFor="let r of g.respuestas"
                     class="flex items-center justify-between p-2 rounded-xl text-sm transition"
                     [ngClass]="estaElegida(g, r.clave) ? 'bg-indigo-900/70 border border-indigo-400' : 'bg-slate-900 hover:bg-slate-700/60'">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-cyan-300">{{ r.texto }}</span>
                    <span class="text-xs text-slate-500">({{ r.jugador }})</span>
                  </div>
                  <button (click)="toggleRespuesta(g, r)" [disabled]="g.seleccion?.confirmada"
                          class="px-2.5 py-1 text-xs rounded-lg font-bold transition disabled:opacity-50"
                          [ngClass]="estaElegida(g, r.clave) ? 'bg-emerald-500 text-slate-950' : 'bg-indigo-600 hover:bg-indigo-500 text-white'">
                    {{ estaElegida(g, r.clave) ? 'Quitar' : 'Elegir' }}
                  </button>
                </div>
                <div *ngIf="g.respuestas.length === 0" class="text-xs text-slate-500 text-center py-4 italic">
                  Nadie de este equipo aportó respuestas en esta ronda.
                </div>
              </div>

              <div *ngIf="!g.seleccion?.confirmada" class="mt-3">
                <button (click)="confirmarGrupo(g)" [disabled]="!tieneElegidas(g)"
                        class="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black py-2 rounded-lg text-xs uppercase tracking-wide transition">
                  ✅ Confirmar selección ({{ tieneElegidas(g) ? (g.seleccion?.elegidas?.length || 0) : 0 }})
                </button>
              </div>
            </ng-container>

            <!-- Vista oculta: equipo rival -->
            <ng-template #ocultoTpl>
              <div class="space-y-1.5">
                <div *ngFor="let r of g.respuestas" class="flex items-center justify-between p-2 rounded-xl text-sm bg-slate-900/70 border border-slate-800">
                  <span class="font-mono text-slate-500 tracking-widest">• • •</span>
                  <span class="text-xs text-slate-500 italic">🔒 Respuesta secreta</span>
                </div>
                <div *ngIf="g.respuestas.length === 0" class="text-xs text-slate-500 text-center py-4 italic">
                  El equipo rival no ha aportado respuestas.
                </div>
              </div>
              <div class="mt-3 text-xs text-slate-400">
                <span *ngIf="g.seleccion?.confirmada">🔒 Selección cerrada. Se revelará al final.</span>
                <span *ngIf="!g.seleccion?.confirmada">Eligiendo sus respuestas...</span>
              </div>
            </ng-template>
          </div>
        </div>

        <div *ngIf="isAdmin" class="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div class="text-xs text-slate-300">👑 Control Admin: cuando todos hayan confirmado, la ronda pasa sola a revelación.</div>
          <button (click)="pasarARevelacion()"
                  class="bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition">
            👁️ Revelar Resultados
          </button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- FASE 3: REVELACIÓN Y ÁRBITRO ADMIN -->
      <!-- ============================================================== -->
      <div *ngIf="estado && estado.fase === 'revelacion'" class="w-full max-w-3xl mx-auto space-y-4">

        <div class="bg-slate-900 p-6 rounded-2xl border-4 border-yellow-500 text-center shadow-2xl">
          <span class="text-5xl">🏆</span>
          <h3 class="text-3xl font-black text-yellow-400 uppercase tracking-wide mt-2">Resultados de la Ronda</h3>
          <p class="text-sm text-slate-300 mt-1">
            Categoría: <strong class="text-white">{{ estado.categoria }}</strong>
            · {{ puntosPorRespuesta }} pt{{ puntosPorRespuesta === 1 ? '' : 's' }} por respuesta válida
          </p>

          <div *ngIf="isAdmin" class="mt-2 text-xs text-amber-300 font-semibold bg-amber-950/50 py-1 px-3 rounded-lg inline-block border border-amber-600/40">
            👑 Eres el árbitro: pulsa "Invalidar" en cualquier respuesta que no sea válida.
          </div>
        </div>

        <!-- Referencia del árbitro (solo Admin) -->
        <details *ngIf="isAdmin && referenciaEjemplos.length" class="bg-slate-900 p-4 rounded-2xl border border-slate-700 text-sm">
          <summary class="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-400">
            📚 Referencia del árbitro (solo tú la ves)
          </summary>
          <p *ngIf="referenciaReglas" class="text-xs text-slate-400 italic mt-2">{{ referenciaReglas }}</p>
          <div class="flex flex-wrap gap-1.5 mt-2">
            <span *ngFor="let e of referenciaEjemplos" class="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{{ e }}</span>
          </div>
        </details>

        <!-- Respuestas presentadas por cada grupo -->
        <div class="space-y-3">
          <div *ngFor="let r of resultados"
               class="bg-slate-800 rounded-2xl p-4 sm:p-5 border-2 transition"
               [ngClass]="r.validas > 0 ? 'border-yellow-400' : 'border-slate-700'">

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div class="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                <span>🛡️ {{ r.nombre }}</span>
              </div>
              <span class="text-xs font-black px-2.5 py-1 rounded-full uppercase"
                    [ngClass]="r.validas > 0 ? 'bg-yellow-400 text-slate-950' : 'bg-slate-700 text-slate-300'">
                {{ r.validas }} válida{{ r.validas === 1 ? '' : 's' }} · +{{ r.puntos }} pts
              </span>
            </div>

            <div *ngIf="r.elegidas.length === 0" class="text-xs text-slate-500 italic">
              No se presentó ninguna respuesta.
            </div>

            <div class="space-y-1.5">
              <div *ngFor="let e of r.elegidas"
                   class="flex items-center justify-between p-2 rounded-xl text-sm"
                   [ngClass]="esInvalida(r, e.clave) ? 'bg-rose-950/40 border border-rose-600/50' : 'bg-slate-900'">
                <div class="flex items-center gap-2">
                  <span class="text-lg">{{ esInvalida(r, e.clave) ? '❌' : '✅' }}</span>
                  <span class="font-semibold tracking-wide"
                        [ngClass]="esInvalida(r, e.clave) ? 'line-through text-slate-500' : 'text-cyan-300'">
                    {{ e.texto }}
                  </span>
                </div>
                <button *ngIf="isAdmin && !estado.puntosEntregados" (click)="toggleInvalida(r, e.clave)"
                        class="px-3 py-1 rounded-lg font-bold text-xs uppercase tracking-wide transition"
                        [ngClass]="esInvalida(r, e.clave) ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'">
                  {{ esInvalida(r, e.clave) ? 'Recuperar ✓' : 'Invalidar ✕' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Acciones del Admin: asignar puntos y avanzar -->
        <div *ngIf="isAdmin" class="bg-slate-900 p-5 rounded-2xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div class="text-xs text-slate-300">
            <span *ngIf="!estado.puntosEntregados">Revisadas las respuestas con el grupo, asigna los puntos.</span>
            <span *ngIf="estado.puntosEntregados" class="text-emerald-300 font-semibold">✓ Puntos asignados para esta ronda.</span>
          </div>
          <button *ngIf="!estado.puntosEntregados" (click)="asignarPuntos()"
                  class="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black px-6 py-3 rounded-xl uppercase tracking-wider text-sm shadow-lg transition">
            🎁 Asignar Puntos
          </button>
          <button *ngIf="estado.puntosEntregados" (click)="siguienteRonda()" [disabled]="cargando"
                  class="w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 disabled:opacity-60 text-slate-950 font-black px-6 py-3 rounded-xl uppercase tracking-wider text-sm shadow-lg transition">
            {{ cargando ? '⏳ Cargando...' : '▶️ Siguiente Ronda' }}
          </button>
        </div>

        <div *ngIf="!isAdmin" class="p-4 bg-slate-900/60 rounded-xl text-center text-slate-400 text-sm animate-pulse">
          ⏳ El administrador está revisando las respuestas presentadas...
        </div>
      </div>

    </div>
  `
})
export class SubastaRespuestasComponent implements OnChanges, OnInit, OnDestroy {
  @Input() sala: Sala | null = null;
  @Input() currentName: string | null = null;
  @Input() isAdmin = false;

  @Output() clasificacionRequested = new EventEmitter<void>();
  @Output() endOfGameReached = new EventEmitter<void>();

  private http = inject(HttpClient);

  // Ajustes editables (admin), sincronizados con el estado de la sala
  dificultadEdit: DificultadPalabras = 'facil';
  tiempoSegundosEdit = 45;

  // Entrada de respuestas
  respuestaBorrador = '';
  errorRespuesta: string | null = null;

  // Carga de categorías
  errorCarga: string | null = null;
  cargando = false;
  private cacheCatalogo: Partial<Record<DificultadPalabras, CategoriaSubasta[]>> = {};

  // Referencia para el árbitro (no se envía a los jugadores)
  referenciaEjemplos: string[] = [];
  referenciaReglas = '';
  private referenciaCargadaId: string | null = null;

  // Temporizador local
  segundosRestantes = 45;
  private timerInterval: any = null;
  private stateUpdateListener: any = null;

  get estado(): EstadoSubastaRespuestas | null {
    return this.sala?.estadoSubasta || null;
  }

  get tiempoSegundos(): number {
    return this.estado?.tiempoLimite || 45;
  }

  get puntosPorRespuesta(): number {
    return this.estado?.puntosPorRespuesta || (this.estado?.dificultad === 'dificil' ? 2 : 1);
  }

  get nombreUsuario(): string {
    return this.currentName || this.sala?.jugadores[0]?.nombre || 'Jugador';
  }

  get misRespuestas(): RespuestaSubastaAportada[] {
    const yo = this.nombreUsuario.toLowerCase();
    return (this.estado?.respuestasAportadas || [])
      .filter(r => r.jugador.toLowerCase() === yo);
  }

  getEtiquetaDificultad(): string {
    switch (this.estado?.dificultad || this.dificultadEdit) {
      case 'facil': return 'Fácil 🟢';
      case 'media': return 'Media 🟡';
      case 'dificil': return 'Difícil 🔴';
      default: return '';
    }
  }

  getDescripcionDificultadEdit(): string {
    switch (this.dificultadEdit) {
      case 'facil': return '🟢 Fácil: categorías cotidianas y conocidas. 1 punto por respuesta válida.';
      case 'media': return '🟡 Media: categorías más específicas. 1 punto por respuesta válida.';
      case 'dificil': return '🔴 Difícil: categorías de nicho. 2 puntos por respuesta válida.';
      default: return '';
    }
  }

  constructor(private salaService: SalaService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sala'] && this.sala) {
      this.syncFromSala();
      this.syncTimer();
      this.cargarReferencia();
    }
  }

  ngOnInit(): void {
    this.stateUpdateListener = () => this.refrescar();
    if (typeof window !== 'undefined') {
      window.addEventListener('mpj_state_updated', this.stateUpdateListener as EventListener);
    }
    this.cargarReferencia();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.stateUpdateListener && typeof window !== 'undefined') {
      window.removeEventListener('mpj_state_updated', this.stateUpdateListener as EventListener);
    }
  }

  private refrescar(): void {
    if (!this.sala) return;
    const actualizada = this.salaService.obtenerSalaPorCodigo(this.sala.codigo);
    if (actualizada) {
      this.sala = actualizada;
      this.syncFromSala();
      this.syncTimer();
      this.cargarReferencia();
    }
  }

  private syncFromSala(): void {
    if (this.estado) {
      this.dificultadEdit = (this.estado.dificultad as DificultadPalabras) || 'facil';
      this.tiempoSegundosEdit = this.estado.tiempoLimite || 45;
    }
  }

  private syncTimer(): void {
    if (this.estado?.fase === 'respondiendo' && this.estado.tiempoFin) {
      if (!this.timerInterval) {
        this.timerInterval = setInterval(() => {
          if (!this.estado?.tiempoFin) return;
          const s = Math.max(0, Math.ceil((this.estado.tiempoFin - Date.now()) / 1000));
          this.segundosRestantes = s;
          if (s <= 0) {
            this.stopTimer();
            if (this.isAdmin && this.sala) {
              this.salaService.pasarASeleccionSubasta(this.sala.codigo);
            }
          }
        }, 500);
      }
    } else {
      this.stopTimer();
      if (this.estado?.tiempoLimite) this.segundosRestantes = this.estado.tiempoLimite;
    }
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ---------- Categorías ----------

  private async cargarCatalogo(dif: DificultadPalabras): Promise<CategoriaSubasta[]> {
    const cacheado = this.cacheCatalogo[dif];
    if (cacheado) return cacheado;
    const lista = await firstValueFrom(
      this.http.get<CategoriaSubasta[]>(`assets/games/subasta-respuestas/categorias_${dif}.json`)
    );
    this.cacheCatalogo[dif] = lista;
    return lista;
  }

  private async cargarReferencia(): Promise<void> {
    const est = this.estado;
    if (!this.isAdmin || !est?.categoriaId) return;
    if (this.referenciaCargadaId === est.categoriaId) return;
    try {
      const lista = await this.cargarCatalogo(est.dificultad);
      const cat = lista.find(c => c.id === est.categoriaId);
      this.referenciaEjemplos = cat?.ejemplos_validos || [];
      this.referenciaReglas = cat?.regla_arbitro || '';
      this.referenciaCargadaId = est.categoriaId;
    } catch {
      this.referenciaEjemplos = [];
    }
  }

  async guardarAjustes(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    await this.salaService.actualizarConfigSubasta(this.sala.codigo, {
      dificultad: this.dificultadEdit,
      tiempoSegundos: Number(this.tiempoSegundosEdit) || 45
    });
  }

  /** Descarta la categoría actual, carga una nueva y reinicia en fase respondiendo (tiempo desde cero). */
  async descartarCategoriaActual(): Promise<void> {
    if (!this.isAdmin || !this.sala || !this.estado) return;
    this.errorCarga = null;
    this.cargando = true;
    try {
      const dif = this.dificultadEdit;
      const catalogo = await this.cargarCatalogo(dif);
      if (!catalogo.length) throw new Error('catálogo vacío');

      const usadas = this.estado?.categoriasUsadas || [];
      const categoriaActualId = this.estado?.categoriaId;
      // NO añadir la actual a usadas; solo usar las anteriores
      let pool = catalogo.filter(c => !usadas.includes(c.id) && c.id !== categoriaActualId);
      if (pool.length === 0) {
        pool = catalogo.filter(c => c.id !== categoriaActualId);
      }
      if (pool.length === 0) {
        pool = catalogo;
      }
      const elegida = pool[Math.floor(Math.random() * pool.length)];

      // Llamar directamente a iniciarRondaSubasta para reiniciar en fase respondiendo
      await this.salaService.iniciarRondaSubasta(
        this.sala.codigo,
        { id: elegida.id, categoria: elegida.categoria, descripcion: elegida.descripcion },
        Number(this.tiempoSegundosEdit) || 45,
        dif,
        usadas  // Mismas categorías usadas (sin la actual ni la nueva)
      );
      this.refrescar();
    } catch (e) {
      console.error('[SubastaRespuestas] Error descartando categoría', e);
      this.errorCarga = 'No se pudo cargar una nueva categoría.';
    } finally {
      this.cargando = false;
    }
  }

  /** Elige una categoría aleatoria que aún no se haya jugado en esta partida y arranca la ronda. */
  async iniciarRonda(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    this.errorCarga = null;
    this.cargando = true;
    try {
      await this.guardarAjustes();
      const dif = this.dificultadEdit;
      const catalogo = await this.cargarCatalogo(dif);
      if (!catalogo.length) throw new Error('catálogo vacío');

      const usadas = this.estado?.categoriasUsadas || [];
      let pool = catalogo.filter(c => !usadas.includes(c.id));
      let usadasActualizadas = usadas;
      if (pool.length === 0) {
        pool = catalogo;
        usadasActualizadas = [];
      }
      const elegida = pool[Math.floor(Math.random() * pool.length)];

      await this.salaService.iniciarRondaSubasta(
        this.sala.codigo,
        { id: elegida.id, categoria: elegida.categoria, descripcion: elegida.descripcion },
        Number(this.tiempoSegundosEdit) || 45,
        dif,
        [...usadasActualizadas, elegida.id]
      );
      this.refrescar();
    } catch (e) {
      console.error('[SubastaRespuestas] Error cargando categorías', e);
      this.errorCarga = 'No se pudo cargar la categoría. Comprueba que los ficheros categorias_*.json están en src/assets/games/subasta-respuestas/.';
    } finally {
      this.cargando = false;
    }
  }

  // ---------- Fase de respuestas ----------

  async enviarRespuesta(): Promise<void> {
    this.errorRespuesta = null;
    if (!this.sala) return;
    const texto = (this.respuestaBorrador || '').trim().replace(/\s+/g, ' ');
    if (texto.length < 2) {
      this.errorRespuesta = 'La respuesta debe tener al menos 2 letras.';
      return;
    }
    const yo = this.sala.jugadores.find(j => j.nombre.toLowerCase() === this.nombreUsuario.toLowerCase());
    const ok = await this.salaService.enviarRespuestaSubasta(this.sala.codigo, this.nombreUsuario, yo?.equipoId, texto);
    if (ok) {
      this.respuestaBorrador = '';
      // Dar tiempo a que la transacción se propague antes de refrescar
      await new Promise(resolve => setTimeout(resolve, 100));
      this.refrescar();
    } else {
      this.errorRespuesta = 'Esa respuesta ya la has añadido.';
    }
  }

  async pasarASeleccion(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    await this.salaService.pasarASeleccionSubasta(this.sala.codigo);
    this.refrescar();
  }

  // ---------- Fase de selección ----------

  get gruposSubasta(): GrupoSubasta[] {
    if (!this.sala || !this.estado) return [];

    const miNombre = this.nombreUsuario.toLowerCase();
    const yo = this.sala.jugadores.find(j => j.nombre.toLowerCase() === miNombre);
    const aportadas = this.estado.respuestasAportadas || [];
    const selecciones = this.estado.selecciones || {};

    const sinDuplicados = (lista: RespuestaSubastaAportada[]): RespuestaUnica[] => {
      const vistas = new Set<string>();
      const out: RespuestaUnica[] = [];
      lista.forEach(r => {
        if (!vistas.has(r.clave)) {
          vistas.add(r.clave);
          out.push({ clave: r.clave, texto: r.respuesta, jugador: r.jugador });
        }
      });
      return out;
    };

    if (this.sala.modoJuego === 'individual') {
      return this.sala.jugadores.map(j => ({
        id: j.nombre,
        nombre: j.nombre,
        esMiGrupo: j.nombre.toLowerCase() === miNombre,
        respuestas: sinDuplicados(aportadas.filter(r => r.jugador.toLowerCase() === j.nombre.toLowerCase())),
        seleccion: selecciones[j.nombre]
      }));
    }

    return (this.sala.equipos || []).map(eq => ({
      id: eq.id,
      nombre: eq.nombre,
      esMiGrupo: yo?.equipoId === eq.id,
      respuestas: sinDuplicados(aportadas.filter(r => r.equipoId === eq.id)),
      seleccion: selecciones[eq.id]
    }));
  }

  /** Mismas reglas de visibilidad que La Palabra Más Larga. */
  puedeVerDetallesGrupo(g: { id: string; esMiGrupo: boolean }): boolean {
    if (g.esMiGrupo) return true;
    if (this.sala?.modoJuego === 'individual') return false;
    if (this.isAdmin) {
      const yo = this.sala?.jugadores.find(j => j.nombre.toLowerCase() === this.nombreUsuario.toLowerCase());
      return !(yo && yo.equipoId);
    }
    return false;
  }

  estaElegida(g: GrupoSubasta, clave: string): boolean {
    return (g.seleccion?.elegidas || []).some(e => e.clave === clave);
  }

  tieneElegidas(g: GrupoSubasta): boolean {
    return (g.seleccion?.elegidas || []).length > 0;
  }

  async toggleRespuesta(g: GrupoSubasta, r: RespuestaUnica): Promise<void> {
    if (!this.sala) return;
    await this.salaService.toggleEleccionSubasta(this.sala.codigo, g.id, g.nombre, r.texto, this.nombreUsuario);
    this.refrescar();
  }

  async confirmarGrupo(g: GrupoSubasta): Promise<void> {
    if (!this.sala) return;
    await this.salaService.confirmarSeleccionSubasta(this.sala.codigo, g.id, g.nombre, this.nombreUsuario);
    this.refrescar();
  }

  async pasarARevelacion(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    await this.salaService.pasarARevelacionSubasta(this.sala.codigo);
    this.refrescar();
  }

  // ---------- Revelación y árbitro ----------

  get resultados() {
    const pts = this.puntosPorRespuesta;
    return this.gruposSubasta.map(g => {
      const elegidas = g.seleccion?.elegidas || [];
      const invalidas = g.seleccion?.invalidas || [];
      const validas = elegidas.filter(e => !invalidas.includes(e.clave)).length;
      return {
        id: g.id,
        nombre: g.nombre,
        elegidas,
        invalidas,
        validas,
        puntos: validas * pts
      };
    });
  }

  esInvalida(r: { invalidas: string[] }, clave: string): boolean {
    return r.invalidas.includes(clave);
  }

  async toggleInvalida(r: { id: string }, clave: string): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    await this.salaService.toggleInvalidaSubasta(this.sala.codigo, r.id, clave);
    this.refrescar();
  }

  async asignarPuntos(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    await this.salaService.entregarPuntosSubasta(this.sala.codigo);
    this.refrescar();
  }

  async siguienteRonda(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    const rondaActual = this.sala.rondaActual ?? 0;
    const rondasTotales = this.sala.rondasTotales ?? 5;
    if (rondaActual + 1 >= rondasTotales) {
      this.endOfGameReached.emit();
      return;
    }
    this.salaService.avanzarRonda(this.sala.codigo);
    await this.iniciarRonda();
  }
}
