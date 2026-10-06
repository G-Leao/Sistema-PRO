/* ============================================================
   STATE — estado en memoria + migración automática de los datos
   existentes (formato antiguo -> nuevo) sin perder información.
   ============================================================ */

function _ventaNormalizada(v) {
  if (!v) return null;
  const valor = Utils.parsearNumero(v.valorFinal ?? v.valor);
  const valorUnitario = Utils.parsearNumero(v.valorUnitario);
  const cantidad = Utils.parsearNumero(v.cantidad);
  return {
    id: v.id || Utils.id(),
    productoId: v.productoId || "",
    productoNombre: v.productoNombre || v.produto || "Producto",
    vendedorId: v.vendedorId || "",
    vendedorNombre: v.vendedorNombre || v.vendedor || "Vendedor",
    cantidad: isNaN(cantidad) ? 1 : cantidad,
    valorUnitario: Utils.redondear(
      isNaN(valorUnitario) ? (isNaN(valor) ? 0 : valor) : valorUnitario,
    ),
    descuento: Utils.redondear(Utils.parsearNumero(v.descuento) || 0),
    valorFinal: Utils.redondear(isNaN(valor) ? 0 : valor),
    pagamento: v.pagamento || "Outros",
    fecha: v.fecha || Utils.dmaAISO(v.data) || Utils.ahora(),
    observacion: v.observacion || "",
    estado: v.estado || "valida",
  };
}

function _productoDesdeString(nombre) {
  return {
    id: Utils.id(),
    nombre: String(nombre),
    sku: "",
    categoria: "",
    marca: "",
    precioCosto: 0,
    precioVenta: 0,
    stock: null,
    stockMin: 0,
    activo: true,
    imagen: "",
  };
}

function _normalizarProductos(lista) {
  if (!Array.isArray(lista)) return [];
  if (lista.length && typeof lista[0] === "string") {
    return lista.map(_productoDesdeString);
  }
  return lista
    .filter((p) => p && p.nombre)
    .map((p) => ({
      id: p.id || Utils.id(),
      nombre: String(p.nombre),
      sku: (p.sku || "").trim(),
      categoria: (p.categoria || "").trim(),
      marca: (p.marca || "").trim(),
      precioCosto: Utils.redondear(Utils.parsearNumero(p.precioCosto) || 0),
      precioVenta: Utils.redondear(Utils.parsearNumero(p.precioVenta) || 0),
      /* null = sin control de stock (comportamiento legado) */
      stock:
        p.stock === null || p.stock === undefined || p.stock === ""
          ? null
          : Math.max(0, Number(p.stock) || 0),
      stockMin: Math.max(0, Utils.parsearNumero(p.stockMin) || 0),
      activo: p.activo === undefined ? true : !!p.activo,
      imagen: (p.imagen || "").trim(),
    }));
}

function _vendedorDesdeString(nombre) {
  return {
    id: Utils.id(),
    nombre: String(nombre),
    foto: "",
    cargo: "",
    metaMensual: 0,
    comision: 0,
  };
}

function _normalizarVendedores(lista) {
  if (!Array.isArray(lista)) return [];
  if (lista.length && typeof lista[0] === "string") {
    return lista.map(_vendedorDesdeString);
  }
  return lista
    .filter((v) => v && v.nombre)
    .map((v) => ({
      id: v.id || Utils.id(),
      nombre: String(v.nombre),
      foto: (v.foto || "").trim(),
      cargo: (v.cargo || "").trim(),
      metaMensual: Utils.redondear(Utils.parsearNumero(v.metaMensual) || 0),
      comision: Math.min(
        100,
        Math.max(0, Utils.parsearNumero(v.comision) || 0),
      ),
    }));
}

const State = {
  ventas: [],
  vendedores: [],
  productos: [],
  config: { metas: { diaria: 0, mensual: 0 } },

  init() {
    this.config = Store.cargarConfig() || { metas: { diaria: 0, mensual: 0 } };
    if (!this.config.metas) this.config.metas = { diaria: 0, mensual: 0 };
    const metaLegada = Store.cargarMetaLegada();
    if (metaLegada > 0 && !(this.config.metas.diaria > 0)) {
      this.config.metas.diaria = metaLegada;
    }

    this.productos = _normalizarProductos(Store.cargarProductos());
    this.vendedores = _normalizarVendedores(Store.cargarVendedores());
    this.ventas = (Store.cargarVentas() || [])
      .map(_ventaNormalizada)
      .filter(Boolean);

    /* Vincula ventas legadas con los registros actuales por nombre */
    this.ventas.forEach((venta) => {
      if (!venta.productoId) {
        const p = this.productos.find(
          (x) =>
            x.nombre.trim().toLowerCase() ===
            venta.productoNombre.trim().toLowerCase(),
        );
        if (p) venta.productoId = p.id;
      }
      if (!venta.vendedorId) {
        const v = this.vendedores.find(
          (x) =>
            x.nombre.trim().toLowerCase() ===
            venta.vendedorNombre.trim().toLowerCase(),
        );
        if (v) venta.vendedorId = v.id;
      }
    });

    /* Persiste la migración para que ocurra una sola vez */
    this.guardarTodo();
  },

  guardarVentas() {
    Store.guardarVentas(this.ventas);
  },
  guardarVendedores() {
    Store.guardarVendedores(this.vendedores);
  },
  guardarProductos() {
    Store.guardarProductos(this.productos);
  },
  guardarConfig() {
    Store.guardarConfig(this.config);
  },
  guardarTodo() {
    this.guardarVentas();
    this.guardarVendedores();
    this.guardarProductos();
    this.guardarConfig();
  },
};