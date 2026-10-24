import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Sala, Jugador, ResultadoRonda, HistorialRonda, Equipo, EstadoPalabraMasLarga, PalabraAportada, SeleccionEquipoPalabra, ModoPuntuacionPalabras, DificultadPalabras, EstadoSubastaRespuestas, EstadoCodigoSecreto, EstadoPreguntasAnonimas, RespuestaAgrupada, EstadoMinijuegos, TipoMinijuego } from './core/models/sala.model';
import { ModoJuego } from './core/models/game.model';
import { TIPOS_MINIJUEGO, generarPuzle, validarRespuesta, barajar, PENALIZACION_ERROR_MS, SEG_TURNO_DEFAULT, aplicarAccionJuego, comprobarJuego, aplicarControlReactor, aplicarAccionPuntero, aplicarSemaforo, aplicarBarco, aplicarCocina } from './games/minijuegos-equipos/minijuegos.logic';

export { Sala, Jugador, ResultadoRonda, HistorialRonda, Equipo, EstadoPalabraMasLarga, PalabraAportada, SeleccionEquipoPalabra, ModoPuntuacionPalabras, DificultadPalabras };

@Injectable({ providedIn: 'root' })
export class SalaService {
  private http = inject(HttpClient);
  private storageKey = 'mpj_salas_v1';
  private templatePath = 'assets/sala-data.json';

  // runtime flag to disable websocket
  private useWebsocket: boolean = true;
  private useFirebase: boolean = false;
  private firebaseApp: any = null;
  private firebaseDb: any = null;
  private firebaseRefPath = '/salas';

  private hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  private memoryCache: { salasActivas: Sala[] } | null = null;

  private ws: WebSocket | null = null;
  private clientId = Math.random().toString(36).slice(2);
  private suppressBroadcast = false;
  private pendingSync = false;
  /** Firma de cada sala tal como está en Firebase: sirve para escribir solo lo que cambia. */
  private firmasEnviadas: Record<string, string> = {};

  constructor() {
    try {
      const env = (window as any).__env;
      if (env && (env.USE_WS === 'false' || env.USE_WS === false)) {
        this.useWebsocket = false;
      }
      if (env && env.FIREBASE_CONFIG) {
        // initialize but don't await - initFirebase handles async work
        this.initFirebase(env.FIREBASE_CONFIG);
      }
    } catch (e) {
      // ignore
    }

    // CRÍTICO: Siempre inicializar localStorage sincronicamente para evitar race conditions
    if (this.hasLocalStorage) {
      let mustInit = false;
      try {
        const existing = localStorage.getItem(this.storageKey);
        if (!existing) {
          mustInit = true;
        }
      } catch (e) {
        // localStorage inaccesible, usar memory
        mustInit = false;
        this.hasLocalStorage = false;
      }

      if (mustInit) {
        // Inicializar inmediatamente con estructura vacía
        localStorage.setItem(this.storageKey, JSON.stringify({ salasActivas: [] }));
        
        // OPCIONALMENTE cargar desde template en background
        this.http
          .get(this.templatePath)
          .pipe(catchError(() => of(null)))
          .subscribe((res: any) => {
            if (res && Array.isArray(res.salasActivas) && res.salasActivas.length > 0) {
              // Solo actualizar si template tiene datos válidos
              try {
                localStorage.setItem(this.storageKey, JSON.stringify(res));
              } catch (e) {
                // ignore
              }
            }
          });
      }
    } else {
      // En servidor o entornos sin localStorage, inicializar memoria vacía
      this.memoryCache = { salasActivas: [] };
    }

    // iniciar websocket solo si está habilitado en runtime y el navegador soporta WebSocket
    if (!this.useFirebase && this.useWebsocket && typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
      this.initWebsocket();
    }
  }

  // ---------- Firebase integration (optional, modular v9 via dynamic import) ----------
  private async initFirebase(config: any) {
    try {
      const firebaseAppMod = await import('firebase/app');
      const databaseMod = await import('firebase/database');
      const initializeApp = (firebaseAppMod as any).initializeApp || (firebaseAppMod as any).default?.initializeApp;
      const getDatabase = (databaseMod as any).getDatabase;
      const ref = (databaseMod as any).ref;
      const onValue = (databaseMod as any).onValue;
      const get = (databaseMod as any).get;
      const set = (databaseMod as any).set;
      if (!initializeApp || !getDatabase) {
        console.warn('Firebase modular APIs not found');
        return;
      }
      this.firebaseApp = initializeApp(config);
      this.firebaseDb = getDatabase(this.firebaseApp);
      this.useFirebase = true;

      // If we accumulated local changes before Firebase was ready, push them now
      try {
        if (this.pendingSync) {
          const local = this.readAll();
          await this.broadcastStateToFirebase(local);
          this.pendingSync = false;
        }
      } catch (e) {
        // ignore
      }

      const stateRef = ref(this.firebaseDb, this.firebaseRefPath);

      // listen for changes
      onValue(stateRef, (snapshot: any) => {
        try {
          const val = snapshot && typeof snapshot.val === 'function' ? snapshot.val() : snapshot;
          const state = this.estadoDesdeSalas(val);
          console.debug('[SalaService] firebase onValue, state snapshot:', state);
          this.firmasEnviadas = this.firmasDe(state.salasActivas);
          this.suppressBroadcast = true;
          
          // IMPORTANTE: No sobrescribir localStorage si está más actualizado que Firebase
          // Esto evita que salas recién creadas en local se pierdan cuando Firebase aún está vacío
          const local = this.readAll();
          const serverEmpty = !state?.salasActivas || state.salasActivas.length === 0;
          const localHasRooms = false; // el servidor es la única fuente de verdad
          
          if (serverEmpty && localHasRooms) {
            // Firebase vacío pero tenemos salas locales → NO sobrescribir, mantener locales
            console.debug('[SalaService] Firebase vacío pero hay salas locales. Manteniendo estado local.');
          } else {
            // Firebase tiene datos o ambos están vacíos → usar Firebase
            if (this.hasLocalStorage) {
              localStorage.setItem(this.storageKey, JSON.stringify(state));
            } else {
              this.memoryCache = state;
            }
          }
          
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: 'firebase' } }));
          }
        } catch (e) {
          // ignore
        } finally {
          this.suppressBroadcast = false;
        }
      });

      // initialize DB if empty using local
      try {
        const snap = await get(stateRef);
        const dbVal = snap && typeof snap.val === 'function' ? snap.val() : snap;
        const local = this.readAll();
        const serverHas = dbVal && Array.isArray(dbVal.salasActivas) && dbVal.salasActivas.length > 0;
        if (!serverHas && Array.isArray(local) && local.length > 0) {
          // Sin siembra desde local: las copias locales ya no pueden resucitar salas
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.warn('Firebase init failed:', (e as any)?.message || e);
      this.useFirebase = false;
      this.firebaseApp = null;
      this.firebaseDb = null;
    }
  }

  // ---------- WebSocket fallback (kept for compatibility) ----------
  private initWebsocket() {
    if (!this.useWebsocket) return;
    try {
      const host = (typeof window !== 'undefined' && (window as any).location && (window as any).location.hostname) ? (window as any).location.hostname : 'localhost';
      const url = (window as any).__env?.WS_URL || `ws://${host}:3001`;
      console.log('[SalaService] initializing websocket to', url);
      this.ws = new WebSocket(url);
      this.ws.addEventListener('open', () => {
        console.log('[SalaService] websocket open to', url);
        const msg = { type: 'requestState', clientId: this.clientId };
        try { this.ws?.send(JSON.stringify(msg)); } catch (e) { }
        if (this.pendingSync) {
          try {
            const local = this.readAll();
            this.ws?.send(JSON.stringify({ type: 'syncState', clientId: this.clientId, state: { salasActivas: local } }));
            this.pendingSync = false;
          } catch (e) { /* ignore */ }
        }
      });

      this.ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(String(ev.data));
          if (data?.type === 'state' && data?.state) {
            if (data.clientId === this.clientId) return;
            this.suppressBroadcast = true;
            try {
              const state = data.state as { salasActivas: Sala[] };
              const local = this.readAll();
              const serverHas = Array.isArray(state?.salasActivas) && state.salasActivas.length > 0;
              if (!serverHas && Array.isArray(local) && local.length > 0) {
                try { this.ws?.send(JSON.stringify({ type: 'syncState', clientId: this.clientId, state: { salasActivas: local } })); } catch (e) { }
              }
              if (this.hasLocalStorage) {
                localStorage.setItem(this.storageKey, JSON.stringify(state));
              } else {
                this.memoryCache = state;
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: data.clientId } }));
              }
            } catch (e) { /* ignore */ }
            this.suppressBroadcast = false;
          }
        } catch (e) { console.error('WS parse error', e); }
      });

      this.ws.addEventListener('close', () => { console.log('[SalaService] websocket closed'); this.ws = null; if (this.useWebsocket) setTimeout(() => this.tryReconnect(), 2000); });
      this.ws.addEventListener('error', (err) => { console.error('[SalaService] websocket error', err); });
    } catch (e) {
      this.ws = null;
      setTimeout(() => this.tryReconnect(), 2000);
    }
  }

  private tryReconnect() {
    if (!this.useWebsocket) return;
    if (this.ws) return;
    try { this.initWebsocket(); } catch (e) { setTimeout(() => this.tryReconnect(), 2000); }
  }

  // request server state: uses Firebase when enabled, otherwise return local state
  async requestServerState(): Promise<any> {
    if (this.useFirebase && this.firebaseDb) {
      try {
        const databaseMod = await import('firebase/database');
        const ref = (databaseMod as any).ref;
        const get = (databaseMod as any).get;
        const stateRef = ref(this.firebaseDb, this.firebaseRefPath);
        const snap = await get(stateRef);
        return snap && typeof snap.val === 'function' ? snap.val() : snap;
      } catch (e) { return null; }
    }
    // fallback: return local stored state
    return { salasActivas: this.readAll() };
  }

  private async broadcastStateToFirebase(salas: Sala[]) {
    if (!this.useFirebase || !this.firebaseDb) return;
    try {
      const databaseMod = await import('firebase/database');
      const ref = (databaseMod as any).ref;
      const set = (databaseMod as any).set;
      const stateRef = ref(this.firebaseDb, this.firebaseRefPath);
      console.debug('[SalaService] writing state to firebase, salas count:', salas.length);
      // Sanitize structure: JSON.stringify removes undefined properties which RTDB rejects
      const safe = JSON.parse(JSON.stringify({ salasActivas: salas }));
      await this.sincronizarSalas(salas);
    } catch (e) {
      console.error('[SalaService] broadcastStateToFirebase error', e);
    }
  }

  private broadcastState(salas: Sala[]) {
    // don't broadcast if we're suppressing
    if (this.suppressBroadcast) return;

    // If using Firebase, write to DB
    if (this.useFirebase && this.firebaseDb) {
      this.broadcastStateToFirebase(salas);
      this.pendingSync = false;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: 'firebase-write' } }));
      return;
    }

    if (!this.useWebsocket) return;
    const ws = this.ws as WebSocket | null;
    if (!ws) return;
    const ready = (ws as any).readyState;
    if (ready !== (WebSocket as any).OPEN) return;
    try { ws.send(JSON.stringify({ type: 'syncState', clientId: this.clientId, state: { salasActivas: salas } })); } catch (e) { }
  }

  private readAll(): Sala[] {
    if (this.hasLocalStorage) {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) {
          console.debug('[SalaService] readAll: localStorage vacío, retornando memoryCache');
          return this.memoryCache?.salasActivas || [];
        }
        const parsed = JSON.parse(raw);
        const salas: Sala[] = parsed?.salasActivas || [];
        let changed = false;
        const now = Date.now();
        const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
        salas.forEach(s => {
          if (s.createdAt === undefined && s.updatedAt === undefined) {
            s.createdAt = twoDaysAgo;
            s.updatedAt = twoDaysAgo;
            changed = true;
          }
          if (!s.tipoJuego) { s.tipoJuego = 'precio-justo'; changed = true; }
          if (!s.modoJuego) { s.modoJuego = 'individual'; changed = true; }
          if (s.rondasTotales === undefined || s.rondasTotales === null) { s.rondasTotales = 5; changed = true; }
          if (!Array.isArray(s.historialRondas)) s.historialRondas = [];
          if (s.rondaActual === undefined || s.rondaActual === null) { s.rondaActual = 0; changed = true; }
          // ensure jugadores exists and has sane defaults
          if (!Array.isArray(s.jugadores)) { s.jugadores = []; changed = true; }
          else {
            s.jugadores = s.jugadores.map(j => ({
              nombre: (j && j.nombre) ? String(j.nombre) : '',
              apuesta: (j && typeof j.apuesta !== 'undefined') ? j.apuesta : undefined,
              esAdmin: !!(j && j.esAdmin),
              puntuacion: (j && typeof j.puntuacion !== 'undefined') ? j.puntuacion : 0,
              equipoId: j?.equipoId || undefined
            }));
          }
        });
        if (changed) {
          try {
            localStorage.setItem(this.storageKey, JSON.stringify({ salasActivas: salas }));
          } catch (e) {
            // ignore si no puedo escribir los cambios
            console.debug('[SalaService] readAll: no puedo escribir cambios a localStorage');
          }
        }
        return salas;
      } catch (e: any) {
        console.warn('[SalaService] readAll: ERROR leyendo localStorage, fallback a memoryCache:', e?.message);
        this.hasLocalStorage = false;
        return this.memoryCache?.salasActivas || [];
      }
    }
    // fallback memoria: ensure we always return an array
    if (this.memoryCache && Array.isArray(this.memoryCache.salasActivas)) {
      return this.memoryCache.salasActivas;
    }
    return [];
  }

  private writeAll(salas: Sala[]) {
    if (this.hasLocalStorage) {
      try {
        const serialized = JSON.stringify({ salasActivas: salas });
        console.debug('[SalaService] writeAll: intentando escribir', serialized.length, 'bytes en localStorage');
        localStorage.setItem(this.storageKey, serialized);
        console.debug('[SalaService] writeAll: escritura exitosa');
      } catch (e: any) {
        console.warn('[SalaService] writeAll: ERROR escribiendo localStorage (posiblemente lleno o inaccesible), fallback a memory:', e?.message);
        this.hasLocalStorage = false;
        if (!this.memoryCache) this.memoryCache = { salasActivas: [] };
        this.memoryCache.salasActivas = salas;
      }
    } else {
      if (!this.memoryCache) this.memoryCache = { salasActivas: [] };
      this.memoryCache.salasActivas = salas;
    }

    console.debug('[SalaService] writeAll: wrote local state, salas count:', salas.length, 'pendingSync:', this.pendingSync, 'useFirebase:', this.useFirebase, 'firebaseDb:', !!this.firebaseDb);

    if (this.useFirebase && this.firebaseDb) {
      this.broadcastStateToFirebase(salas);
      this.pendingSync = false;
    } else if (this.useWebsocket && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.broadcastState(salas);
      this.pendingSync = false;
    } else {
      // do not attempt HTTP /sync fallback when running on hosted HTTPS - rely on localStorage or Firebase
      this.pendingSync = true;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: this.clientId } }));
    }
  }

  generarCodigo(longitud = 5): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // Solo MAYÚSCULAS (sin I, O, 1, L para evitar confusión)
    let codigo = '';
    for (let i = 0; i < longitud; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
    return codigo;
  }

  async crearSala(
    nombre: string,
    rondas = 5,
    tipoJuego = 'precio-justo',
    modoJuego: ModoJuego = 'individual',
    equipos?: Equipo[],
    configPalabras?: { numLetras?: number; dificultad?: DificultadPalabras }
  ): Promise<{ sala: Sala; creado: boolean; error?: string }> {
    const upName = nombre.trim();
    const upNameLower = upName.toLowerCase();

    // 1. Siempre creamos la sala localmente primero para disponibilidad instantánea en este dispositivo
    const localSalas = this.readAll();
    if (localSalas.some(s => s.nombre.toLowerCase() === upNameLower)) {
      return { sala: null as any, creado: false, error: 'Ya existe una sala con ese nombre' };
    }

    let codigo = this.generarCodigo();
    while (localSalas.some(s => s.codigo === codigo)) {
      codigo = this.generarCodigo();
    }

    const now = Date.now();
    const estadoPalabrasInicial: EstadoPalabraMasLarga | undefined = tipoJuego === 'palabra-mas-larga' ? {
      fase: 'esperando',
      letras: [],
      numLetras: configPalabras?.numLetras || 10,
      tiempoLimite: 45,
      dificultad: configPalabras?.dificultad || 'facil',
      palabrasAportadas: [],
      selecciones: {},
      modoPuntuacion: 'por_letras'
    } : undefined;

    // Estado inicial de La Subasta de Respuestas (solo para ese tipo de juego)
    const estadoSubastaInicial: EstadoSubastaRespuestas | null = tipoJuego === 'subasta-respuestas' ? {
      fase: 'esperando',
      dificultad: configPalabras?.dificultad || 'facil',
      tiempoLimite: 45,
      puntosPorRespuesta: configPalabras?.dificultad === 'dificil' ? 2 : 1,
      categoriasUsadas: [],
      respuestasAportadas: [],
      selecciones: {}
    } : null;

    const nueva: Sala = {
      codigo,
      nombre: upName,
      tipoJuego: tipoJuego || 'precio-justo',
      modoJuego: modoJuego || 'individual',
      equipos: equipos || undefined,
      productoActualId: null,
      productoActual: null,
      estado: 'esperando_jugadores',
      jugadores: [],
      rondasTotales: typeof rondas === 'number' && rondaSaneable(rondas) ? Math.max(1, Math.floor(rondas)) : 5,
      rondaActual: 0,
      historialRondas: [],
      lastResults: null,
      estadoPalabras: estadoPalabrasInicial,
      estadoSubasta: estadoSubastaInicial,
      estadoCodigoSecreto: tipoJuego === 'codigo-secreto' ? this.estadoCodigoInicial([]) : null,
      createdAt: now,
      updatedAt: now
    };

    localSalas.push(nueva);
    this.writeAll(localSalas);
    
    // VERIFICAR que la sala está disponible localmente antes de retornar
    const verified = this.obtenerSalaPorCodigo(codigo);
    if (!verified) {
      // Esto no debería pasar, pero si pasa, significaría fallo crítico en localStorage
      console.error('[SalaService] CRITICAL: Sala creada pero no verificable inmediatamente');
      return { sala: null as any, creado: false, error: 'Error crítico: sala no verificable' };
    }

    // 2. Si Firebase está activo o conectándose, sincronizamos remotamente (en background, no bloqueante)
    if (this.useFirebase && this.firebaseDb) {
      // NO esperamos aquí - Fire base se sincroniza en background
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const yaExiste = salas.find(s => s.codigo === codigo);
        if (yaExiste) {
          return state;
        }
        salas.push(nueva);
        return { salasActivas: salas };
      }).catch(err => {
        console.warn('[SalaService] Error sincronizando nueva sala con Firebase:', err);
      });
    }

    return { sala: verified, creado: true };
  }

  obtenerSalaPorCodigo(codigo: string): Sala | null {
    const salas = this.readAll();
    return salas.find(s => s.codigo === (codigo || '').toUpperCase()) || null;
  }

  // ---------- Firebase transaction helper to avoid lost updates ----------
  // ---------- Escritura por salas: un nodo por sala en /salas ----------

  private colaEscrituras: Promise<unknown> = Promise.resolve();

  /** Ejecuta las escrituras de una en una. Si una se queda colgada, la cola sigue a los 15 s. */
  private enCola<T>(tarea: () => Promise<T>, maxMs = 15000): Promise<T> {
    const limite = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout escritura Firebase')), maxMs));
    const r = this.colaEscrituras.then(() => Promise.race([tarea(), limite]));
    this.colaEscrituras = r.catch(() => undefined);
    return r;
  }

  /** Forma canónica para comparar: ignora el orden de claves, los vacíos y null/undefined (como hace RTDB). */
  private canonico(v: any): string | undefined {
    if (v === null || v === undefined || typeof v === 'function') return undefined;
    if (Array.isArray(v)) {
      const items = v.map(x => this.canonico(x)).filter((x): x is string => x !== undefined);
      return items.length ? '[' + items.join(',') + ']' : undefined;
    }
    if (typeof v === 'object') {
      const partes: string[] = [];
      Object.keys(v).sort().forEach(k => {
        const c = this.canonico(v[k]);
        if (c !== undefined) partes.push(JSON.stringify(k) + ':' + c);
      });
      return partes.length ? '{' + partes.join(',') + '}' : undefined;
    }
    if (typeof v === 'number' && !isFinite(v)) return undefined;
    return JSON.stringify(v);
  }

  /** Firma de una sala. Ignora updatedAt: un cambio que solo toca la marca de tiempo no se escribe. */
  private firmaSala(s: Sala): string {
    return this.canonico({ ...s, updatedAt: undefined }) || '';
  }

  private firmasDe(salas: Sala[]): Record<string, string> {
    const out: Record<string, string> = {};
    (salas || []).forEach(s => { if (s && s.codigo) out[s.codigo] = this.firmaSala(s); });
    return out;
  }

  /** Lista de salas a partir del nodo /salas (un hijo por sala). */
  private estadoDesdeSalas(val: any): { salasActivas: Sala[]; borradas: Record<string, number> } {
    const lista = val && typeof val === 'object' ? (Object.values(val).filter(Boolean) as Sala[]) : [];
    return { salasActivas: lista, borradas: {} };
  }

  private guardarLocal(salas: Sala[]): void {
    if (this.hasLocalStorage) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({ salasActivas: salas }));
        return;
      } catch (e) { /* sin localStorage: se usa memoria */ }
    }
    this.memoryCache = { salasActivas: salas };
  }

  /** Escribe solo las salas que cambian respecto a lo que hay en Firebase, y borra las que desaparecen. */
  private async sincronizarSalas(salas: Sala[]): Promise<void> {
    const databaseMod = await import('firebase/database');
    const ref = (databaseMod as any).ref;
    const update = (databaseMod as any).update;
    await this.enCola(async () => {
      const nuevas = this.firmasDe(salas);
      const cambios: Record<string, any> = {};
      salas.forEach(s => {
        if (s && s.codigo && this.firmasEnviadas[s.codigo] !== nuevas[s.codigo]) cambios[s.codigo] = JSON.parse(JSON.stringify(s));
      });
      Object.keys(this.firmasEnviadas).forEach(codigo => {
        if (!(codigo in nuevas)) cambios[codigo] = null;
      });
      if (Object.keys(cambios).length === 0) return;
      await update(ref(this.firebaseDb, this.firebaseRefPath), cambios);
      this.firmasEnviadas = nuevas;
    });
  }

  /** Lee /salas, aplica la mutación y escribe solo las salas que cambian. */
  private async applyTransaction(mutator: (state: { salasActivas: Sala[] }) => { salasActivas: Sala[] } | null): Promise<{ salasActivas: Sala[] } | null> {
    if (!this.useFirebase || !this.firebaseDb) return null;
    try {
      const databaseMod = await import('firebase/database');
      const ref = (databaseMod as any).ref;
      const get = (databaseMod as any).get;
      const update = (databaseMod as any).update;
      return await this.enCola(async () => {
        const snap: any = await get(ref(this.firebaseDb, this.firebaseRefPath));
        const val = snap && typeof snap.val === 'function' ? snap.val() : null;
        const actual: Sala[] = this.estadoDesdeSalas(val).salasActivas;
        const resultado = mutator({ salasActivas: JSON.parse(JSON.stringify(actual)) as Sala[] });
        if (resultado === null) return null;
        const nuevas = this.firmasDe(resultado.salasActivas);
        const antes = this.firmasDe(actual);
        const cambios: Record<string, any> = {};
        resultado.salasActivas.forEach(s => {
          if (antes[s.codigo] !== nuevas[s.codigo]) cambios[s.codigo] = JSON.parse(JSON.stringify(s));
        });
        actual.forEach(s => {
          if (!(s.codigo in nuevas)) cambios[s.codigo] = null;
        });
        if (Object.keys(cambios).length > 0) {
          await update(ref(this.firebaseDb, this.firebaseRefPath), cambios);
        }
        this.firmasEnviadas = nuevas;
        this.guardarLocal(resultado.salasActivas);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: 'firebase-transaction' } }));
        return { salasActivas: resultado.salasActivas };
      });
    } catch (e) {
      console.error('[SalaService] applyTransaction error', e);
      return null;
    }
  }

  /** Versión anterior (transacción sobre todo el estado). Sin uso: se elimina tras probar. */
  private async applyTransactionAntigua(mutator: (state: { salasActivas: Sala[] }) => { salasActivas: Sala[] } | null) {
    if (!this.useFirebase || !this.firebaseDb) return null;
    try {
      const databaseMod = await import('firebase/database');
      const ref = (databaseMod as any).ref;
      const runTransaction = (databaseMod as any).runTransaction;
      const stateRef = ref(this.firebaseDb, this.firebaseRefPath);
      const result = await runTransaction(stateRef, (current: any) => {
        const state = (current && typeof current === 'object') ? current : { salasActivas: [] };
        try {
          const next = mutator(state);
          // If mutator returns null, abort transaction (no change)
          return next === null ? undefined : next;
        } catch (e) {
          return state;
        }
      });
      // result may contain snapshot
      const snap = result && (result as any).snapshot;
      const val = snap && typeof snap.val === 'function' ? snap.val() : snap;
      const newState = (val && typeof val === 'object' && Array.isArray(val.salasActivas)) ? val : { salasActivas: [] };
      // persist locally and notify clients
      if (this.hasLocalStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(newState));
      } else {
        this.memoryCache = newState;
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mpj_state_updated', { detail: { source: 'firebase-transaction' } }));
      return newState;
    } catch (e) {
      console.error('[SalaService] applyTransaction error', e);
      return null;
    }
  }

  async unirASala(codigo: string, nombreJugador: string, equipoId?: string): Promise<{ sala?: Sala; success: boolean; error?: string }> {
    if (!nombreJugador || !nombreJugador.trim()) return { success: false, error: 'Nombre inválido' };
    const upCode = (codigo || '').toUpperCase();
    const trimmedNombre = nombreJugador.trim();
    const trimmedNombreLower = trimmedNombre.toLowerCase();

    // 1. Intentar transacción en Firebase si está activo
    if (this.useFirebase && this.firebaseDb) {
      let playerExists = false;

      try {
        const newState = await this.applyTransaction((state) => {
          const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
          const sala = salas.find(s => s.codigo === upCode);
          if (!sala) {
            return null; // Sala no encontrada en Firebase
          }

          const exists = sala.jugadores && sala.jugadores.some((j: any) => (j.nombre || '').toLowerCase() === trimmedNombreLower);
          if (exists) {
            playerExists = true;
            return null;
          }
          const jugador: Jugador = { nombre: trimmedNombre, esAdmin: false, puntuacion: 0, equipoId };
          sala.jugadores = Array.isArray(sala.jugadores) ? sala.jugadores : [];
          sala.jugadores.push(jugador);
          sala.updatedAt = Date.now();
          return { salasActivas: salas };
        });

        if (newState) {
          // Firebase tuvo éxito, pero verifica localmente para garantizar
          const sala = this.obtenerSalaPorCodigo(upCode);
          if (sala) {
            return { sala, success: true };
          }
        }

        if (playerExists) {
          return { success: false, error: 'Ya existe un jugador con ese nombre en la sala' };
        }
      } catch (e) {
        console.warn('[SalaService] Error en transacción unirASala:', e);
      }
    }

    // 2. Fallback local / lectura de caché sincronizada
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return { success: false, error: 'Sala no encontrada' };
    if (sala.jugadores.find(j => j.nombre.toLowerCase() === trimmedNombreLower)) {
      return { success: false, error: 'Ya existe un jugador con ese nombre en la sala' };
    }
    const jugador: Jugador = { nombre: trimmedNombre, esAdmin: false, puntuacion: 0, equipoId };
    sala.jugadores.push(jugador);
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return { sala, success: true };
  }

  async unirComoAdmin(codigo: string, nombreJugador: string, equipoId?: string): Promise<{ sala?: Sala; success: boolean; error?: string }> {
    if (!nombreJugador || !nombreJugador.trim()) return { success: false, error: 'Nombre inválido' };
    const upCode = (codigo || '').toUpperCase();
    const trimmedNombre = nombreJugador.trim();
    const trimmedNombreLower = trimmedNombre.toLowerCase();

    // 1. Intentar transacción en Firebase si está activo
    if (this.useFirebase && this.firebaseDb) {
      try {
        const newState = await this.applyTransaction((state) => {
          const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
          const sala = salas.find(s => s.codigo === upCode);
          if (!sala) {
            return null;
          }

          let jugador = sala.jugadores && sala.jugadores.find((j: any) => (j.nombre || '').toLowerCase() === trimmedNombreLower);
          if (!jugador) {
            jugador = { nombre: trimmedNombre, esAdmin: true, puntuacion: 0, equipoId };
            sala.jugadores = Array.isArray(sala.jugadores) ? sala.jugadores : [];
            sala.jugadores.push(jugador);
          } else {
            jugador.esAdmin = true;
            if (equipoId) jugador.equipoId = equipoId;
          }
          sala.updatedAt = Date.now();
          return { salasActivas: salas };
        });

        if (newState) {
          const sala = this.obtenerSalaPorCodigo(upCode);
          if (sala) {
            return { sala, success: true };
          }
        }
      } catch (e) {
        console.warn('[SalaService] Error en transacción unirComoAdmin:', e);
      }
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return { success: false, error: 'Sala no encontrada' };

    let jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === trimmedNombreLower);
    if (!jugador) {
      jugador = { nombre: trimmedNombre, esAdmin: true, puntuacion: 0, equipoId };
      sala.jugadores.push(jugador);
    } else {
      jugador.esAdmin = true;
      if (equipoId) jugador.equipoId = equipoId;
    }

    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return { sala, success: true };
  }

  cambiarEquipoJugador(codigo: string, nombreJugador: string, nuevoEquipoId: string): boolean {
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
    if (!sala) return false;
    const jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase());
    if (!jugador) return false;
    jugador.equipoId = nuevoEquipoId;
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  removePlayer(codigo: string, nombreJugador: string): boolean {
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
    if (!sala) return false;
    const idx = sala.jugadores.findIndex(j => j.nombre.toLowerCase() === nombreJugador.trim().toLowerCase());
    if (idx === -1) return false;
    sala.jugadores.splice(idx, 1);
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  // reiniciar sala para nueva partida: limpiar historial, resetear puntuaciones, rondas y producto
  reiniciarSala(codigo: string) {
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
    if (!sala) return false;
    sala.historialRondas = [];
    sala.rondaActual = 0;
    sala.productoActual = null;
    sala.lastResults = null;
    sala.estadoPalabras = null;
    sala.estadoSubasta = null;
    // Las palabras ya jugadas se conservan para que no se repitan en esta sala
    sala.estadoCodigoSecreto = sala.tipoJuego === 'codigo-secreto'
      ? this.estadoCodigoInicial(sala.estadoCodigoSecreto?.palabrasUsadas || [])
      : null;
    sala.jugadores.forEach(j => { j.puntuacion = 0; delete j.apuesta; });
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  eliminarSala(codigo: string) {
    const salas = this.readAll();
    const idx = salas.findIndex(s => s.codigo === (codigo || '').toUpperCase());
    if (idx === -1) return false;
    salas.splice(idx, 1);
    this.writeAll(salas);
    return true;
  }

  // elimina salas inactivas creadas o sin actualización hace más de `days` días
  eliminarSalasInactivas(days = 1): number {
    const salas = this.readAll();
    const now = Date.now();
    const cutoff = days * 24 * 60 * 60 * 1000;
    const inicial = salas.length;
    const filtradas = salas.filter(s => {
      const last = s.updatedAt ?? s.createdAt ?? 0;
      // keep salas with no timestamp (conservativa) or recently actualizado
      if (!last) return true;
      return (now - last) <= cutoff;
    });
    const eliminadas = inicial - filtradas.length;
    if (eliminadas > 0) this.writeAll(filtradas);
    return eliminadas;
  }

  // preview helper
  previewEliminarSalasInactivas(days = 1) {
    const salas = this.readAll();
    const now = Date.now();
    const cutoff = days * 24 * 60 * 60 * 1000;
    const removed: any[] = [];
    const kept: any[] = [];
    salas.forEach(s => {
      const last = s.updatedAt ?? s.createdAt ?? 0;
      if (!last) { kept.push(s); return; }
      if ((now - last) > cutoff) removed.push(s); else kept.push(s);
    });
    return { eliminadas: removed.length, removedCodes: removed.map(r => r.codigo), removed, kept };
  }

  actualizarProductoObjeto(codigo: string, producto: any) {
    const upCode = (codigo || '').toUpperCase();
    const pid = productoidOrNull(producto?.id ?? producto?.idProducto ?? null);

    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        sala.productoActual = producto;
        sala.productoActualId = pid;
        // Limpiar apuestas de los jugadores para el nuevo producto
        if (Array.isArray(sala.jugadores)) {
          sala.jugadores.forEach(j => { delete j.apuesta; });
        }
        sala.lastResults = null;
        sala.updatedAt = Date.now();
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    sala.productoActual = producto;
    sala.productoActualId = pid;
    if (Array.isArray(sala.jugadores)) {
      sala.jugadores.forEach(j => { delete j.apuesta; });
    }
    sala.lastResults = null;
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  actualizarProductoActual(codigo: string, productoId: number) {
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
    if (!sala) return false;
    sala.productoActualId = productoidOrNull(productoId);
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  actualizarPuntuacion(codigo: string, nombreJugador: string, delta: number) {
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === (codigo || '').toUpperCase());
    if (!sala) return false;
    const jugador = sala.jugadores.find(j => j.nombre === nombreJugador);
    if (!jugador) return false;
    jugador.puntuacion = (jugador.puntuacion || 0) + delta;
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  async setApuesta(codigo: string, nombreJugador: string, apuesta: number): Promise<boolean> {
    const upCode = (codigo || '').toUpperCase();
    const cleanNombre = nombreJugador.trim();
    const cleanNombreLower = cleanNombre.toLowerCase();
    const cleanApuesta = Number(apuesta);

    // 1. If Firebase available, perform atomic transaction directly on the room
    if (this.useFirebase && this.firebaseDb) {
      let retries = 3;
      while (retries > 0) {
        try {
          const newState = await this.applyTransaction((state) => {
            const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
            const sala = salas.find(s => s.codigo === upCode);
            if (!sala) return null;
            sala.jugadores = Array.isArray(sala.jugadores) ? sala.jugadores : [];
            const jugador = sala.jugadores.find((j: any) => (j.nombre || '').toLowerCase() === cleanNombreLower);
            if (!jugador) return null;
            jugador.apuesta = cleanApuesta;
            sala.updatedAt = Date.now();
            return { salasActivas: salas };
          });

          if (newState) {
            const sala = (newState.salasActivas || []).find(s => s.codigo === upCode);
            const jugador = sala?.jugadores?.find((j: any) => (j.nombre || '').toLowerCase() === cleanNombreLower);
            if (jugador && typeof jugador.apuesta !== 'undefined') {
              return true;
            }
          }
        } catch (e) {
          console.warn('[SalaService] Error en setApuesta transaction, reintentando...', e);
        }
        retries--;
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 60 + Math.random() * 80));
        }
      }
    }

    // 2. fallback: local-only flow
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    const jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === cleanNombreLower);
    if (!jugador) return false;
    jugador.apuesta = cleanApuesta;
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  async calcularPuntuacionesRonda(codigo: string): Promise<{ nombre: string; puntos: number; delta: number; apuesta?: number }[] | null> {
    const upCode = (codigo || '').toUpperCase();
    // If Firebase available, perform atomic transaction so scores/history/lastResults update atomically
    if (this.useFirebase && this.firebaseDb) {
      const newState = await this.applyTransaction((state) => {
        const salas = Array.isArray(state.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        const precioReal = Number(sala.productoActual?.precio ?? sala.productoActual?.price ?? sala.productoActual?.unit_price);
        if (!precioReal || isNaN(precioReal)) return null;

        const jugadoresConApuesta = (sala.jugadores || []).map((j: any) => ({ nombre: j.nombre, apuesta: Number(j.apuesta ?? NaN), puntuacion: j.puntuacion || 0 })).filter((j: any) => !isNaN(j.apuesta));
        if (jugadoresConApuesta.length === 0) {
          // still update timestamps
          sala.updatedAt = Date.now();
          return { salasActivas: salas };
        }
        const resultados = jugadoresConApuesta.map((j: any) => ({ nombre: j.nombre, delta: Math.abs(j.apuesta - precioReal), apuesta: j.apuesta }));
        resultados.sort((a: any, b: any) => a.delta - b.delta);
        const puntosPorPos = [10, 7, 5];
        const asignaciones: any[] = [];
        let idx = 0;
        while (idx < resultados.length) {
          const currentDelta = resultados[idx].delta;
          let j = idx + 1;
          while (j < resultados.length && resultados[j].delta === currentDelta) j++;
          const basePuntos = idx < puntosPorPos.length ? puntosPorPos[idx] : 3;
          for (let k = idx; k < j; k++) {
            const apuestaVal = resultados[k].apuesta;
            const exactBonus = (typeof apuestaVal === 'number' && apuestaVal === precioReal) ? 5 : 0;
            const puntos = basePuntos + exactBonus;
            asignaciones.push({ nombre: resultados[k].nombre, puntos, delta: resultados[k].delta, apuesta: resultados[k].apuesta });
            const jugador = sala.jugadores.find((p: any) => p.nombre === resultados[k].nombre);
            if (jugador) jugador.puntuacion = (jugador.puntuacion || 0) + puntos;
          }
          idx = j;
        }
        if (!sala.historialRondas) sala.historialRondas = [];
        sala.historialRondas.push({ ronda: sala.rondaActual ?? 0, producto: sala.productoActual ? { ...sala.productoActual } : undefined, resultados: asignaciones.map(a => ({ nombre: a.nombre, puntos: a.puntos, delta: a.delta, apuesta: a.apuesta })), ts: Date.now() });
        sala.lastResults = { ts: Date.now(), price: precioReal, results: asignaciones.map(a => ({ nombre: a.nombre, puntos: a.puntos, delta: a.delta, apuesta: a.apuesta })) };
        sala.updatedAt = Date.now();
        return { salasActivas: salas };
      });
      if (!newState) return null;
      const sala = (newState.salasActivas || []).find(s => s.codigo === upCode);
      return sala?.lastResults?.results || [];
    }
    // fallback local flow
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return null;
    const precioReal = Number(sala.productoActual?.precio ?? sala.productoActual?.price ?? sala.productoActual?.unit_price);
    if (!precioReal || isNaN(precioReal)) return null;
    const jugadoresConApuesta = sala.jugadores.map(j => ({ nombre: j.nombre, apuesta: Number(j.apuesta ?? NaN), puntuacion: j.puntuacion || 0 })).filter(j => !isNaN(j.apuesta));
    if (jugadoresConApuesta.length === 0) return [];
    const resultados = jugadoresConApuesta.map(j => ({ nombre: j.nombre, delta: Math.abs(j.apuesta - precioReal), apuesta: j.apuesta }));
    resultados.sort((a, b) => a.delta - b.delta);
    const puntosPorPos = [10, 7, 5];
    const asignaciones: { nombre: string; puntos: number; delta: number; apuesta?: number }[] = [];
    let idx = 0;
    while (idx < resultados.length) {
      const currentDelta = resultados[idx].delta;
      let j = idx + 1;
      while (j < resultados.length && resultados[j].delta === currentDelta) j++;
      const basePuntos = idx < puntosPorPos.length ? puntosPorPos[idx] : 3;
      for (let k = idx; k < j; k++) {
        const apuestaVal = resultados[k].apuesta;
        const exactBonus = (typeof apuestaVal === 'number' && apuestaVal === precioReal) ? 5 : 0;
        const puntos = basePuntos + exactBonus;
        asignaciones.push({ nombre: resultados[k].nombre, puntos, delta: resultados[k].delta, apuesta: resultados[k].apuesta });
        const jugador = sala.jugadores.find(p => p.nombre === resultados[k].nombre);
        if (jugador) jugador.puntuacion = (jugador.puntuacion || 0) + puntos;
      }
      idx = j;
    }
    if (!sala.historialRondas) sala.historialRondas = [];
    sala.historialRondas.push({ ronda: sala.rondaActual ?? 0, producto: sala.productoActual ? { ...sala.productoActual } : undefined, resultados: asignaciones.map(a => ({ nombre: a.nombre, puntos: a.puntos, delta: a.delta, apuesta: a.apuesta })), ts: Date.now() });
    sala.lastResults = { ts: Date.now(), price: precioReal, results: asignaciones.map(a => ({ nombre: a.nombre, puntos: a.puntos, delta: a.delta, apuesta: a.apuesta })) };
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return asignaciones;
  }

  clearApuestas(codigo: string) {
    const upCode = (codigo || '').toUpperCase();
    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        if (Array.isArray(sala.jugadores)) {
          sala.jugadores.forEach(j => { delete j.apuesta; });
        }
        sala.updatedAt = Date.now();
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    sala.jugadores.forEach(j => delete j.apuesta);
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  // elimina lastResults del estado para que el modal deje de mostrarse en todos los clientes
  clearLastResults(codigo: string) {
    const upCode = (codigo || '').toUpperCase();
    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        sala.lastResults = null;
        sala.updatedAt = Date.now();
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    sala.lastResults = null;
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  avanzarRonda(codigo: string) {
    const upCode = (codigo || '').toUpperCase();
    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        sala.rondaActual = (sala.rondaActual || 0) + 1;
        if ((sala.rondaActual || 0) >= (sala.rondasTotales || 10)) sala.estado = 'finalizada';
        if (Array.isArray(sala.jugadores)) {
          sala.jugadores.forEach(j => { delete j.apuesta; });
        }
        sala.lastResults = null;
        sala.updatedAt = Date.now();
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    sala.rondaActual = (sala.rondaActual || 0) + 1;
    if ((sala.rondaActual || 0) >= (sala.rondasTotales || 10)) sala.estado = 'finalizada';
    if (Array.isArray(sala.jugadores)) {
      sala.jugadores.forEach(j => { delete j.apuesta; });
    }
    sala.lastResults = null;
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  // ==========================================
  // GESTIÓN DE EQUIPOS EN VIVO (Admin)
  // ==========================================
  agregarEquipoASala(codigo: string, nombreEquipo: string): boolean {
    const upCode = (codigo || '').toUpperCase();
    const cleanNombre = (nombreEquipo || '').trim();
    if (!cleanNombre) return false;

    const mutator = (s: Sala) => {
      s.equipos = Array.isArray(s.equipos) ? s.equipos : [];
      const id = 'eq_' + Math.random().toString(36).slice(2, 7);
      s.equipos.push({ id, nombre: cleanNombre });
      s.updatedAt = Date.now();
    };

    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        mutator(sala);
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    mutator(sala);
    this.writeAll(salas);
    return true;
  }

  eliminarEquipoDeSala(codigo: string, equipoId: string): boolean {
    const upCode = (codigo || '').toUpperCase();
    const mutator = (s: Sala): boolean => {
      if (!Array.isArray(s.equipos)) return false;
      // No permitir si hay jugadores asignados a ese equipo
      const hasPlayers = (s.jugadores || []).some(j => j.equipoId === equipoId);
      if (hasPlayers) return false;
      const idx = s.equipos.findIndex(e => e.id === equipoId);
      if (idx === -1) return false;
      s.equipos.splice(idx, 1);
      s.updatedAt = Date.now();
      return true;
    };

    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        const ok = mutator(sala);
        return ok ? { salasActivas: salas } : null;
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    const ok = mutator(sala);
    if (ok) this.writeAll(salas);
    return ok;
  }

  // ==========================================
  // JUEGO: LA PALABRA MÁS LARGA (Cifras y Letras)
  // ==========================================

  async iniciarRondaPalabras(codigo: string, letras: string[], tiempoSegundos = 45, modoPuntuacion: ModoPuntuacionPalabras = 'por_letras', dificultad: DificultadPalabras = 'facil') {
    const upCode = (codigo || '').toUpperCase();
    const now = Date.now();
    const tiempoFin = now + (tiempoSegundos * 1000);

    const nuevoEstado: EstadoPalabraMasLarga = {
      fase: 'jugando',
      letras: letras.map(l => l.toUpperCase()),
      numLetras: letras.length,
      tiempoLimite: tiempoSegundos,
      tiempoFin,
      dificultad,
      palabrasAportadas: [],
      selecciones: {},
      modoPuntuacion
    };

    if (this.useFirebase && this.firebaseDb) {
      await this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        sala.estadoPalabras = nuevoEstado;
        sala.updatedAt = Date.now();
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    sala.estadoPalabras = nuevoEstado;
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  actualizarConfigPalabras(codigo: string, config: { dificultad: DificultadPalabras; numLetras: number; tiempoSegundos: number }) {
    const upCode = (codigo || '').toUpperCase();
    const mutator = (s: Sala) => {
      if (!s.estadoPalabras) {
        s.estadoPalabras = {
          fase: 'esperando',
          letras: [],
          numLetras: config.numLetras,
          tiempoLimite: config.tiempoSegundos,
          dificultad: config.dificultad,
          palabrasAportadas: [],
          selecciones: {},
          modoPuntuacion: 'por_letras'
        };
      } else {
        // Preservar la fase actual si ya estaba jugando/seleccion/etc.
        s.estadoPalabras.dificultad = config.dificultad;
        s.estadoPalabras.numLetras = config.numLetras;
        s.estadoPalabras.tiempoLimite = config.tiempoSegundos;
      }
      s.updatedAt = Date.now();
    };

    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        mutator(sala);
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    mutator(sala);
    this.writeAll(salas);
    return true;
  }

  cambiarModoPuntuacionPalabras(codigo: string, modo: ModoPuntuacionPalabras) {
    const upCode = (codigo || '').toUpperCase();
    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala || !sala.estadoPalabras) return null;
        sala.estadoPalabras.modoPuntuacion = modo;
        sala.updatedAt = Date.now();
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala || !sala.estadoPalabras) return false;
    sala.estadoPalabras.modoPuntuacion = modo;
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  async pasarAFaseSeleccionPalabras(codigo: string) {
    const upCode = (codigo || '').toUpperCase();
    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala || !sala.estadoPalabras) return null;
        if (sala.estadoPalabras.fase === 'jugando') {
          sala.estadoPalabras.fase = 'seleccion';
          sala.updatedAt = Date.now();
        }
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala || !sala.estadoPalabras) return false;
    if (sala.estadoPalabras.fase === 'jugando') {
      sala.estadoPalabras.fase = 'seleccion';
      sala.updatedAt = Date.now();
      this.writeAll(salas);
    }
    return true;
  }

  async enviarPalabraJugador(codigo: string, jugadorNombre: string, equipoId: string | undefined, palabra: string): Promise<boolean> {
    const upCode = (codigo || '').toUpperCase();
    const cleanPalabra = (palabra || '').trim().toUpperCase();
    if (!cleanPalabra) return false;

    const mutator = (sala: Sala): boolean => {
      if (!sala.estadoPalabras || (sala.estadoPalabras.fase !== 'jugando' && sala.estadoPalabras.fase !== 'esperando')) return false;
      if (!Array.isArray(sala.estadoPalabras.palabrasAportadas)) {
        sala.estadoPalabras.palabrasAportadas = [];
      }
      const yaExiste = sala.estadoPalabras.palabrasAportadas.some(
        p => p.palabra === cleanPalabra && p.jugador.toLowerCase() === jugadorNombre.toLowerCase()
      );
      if (yaExiste) return false;

      sala.estadoPalabras.palabrasAportadas.push({
        jugador: jugadorNombre,
        equipoId: equipoId || null,  // Firebase rechaza undefined, usar null
        palabra: cleanPalabra,
        longitud: cleanPalabra.length,
        ts: Date.now()
      });
      sala.updatedAt = Date.now();
      return true;
    };

    if (this.useFirebase && this.firebaseDb) {
      const res = await this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        const ok = mutator(sala);
        return ok ? { salasActivas: salas } : null;
      });
      return !!res;
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    const ok = mutator(sala);
    if (ok) this.writeAll(salas);
    return ok;
  }

  async seleccionarPalabraEquipo(codigo: string, claveGrupo: string, nombreEquipo: string, palabra: string, seleccionador: string): Promise<boolean> {
    const upCode = (codigo || '').toUpperCase();
    const cleanPalabra = (palabra || '').trim().toUpperCase();

    const mutator = (sala: Sala): boolean => {
      if (!sala.estadoPalabras) return false;
      if (!sala.estadoPalabras.selecciones) sala.estadoPalabras.selecciones = {};

      sala.estadoPalabras.selecciones[claveGrupo] = {
        equipoId: claveGrupo,
        nombreEquipo,
        palabra: cleanPalabra,
        longitud: cleanPalabra.length,
        seleccionadaPor: seleccionador,
        descartada: false
      };

      // Si todos los grupos esperados ya tienen selección, pasar automáticamente a revelación
      const gruposEsperados = sala.modoJuego === 'individual'
        ? (sala.jugadores || []).map(j => j.nombre)
        : (sala.equipos || []).map(e => e.id);

      const todasListas = gruposEsperados.length > 0 && gruposEsperados.every(gId => !!sala.estadoPalabras?.selecciones[gId]);
      if (todasListas) {
        sala.estadoPalabras.fase = 'revelacion';
      }

      sala.updatedAt = Date.now();
      return true;
    };

    if (this.useFirebase && this.firebaseDb) {
      const res = await this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        const ok = mutator(sala);
        return ok ? { salasActivas: salas } : null;
      });
      return !!res;
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    const ok = mutator(sala);
    if (ok) this.writeAll(salas);
    return ok;
  }

  toggleDescartePalabraAdmin(codigo: string, claveGrupo: string): boolean {
    const upCode = (codigo || '').toUpperCase();
    const mutator = (sala: Sala): boolean => {
      if (!sala.estadoPalabras?.selecciones?.[claveGrupo]) return false;
      const cur = sala.estadoPalabras.selecciones[claveGrupo];
      cur.descartada = !cur.descartada;
      sala.updatedAt = Date.now();
      return true;
    };

    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        const ok = mutator(sala);
        return ok ? { salasActivas: salas } : null;
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    const ok = mutator(sala);
    if (ok) this.writeAll(salas);
    return ok;
  }

  async pasarARevelacionManual(codigo: string): Promise<boolean> {
    const upCode = (codigo || '').toUpperCase();
    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala || !sala.estadoPalabras) return null;
        sala.estadoPalabras.fase = 'revelacion';
        sala.updatedAt = Date.now();
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala || !sala.estadoPalabras) return false;
    sala.estadoPalabras.fase = 'revelacion';
    sala.updatedAt = Date.now();
    this.writeAll(salas);
    return true;
  }

  async entregarPuntosPalabras(codigo: string): Promise<{ ganadores: string[]; puntos: number } | null> {
    const upCode = (codigo || '').toUpperCase();

    const calcular = (sala: Sala): { ganadores: string[]; puntos: number } | null => {
      if (!sala.estadoPalabras || !sala.estadoPalabras.selecciones) return null;
      const seleccionesValidas = Object.entries(sala.estadoPalabras.selecciones)
        .map(([id, s]) => ({ id, ...s }))
        .filter(s => !s.descartada && s.palabra && s.longitud > 0);

      if (seleccionesValidas.length === 0) {
        // Todas descartadas o nadie eligió
        return { ganadores: [], puntos: 0 };
      }

      // Ordenar por longitud descendente para conocer a los ganadores de la ronda
      seleccionesValidas.sort((a, b) => b.longitud - a.longitud);
      const maxLen = seleccionesValidas[0].longitud;
      const ganadoresEmpatados = seleccionesValidas.filter(s => s.longitud === maxLen);

      const modo = sala.estadoPalabras.modoPuntuacion || 'por_letras';

      // Asignar puntos a cada grupo/jugador con palabra válida (no invalidada)
      // En modo 'por_letras', cada equipo/jugador suma el número de letras de su palabra válida.
      // En modo 'por_ganar', solo el/los ganadores reciben 10 puntos (o sus letras).
      if (sala.modoJuego === 'individual') {
        seleccionesValidas.forEach(sel => {
          const pts = modo === 'por_letras' ? sel.longitud : (sel.longitud === maxLen ? 10 : 0);
          if (pts > 0) {
            const j = sala.jugadores.find(jug => jug.nombre === sel.id);
            if (j) j.puntuacion = (j.puntuacion || 0) + pts;
          }
        });
      } else {
        // Sumar puntos a todos los jugadores que pertenezcan a los equipos con palabras válidas
        seleccionesValidas.forEach(sel => {
          const pts = modo === 'por_letras' ? sel.longitud : (sel.longitud === maxLen ? 10 : 0);
          if (pts > 0) {
            sala.jugadores.forEach(j => {
              if (j.equipoId && j.equipoId === sel.id) {
                j.puntuacion = (j.puntuacion || 0) + pts;
              }
            });
          }
        });
      }

      sala.updatedAt = Date.now();
      return {
        ganadores: ganadoresEmpatados.map(g => g.nombreEquipo || g.id),
        puntos: modo === 'por_letras' ? maxLen : 10
      };
    };

    if (this.useFirebase && this.firebaseDb) {
      this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        calcular(sala);
        return { salasActivas: salas };
      });
    }

    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return null;
    const res = calcular(sala);
    this.writeAll(salas);
    return res;
  }

  // ==========================================
  // JUEGO: LA SUBASTA DE RESPUESTAS
  // ==========================================

  /** Clave normalizada para deduplicar respuestas (sin tildes, minúsculas, espacios colapsados). */
  claveRespuesta(texto: string): string {
    return (texto || '').trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /** Aplica una mutación a la sala: transacción en Firebase o escritura local. Devuelve si se aplicó. */
  private async mutarSala(codigo: string, mutator: (sala: Sala) => boolean): Promise<boolean> {
    const upCode = (codigo || '').toUpperCase();
    if (this.useFirebase && this.firebaseDb) {
      let aplicado = false;
      await this.applyTransaction((state) => {
        const salas = Array.isArray(state?.salasActivas) ? state.salasActivas : [];
        const sala = salas.find(s => s.codigo === upCode);
        if (!sala) return null;
        aplicado = mutator(sala);
        return aplicado ? { salasActivas: salas } : null;
      });
      return aplicado;
    }
    const salas = this.readAll();
    const sala = salas.find(s => s.codigo === upCode);
    if (!sala) return false;
    const ok = mutator(sala);
    if (ok) this.writeAll(salas);
    return ok;
  }

  async iniciarRondaSubasta(
    codigo: string,
    cat: { id: string; categoria: string; descripcion?: string },
    tiempoSegundos: number,
    dificultad: DificultadPalabras,
    categoriasUsadas: string[]
  ): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      sala.estadoSubasta = {
        fase: 'respondiendo',
        dificultad,
        categoriaId: cat.id,
        categoria: cat.categoria,
        descripcion: cat.descripcion || null,
        tiempoLimite: tiempoSegundos,
        tiempoFin: Date.now() + tiempoSegundos * 1000,
        puntosPorRespuesta: dificultad === 'dificil' ? 2 : 1,
        puntosEntregados: false,
        categoriasUsadas,
        respuestasAportadas: [],
        selecciones: {}
      };
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Descarta la categoría actual sin contar como usada, y carga una nueva con el tiempo reiniciado. */
  async descartarCategoriaSubasta(
    codigo: string,
    cat: { id: string; categoria: string; descripcion?: string },
    tiempoSegundos: number,
    dificultad: DificultadPalabras,
    categoriasUsadas: string[]  // NO incluye la actual (que se rechaza)
  ): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = sala.estadoSubasta;
      if (!est || est.fase !== 'esperando') return false;
      // Recargar con nueva categoría, reiniciando tiempo y respuestas
      est.fase = 'esperando';  // Mantener en esperando
      est.categoriaId = cat.id;
      est.categoria = cat.categoria;
      est.descripcion = cat.descripcion || null;
      est.tiempoFin = undefined;  // Reiniciar tiempo
      est.respuestasAportadas = [];
      est.selecciones = {};
      est.puntosEntregados = false;
      est.categoriasUsadas = categoriasUsadas;  // Sin la anterior
      sala.updatedAt = Date.now();
      return true;
    });
  }

  actualizarConfigSubasta(codigo: string, config: { dificultad: DificultadPalabras; tiempoSegundos: number }): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      if (!sala.estadoSubasta) {
        sala.estadoSubasta = {
          fase: 'esperando',
          dificultad: config.dificultad,
          tiempoLimite: config.tiempoSegundos,
          puntosPorRespuesta: config.dificultad === 'dificil' ? 2 : 1
        };
      } else {
        sala.estadoSubasta.dificultad = config.dificultad;
        sala.estadoSubasta.tiempoLimite = config.tiempoSegundos;
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async enviarRespuestaSubasta(codigo: string, jugador: string, equipoId: string | undefined, texto: string): Promise<boolean> {
    const clave = this.claveRespuesta(texto);
    if (!clave) return false;
    return this.mutarSala(codigo, (sala) => {
      const est = sala.estadoSubasta;
      if (!est || est.fase !== 'respondiendo') return false;
      est.respuestasAportadas = est.respuestasAportadas || [];
      const repetida = est.respuestasAportadas.some(
        r => r.clave === clave && r.jugador.toLowerCase() === jugador.toLowerCase()
      );
      if (repetida) return false;
      est.respuestasAportadas.push({
        jugador,
        equipoId: equipoId || null,
        respuesta: texto.trim().replace(/\s+/g, ' '),
        clave,
        ts: Date.now()
      });
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async pasarASeleccionSubasta(codigo: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = sala.estadoSubasta;
      if (!est || est.fase !== 'respondiendo') return false;
      est.fase = 'seleccion';
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async pasarARevelacionSubasta(codigo: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = sala.estadoSubasta;
      if (!est || (est.fase !== 'respondiendo' && est.fase !== 'seleccion')) return false;
      est.fase = 'revelacion';
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Añade o quita una respuesta de la selección del grupo (mientras no esté confirmada). */
  async toggleEleccionSubasta(codigo: string, grupoId: string, nombreGrupo: string, texto: string, usuario: string): Promise<boolean> {
    const clave = this.claveRespuesta(texto);
    if (!clave) return false;
    return this.mutarSala(codigo, (sala) => {
      const est = sala.estadoSubasta;
      if (!est || est.fase !== 'seleccion') return false;
      est.selecciones = est.selecciones || {};
      const sel = est.selecciones[grupoId] || {
        grupoId, nombreGrupo, elegidas: [], invalidas: [], confirmada: false, seleccionadaPor: usuario
      };
      if (sel.confirmada) return false;
      sel.elegidas = sel.elegidas || [];
      const idx = sel.elegidas.findIndex(e => e.clave === clave);
      if (idx >= 0) sel.elegidas.splice(idx, 1);
      else sel.elegidas.push({ clave, texto: texto.trim().replace(/\s+/g, ' ') });
      sel.seleccionadaPor = usuario;
      est.selecciones[grupoId] = sel;
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** El grupo da por cerrada su selección. Cuando todos confirman, pasa a revelación. */
  async confirmarSeleccionSubasta(codigo: string, grupoId: string, nombreGrupo: string, usuario: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = sala.estadoSubasta;
      if (!est || est.fase !== 'seleccion') return false;
      est.selecciones = est.selecciones || {};
      const sel = est.selecciones[grupoId] || {
        grupoId, nombreGrupo, elegidas: [], invalidas: [], confirmada: false, seleccionadaPor: usuario
      };
      sel.confirmada = true;
      sel.seleccionadaPor = usuario;
      est.selecciones[grupoId] = sel;

      const gruposEsperados = sala.modoJuego === 'individual'
        ? (sala.jugadores || []).map(j => j.nombre)
        : (sala.equipos || []).map(e => e.id);
      const sels = est.selecciones;
      const todosConfirmados = gruposEsperados.length > 0 && gruposEsperados.every(g => !!sels[g]?.confirmada);
      if (todosConfirmados) est.fase = 'revelacion';

      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Árbitro: marca o desmarca una respuesta presentada como inválida. */
  async toggleInvalidaSubasta(codigo: string, grupoId: string, clave: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = sala.estadoSubasta;
      if (!est || est.puntosEntregados) return false;
      const sel = est.selecciones?.[grupoId];
      if (!sel) return false;
      sel.invalidas = sel.invalidas || [];
      const idx = sel.invalidas.indexOf(clave);
      if (idx >= 0) sel.invalidas.splice(idx, 1);
      else sel.invalidas.push(clave);
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Suma puntos: 1 (o 2 en difícil) por cada respuesta válida presentada. Solo una vez por ronda. */
  async entregarPuntosSubasta(codigo: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = sala.estadoSubasta;
      if (!est || est.puntosEntregados) return false;
      const pts = est.puntosPorRespuesta || 1;

      Object.values(est.selecciones || {}).forEach(sel => {
        const invalidas = new Set(sel.invalidas || []);
        const validas = (sel.elegidas || []).filter(e => !invalidas.has(e.clave)).length;
        const total = validas * pts;
        if (total <= 0) return;

        if (sala.modoJuego === 'individual') {
          const j = sala.jugadores.find(x => x.nombre === sel.grupoId);
          if (j) j.puntuacion = (j.puntuacion || 0) + total;
        } else {
          sala.jugadores.forEach(j => {
            if (j.equipoId && j.equipoId === sel.grupoId) j.puntuacion = (j.puntuacion || 0) + total;
          });
        }
      });

      est.puntosEntregados = true;
      sala.updatedAt = Date.now();
      return true;
    });
  }

  // ==========================================
  // JUEGO: EL CÓDIGO SECRETO (2 equipos + capitanes)
  // ==========================================

  private estadoCodigoInicial(palabrasUsadas: string[]): EstadoCodigoSecreto {
    return {
      fase: 'esperando',
      casillas: [],
      equipoInicialId: '',
      turnoEquipoId: '',
      capitanes: {},
      pista: null,
      palabrasUsadas,
      ganadorEquipoId: null,
      motivoFin: null
    };
  }

  /** Garantiza que el estado existe con sus campos. Firebase elimina arrays, objetos y nulls vacíos. */
  private asegurarEstadoCodigo(sala: Sala): EstadoCodigoSecreto {
    if (!sala.estadoCodigoSecreto) sala.estadoCodigoSecreto = this.estadoCodigoInicial([]);
    const est = sala.estadoCodigoSecreto;
    est.casillas = est.casillas || [];
    est.capitanes = est.capitanes || {};
    est.palabrasUsadas = est.palabrasUsadas || [];
    return est;
  }

  private idsEquiposCodigo(sala: Sala): string[] {
    return (sala.equipos || []).slice(0, 2).map(e => e.id);
  }

  private barajar<T>(lista: T[]): T[] {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Devuelve el equipo que ya ha descubierto todas sus casillas, o null. */
  private comprobarGanadorCodigo(est: EstadoCodigoSecreto, equipos: string[]): string | null {
    for (const id of equipos) {
      const restantes = est.casillas.filter(c => c.bando === id && !c.descubierta).length;
      if (restantes === 0) return id;
    }
    return null;
  }

  private terminarCodigo(est: EstadoCodigoSecreto, ganadorId: string, motivo: 'todas_descubiertas' | 'negra'): void {
    est.fase = 'terminado';
    est.ganadorEquipoId = ganadorId;
    est.motivoFin = motivo;
    est.pista = null;
  }

  private pasarTurnoCodigo(est: EstadoCodigoSecreto, nuevoEquipoId: string): void {
    est.turnoEquipoId = nuevoEquipoId;
    est.pista = null;
  }

  /** Admin: asigna el capitán de cada equipo. Solo antes de empezar la partida. */
  async asignarCapitanesCodigo(codigo: string, capitanes: Record<string, string>): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoCodigo(sala);
      if (est.fase !== 'esperando') return false;
      const equipos = this.idsEquiposCodigo(sala);
      if (equipos.length !== 2) return false;
      const limpio: Record<string, string> = {};
      equipos.forEach(id => { if (capitanes[id]) limpio[id] = capitanes[id]; });
      est.capitanes = limpio;
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Admin: arranca la partida con 25 palabras aleatorias que no se hayan usado antes en esta sala. */
  async iniciarPartidaCodigo(codigo: string, catalogo: { id: string; palabra: string }[]): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoCodigo(sala);
      const equipos = this.idsEquiposCodigo(sala);
      if (est.fase !== 'esperando' || equipos.length !== 2) return false;
      if (!equipos.every(id => !!est.capitanes[id])) return false;

      const usadas = new Set(est.palabrasUsadas);
      const pool = this.barajar(catalogo.filter(p => !usadas.has(p.id)));
      if (pool.length < 25) return false;
      const elegidas = pool.slice(0, 25);

      // Equipo inicial: 9 casillas. El otro: 8. Además 7 neutras y 1 negra.
      const inicial = equipos[Math.floor(Math.random() * 2)];
      const otro = equipos.find(id => id !== inicial) as string;
      const bandos: string[] = [
        ...Array(9).fill(inicial),
        ...Array(8).fill(otro),
        ...Array(7).fill('neutra'),
        'negra'
      ];
      const bandosBarajados = this.barajar(bandos);

      est.casillas = elegidas.map((p, i) => ({
        idPalabra: p.id,
        palabra: p.palabra,
        bando: bandosBarajados[i],
        descubierta: false
      }));
      est.equipoInicialId = inicial;
      est.turnoEquipoId = inicial;
      est.pista = null;
      est.ganadorEquipoId = null;
      est.motivoFin = null;
      est.palabrasUsadas = [...est.palabrasUsadas, ...elegidas.map(p => p.id)];
      est.fase = 'jugando';
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Capitán del equipo en turno: da la pista (palabra y número). */
  async darPistaCodigo(codigo: string, usuario: string, texto: string, numero: number): Promise<boolean> {
    const limpio = (texto || '').trim().replace(/\s+/g, ' ');
    if (!limpio || numero < 0 || numero > 9) return false;
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoCodigo(sala);
      if (est.fase !== 'jugando' || est.pista) return false;
      if (est.capitanes[est.turnoEquipoId] !== usuario) return false;
      est.pista = {
        texto: limpio,
        numero,
        intentosRestantes: Math.max(1, numero),
        equipoId: est.turnoEquipoId
      };
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Miembro del equipo en turno (no capitán) toca una casilla. */
  async tocarCasillaCodigo(codigo: string, usuario: string, idPalabra: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoCodigo(sala);
      if (est.fase !== 'jugando' || !est.pista) return false;
      const equipoTurno = est.turnoEquipoId;
      const jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === usuario.toLowerCase());
      if (!jugador || jugador.equipoId !== equipoTurno) return false;
      if (Object.values(est.capitanes).includes(usuario)) return false;
      const casilla = est.casillas.find(c => c.idPalabra === idPalabra);
      if (!casilla || casilla.descubierta) return false;

      casilla.descubierta = true;
      est.pista.intentosRestantes -= 1;
      const equipos = this.idsEquiposCodigo(sala);
      const otro = equipos.find(id => id !== equipoTurno) as string;

      if (casilla.bando === 'negra') {
        this.terminarCodigo(est, otro, 'negra');
      } else {
        const ganadorPorCartas = this.comprobarGanadorCodigo(est, equipos);
        if (ganadorPorCartas) {
          this.terminarCodigo(est, ganadorPorCartas, 'todas_descubiertas');
        } else if (casilla.bando !== equipoTurno || est.pista.intentosRestantes <= 0) {
          this.pasarTurnoCodigo(est, otro);
        }
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  // ====================================================================
  // JUEGO: MINIJUEGOS POR EQUIPOS
  // ====================================================================

  private estadoInicialMinijuegos(): EstadoMinijuegos {
    return {
      fase: 'esperando', ronda: 1, totalRondas: 5, tiempoTurnoSeg: SEG_TURNO_DEFAULT, tiposRonda: [], equiposOrden: [],
      capitanes: {}, turno: null, resultados: [], puntos: {}, aciertosTotales: {}, ganadorEquipoId: null
    };
  }

  private asegurarEstadoMinijuegos(sala: Sala): EstadoMinijuegos {
    if (!sala.estadoMinijuegos) sala.estadoMinijuegos = this.estadoInicialMinijuegos();
    const est = sala.estadoMinijuegos;
    est.capitanes = est.capitanes || {};
    est.tiposRonda = est.tiposRonda || [];
    est.equiposOrden = est.equiposOrden || [];
    est.resultados = est.resultados || [];
    est.puntos = est.puntos || {};
    est.aciertosTotales = est.aciertosTotales || {};
    est.tiempoTurnoSeg = est.tiempoTurnoSeg || SEG_TURNO_DEFAULT;
    return est;
  }

  private miembrosDeEquipo(sala: Sala, equipoId: string): string[] {
    return sala.jugadores.filter(j => j.equipoId === equipoId).map(j => j.nombre);
  }

  private ayudantesDe(sala: Sala, est: EstadoMinijuegos, equipoId: string): number {
    const capitan = est.capitanes[equipoId];
    // Si el capitán es el único del equipo, él recibe todas las pistas
    return Math.max(1, this.miembrosDeEquipo(sala, equipoId).filter(n => n !== capitan).length);
  }

  private abrirTurnoMinijuego(sala: Sala, est: EstadoMinijuegos, equipoId: string): void {
    const tipo: TipoMinijuego = est.tiposRonda[est.ronda - 1];
    const p = generarPuzle(tipo, 1, this.ayudantesDe(sala, est, equipoId));
    const ahora = Date.now();
    est.turno = {
      equipoId, ronda: est.ronda, tipo, nivel: 1, panel: p.panel, pistas: p.pistas, solucion: p.solucion,
      aciertos: 0, errores: 0, inicioMs: ahora, finMs: Number.MAX_SAFE_INTEGER, iniciado: false
    };
    if (p.estadoInicial !== undefined) est.turno.estadoJ = JSON.stringify(p.estadoInicial);
  }

  /** Tras un acierto, sustituye el puzle por otro del siguiente nivel. */
  private siguientePuzleMinijuego(sala: Sala, est: EstadoMinijuegos): void {
    const t = est.turno!;
    const p = generarPuzle(t.tipo, t.nivel + 1, this.ayudantesDe(sala, est, t.equipoId));
    t.nivel += 1;
    t.panel = p.panel;
    t.pistas = p.pistas;
    t.solucion = p.solucion;
    t.recorrido = [];
    if (p.estadoInicial !== undefined) t.estadoJ = JSON.stringify(this.conTiempo(p.estadoInicial));
    else delete t.estadoJ;
  }

  private cerrarTurnoMinijuego(sala: Sala, est: EstadoMinijuegos): void {
    const t = est.turno!;
    est.resultados.push({ ronda: t.ronda, equipoId: t.equipoId, tipo: t.tipo, aciertos: t.aciertos, errores: t.errores });
    est.aciertosTotales[t.equipoId] = (est.aciertosTotales[t.equipoId] || 0) + t.aciertos;

    const equipos = est.equiposOrden;
    const delaRonda = est.resultados.filter(r => r.ronda === est.ronda);
    const pendiente = equipos.find(e => !delaRonda.some(r => r.equipoId === e));
    if (pendiente) {
      this.abrirTurnoMinijuego(sala, est, pendiente);
      return;
    }

    // Ronda completa: gana el equipo con más aciertos; si empatan, el de menos errores
    if (equipos.length === 1) {
      if (delaRonda[0].aciertos >= 1) est.puntos[equipos[0]] = (est.puntos[equipos[0]] || 0) + 1;
    } else {
      const [a, b] = [...delaRonda].sort((x, y) => (y.aciertos - x.aciertos) || (x.errores - y.errores));
      if (a.aciertos !== b.aciertos || a.errores !== b.errores) {
        est.puntos[a.equipoId] = (est.puntos[a.equipoId] || 0) + 1;
      }
    }

    if (est.ronda >= est.totalRondas) {
      est.fase = 'terminado';
      est.turno = null;
      this.determinarGanadorMinijuegos(est);
      return;
    }
    est.ronda += 1;
    // Empieza el equipo que no empezó la ronda anterior
    this.abrirTurnoMinijuego(sala, est, equipos[(est.ronda - 1) % equipos.length]);
  }

  private determinarGanadorMinijuegos(est: EstadoMinijuegos): void {
    const equipos = est.equiposOrden;
    const maxPuntos = Math.max(0, ...equipos.map(e => est.puntos[e] || 0));
    const empatados = equipos.filter(e => (est.puntos[e] || 0) === maxPuntos);
    if (empatados.length === 1) {
      est.ganadorEquipoId = empatados[0];
      return;
    }
    const [x, y] = [...empatados].sort((a, b) => (est.aciertosTotales[b] || 0) - (est.aciertosTotales[a] || 0));
    est.ganadorEquipoId = (est.aciertosTotales[x] || 0) === (est.aciertosTotales[y] || 0) ? null : x;
  }

  async asignarCapitanesMinijuegos(codigo: string, capitanes: Record<string, string>): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      if (est.fase !== 'esperando') return false;
      est.capitanes = { ...capitanes };
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async iniciarMinijuegos(codigo: string, capitanes: Record<string, string>, tiempoSeg: number, juegos: TipoMinijuego[]): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      if (est.fase !== 'esperando') return false;
      const equipos = (sala.equipos || []).filter(eq => this.miembrosDeEquipo(sala, eq.id).length > 0).map(eq => eq.id);
      // Cada equipo necesita un capitán que sea miembro de ese equipo
      const valido = equipos.length > 0 && equipos.every(id =>
        !!capitanes[id] && this.miembrosDeEquipo(sala, id).includes(capitanes[id]));
      if (!valido) return false;
      est.capitanes = { ...capitanes };
      est.equiposOrden = equipos;
      est.tiempoTurnoSeg = Math.min(300, Math.max(15, Math.round(tiempoSeg || SEG_TURNO_DEFAULT)));
      const elegidos = (juegos || []).filter(j => TIPOS_MINIJUEGO.includes(j));
      if (elegidos.length === 0) return false;
      est.tiposRonda = this.tiposParaRondas(elegidos, est.totalRondas);
      est.puntos = {};
      est.aciertosTotales = {};
      equipos.forEach(id => { est.puntos[id] = 0; est.aciertosTotales[id] = 0; });
      est.resultados = [];
      est.ronda = 1;
      est.ganadorEquipoId = null;
      est.fase = 'jugando';
      this.abrirTurnoMinijuego(sala, est, equipos[0]);
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Las rondas salen de los juegos marcados. Con 5 o más marcados no se repite ninguno; con menos, se repiten sin dos seguidos cuando se puede. */
  private tiposParaRondas(elegidos: TipoMinijuego[], rondas: number): TipoMinijuego[] {
    if (elegidos.length >= rondas) return barajar(elegidos).slice(0, rondas);
    const res: TipoMinijuego[] = [...barajar(elegidos)];
    while (res.length < rondas) {
      const ultimo = res[res.length - 1];
      const candidatos = elegidos.length > 1 ? elegidos.filter(t => t !== ultimo) : elegidos;
      res.push(barajar(candidatos)[0]);
    }
    return res.slice(0, rondas);
  }

  /** El capitán del equipo en turno (o el admin, como respaldo) pulsa Empezar: arranca el reloj del turno. */
  async empezarTurnoMinijuego(codigo: string, usuario: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || t.iniciado) return false;
      const esAdmin = !!sala.jugadores.find(j => j.nombre === usuario)?.esAdmin;
      if (est.capitanes[t.equipoId] !== usuario && !esAdmin) return false;
      t.iniciado = true;
      t.inicioMs = Date.now();
      t.finMs = t.inicioMs + est.tiempoTurnoSeg * 1000;
      if (t.tipo === 'reactor' && t.estadoJ) {
        const st = JSON.parse(t.estadoJ);
        if (st.t0 === null) { st.t0 = t.inicioMs; t.estadoJ = JSON.stringify(st); }
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Un ayudante gira uno de SUS controles del reactor. El capitán no toca controles. */
  async accionControlMinijuego(codigo: string, usuario: string, controlId: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || !t.iniciado || !t.estadoJ || t.tipo !== 'reactor') return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
        sala.updatedAt = Date.now();
        return true;
      }
      const capitan = est.capitanes[t.equipoId];
      const ayudantes = this.miembrosDeEquipo(sala, t.equipoId).filter(nombre => nombre !== capitan);
      const duenos = ayudantes.length ? ayudantes : [capitan];
      const owner = duenos.indexOf(usuario);
      if (owner < 0) return false;
      const res = aplicarControlReactor(JSON.parse(t.estadoJ), controlId, owner, Date.now());
      if (!res.ok) return false;
      t.estadoJ = JSON.stringify(res.estado);
      if (res.completado) {
        t.aciertos += 1;
        this.siguientePuzleMinijuego(sala, est);
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Solo en el reactor: las alertas aparecen respecto al momento en que empieza cada puzle. */
  private conTiempo(estado: any): any {
    return estado && estado.t0 === null ? { ...estado, t0: Date.now() } : estado;
  }

  /** Un compañero mueve el control que tiene en este momento (eje X, eje Y o potencia) del puntero láser. */
  async accionPunteroMinijuego(codigo: string, usuario: string, mov: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || !t.iniciado || !t.estadoJ || t.tipo !== 'puntero') return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
        sala.updatedAt = Date.now();
        return true;
      }
      const capitan = est.capitanes[t.equipoId];
      const ayudantes = this.miembrosDeEquipo(sala, t.equipoId).filter(nombre => nombre !== capitan);
      const duenos = ayudantes.length ? ayudantes : [capitan];
      const owner = duenos.indexOf(usuario);
      if (owner < 0) return false;
      const res = aplicarAccionPuntero(JSON.parse(t.estadoJ), mov, owner, duenos.length);
      if (!res.ok) return false;
      if (res.completado) {
        // Diana alcanzada: suma acierto, pasa al siguiente puzle y los controles rotan a otras personas
        const rot = (res.estado.rot || 0) + 1;
        t.aciertos += 1;
        this.siguientePuzleMinijuego(sala, est);
        const sig = JSON.parse(t.estadoJ || '{}');
        sig.rot = rot;
        t.estadoJ = JSON.stringify(sig);
      } else {
        t.estadoJ = JSON.stringify(res.estado);
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

/** Un compañero cambia la luz de su semáforo. Cada cambio avanza el tráfico un paso. */
  async accionSemaforoMinijuego(codigo: string, usuario: string, a: number): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || !t.iniciado || !t.estadoJ || t.tipo !== 'semaforo') return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
        sala.updatedAt = Date.now();
        return true;
      }
      const capitan = est.capitanes[t.equipoId];
      const ayudantes = this.miembrosDeEquipo(sala, t.equipoId).filter(nombre => nombre !== capitan);
      const duenos = ayudantes.length ? ayudantes : [capitan];
      const owner = duenos.indexOf(usuario);
      if (owner < 0) return false;
      const res = aplicarSemaforo(JSON.parse(t.estadoJ), a, owner, duenos.length);
      if (!res.ok) return false;
      if (res.choque) {
        t.errores += 1;
        t.finMs -= PENALIZACION_ERROR_MS;
      }
      if (res.completado) {
        // Ronda terminada: acierto solo si no hubo ningún choque. Los semáforos rotan.
        const rot = (res.estado.rot || 0) + 1;
        if ((res.estado.choques || 0) === 0) t.aciertos += 1;
        this.siguientePuzleMinijuego(sala, est);
        const sig = JSON.parse(t.estadoJ || '{}');
        sig.rot = rot;
        t.estadoJ = JSON.stringify(sig);
      } else {
        t.estadoJ = JSON.stringify(res.estado);
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

/** Un compañero rema con su remo (babor o estribor). Una roca o una orilla bloquea la remada. */
  async accionBarcoMinijuego(codigo: string, usuario: string, lado: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || !t.iniciado || !t.estadoJ || t.tipo !== 'barco') return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
        sala.updatedAt = Date.now();
        return true;
      }
      const capitan = est.capitanes[t.equipoId];
      const ayudantes = this.miembrosDeEquipo(sala, t.equipoId).filter(nombre => nombre !== capitan);
      const duenos = ayudantes.length ? ayudantes : [capitan];
      const owner = duenos.indexOf(usuario);
      if (owner < 0) return false;
      const res = aplicarBarco(JSON.parse(t.estadoJ), lado, owner, duenos.length);
      if (!res.ok) return false;
      if (res.bloqueo) {
        t.errores += 1;
        t.finMs -= PENALIZACION_ERROR_MS;
      }
      if (res.completado) {
        // Puerto alcanzado: acierto y los remos rotan a otras personas
        const rot = (res.estado.rot || 0) + 1;
        t.aciertos += 1;
        this.siguientePuzleMinijuego(sala, est);
        const sig = JSON.parse(t.estadoJ || '{}');
        sig.rot = rot;
        t.estadoJ = JSON.stringify(sig);
      } else {
        t.estadoJ = JSON.stringify(res.estado);
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

/** Un compañero añade un ingrediente o ajusta un fuego. Solo el capitán puede servir. */
  async accionCocinaMinijuego(codigo: string, usuario: string, accion: any): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || !t.iniciado || !t.estadoJ || t.tipo !== 'cocina') return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
        sala.updatedAt = Date.now();
        return true;
      }
      const capitan = est.capitanes[t.equipoId];
      const ayudantes = this.miembrosDeEquipo(sala, t.equipoId).filter(nombre => nombre !== capitan);
      const duenos = ayudantes.length ? ayudantes : [capitan];
      let owner = -1;
      if (accion.tipo === 'servir') {
        if (usuario !== capitan) return false;
      } else {
        owner = duenos.indexOf(usuario);
        if (owner < 0) return false;
      }
      const res = aplicarCocina(JSON.parse(t.estadoJ), accion, owner, duenos.length);
      if (!res.ok) return false;
      if (res.error) {
        t.errores += 1;
        t.finMs -= PENALIZACION_ERROR_MS;
      }
      if (res.completado) {
        // Plato servido en su punto: acierto y se prepara una receta nueva con los controles rotados
        const rot = (res.estado.rot || 0) + 1;
        t.aciertos += 1;
        this.siguientePuzleMinijuego(sala, est);
        const sig = JSON.parse(t.estadoJ || '{}');
        sig.rot = rot;
        t.estadoJ = JSON.stringify(sig);
      } else {
        t.estadoJ = JSON.stringify(res.estado);
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async reiniciarMinijuegos(codigo: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      sala.estadoMinijuegos = this.estadoInicialMinijuegos();
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Acción del capitán sobre un juego interactivo (torres, pintar, mezcla, deslizar, balanza). */
  async accionJuegoMinijuego(codigo: string, usuario: string, accion: any): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || !t.estadoJ) return false;
      if (est.capitanes[t.equipoId] !== usuario) return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
        sala.updatedAt = Date.now();
        return true;
      }
      const res = aplicarAccionJuego(t.tipo, JSON.parse(t.estadoJ), accion, t.solucion);
      if (res.ok) t.estadoJ = JSON.stringify(res.estado);
      if (res.fallo) { t.errores += 1; t.finMs -= PENALIZACION_ERROR_MS; }
      if (res.completado) { t.aciertos += 1; this.siguientePuzleMinijuego(sala, est); }
      sala.updatedAt = Date.now();
      return res.ok;
    });
  }

  /** El capitán pulsa Comprobar: acierto pasa al siguiente puzle; fallo penaliza. */
  async comprobarJuegoMinijuego(codigo: string, usuario: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || !t.estadoJ) return false;
      if (est.capitanes[t.equipoId] !== usuario) return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
      } else if (comprobarJuego(t.tipo, JSON.parse(t.estadoJ), t.solucion)) {
        t.aciertos += 1;
        this.siguientePuzleMinijuego(sala, est);
      } else {
        t.errores += 1;
        t.finMs -= PENALIZACION_ERROR_MS;
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** El capitán mueve el robot una casilla. El servidor comprueba muros y meta. */
  async moverMinijuego(codigo: string, usuario: string, direccion: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || t.tipo !== 'mapa') return false;
      if (est.capitanes[t.equipoId] !== usuario) return false;
      if (!['U', 'D', 'L', 'R'].includes(direccion)) return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
        sala.updatedAt = Date.now();
        return true;
      }
      const sol = t.solucion;
      const N: number = sol.tamano;
      const delta = (d: string): [number, number] =>
        d === 'U' ? [-1, 0] : d === 'D' ? [1, 0] : d === 'L' ? [0, -1] : [0, 1];
      let r = sol.inicio[0], c = sol.inicio[1];
      for (const d of t.recorrido || []) {
        const [a, b] = delta(d);
        r += a;
        c += b;
      }
      const [dr, dc] = delta(direccion);
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N) return false;
      if (sol.muros[nr][nc]) {
        // Choque con un muro: error, penalización y vuelta a la S
        t.errores += 1;
        t.finMs -= PENALIZACION_ERROR_MS;
        t.recorrido = [];
      } else {
        t.recorrido = [...(t.recorrido || []), direccion];
        if (nr === sol.meta[0] && nc === sol.meta[1]) {
          t.aciertos += 1;
          this.siguientePuzleMinijuego(sala, est);
        }
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Quita el último paso del camino del robot. */
  async deshacerMinijuego(codigo: string, usuario: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t || t.tipo !== 'mapa') return false;
      if (est.capitanes[t.equipoId] !== usuario) return false;
      t.recorrido = (t.recorrido || []).slice(0, -1);
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async resolverMinijuego(codigo: string, usuario: string, respuesta: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t) return false;
      if (est.capitanes[t.equipoId] !== usuario) return false;
      if (Date.now() >= t.finMs) {
        this.cerrarTurnoMinijuego(sala, est);
      } else if (validarRespuesta(t.tipo, t.solucion, respuesta)) {
        t.aciertos += 1;
        this.siguientePuzleMinijuego(sala, est);
      } else {
        t.errores += 1;
        t.finMs -= PENALIZACION_ERROR_MS;
        t.recorrido = [];
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async expirarTurnoMinijuego(codigo: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoMinijuegos(sala);
      const t = est.turno;
      if (est.fase !== 'jugando' || !t) return false;
      if (Date.now() < t.finMs) return false;
      this.cerrarTurnoMinijuego(sala, est);
      sala.updatedAt = Date.now();
      return true;
    });
  }

  // ====================================================================
  // JUEGO: PREGUNTAS ANÓNIMAS
  // ====================================================================

  private normalizarClaveRespuesta(texto: string): string {
    const base = texto
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[.!?¡¿,;:]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (['si', 's', 'yes', 'y'].includes(base)) return 'si';
    if (['no', 'n', 'nope'].includes(base)) return 'no';
    if (['ns', 'nc', 'nsnc', 'ns nc', 'ns/nc'].includes(base)) return 'nsnc';
    return base;
  }

  private etiquetaRespuesta(clave: string, original: string): string {
    if (clave === 'si') return 'Sí';
    if (clave === 'no') return 'No';
    if (clave === 'nsnc') return 'NS/NC';
    const limpio = original.trim();
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
  }

  private agruparRespuestasPreguntas(textos: string[]): RespuestaAgrupada[] {
    const grupos = new Map<string, { texto: string; cantidad: number }>();
    for (const t of textos) {
      const clave = this.normalizarClaveRespuesta(t);
      if (!clave) continue;
      const g = grupos.get(clave);
      if (g) g.cantidad++;
      else grupos.set(clave, { texto: this.etiquetaRespuesta(clave, t), cantidad: 1 });
    }
    const total = textos.length || 1;
    return Array.from(grupos.values())
      .map(g => ({ texto: g.texto, cantidad: g.cantidad, porcentaje: Math.round((g.cantidad / total) * 100) }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }

  private estadoInicialPreguntasAnonimas(): EstadoPreguntasAnonimas {
    return {
      fase: 'haciendo-preguntas',
      preguntas: [],
      respuestas: [],
      indexPreguntaActual: 0,
      respuestasAgrupadas: {}
    };
  }

  private asegurarEstadoPreguntasAnonimas(sala: Sala): EstadoPreguntasAnonimas {
    if (!sala.estadoPreguntasAnonimas) {
      sala.estadoPreguntasAnonimas = this.estadoInicialPreguntasAnonimas();
    }
    // Firebase elimina los arrays vacíos y los objetos vacíos al guardar
    const est = sala.estadoPreguntasAnonimas;
    est.preguntas = est.preguntas || [];
    est.respuestas = est.respuestas || [];
    est.respuestasAgrupadas = est.respuestasAgrupadas || {};
    return est;
  }

  private abrirRespuestasPreguntasAnonimas(est: EstadoPreguntasAnonimas): void {
    const lista = est.preguntas;
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    lista.forEach((p, i) => (p.index = i));
    est.fase = 'respondiendo';
    est.indexPreguntaActual = 0;
  }

  private cerrarPreguntaActualAnonima(est: EstadoPreguntasAnonimas): void {
    const idx = est.indexPreguntaActual;
    const textos = est.respuestas.filter(r => r.indexPregunta === idx).map(r => r.respuesta);
    est.respuestasAgrupadas[idx] = this.agruparRespuestasPreguntas(textos);
    if (idx < est.preguntas.length - 1) {
      est.indexPreguntaActual = idx + 1;
    } else {
      est.fase = 'revision';
      est.indexPreguntaActual = 0;
    }
  }

  async aportarPreguntaAnonima(codigo: string, usuario: string, texto: string): Promise<boolean> {
    const limpio = texto.trim();
    if (!limpio) return false;
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoPreguntasAnonimas(sala);
      if (est.fase !== 'haciendo-preguntas') return false;
      if (est.preguntas.some(p => p.idJugador === usuario)) return false;
      est.preguntas.push({ idJugador: usuario, pregunta: limpio, index: est.preguntas.length });
      // Cuando todos han aportado, empiezan las respuestas automáticamente
      if (est.preguntas.length >= sala.jugadores.length) {
        this.abrirRespuestasPreguntasAnonimas(est);
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async iniciarRespuestasPreguntasAnonimas(codigo: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoPreguntasAnonimas(sala);
      if (est.fase !== 'haciendo-preguntas' || est.preguntas.length < 2) return false;
      this.abrirRespuestasPreguntasAnonimas(est);
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async responderPreguntaAnonima(codigo: string, usuario: string, respuesta: string): Promise<boolean> {
    const limpio = respuesta.trim();
    if (!limpio) return false;
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoPreguntasAnonimas(sala);
      if (est.fase !== 'respondiendo') return false;
      const idx = est.indexPreguntaActual;
      if (est.respuestas.some(r => r.idJugador === usuario && r.indexPregunta === idx)) return false;
      est.respuestas.push({ idJugador: usuario, indexPregunta: idx, respuesta: limpio });
      const respondieron = est.respuestas.filter(r => r.indexPregunta === idx).length;
      if (respondieron >= sala.jugadores.length) {
        this.cerrarPreguntaActualAnonima(est);
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Admin: en respuestas cierra la pregunta actual con lo que haya; en revisión pasa a la siguiente. */
  async siguientePreguntaAnonima(codigo: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoPreguntasAnonimas(sala);
      if (est.fase === 'respondiendo') {
        this.cerrarPreguntaActualAnonima(est);
      } else if (est.fase === 'revision') {
        if (est.indexPreguntaActual >= est.preguntas.length - 1) return false;
        est.indexPreguntaActual += 1;
      } else {
        return false;
      }
      sala.updatedAt = Date.now();
      return true;
    });
  }

  async reiniciarPreguntasAnonimas(codigo: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      sala.estadoPreguntasAnonimas = this.estadoInicialPreguntasAnonimas();
      sala.updatedAt = Date.now();
      return true;
    });
  }

  /** Un miembro del equipo en turno da por terminado su turno voluntariamente. */
  async terminarTurnoCodigo(codigo: string, usuario: string): Promise<boolean> {
    return this.mutarSala(codigo, (sala) => {
      const est = this.asegurarEstadoCodigo(sala);
      if (est.fase !== 'jugando' || !est.pista) return false;
      if (Object.values(est.capitanes).includes(usuario)) return false;
      const jugador = sala.jugadores.find(j => j.nombre.toLowerCase() === usuario.toLowerCase());
      if (!jugador || jugador.equipoId !== est.turnoEquipoId) return false;
      const otro = this.idsEquiposCodigo(sala).find(id => id !== est.turnoEquipoId) as string;
      this.pasarTurnoCodigo(est, otro);
      sala.updatedAt = Date.now();
      return true;
    });
  }
}

function productoidOrNull(v: any) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? String(v) : n;
}

function rondaSaneable(r: any) {
  if (r === null || r === undefined) return true;
  const n = Number(r);
  return !isNaN(n) && n > 0 && n <= 50;
}
