import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Sala, Equipo, EstadoCodigoSecreto, CasillaCodigoSecreto, Jugador } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';

interface PalabraCatalogo {
  id: string;
  palabra: string;
}

@Component({
  selector: 'app-codigo-secreto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col items-center gap-4 w-full">

      <!-- ============================================================== -->
      <!-- FASE ESPERANDO: el admin elige capitanes y empieza              -->
      <!-- ============================================================== -->
      <div *ngIf="!estado || estado.fase === 'esperando'" class="bg-slate-900 p-6 sm:p-8 rounded-2xl w-full max-w-xl mx-auto text-center border border-slate-700 space-y-4">
        <span class="text-5xl">🔐</span>
        <h3 class="text-2xl font-black text-yellow-400 uppercase tracking-wide">El Código Secreto</h3>
        <p class="text-slate-300 text-sm">
          Dos equipos, 25 palabras y un mapa secreto que solo ven los capitanes.
          El capitán da una pista (una palabra y un número) y su equipo intenta encontrar sus casillas.
          ¡Cuidado con la casilla negra!
        </p>

        <div *ngIf="equipos.length < 2" class="p-3 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs">
          Esta sala necesita exactamente 2 equipos.
        </div>

        <!-- Admin: elegir capitanes -->
        <div *ngIf="isAdmin && equipos.length === 2" class="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-left space-y-3">
          <span class="text-xs font-bold text-yellow-400 uppercase tracking-wider">👑 Elige los capitanes</span>

          <div *ngFor="let eq of equipos" class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
            <span class="text-sm font-bold text-white">🛡️ {{ eq.nombre }}</span>
            <select class="sm:col-span-2 w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-xs text-white font-semibold focus:outline-none focus:border-yellow-400"
                    [ngModel]="capitanDe(eq.id)" (ngModelChange)="setCapitan(eq.id, $event)">
              <option value="">-- Elige capitán --</option>
              <option *ngFor="let j of miembros(eq.id)" [value]="j.nombre">{{ j.nombre }}</option>
            </select>
          </div>

          <p *ngIf="hayEquipoSinMiembros" class="text-[11px] text-amber-300">
            Hay algún equipo sin participantes todavía.
          </p>

          <button (click)="iniciarPartida()" [disabled]="!listoParaEmpezar || cargando"
                  class="w-full mt-2 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 disabled:opacity-50 text-purple-950 font-black py-3 rounded-xl transition uppercase tracking-wider shadow-lg text-sm">
            {{ cargando ? '⏳ Preparando tablero...' : '🚀 Empezar partida' }}
          </button>
        </div>

        <!-- Participantes: resumen de capitanes -->
        <div *ngIf="!isAdmin" class="p-4 bg-slate-800/60 rounded-xl text-sm text-slate-300 space-y-1">
          <div *ngFor="let eq of equipos">🛡️ {{ eq.nombre }} · Capitán: <strong class="text-white">{{ capitanDe(eq.id) || 'sin elegir' }}</strong></div>
          <div class="pt-2 text-slate-400 animate-pulse">⏳ Esperando a que el administrador dé la salida...</div>
        </div>

        <div *ngIf="error" class="p-2 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs">⚠️ {{ error }}</div>

        <div>
          <button (click)="clasificacionRequested.emit()" class="text-xs text-slate-400 hover:text-white underline">
            🏆 Ver clasificación actual
          </button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- FASE JUGANDO / TERMINADO: tablero                               -->
      <!-- ============================================================== -->
      <div *ngIf="estado && (estado.fase === 'jugando' || estado.fase === 'terminado')" class="w-full max-w-3xl mx-auto space-y-4">

        <!-- Marcador: casillas de cada equipo -->
        <div class="grid grid-cols-2 gap-3">
          <div *ngFor="let m of marcadores" class="bg-slate-900 p-3 rounded-xl border-2 text-center" [ngClass]="m.color">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-400">🛡️ {{ m.nombre }}</div>
            <div class="text-2xl font-black">
              {{ m.quedan }}
              <span class="text-xs text-slate-400 font-semibold">quedan de {{ m.total }} · encontradas {{ m.descubiertas }}</span>
            </div>
          </div>
        </div>

        <!-- Cabecera de turno -->
        <div *ngIf="estado.fase === 'jugando'" class="bg-slate-900 p-4 rounded-2xl border-2 text-center" [ngClass]="colorBordeTurno()">
          <div class="text-xs uppercase font-bold text-slate-400 tracking-wider">Turno de</div>
          <div class="text-2xl font-black" [ngClass]="colorTextoEquipo(estado.turnoEquipoId)">
            🛡️ {{ nombreEquipo(estado.turnoEquipoId) }}
          </div>
          <div class="text-xs text-slate-400 mt-1">Capitán: {{ capitanDe(estado.turnoEquipoId) || 'sin asignar' }}</div>

          <div *ngIf="estado.pista" class="mt-3 inline-flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-xl border border-slate-600">
            <span class="text-yellow-300 font-black text-lg">{{ estado.pista.texto }}</span>
            <span class="text-cyan-300 font-black text-2xl">{{ estado.pista.numero }}</span>
            <span class="text-xs text-slate-400">Intentos: {{ estado.pista.intentosRestantes }}</span>
          </div>
        </div>

        <!-- Resultado final -->
        <div *ngIf="estado.fase === 'terminado'" class="bg-slate-900 p-6 rounded-2xl border-4 border-yellow-500 text-center shadow-2xl">
          <span class="text-5xl">🏆</span>
          <h3 class="text-3xl font-black text-yellow-400 uppercase tracking-wide mt-2">
            ¡Gana {{ nombreEquipo(estado.ganadorEquipoId || '') }}!
          </h3>
          <p class="text-sm text-slate-300 mt-1">
            {{ estado.motivoFin === 'negra' ? 'El otro equipo tocó la casilla negra.' : 'Han descubierto todas sus casillas.' }}
          </p>
          <button *ngIf="isAdmin" (click)="endOfGameReached.emit()"
                  class="mt-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black px-5 py-2.5 rounded-xl uppercase tracking-wide text-sm transition">
            🏁 Opciones de fin de partida
          </button>
        </div>

        <!-- Acciones: capitán da pista -->
        <div *ngIf="puedoDarPista()" class="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-2">
          <span class="text-xs font-bold uppercase tracking-wider text-cyan-300">🗝️ Tu pista, capitán</span>
          <div class="flex flex-col sm:flex-row gap-2">
            <input type="text" [(ngModel)]="pistaTexto" placeholder="Una palabra..."
                   autocomplete="off" autocorrect="off" spellcheck="false"
                   class="flex-1 bg-slate-900 border-2 border-slate-600 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-400" />
            <select [(ngModel)]="pistaNumero"
                    class="bg-slate-900 border-2 border-slate-600 rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-400">
              <option [ngValue]="null" disabled>Nº</option>
              <option *ngFor="let n of numeros" [ngValue]="n">{{ n }}</option>
            </select>
            <button (click)="darPista()"
                    class="bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-black px-5 py-2.5 rounded-xl uppercase tracking-wide transition">
              Dar pista
            </button>
          </div>
        </div>

        <!-- Mensaje de estado del turno -->
        <div *ngIf="estado.fase === 'jugando' && esperaTexto()" class="text-center text-sm text-slate-400 animate-pulse">
          {{ esperaTexto() }}
        </div>
        <div *ngIf="puedoTocar()" class="text-center text-sm text-emerald-300 font-semibold">
          Toca las casillas que creáis que son de vuestro equipo. Si no os fiáis de la siguiente, pasad el turno.
        </div>
        <div *ngIf="puedoTerminarTurno()" class="text-center">
          <button (click)="terminarTurno()"
                  class="bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition">
            ⏭️ Pasar turno
          </button>
        </div>

        <div *ngIf="error" class="p-2 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs text-center">⚠️ {{ error }}</div>

        <!-- Tablero 5x5 -->
        <div class="grid grid-cols-5 gap-1.5 sm:gap-2">
          <button *ngFor="let c of estado.casillas"
                  (click)="tocar(c)"
                  [disabled]="c.descubierta || !puedoTocar()"
                  class="min-h-[3.5rem] sm:min-h-[4.5rem] rounded-lg border-2 p-1 text-[10px] sm:text-xs font-black uppercase break-words transition disabled:cursor-default"
                  [ngClass]="claseCasilla(c)">
            {{ c.palabra }}
          </button>
        </div>

        <!-- Leyenda según rol -->
        <p *ngIf="puedeVerMapa() && estado.fase === 'jugando'" class="text-xs text-slate-400 text-center">
          🗝️ Vista de capitán: ves el mapa secreto. No lo enseñes.
        </p>
        <p *ngIf="isAdmin && !puedeVerMapa() && estado.fase === 'jugando'" class="text-xs text-slate-500 text-center">
          👑 Como administrador no ves el mapa, salvo que seas capitán.
        </p>

        <!-- Admin: reiniciar partida en cualquier momento -->
        <div *ngIf="isAdmin && estado.fase === 'jugando'" class="text-center">
          <button (click)="reiniciarPartida()"
                  class="bg-rose-900/40 hover:bg-rose-800/60 border border-rose-700 text-rose-300 font-semibold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition">
            🔄 Reiniciar partida
          </button>
        </div>
      </div>
    </div>
  `
})
export class CodigoSecretoComponent implements OnInit, OnDestroy {
  @Input() sala: Sala | null = null;
  @Input() currentName: string | null = null;
  @Input() isAdmin = false;

  @Output() clasificacionRequested = new EventEmitter<void>();
  @Output() endOfGameReached = new EventEmitter<void>();

  private http = inject(HttpClient);
  private salaService = inject(SalaService);
  private cacheCatalogo: PalabraCatalogo[] | null = null;

  readonly numeros = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  pistaTexto = '';
  pistaNumero: number | null = null;

  cargando = false;
  error: string | null = null;

  private stateUpdateListener: any = null;

  // ---------- Getters de estado ----------

  get estado(): EstadoCodigoSecreto | null {
    return this.sala?.estadoCodigoSecreto || null;
  }

  /** Solo se juega con 2 equipos. */
  get equipos(): Equipo[] {
    return (this.sala?.equipos || []).slice(0, 2);
  }

  /** Hay algún equipo sin participantes (para el aviso del admin). */
  get hayEquipoSinMiembros(): boolean {
    return this.equipos.some(eq => this.miembros(eq.id).length === 0);
  }

  /** Marcador por equipo: casillas totales, descubiertas y las que quedan. */
  get marcadores(): { id: string; nombre: string; total: number; descubiertas: number; quedan: number; color: string }[] {
    const casillas = this.estado?.casillas || [];
    return this.equipos.map((eq, i) => {
      const suyas = casillas.filter(c => c.bando === eq.id);
      const descubiertas = suyas.filter(c => c.descubierta).length;
      return {
        id: eq.id,
        nombre: eq.nombre,
        total: suyas.length,
        descubiertas,
        quedan: suyas.length - descubiertas,
        color: i === 0 ? 'border-sky-500 text-sky-300' : 'border-rose-500 text-rose-300'
      };
    });
  }

  get listoParaEmpezar(): boolean {
    return this.equipos.length === 2 && this.equipos.every(eq => !!this.capitanDe(eq.id));
  }

  capitanDe(equipoId: string): string {
    return this.estado?.capitanes?.[equipoId] || '';
  }

  nombreEquipo(equipoId: string): string {
    return this.equipos.find(e => e.id === equipoId)?.nombre || '';
  }

  miembros(equipoId: string): Jugador[] {
    return (this.sala?.jugadores || []).filter(j => j.equipoId === equipoId);
  }

  private miJugador(): Jugador | undefined {
    const yo = (this.currentName || '').toLowerCase();
    return this.sala?.jugadores.find(j => j.nombre.toLowerCase() === yo);
  }

  private miEquipoId(): string | undefined {
    return this.miJugador()?.equipoId;
  }

  /** Capitán de cualquiera de los dos equipos. */
  isCapitanPlayer(): boolean {
    if (!this.currentName || !this.estado?.capitanes) return false;
    return Object.values(this.estado.capitanes).includes(this.currentName);
  }

  esCapitanTurno(): boolean {
    return !!this.estado && !!this.currentName && this.estado.capitanes?.[this.estado.turnoEquipoId] === this.currentName;
  }

  /** Solo los capitanes ven el mapa completo. */
  puedeVerMapa(): boolean {
    return this.isCapitanPlayer();
  }

  puedoDarPista(): boolean {
    return !!this.estado && this.estado.fase === 'jugando' && !this.estado.pista && this.esCapitanTurno();
  }

  puedoTocar(): boolean {
    return !!this.estado && this.estado.fase === 'jugando' && !!this.estado.pista
      && this.miEquipoId() === this.estado.turnoEquipoId && !this.isCapitanPlayer();
  }

  puedoTerminarTurno(): boolean {
    return !!this.estado && this.estado.fase === 'jugando' && !!this.estado.pista
      && this.miEquipoId() === this.estado.turnoEquipoId && !this.isCapitanPlayer();
  }

  esperaTexto(): string {
    if (!this.estado || this.estado.fase !== 'jugando') return '';
    if (this.puedoDarPista() || this.puedoTocar()) return '';
    const nombre = this.nombreEquipo(this.estado.turnoEquipoId);
    if (!this.estado.pista) return `⏳ Esperando la pista del capitán de ${nombre}...`;
    return `⏳ Turno de ${nombre}. Intentos restantes: ${this.estado.pista.intentosRestantes}`;
  }

  // ---------- Estilos ----------

  private indiceEquipo(equipoId: string): number {
    return this.equipos.findIndex(e => e.id === equipoId);
  }

  colorTextoEquipo(equipoId: string): string {
    return this.indiceEquipo(equipoId) === 0 ? 'text-sky-300' : 'text-rose-300';
  }

  colorBordeTurno(): string {
    if (!this.estado) return 'border-slate-700';
    return this.indiceEquipo(this.estado.turnoEquipoId) === 0 ? 'border-sky-500' : 'border-rose-500';
  }

  claseCasilla(c: CasillaCodigoSecreto): string {
    if (c.descubierta) return this.estiloBando(c.bando, true);
    if (this.puedeVerMapa() || this.estado?.fase === 'terminado') return this.estiloBando(c.bando, false);
    return 'bg-slate-700 border-slate-500 text-white hover:bg-slate-600';
  }

  /** Revelada = iluminada con color fuerte. Sin revelar = solo marcada (para capitanes). */
  private estiloBando(bando: string, revelada: boolean): string {
    if (bando === 'neutra') {
      return revelada
        ? 'bg-amber-200 border-amber-100 text-slate-900 ring-2 ring-white shadow-lg shadow-amber-200/40'
        : 'bg-slate-800 border-amber-300 text-amber-100';
    }
    if (bando === 'negra') {
      return revelada
        ? 'bg-black border-rose-500 text-rose-400 ring-2 ring-rose-500 shadow-lg shadow-rose-600/50'
        : 'bg-slate-900 border-rose-600 text-rose-300';
    }
    if (this.indiceEquipo(bando) === 0) {
      return revelada
        ? 'bg-sky-500 border-sky-300 text-white ring-2 ring-white shadow-lg shadow-sky-400/50'
        : 'bg-slate-800 border-sky-500 text-sky-200';
    }
    return revelada
      ? 'bg-rose-500 border-rose-300 text-white ring-2 ring-white shadow-lg shadow-rose-400/50'
      : 'bg-slate-800 border-rose-500 text-rose-200';
  }

  // ---------- Ciclo de vida ----------

  ngOnInit(): void {
    this.stateUpdateListener = () => this.refrescar();
    if (typeof window !== 'undefined') {
      window.addEventListener('mpj_state_updated', this.stateUpdateListener as EventListener);
    }
  }

  ngOnDestroy(): void {
    if (this.stateUpdateListener && typeof window !== 'undefined') {
      window.removeEventListener('mpj_state_updated', this.stateUpdateListener as EventListener);
    }
  }

  private refrescar(): void {
    if (!this.sala) return;
    const actualizada = this.salaService.obtenerSalaPorCodigo(this.sala.codigo);
    if (actualizada) this.sala = actualizada;
  }

  private async cargarCatalogo(): Promise<PalabraCatalogo[]> {
    if (this.cacheCatalogo) return this.cacheCatalogo;
    const lista = await firstValueFrom(
      this.http.get<PalabraCatalogo[]>('assets/games/codigo-secreto/palabras.json')
    );
    this.cacheCatalogo = lista;
    return lista;
  }

  // ---------- Acciones ----------

  async setCapitan(equipoId: string, nombre: string): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    this.error = null;
    const capitanes = { ...(this.estado?.capitanes || {}), [equipoId]: nombre };
    const ok = await this.salaService.asignarCapitanesCodigo(this.sala.codigo, capitanes);
    if (!ok) this.error = 'No se pudo guardar el capitán.';
    this.refrescar();
  }

  async iniciarPartida(): Promise<void> {
    if (!this.isAdmin || !this.sala || !this.listoParaEmpezar) return;
    this.error = null;
    this.cargando = true;
    try {
      const catalogo = await this.cargarCatalogo();
      const ok = await this.salaService.iniciarPartidaCodigo(this.sala.codigo, catalogo);
      if (!ok) {
        this.error = 'No se pudo empezar: faltan capitanes o no quedan 25 palabras sin usar en esta sala.';
      }
      this.refrescar();
    } catch (e) {
      console.error('[CodigoSecreto] Error cargando palabras', e);
      this.error = 'No se pudo cargar el listado de palabras.';
    } finally {
      this.cargando = false;
    }
  }

  async darPista(): Promise<void> {
    if (!this.sala || !this.currentName || !this.puedoDarPista()) return;
    this.error = null;
    const texto = (this.pistaTexto || '').trim();
    if (!texto) {
      this.error = 'Escribe una pista.';
      return;
    }
    if (this.pistaNumero === null || this.pistaNumero === undefined) {
      this.error = 'Elige el número de la pista.';
      return;
    }
    // La pista no puede ser una palabra del tablero
    const clave = this.salaService.claveRespuesta(texto);
    const esDelTablero = (this.estado?.casillas || []).some(c => this.salaService.claveRespuesta(c.palabra) === clave);
    if (esDelTablero) {
      this.error = 'La pista no puede ser una palabra del tablero.';
      return;
    }
    const ok = await this.salaService.darPistaCodigo(this.sala.codigo, this.currentName, texto, Number(this.pistaNumero));
    if (ok) {
      this.pistaTexto = '';
      this.pistaNumero = null;
    } else {
      this.error = 'No se pudo dar la pista.';
    }
    this.refrescar();
  }

  async tocar(c: CasillaCodigoSecreto): Promise<void> {
    if (!this.sala || !this.currentName || !this.puedoTocar() || c.descubierta) return;
    this.error = null;
    const ok = await this.salaService.tocarCasillaCodigo(this.sala.codigo, this.currentName, c.idPalabra);
    if (!ok) this.error = 'No se pudo tocar esa casilla.';
    this.refrescar();
  }

  /** Admin: vuelve a la fase de configuración en cualquier momento. Conserva las palabras ya usadas. */
  async reiniciarPartida(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    const seguro = window.confirm('¿Reiniciar la partida? Se perderá el tablero actual y habrá que elegir capitanes de nuevo.');
    if (!seguro) return;
    this.error = null;
    this.pistaTexto = '';
    this.pistaNumero = null;
    await this.salaService.reiniciarSala(this.sala.codigo);
    this.refrescar();
  }

  async terminarTurno(): Promise<void> {
    if (!this.sala || !this.currentName || !this.puedoTerminarTurno()) return;
    this.error = null;
    await this.salaService.terminarTurnoCodigo(this.sala.codigo, this.currentName);
    this.refrescar();
  }
}
