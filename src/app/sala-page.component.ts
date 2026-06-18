import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SalaService, Sala } from './sala.service';
import { AssetLoaderService } from './asset-loader.service';

@Component({
 selector: 'app-sala-page',
 standalone: true,
 imports: [CommonModule, RouterModule, FormsModule],
 template: `
 <div class="min-h-screen bg-slate-900 p-4 text-white">
 <div *ngIf="loadError" class="max-w-2xl mx-auto p-6 bg-red-800 rounded-xl text-white">Error cargando assets: {{ loadError }}</div>
 <div *ngIf="!sala && !loadError" class="max-w-2xl mx-auto p-6 bg-slate-800 rounded-xl">Sala no encontrada</div>

 <div *ngIf="sala" class="max-w-3xl mx-auto p-6 bg-slate-800 rounded-3xl shadow-2xl border-4 border-purple-600">
 <div class="flex items-center justify-between mb-4">
 <div>
 <h2 class="text-2xl font-black text-yellow-400">Sala: {{ sala.nombre }}</h2>
 <div class="text-sm text-slate-300">Código: <span class="font-mono">{{ sala.codigo }}</span></div>
 </div>
 <div class="text-right">
 <div class="text-sm">Ronda {{ sala.rondaActual }} / {{ sala.rondasTotales }}</div>
 <div class="text-xs text-slate-400">Estado: {{ sala.estado }}</div>
 </div>
 </div>

 <div class="grid md:grid-cols-3 gap-4">
 <div class="md:col-span-2 bg-slate-900 p-4 rounded-xl">

 <div *ngIf="sala.productoActual; else sinProducto">
 <h3 class="text-xl font-bold">{{ sala.productoActual.nombre || sala.productoActual.display_name }}</h3>
 <img *ngIf="sala.productoActual.imagen || sala.productoActual.thumbnail" [src]="sala.productoActual.imagen || sala.productoActual.thumbnail" class="w-full max-w-sm rounded-lg mt-3" />
 <p class="mt-3 text-slate-300">Precio real: <strong class="text-green-300">{{ sala.productoActual.precio | number:'1.2-2' }} €</strong></p>
 </div>
 <ng-template #sinProducto>
 <div class="text-center text-slate-400 p-6">Aún no se ha seleccionado un producto para esta ronda.</div>
 </ng-template>

 <div class="mt-4 flex gap-2 items-center">
 <button (click)="cargarProductoAleatorio()" class="bg-yellow-400 text-purple-900 px-3 py-2 rounded-xl font-bold">Siguiente Producto</button>
 <button (click)="avanzarRonda()" class="bg-cyan-400 text-slate-900 px-3 py-2 rounded-xl font-bold">Finalizar Ronda</button>

 <ng-container *ngIf="isCurrentAdmin()">
 <button (click)="onCalcularPuntuaciones()" class="bg-rose-500 text-white px-3 py-2 rounded-xl font-bold" title="Calcular según apuestas">Calcular puntuaciones</button>
 <div class="ml-4 flex items-center gap-2">
 <button (click)="startTimer(30)" class="px-3 py-2 bg-indigo-600 rounded">Iniciar temporizador30s</button>
 <div *ngIf="timerRunning" class="text-sm">Tiempo: {{ timerSeconds }}s</div>
 </div>
 </ng-container>
 </div>

 <!-- Resultado modal simple -->
 <div *ngIf="resultadosModalVisible" class="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
 <div class="bg-slate-800 p-6 rounded-xl w-full max-w-lg">
 <h4 class="text-xl font-bold mb-3">Resultados Ronda</h4>
 <div *ngIf="resultados && resultados.length>0" class="space-y-2">
 <div *ngFor="let r of resultados" class="flex justify-between bg-slate-900 p-2 rounded">
 <div><strong>{{ r.nombre }}</strong> — delta: {{ r.delta | number:'1.2-2' }} €</div>
 <div class="font-bold">+{{ r.puntos }} pts</div>
 </div>
 </div>
 <div *ngIf="resultados && resultados.length===0" class="text-slate-400">No hubo apuestas válidas esta ronda.</div>
 <div *ngIf="errorMsg" class="text-red-400 mt-2">{{ errorMsg }}</div>

 <div class="mt-4 text-right">
 <button (click)="cerrarModal()" class="px-4 py-2 bg-yellow-400 text-purple-900 rounded font-bold">Cerrar</button>
 </div>
 </div>
 </div>

 </div>

 <div class="bg-slate-800 p-4 rounded-xl">
 <h4 class="font-bold text-lg mb-2">Jugadores</h4>
 <ol class="list-decimal list-inside space-y-3">
 <li *ngFor="let j of sala.jugadores" class="flex items-center justify-between gap-2">
 <div class="flex-1">
 <div class="font-semibold">{{ j.nombre }} <span *ngIf="j.esAdmin" class="text-yellow-300">(admin)</span></div>
 <div class="text-xs text-slate-400">Puntos: {{ j.puntuacion ||0 }}</div>
 </div>

 <div class="w-44">
 <input type="number" [(ngModel)]="apuestas[j.nombre]" placeholder="€" class="w-full text-center bg-slate-700 rounded px-2 py-1" [disabled]="inputsDisabled || sentMap[j.nombre]" />
 <div class="mt-2 flex gap-2">
 <button (click)="enviarApuesta(j.nombre)" class="bg-cyan-400 text-slate-900 px-2 py-1 rounded text-sm" [disabled]="inputsDisabled || sentMap[j.nombre]">Enviar</button>
 <div *ngIf="sentMap[j.nombre]" class="text-xs text-slate-300 self-center">Enviada: {{ j.apuesta }}€</div>
 </div>
 </div>
 </li>
 </ol>
 </div>
 </div>
 </div>
 </div>
 `
})
export class SalaPageComponent {
 sala: Sala | null = null;
 codigo = '';
 loadError: string | null = null;
 apuestas: Record<string, number | null> = {};
 resultados: { nombre: string; puntos: number; delta: number }[] | null = null;
 resultadosModalVisible = false;
 errorMsg: string | null = null;

 // timer & UI state
 timerSeconds =0;
 timerRunning = false;
 private timerHandle: any = null;
 inputsDisabled = false; // global disable after timer ends
 sentMap: Record<string, boolean> = {};

 constructor(
 private route: ActivatedRoute,
 private salaService: SalaService,
 private assetLoader: AssetLoaderService,
 private router: Router
 ) {
 this.codigo = String(this.route.snapshot.paramMap.get('codigo') || '').toUpperCase();
 this.init();
 }

 async init() {
 // comprobación previa de assets: Categoria.json
 try {
 const cats: any = await fetch('assets/Categoria.json').then(r => r.json());
 if (!cats || !cats.results) {
 this.loadError = 'Categoria.json tiene formato inválido';
 return;
 }
 } catch (e) {
 this.loadError = 'No se pudo cargar Categoria.json';
 return;
 }

 // comprobar que la sala existe
 const sala = this.salaService.obtenerSalaPorCodigo(this.codigo);
 if (!sala) {
 // redirigir a unirse con mensaje
 this.router.navigate(['/unirse']);
 return;
 }

 this.refreshSala();
 }

 hasAdmin(): boolean {
 return !!this.sala && Array.isArray(this.sala.jugadores) && this.sala.jugadores.some(p => !!p.esAdmin);
 }

 isCurrentAdmin(): boolean {
 try {
 const cur = JSON.parse(localStorage.getItem('mpj_current') || 'null');
 return cur && cur.codigo === this.codigo && cur.esAdmin;
 } catch (e) {
 return false;
 }
 }

 refreshSala() {
 this.sala = this.salaService.obtenerSalaPorCodigo(this.codigo);
 this.apuestas = {};
 this.sentMap = {};
 if (this.sala) {
 this.sala.jugadores.forEach(j => {
 this.apuestas[j.nombre] = j.apuesta ?? null;
 this.sentMap[j.nombre] = j.apuesta !== undefined;
 });
 }
 }

 enviarApuesta(nombre: string) {
 const val = this.apuestas[nombre];
 if (val === null || val === undefined || isNaN(Number(val))) {
 this.errorMsg = 'Introduce un valor numérico válido';
 setTimeout(() => (this.errorMsg = null),2000);
 return;
 }
 const ok = this.salaService.setApuesta(this.codigo, nombre, Number(val));
 if (!ok) {
 this.errorMsg = 'No se pudo guardar la apuesta';
 setTimeout(() => (this.errorMsg = null),2000);
 return;
 }
 this.sentMap[nombre] = true;
 this.refreshSala();
 }

 startTimer(seconds =30) {
 if (this.timerHandle) clearInterval(this.timerHandle);
 this.timerSeconds = seconds;
 this.timerRunning = true;
 this.inputsDisabled = false; // allow inputs while timer runs
 this.timerHandle = setInterval(() => {
 this.timerSeconds -=1;
 if (this.timerSeconds <=0) {
 this.stopTimer();
 // al finalizar, bloquear inputs y calcular automáticamente
 this.inputsDisabled = true;
 this.onCalcularPuntuaciones();
 }
 },1000);
 }

 stopTimer() {
 if (this.timerHandle) clearInterval(this.timerHandle);
 this.timerHandle = null;
 this.timerRunning = false;
 }

 async onCalcularPuntuaciones() {
 if (!this.isCurrentAdmin()) {
 this.errorMsg = 'Solo el admin puede calcular puntuaciones';
 setTimeout(() => (this.errorMsg = null),2000);
 return;
 }

 this.errorMsg = null;
 const res = this.salaService.calcularPuntuacionesRonda(this.codigo);
 if (res === null) {
 this.errorMsg = 'No hay precio real definido para el producto actual';
 this.resultados = null;
 this.resultadosModalVisible = true;
 return;
 }
 this.resultados = res;
 this.resultadosModalVisible = true;
 // limpiar apuestas para siguiente ronda
 this.salaService.clearApuestas(this.codigo);
 // detener timer si estaba corriendo
 this.stopTimer();
 this.inputsDisabled = true;
 // refrescar sala para mostrar nuevas puntuaciones
 this.refreshSala();
 }

 cerrarModal() {
 this.resultadosModalVisible = false;
 this.resultados = null;
 this.errorMsg = null;
 this.refreshSala();
 }

 cargarProductoAleatorio() {
 this.httpGetRandomProduct().then(p => {
 if (p) {
 this.salaService.actualizarProductoObjeto(this.codigo, p);
 this.refreshSala();
 }
 });
 }

 async httpGetRandomProduct(): Promise<any | null> {
 try {
 const cats: any = await fetch('assets/Categoria.json').then(r => r.json());
 const results = cats?.results || [];
 const posiblesSubIds: number[] = [];
 results.forEach((r: any) => {
 if (Array.isArray(r.categories)) r.categories.forEach((sc: any) => {
 if (sc?.id) posiblesSubIds.push(sc.id);
 });
 });
 if (posiblesSubIds.length ===0) return null;
 const elegido = posiblesSubIds[Math.floor(Math.random() * posiblesSubIds.length)];
 const sub: any = await fetch(`assets/subcategorias/${elegido}.json`).then(r => r.json());
 const productos: any[] = [];
 if (Array.isArray(sub.products)) productos.push(...sub.products);
 if (Array.isArray(sub.categories)) {
 sub.categories.forEach((b: any) => {
 if (Array.isArray(b.products)) productos.push(...b.products);
 if (Array.isArray(b.categories)) b.categories.forEach((c2: any) => {
 if (Array.isArray(c2.products)) productos.push(...c2.products);
 });
 });
 }
 if (productos.length ===0) return null;
 const prod = productos[Math.floor(Math.random() * productos.length)];
 const precioRaw = prod?.price_instructions?.unit_price ?? prod?.price?.unit_price ??0;
 const precio = typeof precioRaw === 'string' ? parseFloat(precioRaw) : Number(precioRaw);
 return {
 id: prod.id ?? prod?.product_id ?? '',
 nombre: prod.display_name || prod.name || prod?.slug || '',
 precio: isNaN(precio) ?0 : precio,
 imagen: prod.thumbnail || prod.photos?.[0]?.regular || prod.share_url || '',
 descripcion: prod.description || prod.long_description || '',
 categoria: sub.name || undefined,
 share_url: prod.share_url || undefined
 };
 } catch (e) {
 console.error(e);
 return null;
 }
 }

 avanzarRonda() {
 this.salaService.avanzarRonda(this.codigo);
 this.refreshSala();
 }
}
