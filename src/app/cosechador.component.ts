import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-cosechador',
 standalone: true,
 imports: [CommonModule],
 template: `
 <style>
 :host { display:block; width:100%; padding:1.5rem; box-sizing:border-box; }
 .card-wrapper { max-width:900px; margin:0 auto; }

 .card-panel {
 background: rgba(255,255,255,0.9);
 backdrop-filter: blur(8px);
 -webkit-backdrop-filter: blur(8px);
 border:1px solid rgba(255,255,255,0.6);
 box-shadow: 0 10px 30px rgba(2,6,23,0.06);
 padding:24px;
 border-radius:24px;
 display: flex;
 gap:18px;
 flex-direction: column;
 align-items: stretch;
 }
 @media (min-width:768px) {
 .card-panel { flex-direction: row; align-items: flex-start; }
 }

 /* Left / image */
 .left-col { flex: 0 0 260px; display:flex; align-items:center; justify-content:center; }
 .image-box {
 width:220px;
 height:220px;
 background:#f8fafc;
 border-radius:16px;
 display:flex;
 align-items:center;
 justify-content:center;
 overflow:hidden;
 padding:8px;
 }
 .image-box img { width:100%; height:100%; object-fit:contain; display:block; }
 @media (min-width:768px) { .image-box { width:260px; height:260px; } }
 @media (max-width:767px) {
 .left-col { width:100%; display:flex; justify-content:center; margin-bottom:12px; }
 .image-box { width:60%; height:auto; padding:12px; }
 .image-box img { height:auto; max-height:260px; }
 }

 /* Right / content */
 .right-col { flex:1; display:flex; flex-direction:column; gap:12px; justify-content:flex-start; }
 .title { font-size:1.375rem; font-weight:800; color:#0f172a; margin-bottom:6px; }
 .subtitle { color:#64748b; margin-bottom:6px; }
 .description { color:#64748b; font-size:0.95rem; }

 /* price */
 .price-area { padding:18px 0; }
 .price-placeholder {
 font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
 font-weight:800;
 color:#64748b;
 background: rgba(241,245,249,0.6);
 padding:10px 14px;
 border-radius:10px;
 display:inline-block;
 font-size:1.75rem;
 }
 .price-revealed { font-size:2rem; font-weight:900; color:#059669 }

 /* controls: pill buttons */
 .controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap }
 .btn {
 padding:8px 12px;
 border-radius:999px;
 border:1px solid rgba(15,23,42,0.06);
 background:#ffffff;
 cursor:pointer;
 box-shadow: 1px 2px rgba(2,6,23,0.04);
 transition:
 transform 180ms ease,
 box-shadow 180ms ease,
 background-color 180ms ease;
 font-size:0.95rem;
 }
 .btn:hover { transform: translateY(-2px); }
 .btn.primary {
 background:#0f172a;
 color:#fff;
 border:none;
 box-shadow: 6px 20px rgba(15,23,42,0.12);
 }
 .btn.ghost { background:transparent }
 .btn.secondary { background:#ffffff; border:1px solid rgba(15,23,42,0.06); color:#1f2937 }
 .btn[disabled] { opacity:0.5; cursor:not-allowed; transform:none }

 /* small helpers for subtle UI */
 .card-wrapper-responsive { padding:1rem; }

 /* animations */
 @keyframes fadeInUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
 .animate-fade-in-up { animation: fadeInUp 420ms cubic-bezier(.2,.9,.2,1) both }
 @keyframes pulse {0% { opacity:1 }50% { opacity:0.6 }100% { opacity:1 } }
 .animate-pulse { animation: pulse 1.8s cubic-bezier(.4,0,.6,1) infinite }
 </style>

 <div class="card-wrapper card-wrapper-responsive">
 <div class="card-panel">

 <!-- Left: image -->
 <div class="left-col">
 <div class="image-box">
 <img *ngIf="currentProduct && currentProduct.imagen" [src]="currentProduct.imagen" alt="imagen" />
 <div *ngIf="!currentProduct || !currentProduct.imagen" style="color:#94a3b8">Sin imagen</div>
 </div>
 </div>

 <!-- Right: content -->
 <div class="right-col">
 <div>
 <div class="title">{{ currentProduct ? currentProduct.nombre : 'El precio justo' }}</div>
 <div class="subtitle">{{ currentProduct && currentProduct.categoria ? currentProduct.categoria : '' }}</div>
 <p *ngIf="currentProduct && currentProduct.descripcion" class="description">{{ currentProduct.descripcion }}</p>
 </div>

 <div>
 <div class="price-area">
 <ng-container *ngIf="!isRevealed; else revealedTpl">
 <div class="price-placeholder">?.?? €</div>
 </ng-container>
 <ng-template #revealedTpl>
 <div class="price-revealed animate-fade-in-up">{{ currentProduct ? (currentProduct.precio | number:'1.2-2') + ' €' : '—' }}</div>
 </ng-template>
 </div>

 <div class="controls">
 <button class="btn ghost" (click)="irAnterior()" [disabled]="!puedeAnterior">Anterior</button>
 <button class="btn secondary" (click)="mostrarSiguiente()">Siguiente</button>
 <button
 (click)="reveal()"
 class="btn primary"
 [class.opacity-50]="!currentProduct || isRevealed"
 [disabled]="!currentProduct || isRevealed">
 Revelar Precio
 </button>
 </div>

 <div *ngIf="error" style="margin-top:12px;color:#ef4444">{{ error }}</div>
 </div>
 </div>

 </div>
 </div>
 `
})
export class CosechadorComponent implements OnDestroy {
 private cosechadorService = inject(CosechadorService);
 private subs: Subscription[] = [];

 // reactive state (plain properties for compatibility)
 isRevealed = false;
 currentProduct: ProductoPrecioJusto | null = null;

 mostrando = false;
 error: string | null = null;

 constructor() {}

 get puedeAnterior(): boolean {
 return this.cosechadorService.getIndiceActual() >0;
 }

 mostrarSiguiente() {
 this.error = null;
 this.isRevealed = false;

 const sub = this.cosechadorService.obtenerProductoAleatorio().subscribe({
 next: (p) => {
 this.currentProduct = p;
 this.mostrando = true;
 },
 error: (err) => {
 console.error(err);
 this.error = err?.message || String(err);
 }
 });

 this.subs.push(sub);
 }

 irAnterior() {
 const anterior = this.cosechadorService.previousFromHistory();
 if (anterior) {
 this.currentProduct = anterior;
 this.mostrando = true;
 this.isRevealed = false;
 }
 }

 reveal() {
 if (!this.currentProduct || this.isRevealed) return;
 this.isRevealed = true;
 // small celebration
 this.launchConfetti();
 }

 launchConfetti() {
 try {
 const container = document.createElement('div');
 container.className = 'confetti-container';
 const colors = ['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#06b6d4'];
 for (let i =0; i <28; i++) {
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
 this.subs.forEach((s) => s.unsubscribe());
 }
}
