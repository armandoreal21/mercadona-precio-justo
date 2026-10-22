import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sala, PalabraAportada, ModoPuntuacionPalabras } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';

@Component({
  selector: 'app-palabra-mas-larga',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col items-center gap-4 w-full">

      <!-- ============================================================== -->
      <!-- FASE 0: ESPERANDO QUE EL ADMIN INICIE LA RONDA -->
      <!-- ============================================================== -->
      <div *ngIf="!estado || estado.fase === 'esperando'" class="bg-slate-900 p-6 sm:p-8 rounded-2xl w-full max-w-xl mx-auto text-center border border-slate-700">
        <span class="text-5xl">🔤</span>
        <h3 class="text-2xl font-black text-yellow-400 mt-2 uppercase tracking-wide">
          La Palabra Más Larga
        </h3>
        <p class="text-slate-300 text-sm mt-2 max-w-md mx-auto">
          En cada ronda se sortearán entre 9 y 15 letras con vocales y consonantes.
          ¡Cada participante debe enviar todas las palabras válidas que logre formar antes de que el reloj llegue a 0!
        </p>

        <!-- Configuración de ronda previa por el Admin -->
        <div *ngIf="isAdmin" class="mt-6 bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-left space-y-3">
          <div class="text-xs font-bold text-yellow-400 uppercase tracking-wider">Ajustes de la Ronda (Admin)</div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] uppercase text-slate-400 font-bold mb-1">Nº Letras (9 - 15)</label>
              <input type="number" [(ngModel)]="numLetrasConfig" min="9" max="15"
                     class="w-full bg-slate-700 text-white rounded-lg px-3 py-1.5 font-bold border border-slate-600 focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label class="block text-[11px] uppercase text-slate-400 font-bold mb-1">Tiempo (segundos)</label>
              <input type="number" [(ngModel)]="tiempoSegundosConfig" min="15" max="120" step="5"
                     class="w-full bg-slate-700 text-white rounded-lg px-3 py-1.5 font-bold border border-slate-600 focus:outline-none focus:border-yellow-400" />
            </div>
          </div>

          <div>
            <label class="block text-[11px] uppercase text-slate-400 font-bold mb-1">Sistema de Puntuación</label>
            <select [(ngModel)]="modoPuntuacionConfig"
                    class="w-full bg-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold border border-slate-600">
              <option value="por_letras">Por Letras (ej: 8 letras = 8 puntos)</option>
              <option value="por_ganar">Por Victoria (10 puntos al ganador)</option>
            </select>
          </div>

          <button (click)="iniciarRonda()"
                  class="w-full mt-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-purple-950 font-black py-3 rounded-xl transition uppercase tracking-wider shadow-lg text-base">
            🚀 Iniciar Ronda Ahora
          </button>
        </div>

        <div *ngIf="!isAdmin" class="mt-6 p-4 bg-slate-800/60 rounded-xl text-slate-400 text-sm animate-pulse">
          ⏳ Esperando a que el administrador dé la salida a la ronda...
        </div>

        <div class="mt-4">
          <button (click)="clasificacionRequested.emit()"
                  class="text-xs text-slate-400 hover:text-white underline">
            🏆 Ver clasificación actual
          </button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- FASE 1: JUGANDO / CUENTA ATRÁS Y ENVÍO DE PALABRAS -->
      <!-- ============================================================== -->
      <div *ngIf="estado && estado.fase === 'jugando'" class="w-full max-w-2xl mx-auto space-y-4">

        <!-- Letras y Reloj -->
        <div class="bg-slate-900 p-5 rounded-2xl border-2 border-indigo-500 text-center shadow-xl">
          <div class="flex items-center justify-between mb-3 px-2">
            <span class="text-xs uppercase font-bold text-slate-400 tracking-wider">Letras disponibles</span>
            <div class="flex items-center gap-1.5 font-mono text-xl font-black"
                 [ngClass]="segundosRestantes <= 10 ? 'text-rose-400 animate-pulse' : 'text-yellow-400'">
              <span>⏱️</span>
              <span>{{ segundosRestantes }}s</span>
            </div>
          </div>

          <!-- Muestra de letras como fichas de Scrabble / Cifras -->
          <div class="flex flex-wrap justify-center gap-2 sm:gap-3 py-2">
            <div *ngFor="let l of estado.letras"
                 class="w-11 h-12 sm:w-14 sm:h-16 bg-gradient-to-b from-amber-200 to-amber-400 text-slate-950 font-black text-2xl sm:text-3xl rounded-xl shadow-lg border-2 border-amber-500 flex items-center justify-center transform hover:scale-105 transition select-none">
              {{ l }}
            </div>
          </div>

          <p class="text-xs text-slate-400 mt-2">
            Puedes enviar tantas palabras como se te ocurran. ¡Al finalizar el tiempo se unificarán!
          </p>
        </div>

        <!-- Input para enviar palabras -->
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg">
          <label class="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">
            Introduce una palabra con estas letras
          </label>
          <div class="flex gap-2">
            <input type="text" [(ngModel)]="palabraBorrador" (keyup.enter)="enviarPalabra()"
                   placeholder="Escribe tu palabra..."
                   autocomplete="off" autocorrect="off" spellcheck="false"
                   class="flex-1 bg-slate-900 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-bold tracking-wider uppercase text-lg focus:outline-none focus:border-cyan-400" />
            <button (click)="enviarPalabra()"
                    class="bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-black px-6 py-3 rounded-xl transition uppercase tracking-wide">
              Añadir ➕
            </button>
          </div>
          <div *ngIf="errorPalabra" class="mt-2 text-rose-400 text-xs font-semibold">
            ⚠️ {{ errorPalabra }}
          </div>

          <!-- Mis palabras enviadas en esta ronda -->
          <div class="mt-4 pt-3 border-t border-slate-700">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Mis aportaciones ({{ misPalabras.length }}):</span>
              <span class="text-[11px] text-cyan-400">Las más largas valen más</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <div *ngFor="let p of misPalabras"
                   class="bg-slate-900 border border-slate-700 text-emerald-400 font-bold px-3 py-1 rounded-lg text-sm flex items-center gap-1.5">
                <span>{{ p.palabra }}</span>
                <span class="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                  {{ p.longitud }} letras
                </span>
              </div>
              <div *ngIf="misPalabras.length === 0" class="text-xs text-slate-500 italic">
                Aún no has añadido palabras en esta ronda.
              </div>
            </div>
          </div>
        </div>

        <!-- Botón de admin para pasar a selección si quiere terminar antes -->
        <div *ngIf="isAdmin" class="text-right">
          <button (click)="finalizarTiempoManual()"
                  class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 transition">
            ⏭️ Parar tiempo y pasar a selección
          </button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- FASE 2: SELECCIÓN DE PALABRA DE EQUIPO / INDIVIDUAL -->
      <!-- ============================================================== -->
      <div *ngIf="estado && estado.fase === 'seleccion'" class="w-full max-w-3xl mx-auto space-y-4">
        <div class="bg-slate-900 p-5 rounded-2xl border-2 border-purple-500 text-center shadow-xl">
          <span class="text-4xl">🎯</span>
          <h3 class="text-2xl font-black text-yellow-400 uppercase tracking-wide mt-1">
            Fase de Selección
          </h3>
          <p class="text-sm text-slate-300 mt-1">
            Revisad la lista completa de palabras de vuestro equipo. Con que <strong>un miembro</strong> elija una palabra, el equipo quedará presentado.
          </p>

          <!-- Letras de referencia -->
          <div class="flex justify-center gap-1.5 mt-3">
            <span *ngFor="let l of estado.letras"
                  class="w-7 h-7 bg-amber-400 text-slate-950 text-xs font-black rounded flex items-center justify-center">
              {{ l }}
            </span>
          </div>
        </div>

        <!-- Columnas / Tarjetas por grupo o equipo -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div *ngFor="let g of gruposPalabras"
               class="bg-slate-800 rounded-2xl p-5 border-2 transition"
               [ngClass]="g.seleccion ? 'border-emerald-500 bg-slate-800/90' : 'border-slate-700'">

            <!-- Cabecera de equipo / grupo -->
            <div class="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
              <div>
                <h4 class="font-black text-lg text-white flex items-center gap-2">
                  <span>🛡️ {{ g.nombre }}</span>
                  <span *ngIf="g.esMiGrupo" class="text-[10px] bg-purple-700 text-white px-2 py-0.5 rounded-full uppercase">Tu equipo</span>
                </h4>
                <div class="text-xs text-slate-400">
                  Total palabras: {{ g.palabras.length }}
                </div>
              </div>

              <!-- Estado de selección -->
              <div>
                <span *ngIf="g.seleccion" class="text-xs bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                  ✓ Elegida: {{ g.seleccion.palabra }}
                </span>
                <span *ngIf="!g.seleccion" class="text-xs bg-amber-950/80 text-amber-300 border border-amber-600/40 px-2 py-1 rounded-lg font-semibold animate-pulse">
                  ⏳ Pendiente
                </span>
              </div>
            </div>

            <!-- Si ya hay selección, mostrar detalle de quién la seleccionó -->
            <div *ngIf="g.seleccion" class="mb-3 p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-xs text-emerald-200">
              Palabra presentada: <strong class="text-base text-yellow-300 tracking-wider uppercase ml-1">{{ g.seleccion.palabra }}</strong>
              <div class="text-slate-400 text-[11px] mt-0.5">
                ({{ g.seleccion.longitud }} letras) — Elegida por: <strong class="text-white">{{ g.seleccion.seleccionadaPor }}</strong>
              </div>
            </div>

            <!-- Listado de palabras aportadas ordenadas por longitud descendente -->
            <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              <div *ngFor="let p of g.palabras"
                   class="flex items-center justify-between p-2 rounded-xl text-sm transition"
                   [ngClass]="g.seleccion?.palabra === p.palabra ? 'bg-indigo-900/70 border border-indigo-400 font-bold' : 'bg-slate-900 hover:bg-slate-700/60'">

                <div class="flex items-center gap-2">
                  <span class="font-mono text-cyan-300 font-bold text-base tracking-wider">{{ p.palabra }}</span>
                  <span class="text-xs text-slate-400">({{ p.jugador }})</span>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-xs bg-slate-800 text-yellow-300 px-2 py-0.5 rounded font-bold font-mono">
                    {{ p.longitud }} ltr
                  </span>
                  <!-- Botón elegir (disponible si pertenece a mi equipo o si soy admin) -->
                  <button *ngIf="g.esMiGrupo || isAdmin"
                          (click)="elegirPalabraEquipo(g.id, g.nombre, p.palabra)"
                          class="px-2.5 py-1 text-xs rounded-lg font-bold transition"
                          [ngClass]="g.seleccion?.palabra === p.palabra ? 'bg-emerald-500 text-slate-950' : 'bg-indigo-600 hover:bg-indigo-500 text-white'">
                    {{ g.seleccion?.palabra === p.palabra ? 'Elegida' : 'Elegir' }}
                  </button>
                </div>
              </div>

              <div *ngIf="g.palabras.length === 0" class="text-xs text-slate-500 text-center py-4 italic">
                Nadie de este equipo aportó palabras en esta ronda.
              </div>
            </div>
          </div>
        </div>

        <!-- Botón de admin para forzar revelación si algún equipo se queda rezagado -->
        <div *ngIf="isAdmin" class="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div class="text-xs text-slate-300">
            👑 Control Admin: Si todos han elegido o quieres resolver la ronda:
          </div>
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
          <h3 class="text-3xl font-black text-yellow-400 uppercase tracking-wide mt-2">
            Resultados de la Ronda
          </h3>
          <p class="text-xs text-slate-300 mt-1">
            Sistema de puntos: <strong>{{ estado.modoPuntuacion === 'por_letras' ? 'Puntos por longitud de letra' : 'Puntos por victoria (10 pts)' }}</strong>
          </p>

          <div *ngIf="isAdmin" class="mt-2 text-xs text-amber-300 font-semibold bg-amber-950/50 py-1 px-3 rounded-lg inline-block border border-amber-600/40">
            👑 Eres el árbitro: puedes descartar cualquier palabra si el grupo no la considera válida en español.
          </div>
        </div>

        <!-- Lista de palabras presentadas por cada equipo -->
        <div class="space-y-3">
          <div *ngFor="let r of resultadosPresentados"
               class="bg-slate-800 rounded-2xl p-4 sm:p-5 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
               [ngClass]="{
                 'border-rose-600/70 opacity-60 bg-slate-900/80': r.descartada,
                 'border-yellow-400 bg-slate-800 shadow-lg': !r.descartada && r.esGanador,
                 'border-slate-700': !r.descartada && !r.esGanador
               }">

            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ r.descartada ? '❌' : (r.esGanador ? '🥇' : '🛡️') }}</span>
              <div>
                <div class="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                  <span>{{ r.nombreEquipo }}</span>
                  <span *ngIf="!r.descartada && r.esGanador" class="text-xs bg-yellow-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                    ¡Ganador! (+{{ r.puntos }} pts)
                  </span>
                  <span *ngIf="r.descartada" class="text-xs bg-rose-900 text-rose-200 font-bold px-2 py-0.5 rounded-full uppercase">
                    Descartada por el árbitro
                  </span>
                </div>
                <div class="text-xs text-slate-400">
                  Seleccionada por: <strong class="text-slate-200">{{ r.seleccionadaPor }}</strong>
                </div>
              </div>
            </div>

            <!-- Palabra y longitud -->
            <div class="flex items-center justify-between sm:justify-end gap-3">
              <div class="text-right">
                <span class="text-xl sm:text-2xl font-mono font-black tracking-widest text-cyan-300 block"
                      [class.line-through]="r.descartada">
                  {{ r.palabra || '— SIN PALABRA —' }}
                </span>
                <span class="text-xs text-slate-400 font-mono">
                  {{ r.longitud }} letras
                </span>
              </div>

              <!-- Control Admin: Validar / Descartar palabra -->
              <div *ngIf="isAdmin && r.palabra">
                <button (click)="toggleDescarte(r.equipoId)"
                        class="px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wide transition"
                        [ngClass]="r.descartada ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'">
                  {{ r.descartada ? 'Recuperar ✓' : 'Invalidar ✕' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Acciones del Administrador para cerrar la ronda y otorgar puntos -->
        <div *ngIf="isAdmin" class="bg-slate-900 p-5 rounded-2xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div class="text-xs text-slate-300">
            Una vez revisadas las palabras con el grupo, pulsa para adjudicar puntos y avanzar:
          </div>
          <button (click)="confirmarPuntosYAvanzar()"
                  class="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black px-6 py-3 rounded-xl uppercase tracking-wider text-sm shadow-lg transition">
            🎁 Asignar Puntos y Siguiente Ronda
          </button>
        </div>

        <div *ngIf="!isAdmin" class="p-4 bg-slate-900/60 rounded-xl text-center text-slate-400 text-sm animate-pulse">
          ⏳ El administrador está revisando las palabras presentadas...
        </div>
      </div>

    </div>
  `
})
export class PalabraMasLargaComponent implements OnChanges, OnDestroy {
  @Input() sala: Sala | null = null;
  @Input() currentName: string | null = null;
  @Input() isAdmin = false;

  @Output() clasificacionRequested = new EventEmitter<void>();
  @Output() endOfGameReached = new EventEmitter<void>();

  // Configuración de partida
  numLetrasConfig = 10;
  tiempoSegundosConfig = 45;
  modoPuntuacionConfig: ModoPuntuacionPalabras = 'por_letras';

  // Input borrador de palabra
  palabraBorrador = '';
  errorPalabra: string | null = null;

  // Temporizador local para fluidez
  segundosRestantes = 45;
  private timerInterval: any = null;

  get estado() {
    return this.sala?.estadoPalabras || null;
  }

  constructor(private salaService: SalaService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sala'] && this.sala) {
      this.syncTimer();
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private syncTimer() {
    if (this.estado?.fase === 'jugando' && this.estado.tiempoFin) {
      if (!this.timerInterval) {
        this.timerInterval = setInterval(() => {
          if (!this.estado?.tiempoFin) return;
          const diffMs = this.estado.tiempoFin - Date.now();
          const s = Math.max(0, Math.ceil(diffMs / 1000));
          this.segundosRestantes = s;

          if (s <= 0) {
            this.stopTimer();
            if (this.isAdmin && this.sala) {
              this.salaService.pasarAFaseSeleccionPalabras(this.sala.codigo);
            }
          }
        }, 500);
      }
    } else {
      this.stopTimer();
      if (this.estado?.tiempoLimite) {
        this.segundosRestantes = this.estado.tiempoLimite;
      }
    }
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Generador equilibrado de vocales y consonantes
  generarLetrasEquilibradas(n: number): string[] {
    const vocales = 'AAAAAEEEEIIIOOOU';
    const consonantes = 'BCDFGHJKLMNPQRSTVWXYZ';
    const letras: string[] = [];

    // Aproximadamente 40-45% vocales
    const cantVocales = Math.max(3, Math.round(n * 0.42));
    const cantConsonantes = n - cantVocales;

    for (let i = 0; i < cantVocales; i++) {
      letras.push(vocales[Math.floor(Math.random() * vocales.length)]);
    }
    for (let i = 0; i < cantConsonantes; i++) {
      letras.push(consonantes[Math.floor(Math.random() * consonantes.length)]);
    }

    // Barajar
    return letras.sort(() => Math.random() - 0.5);
  }

  iniciarRonda(): void {
    if (!this.isAdmin || !this.sala) return;
    const n = Math.max(9, Math.min(15, Number(this.numLetrasConfig) || 10));
    const t = Math.max(15, Math.min(120, Number(this.tiempoSegundosConfig) || 45));
    const letras = this.generarLetrasEquilibradas(n);

    this.salaService.iniciarRondaPalabras(this.sala.codigo, letras, t, this.modoPuntuacionConfig);
  }

  finalizarTiempoManual(): void {
    if (!this.isAdmin || !this.sala) return;
    this.salaService.pasarAFaseSeleccionPalabras(this.sala.codigo);
  }

  // Validación rápida: ¿las letras de la palabra existen en la tirada generada?
  validarLetrasDisponibles(palabra: string): boolean {
    if (!this.estado?.letras) return false;
    const pool = [...this.estado.letras];
    const up = palabra.toUpperCase();

    for (const char of up) {
      const idx = pool.indexOf(char);
      if (idx === -1) return false;
      pool.splice(idx, 1);
    }
    return true;
  }

  async enviarPalabra(): Promise<void> {
    this.errorPalabra = null;
    if (!this.sala) {
      this.errorPalabra = 'No se ha detectado la sala activa.';
      return;
    }

    const nombreUsuario = this.currentName || this.sala.jugadores[0]?.nombre || 'Jugador';
    const clean = (this.palabraBorrador || '').trim().toUpperCase();
    if (!clean) return;
    if (clean.length < 2) {
      this.errorPalabra = 'La palabra debe tener al menos 2 letras.';
      return;
    }

    if (!this.validarLetrasDisponibles(clean)) {
      this.errorPalabra = 'Utiliza solo las letras disponibles en la pantalla.';
      return;
    }

    const yo = this.sala.jugadores.find(j => j.nombre.toLowerCase() === nombreUsuario.toLowerCase());
    const equipoId = yo?.equipoId;

    const ok = await this.salaService.enviarPalabraJugador(this.sala.codigo, nombreUsuario, equipoId, clean);
    if (ok) {
      this.palabraBorrador = '';
      this.errorPalabra = null;
      // Actualizar vista local inmediata
      this.sala = this.salaService.obtenerSalaPorCodigo(this.sala.codigo);
    } else {
      this.errorPalabra = 'Esa palabra ya fue añadida.';
    }
  }

  get misPalabras(): PalabraAportada[] {
    if (!this.estado?.palabrasAportadas) return [];
    const miNombre = (this.currentName || this.sala?.jugadores[0]?.nombre || '').toLowerCase();
    if (!miNombre) return [];
    return this.estado.palabrasAportadas
      .filter(p => p.jugador.toLowerCase() === miNombre)
      .sort((a, b) => b.longitud - a.longitud);
  }

  get gruposPalabras(): { id: string; nombre: string; esMiGrupo: boolean; palabras: PalabraAportada[]; seleccion?: any }[] {
    if (!this.sala || !this.estado) return [];

    const miNombre = (this.currentName || this.sala.jugadores[0]?.nombre || '').toLowerCase();
    const yo = this.sala.jugadores.find(j => j.nombre.toLowerCase() === miNombre);
    const esIndividual = this.sala.modoJuego === 'individual';

    if (esIndividual) {
      return (this.sala.jugadores || []).map(j => {
        const palabras = (this.estado?.palabrasAportadas || [])
          .filter(p => p.jugador.toLowerCase() === j.nombre.toLowerCase())
          .sort((a, b) => b.longitud - a.longitud);
        const seleccion = this.estado?.selecciones?.[j.nombre];
        return {
          id: j.nombre,
          nombre: j.nombre,
          esMiGrupo: j.nombre.toLowerCase() === miNombre,
          palabras,
          seleccion
        };
      });
    }

    // Modo equipos
    const equipos = this.sala.equipos || [];
    return equipos.map(eq => {
      const palabras = (this.estado?.palabrasAportadas || [])
        .filter(p => p.equipoId === eq.id)
        .sort((a, b) => b.longitud - a.longitud);
      const seleccion = this.estado?.selecciones?.[eq.id];
      return {
        id: eq.id,
        nombre: eq.nombre,
        esMiGrupo: yo?.equipoId === eq.id,
        palabras,
        seleccion
      };
    });
  }

  async elegirPalabraEquipo(grupoId: string, nombreGrupo: string, palabra: string): Promise<void> {
    if (!this.sala) return;
    const nombreUsuario = this.currentName || this.sala.jugadores[0]?.nombre || 'Jugador';
    await this.salaService.seleccionarPalabraEquipo(this.sala.codigo, grupoId, nombreGrupo, palabra, nombreUsuario);
    this.sala = this.salaService.obtenerSalaPorCodigo(this.sala.codigo);
  }

  pasarARevelacion(): void {
    if (!this.isAdmin || !this.sala) return;
    this.salaService.pasarARevelacionManual(this.sala.codigo);
  }

  get resultadosPresentados() {
    if (!this.sala || !this.estado?.selecciones) return [];
    const esIndividual = this.sala.modoJuego === 'individual';
    const gruposEsperados = esIndividual
      ? (this.sala.jugadores || []).map(j => ({ id: j.nombre, nombre: j.nombre }))
      : (this.sala.equipos || []).map(e => ({ id: e.id, nombre: e.nombre }));

    const lista = gruposEsperados.map(g => {
      const sel = this.estado?.selecciones?.[g.id];
      return {
        equipoId: g.id,
        nombreEquipo: sel?.nombreEquipo || g.nombre,
        palabra: sel?.palabra || '',
        longitud: sel?.longitud || 0,
        seleccionadaPor: sel?.seleccionadaPor || 'Nadie',
        descartada: !!sel?.descartada,
        esGanador: false,
        puntos: 0
      };
    });

    // Calcular ganadores entre los no descartados
    const noDescartados = lista.filter(l => !l.descartada && l.longitud > 0);
    if (noDescartados.length > 0) {
      const maxLen = Math.max(...noDescartados.map(l => l.longitud));
      const modo = this.estado.modoPuntuacion || 'por_letras';
      const pts = modo === 'por_letras' ? maxLen : 10;

      lista.forEach(item => {
        if (!item.descartada && item.longitud === maxLen && maxLen > 0) {
          item.esGanador = true;
          item.puntos = pts;
        }
      });
    }

    return lista;
  }

  toggleDescarte(grupoId: string): void {
    if (!this.isAdmin || !this.sala) return;
    this.salaService.toggleDescartePalabraAdmin(this.sala.codigo, grupoId);
  }

  confirmarPuntosYAvanzar(): void {
    if (!this.isAdmin || !this.sala) return;

    // Adjudicar puntos a los ganadores según las palabras no descartadas
    this.salaService.entregarPuntosPalabras(this.sala.codigo);

    const rondaActual = this.sala.rondaActual ?? 0;
    const rondasTotales = this.sala.rondasTotales ?? 5;
    const isFinal = (rondaActual + 1) >= rondasTotales;

    if (isFinal) {
      this.endOfGameReached.emit();
      return;
    }

    // Avanzar a la siguiente ronda
    this.salaService.avanzarRonda(this.sala.codigo);
    this.salaService.iniciarRondaPalabras(this.sala.codigo, this.generarLetrasEquilibradas(this.numLetrasConfig), this.tiempoSegundosConfig, this.modoPuntuacionConfig);
  }
}
