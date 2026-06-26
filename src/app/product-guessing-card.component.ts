import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-product-guessing-card',
 standalone: true,
 imports: [CommonModule],
 template: `
<div class="max-w-sm mx-auto p-4">
  <!-- Tarjeta con borde biselado y efecto de luz -->
  <div class="relative bg-slate-900 border-t border-slate-700 rounded-3xl p-5 shadow-2xl overflow-hidden">

    <!-- Fondo decorativo con gradiente sutil -->
    <div class="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-transparent"></div>

    <!-- Imagen con marco estilo "cromo" -->
    <div class="relative w-full aspect-square bg-slate-950 rounded-2xl mb-6 flex items-center justify-center border border-slate-700">
      <img *ngIf="(currentProduct() && currentProduct()!.imagen)" [src]="currentProduct()!.imagen" alt="Producto" class="w-full h-full object-contain p-2" />
    </div>

    <!-- Título con más personalidad -->
    <div class="relative text-center mb-6">
      <h2 class="text-lg font-black text-white uppercase tracking-tight leading-snug">
        {{ currentProduct() ? currentProduct()!.nombre : 'CARGANDO PRODUCTO...' }}
      </h2>
    </div>

    <!-- Marcador de Precio: El centro de atención -->
    <div class="relative mb-6">
      <div class="text-center p-3 border-2 border-dashed border-slate-700 rounded-xl bg-slate-950/50">
        <div class="text-5xl font-extrabold"
             [class.text-indigo-400]="!isRevealed()"
             [class.text-emerald-400]="isRevealed()">
          {{ isRevealed() ? (currentProduct()!.precio | number:'1.2-2') + ' €' : '?.??' }}
        </div>
      </div>
    </div>

    <!-- Botones tipo 'Action Bar' -->
    <div class="relative flex gap-3">
      <button (click)="irAnterior()" [disabled]="!puedeAnterior"
        class="flex-1 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl font-bold hover:text-white transition-colors">
        « VOLVER
      </button>
      <button (click)="mostrarSiguiente()"
        class="flex-1 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl font-bold hover:text-white transition-colors">
        SIGUIENTE »
      </button>
    </div>

    <button (click)="reveal()" [disabled]="isRevealed()"
      class="relative w-full mt-3 py-4 bg-indigo-600 text-white font-black text-xl rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:bg-indigo-500 active:scale-[0.99] transition-all">
      {{ isRevealed() ? '¡BIEN!' : 'REVELAR PRECIO' }}
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
