import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ProductoPrecioJusto {
  idProducto: string;
  nombre: string;
  precio: number;
  imagen: string;
  descripcion?: string;
  categoria?: string;
  share_url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CosechadorService {
  private http = inject(HttpClient);

  // Rutas a los ficheros locales (se asume que se sirven desde "assets")
  private categoriasPath = 'assets/Categoria.json';
  private subcategoriasFolder = 'assets/subcategorias';

  // Historial para previous/next
  private historial: ProductoPrecioJusto[] = [];
  private indiceActual = -1;

  constructor() {}

  // Carga el fichero principal de categorías
  private cargarCategorias(): Observable<any> {
    return this.http.get<any>(this.categoriasPath).pipe(
      catchError(err => throwError(() => new Error('No se pudo cargar Categoria.json: ' + err)))
    );
  }

  // Carga la subcategoria por id desde assets/subcategorias/{id}.json
  private cargarSubcategoriaPorId(id: number | string): Observable<any> {
    const path = `${this.subcategoriasFolder}/${id}.json`;
    return this.http.get<any>(path).pipe(
      catchError(() => throwError(() => new Error(`No se encontró ${path}`)))
    );
  }

  // Método que devuelve Observable<ProductoPrecioJusto> completo (aleatorio)
  obtenerProductoAleatorio(): Observable<ProductoPrecioJusto> {
    return new Observable<ProductoPrecioJusto>((subscriber) => {
      this.cargarCategorias().subscribe({
        next: (cats) => {
          const results = cats?.results || [];
          const posiblesSubIds: number[] = [];

          results.forEach((r: any) => {
            if (Array.isArray(r.categories)) {
              r.categories.forEach((sc: any) => {
                if (sc?.id) posiblesSubIds.push(sc.id);
              });
            }
          });

          if (posiblesSubIds.length ===0) {
            subscriber.error(new Error('No hay subcategorías disponibles en Categoria.json'));
            return;
          }

          const elegido = posiblesSubIds[Math.floor(Math.random() * posiblesSubIds.length)];

          this.cargarSubcategoriaPorId(elegido).subscribe({
            next: (subcat) => {
              // Buscar productos dentro de la estructura de subcat
              const productos: any[] = [];

              // Recorrer posibles ubicaciones de productos
              if (Array.isArray(subcat.products)) {
                productos.push(...subcat.products);
              }

              if (Array.isArray(subcat.categories)) {
                subcat.categories.forEach((b: any) => {
                  if (Array.isArray(b.products)) productos.push(...b.products);
                  // Algunas capas pueden tener categories dentro
                  if (Array.isArray(b.categories)) {
                    b.categories.forEach((c2: any) => {
                      if (Array.isArray(c2.products)) productos.push(...c2.products);
                    });
                  }
                });
              }

              if (productos.length ===0) {
                subscriber.error(new Error(`No se encontraron productos en la subcategoría ${elegido}`));
                return;
              }

              // Elegir un producto aleatorio
              const prod = productos[Math.floor(Math.random() * productos.length)];

              const precioRaw = prod?.price_instructions?.unit_price ?? prod?.price?.unit_price ??0;
              const precio = typeof precioRaw === 'string' ? parseFloat(precioRaw) : Number(precioRaw);

              const resultado: ProductoPrecioJusto = {
                idProducto: String(prod.id ?? prod?.product_id ?? ''),
                nombre: prod.display_name || prod.name || prod?.slug || '',
                precio: isNaN(precio) ?0 : precio,
                imagen: prod.thumbnail || prod.photos?.[0]?.regular || prod.share_url || '',
                descripcion: prod.description || prod.long_description || '',
                categoria: subcat.name || undefined,
                share_url: prod.share_url || undefined
              };

              // Añadir al historial y ajustar índice
              // Si estamos en medio del historial y pedimos siguiente aleatorio, truncamos el futuro
              if (this.indiceActual < this.historial.length -1) {
                this.historial = this.historial.slice(0, this.indiceActual +1);
              }

              this.historial.push(resultado);
              this.indiceActual = this.historial.length -1;

              subscriber.next(resultado);
              subscriber.complete();
            },
            error: (err) => subscriber.error(err)
          });
        },
        error: (err) => subscriber.error(err)
      });
    });
  }

  // Obtener el elemento anterior en el historial (si existe)
  previousFromHistory(): ProductoPrecioJusto | null {
    if (this.indiceActual >0) {
      this.indiceActual--;
      return this.historial[this.indiceActual];
    }
    return null;
  }

  // Obtener el elemento siguiente en el historial si existe (sin generar uno nuevo)
  nextFromHistory(): ProductoPrecioJusto | null {
    if (this.indiceActual < this.historial.length -1) {
      this.indiceActual++;
      return this.historial[this.indiceActual];
    }
    return null;
  }

  // Exponer el estado del historial para uso externo si es necesario
  getHistorial(): ProductoPrecioJusto[] {
    return [...this.historial];
  }

  getIndiceActual(): number {
    return this.indiceActual;
  }
}
