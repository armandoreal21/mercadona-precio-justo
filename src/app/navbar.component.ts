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
 <span class="toggle-icon">{{ isMenuOpen ? '✖' : '☰' }}</span>
 </button>
 </div>
 </div>

 <div *ngIf="isMenuOpen" class="mobile-menu">
 <a routerLink="/administrar" (click)="toggleMenu()">👑 Crear/Admin Sala</a>
 <a routerLink="/unirse" (click)="toggleMenu()">🎮 Unirse a Sala</a>
 </div>
</nav>
 `,
 styles: [
 `
 /* Navbar root */
 nav.nav-root {
 width:100%;
 box-sizing: border-box;
 padding:0.5rem 1rem;
 position: sticky;
 top:0;
 left:0;
 right:0;
 z-index:70;
 background: rgba(7,11,18,0.25);
 backdrop-filter: blur(6px);
 }

 /* inner container centers content and limits width */
 .nav-inner {
 max-width:1100px;
 margin:0 auto;
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap:1rem;
 height:48px;
 }

 .brand {
 font-weight:800;
 color: #ffd54a;
 font-size:1rem;
 display: flex;
 align-items: center;
 gap:0.5rem;
 flex-shrink:0;
 /* emoji font fallbacks so emojis render consistently on mobile */
 font-family: Inter, system-ui, -apple-system, 'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif;
 }

 .links {
 display: flex;
 gap:0.875rem;
 align-items: center;
 }

 .links a {
 color: #e6eef8;
 text-decoration: none;
 font-size:0.95rem;
 padding:0.25rem 0.5rem;
 border-radius:0.5rem;
 white-space: nowrap;
 font-family: Inter, system-ui, -apple-system, 'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif;
 }

 .links a.active {
 background: rgba(255,215,74,0.08);
 color: #ffd54a;
 }

 .mobile-toggle {
 display: none; /* hidden on wide screens */
 }

 .mobile-toggle button {
 background: transparent;
 border:1px solid rgba(255,255,255,0.08);
 padding:6px;
 border-radius:8px;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 cursor: pointer;
 color: #fff; /* ensure currentColor used by icon */
 }

 .toggle-icon {
 font-size:18px;
 line-height:1;
 display: inline-block;
 }

 /* Mobile menu dropdown */
 .mobile-menu {
 display: none;
 }

 /* Responsive rules for small viewports */
 @media (max-width:640px) {
 .links {
 display: none; /* hide inline links on small screens */
 }

 .mobile-toggle {
 display: block;
 }

 .nav-inner {
 padding:0.5rem;
 }

 .mobile-menu {
 display: flex;
 position: absolute;
 top: calc(100% + 8px);
 left:50%;
 transform: translateX(-50%);
 margin:0 auto;
 width: calc(100% - 2rem);
 max-width:640px;
 background: rgba(15,23,42,0.98);
 border-radius:0.5rem;
 padding:0.5rem;
 flex-direction: column;
 gap:0.25rem;
 box-shadow: 8px 30px rgba(2,6,23,0.6);
 z-index:80;
 }

 .mobile-menu a {
 padding:0.6rem 0.75rem;
 border-radius:0.5rem;
 color: #e6eef8;
 text-decoration: none;
 font-family: Inter, system-ui, -apple-system, 'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif;
 }

 .mobile-menu a:hover {
 background: rgba(255,255,255,0.02);
 }
 }
 `
 ]
})
export class NavbarComponent {
 isMenuOpen = false;
 toggleMenu() { this.isMenuOpen = !this.isMenuOpen; }
}
