/* ============================================================
   STORE — capa única de persistência (LocalStorage).
   En el futuro puede reemplazarse por un cliente de API REST
   (misma interfaz) sin tocar el resto de la aplicación.
   ============================================================ */

const Store = {
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },

  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Store: no se pudo guardar la clave", key);
    }
  },

  /* --- Ventas --- */
  cargarVentas() {
    return this._get("vendas", []);
  },
  guardarVentas(lista) {
    this._set("vendas", lista);
  },

  /* --- Vendedores --- */
  cargarVendedores() {
    return this._get("vendedores", []);
  },
  guardarVendedores(lista) {
    this._set("vendedores", lista);
  },

  /* --- Productos --- */
  cargarProductos() {
    return this._get("produtos", []);
  },
  guardarProductos(lista) {
    this._set("produtos", lista);
  },

  /* --- Configuración (metas) --- */
  cargarConfig() {
    return this._get("config", null);
  },
  guardarConfig(config) {
    this._set("config", config);
  },

  /* Meta legada (número suelto) — solo para migración */
  cargarMetaLegada() {
    try {
      return parseFloat(localStorage.getItem("meta")) || 0;
    } catch (e) {
      return 0;
    }
  },
};