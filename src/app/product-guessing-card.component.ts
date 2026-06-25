import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-product-guessing-card',
 standalone: true,
 imports: [CommonModule],
 template: `
 <div class="max-w-3xl mx-auto p-4 md:p-8">
 <div class="bg-gradient-to-br from-white/80 to-slate-50/80 backdrop-blur-sm border border-white/60 rounded-3xl shadow-[0_10px_30px_rgba(2,6,23,0.08)] overflow-hidden flex flex-col md:flex-row gap-6 md:gap-8 items-start">

 <!-- Left: image -->
 <div class="w-full md:w-64 flex items-center justify-center p-6 md:p-8 bg-white/60 md:bg-transparent">
 <div class="bg-white rounded-2xl p-4 shadow-sm w-full h-full flex items-center justify-center">
 <img *ngIf="(currentProduct() && currentProduct()!.imagen)" [src]="currentProduct()!.imagen" alt="Producto" class="w-full h-44 md:h-56 object-contain" />
 <div *ngIf="!currentProduct() || !currentProduct()!.imagen" class="text-slate-400">Sin imagen</div>
 </div>
 </div>

 <!-- Right: content -->
 <div class="flex flex-col justify-between flex-grow w-full p-4 md:p-6">
 <div>
 <h2 class="text-xl md:text-2xl lg:text-3xl font-extrabold text-slate-800 leading-tight">{{ currentProduct() ? currentProduct()!.nombre : 'El precio justo' }}</h2>
 <p class="text-sm text-slate-500 mt-1">{{ currentProduct() && currentProduct()!.categoria ? currentProduct()!.categoria : '' }}</p>
 </div>

 <div class="py-6">
 <ng-container *ngIf="!isRevealed(); else revealedTpl">
 <div class="mx-auto md:mx-0 w-max text-3xl md:text-4xl font-mono text-slate-400 bg-slate-100 p-4 rounded-xl inline-block animate-pulse tracking-wider">?.?? €</div>
 </ng-container>
 <ng-template #revealedTpl>
 <div class="mx-auto md:mx-0 w-max text-4xl md:text-5xl font-extrabold text-teal-600 bg-gradient-to-r from-teal-50 to-white/60 px-4 py-3 rounded-xl shadow-sm">{{ currentProduct() ? (currentProduct()!.precio | number:'1.2-2') + ' €' : '—' }}</div>
 </ng-template>
 </div>

 <!-- Buttons: responsive wrapping, ensure primary stays visible and readable -->
 <div class="flex gap-3 items-center justify-center md:justify-start flex-wrap">
 <button (click)="irAnterior()"
 class="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-300"
 [disabled]="!puedeAnterior">Anterior</button>

 <button (click)="mostrarSiguiente()"
 class="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-slate-300">
 Siguiente
 </button>

 <button (click)="reveal()"
 class="px-4 py-2 rounded-full bg-teal-600 text-white shadow hover:brightness-95 transition focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:opacity-50 disabled:cursor-not-allowed"
 [disabled]="!currentProduct() || isRevealed()">Revelar Precio</button>

 </div>
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
