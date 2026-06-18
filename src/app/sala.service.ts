import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
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
}

@Injectable({ providedIn: 'root' })
export class SalaService {
 private http = inject(HttpClient);
 private storageKey = 'mpj_salas_v1';
 private templatePath = 'assets/sala-data.json';

 // runtime flag to disable websocket
 private useWebsocket: boolean = true;

 private hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
 private memoryCache: { salasActivas: Sala[] } | null = null;

 private ws: WebSocket | null = null;
 private clientId = Math.random().toString(36).slice(2);
 private suppressBroadcast = false;
 private pendingSync = false;

 constructor() {
 // respect runtime flag to disable websocket
 try {
 const env = (window as any).__env;
 if (env && (env.USE_WS === 'false' || env.USE_WS === false)) {
 this.useWebsocket = false;
 }
 } catch (e) { /* ignore */ }

 // Sólo inicializamos localStorage desde template si estamos en navegador
 if (this.hasLocalStorage) {
 if (!localStorage.getItem(this.storageKey)) {
 this.http.get(this.templatePath).pipe(catchError(() => of(null))).subscribe((res: any) => {
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
 if (this.useWebsocket && typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
 this.initWebsocket();
 }
 }

 private initWebsocket() {
 if (!this.useWebsocket) return;
 try {
 const url = (window as any).__env?.WS_URL || 'ws://localhost:3001';
 this.ws = new WebSocket(url);
 this.ws.addEventListener('open', () => {
 // solicitar estado actual al servidor
 const msg = { type: 'requestState', clientId: this.clientId };
 this.ws?.send(JSON.stringify(msg));
 // if we have local changes that weren't synced, push them now
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
 // actualizar local sin rebroadcast
 if (data.clientId === this.clientId) return; // ignore own
 this.suppressBroadcast = true;
 try {
 const state = data.state as { salasActivas: Sala[] };
 // if server state is empty but we have local state, push local to server to initialize
 const local = this.readAll();
 const serverHas = Array.isArray(state?.salasActivas) && state.salasActivas.length >0;
 if (!serverHas && Array.isArray(local) && local.length >0) {
 // send our local state to server
 try { this.ws?.send(JSON.stringify({ type: 'syncState', clientId: this.clientId, state: { salasActivas: local } })); } catch (e) {}
 }
 if (this.hasLocalStorage) {
 localStorage.setItem(this.storageKey, JSON.stringify(state));
 } else {
 // assign the received state to memoryCache
 this.memoryCache = state;
 }
 // notify app that state changed
 if (typeof window !== 'undefined') {
 window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: data.clientId } }));
 }
 } catch (e) {
 // ignore
 }
 this.suppressBroadcast = false;
 }
 } catch (e) {
 console.error('WS parse error', e);
 }
 });
 this.ws.addEventListener('close', () => { this.ws = null; if (this.useWebsocket) setTimeout(() => this.tryReconnect(),2000); });
 this.ws.addEventListener('error', () => { /* ignore errors */ });
 } catch (e) {
 // ignore websocket init errors
 this.ws = null;
 // schedule reconnect
 setTimeout(() => this.tryReconnect(),2000);
 }
 }

 private tryReconnect() {
 if (!this.useWebsocket) return;
 if (this.ws) return; // already connected
 try {
 this.initWebsocket();
 } catch (e) {
 // schedule again
 setTimeout(() => this.tryReconnect(),2000);
 }
 }

 // HTTP fallback to request server state
 requestServerState(): Promise<any> {
 const url = ((window as any).__env?.WS_URL || 'http://localhost:3001').replace(/^ws/, 'http');
 return this.http.get(url + '/state').pipe(catchError(() => of(null))).toPromise();
 }

 private broadcastState(salas: Sala[]) {
 // don't broadcast if we're suppressing or WS disabled
 if (this.suppressBroadcast) { return; }
 if (!this.useWebsocket) { return; }

 const ws = this.ws as WebSocket | null;
 if (!ws) { return; }
 // check readyState safely
 const ready = (ws as any).readyState;
 if (ready !== (WebSocket as any).OPEN) { return; }

 try {
 ws.send(JSON.stringify({ type: 'syncState', clientId: this.clientId, state: { salasActivas: salas } }));
 } catch (e) {
 // ignore send errors
 }
 }

 private readAll(): Sala[] {
 if (this.hasLocalStorage) {
 const raw = localStorage.getItem(this.storageKey);
 if (!raw) return [];
 try {
 const parsed = JSON.parse(raw);
 return parsed?.salasActivas || [];
 } catch (e) {
 return [];
 }
 }

 // fallback memoria
 return this.memoryCache?.salasActivas || [];
 }

 private writeAll(salas: Sala[]) {
 if (this.hasLocalStorage) {
 localStorage.setItem(this.storageKey, JSON.stringify({ salasActivas: salas }));
 } else {
 if (!this.memoryCache) this.memoryCache = { salasActivas: [] };
 this.memoryCache.salasActivas = salas;
 }

 // If websocket enabled and open, send via WS. Otherwise, use HTTP /sync fallback.
 if (this.useWebsocket && this.ws && this.ws.readyState === WebSocket.OPEN) {
 this.broadcastState(salas);
 this.pendingSync = false;
 } else {
 this.pendingSync = true;
 // HTTP fallback: try posting to /sync
 try {
 const url = ((window as any).__env?.WS_URL || 'http://localhost:3001').replace(/^ws/, 'http');
 fetch(url + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: this.clientId, state: { salasActivas: salas } }) }).catch(() => {});
 } catch (e) {}
 }

 // notify local listeners
 if (typeof window !== 'undefined') {
 window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: this.clientId } }));
 }
 }

 generarCodigo(longitud =5): string {
 const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZA23456789'; // evitar I, O,0,1
 let codigo = '';
 for (let i =0; i < longitud; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
 return codigo;
 }

 crearSala(nombre: string): { sala: Sala; creado: boolean; error?: string } {
 const salas = this.readAll();
 if (salas.find(s => s.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
 return { sala: null as any, creado: false, error: 'Ya existe una sala con ese nombre' };
 }
 let codigo = this.generarCodigo();
 // asegurar unicidad
 while (salas.find(s => s.codigo === codigo)) {
 codigo = this.generarCodigo();
 }
 const nueva: Sala = {
 codigo,
 nombre: nombre.trim(),
 productoActualId: null,
 productoActual: null,
 estado: 'esperando_jugadores',
 jugadores: [],
 rondasTotales:10,
 rondaActual:0,
 historialRondas: []
 };
 salas.push(nueva);
 this.writeAll(salas);
 return { sala: nueva, creado: true };
 }

 obtenerSalaPorCodigo(codigo: string): Sala | null {
 const salas = this.readAll();
 return salas.find(s => s.codigo === (codigo || '').toUpperCase()) || null;
 }

 unirASala(codigo: string, nombreJugador: string): { sala?: Sala; success: boolean; error?: string } {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return { success: false, error: 'Sala no encontrada' };
 if (!nombreJugador || !nombreJugador.trim()) return { success: false, error: 'Nombre inválido' };
 if (sala.jugadores.find(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase())) return { success: false, error: 'Ya existe un jugador con ese nombre en la sala' };
 const jugador: Jugador = { nombre: nombreJugador.trim(), esAdmin: false, puntuacion:0 };
 sala.jugadores.push(jugador);
 this.writeAll(salas);
 return { sala, success: true };
 }

 unirComoAdmin(codigo: string, nombreJugador: string): { sala?: Sala; success: boolean; error?: string } {
 const res = this.unirASala(codigo, nombreJugador);
 if (!res.success) return res;
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return { success: false, error: 'Sala no encontrada tras unir' };
 const jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase());
 if (!jugador) return { success: false, error: 'Jugador no encontrado' };
 jugador.esAdmin = true;
 this.writeAll(salas);
 return { sala, success: true };
 }

 removePlayer(codigo: string, nombreJugador: string) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 const idx = sala.jugadores.findIndex(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase());
 if (idx === -1) return false;
 sala.jugadores.splice(idx,1);
 this.writeAll(salas);
 return true;
 }

 actualizarProductoObjeto(codigo: string, producto: any) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.productoActual = producto;
 sala.productoActualId = productoidOrNull(producto?.id ?? producto?.idProducto ?? null);
 this.writeAll(salas);
 return true;
 }

 actualizarProductoActual(codigo: string, productoId: number) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.productoActualId = productoidOrNull(productoId);
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
 this.writeAll(salas);
 return true;
 }

 calcularPuntuacionesRonda(codigo: string): { nombre: string; puntos: number; delta: number }[] | null {
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
 const asignaciones: { nombre: string; puntos: number; delta: number }[] = [];
 resultados.forEach((r, idx) => {
 const puntos = idx < puntosPorPos.length ? puntosPorPos[idx] :3;
 asignaciones.push({ nombre: r.nombre, puntos, delta: r.delta });
 const jugador = sala.jugadores.find(j => j.nombre === r.nombre);
 if (jugador) jugador.puntuacion = (jugador.puntuacion ||0) + puntos;
 });

 if (!sala.historialRondas) sala.historialRondas = [];
 sala.historialRondas.push({ ronda: sala.rondaActual ??0, producto: sala.productoActual ? { ...sala.productoActual } : undefined, resultados: asignaciones.map(a => ({ nombre: a.nombre, puntos: a.puntos, delta: a.delta })), ts: Date.now() });

 this.writeAll(salas);
 sala.rondaActual = (sala.rondaActual ||0) +1;
 if ((sala.rondaActual ||0) >= (sala.rondasTotales ||10)) sala.estado = 'finalizada';
 this.writeAll(salas);
 return asignaciones;
 }

 clearApuestas(codigo: string) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.jugadores.forEach(j => delete j.apuesta);
 this.writeAll(salas);
 return true;
 }

 avanzarRonda(codigo: string) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.rondaActual = (sala.rondaActual ||0) +1;
 if ((sala.rondaActual ||0) >= (sala.rondasTotales ||10)) sala.estado = 'finalizada';
 this.writeAll(salas);
 return true;
 }
}

function productoidOrNull(v: any) {
 if (v === null || v === undefined) return null;
 const n = Number(v);
 return isNaN(n) ? String(v) : n;
}
