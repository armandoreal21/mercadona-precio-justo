import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Jugador {
 nombre: string;
 apuesta?: number;
 esAdmin?: boolean;
 puntuacion?: number;
}

export interface ResultadoRonda {
 nombre: string;
 puntos: number;
 delta: number;
 apuesta?: number;
}

export interface HistorialRonda {
 ronda: number;
 producto?: any;
 resultados: ResultadoRonda[];
 ts: number;
}

export interface Sala {
 codigo: string;
 nombre: string;
 productoActualId?: number | string | null;
 productoActual?: any;
 estado: string;
 jugadores: Jugador[];
 rondasTotales?: number;
 rondaActual?: number;
 historialRondas?: HistorialRonda[];
 lastResults?: { ts: number; price: number; results: ResultadoRonda[] } | null;
 createdAt?: number;
 updatedAt?: number;
}

@Injectable({ providedIn: 'root' })
export class SalaService {
 private http = inject(HttpClient);
 private storageKey = 'mpj_salas_v1';
 private templatePath = 'assets/sala-data.json';

 // runtime flag to disable websocket
 private useWebsocket: boolean = true;
 private useFirebase: boolean = false;
 private firebaseApp: any = null;
 private firebaseDb: any = null;
 private firebaseRefPath = '/state';

 private hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
 private memoryCache: { salasActivas: Sala[] } | null = null;

 private ws: WebSocket | null = null;
 private clientId = Math.random().toString(36).slice(2);
 private suppressBroadcast = false;
 private pendingSync = false;

 constructor() {
 try {
 const env = (window as any).__env;
 if (env && (env.USE_WS === 'false' || env.USE_WS === false)) {
 this.useWebsocket = false;
 }
 if (env && env.FIREBASE_CONFIG) {
 // initialize but don't await - initFirebase handles async work
 this.initFirebase(env.FIREBASE_CONFIG);
 }
 } catch (e) {
 // ignore
 }

 // Sólo inicializamos localStorage desde template si estamos en navegador
 if (this.hasLocalStorage) {
 if (!localStorage.getItem(this.storageKey)) {
 this.http
 .get(this.templatePath)
 .pipe(catchError(() => of(null)))
 .subscribe((res: any) => {
 if (res) {
 localStorage.setItem(this.storageKey, JSON.stringify(res));
 } else {
 // inicializar con estructura vacía
 localStorage.setItem(this.storageKey, JSON.stringify({ salasActivas: [] }));
 }
 });
 }
 } else {
 // En servidor o entornos sin localStorage, inicializar memoria vacía
 this.memoryCache = { salasActivas: [] };
 }

 // iniciar websocket solo si está habilitado en runtime y el navegador soporta WebSocket
 if (!this.useFirebase && this.useWebsocket && typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
 this.initWebsocket();
 }
 }

 // ---------- Firebase integration (optional, modular v9 via dynamic import) ----------
 private async initFirebase(config: any) {
 try {
 const firebaseAppMod = await import('firebase/app');
 const databaseMod = await import('firebase/database');
 const initializeApp = (firebaseAppMod as any).initializeApp || (firebaseAppMod as any).default?.initializeApp;
 const getDatabase = (databaseMod as any).getDatabase;
 const ref = (databaseMod as any).ref;
 const onValue = (databaseMod as any).onValue;
 const get = (databaseMod as any).get;
 const set = (databaseMod as any).set;
 if (!initializeApp || !getDatabase) {
 console.warn('Firebase modular APIs not found');
 return;
 }
 this.firebaseApp = initializeApp(config);
 this.firebaseDb = getDatabase(this.firebaseApp);
 this.useFirebase = true;

 // If we accumulated local changes before Firebase was ready, push them now
 try {
 if (this.pendingSync) {
 const local = this.readAll();
 await this.broadcastStateToFirebase(local);
 this.pendingSync = false;
 }
 } catch (e) {
 // ignore
 }

 const stateRef = ref(this.firebaseDb, this.firebaseRefPath);

 // listen for changes
 onValue(stateRef, (snapshot: any) => {
 try {
 const val = snapshot && typeof snapshot.val === 'function' ? snapshot.val() : snapshot;
 const state = (val && typeof val === 'object' && Array.isArray(val.salasActivas)) ? val : { salasActivas: [] };
 console.debug('[SalaService] firebase onValue, state snapshot:', state);
 this.suppressBroadcast = true;
 if (this.hasLocalStorage) {
 localStorage.setItem(this.storageKey, JSON.stringify(state));
 } else {
 this.memoryCache = state;
 }
 if (typeof window !== 'undefined') {
 window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: 'firebase' } }));
 }
 } catch (e) {
 // ignore
 } finally {
 this.suppressBroadcast = false;
 }
 });

 // initialize DB if empty using local
 try {
 const snap = await get(stateRef);
 const dbVal = snap && typeof snap.val === 'function' ? snap.val() : snap;
 const local = this.readAll();
 const serverHas = dbVal && Array.isArray(dbVal.salasActivas) && dbVal.salasActivas.length >0;
 if (!serverHas && Array.isArray(local) && local.length >0) {
 await set(stateRef, { salasActivas: local });
 }
 } catch (e) {
 // ignore
 }
 } catch (e) {
 console.warn('Firebase init failed:', (e as any)?.message || e);
 this.useFirebase = false;
 this.firebaseApp = null;
 this.firebaseDb = null;
 }
 }

 // ---------- WebSocket fallback (kept for compatibility) ----------
 private initWebsocket() {
 if (!this.useWebsocket) return;
 try {
 const host = (typeof window !== 'undefined' && (window as any).location && (window as any).location.hostname) ? (window as any).location.hostname : 'localhost';
 const url = (window as any).__env?.WS_URL || `ws://${host}:3001`;
 console.log('[SalaService] initializing websocket to', url);
 this.ws = new WebSocket(url);
 this.ws.addEventListener('open', () => {
 console.log('[SalaService] websocket open to', url);
 const msg = { type: 'requestState', clientId: this.clientId };
 try { this.ws?.send(JSON.stringify(msg)); } catch (e) { }
 if (this.pendingSync) {
 try {
 const local = this.readAll();
 this.ws?.send(JSON.stringify({ type: 'syncState', clientId: this.clientId, state: { salasActivas: local } }));
 this.pendingSync = false;
 } catch (e) { /* ignore */ }
 }
 });

 this.ws.addEventListener('message', (ev) => {
 try {
 const data = JSON.parse(String(ev.data));
 if (data?.type === 'state' && data?.state) {
 if (data.clientId === this.clientId) return;
 this.suppressBroadcast = true;
 try {
 const state = data.state as { salasActivas: Sala[] };
 const local = this.readAll();
 const serverHas = Array.isArray(state?.salasActivas) && state.salasActivas.length >0;
 if (!serverHas && Array.isArray(local) && local.length >0) {
 try { this.ws?.send(JSON.stringify({ type: 'syncState', clientId: this.clientId, state: { salasActivas: local } })); } catch (e) { }
 }
 if (this.hasLocalStorage) {
 localStorage.setItem(this.storageKey, JSON.stringify(state));
 } else {
 this.memoryCache = state;
 }
 if (typeof window !== 'undefined') {
 window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: data.clientId } }));
 }
 } catch (e) { /* ignore */ }
 this.suppressBroadcast = false;
 }
 } catch (e) { console.error('WS parse error', e); }
 });

 this.ws.addEventListener('close', () => { console.log('[SalaService] websocket closed'); this.ws = null; if (this.useWebsocket) setTimeout(() => this.tryReconnect(),2000); });
 this.ws.addEventListener('error', (err) => { console.error('[SalaService] websocket error', err); });
 } catch (e) {
 this.ws = null;
 setTimeout(() => this.tryReconnect(),2000);
 }
 }

 private tryReconnect() {
 if (!this.useWebsocket) return;
 if (this.ws) return;
 try { this.initWebsocket(); } catch (e) { setTimeout(() => this.tryReconnect(),2000); }
 }

 // request server state: uses Firebase when enabled, otherwise return local state
 async requestServerState(): Promise<any> {
 if (this.useFirebase && this.firebaseDb) {
 try {
 const databaseMod = await import('firebase/database');
 const ref = (databaseMod as any).ref;
 const get = (databaseMod as any).get;
 const stateRef = ref(this.firebaseDb, this.firebaseRefPath);
 const snap = await get(stateRef);
 return snap && typeof snap.val === 'function' ? snap.val() : snap;
 } catch (e) { return null; }
 }
 // fallback: return local stored state
 return { salasActivas: this.readAll() };
 }

 private async broadcastStateToFirebase(salas: Sala[]) {
 if (!this.useFirebase || !this.firebaseDb) return;
 try {
 const databaseMod = await import('firebase/database');
 const ref = (databaseMod as any).ref;
 const set = (databaseMod as any).set;
 const stateRef = ref(this.firebaseDb, this.firebaseRefPath);
 console.debug('[SalaService] writing state to firebase, salas count:', salas.length);
 // Sanitize structure: JSON.stringify removes undefined properties which RTDB rejects
 const safe = JSON.parse(JSON.stringify({ salasActivas: salas }));
 await set(stateRef, safe);
 } catch (e) {
 console.error('[SalaService] broadcastStateToFirebase error', e);
 }
 }

 private broadcastState(salas: Sala[]) {
 // don't broadcast if we're suppressing
 if (this.suppressBroadcast) return;

 // If using Firebase, write to DB
 if (this.useFirebase && this.firebaseDb) {
 this.broadcastStateToFirebase(salas);
 this.pendingSync = false;
 if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: 'firebase-write' } }));
 return;
 }

 if (!this.useWebsocket) return;
 const ws = this.ws as WebSocket | null;
 if (!ws) return;
 const ready = (ws as any).readyState;
 if (ready !== (WebSocket as any).OPEN) return;
 try { ws.send(JSON.stringify({ type: 'syncState', clientId: this.clientId, state: { salasActivas: salas } })); } catch (e) { }
 }

 private readAll(): Sala[] {
 if (this.hasLocalStorage) {
 const raw = localStorage.getItem(this.storageKey);
 if (!raw) return [];
 try {
 const parsed = JSON.parse(raw);
 const salas: Sala[] = parsed?.salasActivas || [];
 let changed = false;
 const now = Date.now();
 const twoDaysAgo = now - (2 *24 *60 *60 *1000);
 salas.forEach(s => {
 if (s.createdAt === undefined && s.updatedAt === undefined) {
 s.createdAt = twoDaysAgo;
 s.updatedAt = twoDaysAgo;
 changed = true;
 }
 if (s.rondasTotales === undefined || s.rondasTotales === null) { s.rondasTotales =5; changed = true; }
 if (!Array.isArray(s.historialRondas)) s.historialRondas = [];
 if (s.rondaActual === undefined || s.rondaActual === null) { s.rondaActual =0; changed = true; }
 // ensure jugadores exists and has sane defaults
 if (!Array.isArray(s.jugadores)) { s.jugadores = []; changed = true; }
 else {
 s.jugadores = s.jugadores.map(j => ({ nombre: (j && j.nombre) ? String(j.nombre) : '', apuesta: (j && typeof j.apuesta !== 'undefined') ? j.apuesta : undefined, esAdmin: !!(j && j.esAdmin), puntuacion: (j && typeof j.puntuacion !== 'undefined') ? j.puntuacion :0 }));
 }
 });
 if (changed) {
 localStorage.setItem(this.storageKey, JSON.stringify({ salasActivas: salas }));
 }
 return salas;
 } catch (e) {
 return [];
 }
 }
 // fallback memoria: ensure we always return an array
 if (this.memoryCache && Array.isArray(this.memoryCache.salasActivas)) {
 return this.memoryCache.salasActivas;
 }
 return [];
 }

 private writeAll(salas: Sala[]) {
 if (this.hasLocalStorage) {
 localStorage.setItem(this.storageKey, JSON.stringify({ salasActivas: salas }));
 } else {
 if (!this.memoryCache) this.memoryCache = { salasActivas: [] };
 this.memoryCache.salasActivas = salas;
 }

 console.debug('[SalaService] writeAll: wrote local state, salas count:', salas.length, 'pendingSync:', this.pendingSync, 'useFirebase:', this.useFirebase, 'firebaseDb:', !!this.firebaseDb);

 if (this.useFirebase && this.firebaseDb) {
 this.broadcastStateToFirebase(salas);
 this.pendingSync = false;
 } else if (this.useWebsocket && this.ws && this.ws.readyState === WebSocket.OPEN) {
 this.broadcastState(salas);
 this.pendingSync = false;
 } else {
 // do not attempt HTTP /sync fallback when running on hosted HTTPS - rely on localStorage or Firebase
 this.pendingSync = true;
 }

 if (typeof window !== 'undefined') {
 window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: this.clientId } }));
 }
 }

 generarCodigo(longitud =5): string {
 const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZA23456789';
 let codigo = '';
 for (let i =0; i < longitud; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
 return codigo;
 }

 crearSala(nombre: string, rondas =5): { sala: Sala; creado: boolean; error?: string } {
 const salas = this.readAll();
 if (salas.find(s => s.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
 return { sala: null as any, creado: false, error: 'Ya existe una sala con ese nombre' };
 }
 let codigo = this.generarCodigo();
 while (salas.find(s => s.codigo === codigo)) { codigo = this.generarCodigo(); }
 const now = Date.now();
 const nueva: Sala = {
 codigo,
 nombre: nombre.trim(),
 productoActualId: null,
 productoActual: null,
 estado: 'esperando_jugadores',
 jugadores: [],
 rondasTotales: typeof rondas === 'number' && rondaSaneable(rondas) ? Math.max(1, Math.floor(rondas)) :5,
 rondaActual:0,
 historialRondas: [],
 lastResults: null,
 createdAt: now,
 updatedAt: now
 };
 salas.push(nueva);
 this.writeAll(salas);
 return { sala: nueva, creado: true };
 }

 obtenerSalaPorCodigo(codigo: string): Sala | null {
 const salas = this.readAll();
 return salas.find(s => s.codigo === (codigo || '').toUpperCase()) || null;
 }

 async unirASala(codigo: string, nombreJugador: string): Promise<{ sala?: Sala; success: boolean; error?: string }> {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return { success: false, error: 'Sala no encontrada' };
 if (!nombreJugador || !nombreJugador.trim()) return { success: false, error: 'Nombre inválido' };
 if (sala.jugadores.find(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase())) return { success: false, error: 'Ya existe un jugador con ese nombre en la sala' };
 const jugador: Jugador = { nombre: nombreJugador.trim(), esAdmin: false, puntuacion:0 };
 sala.jugadores.push(jugador);
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 // if firebase available, ensure state propagated immediately and notify listeners
 try {
 if (this.useFirebase && this.firebaseDb) {
 await this.broadcastStateToFirebase(salas);
 if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: 'firebase-write' } }));
 }
 } catch (e) { /* ignore */ }
 return { sala, success: true };
 }

 async unirComoAdmin(codigo: string, nombreJugador: string): Promise<{ sala?: Sala; success: boolean; error?: string }> {
 const res = await this.unirASala(codigo, nombreJugador);
 if (!res.success) return res;
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return { success: false, error: 'Sala no encontrada tras unir' };
 const jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase());
 if (!jugador) return { success: false, error: 'Jugador no encontrado' };
 jugador.esAdmin = true;
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 try {
 if (this.useFirebase && this.firebaseDb) {
 await this.broadcastStateToFirebase(salas);
 if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: 'firebase-write' } }));
 }
 } catch (e) { /* ignore */ }
 return { sala, success: true };
 }

 removePlayer(codigo: string, nombreJugador: string) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 const idx = sala.jugadores.findIndex(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase());
 if (idx === -1) return false;
 sala.jugadores.splice(idx,1);
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }

 // reiniciar sala para nueva partida: limpiar historial, resetear puntuaciones, rondas y producto
 reiniciarSala(codigo: string) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.historialRondas = [];
 sala.rondaActual =0;
 sala.productoActual = null;
 sala.lastResults = null;
 sala.jugadores.forEach(j => { j.puntuacion =0; delete j.apuesta; });
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }

 eliminarSala(codigo: string) {
 const salas = this.readAll();
 const idx = salas.findIndex(s => s.codigo === (codigo || '').toUpperCase());
 if (idx === -1) return false;
 salas.splice(idx,1);
 this.writeAll(salas);
 return true;
 }

 // elimina salas inactivas creadas o sin actualización hace más de `days` días
 eliminarSalasInactivas(days =1): number {
 const salas = this.readAll();
 const now = Date.now();
 const cutoff = days *24 *60 *60 *1000;
 const inicial = salas.length;
 const filtradas = salas.filter(s => {
 const last = s.updatedAt ?? s.createdAt ??0;
 // keep salas with no timestamp (conservativa) or recently updated
 if (!last) return true;
 return (now - last) <= cutoff;
 });
 const eliminadas = inicial - filtradas.length;
 if (eliminadas >0) this.writeAll(filtradas);
 return eliminadas;
 }

 // preview helper
 previewEliminarSalasInactivas(days =1) {
 const salas = this.readAll();
 const now = Date.now();
 const cutoff = days *24 *60 *60 *1000;
 const removed: any[] = [];
 const kept: any[] = [];
 salas.forEach(s => {
 const last = s.updatedAt ?? s.createdAt ??0;
 if (!last) { kept.push(s); return; }
 if ((now - last) > cutoff) removed.push(s); else kept.push(s);
 });
 return { eliminadas: removed.length, removedCodes: removed.map(r => r.codigo), removed, kept };
 }

 actualizarProductoObjeto(codigo: string, producto: any) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.productoActual = producto;
 sala.productoActualId = productoidOrNull(producto?.id ?? producto?.idProducto ?? null);
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }

 actualizarProductoActual(codigo: string, productoId: number) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.productoActualId = productoidOrNull(productoId);
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }

 actualizarPuntuacion(codigo: string, nombreJugador: string, delta: number) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 const jugador = sala.jugadores.find(j => j.nombre === nombreJugador);
 if (!jugador) return false;
 jugador.puntuacion = (jugador.puntuacion ||0) + delta;
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }

 setApuesta(codigo: string, nombreJugador: string, apuesta: number) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 const jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase());
 if (!jugador) return false;
 jugador.apuesta = Number(apuesta);
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }

 calcularPuntuacionesRonda(codigo: string): { nombre: string; puntos: number; delta: number; apuesta?: number }[] | null {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return null;
 const precioReal = Number(sala.productoActual?.precio ?? sala.productoActual?.price ?? sala.productoActual?.unit_price);
 if (!precioReal || isNaN(precioReal)) return null;

 const jugadoresConApuesta = sala.jugadores.map(j => ({ nombre: j.nombre, apuesta: Number(j.apuesta ?? NaN), puntuacion: j.puntuacion ||0 })).filter(j => !isNaN(j.apuesta));
 if (jugadoresConApuesta.length ===0) return [];
 const resultados = jugadoresConApuesta.map(j => ({ nombre: j.nombre, delta: Math.abs(j.apuesta - precioReal), apuesta: j.apuesta }));
 resultados.sort((a, b) => a.delta - b.delta);
 const puntosPorPos = [10,7,5];
 const asignaciones: { nombre: string; puntos: number; delta: number; apuesta?: number }[] = [];

 // assign points, but if deltas are equal (tie) give same points to all tied players
 let idx =0;
 while (idx < resultados.length) {
 const currentDelta = resultados[idx].delta;
 // find group size with same delta
 let j = idx +1;
 while (j < resultados.length && resultados[j].delta === currentDelta) j++;
 const groupSize = j - idx;
 // determine points for this group's starting position
 const puntos = idx < puntosPorPos.length ? puntosPorPos[idx] :3;
 for (let k = idx; k < j; k++) {
 asignaciones.push({ nombre: resultados[k].nombre, puntos, delta: resultados[k].delta, apuesta: resultados[k].apuesta });
 const jugador = sala.jugadores.find(p => p.nombre === resultados[k].nombre);
 if (jugador) jugador.puntuacion = (jugador.puntuacion ||0) + puntos;
 }
 // move index past this group
 idx = j;
 }

 if (!sala.historialRondas) sala.historialRondas = [];
 sala.historialRondas.push({ ronda: sala.rondaActual ??0, producto: sala.productoActual ? { ...sala.productoActual } : undefined, resultados: asignaciones.map(a => ({ nombre: a.nombre, puntos: a.puntos, delta: a.delta, apuesta: a.apuesta })), ts: Date.now() });

 // persist updated scores and history and expose lastResults to clients so everyone can show modal
 sala.lastResults = { ts: Date.now(), price: precioReal, results: asignaciones.map(a => ({ nombre: a.nombre, puntos: a.puntos, delta: a.delta, apuesta: a.apuesta })) };
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return asignaciones;
 }

 clearApuestas(codigo: string) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.jugadores.forEach(j => delete j.apuesta);
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }

 // elimina lastResults del estado para que el modal deje de mostrarse en todos los clientes
 clearLastResults(codigo: string) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.lastResults = null;
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }

 avanzarRonda(codigo: string) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.rondaActual = (sala.rondaActual ||0) +1;
 if ((sala.rondaActual ||0) >= (sala.rondasTotales ||10)) sala.estado = 'finalizada';
 sala.updatedAt = Date.now();
 this.writeAll(salas);
 return true;
 }
}

function productoidOrNull(v: any) {
 if (v === null || v === undefined) return null;
 const n = Number(v);
 return isNaN(n) ? String(v) : n;
}

function rondaSaneable(r: any) {
 if (r === null || r === undefined) return true;
 const n = Number(r);
 return !isNaN(n) && n >0 && n <=50;
}
