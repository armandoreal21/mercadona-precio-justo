import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AssetLoaderService {
 private http = inject(HttpClient);

 loadJson(path: string) {
 return this.http.get(path).pipe(
 map((v) => ({ ok: true, data: v })),
 catchError((e) => of({ ok: false, error: e }))
 );
 }
}
