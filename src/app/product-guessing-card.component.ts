import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-product-guessing-card',
 standalone: true,
 imports: [CommonModule],
 template: `
 <div class="max-w-md mx-auto p-4 md:p-6 bg-white/80 backdrop-blur-xl border border-white/40 rounded-[2.5rem] shadow-2xl shadow-slate-200/50">

  <!-- Imagen Premium -->
  <div class="w-full aspect-square bg-slate-100 rounded-3xl overflow-hidden mb-6 flex items-center justify-center border border-slate-100">
    <img *ngIf="(currentProduct() && currentProduct()!.imagen)" [src]="currentProduct()!.imagen" alt="Producto" class="w-full h-full object-cover p-6" />
    <div *ngIf="!currentProduct() || !currentProduct()!.imagen" class="text-slate-400">Sin imagen</div>
  </div>

  <!-- Texto Moderno -->
  <div class="text-center mb-8 px-2">
    <h2 class="text-2xl font-bold text-slate-800 leading-tight mb-2">{{ currentProduct() ? currentProduct()!.nombre : '¿Cuánto cuesta?' }}</h2>
    <p class="text-sm font-medium text-slate-400 uppercase tracking-widest">{{ currentProduct() ? currentProduct()!.categoria : 'Selecciona un producto' }}</p>
  </div>

  <!-- Precio (Estilo App) -->
  <div class="mb-8 flex justify-center">
    <div [class]="'px-8 py-4 rounded-2xl font-mono text-4xl font-bold transition-all duration-500 ' + (isRevealed() ? 'bg-teal-50 text-teal-600 scale-105' : 'bg-slate-100 text-slate-400')">
      {{ isRevealed() ? (currentProduct()!.precio | number:'1.2-2') + ' €' : '?.?? €' }}
    </div>
  </div>

  <!-- Botones Modernos -->
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <button (click)="irAnterior()" [disabled]="!puedeAnterior"
        class="py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-30">
        Anterior
      </button>
      <button (click)="mostrarSiguiente()"
        class="py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 active:scale-95 transition-all">
        Siguiente
      </button>
    </div>

    <button (click)="reveal()" [disabled]="!currentProduct() || isRevealed()"
      class="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg shadow-slate-900/20 disabled:bg-slate-300">
      Revelar Precio
    </button>
  </div>
</div>
 `
})
export class ProductGuessingCardComponent implements OnDestroy {
 private cosechadorService = inject(CosechadorService);
 private subs: Subscription[] = [];

 // signals for reactive state
 isRevealed = signal(false);
 currentProduct = signal<ProductoPrecioJusto | null>(null);
 error = signal<string | null>(null);

 constructor() {}

 get puedeAnterior(): boolean {
 return this.cosechadorService.getIndiceActual() >0;
 }

 mostrarSiguiente() {
 this.error.set(null);
 this.isRevealed.set(false);

 const sub = this.cosechadorService.obtenerProductoAleatorio().subscribe({
 next: (p) => {
 this.currentProduct.set(p);
 },
 error: (err) => {
 console.error(err);
 this.error.set(err?.message || String(err));
 }
 });

 this.subs.push(sub);
 }

 irAnterior() {
 const anterior = this.cosechadorService.previousFromHistory();
 if (anterior) {
 this.currentProduct.set(anterior);
 this.isRevealed.set(false);
 }
 }

 reveal() {
 if (!this.currentProduct() || this.isRevealed()) return;
 this.isRevealed.set(true);
 this.launchConfetti();
 }

 launchConfetti() {
 try {
 const container = document.createElement('div');
 container.className = 'confetti-container';
 const colors = ['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#06b6d4'];
 for (let i =0; i <24; i++) {
 const el = document.createElement('div');
 el.className = 'confetti';
 const left = Math.floor(Math.random() *100);
 el.style.left = left + '%';
 el.style.background = colors[Math.floor(Math.random() * colors.length)];
 el.style.transform = `translateY(-20vh) rotate(${Math.floor(Math.random() *360)}deg)`;
 el.style.animationDelay = Math.random() *400 + 'ms';
 el.style.width = Math.random() *10 +6 + 'px';
 el.style.height = Math.random() *18 +8 + 'px';
 container.appendChild(el);
 }
 document.body.appendChild(container);
 setTimeout(() => container.remove(),2200);
 } catch (e) {
 console.error(e);
 }
 }

 ngOnDestroy(): void {
 this.subs.forEach(s => s.unsubscribe());
 }
}
