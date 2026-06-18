import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SalaService, Sala } from './sala.service';
import { AssetLoaderService } from './asset-loader.service';

@Component({
 selector: 'app-sala-page',
 standalone: true,
 imports: [CommonModule, RouterModule, FormsModule],
 templateUrl: './sala-page.component.html'
})
export class SalaPageComponent implements OnDestroy {
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

 currentName: string | null = null;
 showHistorial = false;

 constructor(
 private route: ActivatedRoute,
 private salaService: SalaService,
 private assetLoader: AssetLoaderService,
 private router: Router
 ) {
 this.codigo = String(this.route.snapshot.paramMap.get('codigo') || '').toUpperCase();
 this.currentName = this.readCurrentName();
 this.init();

 if (typeof window !== 'undefined') {
 window.addEventListener('mpj_state_updated', this.onRemoteUpdate as EventListener);
 }
 }

 ngOnDestroy(): void {
 if (typeof window !== 'undefined') {
 window.removeEventListener('mpj_state_updated', this.onRemoteUpdate as EventListener);
 }
 this.stopTimer();
 }

 private onRemoteUpdate = () => this.refreshSala();

 readCurrentName(): string | null {
 try {
 const raw = localStorage.getItem('mpj_current');
 if (!raw) return null;
 const cur = JSON.parse(raw as string);
 return cur?.nombre || null;
 } catch (e) {
 return null;
 }
 }

 async init(): Promise<void> {
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

 const sala = this.salaService.obtenerSalaPorCodigo(this.codigo);
 if (!sala) {
 this.router.navigate(['/unirse']);
 return;
 }

 this.refreshSala();
 }

 canSeePoints(j: any): boolean {
 if (this.isCurrentAdmin()) return true;
 return j.nombre === this.currentName;
 }

 isCurrentAdmin(): boolean {
 try {
 const raw = localStorage.getItem('mpj_current');
 if (!raw) return false;
 const cur = JSON.parse(raw as string);
 return !!(cur && cur.codigo === this.codigo && cur.esAdmin);
 } catch (e) {
 return false;
 }
 }

 refreshSala(): void {
 this.sala = this.salaService.obtenerSalaPorCodigo(this.codigo);
 this.apuestas = {};
 this.sentMap = {};
 if (this.sala) {
 this.sala.jugadores.forEach(j => {
 this.apuestas[j.nombre] = j.apuesta ?? null;
 this.sentMap[j.nombre] = j.apuesta !== undefined;
 });
 }
 this.currentName = this.readCurrentName();
 }

 onRefresh(): void {
 this.refreshSala();
 try {
 const raw = localStorage.getItem('mpj_last_results_' + this.codigo);
 if (raw) {
 const stored = JSON.parse(raw as string);
 this.resultados = stored.results || null;
 this.resultadosModalVisible = !!this.resultados;
 }
 } catch (e) {
 // ignore
 }
 }

 enviarApuesta(nombre: string): void {
 if (nombre !== this.currentName) return;
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

 allPlayersHaveApuestas(): boolean {
 if (!this.sala) return false;
 return this.sala.jugadores.every(j => j.apuesta !== undefined && !isNaN(Number(j.apuesta)));
 }

 startTimer(seconds =30): void {
 if (this.timerHandle) clearInterval(this.timerHandle);
 this.timerSeconds = seconds;
 this.timerRunning = true;
 this.inputsDisabled = false;
 this.timerHandle = setInterval(() => {
 this.timerSeconds -=1;
 if (this.timerSeconds <=0) {
 this.stopTimer();
 this.inputsDisabled = true;
 if (this.isCurrentAdmin()) this.onCalcularPuntuaciones();
 }
 },1000) as unknown as number;
 }

 stopTimer(): void {
 if (this.timerHandle) clearInterval(this.timerHandle);
 this.timerHandle = null;
 this.timerRunning = false;
 }

 async onCalcularPuntuaciones(): Promise<void> {
 if (!this.isCurrentAdmin()) {
 this.errorMsg = 'Solo el admin puede calcular puntuaciones';
 setTimeout(() => (this.errorMsg = null),2000);
 return;
 }
 if (!this.allPlayersHaveApuestas()) {
 this.errorMsg = 'No todos los jugadores han apostado aún';
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
 try {
 localStorage.setItem('mpj_last_results_' + this.codigo, JSON.stringify({ ts: Date.now(), results: res }));
 } catch (e) {}
 this.salaService.clearApuestas(this.codigo);
 this.stopTimer();
 this.inputsDisabled = true;
 this.refreshSala();
 }

 cerrarModal(): void {
 this.resultadosModalVisible = false;
 this.resultados = null;
 this.errorMsg = null;
 try { localStorage.removeItem('mpj_last_results_' + this.codigo); } catch (e) {}
 this.refreshSala();
 }

 onRemovePlayer(nombre: string): void {
 if (!this.isCurrentAdmin()) return;
 if (!confirm("Eliminar jugador '" + nombre + "' de la sala?")) return;
 const ok = this.salaService.removePlayer(this.codigo, nombre);
 if (!ok) {
 this.errorMsg = 'No se pudo eliminar el jugador';
 setTimeout(() => (this.errorMsg = null),2000);
 return;
 }
 this.refreshSala();
 }

 cargarProductoAleatorio(): void {
 this.httpGetRandomProduct().then(p => {
 if (p) {
 this.salaService.actualizarProductoObjeto(this.codigo, p);
 try { localStorage.removeItem('mpj_last_results_' + this.codigo); } catch (e) {}
 this.refreshSala();
 }
 });
 }

 async httpGetRandomProduct(): Promise<any | null> {
 try {
 const cats: any = await fetch('assets/Categoria.json').then(r => r.json());
 const results = cats && cats.results ? cats.results : [];
 const posiblesSubIds: number[] = [];
 results.forEach((r: any) => { if (Array.isArray(r.categories)) r.categories.forEach((sc: any) => { if (sc && sc.id) posiblesSubIds.push(sc.id); }); });
 if (posiblesSubIds.length ===0) return null;
 const elegido = posiblesSubIds[Math.floor(Math.random() * posiblesSubIds.length)];
 const sub: any = await fetch('assets/subcategorias/' + elegido + '.json').then(r => r.json());
 const productos: any[] = [];
 if (Array.isArray(sub.products)) productos.push(...sub.products);
 if (Array.isArray(sub.categories)) {
 sub.categories.forEach((b: any) => {
 if (Array.isArray(b.products)) productos.push(...b.products);
 if (Array.isArray(b.categories)) b.categories.forEach((c2: any) => { if (Array.isArray(c2.products)) productos.push(...c2.products); });
 });
 }
 if (productos.length ===0) return null;
 const prod = productos[Math.floor(Math.random() * productos.length)];
 let precioRaw: any =0;
 if (prod) {
 if (prod.price_instructions && prod.price_instructions.unit_price != null) precioRaw = prod.price_instructions.unit_price;
 else if (prod.price && prod.price.unit_price != null) precioRaw = prod.price.unit_price;
 else precioRaw =0;
 }
 const precio = typeof precioRaw === 'string' ? parseFloat(precioRaw) : Number(precioRaw);
 return {
 id: prod && (prod.id || prod.product_id) ? (prod.id || prod.product_id) : '',
 nombre: prod && (prod.display_name || prod.name || prod.slug) ? (prod.display_name || prod.name || prod.slug) : '',
 precio: isNaN(precio) ?0 : precio,
 imagen: (prod && (prod.thumbnail || (prod.photos && prod.photos[0] && prod.photos[0].regular) || prod.share_url)) || '',
 descripcion: prod && (prod.description || prod.long_description) ? (prod.description || prod.long_description) : '',
 categoria: sub && sub.name ? sub.name : undefined,
 share_url: prod && prod.share_url ? prod.share_url : undefined
 };
 } catch (e) {
 console.error(e);
 return null;
 }
 }

 avanzarRonda(): void {
 this.salaService.avanzarRonda(this.codigo);
 this.refreshSala();
 }
}
