import { Component, inject, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-cosechador',
 standalone: true,
 imports: [CommonModule],
 template: `
 <style>
 :host{display:block;width:100%}
 .game-card{width:100%;max-width:760px;margin:0 auto;color:#062737;font-family:'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Segoe UI', Roboto, 'Helvetica Neue', Arial}

 .panel{background:#fff;border-radius:12px;padding:18px;box-shadow:018px40px rgba(3,10,15,0.12);border:1px solid rgba(3,10,15,0.04)}

 .card-inner{display:flex;gap:18px;align-items:flex-start}
 .thumb{flex:00320px;background:linear-gradient(180deg,#fafcfe,#f2f7fb);border-radius:8px;padding:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform220ms ease, box-shadow220ms ease}
 .thumb:hover{transform:translateY(-6px);box-shadow:012px24px rgba(3,10,15,0.08)}
 .thumb img{max-width:100%;max-height:300px;border-radius:6px;display:block}

 .meta{flex:1}
 .product-title{font-size:20px;font-weight:800;color:#042b34;margin:8px0}
 .category{font-size:13px;color:#6c8a96;margin-bottom:10px}
 .description{font-size:13px;color:#6c8a96;margin-bottom:14px}

 .price{font-size:22px;font-weight:900;color:#00a650;margin:8px0;opacity:0;transform:translateY(6px) scale(0.98);transition:all280ms cubic-bezier(.2,.9,.2,1)}
 .price.revealed{opacity:1;transform:translateY(0) scale(1);text-shadow:06px18px rgba(0,166,80,0.14)}

 .controls{display:flex;gap:12px;align-items:center;margin-top:12px}
 .btn{background:#042b34;color:#fff;padding:10px14px;border-radius:8px;border:none;cursor:pointer;font-weight:700}
 .btn.secondary{background:transparent;color:#042b34;border:1px solid rgba(3,10,15,0.06)}
 .btn[disabled]{opacity:0.45;cursor:not-allowed}

 /* reveal pulse */
 .reveal-pulse{position:relative}
 .reveal-pulse::after{content:'';position:absolute;left:50%;top:50%;width:0;height:0;background:radial-gradient(circle,#00a65033,#00a65011);border-radius:50%;transform:translate(-50%,-50%);opacity:0;transition:opacity320ms, width320ms, height320ms}
 .reveal-pulse.pop::after{opacity:1;width:260px;height:260px}

 /* confetti container */
 .confetti-container{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
 .confetti{position:absolute;width:10px;height:18px;opacity:0.95;border-radius:2px;transform:translateY(-10vh);animation:fall1600ms linear forwards}
 @keyframes fall{to{transform:translateY(110vh) rotate(720deg);opacity:1}}

 /* responsive */
 @media (max-width:720px){.card-inner{flex-direction:column}.thumb{flex:00 auto;width:100%}}
 </style>

 <div class="game-card">
 <div class="panel">
 <div *ngIf="!mostrando" style="text-align:center;padding:40px">
 <h2 style="margin:0012px;color:#042b34">Cosechador local (assets)</h2>
 <p style="color:#6c8a96;margin:0018px">Se selecciona un producto aleatorio desde los ficheros en <code>assets/</code>.</p>
 <div style="display:flex;gap:12px;justify-content:center">
 <button class="btn" (click)="mostrarSiguiente()">Mostrar producto</button>
 </div>
 </div>

 <div *ngIf="mostrando && producto" class="card-inner">
 <div class="thumb reveal-pulse" (click)="reveal()" [class.pop]="animateReveal" title="Haz clic para revelar el precio">
 <img *ngIf="producto?.imagen" [src]="producto?.imagen" alt="imagen" />
 </div>

 <div class="meta">
 <div class="product-title">{{ producto?.nombre || '—' }}</div>
 <div class="category" *ngIf="producto?.categoria">{{ producto?.categoria }}</div>
 <div class="description" *ngIf="producto?.descripcion">{{ producto?.descripcion }}</div>

 <div [class.price]="true" [class.revealed]="revealed">{{ revealed ? (producto?.precio | number:'1.2-2') + ' €' : '—' }}</div>

 <div class="controls">
 <button class="btn secondary" (click)="irAnterior()" [disabled]="!puedeAnterior">Anterior</button>
 <button class="btn" (click)="mostrarSiguiente()">Siguiente</button>
 <button class="btn secondary" (click)="reveal()">Revelar</button>
 </div>
 </div>
 </div>

 <div *ngIf="error" style="margin-top:12px;color:#ef476f">{{ error }}</div>
 </div>
 </div>
 `
})
export class CosechadorComponent implements OnDestroy {
 private cosechadorService = inject(CosechadorService);
 private subs: Subscription[] = [];

 producto: ProductoPrecioJusto | null = null;
 mostrando = false;
 error: string | null = null;

 // Reveal state
 revealed = false;
 animateReveal = false;

 constructor() {}

 get puedeAnterior(): boolean {
 return this.cosechadorService.getIndiceActual() >0;
 }

 mostrarSiguiente() {
 this.error = null;
 this.revealed = false;
 this.animateReveal = false;

 const sub = this.cosechadorService.obtenerProductoAleatorio().subscribe({
 next: (p) => {
 this.producto = p;
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
 this.producto = anterior;
 this.mostrando = true;
 this.revealed = false;
 this.animateReveal = false;
 }
 }

 reveal() {
 if (!this.producto || this.revealed) return;
 this.revealed = true;
 // small pulse animation on the thumb
 this.animateReveal = true;
 setTimeout(() => (this.animateReveal = false),420);
 // celebration
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
 // remove after animation
 setTimeout(() => {
 container.remove();
 },2200);
 } catch (e) {
 console.error(e);
 }
 }

 ngOnDestroy(): void {
 this.subs.forEach((s) => s.unsubscribe());
 }
}
