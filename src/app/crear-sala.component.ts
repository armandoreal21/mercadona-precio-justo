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
 
 <button (click)="generar()" class="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-purple-900 font-black text-lg py-3 rounded-xl shadow-lg hover:from-yellow-300 hover:to-amber-400 active:translate-y-0.5 transition uppercase tracking-wider">
 🚀 Generar Sala
 </button>
 </div>

 <div *ngIf="resultado" class="mt-8 pt-6 border-t-2 border-slate-750 text-center">
 <p class="text-slate-400 text-sm font-medium">Código de acceso para tus amigos:</p>
 <div class="mt-2 bg-purple-950 border-2 border-dashed border-purple-400 rounded-2xl p-4 inline-block">
 <span class="text-4xl font-mono font-black text-yellow-300 tracking-widest selection:bg-yellow-400">
 {{ resultado?.sala?.codigo }}
 </span>
 </div>
 <p class="text-xs text-purple-300 mt-2">✨ Comparte este código para empezar a jugar</p>
 <p *ngIf="resultado?.error" class="text-red-400 mt-2">{{ resultado?.error }}</p>
 </div>

 </div>
 </div>
 `
})
export class CrearSalaComponent {
 nombre = '';
 resultado: any = null;
 constructor(private sala: SalaService) {}
 generar() {
 if (!this.nombre || !this.nombre.trim()) { this.resultado = { error: 'Introduce un nombre válido' }; return; }
 this.resultado = this.sala.crearSala(this.nombre);
 }
}
