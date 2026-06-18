import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin } from 'rxjs';
import { map, mergeMap, tap } from 'rxjs/operators';

export interface ProductoPrecioJusto {
  idProducto: string;
  nombre: string;
  precio: number;
  imagen: string;
}

@Injectable({
  providedIn: 'root'
})
export class CosechadorService {
  private http = inject(HttpClient);

  // Usamos el endpoint público de categorías directamente
  private baseApi = 'https://tienda.mercadona.es/api/categories';

  // Subjects para controlar el progreso desde el componente
  public totalPasillos$ = new BehaviorSubject<number>(0);
  public pasillosProcesados$ = new BehaviorSubject<number>(0);

  descargarTodo(): Observable<ProductoPrecioJusto[]> {
    // Primera petición: obtener las categorías principales
    const urlCategorias = `${this.baseApi}/`;

    return this.http.get<any>(urlCategorias).pipe(
      // Asumimos que la respuesta es un array de categorías
      mergeMap((categoriasPrincipales: any[]) => {
        const peticiones: Observable<any>[] = [];

        categoriasPrincipales.forEach(cat => {
          // Para cada categoría principal pedimos su detalle (que contiene subcategorías y productos)
          const urlCategoriaDetalle = `${this.baseApi}/${cat.id}/`;

          peticiones.push(
            this.http.get<any>(urlCategoriaDetalle).pipe(
              tap(() => this.pasillosProcesados$.next(this.pasillosProcesados$.value + 1))
            )
          );

          // Si la categoría principal ya incluye subcategorías en el primer nivel, también
          // podríamos iterarlas aquí si fuera necesario. Pero pedimos el detalle siempre para
          // asegurar que tengamos los productos.
        });

        this.totalPasillos$.next(peticiones.length);
        this.pasillosProcesados$.next(0);

        return forkJoin(peticiones);
      }),
      map((todosLosPasillos: any[]) => {
        const productosFinales: ProductoPrecioJusto[] = [];
        const vistos = new Set<string>();
        const LIMITE = 10; // límite de productos únicos a obtener

        // Recorremos con bucles que permitan cortocircuito cuando alcancemos el límite
        for (let i = 0; i < todosLosPasillos.length && vistos.size < LIMITE; i++) {
          const pasillo = todosLosPasillos[i];

          if (pasillo.categories) {
            for (let j = 0; j < pasillo.categories.length && vistos.size < LIMITE; j++) {
              const bloque = pasillo.categories[j];

              if (bloque.products) {
                for (let k = 0; k < bloque.products.length && vistos.size < LIMITE; k++) {
                  const prod = bloque.products[k];

                  const id = String(prod.id);
                  if (vistos.has(id)) continue;

                  const precioRaw = prod.price_instructions?.unit_price ?? prod.price?.unit_price ?? 0;
                  const precio = typeof precioRaw === 'string' ? parseFloat(precioRaw) : Number(precioRaw);

                  productosFinales.push({
                    idProducto: id,
                    nombre: prod.display_name || prod.name || '',
                    precio: isNaN(precio) ? 0 : precio,
                    imagen: prod.thumbnail || prod.photos?.[0]?.regular || ''
                  });

                  vistos.add(id);
                }
              }

              // Si ya tenemos el límite, salimos del bucle de bloques
              if (vistos.size >= LIMITE) break;
            }
          }

          // En algunos casos el propio objeto de pasillo puede contener 'products' directamente
          if (pasillo.products) {
            for (let p = 0; p < pasillo.products.length && vistos.size < LIMITE; p++) {
              const prod = pasillo.products[p];

              const id = String(prod.id);
              if (vistos.has(id)) continue;

              const precioRaw = prod.price_instructions?.unit_price ?? prod.price?.unit_price ?? 0;
              const precio = typeof precioRaw === 'string' ? parseFloat(precioRaw) : Number(precioRaw);

              productosFinales.push({
                idProducto: id,
                nombre: prod.display_name || prod.name || '',
                precio: isNaN(precio) ? 0 : precio,
                imagen: prod.thumbnail || prod.photos?.[0]?.regular || ''
              });

              vistos.add(id);
            }
          }
        }

        return productosFinales;
      })
    );
  }
}
