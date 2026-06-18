import { Injectable } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SalaService } from './sala.service';

@Injectable({ providedIn: 'root' })
export class SalaGuard {
 constructor(private salaService: SalaService, private router: Router) {}

 canActivate(route: ActivatedRouteSnapshot): boolean {
 const codigo = String(route.paramMap.get('codigo') || '').toUpperCase();
 const sala = this.salaService.obtenerSalaPorCodigo(codigo);
 if (!sala) {
 // redirigir a unirse si la sala no existe
 this.router.navigate(['/unirse'], { replaceUrl: true });
 return false;
 }
 return true;
 }
}
