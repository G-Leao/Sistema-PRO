/* ============================================================
   SERVICIO DE PRODUCTOS — reglas de negocio (independiente de UI)
   ============================================================ */

const ServicioProductos = {
  _normalizar(datos) {
    const stockRaw = Utils.parsearNumero(datos.stock);
    return {
      nombre: String(datos.nombre || "").trim(),
      sku: String(datos.sku || "").trim(),
      categoria: String(datos.categoria || "").trim(),
      marca: String(datos.marca || "").trim(),
      precioCosto: Math.max(0, Utils.redondear(Utils.parsearNumero(datos.precioCosto) || 0)),
      precioVenta: Math.max(0, Utils.redondear(Utils.parsearNumero(datos.precioVenta) || 0)),
      /* vacío/indefinido = sin control de stock */
      stock:
        datos.stock === null || datos.stock === undefined || String(datos.stock).trim() === ""
          ? null
          : Math.max(0, Math.floor(Utils.parsearNumero(datos.stock) || 0)),
      stockMin: Math.max(0, Math.floor(Utils.parsearNumero(datos.stockMin) || 0)),
      activo: datos.activo === undefined ? true : !!datos.activo,
      imagen: String(datos.imagen || "").trim(),
    };
  },

  _validar(p, idExcluido) {
    if (!p.nombre) return "El nombre es obligatorio.";
    if (!(p.precioVenta > 0)) return "El precio de venta debe ser mayor que cero.";
    if (p.sku && p.sku.length > 60) return "El SKU es demasiado largo.";
    if (
      p.sku &&
      State.productos.some(
        (x) =>
          x.id !== (idExcluido || "") &&
          x.sku &&
          x.sku.trim().toLowerCase() === p.sku.toLowerCase(),
      )
    ) {
      return "Ya existe un producto con este SKU.";
    }
    return null;
  },

  crear(datos) {
    const p = this._normalizar(datos);
    const error = this._validar(p);
    if (error) return { ok: false, error };
    p.id = Utils.id();
    State.productos.push(p);
    State.guardarProductos();
    return { ok: true, producto: p };
  },

  actualizar(id, datos) {
    const idx = State.productos.findIndex((x) => x.id === id);
    if (idx < 0) return { ok: false, error: "Producto no encontrado." };
    const p = this._normalizar(datos);
    const error = this._validar(p, id);
    if (error) return { ok: false, error };
    State.productos[idx] = { ...State.productos[idx], ...p };
    State.guardarProductos();
    return { ok: true, producto: State.productos[idx] };
  },

  eliminar(id) {
    const idx = State.productos.findIndex((x) => x.id === id);
    if (idx < 0) return { ok: false, error: "Producto no encontrado." };
    State.productos.splice(idx, 1);
    State.guardarProductos();
    return { ok: true };
  },

  obtener(id) {
    return State.productos.find((p) => p.id === id);
  },

  /* Margen = precio de venta − precio de costo, con % cuando es posible */
  margen(p) {
    const bruto = Math.max(0, p.precioVenta - p.precioCosto);
    const pct = p.precioVenta > 0 ? (bruto / p.precioVenta) * 100 : 0;
    return { bruto: Utils.redondear(bruto), pct: Utils.redondear(pct) };
  },

  estadoStock(p) {
    if (p.stock === null) return { tipo: "nulo", etiqueta: "Sin control", clase: "badge-soft" };
    if (p.stock <= 0) return { tipo: "sin", etiqueta: "Sin stock", clase: "badge-peligro" };
    if (p.stockMin > 0 && p.stock <= p.stockMin) return { tipo: "bajo", etiqueta: "Stock bajo", clase: "badge-aviso" };
    return { tipo: "ok", etiqueta: "Stock OK", clase: "badge-ok" };
  },

  categorias() {
    const set = new Set();
    State.productos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt"));
  },
};