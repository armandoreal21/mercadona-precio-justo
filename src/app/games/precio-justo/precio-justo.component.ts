import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sala } from '../../core/models/sala.model';
import { SalaService } from '../../sala.service';

@Component({
  selector: 'app-precio-justo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col items-center gap-4 w-full">
      <div class="bg-slate-900 p-6 rounded-xl w-full max-w-lg mx-auto">
        <div *ngIf="sala?.productoActual; else sinProducto">
          <h3 class="text-xl font-bold text-center">
            {{ sala?.productoActual?.nombre || sala?.productoActual?.display_name }}
          </h3>
          <img *ngIf="sala?.productoActual?.imagen || sala?.productoActual?.thumbnail"
               [src]="sala?.productoActual?.imagen || sala?.productoActual?.thumbnail"
               class="w-full max-w-sm rounded-lg mt-3 mx-auto" />
        </div>
        <ng-template #sinProducto>
          <div class="text-center text-slate-400 p-6">Aún no se ha seleccionado un producto para esta ronda.</div>
        </ng-template>

        <!-- Common actions -->
        <div class="mt-4 w-full">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3">
            <button (click)="clasificacionRequested.emit()"
                    class="bg-slate-700 text-slate-100 px-4 py-2 rounded w-full sm:w-auto hover:bg-slate-600 transition">
              Ver clasificación
            </button>
          </div>
        </div>

        <!-- Betting input -->
        <div class="mt-4 w-full max-w-md mx-auto">
          <ng-container *ngIf="currentName as name">
            <div class="flex flex-col sm:flex-row sm:items-center sm:gap-3">
              <input type="number" [(ngModel)]="apuestas[name]" placeholder="€"
                     class="w-full sm:flex-1 text-center bg-slate-700 rounded px-3 py-2 text-white font-bold"
                     [disabled]="inputsDisabled || sentMap[name]" />
              <button (click)="enviarApuesta(name)"
                      class="mt-3 sm:mt-0 sm:ml-2 w-full sm:w-auto bg-cyan-400 text-slate-900 font-bold px-4 py-2 rounded text-sm hover:bg-cyan-300 transition"
                      [disabled]="inputsDisabled || sentMap[name]">
                Enviar
              </button>
            </div>
            <div *ngIf="sentMap[name]" class="mt-2 text-xs text-emerald-400 text-center font-semibold">
              ✓ Apuesta enviada
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Resultados modal -->
      <div *ngIf="resultadosModalVisible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60" (click)="cerrarModal()"></div>
        <div class="relative max-w-lg w-full bg-slate-800 rounded-xl p-4 text-white">
          <h4 class="text-lg font-bold mb-2">Resultados - Precio real: {{ lastPrice | number:'1.2-2' }} €</h4>
          <div *ngIf="resultados && resultados.length; else sinResult">
            <ul class="space-y-2 max-h-64 overflow-auto">
              <li *ngFor="let r of resultados" class="flex justify-between items-center p-2 bg-slate-900 rounded">
                <div>
                  <div class="font-semibold"><strong>{{ r.nombre }}</strong></div>
                  <div class="text-sm text-slate-400">
                    Desviación: {{ r.delta | number:'1.2-2' }} €
                    <span *ngIf="lastPrice !== null && r.apuesta !== undefined">
                      — Apuesta: {{ r.apuesta | number:'1.2-2' }} €
                      <span *ngIf="r.apuesta > lastPrice" class="text-emerald-300"> (arriba {{ (r.apuesta - lastPrice) | number:'1.2-2' }} €)</span>
                      <span *ngIf="r.apuesta < lastPrice" class="text-rose-300"> (abajo {{ (lastPrice - r.apuesta) | number:'1.2-2' }} €)</span>
                      <span *ngIf="r.apuesta === lastPrice"> (exacto)</span>
                    </span>
                  </div>
                </div>
                <div class="text-yellow-300 font-bold">+{{ r.puntos }}</div>
              </li>
            </ul>
          </div>
          <ng-template #sinResult>
            <div class="text-center text-slate-400 p-4">No hay resultados disponibles.</div>
          </ng-template>
          <div class="mt-4 flex gap-2 justify-end">
            <button (click)="cerrarModal()" class="px-4 py-2 mpj-close-btn rounded bg-slate-700 hover:bg-slate-600 transition">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- Esperando modal (who has/haven't bet) -->
      <div *ngIf="esperandoModalVisible" class="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="cerrarEsperandoModal()"></div>
        <div class="relative max-w-md w-full bg-slate-800 rounded-xl p-4 text-white">
          <h4 class="text-lg font-bold mb-2">Esperando apuestas</h4>
          <ul class="space-y-2">
            <li *ngFor="let e of esperandoList" class="flex justify-between items-center p-2 bg-slate-900 rounded">
              <div class="text-sm">{{ e.nombre }}</div>
              <div class="text-sm" [class.text-green-400]="e.apostado" [class.text-slate-400]="!e.apostado">
                {{ e.apostado ? 'Apostado' : 'Sin apostar' }}
              </div>
            </li>
          </ul>
          <div class="mt-4 flex justify-end">
            <button (click)="cerrarEsperandoModal()" class="px-4 py-2 mpj-close-btn rounded bg-slate-700 hover:bg-slate-600 transition">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- Admin extra buttons visibility -->
      <div *ngIf="isAdmin" class="w-full max-w-3xl mb-4 p-4 bg-slate-900 rounded-xl border border-slate-700">
        <div class="text-sm text-slate-300 font-semibold mb-2">Opciones de la partida (Admin)</div>
        <div class="flex gap-2 flex-col sm:flex-row">
          <button (click)="onCalcularPuntuaciones()" [disabled]="!allPlayersHaveApuestas()"
                  [ngClass]="{ 'animate-pulse': allPlayersHaveApuestas(), 'opacity-60 cursor-not-allowed': !allPlayersHaveApuestas() }"
                  class="w-full sm:w-auto px-4 py-2 bg-yellow-400 text-purple-900 rounded-lg font-bold transition-all hover:bg-yellow-300">
            Calcular puntuaciones
          </button>
          <button (click)="cargarProductoAleatorio()"
                  class="bg-slate-700 hover:bg-slate-600 text-slate-100 px-4 py-2 rounded-lg w-full sm:w-auto transition">
            Siguiente Producto
          </button>
        </div>
      </div>
    </div>
  `
})
export class PrecioJustoComponent implements OnChanges {
  @Input() sala: Sala | null = null;
  @Input() currentName: string | null = null;
  @Input() isAdmin = false;

  @Output() clasificacionRequested = new EventEmitter<void>();
  @Output() endOfGameReached = new EventEmitter<void>();

  apuestas: Record<string, number | null> = {};
  sentMap: Record<string, boolean> = {};
  inputsDisabled = false;

  resultadosModalVisible = false;
  resultados: { nombre: string; puntos: number; delta: number; apuesta?: number }[] | null = null;
  lastPrice: number | null = null;

  esperandoModalVisible = false;
  esperandoList: { nombre: string; apostado: boolean }[] = [];
  productIdAtEsperandoOpen: any = null;

  // Track the current product and round locally so we can detect when the product changes
  private lastProductId: string | number | null = null;
  private lastRondaActual: number | null = null;

  constructor(private salaService: SalaService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sala'] && this.sala) {
      this.syncFromSala();
    }
  }

  private syncFromSala(): void {
    if (!this.sala) return;

    const currentPid = this.sala.productoActualId ?? this.sala.productoActual?.idProducto ?? this.sala.productoActual?.id ?? null;
    const currentRonda = this.sala.rondaActual ?? 0;

    // Detectar si ha cambiado el producto o la ronda (siguiente producto / siguiente ronda)
    const productChanged = (this.lastProductId !== null && currentPid !== null && currentPid !== this.lastProductId) ||
                          (this.lastRondaActual !== null && currentRonda !== this.lastRondaActual);

    if (productChanged) {
      // El producto ha cambiado: limpiar apuestas y estados de enviado para la nueva ronda/producto
      this.apuestas = {};
      this.sentMap = {};
      this.inputsDisabled = false;
      this.esperandoModalVisible = false;
      this.productIdAtEsperandoOpen = null;
    }

    this.lastProductId = currentPid;
    this.lastRondaActual = currentRonda;

    const myName = this.currentName;
    const myDraftValue = myName ? this.apuestas[myName] : undefined;

    this.sentMap = {};
    this.sala.jugadores.forEach(j => {
      this.sentMap[j.nombre] = j.apuesta !== undefined;
      if (j.apuesta !== undefined) {
        this.apuestas[j.nombre] = j.apuesta;
      } else if (j.nombre !== myName) {
        this.apuestas[j.nombre] = null;
      }
    });

    // Si para el usuario actual no hay apuesta registrada en el servidor para este producto:
    if (myName && !this.sentMap[myName]) {
      if (productChanged) {
        // En un nuevo producto, el input arranca completamente vacío
        this.apuestas[myName] = null;
      } else if (myDraftValue !== undefined && myDraftValue !== null) {
        // En el mismo producto, mantenemos lo que el usuario está escribiendo
        this.apuestas[myName] = myDraftValue;
      } else {
        this.apuestas[myName] = null;
      }
    }

    if (this.sala.lastResults && Array.isArray(this.sala.lastResults.results)) {
      this.resultados = this.sala.lastResults.results;
      this.lastPrice = typeof this.sala.lastResults.price === 'number' ? this.sala.lastResults.price : null;
      this.resultadosModalVisible = true;
      this.esperandoModalVisible = false;
      this.productIdAtEsperandoOpen = null;
    }

    this.buildEsperandoList();
  }

  buildEsperandoList(): void {
    this.esperandoList = [];
    if (!this.sala) return;
    this.sala.jugadores.forEach(j => {
      this.esperandoList.push({ nombre: j.nombre, apostado: j.apuesta !== undefined });
    });
  }

  async enviarApuesta(nombre: string): Promise<void> {
    if (!this.sala || nombre !== this.currentName) return;
    const val = this.apuestas[nombre];
    if (val === null || val === undefined || isNaN(Number(val))) return;

    const ok = await this.salaService.setApuesta(this.sala.codigo, nombre, Number(val));
    if (ok) {
      this.sentMap[nombre] = true;
      this.buildEsperandoList();
      this.esperandoModalVisible = true;
      this.productIdAtEsperandoOpen = this.sala?.productoActualId ?? null;
    }
  }

  allPlayersHaveApuestas(): boolean {
    if (!this.sala || !this.sala.jugadores.length) return false;
    return this.sala.jugadores.every(j => j.apuesta !== undefined && !isNaN(Number(j.apuesta)));
  }

  async onCalcularPuntuaciones(): Promise<void> {
    if (!this.isAdmin || !this.sala) return;
    if (!this.allPlayersHaveApuestas()) return;

    const res = await this.salaService.calcularPuntuacionesRonda(this.sala.codigo);
    if (res) {
      this.resultados = res;
      this.resultadosModalVisible = true;
      this.salaService.clearApuestas(this.sala.codigo);
      this.inputsDisabled = true;
    }
  }

  cerrarModal(): void {
    if (!this.isAdmin && this.sala?.lastResults) return;

    this.resultadosModalVisible = false;
    this.resultados = null;
    this.lastPrice = null;

    if (this.isAdmin && this.sala) {
      this.salaService.clearLastResults(this.sala.codigo);
      const rondaActual = this.sala?.rondaActual ?? 0;
      const rondasTotales = this.sala?.rondasTotales ?? 5;
      const isFinal = (rondaActual + 1) >= rondasTotales;

      if (isFinal) {
        this.endOfGameReached.emit();
        return;
      }

      this.salaService.avanzarRonda(this.sala.codigo);
      this.cargarProductoAleatorio();
      this.inputsDisabled = false;
    }
  }

  cerrarEsperandoModal(): void {
    if (this.isAdmin) {
      this.esperandoModalVisible = false;
      this.productIdAtEsperandoOpen = null;
      return;
    }
    const currentPid = this.sala?.productoActualId ?? this.sala?.productoActual?.idProducto ?? this.sala?.productoActual?.id ?? null;
    if (this.productIdAtEsperandoOpen !== null && currentPid !== this.productIdAtEsperandoOpen) {
      this.esperandoModalVisible = false;
      this.productIdAtEsperandoOpen = null;
    }
  }

  cargarProductoAleatorio(): void {
    if (!this.sala) return;
    this.httpGetRandomProduct().then(p => {
      if (p && this.sala) {
        this.salaService.actualizarProductoObjeto(this.sala.codigo, p);
        this.salaService.clearLastResults(this.sala.codigo);
        this.salaService.clearApuestas(this.sala.codigo);
        this.inputsDisabled = false;
        this.sentMap = {};
        this.apuestas = {};
      }
    });
  }

  async httpGetRandomProduct(): Promise<any | null> {
    try {
      const cats: any = await fetch('assets/Categoria.json').then(r => r.json());
      const results = cats && cats.results ? cats.results : [];
      const posiblesSubIds: number[] = [];
      results.forEach((r: any) => {
        if (Array.isArray(r.categories)) {
          r.categories.forEach((sc: any) => { if (sc && sc.id) posiblesSubIds.push(sc.id); });
        }
      });
      if (posiblesSubIds.length === 0) return null;
      const elegido = posiblesSubIds[Math.floor(Math.random() * posiblesSubIds.length)];
      const sub: any = await fetch('assets/subcategorias/' + elegido + '.json').then(r => r.json());
      const productos: any[] = [];
      if (Array.isArray(sub.products)) productos.push(...sub.products);
      if (Array.isArray(sub.categories)) {
        sub.categories.forEach((b: any) => {
          if (Array.isArray(b.products)) productos.push(...b.products);
          if (Array.isArray(b.categories)) b.categories.forEach((c2: any) => { if (Array.isArray(c2.products)) productos.push(...c2.products); });
        });
      }
      if (productos.length === 0) return null;
      const prod = productos[Math.floor(Math.random() * productos.length)];
      let precioRaw: any = 0;
      if (prod) {
        if (prod.price_instructions && prod.price_instructions.unit_price != null) precioRaw = prod.price_instructions.unit_price;
        else if (prod.price && prod.price.unit_price != null) precioRaw = prod.price.unit_price;
        else precioRaw = 0;
      }
      const precio = typeof precioRaw === 'string' ? parseFloat(precioRaw) : Number(precioRaw);

      const fixEncoding = (s: any) => {
        if (typeof s !== 'string') return s;
        try {
          return decodeURIComponent(escape(s));
        } catch (e) {
          return s;
        }
      };

      return {
        idProducto: String(prod.id ?? prod?.product_id ?? ''),
        nombre: fixEncoding(prod.display_name || prod.name || prod?.slug || ''),
        precio: isNaN(precio) ? 0 : precio,
        imagen: prod.thumbnail || prod.photos?.[0]?.regular || prod.share_url || '',
        descripcion: fixEncoding(prod.description || prod.long_description || ''),
        categoria: fixEncoding(sub.name) || undefined,
        share_url: prod.share_url || undefined
      };
    } catch (e) {
      return null;
    }
  }
}
