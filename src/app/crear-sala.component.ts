import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaService } from './sala.service';

@Component({
 selector: 'app-crear-sala',
 standalone: true,
 imports: [CommonModule, FormsModule],
 template: `
 <div class="min-h-screen bg-radial-gradient from-purple-900 to-slate-900 p-4 flex flex-col items-center justify-center text-white">
 <div class="w-full max-w-md bg-slate-800 rounded-3xl border-4 border-purple-500 shadow-2xl p-6 transform transition hover:scale-[1.01]">
 
 <h2 class="text-2xl font-black text-center text-yellow-400 uppercase tracking-wide mb-6">
 🏛️ Configurar Nueva Sala
 </h2>
 
 <div class="space-y-4">
 <div>
 <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre de la Sala</label>
 <input [(ngModel)]="nombre" type="text" placeholder="Ej: Sala de los Cracks" 
 class="w-full bg-slate-700 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:border-yellow-400 transition" />
 </div>
 <div>
 <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Rondas Totales</label>
 <input [(ngModel)]="rondas" type="number" min="1" class="w-24 bg-slate-700 border-2 border-slate-600 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none" />
 <p class="text-xs text-slate-500 mt-1">Número de rondas de la partida (ej:5)</p>
 </div>
 
 <button (click)="generar()" class="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-purple-900 font-black text-lg py-3 rounded-xl shadow-lg hover:from-yellow-300 hover:to-amber-400 active:translate-y-0.5 transition uppercase tracking-wider">
 🚀 Generar Sala
 </button>
 
 <!-- feedback area -->
 <div *ngIf="resultado" class="mt-4 p-3 rounded bg-slate-900 text-sm">
 <div *ngIf="resultado.creado" class="text-green-400 font-bold">Sala creada: código {{ resultado.sala?.codigo }}</div>
 <div *ngIf="resultado.error" class="text-rose-400">Error: {{ resultado.error }}</div>
 </div>
 
 <!-- server cleanup inactive rooms -->
 <div class="mt-3">
 <div *ngIf="!cleanupPreview">
 <button (click)="checkCleanup()" class="w-full bg-rose-600 text-white font-bold py-2 rounded-xl hover:bg-rose-500 transition">🧹 Comprobar salas inactivas (&gt;1 día)</button>
 <div *ngIf="cleanupResult" class="mt-2 text-sm text-slate-300">{{ cleanupResult }}</div>
 </div>
 <div *ngIf="cleanupPreview" class="mt-2 bg-slate-900 p-3 rounded">
 <div class="text-sm text-slate-200 mb-2">Se eliminarían {{ cleanupPreview.eliminadas }} sala(s):</div>
 <ul class="text-xs text-slate-300 space-y-1 max-h-36 overflow-auto">
 <li *ngFor="let c of cleanupPreview.removedCodes">• {{ c }}</li>
 </ul>
 <div class="mt-3 flex gap-2">
 <button (click)="executeCleanup()" [disabled]="cleaning" class="flex-1 bg-rose-600 text-white font-bold py-2 rounded-xl hover:bg-rose-500 transition">Confirmar eliminación</button>
 <button (click)="cancelCleanup()" [disabled]="cleaning" class="flex-1 bg-slate-700 text-white font-bold py-2 rounded-xl">Cancelar</button>
 </div>
 </div>
 </div>
 </div>
 </div>
 `
})
export class CrearSalaComponent {
 nombre = '';
 rondas =5;
 resultado: any = null;
 cleanupResult: string | null = null;
 cleanupPreview: { eliminadas: number; removedCodes: string[] } | null = null;
 cleaning = false;
 constructor(private sala: SalaService) {}
 generar() {
 if (!this.nombre || !this.nombre.trim()) { this.resultado = { error: 'Introduce un nombre válido' }; return; }
 const rounds = Number(this.rondas) ||5;
 this.resultado = this.sala.crearSala(this.nombre, rounds);
 // log for debugging
 try { console.log('crearSala result', this.resultado); } catch (e) {}
 }

 async checkCleanup() {
 this.cleanupResult = null;
 this.cleanupPreview = null;
 try {
 // use SalaService preview if available
 if (typeof this.sala['previewEliminarSalasInactivas'] === 'function') {
 const preview = (this.sala as any).previewEliminarSalasInactivas(1);
 this.cleanupPreview = { eliminadas: preview.eliminadas ||0, removedCodes: preview.removedCodes || [] };
 } else {
 this.cleanupResult = 'No hay soporte para previsualizar limpieza en este entorno';
 }
 } catch (e) {
 this.cleanupResult = 'Error comprobando salas inactivas';
 }
 }

 async executeCleanup() {
 if (!confirm('Confirmar eliminación de las salas inactivas mostradas?')) return;
 this.cleaning = true;
 this.cleanupResult = null;
 try {
 const eliminadas = (this.sala as any).eliminarSalasInactivas(1);
 this.cleanupResult = `Se eliminaron ${eliminadas} sala(s).`;
 this.cleanupPreview = null;
 } catch (e) {
 this.cleanupResult = 'Error al ejecutar limpieza';
 } finally {
 this.cleaning = false;
 setTimeout(() => this.cleanupResult = null,8000);
 }
 }

 cancelCleanup() {
 this.cleanupPreview = null;
 }

 limpiarInactivas() {
 this.checkCleanup();
 }
}
