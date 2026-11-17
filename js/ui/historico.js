/* ============================================================
   TELA HISTÓRICO — pesquisa, filtros, ordenação, paginação,
   detalhe, edição, anulação e exclusão de vendas.
   ============================================================ */

const _HIS_POR_PAGINA = 12;
let _hisPagina = 1;
let _editandoVentaId = null;

function rellenarFiltrosHistorico() {
  const guardar = ["hisVendedor", "hisProducto", "hisPago"].map((id) => [id, document.getElementById(id).value]);
  llenarSelect("hisVendedor", opcionesVendedores(), true, "Todos");
  llenarSelect("hisProducto", opcionesProductos(true), true, "Todos");
  llenarSelect("hisPago", FORMAS_PAGAMENTO, true, "Todas");
  guardar.forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (v && Array.from(el.options).some((o) => o.value === v)) el.value = v;
  });
}

function filtraVentas() {
  const val = (id) => document.getElementById(id).value;
  const busca = (val("hisBusca") || "").toLowerCase().trim();
  const desde = val("hisDesde");
  const hasta = val("hisHasta");
  const vendedor = val("hisVendedor");
  const producto = val("hisProducto");
  const pago = val("hisPago");
  const estado = val("hisEstado");
  const orden = val("hisOrden");

  const lista = State.ventas.filter((v) => {
    if (busca) {
      const texto = `${v.productoNombre} ${v.vendedorNombre} ${v.observacion} ${v.pagamento}`.toLowerCase();
      if (!texto.includes(busca)) return false;
    }
    if (desde && Utils.claveDia(v.fecha) < desde) return false;
    if (hasta && Utils.claveDia(v.fecha) > hasta) return false;
    if (vendedor && v.vendedorId !== vendedor) return false;
    if (producto && v.productoId !== producto) return false;
    if (pago && v.pagamento !== pago) return false;
    if (estado && v.estado !== estado) return false;
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

function _btnAcao(acao, id, titulo, icon, extra) {
  return `<button type="button" class="btn btn-sm btn-icon ${extra || ""}" title="${titulo}" aria-label="${titulo}" data-acao="${acao}" data-id="${Utils.esc(id)}">${icone(icon)}</button>`;
}

function _linhaHistorico(v) {
  const valida = v.estado === "valida";
  const badge = valida ? '<span class="badge badge-ok">Válida</span>' : '<span class="badge badge-aviso">Anulada</span>';
  return `
    <tr class="${valida ? "" : "fila-anulada"}">
      <td data-label="Data" class="td-fecha">${Utils.fmtFechaHora(v.fecha)}</td>
      <td data-label="Produto" class="td-principal">${Utils.esc(v.productoNombre)}</td>
      <td data-label="Qtd." class="num">${Utils.numero(v.cantidad, 3)}</td>
      <td data-label="Vendedor">${Utils.esc(v.vendedorNombre)}</td>
      <td data-label="Pagamento">${Utils.esc(v.pagamento)}</td>
      <td data-label="Valor" class="num td-valor">${Utils.moneda(v.valorFinal)}</td>
      <td data-label="Situação">${badge}</td>
      <td class="acoes">
        ${_btnAcao("verDetalheVenda", v.id, "Ver detalhes", "eye")}
        ${_btnAcao("editarVenda", v.id, "Editar venda", "edit")}
        ${_btnAcao("alternarEstadoVenda", v.id, valida ? "Anular venda" : "Revalidar venda", valida ? "ban" : "undo")}
        ${_btnAcao("excluirVenda", v.id, "Excluir venda", "trash", "btn-danger-ghost")}
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

  const soma = Utils.redondear(lista.filter((v) => v.estado === "valida").reduce((s, v) => s + v.valorFinal, 0));
  document.getElementById("hisInfo").textContent = total
    ? `${total} venda(s) encontrada(s) · Total das válidas: ${Utils.moneda(soma)}`
    : "Nenhuma venda encontrada";
  document.getElementById("hisPaginaInfo").textContent = `Página ${_hisPagina} de ${paginas}`;
  document.getElementById("hisPrev").disabled = _hisPagina <= 1;
  document.getElementById("hisNext").disabled = _hisPagina >= paginas;

  const cuerpo = document.getElementById("cuerpoHistorico");
  if (!total) {
    cuerpo.innerHTML = `<tr class="linha-vazia"><td colspan="8">${estadoVacio(
      "historico",
      State.ventas.length ? "Nenhum resultado" : "Nenhuma venda registrada",
      State.ventas.length ? "Ajuste os filtros para ver outras vendas." : "As vendas registradas aparecerão aqui.",
    )}</td></tr>`;
    return;
  }
  cuerpo.innerHTML = pagina.map(_linhaHistorico).join("");
}

function _ventaPorId(ds) {
  return State.ventas.find((x) => x.id === ds.id);
}

registrarAcoes({
  filtrosHistorico: () => {
    _hisPagina = 1;
    atualizarHistorico();
  },

  paginaHistorico: (ds) => {
    _hisPagina = Math.max(1, _hisPagina + Number(ds.arg));
    atualizarHistorico();
  },

  limparFiltrosHistorico: () => {
    ["hisBusca", "hisDesde", "hisHasta", "hisVendedor", "hisProducto", "hisPago", "hisEstado"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    document.getElementById("hisOrden").value = "reciente";
    _hisPagina = 1;
    atualizarHistorico();
  },

  verDetalheVenda: (ds) => {
    const v = _ventaPorId(ds);
    if (!v) return;
    const filas = [
      ["Data e hora", Utils.fmtFechaHora(v.fecha)],
      ["Produto", `${v.productoNombre} (quantidade ${Utils.numero(v.cantidad, 3)})`],
      ["Valor unitário", Utils.moneda(v.valorUnitario)],
      ["Desconto", Utils.moneda(v.descuento)],
      ["Valor final", Utils.moneda(v.valorFinal)],
      ["Vendedor", v.vendedorNombre],
      ["Forma de pagamento", v.pagamento],
      ["Situação", v.estado === "valida" ? "Válida" : "Anulada"],
      ["Observações", v.observacion || "—"],
    ];
    document.getElementById("detalleContenido").innerHTML = filas
      .map(([k, val]) => `<div class="detalhe-linha"><span>${Utils.esc(k)}</span><strong>${Utils.esc(val)}</strong></div>`)
      .join("");
    abrirModal("modalDetalleVenta");
  },

  editarVenda: (ds) => {
    const v = _ventaPorId(ds);
    if (!v) return;
    _editandoVentaId = v.id;
    document.getElementById("modalVentaTitulo").textContent = "Editar venda";
    document.getElementById("erroVenta").textContent = "";
    rellenarSelectsVenta("edit");
    rellenarFormularioVenta("edit", v);
    abrirModal("modalVenta");
  },

  guardarEdicionVenta: async () => {
    if (!_editandoVentaId) return;
    const res = await ServicioVentas.actualizar(_editandoVentaId, leerCamposVenta("edit"));
    if (!res.ok) {
      document.getElementById("erroVenta").textContent = res.error.message;
      return toast(res.error.message, "error");
    }
    _editandoVentaId = null;
    cerrarModal("modalVenta");
    atualizarTudo();
    toast("Venda atualizada.", "exito");
  },

  excluirVenda: (ds) => {
    const v = _ventaPorId(ds);
    if (!v) return;
    const id = v.id;
    confirmarAccion(
      "Excluir venda",
      `A venda de ${v.productoNombre} no valor de ${Utils.moneda(v.valorFinal)} será excluída${v.estado === "valida" ? " e o estoque será devolvido" : ""}. Esta ação não pode ser desfeita. Se quiser preservar o histórico, use "Anular".`,
      async () => {
        const res = await ServicioVentas.eliminar(id);
        if (!res.ok) return toast(res.error.message, "error");
        atualizarTudo();
        toast("Venda excluída.");
      },
      "Excluir",
    );
  },

  alternarEstadoVenda: async (ds) => {
    const v = _ventaPorId(ds);
    if (!v) return;
    const id = v.id;
    if (v.estado === "valida") {
      confirmarAccion(
        "Anular venda",
        `A venda de ${v.productoNombre} será marcada como anulada e o estoque será devolvido. Ela deixa de contar nas métricas, mas continua no histórico.`,
        async () => {
          const res = await ServicioVentas.anular(id);
          if (!res.ok) return toast(res.error.message, "error");
          atualizarTudo();
          toast("Venda anulada.");
        },
        "Anular venda",
      );
    } else {
      const res = await ServicioVentas.revalidar(id);
      if (!res.ok) return toast(res.error.message, "error");
      atualizarTudo();
      toast("Venda revalidada.", "exito");
    }
  },

  eliminarTodasVentas: () => {
    confirmarAccion(
      "Excluir todas as vendas",
      "TODO o histórico de vendas será excluído e o estoque das vendas válidas será devolvido. Esta ação não pode ser desfeita.",
      async () => {
        const res = await ServicioVentas.eliminarTodas();
        if (!res.ok) return toast(res.error.message, "error");
        atualizarTudo();
        toast("Histórico excluído.");
      },
      "Excluir tudo",
    );
  },
});
