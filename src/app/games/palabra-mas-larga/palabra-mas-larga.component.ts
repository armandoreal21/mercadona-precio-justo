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
          En cada ronda dispondréis de <strong>{{ numLetrasFijo }} letras</strong>.
          ¡Cada participante debe enviar todas las palabras válidas que logre formar antes de que el reloj llegue a 0!
        </p>

        <!-- Indicador de configuración actual (para todos) -->
        <div class="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          <span class="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
            Dificultad: <strong class="text-yellow-400 capitalize">{{ getEtiquetaDificultad() }}</strong>
          </span>
          <span class="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
            Letras fijas: <strong class="text-cyan-400">{{ numLetrasFijo }}</strong>
          </span>
          <span class="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
            Tiempo: <strong class="text-emerald-400">{{ tiempoSegundos }}s</strong>
          </span>
        </div>

        <!-- Panel de Ajustes en la Sala (Solo Admin, permite cambiar dificultad, letras y tiempo en cualquier momento) -->
        <div *ngIf="isAdmin" class="mt-5 p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-left space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚙️</span>
              <span>Ajustes de la Partida (Admin)</span>
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
              <label class="block text-[11px] uppercase text-slate-400 font-bold mb-1">Nº Letras</label>
              <select [(ngModel)]="numLetrasEdit" (ngModelChange)="guardarAjustes()"
                      class="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-yellow-400 transition">
                <option [ngValue]="8">8 letras</option>
                <option [ngValue]="9">9 letras</option>
                <option [ngValue]="10">10 letras</option>
                <option [ngValue]="11">11 letras</option>
                <option [ngValue]="12">12 letras</option>
                <option [ngValue]="13">13 letras</option>
                <option [ngValue]="14">14 letras</option>
                <option [ngValue]="15">15 letras</option>
                <option [ngValue]="16">16 letras</option>
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

          <p class="text-[10px] text-slate-400 italic">
            {{ getDescripcionDificultadEdit() }}
          </p>

          <button (click)="iniciarRonda()"
                  class="w-full mt-2 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-purple-950 font-black py-3 rounded-xl transition uppercase tracking-wider shadow-lg text-sm">
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
            Revisad la lista de palabras de vuestro equipo. Con que <strong>un miembro</strong> elija una palabra, el equipo quedará presentado.
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
                <!-- Si es mi grupo o soy admin neutral: ver detalle. Si es rival: solo saber si ya eligieron -->
                <ng-container *ngIf="puedeVerDetallesGrupo(g)">
                  <span *ngIf="g.seleccion" class="text-xs bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                    ✓ Elegida: {{ g.seleccion.palabra }}
                  </span>
                  <span *ngIf="!g.seleccion" class="text-xs bg-amber-950/80 text-amber-300 border border-amber-600/40 px-2 py-1 rounded-lg font-semibold animate-pulse">
                    ⏳ Pendiente
                  </span>
                </ng-container>
                <ng-container *ngIf="!puedeVerDetallesGrupo(g)">
                  <span *ngIf="g.seleccion" class="text-xs bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                    ✓ Palabra elegida 🔒
                  </span>
                  <span *ngIf="!g.seleccion" class="text-xs bg-amber-950/80 text-amber-300 border border-amber-600/40 px-2 py-1 rounded-lg font-semibold animate-pulse">
                    ⏳ Eligiendo...
                  </span>
                </ng-container>
              </div>
            </div>

            <!-- Si ya hay selección: visible solo para los del propio equipo o admin neutral -->
            <div *ngIf="g.seleccion && puedeVerDetallesGrupo(g)" class="mb-3 p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-xs text-emerald-200">
              Palabra presentada: <strong class="text-base text-yellow-300 tracking-wider uppercase ml-1">{{ g.seleccion.palabra }}</strong>
              <div class="text-slate-400 text-[11px] mt-0.5">
                ({{ g.seleccion.longitud }} letras) — Elegida por: <strong class="text-white">{{ g.seleccion.seleccionadaPor }}</strong>
              </div>
            </div>

            <!-- Mensaje censurado/oculto si ya seleccionó el rival -->
            <div *ngIf="g.seleccion && !puedeVerDetallesGrupo(g)" class="mb-3 p-3 bg-slate-900/80 rounded-xl border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
              <span>🔒</span>
              <span>El equipo ya ha presentado su palabra secreta. Se revelará al final.</span>
            </div>

            <!-- Listado de palabras aportadas -->
            <!-- CASO 1: Es mi grupo o admin neutral -> puede verlas y elegir -->
            <div *ngIf="puedeVerDetallesGrupo(g)" class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
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
                  <!-- Botón elegir -->
                  <button (click)="elegirPalabraEquipo(g.id, g.nombre, p.palabra)"
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

            <!-- CASO 2: Equipo contrario -> oculto/descifrado con pistas (X letras) sin mostrar la palabra ni autor -->
            <div *ngIf="!puedeVerDetallesGrupo(g)" class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              <div *ngFor="let p of g.palabras"
                   class="flex items-center justify-between p-2 rounded-xl text-sm bg-slate-900/70 border border-slate-800">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-slate-500 tracking-widest font-bold">
                    {{ ocultarPalabra(p.longitud) }}
                  </span>
                  <span class="text-xs text-slate-500 italic">🔒 Palabra secreta</span>
                </div>
                <div class="text-xs bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded font-mono">
                  {{ p.longitud }} ltr
                </div>
              </div>

              <div *ngIf="g.palabras.length === 0" class="text-xs text-slate-500 text-center py-4 italic">
                El equipo rival no ha conseguido palabras en esta ronda.
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
                  <span *ngIf="!r.descartada && !r.esGanador && r.puntos > 0" class="text-xs bg-indigo-800 text-indigo-200 font-bold px-2 py-0.5 rounded-full uppercase">
                    Válida (+{{ r.puntos }} pts)
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

  // Variables editables sincronizadas con el estado de la sala
  dificultadEdit: 'facil' | 'media' | 'dificil' = 'facil';
  numLetrasEdit = 10;
  tiempoSegundosEdit = 45;

  // Input borrador de palabra
  palabraBorrador = '';
  errorPalabra: string | null = null;

  // Temporizador local para fluidez
  segundosRestantes = 45;
  private timerInterval: any = null;

  get estado() {
    return this.sala?.estadoPalabras || null;
  }

  get numLetrasFijo(): number {
    return this.estado?.numLetras || 10;
  }

  get tiempoSegundos(): number {
    return this.estado?.tiempoLimite || 45;
  }

  get dificultadActual(): string {
    return this.estado?.dificultad || 'facil';
  }

  getEtiquetaDificultad(): string {
    switch (this.dificultadActual) {
      case 'facil':
        return 'Fácil 🟢';
      case 'media':
        return 'Media 🟡';
      case 'dificil':
        return 'Difícil 🔴';
      default:
        return this.dificultadActual;
    }
  }

  getDescripcionDificultadEdit(): string {
    switch (this.dificultadEdit) {
      case 'facil':
        return '🟢 Fácil: 50% de vocales y letras amigables (A, E, O, R, S, T, L, N, C, D, M, P, B). Palabras largas más fáciles de hallar.';
      case 'media':
        return '🟡 Media: 40% de vocales con distribución clásica y equilibrada.';
      case 'dificil':
        return '🔴 Difícil: 33% de vocales y mezcla con consonantes más difíciles (Z, X, J, K, etc.).';
      default:
        return '';
    }
  }

  constructor(private salaService: SalaService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sala'] && this.sala) {
      this.syncFromSala();
      this.syncTimer();
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private syncFromSala(): void {
    if (this.estado) {
      this.dificultadEdit = (this.estado.dificultad as any) || 'facil';
      this.numLetrasEdit = this.estado.numLetras || 10;
      this.tiempoSegundosEdit = this.estado.tiempoLimite || 45;
    }
  }

  guardarAjustes(): void {
    if (!this.isAdmin || !this.sala) return;
    this.salaService.actualizarConfigPalabras(this.sala.codigo, {
      dificultad: this.dificultadEdit,
      numLetras: Number(this.numLetrasEdit) || 10,
      tiempoSegundos: Number(this.tiempoSegundosEdit) || 45
    });
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

  /**
   * Generador de letras según la dificultad configurada en la sala:
   * - facil: 50% vocales frecuentes, consonantes muy combinables (R, S, T, L, N, C, D, M, P, B).
   * - media: ~40% vocales, consonantes estándar.
   * - dificil: ~30-35% vocales, inclusión de consonantes más difíciles (Z, J, X, V, G, Q, K, F).
   */
  generarLetrasEquilibradas(n: number): string[] {
    const dificultad = this.dificultadActual;
    let poolVocales = 'AAAAAEEEEIIIOOOU';
    let poolConsonantes = '';
    let ratioVocales = 0.42;

    if (dificultad === 'facil') {
      // Mucho más amigable: letras más comunes del castellano
      poolVocales = 'AAAAAEEEEIIIOOOU';
      poolConsonantes = 'RRRSSSSTTTLLLNNNCCCDDDMMPPB';
      ratioVocales = 0.50; // La mitad vocales para facilitar palabras largas de 6 a 9 letras
    } else if (dificultad === 'dificil') {
      poolVocales = 'AAAEEIIOU';
      poolConsonantes = 'BCDFGHJKLMNPQRSTVWXYZ';
      ratioVocales = 0.33; // Solo 1/3 de vocales
    } else {
      // Media / estándar
      poolVocales = 'AAAAAEEEEIIIOOOU';
      poolConsonantes = 'BCDFGHJKLMNPQRSTVZ';
      ratioVocales = 0.40;
    }

    const cantVocales = Math.max(2, Math.round(n * ratioVocales));
    const cantConsonantes = n - cantVocales;

    const letras: string[] = [];
    for (let i = 0; i < cantVocales; i++) {
      letras.push(poolVocales[Math.floor(Math.random() * poolVocales.length)]);
    }
    for (let i = 0; i < cantConsonantes; i++) {
      letras.push(poolConsonantes[Math.floor(Math.random() * poolConsonantes.length)]);
    }

    // Barajar
    return letras.sort(() => Math.random() - 0.5);
  }

  async iniciarRonda(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    // Asegurar que si el admin modificó los selectores antes de iniciar, queden guardados
    this.guardarAjustes();

    const n = this.numLetrasFijo;
    const t = this.tiempoSegundos;
    const letras = this.generarLetrasEquilibradas(n);
    const modo = this.estado?.modoPuntuacion || 'por_letras';
    const dif = (this.estado?.dificultad || 'facil') as any;

    await this.salaService.iniciarRondaPalabras(this.sala.codigo, letras, t, modo, dif);
    this.sala = this.salaService.obtenerSalaPorCodigo(this.sala.codigo);
  }

  async finalizarTiempoManual(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    await this.salaService.pasarAFaseSeleccionPalabras(this.sala.codigo);
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
        const palabrasRaw = (this.estado?.palabrasAportadas || [])
          .filter(p => p.jugador.toLowerCase() === j.nombre.toLowerCase())
          .sort((a, b) => b.longitud - a.longitud);

        // Eliminar duplicados: solo una ocurrencia por palabra
        const vistas = new Set<string>();
        const palabras = palabrasRaw.filter(p => {
          const key = p.palabra.toLowerCase();
          if (vistas.has(key)) return false;
          vistas.add(key);
          return true;
        });

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
      const palabrasRaw = (this.estado?.palabrasAportadas || [])
        .filter(p => p.equipoId === eq.id)
        .sort((a, b) => b.longitud - a.longitud);

      // Eliminar duplicados: solo una ocurrencia por palabra
      const vistas = new Set<string>();
      const palabras = palabrasRaw.filter(p => {
        const key = p.palabra.toLowerCase();
        if (vistas.has(key)) return false;
        vistas.add(key);
        return true;
      });

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

  /**
   * Determina si el usuario actual tiene permisos para ver las palabras claras
   * y la selección de un grupo durante la fase de selección.
   * Regla:
   * - Si es su propio grupo: sí.
   * - Si el administrador NO pertenece a ningún equipo (espectador/árbitro puro): sí.
   * - Si el administrador está asignado a un equipo: NO puede ver las del equipo contrario.
   * - Un jugador normal nunca puede ver las del rival.
   */
  puedeVerDetallesGrupo(g: { id: string; esMiGrupo: boolean }): boolean {
    if (g.esMiGrupo) return true;

    if (this.sala?.modoJuego === 'individual') {
      return false;
    }

    // Si soy admin, comprobar si tengo un equipo asignado
    if (this.isAdmin) {
      const miNombre = (this.currentName || '').toLowerCase();
      const yo = this.sala?.jugadores.find(j => j.nombre.toLowerCase() === miNombre);
      const tengoEquipo = !!(yo && yo.equipoId);
      // Si el admin tiene equipo, solo ve su equipo (no los rivales).
      // Si el admin no tiene equipo asignado (árbitro puro), puede verlos todos.
      return !tengoEquipo;
    }

    return false;
  }

  ocultarPalabra(longitud: number): string {
    return '• '.repeat(Math.max(1, longitud)).trim();
  }

  async elegirPalabraEquipo(grupoId: string, nombreGrupo: string, palabra: string): Promise<void> {
    if (!this.sala) return;
    const nombreUsuario = this.currentName || this.sala.jugadores[0]?.nombre || 'Jugador';
    await this.salaService.seleccionarPalabraEquipo(this.sala.codigo, grupoId, nombreGrupo, palabra, nombreUsuario);
    this.sala = this.salaService.obtenerSalaPorCodigo(this.sala.codigo);
  }

  async pasarARevelacion(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    await this.salaService.pasarARevelacionManual(this.sala.codigo);
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

      lista.forEach(item => {
        if (!item.descartada && item.longitud > 0) {
          if (item.longitud === maxLen) {
            item.esGanador = true;
          }
          // En modo por_letras cada equipo con palabra válida suma sus letras
          // En modo por_ganar solo el ganador suma 10 puntos
          item.puntos = modo === 'por_letras' ? item.longitud : (item.esGanador ? 10 : 0);
        }
      });
    }

    return lista;
  }

  toggleDescarte(grupoId: string): void {
    if (!this.isAdmin || !this.sala) return;
    this.salaService.toggleDescartePalabraAdmin(this.sala.codigo, grupoId);
  }

  async confirmarPuntosYAvanzar(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;

    // Adjudicar puntos a los ganadores según las palabras no descartadas
    await this.salaService.entregarPuntosPalabras(this.sala.codigo);

    const rondaActual = this.sala.rondaActual ?? 0;
    const rondasTotales = this.sala.rondasTotales ?? 5;
    const isFinal = (rondaActual + 1) >= rondasTotales;

    if (isFinal) {
      this.endOfGameReached.emit();
      return;
    }

    // Avanzar a la siguiente ronda usando la configuración fija de la partida
    this.salaService.avanzarRonda(this.sala.codigo);
    await this.salaService.iniciarRondaPalabras(
      this.sala.codigo,
      this.generarLetrasEquilibradas(this.numLetrasFijo),
      this.tiempoSegundos,
      this.estado?.modoPuntuacion || 'por_letras',
      (this.estado?.dificultad || 'facil') as any
      );
  }
}
