import { Routes } from '@angular/router';
import { UnirseSalaComponent } from './unirse-sala.component';
import { CosechadorComponent } from './cosechador.component';
import { SalaGuard } from './sala.guard';
import { SelectorJuegoComponent } from './pages/selector-juego/selector-juego.component';
import { ConfigurarSalaComponent } from './pages/configurar-sala/configurar-sala.component';
import { SalaShellComponent } from './pages/sala-shell/sala-shell.component';

export const routes: Routes = [
  { path: '', redirectTo: 'unirse', pathMatch: 'full' },
  { path: 'juegos', component: SelectorJuegoComponent },
  { path: 'crear', redirectTo: 'juegos', pathMatch: 'full' },
  { path: 'crear/:juegoId', component: ConfigurarSalaComponent },
  { path: 'administrar', redirectTo: 'juegos', pathMatch: 'full' },
  { path: 'unirse', component: UnirseSalaComponent },
  { path: 'cosechador', component: CosechadorComponent },
  { path: 'sala/:codigo', component: SalaShellComponent, canActivate: [SalaGuard] },
  { path: '**', redirectTo: 'unirse' }
];
