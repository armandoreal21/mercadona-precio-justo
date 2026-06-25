import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-product-guessing-card',
 standalone: true,
 imports: [CommonModule],
 template: `
 <div class="max-w-3xl mx-auto bg-white/70 backdrop-blur-md border border-white/50 p-8 rounded-3xl shadow-2xl flex gap-8 items-start">

 <!-- Left: image -->
 <div class="w-64 h-64 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center">
 <img *ngIf="(currentProduct() && currentProduct()!.imagen)" [src]="currentProduct()!.imagen" alt="Producto" class="w-full h-full object-contain p-4" />
 <div *ngIf="!currentProduct() || !currentProduct()!.imagen" class="text-slate-400">Sin imagen</div>
 </div>

 <!-- Right: content -->
 <div class="flex flex-col justify-between flex-grow">
 <div>
 <h2 class="text-2xl font-bold text-slate-800">{{ currentProduct() ? currentProduct()!.nombre : 'El precio justo' }}</h2>
 <p class="text-slate-500">{{ currentProduct() && currentProduct()!.categoria ? currentProduct()!.categoria : '' }}</p>
 </div>

 <div class="py-6">
 <ng-container *ngIf="!isRevealed(); else revealedTpl">
 <div class="text-4xl font-mono text-slate-400 bg-slate-200/50 p-4 rounded-lg inline-block animate-pulse">?.?? €</div>
 </ng-container>
 <ng-template #revealedTpl>
 <div class="text-5xl font-extrabold text-teal-600 animate-fade-in-up">{{ currentProduct() ? (currentProduct()!.precio | number:'1.2-2') + ' €' : '—' }}</div>
 </ng-template>
 </div>

 <!-- Buttons: responsive wrapping, ensure primary stays visible and readable -->
 <div class="flex gap-3 items-center flex-wrap sm:flex-nowrap">
 <!-- neutral small pill -->
 <button (click)="irAnterior()"
 class="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-300"
 [disabled]="!puedeAnterior">Anterior</button>

 <button (click)="mostrarSiguiente()"
 class="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-slate-300">
 Siguiente
 </button>

  <button (click)="reveal()"
 class="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-slate-300"
 [disabled]="!currentProduct() || isRevealed()">Revelar Precio</button>

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
