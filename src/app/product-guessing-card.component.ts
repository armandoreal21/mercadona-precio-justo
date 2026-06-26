import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-product-guessing-card',
 standalone: true,
 imports: [CommonModule],
 template: `
 <div class="max-w-sm mx-auto p-2">
  <!-- Tarjeta Principal -->
  <div class="relative bg-slate-900 border-4 border-slate-800 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden">

    <!-- Imagen -->
    <div class="w-full aspect-square bg-slate-800 rounded-2xl mb-6 flex items-center justify-center border-2 border-slate-700/50">
      <img *ngIf="(currentProduct() && currentProduct()!.imagen)" [src]="currentProduct()!.imagen" alt="Producto" class="w-full h-full object-contain p-4" />
    </div>

    <!-- Contenido -->
    <div class="text-center mb-6">
      <h2 class="text-xl font-black text-white uppercase">{{ currentProduct() ? currentProduct()!.nombre : '¿PRECIO?' }}</h2>
    </div>

    <!-- Marcador de Precio -->
    <div class="bg-black/40 border-2 border-slate-700 rounded-2xl py-4 mb-8">
      <div class="text-4xl font-black tracking-tighter transition-all duration-300"
           [class.text-cyan-400]="!isRevealed()"
           [class.text-yellow-400]="isRevealed()">
        {{ isRevealed() ? (currentProduct()!.precio | number:'1.2-2') + ' €' : '?.?? €' }}
      </div>
    </div>

    <!-- Botones Estilo Arcade -->
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <button (click)="irAnterior()" [disabled]="!puedeAnterior"
          class="py-3 rounded-xl bg-slate-800 border-b-4 border-slate-950 text-white font-bold hover:bg-slate-700 active:border-b-0 transition-all disabled:opacity-30">
          ATRÁS
        </button>
        <button (click)="mostrarSiguiente()"
          class="py-3 rounded-xl bg-slate-800 border-b-4 border-slate-950 text-white font-bold hover:bg-slate-700 active:border-b-0 transition-all">
          SIGUIENTE
        </button>
      </div>

      <button (click)="reveal()" [disabled]="isRevealed()"
        class="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 border-b-4 border-blue-800 text-white font-black text-lg hover:from-cyan-400 hover:to-blue-500 active:border-b-0 active:translate-y-1 transition-all shadow-lg">
        {{ isRevealed() ? '¡CORRECTO!' : 'REVELAR PRECIO' }}
      </button>
    </div>
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
