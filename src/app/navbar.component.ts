import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
 selector: 'app-navbar',
 standalone: true,
 imports: [CommonModule, RouterModule],
 template: `
<nav class="nav-root">
 <div class="nav-inner">
 <div class="brand">🎯 El Precio Justo</div>
 <div class="links">
 <a routerLink="/administrar" routerLinkActive="active">👑 Crear/Admin Sala</a>
 <a routerLink="/unirse" routerLinkActive="active">🎮 Unirse a Sala</a>
 </div>
 <div class="mobile-toggle">
 <button (click)="toggleMenu()" aria-label="menu">
 <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
 <path *ngIf="!isMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
 <path *ngIf="isMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 </div>

 <div *ngIf="isMenuOpen" class="mobile-menu">
 <a routerLink="/administrar" (click)="toggleMenu()">👑 Crear/Admin Sala</a>
 <a routerLink="/unirse" (click)="toggleMenu()">🎮 Unirse a Sala</a>
 </div>
</nav>
 `
})
export class NavbarComponent {
 isMenuOpen = false;
 toggleMenu() { this.isMenuOpen = !this.isMenuOpen; }
}
