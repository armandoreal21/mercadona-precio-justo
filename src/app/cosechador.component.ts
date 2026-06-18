import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-cosechador',
 standalone: true,
 imports: [CommonModule],
 template: `
 <div style="font-family: sans-serif; max-width:700px; margin:40px auto; padding:20px; border:1px solid #ccc; border-radius:8px; text-align: center;">

 <div *ngIf="mostrando">
 <div style="display:flex;gap:20px;align-items:flex-start;">
 <div style="flex:00300px;text-align:left;">
 <img *ngIf="producto?.imagen" [src]="producto?.imagen" alt="imagen" style="width:100%;border-radius:6px;" />
 </div>
 <div style="flex:1;text-align:left;">
 <h3>{{ producto?.nombre }}</h3>
 <p style="font-size:18px;font-weight:bold;color:#00a650">{{ producto?.precio | number:'1.2-2' }} €</p>
 <p><strong>Categoría:</strong> {{ producto?.categoria }}</p>
 <p *ngIf="producto?.descripcion"><strong>Descripción:</strong> {{ producto?.descripcion }}</p>
 <p *ngIf="producto?.share_url"><a [href]="producto?.share_url" target="_blank">Ver en tienda</a></p>

 <div style="margin-top:20px;">
 <button (click)="irAnterior()" [disabled]="!puedeAnterior" style="padding:8px12px;margin-right:8px;">Anterior</button>
 <button (click)="mostrarSiguiente()" style="padding:8px12px;">Siguiente aleatorio</button>
 </div>
 </div>
 </div>
 </div>

 <div *ngIf="error" style="margin-top:16px;color:red">{{ error }}</div>
 </div>
 `
})
export class CosechadorComponent implements OnDestroy {
 private cosechadorService = inject(CosechadorService);
 private subs: Subscription[] = [];

 producto: ProductoPrecioJusto | null = null;
 mostrando = false;
 error: string | null = null;

 get puedeAnterior(): boolean {
 return this.cosechadorService.getIndiceActual() >0;
 }

 mostrarSiguiente() {
 this.error = null;
 this.cosechadorService.obtenerProductoAleatorio().subscribe({
 next: (p) => {
 this.producto = p;
 this.mostrando = true;
 },
 error: (err) => {
 console.error(err);
 this.error = err?.message || String(err);
 }
 });
 }

 irAnterior() {
 const anterior = this.cosechadorService.previousFromHistory();
 if (anterior) {
 this.producto = anterior;
 this.mostrando = true;
 }
 }

 ngOnDestroy(): void {
 this.subs.forEach(s => s.unsubscribe());
 }
}
