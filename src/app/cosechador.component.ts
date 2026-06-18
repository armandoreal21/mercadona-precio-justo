import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosechadorService, ProductoPrecioJusto } from './cosechador.service';
import { Subscription } from 'rxjs';

@Component({
 selector: 'app-cosechador',
 standalone: true,
 imports: [CommonModule],
 template: `
 <div style="font-family: sans-serif; max-width:500px; margin:40px auto; padding:20px; border:1px solid #ccc; border-radius:8px; text-align: center;">
 <h2>Cosechador de Mercadona</h2>
 <p>Utiliza esta herramienta para generar tu base de datos local para El Precio Justo.</p>

 <div *ngIf="!cargando && !completado">
 <button (click)="iniciarCosecha()" style="background:#00a650;color:white;border:none;padding:10px20px;border-radius:4px;cursor:pointer;">
 Iniciar Captura de Catálogo
 </button>
 </div>

 <div *ngIf="cargando" style="margin:20px0;">
 <p>Procesando pasillos del supermercado...</p>
 <p style="font-weight:bold">{{ pasillosProcesados }} / {{ totalPasillos }}</p>
 <div style="background:#eee;width:100%;height:20px;border-radius:10px;overflow:hidden;">
 <div [style.width.%]="porcentaje" style="background:#00a650;height:100%;transition:width0.2s;"></div>
 </div>
 </div>

 <div *ngIf="completado" style="margin-top:20px;color:#00a650;">
 <p>🎉 ¡Captura completada con éxito!</p>
 <p>Se han encontrado <strong>{{ productos.length }}</strong> productos únicos.</p>
 <button (click)="descargarJson()" style="background:#007bff;color:white;border:none;padding:10px20px;border-radius:4px;cursor:pointer;margin-top:10px;">
 💾 Descargar productos.json
 </button>
 </div>
 </div>
 `
})
export class CosechadorComponent implements OnDestroy {
 private cosechadorService = inject(CosechadorService);

 productos: ProductoPrecioJusto[] = [];
 cargando = false;
 completado = false;

 totalPasillos =0;
 pasillosProcesados =0;

 private subs: Subscription[] = [];

 get porcentaje(): number {
 return this.totalPasillos >0 ? (this.pasillosProcesados / this.totalPasillos) *100 :0;
 }

 iniciarCosecha() {
 this.cargando = true;
 this.completado = false;

 this.subs.push(this.cosechadorService.totalPasillos$.subscribe(total => this.totalPasillos = total));
 this.subs.push(this.cosechadorService.pasillosProcesados$.subscribe(p => this.pasillosProcesados = p));

 this.subs.push(this.cosechadorService.descargarTodo().subscribe({
 next: resultado => {
 this.productos = resultado;
 this.cargando = false;
 this.completado = true;
 },
 error: err => {
 console.error('Error al cosechar:', err);
 alert('Hubo un error con el proxy de CORS. Inténtalo de nuevo en unos minutos.');
 this.cargando = false;
 }
 }));
 }

 descargarJson() {
 const jsonString = JSON.stringify(this.productos, null,2);
 const blob = new Blob([jsonString], { type: 'application/json' });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'productos.json';
 a.click();
 window.URL.revokeObjectURL(url);
 }

 ngOnDestroy(): void {
 this.subs.forEach(s => s.unsubscribe());
 }
}
