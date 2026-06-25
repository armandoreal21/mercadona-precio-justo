import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CosechadorComponent } from './cosechador.component';
import { HttpClientModule } from '@angular/common/http';
import { ProductGuessingCardComponent } from './product-guessing-card.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CosechadorComponent, HttpClientModule, ProductGuessingCardComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'mercadona-precio-justo';
}
