import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sala, EstadoPreguntasAnonimas, RespuestaAgrupada } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';
import preguntasData from '../../../assets/games/preguntas-anonimas/preguntas.json';

interface PreguntaCatalogo {
  id: number;
  category_id: string;
  text: string;
  suggested_type: string;
  intensity: number;
}

@Component({
  selector: 'app-preguntas-anonimas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="w-full max-w-3xl mx-auto space-y-4">

      <!-- ======================= APORTAR PREGUNTAS ======================= -->
      <ng-container *ngIf="fase === 'haciendo-preguntas'">
        <div class="text-center text-sm text-slate-300">
          ✍️ {{ numeroAportadas }} de {{ totalJugadores }} han aportado su pregunta
        </div>

        <div *ngIf="isAdmin" class="text-center">
          <button (click)="empezarRespuestas()"
                  [disabled]="numeroAportadas < 2"
                  class="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-950 font-black px-5 py-2.5 rounded-xl uppercase text-xs tracking-wide transition">
            ▶ Empezar a responder
          </button>
          <p class="text-[11px] text-slate-500 mt-1">Puedes empezar antes si alguien no va a aportar pregunta.</p>
        </div>

        <!-- Tu pregunta -->
        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Tu pregunta (anónima)</div>
          <textarea [(ngModel)]="miPregunta" rows="2" placeholder="Escribe tu pregunta o elige una del catálogo..."
                    class="w-full bg-slate-800 border-2 border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400"></textarea>
          <button (click)="enviarPregunta()"
                  [disabled]="!miPregunta.trim() || yaAporte"
                  class="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 text-slate-950 font-black py-2 rounded-lg uppercase text-xs tracking-wide transition">
            {{ yaAporte ? '✅ Tu pregunta está guardada' : '💾 Guardar pregunta' }}
          </button>
        </div>

        <!-- Catálogo de sugerencias -->
        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Catálogo de ideas</div>
          <div class="flex flex-col sm:flex-row gap-2">
            <select [(ngModel)]="categoriaFiltro" (ngModelChange)="recalcularMuestra()"
                    class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400">
              <option value="">Todas las categorías</option>
              <option *ngFor="let c of categorias" [value]="c.id">{{ c.name }}</option>
            </select>
            <input [(ngModel)]="textoFiltro" (ngModelChange)="recalcularMuestra()" placeholder="Buscar..."
                   class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400" />
            <button (click)="recalcularMuestra()"
                    class="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold transition">
              🔀 Ver otras
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <button *ngFor="let p of muestra"
                    (click)="elegirSugerencia(p.text)"
                    class="text-left text-xs p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-200 transition">
              {{ p.text }}
            </button>
          </div>
          <div *ngIf="muestra.length === 0" class="text-xs text-slate-500 italic text-center py-2">
            No hay preguntas que coincidan con el filtro.
          </div>
        </div>
      </ng-container>

      <!-- ======================= RESPONDER ======================= -->
      <ng-container *ngIf="fase === 'respondiendo' && preguntaActual">
        <div class="bg-slate-900 p-5 rounded-2xl border border-slate-700 text-center">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Pregunta {{ numeroPregunta }} de {{ totalPreguntas }}
          </div>
          <div class="text-xl font-black text-cyan-300">{{ preguntaActual.pregunta }}</div>
        </div>

        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
          <input [(ngModel)]="miRespuesta" placeholder="Tu respuesta..."
                 class="w-full bg-slate-800 border-2 border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400" />
          <button (click)="enviarRespuesta()"
                  [disabled]="!miRespuesta.trim() || yaRespondi"
                  class="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 text-slate-950 font-black py-2 rounded-lg uppercase text-xs tracking-wide transition">
            {{ yaRespondi ? '✅ Respuesta enviada' : '💾 Enviar respuesta' }}
          </button>
        </div>

        <div class="text-center text-sm text-slate-400">
          ⏳ {{ respondidasActuales }} de {{ totalJugadores }} han respondido
        </div>

        <div *ngIf="isAdmin" class="text-center">
          <button (click)="siguiente()"
                  class="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition">
            ⏭️ Pasar pregunta (cerrar con lo que haya)
          </button>
        </div>
      </ng-container>

      <!-- ======================= REVISIÓN ======================= -->
      <ng-container *ngIf="fase === 'revision' && preguntaActual">
        <div class="bg-slate-900 p-5 rounded-2xl border border-slate-700 text-center">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Pregunta {{ numeroPregunta }} de {{ totalPreguntas }}
          </div>
          <div class="text-xl font-black text-cyan-300">{{ preguntaActual.pregunta }}</div>
        </div>

        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-2">
          <div *ngFor="let r of respuestasActuales" class="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <div class="flex justify-between items-center">
              <span class="text-sm font-bold text-slate-100">{{ r.texto }}</span>
              <span class="text-xs text-slate-400">{{ r.cantidad }} {{ r.cantidad === 1 ? 'vez' : 'veces' }} · {{ r.porcentaje }}%</span>
            </div>
            <div class="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-cyan-400" [style.width.%]="r.porcentaje"></div>
            </div>
          </div>
          <div *ngIf="respuestasActuales.length === 0" class="text-sm text-slate-500 italic text-center py-2">
            Nadie respondió a esta pregunta.
          </div>
        </div>

        <div *ngIf="isAdmin" class="flex flex-col sm:flex-row gap-2">
          <button (click)="siguiente()"
                  [disabled]="numeroPregunta >= totalPreguntas"
                  class="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-950 font-black py-2 rounded-lg uppercase text-xs tracking-wide transition">
            ➡️ Siguiente pregunta
          </button>
          <button (click)="reiniciar()"
                  class="flex-1 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black py-2 rounded-lg uppercase text-xs tracking-wide transition">
            🔄 Reiniciar juego
          </button>
        </div>
        <div *ngIf="!isAdmin && numeroPregunta >= totalPreguntas" class="text-center text-sm text-slate-400">
          Fin de las preguntas.
        </div>
      </ng-container>

      <div *ngIf="error" class="p-2 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-300 text-xs text-center">
        ⚠️ {{ error }}
      </div>
    </div>
  `
})
export class PreguntasAnonimasComponent {
  @Input() sala: Sala | null = null;
  @Input() currentName: string | null = null;
  @Input() isAdmin = false;

  readonly categorias: { id: string; name: string }[] = (preguntasData as any).categories;
  private readonly catalogo: PreguntaCatalogo[] = (preguntasData as any).questions;

  categoriaFiltro = '';
  textoFiltro = '';
  muestra: PreguntaCatalogo[] = [];

  miPregunta = '';
  miRespuesta = '';
  error: string | null = null;

  constructor(private salaService: SalaService) {
    this.recalcularMuestra();
  }

  // ----------------------------- estado derivado -----------------------------

  get estado(): EstadoPreguntasAnonimas | null {
    const e = this.sala?.estadoPreguntasAnonimas;
    if (!e) return null;
    // Firebase elimina los arrays y objetos vacíos: sin esto, .some() sobre undefined rompe la plantilla
    return {
      ...e,
      preguntas: e.preguntas || [],
      respuestas: e.respuestas || [],
      respuestasAgrupadas: e.respuestasAgrupadas || {}
    };
  }

  get fase(): string {
    return this.estado?.fase ?? 'haciendo-preguntas';
  }

  get totalJugadores(): number {
    return this.sala?.jugadores.length || 0;
  }

  get numeroAportadas(): number {
    return this.estado?.preguntas?.length || 0;
  }

  get totalPreguntas(): number {
    return this.estado?.preguntas?.length || 0;
  }

  get numeroPregunta(): number {
    return (this.estado?.indexPreguntaActual ?? 0) + 1;
  }

  get preguntaActual(): { pregunta: string } | null {
    const est = this.estado;
    return est ? (est.preguntas[est.indexPreguntaActual] ?? null) : null;
  }

  get respuestasActuales(): RespuestaAgrupada[] {
    const est = this.estado;
    return est ? (est.respuestasAgrupadas?.[est.indexPreguntaActual] || []) : [];
  }

  get respondidasActuales(): number {
    const est = this.estado;
    if (!est) return 0;
    return est.respuestas.filter(r => r.indexPregunta === est.indexPreguntaActual).length;
  }

  get yaAporte(): boolean {
    return !!this.estado?.preguntas?.some(p => p.idJugador === this.currentName);
  }

  get yaRespondi(): boolean {
    const est = this.estado;
    if (!est) return false;
    return est.respuestas.some(r => r.idJugador === this.currentName && r.indexPregunta === est.indexPreguntaActual);
  }

  // ----------------------------- catálogo -----------------------------

  get preguntasFiltradas(): PreguntaCatalogo[] {
    return this.catalogo.filter(p =>
      (!this.categoriaFiltro || p.category_id === this.categoriaFiltro) &&
      (!this.textoFiltro || p.text.toLowerCase().includes(this.textoFiltro.toLowerCase()))
    );
  }

  /** Muestra 12 preguntas al azar de las que cumplen el filtro. */
  recalcularMuestra(): void {
    const copia = [...this.preguntasFiltradas];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    this.muestra = copia.slice(0, 12);
  }

  elegirSugerencia(texto: string): void {
    this.miPregunta = texto;
  }

  // ----------------------------- acciones -----------------------------

  async enviarPregunta(): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.aportarPreguntaAnonima(this.sala.codigo, this.currentName, this.miPregunta);
    if (ok) {
      this.miPregunta = '';
    } else {
      this.error = 'No se pudo guardar tu pregunta.';
    }
  }

  async empezarRespuestas(): Promise<void> {
    if (!this.sala || !this.isAdmin) return;
    this.error = null;
    const ok = await this.salaService.iniciarRespuestasPreguntasAnonimas(this.sala.codigo);
    if (!ok) this.error = 'Hacen falta al menos 2 preguntas para empezar.';
  }

  async enviarRespuesta(): Promise<void> {
    if (!this.sala || !this.currentName) return;
    this.error = null;
    const ok = await this.salaService.responderPreguntaAnonima(this.sala.codigo, this.currentName, this.miRespuesta);
    if (ok) {
      this.miRespuesta = '';
    } else {
      this.error = 'No se pudo guardar tu respuesta.';
    }
  }

  async siguiente(): Promise<void> {
    if (!this.sala || !this.isAdmin) return;
    this.error = null;
    await this.salaService.siguientePreguntaAnonima(this.sala.codigo);
  }

  async reiniciar(): Promise<void> {
    if (!this.sala || !this.isAdmin) return;
    if (!window.confirm('¿Reiniciar el juego? Se borrarán las preguntas y respuestas.')) return;
    this.error = null;
    this.miPregunta = '';
    this.miRespuesta = '';
    await this.salaService.reiniciarPreguntasAnonimas(this.sala.codigo);
  }
}
