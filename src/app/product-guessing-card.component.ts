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
  <!-- Tarjeta con borde biselado, efecto de luz y animación de pulso suave -->
  <div class="relative bg-slate-900 border-t border-slate-700 rounded-3xl p-5 shadow-2xl overflow-hidden game-card-glow">

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

    <!-- Marcador de Precio: El centro de atención con escala al revelar -->
    <div class="relative mb-6">
      <div class="text-center p-3 border-2 border-dashed border-slate-700 rounded-xl bg-slate-950/50 price-anchor">
        <div class="text-5xl font-extrabold transition-all duration-500 ease-out"
             [class.scale-110]="isRevealed()"
             [class.text-indigo-400]="!isRevealed()"
             [class.text-emerald-400]="isRevealed()">
          {{ isRevealed() ? (currentProduct()!.precio | number:'1.2-2') + ' €' : '?.??' }}
        </div>
      </div>
    </div>

    <!-- Botones tipo 'Action Bar' -->
    <div class="relative flex gap-3">
      <button (click)="irAnterior()" [disabled]="!puedeAnterior"
        class="flex-1 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl font-bold hover:text-white active:scale-[0.98] transition-all disabled:opacity-30">
        « VOLVER
      </button>
      <button (click)="mostrarSiguiente()"
        class="flex-1 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl font-bold hover:text-white active:scale-[0.98] transition-all">
        SIGUIENTE »
      </button>
    </div>

    <button (click)="reveal()" [disabled]="isRevealed()"
      class="relative w-full mt-3 py-4 bg-indigo-600 text-white font-black text-xl rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:bg-indigo-500 active:scale-[0.98] transition-all">
      {{ isRevealed() ? '¡BIEN!' : 'REVELAR PRECIO' }}
    </button>
  </div>
</div>
 `
})
export class ProductGuessingCardComponent implements OnDestroy {
 // make the service public so the template can access it
 public cosechadorService = inject(CosechadorService);
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
 this.launchPriceParticles();
 }

 launchPriceParticles() {
 try {
 const anchor = document.querySelector('.price-anchor');
 if (!anchor) return;
 const rect = anchor.getBoundingClientRect();
 const priceText = this.currentProduct() ? (this.currentProduct()!.precio.toFixed(2) + ' €') : '€';
 const symbols = ['€', '¢', '€'];
 for (let i =0; i <18; i++) {
 const el = document.createElement('div');
 el.className = 'price-particle';
 // choose either symbol or small price fragment
 el.innerText = Math.random() >0.7 ? priceText : symbols[Math.floor(Math.random() * symbols.length)];
 el.style.position = 'fixed';
 // start near the center of the price anchor with some jitter
 const startX = rect.left + rect.width /2 + (Math.random() -0.5) * rect.width *0.6;
 const startY = rect.top + rect.height /2 + (Math.random() -0.5) * rect.height *0.2;
 el.style.left = startX + 'px';
 el.style.top = startY + 'px';
 el.style.pointerEvents = 'none';
 el.style.fontWeight = '800';
 el.style.color = ['#06d6a0', '#ffd166', '#ef476f', '#06b6d4', '#94a3b8'][Math.floor(Math.random() *5)];
 el.style.fontSize = (12 + Math.random() *18) + 'px';
 el.style.opacity = '1';
 el.style.transform = `translateY(0) rotate(${Math.floor(Math.random() *360)}deg)`;
 // smooth transform and fade transitions
 el.style.transition = 'transform900ms cubic-bezier(.2,.9,.2,1), opacity900ms ease-out';
 el.style.willChange = 'transform, opacity';
 document.body.appendChild(el);
 // trigger movement next tick
 setTimeout(() => {
 const dx = (Math.random() -0.5) *120; // horizontal drift
 const dy = -120 - Math.random() *160; // upward motion
 const rotate = (Math.random() -0.5) *720;
 el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;
 el.style.opacity = '0';
 },20 + Math.random() *120);
 // remove after animation
 setTimeout(() => {
 try { el.remove(); } catch (e) { /* ignore */ }
 },1200 + Math.random() *600);
 }
 } catch (e) {
 console.error(e);
 }
 }

 ngOnDestroy(): void {
 this.subs.forEach(s => s.unsubscribe());
 }
}
