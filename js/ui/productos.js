/* ============================================================
   PANTALLA PRODUCTOS — catálogo con precios, margen y stock
   ============================================================ */

let _editandoProductoId = null;

function _val(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function rellenarDatalistCategorias() {
  const dl = document.getElementById("listaCategorias");
  if (!dl) return;
  dl.innerHTML = ServicioProductos.categorias()
    .map((c) => `<option value="${Utils.esc(c)}">`)
    .join("");
}

function abrirModalProducto(id) {
  _editandoProductoId = id || null;
  const p = _editandoProductoId ? ServicioProductos.obtener(_editandoProductoId) : null;
  document.getElementById("modalProductoTitulo").textContent = p ? "Editar producto" : "Nuevo producto";
  document.getElementById("erroProducto").textContent = "";
  const set = (field, valor) => {
    const el = document.getElementById(`prod${field}`);
    if (el) el.value = valor === undefined || valor === null ? "" : String(valor);
  };
  set("Nombre", p ? p.nombre : "");
  set("Sku", p ? p.sku : "");
  set("Categoria", p ? p.categoria : "");
  set("Marca", p ? p.marca : "");
  set("PrecioCosto", p ? (p.precioCosto > 0 ? String(p.precioCosto).replace(".", ",") : "") : "");
  set("PrecioVenta", p ? (p.precioVenta > 0 ? String(p.precioVenta).replace(".", ",") : "") : "");
  set("Stock", p ? (p.stock === null ? "" : String(p.stock)) : "");
  set("StockMin", p ? (p.stockMin > 0 ? String(p.stockMin) : "") : "");
  set("Imagen", p ? p.imagen : "");
  const check = document.getElementById("prodActivo");
  if (check) check.checked = p ? p.activo !== false : true;
  abrirModal("modalProducto");
}

function guardarProducto() {
  const datos = {
    nombre: _val("prodNombre"),
    sku: _val("prodSku"),
    categoria: _val("prodCategoria"),
    marca: _val("prodMarca"),
    precioCosto: _val("prodPrecioCosto"),
    precioVenta: _val("prodPrecioVenta"),
    stock: _val("prodStock"),
    stockMin: _val("prodStockMin"),
    activo: document.getElementById("prodActivo").checked,
    imagen: _val("prodImagen"),
  };
  const res = _editandoProductoId
    ? ServicioProductos.actualizar(_editandoProductoId, datos)
    : ServicioProductos.crear(datos);
  const errorEl = document.getElementById("erroProducto");
  if (!res.ok) {
    errorEl.textContent = res.error;
    toast(res.error, "error");
    return;
  }
  errorEl.textContent = "";
  _editandoProductoId = null;
  cerrarModal("modalProducto");
  atualizarTudo();
  toast(datos.nombre + " guardado", "exito");
}

function eliminarProducto(id) {
  const p = ServicioProductos.obtener(id);
  if (!p) return;
  confirmarAccion(
    "Eliminar producto",
    `Se eliminará "${p.nombre}" del catálogo. Las ventas históricas conservarán el nombre registrado.`,
    () => {
      const res = ServicioProductos.eliminar(id);
      if (res.ok) {
        atualizarTudo();
        toast("Producto eliminado");
      } else {
        toast(res.error, "error");
      }
    },
    "Eliminar",
  );
}

function _fotoProducto(p) {
  const inicial = Utils.esc(p.nombre.charAt(0).toUpperCase());
  if (p.imagen) {
    return `<div class="prod-foto"><img src="${Utils.esc(p.imagen)}" alt="" onerror="this.parentNode.innerHTML='${inicial}'"></div>`;
  }
  return `<div class="prod-foto">${inicial}</div>`;
}

function atualizarProductos() {
  const lista = document.getElementById("listaProductos");
  if (!lista) return;

  const busca = (_val("buscaProducto") || "").toLowerCase().trim();
  const cat = _val("filtroCategoria");
  const estado = _val("filtroStock");

  /* Paso único para cantidad vendida por producto (O(n)) */
  const vendido = {};
  ServicioMetricas.validas().forEach((v) => {
    vendido[v.productoId] = (vendido[v.productoId] || 0) + v.cantidad;
  });

  const filtrados = State.productos.filter((p) => {
    if (busca) {
      const texto = `${p.nombre} ${p.sku} ${p.marca} ${p.categoria}`.toLowerCase();
      if (!texto.includes(busca)) return false;
    }
    if (cat && p.categoria !== cat) return false;
    const st = ServicioProductos.estadoStock(p);
    if (estado === "inactivo") {
      if (p.activo !== false) return false;
    } else if (p.activo === false) {
      return false;
    } else if (estado && st.tipo !== estado) {
      return false;
    }
    return true;
  });

  if (!State.productos.length) {
    lista.innerHTML = estadoVacio(
      "▤",
      "Ningún producto en el catálogo",
      "Crea el primer producto con el botón «+ Nuevo producto».",
    );
  } else if (!filtrados.length) {
    lista.innerHTML = estadoVacio(
      "▤",
      "Sin coincidencias",
      "Ajusta la búsqueda o los filtros.",
    );
  } else {
    lista.innerHTML = filtrados
      .map((p) => {
        const st = ServicioProductos.estadoStock(p);
        const margen = ServicioProductos.margen(p);
        const qty = vendido[p.id] || 0;
        const badges = [
          p.activo === false ? '<span class="badge badge-soft">Inactivo</span>' : "",
          `<span class="badge ${st.clase}">${st.etiqueta}</span>`,
        ].join("");
        return `
        <div class="row-card">
          ${_fotoProducto(p)}
          <div class="row-main">
            <div class="row-title">${Utils.esc(p.nombre)} ${badges}</div>
            <div class="row-sub">${[p.sku, p.categoria, p.marca].filter(Boolean).map(Utils.esc).join(" · ") || "Sin clasificación"}</div>
            <div class="row-sub">Margen ${Utils.moneda(margen.bruto)} <span class="badge badge-soft">${margen.pct}%</span> · ${qty} vendidos</div>
          </div>
          <div class="prod-stock">
            <div>${p.stock === null ? "—" : `${Math.floor(p.stock)} uds.`}</div>
            <div class="row-value">${Utils.moneda(p.precioVenta)}</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-sm btn-icon" title="Editar" onclick="abrirModalProducto('${p.id}')">✎</button>
            <button class="btn btn-sm btn-icon btn-danger-ghost" title="Eliminar" onclick="eliminarProducto('${p.id}')">✕</button>
          </div>
        </div>`;
      })
      .join("");
  }

  /* Filtro de categoría (sin perder la selección) */
  const selCat = document.getElementById("filtroCategoria");
  if (selCat) {
    if (selCat.value !== cat) {
      llenarSelect("filtroCategoria", ServicioProductos.categorias(), true, "Todas");
      if (cat) {
        const existe = Array.from(selCat.options).some((o) => o.value === cat);
        if (existe) selCat.value = cat;
      }
    } else if (selCat.options.length === 1) {
      llenarSelect("filtroCategoria", ServicioProductos.categorias(), true, "Todas");
    }
  }

  const aviso = document.getElementById("avisoStockBajo");
  if (aviso) {
    const bajos = State.productos.filter((p) => {
      if (p.activo === false) return false;
      const st = ServicioProductos.estadoStock(p);
      return st.tipo === "bajo" || st.tipo === "sin";
    });
    aviso.style.display = bajos.length ? "flex" : "none";
    if (bajos.length) {
      aviso.textContent = `⚠ ${bajos.length} producto(s) con stock bajo o sin stock.`;
    }
  }
}