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

 .progress-wrap{width:100%;margin-bottom:14px}
 .progress{height:12px;background:linear-gradient(90deg,#2b3940,#11181b);border-radius:999px;overflow:hidden;box-shadow:inset0 -2px6px rgba(0,0,0,0.2)}
 .progress > i{display:block;height:100%;background:linear-gradient(90deg,#ffd166,#ff6b6b);width:0%;transition:width600ms cubic-bezier(.2,.9,.2,1)}
 .panel{background:#fff;border-radius:12px;padding:18px;box-shadow:018px40px rgba(3,10,15,0.12);border:1px solid rgba(3,10,15,0.04)}

 .card-inner{display:flex;gap:18px;align-items:flex-start}
 .thumb{flex:00320px;background:linear-gradient(180deg,#fafcfe,#f2f7fb);border-radius:8px;padding:14px;display:flex;align-items:center;justify-content:center}
 .thumb img{max-width:100%;max-height:300px;border-radius:6px;display:block}

 .meta{flex:1}
 .product-title{font-size:20px;font-weight:800;color:#042b34;margin:008px}
 .category{font-size:13px;color:#6c8a96;margin-bottom:10px}
 .description{font-size:13px;color:#6c8a96;margin-bottom:14px}

 .price{font-size:22px;font-weight:900;color:#00a650;margin:8px0}

 .controls{display:flex;gap:12px;align-items:center;margin-top:12px}
 .guess-input{padding:10px12px;border-radius:8px;border:1px solid rgba(3,10,15,0.06);width:160px;font-size:14px}
 .btn{background:#042b34;color:#fff;padding:10px14px;border-radius:8px;border:none;cursor:pointer;font-weight:700}
 .btn.secondary{background:transparent;color:#042b34;border:1px solid rgba(3,10,15,0.06)}

 .feedback{margin-top:12px;font-weight:700}
 .hint{color:#ff6b6b}
 .success{color:#00a650}

 /* animations */
 .enter{animation:enterAnim420ms cubic-bezier(.2,.9,.2,1)}
 @keyframes enterAnim{from{opacity:0;transform:translateY(10px) scale(.995)}to{opacity:1;transform:none}}

 .shake{animation:shake360ms ease}
 @keyframes shake{20%{transform:translateX(-6px)}60%{transform:translateX(6px)}100%{transform:none}}

 /* confetti */
 .confetti-container{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
 .confetti{position:absolute;width:10px;height:18px;opacity:0.95;border-radius:2px;transform:translateY(-10vh);animation:fall1600ms linear forwards}
 @keyframes fall{to{transform:translateY(110vh) rotate(720deg);opacity:1}}

 /* small responsive */
 @media (max-width:720px){.card-inner{flex-direction:column}.thumb{flex:00 auto;width:100%}.guess-input{width:100%;}}
 </style>

 <div class="game-card">
 <div class="progress-wrap" *ngIf="totalRounds>0">
 <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:#6c8a96">
 <div>Ronda {{ roundsCompleted + (mostrando?0:0) }} de {{ totalRounds }}</div>
 <div *ngIf="producto">Producto ID: {{ producto.idProducto }}</div>
 </div>
 <div class="progress"><i [style.width.%]="progressPercent"></i></div>
 </div>

 <div class="panel" [class.enter]="animateEnter">
 <div *ngIf="!mostrando" style="text-align:center;padding:40px">
 <h2 style="margin:0012px;color:#042b34">Cosechador local (assets)</h2>
 <p style="color:#6c8a96;margin:0018px">Se selecciona un producto aleatorio desde los ficheros en <code>assets/</code>.</p>
 <button class="btn" (click)="mostrarSiguiente()">Mostrar producto</button>
 </div>

 <div *ngIf="mostrando && producto" class="card-inner" [class.shake]="shake">
 <div class="thumb">
 <img *ngIf="producto?.imagen" [src]="producto?.imagen" alt="imagen" />
 </div>
 <div class="meta">
 <div class="product-title">{{ producto?.nombre || '—' }}</div>
 <div class="category" *ngIf="producto?.categoria">{{ producto?.categoria }}</div>
 <div class="description" *ngIf="producto?.descripcion">{{ producto?.descripcion }}</div>

 <div class="price">{{ producto?.precio | number:'1.2-2' }} €</div>

 <div class="controls">
 <input class="guess-input" type="number" placeholder="Introduce tu precio" (input)="guess = $any($event.target).value" (keyup.enter)="submitGuess()" />
 <button class="btn" (click)="submitGuess()">Comprobar</button>
 <button class="btn secondary" (click)="mostrarSiguiente()">Siguiente</button>
 </div>

 <div class="feedback">
 <span *ngIf="feedback" [ngClass]="{'hint':!isCorrect,'success':isCorrect}">{{ feedback }}</span>
 </div>
 </div>
 </div>

 </div>

 </div>
 `
})
export class CosechadorComponent implements OnDestroy {
 private cosechadorService = inject(CosechadorService);
 private subs: Subscription[] = [];
 private host = inject(ElementRef);

 producto: ProductoPrecioJusto | null = null;
 mostrando = false;
 error: string | null = null;

 // Game state
 guess: string | number | null = null;
 feedback: string | null = null;
 isCorrect = false;
 shake = false;
 animateEnter = false;

 // Progress
 roundsCompleted =0;
 totalRounds =10; // configurable total rounds

 get progressPercent() {
 return Math.round((this.roundsCompleted / Math.max(1, this.totalRounds)) *100);
 }

 constructor() {}

 get puedeAnterior(): boolean {
 return this.cosechadorService.getIndiceActual() >0;
 }

 mostrarSiguiente() {
 this.error = null;
 this.feedback = null;
 this.isCorrect = false;
 this.shake = false;
 this.guess = null;
 this.animateEnter = false;

 const sub = this.cosechadorService.obtenerProductoAleatorio().subscribe({
 next: (p) => {
 this.producto = p;
 this.mostrando = true;
 // small delay then animate entry
 setTimeout(() => (this.animateEnter = true),20);
 },
 error: (err) => {
 console.error(err);
 this.error = err?.message || String(err);
 }
 });

 this.subs.push(sub);
 }

 submitGuess() {
 if (!this.producto) return;
 const guessNum = Number(this.guess);
 if (isNaN(guessNum)) {
 this.feedback = 'Introduce un número válido';
 this.isCorrect = false;
 return;
 }

 const target = Number(this.producto.precio ||0);
 // accept close guesses within0.05 for float issues
 if (Math.abs(guessNum - target) <0.001) {
 this.onCorrect();
 return;
 }

 // if not correct, give hint and shake
 if (guessNum > target) {
 this.feedback = 'Demasiado alto';
 } else {
 this.feedback = 'Demasiado bajo';
 }
 this.isCorrect = false;
 this.shake = true;
 // remove shake after animation
 setTimeout(() => (this.shake = false),380);
 }

 onCorrect() {
 this.isCorrect = true;
 this.feedback = '¡Correcto!';
 this.roundsCompleted = Math.min(this.totalRounds, this.roundsCompleted +1);
 this.launchConfetti();
 }

 irAnterior() {
 const anterior = this.cosechadorService.previousFromHistory();
 if (anterior) {
 this.producto = anterior;
 this.mostrando = true;
 }
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
 // silent
 console.error(e);
 }
 }

 ngOnDestroy(): void {
 this.subs.forEach((s) => s.unsubscribe());
 }
}
