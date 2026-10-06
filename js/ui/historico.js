/* ============================================================
   PANTALLA HISTÓRICO — búsqueda, filtros, orden, detalle,
   edición, anulación y borrado de ventas.
   ============================================================ */

const _HIS_POR_PAGINA = 12;
let _hisPagina = 1;
let _editandoVentaId = null;

function rellenarFiltrosHistorico() {
  llenarSelect("hisVendedor", opcionesVendedores(), true, "Todos");
  llenarSelect("hisProducto", opcionesProductos(true), true, "Todos");
  llenarSelect("hisPago", FORMAS_PAGAMENTO, true, "Todas");
}

function filtraVentas() {
  const busca = (
    document.getElementById("hisBusca").value || ""
  ).toLowerCase().trim();
  const desde = document.getElementById("hisDesde").value;
  const hasta = document.getElementById("hisHasta").value;
  const vendedor = document.getElementById("hisVendedor").value;
  const producto = document.getElementById("hisProducto").value;
  const pago = document.getElementById("hisPago").value;
  const orden = document.getElementById("hisOrden").value;

  let lista = State.ventas.filter((v) => {
    if (busca) {
      const texto = `${v.productoNombre} ${v.vendedorNombre} ${v.observacion}`.toLowerCase();
      if (!texto.includes(busca)) return false;
    }
    if (desde && Utils.claveDia(v.fecha) < desde) return false;
    if (hasta && Utils.claveDia(v.fecha) > hasta) return false;
    if (vendedor && v.vendedorId !== vendedor) return false;
    if (producto && v.productoId !== producto) return false;
    if (pago && v.pagamento !== pago) return false;
    return true;
  });

  lista.sort((a, b) => {
    switch (orden) {
      case "antiguo":
        return (a.fecha || "").localeCompare(b.fecha || "");
      case "valorMayor":
        return b.valorFinal - a.valorFinal;
      case "valorMenor":
        return a.valorFinal - b.valorFinal;
      case "produtoAsc":
        return (a.productoNombre || "").localeCompare(b.productoNombre || "", "pt");
      default:
        return (b.fecha || "").localeCompare(a.fecha || "");
    }
  });
  return lista;
}

function _filaHistorico(v) {
  const estadoBadge =
    v.estado === "valida"
      ? '<span class="badge badge-ok">Válida</span>'
      : '<span class="badge badge-aviso">Anulada</span>';
  return `
    <tr class="${v.estado === "anulada" ? "fila-anulada" : ""}">
      <td class="td-fecha">${Utils.fmtFechaHora(v.fecha)}</td>
      <td>${Utils.esc(v.productoNombre)}</td>
      <td class="td-num">${v.cantidad}</td>
      <td>${Utils.esc(v.vendedorNombre)}</td>
      <td>${Utils.esc(v.pagamento)}</td>
      <td class="td-valor">${Utils.moneda(v.valorFinal)}</td>
      <td>${estadoBadge}</td>
      <td class="td-acciones">
        <button class="btn btn-sm btn-icon" title="Ver detalle" onclick="verDetalleVenta('${v.id}')">👁</button>
        <button class="btn btn-sm btn-icon" title="Editar" onclick="abrirEdicionVenta('${v.id}')">✎</button>
        <button class="btn btn-sm btn-icon" title="${v.estado === "valida" ? "Anular" : "Reactivar"}" onclick="alternarEstadoVenta('${v.id}')">${v.estado === "valida" ? "⊘" : "↺"}</button>
        <button class="btn btn-sm btn-icon btn-danger-ghost" title="Eliminar" onclick="eliminarVenta('${v.id}')">✕</button>
      </td>
    </tr>`;
}

function atualizarHistorico() {
  const lista = filtraVentas();
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / _HIS_POR_PAGINA));
  if (_hisPagina > paginas) _hisPagina = paginas;
  const inicio = (_hisPagina - 1) * _HIS_POR_PAGINA;
  const pagina = lista.slice(inicio, inicio + _HIS_POR_PAGINA);

  const info = document.getElementById("hisInfo");
  if (info)
    info.textContent = `${total} venta(s) encontrada(s) · página ${_hisPagina} de ${paginas}`;

  const prev = document.getElementById("hisPrev");
  const next = document.getElementById("hisNext");
  if (prev) prev.disabled = _hisPagina <= 1;
  if (next) next.disabled = _hisPagina >= paginas;

  const cuerpo = document.getElementById("cuerpoHistorico");
  if (!cuerpo) return;
  if (!total) {
    cuerpo.innerHTML = `<tr><td colspan="8">${estadoVacio(
      "↗",
      "Sin resultados",
      "Ajusta los filtros o registra ventas para verlas aquí.",
    )}</td></tr>`;
    return;
  }
  cuerpo.innerHTML = pagina.map(_filaHistorico).join("");
}

function cambiarPaginaHistorico(delta) {
  _hisPagina = Math.max(1, _hisPagina + delta);
  atualizarHistorico();
}

function limpiarFiltrosHistorico() {
  const ids = ["hisBusca", "hisDesde", "hisHasta", "hisVendedor", "hisProducto", "hisPago", "hisOrden"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  _hisPagina = 1;
  atualizarHistorico();
}

function verDetalleVenta(id) {
  const v = State.ventas.find((x) => x.id === id);
  if (!v) return;
  const filas = [
    ["Fecha y hora", Utils.fmtFechaHora(v.fecha)],
    ["Producto", `${v.productoNombre} (cantidad ${v.cantidad})`],
    ["Valor unitario", Utils.moneda(v.valorUnitario)],
    ["Descuento", Utils.moneda(v.descuento)],
    ["Valor final", Utils.moneda(v.valorFinal)],
    ["Vendedor", v.vendedorNombre],
    ["Forma de pago", v.pagamento],
    ["Estado", v.estado === "valida" ? "Válida" : "Anulada"],
    ["Observación", v.observacion || "—"],
  ];
  const contenedor = document.getElementById("detalleContenido");
  contenedor.innerHTML = filas
    .map(
      ([k, val]) =>
        `<div class="detalle-fila"><span>${Utils.esc(k)}</span><strong>${Utils.esc(val)}</strong></div>`,
    )
    .join("");
  abrirModal("modalDetalleVenta");
}

function abrirEdicionVenta(id) {
  const v = State.ventas.find((x) => x.id === id);
  if (!v) return;
  _editandoVentaId = v.id;
  document.getElementById("modalVentaTitulo").textContent = "Editar venta";
  rellenarSelectsVenta("edit");
  rellenarFormularioVenta("edit", v);
  abrirModal("modalVenta");
}

function guardarEdicionVenta() {
  if (!_editandoVentaId) return;
  const datos = leerCamposVenta("edit");
  const res = ServicioVentas.actualizar(_editandoVentaId, datos);
  if (!res.ok) {
    toast(res.error, "error");
    return;
  }
  _editandoVentaId = null;
  cerrarModal("modalVenta");
  atualizarTudo();
  toast("Venta actualizada", "exito");
}

function eliminarVenta(id) {
  const v = State.ventas.find((x) => x.id === id);
  if (!v) return;
  confirmarAccion(
    "Eliminar venta",
    `Se eliminará la venta de ${v.productoNombre} por ${Utils.moneda(v.valorFinal)}. Esta acción no se puede deshacer.`,
    () => {
      const res = ServicioVentas.eliminar(id);
      if (res.ok) {
        atualizarTudo();
        toast("Venta eliminada");
      } else {
        toast(res.error, "error");
      }
    },
    "Eliminar",
  );
}

function alternarEstadoVenta(id) {
  const v = State.ventas.find((x) => x.id === id);
  if (!v) return;
  if (v.estado === "valida") {
    confirmarAccion(
      "Anular venta",
      `La venta de ${v.productoNombre} se marcará como anulada y se devolverá el stock. No contará en las métricas.`,
      () => {
        const res = ServicioVentas.anular(id);
        if (res.ok) {
          atualizarTudo();
          toast("Venta anulada");
        } else {
          toast(res.error, "error");
        }
      },
      "Anular",
    );
  } else {
    const res = ServicioVentas.revalidar(id);
    if (res.ok) {
      atualizarTudo();
      toast("Venta reactivada", "exito");
    } else {
      toast(res.error, "error");
    }
  }
}

function eliminarTodasVentas() {
  confirmarAccion(
    "Eliminar todas las ventas",
    "Se eliminará TODO el historial de ventas y se devolverá el stock de las ventas válidas. Esta acción no se puede deshacer.",
    () => {
      ServicioVentas.eliminarTodas();
      atualizarTudo();
      toast("Historial eliminado");
    },
    "Eliminar todo",
  );
}