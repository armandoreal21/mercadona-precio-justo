import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin } from 'rxjs';
import { map, mergeMap, tap } from 'rxjs/operators';

export interface ProductoPrecioJusto {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
}

@Injectable({
  providedIn: 'root'
})
export class CosechadorService {
  private http = inject(HttpClient);

  private proxyUrl = 'https://api.allorigins.win/get?url=';
  private apiCategorias = 'https://tienda.mercadona.es/api/categories/?lang=es';

  // Subjects para controlar el progreso desde el componente
  public totalPasillos$ = new BehaviorSubject<number>(0);
  public pasillosProcesados$ = new BehaviorSubject<number>(0);

  descargarTodo(): Observable<ProductoPrecioJusto[]> {
    return this.http.get<{ contents: string }>(`${this.proxyUrl}${encodeURIComponent(this.apiCategorias)}`).pipe(
      map(res => JSON.parse(res.contents).results),
      mergeMap((categoriasPrincipales: any[]) => {
        const peticiones: Observable<any>[] = [];

        // Extraemos las subcategorías (los pasillos reales)
        categoriasPrincipales.forEach(cat => {
          cat.categories.forEach((subCat: any) => {
            const urlPasillo = `https://tienda.mercadona.es/api/categories/${subCat.id}/?lang=es`;

            peticiones.push(
              this.http.get<{ contents: string }>(`${this.proxyUrl}${encodeURIComponent(urlPasillo)}`).pipe(
                map(res => JSON.parse(res.contents)),
                // Cada vez que un pasillo responde, sumamos1 al contador de progreso
                tap(() => this.pasillosProcesados$.next(this.pasillosProcesados$.value + 1))
              )
            );
          });
        });

        // Informamos al componente de cuántos pasillos hay en total
        this.totalPasillos$.next(peticiones.length);
        this.pasillosProcesados$.next(0);

        // Lanzamos todas las peticiones en paralelo
        return forkJoin(peticiones);
      }),
      map((todosLosPasillos: any[]) => {
        const productosFinales: ProductoPrecioJusto[] = [];

        todosLosPasillos.forEach(pasillo => {
          if (pasillo.categories) {
            pasillo.categories.forEach((bloque: any) => {
              bloque.products?.forEach((prod: any) => {
                productosFinales.push({
                  id: prod.id,
                  nombre: prod.display_name,
                  precio: parseFloat(prod.price_instructions.unit_price),
                  imagen: prod.photos?.[0]?.regular || ''
                });
              });
            });
          }
        });

        // Filtramos duplicados por ID
        return productosFinales.filter((prod, index, self) =>
          index === self.findIndex((p) => p.id === prod.id)
        );
      })
    );
  }
}
