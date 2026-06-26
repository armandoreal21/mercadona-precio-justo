import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaService } from './sala.service';
import { Router } from '@angular/router';

@Component({
 selector: 'app-unirse-sala',
 standalone: true,
 imports: [CommonModule, FormsModule],
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
 <input [(ngModel)]="codigo" type="text" placeholder="X7R2B" maxlength="5"
 class="w-full bg-slate-700 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-mono font-black text-2xl text-center uppercase tracking-widest focus:outline-none focus:border-cyan-400 transition" />
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
 </div>
 </div>
 `
})
export class UnirseSalaComponent {
 nombre = '';
 codigo = '';
 asAdmin = false;
 error: string | null = null;
 constructor(private sala: SalaService, private router: Router) {}

 async entrar() {
 this.error = null;
 // try to fetch server state first and wait a short time for sync event
 try {
 if (typeof window !== 'undefined' && typeof (this.sala as any).requestServerState === 'function') {
 try { (this.sala as any).requestServerState(); } catch (e) {}
 // wait for mpj_state_updated or timeout
 await new Promise<void>(resolve => {
 let done = false;
 const onUpdate = () => { if (done) return; done = true; window.removeEventListener('mpj_state_updated', onUpdate as EventListener); resolve(); };
 window.addEventListener('mpj_state_updated', onUpdate as EventListener);
 setTimeout(() => { if (done) return; done = true; window.removeEventListener('mpj_state_updated', onUpdate as EventListener); resolve(); },600);
 });
 }
 } catch (e) {
 // ignore
 }

 let res: any;
 if (this.asAdmin) {
 res = await (this.sala as any).unirComoAdmin(this.codigo, this.nombre);
 } else {
 res = await (this.sala as any).unirASala(this.codigo, this.nombre);
 }
 if (!res.success) { this.error = res.error || 'Error'; return; }
 // guardar jugador actual en localStorage para identificar permisos
 try {
 localStorage.setItem('mpj_current', JSON.stringify({ codigo: res.sala.codigo, nombre: this.nombre, esAdmin: this.asAdmin }));
 } catch (e) {
 // ignore
 }
 // redirigir a la pantalla de sala
 this.router.navigate(['/sala', res.sala?.codigo]);
 }
}
