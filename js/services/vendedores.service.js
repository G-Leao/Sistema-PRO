/* ============================================================
   SERVICIO DE VENDEDORES — reglas de negocio (independiente de UI)
   ============================================================ */

const ServicioVendedores = {
  _normalizar(datos) {
    return {
      nombre: String(datos.nombre || "").trim(),
      foto: String(datos.foto || "").trim(),
      cargo: String(datos.cargo || "").trim(),
      metaMensual: Math.max(0, Utils.redondear(Utils.parsearNumero(datos.metaMensual) || 0)),
      comision: Math.min(100, Math.max(0, Utils.parsearNumero(datos.comision) || 0)),
    };
  },

  _validar(v) {
    if (!v.nombre) return "El nombre es obligatorio.";
    return null;
  },

  crear(datos) {
    const v = this._normalizar(datos);
    const error = this._validar(v);
    if (error) return { ok: false, error };
    v.id = Utils.id();
    State.vendedores.push(v);
    State.guardarVendedores();
    return { ok: true, vendedor: v };
  },

  actualizar(id, datos) {
    const idx = State.vendedores.findIndex((x) => x.id === id);
    if (idx < 0) return { ok: false, error: "Vendedor no encontrado." };
    const v = this._normalizar(datos);
    const error = this._validar(v);
    if (error) return { ok: false, error };
    const anterior = State.vendedores[idx];
    /* Si cambia el nombre, se actualizan las ventas asociadas */
    State.vendedores[idx] = { ...anterior, ...v };
    if (anterior.nombre !== v.nombre) {
      State.ventas.forEach((venta) => {
        if (venta.vendedorId === id) venta.vendedorNombre = v.nombre;
      });
    }
    State.guardarVendedores();
    State.guardarVentas();
    return { ok: true, vendedor: State.vendedores[idx] };
  },

  /* Comportamiento existente: al eliminar un vendedor también se
     eliminan sus ventas y se devuelve el stock de las válidas. */
  eliminar(id) {
    const idx = State.vendedores.findIndex((x) => x.id === id);
    if (idx < 0) return { ok: false, error: "Vendedor no encontrado." };
    const idVendedor = State.vendedores[idx].id;
    const antes = State.ventas.length;
    State.ventas.forEach((venta) => {
      if (venta.vendedorId === idVendedor && venta.estado === "valida") {
        ServicioVentas._aplicarStock(venta.productoId, -venta.cantidad);
      }
    });
    State.ventas = State.ventas.filter((venta) => venta.vendedorId !== idVendedor);
    State.vendedores.splice(idx, 1);
    State.guardarVentas();
    State.guardarProductos();
    State.guardarVendedores();
    return { ok: true, ventasRemovidas: antes - State.ventas.length };
  },

  obtener(id) {
    return State.vendedores.find((v) => v.id === id);
  },
};