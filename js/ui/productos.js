/* ============================================================
   TELA PRODUTOS — catálogo com preços, margem e estoque
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

function _linhaProduto(p, vendido) {
  const st = ServicioProductos.estadoStock(p);
  const m = ServicioProductos.margen(p);
  const inativo = p.activo === false;
  const destaque = !inativo && (st.tipo === "sin" ? "linha-critica" : st.tipo === "bajo" ? "linha-alerta" : "");
  const margem =
    m.bruto === null
      ? '<span class="muted">—</span>'
      : `<span class="${m.bruto < 0 ? "txt-neg" : ""}">${Utils.moneda(m.bruto)}</span><span class="sub-linha">${Utils.percentual(m.pct, 1)}</span>`;
  const estoque =
    p.stock === null
      ? '<span class="muted">—</span>'
      : `<strong>${Utils.numero(p.stock, 2)}</strong>${p.stockMin > 0 ? `<span class="sub-linha">mín. ${Utils.numero(p.stockMin, 0)}</span>` : ""}`;
  const badges = [inativo ? '<span class="badge badge-soft">Inativo</span>' : "", `<span class="badge ${st.clase}">${st.etiqueta}</span>`].join(" ");
  return `
    <tr class="${destaque || ""} ${inativo ? "fila-inativa" : ""}">
      <td data-label="Produto" class="td-principal">
        <div class="celula-produto">
          ${avatarHtml(p.nombre, p.imagen, "prod-foto")}
          <div><div class="nome-linha">${Utils.esc(p.nombre)}</div><div class="sub-linha">${p.sku ? "SKU " + Utils.esc(p.sku) : "Sem SKU"} · ${Utils.numero(vendido, 2)} vendido(s)</div></div>
        </div>
      </td>
      <td data-label="Categoria / Marca">${[p.categoria, p.marca].filter(Boolean).map(Utils.esc).join(" · ") || '<span class="muted">—</span>'}</td>
      <td data-label="Custo" class="num">${p.precioCosto > 0 ? Utils.moneda(p.precioCosto) : '<span class="muted">—</span>'}</td>
      <td data-label="Venda" class="num td-valor">${Utils.moneda(p.precioVenta)}</td>
      <td data-label="Margem" class="num">${margem}</td>
      <td data-label="Estoque" class="num">${estoque}</td>
      <td data-label="Situação">${badges}</td>
      <td class="acoes">
        <button type="button" class="btn btn-sm btn-icon" title="Editar produto" aria-label="Editar produto" data-acao="abrirModalProduto" data-id="${Utils.esc(p.id)}">${icone("edit")}</button>
        <button type="button" class="btn btn-sm btn-icon btn-danger-ghost" title="Excluir produto" aria-label="Excluir produto" data-acao="excluirProduto" data-id="${Utils.esc(p.id)}">${icone("trash")}</button>
      </td>
    </tr>`;
}

function atualizarProductos() {
  const tbody = document.getElementById("listaProductos");
  if (!tbody) return;

  /* Categorias: reconstrói preservando a seleção */
  const selCat = document.getElementById("filtroCategoria");
  const catAnterior = selCat.value;
  llenarSelect("filtroCategoria", ServicioProductos.categorias(), true, "Todas");
  if (catAnterior && Array.from(selCat.options).some((o) => o.value === catAnterior)) selCat.value = catAnterior;

  const busca = _val("buscaProducto").toLowerCase().trim();
  const cat = selCat.value;
  const estado = _val("filtroStock");

  const vendido = {};
  ServicioMetricas.validas().forEach((v) => {
    vendido[v.productoId] = (vendido[v.productoId] || 0) + v.cantidad;
  });

  const filtrados = State.productos
    .filter((p) => {
      if (busca && !`${p.nombre} ${p.sku} ${p.marca} ${p.categoria}`.toLowerCase().includes(busca)) return false;
      if (cat && p.categoria !== cat) return false;
      if (estado === "inactivo") return p.activo === false;
      if (p.activo === false) return false;
      if (estado && ServicioProductos.estadoStock(p).tipo !== estado) return false;
      return true;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "pt"));

  if (!State.productos.length) {
    tbody.innerHTML = `<tr class="linha-vazia"><td colspan="8">${estadoVacio("produtos", "Nenhum produto cadastrado", 'Cadastre o primeiro produto em "Novo produto".')}</td></tr>`;
  } else if (!filtrados.length) {
    tbody.innerHTML = `<tr class="linha-vazia"><td colspan="8">${estadoVacio("search", "Nenhum resultado", "Ajuste a pesquisa ou os filtros.")}</td></tr>`;
  } else {
    tbody.innerHTML = filtrados.map((p) => _linhaProduto(p, vendido[p.id] || 0)).join("");
  }

  /* Indicadores e alerta de estoque */
  const ativos = State.productos.filter((p) => p.activo !== false);
  const bajos = ativos.filter((p) => ServicioProductos.estadoStock(p).tipo === "bajo");
  const sem = ativos.filter((p) => ServicioProductos.estadoStock(p).tipo === "sin");
  document.getElementById("resumoProdutos").innerHTML = [
    ["Produtos ativos", ativos.length, "box", ""],
    ["Estoque baixo", bajos.length, "alert", bajos.length ? "mini-aviso" : ""],
    ["Sem estoque", sem.length, "ban", sem.length ? "mini-critico" : ""],
  ]
    .map(([l, n, i, c]) => `<div class="card mini ${c}"><span class="kpi-ico">${icone(i)}</span><div><div class="mini-valor">${n}</div><div class="label">${l}</div></div></div>`)
    .join("");

  const aviso = document.getElementById("avisoStockBajo");
  aviso.style.display = bajos.length + sem.length ? "flex" : "none";
  aviso.innerHTML = bajos.length + sem.length ? `${icone("alert")}<span>${bajos.length + sem.length} produto(s) precisam de atenção: ${sem.length} sem estoque e ${bajos.length} com estoque baixo.</span>` : "";
}

registrarAcoes({
  abrirModalProduto: (ds) => {
    _editandoProductoId = ds.id || null;
    const p = _editandoProductoId ? ServicioProductos.obtener(_editandoProductoId) : null;
    document.getElementById("modalProductoTitulo").textContent = p ? "Editar produto" : "Novo produto";
    document.getElementById("erroProducto").textContent = "";
    const set = (campo, valor) => {
      document.getElementById(`prod${campo}`).value = valor === undefined || valor === null ? "" : String(valor);
    };
    set("Nombre", p ? p.nombre : "");
    set("Sku", p ? p.sku : "");
    set("Categoria", p ? p.categoria : "");
    set("Marca", p ? p.marca : "");
    set("PrecioCosto", p && p.precioCosto > 0 ? Utils.numeroParaCampo(p.precioCosto) : "");
    set("PrecioVenta", p && p.precioVenta > 0 ? Utils.numeroParaCampo(p.precioVenta) : "");
    set("Stock", p && p.stock !== null ? p.stock : "");
    set("StockMin", p && p.stockMin > 0 ? p.stockMin : "");
    set("Imagen", p ? p.imagen : "");
    document.getElementById("prodActivo").checked = p ? p.activo !== false : true;
    abrirModal("modalProducto");
  },

  guardarProducto: async () => {
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
      ? await ServicioProductos.actualizar(_editandoProductoId, datos)
      : await ServicioProductos.crear(datos);
    const erroEl = document.getElementById("erroProducto");
    if (!res.ok) {
      erroEl.textContent = res.error.message;
      return;
    }
    erroEl.textContent = "";
    _editandoProductoId = null;
    cerrarModal("modalProducto");
    atualizarTudo();
    toast(`${res.data.producto.nombre} salvo.`, "exito");
  },

  excluirProduto: (ds) => {
    const p = ServicioProductos.obtener(ds.id);
    if (!p) return;
    const id = p.id;
    confirmarAccion(
      "Excluir produto",
      `"${p.nombre}" será removido do catálogo. As vendas já registradas manterão o nome do produto.`,
      async () => {
        const res = await ServicioProductos.eliminar(id);
        if (!res.ok) return toast(res.error.message, "error");
        atualizarTudo();
        toast("Produto excluído.");
      },
      "Excluir",
    );
  },

  atualizarProductos: () => atualizarProductos(),
});
