import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaService } from './sala.service';
import { Router, RouterModule } from '@angular/router';
import { Equipo } from './core/models/sala.model';

@Component({
 selector: 'app-unirse-sala',
 standalone: true,
 imports: [CommonModule, FormsModule, RouterModule],
 template: `
 <div class="min-h-screen bg-slate-900 p-4 flex flex-col items-center justify-center text-white">
 <div class="w-full max-w-sm bg-slate-800 rounded-3xl border-4 border-indigo-500 shadow-2xl p-6">
 
 <div class="text-center mb-6">
 <div class="text-5xl mb-2">🎮</div>
 <h2 class="text-3xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent uppercase">
 ¡A Jugar!
 </h2>
 <p class="text-slate-400 text-sm mt-1">Introduce las credenciales de la partida</p>
 </div>

 <div class="space-y-4">
 <div>
 <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Tu Nombre / Nickname</label>
 <input [(ngModel)]="nombre" type="text" placeholder="Ej: Jugón10" 
 class="w-full bg-slate-700 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-bold text-center focus:outline-none focus:border-cyan-400 transition" />
 </div>

 <div>
 <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Código de Sala</label>
 <input [(ngModel)]="codigo" (ngModelChange)="onCodigoChange($event)" type="text" placeholder="X7R2B" maxlength="5"
 class="w-full bg-slate-700 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-mono font-black text-2xl text-center uppercase tracking-widest focus:outline-none focus:border-cyan-400 transition" />
 </div>

 <!-- Si la sala encontrada requiere equipo, selector de equipo -->
 <div *ngIf="equiposDisponibles.length > 0">
 <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Selecciona tu Equipo</label>
 <select [(ngModel)]="equipoSeleccionado"
 class="w-full bg-slate-700 border-2 border-slate-600 rounded-xl px-4 py-2.5 text-white font-bold text-center focus:outline-none focus:border-cyan-400 transition">
 <option *ngFor="let eq of equiposDisponibles" [value]="eq.id">{{ eq.nombre }}</option>
 </select>
 </div>

 <div class="flex items-center gap-2">
 <input type="checkbox" id="asAdmin" [(ngModel)]="asAdmin" class="w-4 h-4" />
 <label for="asAdmin" class="text-sm text-slate-400">Entrar como admin</label>
 </div>

 <button (click)="entrar()" class="w-full bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-900 font-black text-xl py-4 rounded-2xl shadow-xl hover:from-cyan-300 hover:to-blue-400 active:translate-y-0.5 transition uppercase tracking-wide mt-2">
 ¡Entrar a la Sala! 🕹️
 </button>
 </div>

 <div *ngIf="error" class="mt-3 text-red-400">{{ error }}</div>

 <div class="mt-4 text-center">
 <a routerLink="/juegos" class="text-xs text-yellow-400 hover:text-yellow-300 font-semibold transition">
 ¿Quieres crear una nueva sala? Elige un juego 👑
 </a>
 </div>
 </div>
 </div>
 `
})
export class UnirseSalaComponent {
 nombre = '';
 codigo = '';
 asAdmin = false;
 error: string | null = null;
 equiposDisponibles: Equipo[] = [];
 equipoSeleccionado = '';

 constructor(private sala: SalaService, private router: Router) {}

 onCodigoChange(val: string) {
 if (!val) {
 this.equiposDisponibles = [];
 return;
 }
 const up = val.trim().toUpperCase();
 this.actualizarEquiposParaCodigo(up);
 }

 private actualizarEquiposParaCodigo(codigo: string) {
 const s = this.sala.obtenerSalaPorCodigo(codigo);
 if (s && Array.isArray(s.equipos) && s.equipos.length > 0) {
 this.equiposDisponibles = s.equipos;
 if (!this.equipoSeleccionado || !s.equipos.some(e => e.id === this.equipoSeleccionado)) {
 this.equipoSeleccionado = s.equipos[0].id;
 }
 } else {
 this.equiposDisponibles = [];
 }
 }

 async entrar() {
 this.error = null;
 const cleanCode = (this.codigo || '').trim().toUpperCase();
 const cleanNombre = (this.nombre || '').trim();

 if (!cleanNombre) {
 this.error = 'Introduce un nombre o nickname';
 return;
 }
 if (!cleanCode) {
 this.error = 'Introduce el código de la sala';
 return;
 }

 // Always fetch latest state from server (Firebase / DB) before joining
 try {
 await this.sala.requestServerState();
 } catch (e) {
 // ignore
 }

 // Actualizar la lista de equipos tras traer el estado del servidor
 this.actualizarEquiposParaCodigo(cleanCode);

 const equipoId = this.equiposDisponibles.length > 0 ? this.equipoSeleccionado : undefined;

 let res: any;
 if (this.asAdmin) {
 res = await this.sala.unirComoAdmin(cleanCode, cleanNombre, equipoId);
 } else {
 res = await this.sala.unirASala(cleanCode, cleanNombre, equipoId);
 }

 if (!res.success) {
 this.error = res.error || 'Error al unirse';
 return;
 }

 // guardar jugador actual en localStorage para identificar permisos
 try {
 localStorage.setItem('mpj_current', JSON.stringify({
 codigo: res.sala.codigo,
 nombre: cleanNombre,
 esAdmin: this.asAdmin,
 equipoId
 }));
 } catch (e) {
 // ignore
 }
 // redirigir a la pantalla de sala
 this.router.navigate(['/sala', res.sala?.codigo]);
 }
}
