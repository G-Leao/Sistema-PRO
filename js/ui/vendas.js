/* ============================================================
   TELA VENDAS — formulário de registro com cálculo automático.
   Os campos são gerados uma vez e reutilizados no formulário de
   nova venda (prefixo "nueva") e no modal de edição ("edit").
   ============================================================ */

function camposVentaHtml(pre) {
  return `
    <div class="field campo-largo">
      <label for="${pre}_producto">Produto *</label>
      <select id="${pre}_producto" data-change="produtoAlterado" data-pre="${pre}"></select>
      <div class="hint" id="${pre}_estoqueInfo"></div>
    </div>
    <div class="field">
      <label for="${pre}_cantidad">Quantidade *</label>
      <input type="number" id="${pre}_cantidad" min="0" step="any" value="1" data-input="calcularVenda" data-pre="${pre}" />
    </div>
    <div class="field">
      <label for="${pre}_valorUnitario">Valor unitário (R$) *</label>
      <input type="text" inputmode="decimal" id="${pre}_valorUnitario" data-input="valorUnitarioDigitado" data-pre="${pre}" placeholder="0,00" autocomplete="off" />
    </div>
    <div class="field">
      <label for="${pre}_descuento">Desconto (R$)</label>
      <input type="text" inputmode="decimal" id="${pre}_descuento" value="0" data-input="calcularVenda" data-pre="${pre}" placeholder="0,00" autocomplete="off" />
    </div>
    <div class="field">
      <label for="${pre}_pagamento">Forma de pagamento *</label>
      <select id="${pre}_pagamento"></select>
    </div>
    <div class="field">
      <label for="${pre}_vendedor">Vendedor *</label>
      <select id="${pre}_vendedor" data-change="calcularVenda" data-pre="${pre}"></select>
    </div>
    <div class="field">
      <label for="${pre}_fecha">Data e hora</label>
      <input type="datetime-local" id="${pre}_fecha" />
    </div>
    <div class="field campo-largo">
      <label for="${pre}_observacion">Observações</label>
      <input type="text" id="${pre}_observacion" maxlength="200" placeholder="Opcional" autocomplete="off" />
    </div>
  `;
}

function resumoVendaHtml(pre) {
  return `
    <dl class="resumo">
      <div><dt>Subtotal</dt><dd id="${pre}_resBruto">R$ 0,00</dd></div>
      <div><dt>Desconto</dt><dd id="${pre}_resDesc" class="neg">− R$ 0,00</dd></div>
      <div class="resumo-total"><dt>Valor final</dt><dd id="${pre}_valorFinal">R$ 0,00</dd></div>
      <div><dt>Comissão estimada</dt><dd id="${pre}_resComissao">—</dd></div>
    </dl>
    <div class="form-erro" id="${pre}_aviso" role="alert"></div>`;
}

const _cv = (pre, id) => document.getElementById(`${pre}_${id}`);

function rellenarSelectsVenta(pre) {
  const selP = _cv(pre, "producto");
  const selV = _cv(pre, "vendedor");
  if (!selP || !selV) return;
  const valorProducto = selP.value;
  const valorVendedor = selV.value;

  /* No modal de edição, produtos inativos continuam disponíveis para não
     trocar silenciosamente o produto de uma venda existente. */
  llenarSelect(`${pre}_producto`, opcionesProductos(pre === "edit"), false, "Cadastre um produto primeiro");
  llenarSelect(`${pre}_vendedor`, opcionesVendedores(), false, "Cadastre um vendedor primeiro");
  llenarSelect(`${pre}_pagamento`, FORMAS_PAGAMENTO, false);

  if (valorProducto && Array.from(selP.options).some((o) => o.value === valorProducto)) selP.value = valorProducto;
  if (valorVendedor && Array.from(selV.options).some((o) => o.value === valorVendedor)) selV.value = valorVendedor;
  aplicarProdutoSelecionado(pre, false);
}

/* Sugere o preço de venda do produto, exceto se o usuário já digitou um valor */
function aplicarProdutoSelecionado(pre, forcarPreco) {
  const sel = _cv(pre, "producto");
  const vu = _cv(pre, "valorUnitario");
  if (!sel || !vu) return;
  const p = State.productos.find((x) => x.id === sel.value);
  if (p && p.precioVenta > 0 && (forcarPreco || vu.dataset.manual !== "1" || vu.value.trim() === "")) {
    vu.value = Utils.numeroParaCampo(p.precioVenta.toFixed(2));
    vu.dataset.manual = "0";
  } else if (!p && vu.dataset.manual !== "1") {
    vu.value = "";
  }
  calcularVenda(pre);
}

function calcularVenda(pre) {
  const q = _cv(pre, "cantidad");
  if (!q) return null;
  const calc = ServicioVentas.calcular({
    cantidad: q.value,
    valorUnitario: _cv(pre, "valorUnitario").value,
    descuento: _cv(pre, "descuento").value,
  });
  const set = (id, t) => {
    const el = _cv(pre, id);
    if (el) el.textContent = t;
  };
  set("resBruto", Utils.moneda(calc.bruto));
  set("resDesc", "− " + Utils.moneda(Math.min(calc.descuento, calc.bruto || calc.descuento)));
  set("valorFinal", Utils.moneda(calc.valorFinal));

  const vend = State.vendedores.find((v) => v.id === (_cv(pre, "vendedor") || {}).value);
  set("resComissao", vend && vend.comision > 0 ? `${Utils.moneda(calc.valorFinal * (vend.comision / 100))} (${Utils.percentual(vend.comision, 1)})` : "—");

  const aviso = _cv(pre, "aviso");
  if (aviso) aviso.textContent = calc.descuento > calc.bruto && calc.bruto > 0 ? "O desconto é maior que o valor bruto da venda." : "";

  const prod = State.productos.find((x) => x.id === (_cv(pre, "producto") || {}).value);
  const info = _cv(pre, "estoqueInfo");
  if (info) {
    if (!prod) info.textContent = "";
    else if (prod.stock === null) info.textContent = "Produto sem controle de estoque.";
    else info.textContent = `Estoque disponível: ${Utils.numero(prod.stock, 2)}`;
  }
  return calc;
}

function leerCamposVenta(pre) {
  return {
    productoId: _cv(pre, "producto").value,
    cantidad: Utils.parsearNumero(_cv(pre, "cantidad").value),
    valorUnitario: Utils.parsearNumero(_cv(pre, "valorUnitario").value),
    descuento: Utils.parsearNumero(_cv(pre, "descuento").value) || 0,
    pagamento: _cv(pre, "pagamento").value,
    vendedorId: _cv(pre, "vendedor").value,
    fecha: _cv(pre, "fecha").value,
    observacion: _cv(pre, "observacion").value,
  };
}

function _selecionar(sel, valor, rotuloFallback) {
  if (Array.from(sel.options).some((o) => o.value === valor)) {
    sel.value = valor;
  } else {
    /* Cadastro removido: obriga a escolher outro, sem trocar às escondidas */
    const op = document.createElement("option");
    op.value = "";
    op.textContent = rotuloFallback;
    sel.insertBefore(op, sel.firstChild);
    sel.value = "";
  }
}

function rellenarFormularioVenta(pre, venta) {
  _selecionar(_cv(pre, "producto"), venta.productoId, `${venta.productoNombre} (removido — selecione outro)`);
  _cv(pre, "cantidad").value = venta.cantidad;
  const vu = _cv(pre, "valorUnitario");
  vu.value = Utils.numeroParaCampo(venta.valorUnitario);
  vu.dataset.manual = "1"; // preserva o valor histórico da venda
  _cv(pre, "descuento").value = venta.descuento > 0 ? Utils.numeroParaCampo(venta.descuento) : "0";
  _selecionar(_cv(pre, "vendedor"), venta.vendedorId, `${venta.vendedorNombre} (removido — selecione outro)`);
  _cv(pre, "pagamento").value = FORMAS_PAGAMENTO.includes(venta.pagamento) ? venta.pagamento : "Outros";
  _cv(pre, "fecha").value = Utils.normalizarFecha(venta.fecha) || "";
  _cv(pre, "observacion").value = venta.observacion || "";
  calcularVenda(pre);
}

function limpiarFormularioVenta(pre) {
  const q = _cv(pre, "cantidad");
  if (!q) return;
  q.value = "1";
  const vu = _cv(pre, "valorUnitario");
  vu.value = "";
  vu.dataset.manual = "0";
  _cv(pre, "descuento").value = "0";
  _cv(pre, "observacion").value = "";
  _cv(pre, "fecha").value = Utils.ahora();
  aplicarProdutoSelecionado(pre, true);
}

function atualizarListaReciente() {
  const el = document.getElementById("listaRecientes");
  if (!el) return;
  const recientes = [...State.ventas]
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
    .slice(0, 5);
  if (!recientes.length) {
    el.innerHTML = estadoVacio("receipt", "Nenhuma venda registrada", "Registre a primeira venda no formulário acima.");
    return;
  }
  el.innerHTML = recientes
    .map(
      (v) => `
      <div class="row-card ${v.estado === "anulada" ? "is-anulada" : ""}">
        <div class="row-main">
          <div class="row-title">${Utils.esc(v.productoNombre)} <span class="badge badge-soft">×${Utils.numero(v.cantidad, 3)}</span>${v.estado === "anulada" ? ' <span class="badge badge-aviso">Anulada</span>' : ""}</div>
          <div class="row-sub">${Utils.fmtFechaHora(v.fecha)} · ${Utils.esc(v.vendedorNombre)} · ${Utils.esc(v.pagamento)}</div>
        </div>
        <div class="row-value">${Utils.moneda(v.valorFinal)}</div>
      </div>`,
    )
    .join("");
}

registrarAcoes({
  /* Trocar o produto sempre sugere o preço do novo produto (editável depois) */
  produtoAlterado: (ds) => aplicarProdutoSelecionado(ds.pre, true),
  calcularVenda: (ds) => calcularVenda(ds.pre),
  valorUnitarioDigitado: (ds, el) => {
    el.dataset.manual = "1";
    calcularVenda(ds.pre);
  },
  limparFormularioVenda: (ds) => limpiarFormularioVenta(ds.arg),

  guardarNuevaVenta: async () => {
    const res = await ServicioVentas.registrar(leerCamposVenta("nueva"));
    if (!res.ok) return toast(res.error.message, "error");
    limpiarFormularioVenta("nueva");
    atualizarTudo();
    toast("Venda registrada com sucesso.", "exito");
  },
});
