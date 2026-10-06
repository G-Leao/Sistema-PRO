/* ============================================================
   SERVICIO DE VENTAS — reglas de negocio (independiente de la UI)
   En el futuro esta capa se traslada al backend (API REST).
   ============================================================ */

const ServicioVentas = {
  /* Cantidad × Valor unitario − Descuento = Valor final */
  calcular(datos) {
    const cantidad = Math.max(0, Utils.parsearNumero(datos && datos.cantidad) || 0);
    const valorUnitario = Math.max(0, Utils.parsearNumero(datos && datos.valorUnitario) || 0);
    const descuento = Math.max(0, Utils.parsearNumero(datos && datos.descuento) || 0);
    const bruto = Utils.redondear(cantidad * valorUnitario);
    return {
      cantidad,
      valorUnitario,
      descuento,
      bruto,
      valorFinal: Utils.redondear(Math.max(0, bruto - descuento)),
    };
  },

  validar(datos) {
    if (!datos) return "Datos inválidos.";
    const producto = State.productos.find((p) => p.id === datos.productoId);
    if (!producto) return "Selecciona un producto válido.";
    if (producto.activo === false) return "El producto seleccionado está inactivo.";
    const vendedor = State.vendedores.find((v) => v.id === datos.vendedorId);
    if (!vendedor) return "Selecciona un vendedor válido.";
    const cantidad = Utils.parsearNumero(datos.cantidad);
    if (!(cantidad > 0)) return "La cantidad debe ser mayor que cero.";
    const valorUnitario = Utils.parsearNumero(datos.valorUnitario);
    if (!(valorUnitario > 0)) return "El valor unitario debe ser mayor que cero.";
    const descuento = Utils.parsearNumero(datos.descuento) || 0;
    if (descuento < 0) return "El descuento no puede ser negativo.";
    if (!FORMAS_PAGAMENTO.includes(datos.pagamento)) return "Forma de pago inválida.";
    return null;
  },

  /* delta positivo resta stock; delta negativo lo devuelve */
  _revisarStock(productoId, delta) {
    const p = State.productos.find((x) => x.id === productoId);
    if (!p || p.stock === null) return null; // sin control de stock
    if (p.stock - delta < 0) {
      const disp = Number.isInteger(p.stock) ? p.stock : Math.floor(p.stock);
      return `Stock insuficiente para "${p.nombre}". Disponible: ${disp}`;
    }
    return null;
  },

  _aplicarStock(productoId, delta) {
    const p = State.productos.find((x) => x.id === productoId);
    if (!p || p.stock === null) return;
    p.stock = Utils.redondear(p.stock - delta);
  },

  registrar(datos) {
    const error = this.validar(datos);
    if (error) return { ok: false, error };
    const calc = this.calcular(datos);
    const producto = State.productos.find((p) => p.id === datos.productoId);
    const vendedor = State.vendedores.find((v) => v.id === datos.vendedorId);

    const conflict = this._revisarStock(producto.id, calc.cantidad);
    if (conflict) return { ok: false, error: conflict };

    const venta = {
      id: Utils.id(),
      productoId: producto.id,
      productoNombre: producto.nombre,
      vendedorId: vendedor.id,
      vendedorNombre: vendedor.nombre,
      cantidad: calc.cantidad,
      valorUnitario: calc.valorUnitario,
      descuento: calc.descuento,
      valorFinal: calc.valorFinal,
      pagamento: datos.pagamento,
      fecha: datos.fecha || Utils.ahora(),
      observacion: (datos.observacion || "").trim(),
      estado: "valida",
    };
    this._aplicarStock(producto.id, venta.cantidad);
    State.ventas.push(venta);
    State.guardarVentas();
    State.guardarProductos();
    return { ok: true, venta };
  },

  actualizar(id, datos) {
    const idx = State.ventas.findIndex((v) => v.id === id);
    if (idx < 0) return { ok: false, error: "Venta no encontrada." };
    const error = this.validar(datos);
    if (error) return { ok: false, error };
    const vieja = State.ventas[idx];
    const calc = this.calcular(datos);
    const producto = State.productos.find((p) => p.id === datos.productoId);
    const vendedor = State.vendedores.find((v) => v.id === datos.vendedorId);

    /* devuelve el stock del producto anterior si la venta era válida */
    if (vieja.estado === "valida") {
      this._aplicarStock(vieja.productoId, -vieja.cantidad);
    }
    const conflict = this._revisarStock(producto.id, calc.cantidad);
    if (conflict) {
      this._aplicarStock(vieja.productoId, vieja.cantidad);
      return { ok: false, error: `No se pudo guardar: ${conflict}` };
    }
    this._aplicarStock(producto.id, calc.cantidad);

    State.ventas[idx] = {
      ...vieja,
      productoId: producto.id,
      productoNombre: producto.nombre,
      vendedorId: vendedor.id,
      vendedorNombre: vendedor.nombre,
      cantidad: calc.cantidad,
      valorUnitario: calc.valorUnitario,
      descuento: calc.descuento,
      valorFinal: calc.valorFinal,
      pagamento: datos.pagamento,
      fecha: datos.fecha || vieja.fecha,
      observacion: (datos.observacion || "").trim(),
    };
    State.guardarVentas();
    State.guardarProductos();
    return { ok: true, venta: State.ventas[idx] };
  },

  eliminar(id) {
    const idx = State.ventas.findIndex((v) => v.id === id);
    if (idx < 0) return { ok: false, error: "Venta no encontrada." };
    const venta = State.ventas[idx];
    if (venta.estado === "valida") {
      this._aplicarStock(venta.productoId, -venta.cantidad);
    }
    State.ventas.splice(idx, 1);
    State.guardarVentas();
    State.guardarProductos();
    return { ok: true };
  },

  anular(id) {
    const idx = State.ventas.findIndex((v) => v.id === id);
    if (idx < 0) return { ok: false, error: "Venta no encontrada." };
    const venta = State.ventas[idx];
    if (venta.estado !== "valida") return { ok: false, error: "La venta ya está anulada." };
    this._aplicarStock(venta.productoId, -venta.cantidad);
    venta.estado = "anulada";
    State.guardarVentas();
    State.guardarProductos();
    return { ok: true, venta };
  },

  revalidar(id) {
    const idx = State.ventas.findIndex((v) => v.id === id);
    if (idx < 0) return { ok: false, error: "Venta no encontrada." };
    const venta = State.ventas[idx];
    if (venta.estado !== "anulada") return { ok: false, error: "La venta ya está válida." };
    const conflict = this._revisarStock(venta.productoId, venta.cantidad);
    if (conflict) return { ok: false, error: conflict };
    this._aplicarStock(venta.productoId, venta.cantidad);
    venta.estado = "valida";
    State.guardarVentas();
    State.guardarProductos();
    return { ok: true, venta };
  },

  eliminarTodas() {
    State.ventas.forEach((v) => {
      if (v.estado === "valida") this._aplicarStock(v.productoId, -v.cantidad);
    });
    State.ventas = [];
    State.guardarVentas();
    State.guardarProductos();
    return { ok: true };
  },
};