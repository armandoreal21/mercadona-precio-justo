import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CosechadorComponent } from './cosechador.component';
import { HttpClientModule } from '@angular/common/http';
import { NavbarComponent } from './navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CosechadorComponent, HttpClientModule, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'mercadona-precio-justo';
}
