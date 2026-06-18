import { Routes } from '@angular/router';
import { CrearSalaComponent } from './crear-sala.component';
import { UnirseSalaComponent } from './unirse-sala.component';
import { CosechadorComponent } from './cosechador.component';
import { SalaPageComponent } from './sala-page.component';
import { SalaGuard } from './sala.guard';

export const routes: Routes = [
 { path: '', redirectTo: 'unirse', pathMatch: 'full' },
 { path: 'administrar', component: CrearSalaComponent },
 { path: 'unirse', component: UnirseSalaComponent },
 { path: 'cosechador', component: CosechadorComponent },
 { path: 'sala/:codigo', component: SalaPageComponent, canActivate: [SalaGuard] }
];
