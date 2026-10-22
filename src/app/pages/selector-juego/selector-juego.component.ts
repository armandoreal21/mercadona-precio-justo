import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { JUEGOS_DISPONIBLES } from '../../games/games.registry';
import { GameDefinition } from '../../core/models/game.model';

@Component({
  selector: 'app-selector-juego',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-900 p-4 sm:p-6 flex flex-col items-center justify-center text-white">
      <div class="w-full max-w-4xl">
        <div class="text-center mb-8">
          <span class="text-5xl">🎮</span>
          <h1 class="text-3xl sm:text-4xl font-black bg-gradient-to-r from-yellow-400 via-pink-500 to-cyan-400 bg-clip-text text-transparent uppercase tracking-wider mt-2">
            Catálogo de Juegos
          </h1>
          <p class="text-slate-400 text-sm sm:text-base mt-2">
            Elige el juego para el que deseas crear y configurar una sala
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div *ngFor="let juego of juegos"
               class="bg-slate-800 border-2 border-slate-700 hover:border-yellow-400 rounded-3xl p-6 shadow-xl transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-3 mb-3">
                <span class="text-4xl p-3 bg-slate-900 rounded-2xl border border-slate-700">{{ juego.icono }}</span>
                <div>
                  <h2 class="text-xl font-bold text-yellow-400">{{ juego.nombre }}</h2>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <span *ngFor="let modo of juego.modosSoportados"
                          class="text-[11px] uppercase tracking-wide bg-purple-900/60 text-purple-200 border border-purple-500/40 px-2 py-0.5 rounded-full font-semibold">
                      {{ getNombreModo(modo) }}
                    </span>
                  </div>
                </div>
              </div>
              <p class="text-slate-300 text-sm mt-3 leading-relaxed">
                {{ juego.descripcion }}
              </p>
            </div>

            <div class="mt-6">
              <a [routerLink]="['/crear', juego.id]"
                 class="block text-center w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-purple-950 font-black py-3 rounded-xl shadow-lg hover:from-yellow-300 hover:to-amber-400 transition uppercase tracking-wider">
                Configurar Sala 👉
              </a>
            </div>
          </div>
        </div>

        <div class="mt-8 text-center">
          <a routerLink="/unirse" class="text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition">
            ¿Ya tienes un código? Únete a una sala aquí 🕹️
          </a>
        </div>
      </div>
    </div>
  `
})
export class SelectorJuegoComponent {
  juegos: GameDefinition[] = JUEGOS_DISPONIBLES;

  getNombreModo(modo: string): string {
    switch (modo) {
      case 'individual':
        return '👤 Individual';
      case 'equipos_sesion_unica':
        return '👥 Equipos (1 sesión)';
      case 'equipos_multiusuario':
        return '👥 Equipos (Multiusuario)';
      default:
        return modo;
    }
  }
}
