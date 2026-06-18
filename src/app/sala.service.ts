import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Jugador {
 nombre: string;
 apuesta?: number;
 esAdmin?: boolean;
 puntuacion?: number;
}

export interface Sala {
 codigo: string;
 nombre: string;
 productoActualId?: number | string | null;
 productoActual?: any; // guardamos el objeto producto para UI/local
 estado: string;
 jugadores: Jugador[];
 rondasTotales?: number;
 rondaActual?: number;
}

@Injectable({ providedIn: 'root' })
export class SalaService {
 private http = inject(HttpClient);
 private storageKey = 'mpj_salas_v1';
 private templatePath = 'assets/sala-data.json';

 // Si estamos en entorno servidor, localStorage no existe. Usaremos cache en memoria.
 private hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
 private memoryCache: { salasActivas: Sala[] } | null = null;

 // WebSocket sync
 private ws: WebSocket | null = null;
 private clientId = Math.random().toString(36).slice(2);
 private suppressBroadcast = false;

 constructor() {
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

 // iniciar websocket solo en navegador
 if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
 this.initWebsocket();
 }
 }

 private initWebsocket() {
 try {
 this.ws = new WebSocket('ws://localhost:3001');
 this.ws.addEventListener('open', () => {
 // solicitar estado actual al servidor
 const msg = { type: 'requestState', clientId: this.clientId };
 this.ws?.send(JSON.stringify(msg));
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
 if (this.hasLocalStorage) {
 localStorage.setItem(this.storageKey, JSON.stringify(state));
 } else {
 // assign the received state to memoryCache
 this.memoryCache = state;
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
 this.ws.addEventListener('close', () => { this.ws = null; });
 this.ws.addEventListener('error', () => { /* ignore errors */ });
 } catch (e) {
 // ignore websocket init errors
 this.ws = null;
 }
 }

 private broadcastState(salas: Sala[]) {
 if (this.suppressBroadcast) return;
 if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
 const msg = { type: 'syncState', clientId: this.clientId, state: { salasActivas: salas } };
 try {
 this.ws.send(JSON.stringify(msg));
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

 // enviar al servidor
 this.broadcastState(salas);
 }

 generarCodigo(longitud =5): string {
 const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // evitar I, O,0,1
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
 rondaActual:0
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
 if (sala.jugadores.find(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase())) {
 return { success: false, error: 'Ya existe un jugador con ese nombre en la sala' };
 }
 const jugador: Jugador = { nombre: nombreJugador.trim(), esAdmin: false, puntuacion:0 };
 sala.jugadores.push(jugador);
 this.writeAll(salas);
 return { sala, success: true };
 }

 unirComoAdmin(codigo: string, nombreJugador: string): { sala?: Sala; success: boolean; error?: string } {
 const res = this.unirASala(codigo, nombreJugador);
 if (!res.success) return res;
 // marcar como admin
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return { success: false, error: 'Sala no encontrada tras unir' };
 const jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase());
 if (!jugador) return { success: false, error: 'Jugador no encontrado' };
 jugador.esAdmin = true;
 this.writeAll(salas);
 return { sala, success: true };
 }

 // actualizar todo el objeto producto (se serializa en localStorage)
 actualizarProductoObjeto(codigo: string, producto: any) {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return false;
 sala.productoActual = producto;
 sala.productoActualId = productoidOrNull(producto?.id ?? producto?.idProducto ?? null);
 this.writeAll(salas);
 return true;
 }

 // funciones auxiliares para el flujo de juego (actualizar producto, puntuaciones...)
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

 // nueva: establecer apuesta para un jugador
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

 // nueva: calcular puntuaciones de la ronda actual usando productoActual.precio
 calcularPuntuacionesRonda(codigo: string): { nombre: string; puntos: number; delta: number }[] | null {
 const salas = this.readAll();
 const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
 if (!sala) return null;
 const precioReal = Number(sala.productoActual?.precio ?? sala.productoActual?.price ?? sala.productoActual?.unit_price);
 if (!precioReal || isNaN(precioReal)) return null;

 // Sólo consideramos jugadores con apuesta numérica
 const jugadoresConApuesta = sala.jugadores.map(j => ({ nombre: j.nombre, apuesta: Number(j.apuesta ?? NaN), puntuacion: j.puntuacion ||0 }))
 .filter(j => !isNaN(j.apuesta));

 // Si no hay apuestas, nada que hacer
 if (jugadoresConApuesta.length ===0) return [];

 // calcular delta absoluto
 const resultados = jugadoresConApuesta.map(j => ({ nombre: j.nombre, delta: Math.abs(j.apuesta - precioReal), apuesta: j.apuesta }));

 // ordenar por delta ascendente (más cercano primero)
 resultados.sort((a, b) => a.delta - b.delta);

 // asignar puntos por ranking:1º10,2º7,3º5, resto3
 const puntosPorPos = [10,7,5];
 const asignaciones: { nombre: string; puntos: number; delta: number }[] = [];

 resultados.forEach((r, idx) => {
 const puntos = idx < puntosPorPos.length ? puntosPorPos[idx] :3;
 asignaciones.push({ nombre: r.nombre, puntos, delta: r.delta });
 // actualizar jugador en sala
 const jugador = sala.jugadores.find(j => j.nombre === r.nombre);
 if (jugador) {
 jugador.puntuacion = (jugador.puntuacion ||0) + puntos;
 }
 });

 // guardar y avanzar ronda
 this.writeAll(salas);
 sala.rondaActual = (sala.rondaActual ||0) +1;
 if ((sala.rondaActual ||0) >= (sala.rondasTotales ||10)) sala.estado = 'finalizada';
 this.writeAll(salas);

 return asignaciones;
 }

 // nueva: limpiar apuestas (preparar siguiente ronda)
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
 if ((sala.rondaActual ||0) >= (sala.rondasTotales ||10)) {
 sala.estado = 'finalizada';
 }
 this.writeAll(salas);
 return true;
 }
}

function productoidOrNull(v: any) {
 if (v === null || v === undefined) return null;
 const n = Number(v);
 return isNaN(n) ? String(v) : n;
}
