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
 // product id captured when the 'esperando' modal was opened so we can detect product changes
 productIdAtEsperandoOpen: any = null;
 codigo = '';
 loadError: string | null = null;
 apuestas: Record<string, number | null> = {};
 // include apuesta in result so modal can show player's guess and direction
 resultados: { nombre: string; puntos: number; delta: number; apuesta?: number }[] | null = null;
 resultadosModalVisible = false;
 errorMsg: string | null = null;
 // store last price for modal display
 lastPrice: number | null = null;
 // also keep a snapshot of the product associated with the shown results so clients keep the same modal content
 modalProducto: any | null = null;
 // waiting modal state
 esperandoModalVisible = false;
 esperandoList: { nombre: string; apostado: boolean }[] = [];

 // timer & UI state
 timerSeconds =0;
 timerRunning = false;
 private timerHandle: any = null;
 inputsDisabled = false; // global disable after timer ends
 sentMap: Record<string, boolean> = {};

 currentName: string | null = null;
 showHistorial = false;
 // new fields for clasificación feature
 showClasificacion = false;
 clasificacionList: { nombre: string; puntos: number }[] = [];
 // modal for final round decision
 showFinalChoiceModal = false;

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
 // only allow each player to see their own points inline; admin will use the separate clasificación view
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
 
 abrirClasificacion(): void {
 if (!this.sala) return;
 // build sorted classification (desc by puntos)
 this.clasificacionList = (this.sala.jugadores || []).map(p => ({ nombre: p.nombre, puntos: p.puntuacion ||0 })).sort((a, b) => b.puntos - a.puntos);
 this.showClasificacion = true;
 }

 cerrarClasificacion(): void {
 this.showClasificacion = false;
 }

 private buildEsperandoList() {
 this.esperandoList = [];
 if (!this.sala) return;
 this.sala.jugadores.forEach(j => {
 this.esperandoList.push({ nombre: j.nombre, apostado: j.apuesta !== undefined });
 });
 }

 refreshSala(): void {
 // remember previous ronda to detect advances
 const prevRonda = this.sala?.rondaActual ?? null;
 // preserve current user's typed value so it isn't lost on remote updates
 const myName = this.currentName;
 const myLocalValue = myName ? this.apuestas[myName] : undefined;

 this.sala = this.salaService.obtenerSalaPorCodigo(this.codigo);
 this.apuestas = {};
 this.sentMap = {};
 this.lastPrice = null;
 if (this.sala) {
 this.sala.jugadores.forEach(j => {
 this.apuestas[j.nombre] = j.apuesta ?? null;
 this.sentMap[j.nombre] = j.apuesta !== undefined;
 });
 // if the round advanced since last refresh, clear local draft for current user
 if (prevRonda !== null && this.sala.rondaActual !== prevRonda) {
 if (myName) this.apuestas[myName] = null;
 } else {
 // restore preserved local value for current user if they haven't sent yet
 if (myName && myLocalValue !== undefined && !this.sentMap[myName]) {
 this.apuestas[myName] = myLocalValue;
 }
 }
 // if the service stored lastResults, show modal to everyone
 if (this.sala.lastResults && Array.isArray(this.sala.lastResults.results)) {
 this.resultados = this.sala.lastResults.results;
 this.lastPrice = typeof this.sala.lastResults.price === 'number' ? this.sala.lastResults.price : null;
 this.resultadosModalVisible = true;
 // when results exist, close waiting modal
 this.esperandoModalVisible = false;
 // also clear the product-at-esperando marker because modal closed due to results
 this.productIdAtEsperandoOpen = null;
 // persist a local copy so clients keep the modal data even if admin clears shared state later
 try {
 const payload = { ts: this.sala.lastResults.ts, price: this.sala.lastResults.price, results: this.sala.lastResults.results, producto: this.sala.productoActual ? { ...this.sala.productoActual } : null };
 localStorage.setItem('mpj_last_results_' + this.codigo, JSON.stringify(payload));
 // keep snapshot for this client too
 this.modalProducto = payload.producto;
 } catch (e) {}
 } else {
 // fallback to previous localStorage mechanism (older clients)
 try {
 const raw = localStorage.getItem('mpj_last_results_' + this.codigo);
 if (raw) {
 const stored = JSON.parse(raw as string);
 this.resultados = stored.results || null;
 this.lastPrice = stored.price || null;
 this.modalProducto = stored.producto || null;
 this.resultadosModalVisible = !!this.resultados;
 }
 } catch (e) {
 // ignore
 }
 }
 // rebuild waiting list so modal shows up-to-date status
 this.buildEsperandoList();
 }
 this.currentName = this.readCurrentName();
 }

 onRefresh(): void {
 this.refreshSala();
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
 // open waiting modal for the sender showing who has/hasn't bet yet
 this.buildEsperandoList();
 this.esperandoModalVisible = true;
 // record current product id so we can later detect if admin advanced the product
 this.productIdAtEsperandoOpen = this.sala?.productoActualId ?? null;
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
 // resultados are persisted in sala.lastResults by the service; refresh will broadcast to clients
 this.resultados = res;
 this.lastPrice = null; // will be set during refreshSala via lastResults
 this.resultadosModalVisible = true;
 try {
 // also persist a local copy for the admin so their client keeps the exact snapshot until they close
 const payload = { ts: Date.now(), price: this.salaService.obtenerSalaPorCodigo(this.codigo)?.productoActual?.precio ?? null, results: res, producto: this.salaService.obtenerSalaPorCodigo(this.codigo)?.productoActual ? { ...this.salaService.obtenerSalaPorCodigo(this.codigo)?.productoActual } : null };
 localStorage.setItem('mpj_last_results_' + this.codigo, JSON.stringify(payload));
 } catch (e) {}
 this.salaService.clearApuestas(this.codigo);
 this.stopTimer();
 this.inputsDisabled = true;
 this.refreshSala();
 }

 cerrarModal(): void {
 // Non-admins cannot close the shared results modal while admin still has lastResults in shared state
 if (!this.isCurrentAdmin() && this.sala?.lastResults) {
 this.errorMsg = 'Esperando a que el administrador cierre los resultados';
 setTimeout(() => (this.errorMsg = null),2000);
 return;
 }
 // hide local modal for this client
 this.resultadosModalVisible = false;
 this.resultados = null;
 this.lastPrice = null;
 this.modalProducto = null;
 this.errorMsg = null;
 try { localStorage.removeItem('mpj_last_results_' + this.codigo); } catch (e) {}
 // If admin: clear lastResults in shared state and handle advancing or end-of-game flow
 if (this.isCurrentAdmin()) {
 // clear lastResults for all clients
 this.salaService.clearLastResults(this.codigo);
 // determine if this was the final round
 const sala = this.salaService.obtenerSalaPorCodigo(this.codigo);
 const rondaActual = sala?.rondaActual ??0;
 const rondasTotales = sala?.rondasTotales ??5;
 const isFinal = (rondaActual +1) >= rondasTotales;
 if (isFinal) {
 // show custom modal to admin to choose action
 this.showFinalChoiceModal = true;
 // do not advance or delete yet; handlers will perform actions
 return;
 }
 // not final round: advance and continue as before
 this.salaService.avanzarRonda(this.codigo);
 // load next product
 this.cargarProductoAleatorio();
 // re-enable inputs so admin can participate in the new round without refreshing
 this.inputsDisabled = false;
 // reset timer state
 this.stopTimer();
 }
 this.refreshSala();
 }

 canCloseResultModal(): boolean {
 // Admin can always close. Non-admins can only close after admin cleared shared lastResults (so they keep their local copy and close individually)
 try {
 return this.isCurrentAdmin() || !(this.sala && this.sala.lastResults);
 } catch (e) { return false; }
 }

 // return the product that should be shown while resultados modal is visible; keeps snapshot if modalProducto set
 displayedProduct() {
 if (this.resultadosModalVisible && this.modalProducto) return this.modalProducto;
 return this.sala?.productoActual || null;
 }

 handleDeleteRoom(): void {
 // admin confirmed deletion from custom modal
 this.showFinalChoiceModal = false;
 this.salaService.eliminarSala(this.codigo);
 // navigate away
 this.router.navigate(['/unirse']);
 }

 handleRestartGame(): void {
 // admin opted to restart the game
 this.showFinalChoiceModal = false;
 this.salaService.reiniciarSala(this.codigo);
 // optionally load a new random product
 this.cargarProductoAleatorio();
 this.inputsDisabled = false;
 this.stopTimer();
 this.refreshSala();
 }

 handleCancelFinalChoice(): void {
 // admin closed the choice modal without action; keep room as is
 this.showFinalChoiceModal = false;
 this.refreshSala();
 }

 cerrarEsperandoModal(): void {
 // Admin can always close. Non-admins may only close if the current product differs from
 // the product that was active when they opened the modal (i.e. admin advanced to next product).
 if (this.isCurrentAdmin()) {
 this.esperandoModalVisible = false;
 this.productIdAtEsperandoOpen = null;
 return;
 }
 // non-admins: allow close only when product changed since modal opened
 const currentPid = this.sala?.productoActualId ?? null;
 if (this.productIdAtEsperandoOpen !== null && currentPid !== this.productIdAtEsperandoOpen) {
 this.esperandoModalVisible = false;
 this.productIdAtEsperandoOpen = null;
 }
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
 // if clasificación modal is open, rebuild it to reflect deletion
 if (this.showClasificacion) {
 this.abrirClasificacion();
 }
 }

 cargarProductoAleatorio(): void {
 this.httpGetRandomProduct().then(p => {
 if (p) {
 try {
 this.salaService.actualizarProductoObjeto(this.codigo, p);
 } catch (e) {
 console.error('Error updating product object', e);
 }
 // clear any stored last-results for this room and reset players' apuestas so they can bet on the new product
 try { localStorage.removeItem('mpj_last_results_' + this.codigo); } catch (e) {}
 try { this.salaService.clearLastResults(this.codigo); } catch (e) {}
 try { this.salaService.clearApuestas(this.codigo); } catch (e) {}
 // ensure local UI state allows inputs again
 this.inputsDisabled = false;
 this.sentMap = {};
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
 
 // helper to fix Latin1->UTF8 mojibake (e.g. 'energÃ©tica' -> 'energética')
 const fixEncoding = (s: any) => {
 if (typeof s !== 'string') return s;
 try {
 // escape/decode trick to convert ISO-8859-1 mis-decoded UTF-8 sequences
 // eslint-disable-next-line no-undef
 return decodeURIComponent(escape(s));
 } catch (e) {
 return s;
 }
 };
 
 const resultado: any = {
 idProducto: String(prod.id ?? prod?.product_id ?? ''),
 nombre: fixEncoding(prod.display_name || prod.name || prod?.slug || ''),
 precio: isNaN(precio) ?0 : precio,
 imagen: prod.thumbnail || prod.photos?.[0]?.regular || prod.share_url || '',
 descripcion: fixEncoding(prod.description || prod.long_description || ''),
 categoria: fixEncoding(sub.name) || undefined,
 share_url: prod.share_url || undefined
 };
 
 return resultado;
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
