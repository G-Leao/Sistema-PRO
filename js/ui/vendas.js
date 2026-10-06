/* ============================================================
   PANTALLA VENTAS — formulario de registro con cálculo automático
   ============================================================ */

function camposVentaHtml(pre) {
  return `
    <div class="field">
      <label>Producto *</label>
      <select id="${pre}_producto" onchange="productoCambio('${pre}')"></select>
    </div>
    <div class="field">
      <label>Cantidad *</label>
      <input type="number" id="${pre}_cantidad" min="1" step="1" value="1" oninput="calcularVenta('${pre}')" />
    </div>
    <div class="field">
      <label>Valor unitario (R$)</label>
      <input type="number" id="${pre}_valorUnitario" min="0" step="0.01" oninput="calcularVenta('${pre}')" placeholder="0,00" />
    </div>
    <div class="field">
      <label>Descuento (R$)</label>
      <input type="number" id="${pre}_descuento" min="0" step="0.01" value="0" oninput="calcularVenta('${pre}')" placeholder="0,00" />
    </div>
    <div class="field">
      <label>Valor final</label>
      <input type="text" id="${pre}_valorFinal" readonly class="valor-final" placeholder="R$ 0,00" />
    </div>
    <div class="field">
      <label>Vendedor *</label>
      <select id="${pre}_vendedor"></select>
    </div>
    <div class="field">
      <label>Forma de pago *</label>
      <select id="${pre}_pagamento"></select>
    </div>
    <div class="field">
      <label>Fecha y hora</label>
      <input type="datetime-local" id="${pre}_fecha" />
    </div>
    <div class="field campo-largo">
      <label>Observación</label>
      <input type="text" id="${pre}_observacion" maxlength="200" placeholder="Opcional" />
    </div>
  `;
}

const _valVenta = (pre, id) => document.getElementById(`${pre}_${id}`);

function rellenarSelectsVenta(pre) {
  const preProducto = _valVenta(pre, "producto");
  const preVendedor = _valVenta(pre, "vendedor");
  const valorProducto = preProducto ? preProducto.value : "";
  const valorVendedor = preVendedor ? preVendedor.value : "";

  llenarSelect(`${pre}_producto`, opcionesProductos(false), false, "Primero crea un producto");
  llenarSelect(`${pre}_vendedor`, opcionesVendedores(), false, "Primero crea un vendedor");
  llenarSelect(`${pre}_pagamento`, FORMAS_PAGAMENTO, false);

  const selP = _valVenta(pre, "producto");
  const selV = _valVenta(pre, "vendedor");
  if (selP && valorProducto) {
    const existe = Array.from(selP.options).some((o) => o.value === valorProducto);
    if (existe) selP.value = valorProducto;
  }
  if (selV && valorVendedor) {
    const existe = Array.from(selV.options).some((o) => o.value === valorVendedor);
    if (existe) selV.value = valorVendedor;
  }
  productoCambio(pre);
}

/* Al elegir producto se sugiere el precio de venta configurado */
function productoCambio(pre) {
  const sel = _valVenta(pre, "producto");
  const vu = _valVenta(pre, "valorUnitario");
  if (!sel || !vu) return;
  const id = sel.value;
  const p = State.productos.find((x) => x.id === id);
  if (p && p.precioVenta > 0 && (!vu.dataset.autofillado || vu.value === "" || vu.value === "0")) {
    vu.value = p.precioVenta.toFixed(2);
    vu.dataset.autofillado = "1";
  } else if (!p) {
    vu.value = "";
  }
  calcularVenta(pre);
}

function calcularVenta(pre) {
  const elFinal = _valVenta(pre, "valorFinal");
  if (!elFinal) return;
  const calc = ServicioVentas.calcular({
    cantidad: _valVenta(pre, "cantidad").value,
    valorUnitario: _valVenta(pre, "valorUnitario").value,
    descuento: _valVenta(pre, "descuento").value,
  });
  elFinal.value = Utils.moneda(calc.valorFinal);
  return calc;
}

function leerCamposVenta(pre) {
  return {
    productoId: _valVenta(pre, "producto").value,
    cantidad: Utils.parsearNumero(_valVenta(pre, "cantidad").value),
    valorUnitario: Utils.parsearNumero(_valVenta(pre, "valorUnitario").value),
    descuento: Utils.parsearNumero(_valVenta(pre, "descuento").value) || 0,
    pagamento: _valVenta(pre, "pagamento").value,
    vendedorId: _valVenta(pre, "vendedor").value,
    fecha: _valVenta(pre, "fecha").value,
    observacion: _valVenta(pre, "observacion").value,
  };
}

function rellenarFormularioVenta(pre, venta) {
  _valVenta(pre, "producto").value = venta.productoId;
  _valVenta(pre, "cantidad").value = venta.cantidad;
  _valVenta(pre, "valorUnitario").value = String(venta.valorUnitario).replace(".", ",");
  _valVenta(pre, "valorUnitario").dataset.autofillado = "0";
  _valVenta(pre, "descuento").value = venta.descuento > 0 ? String(venta.descuento).replace(".", ",") : "0";
  _valVenta(pre, "valorFinal").value = Utils.moneda(venta.valorFinal);
  _valVenta(pre, "vendedor").value = venta.vendedorId;
  _valVenta(pre, "pagamento").value = venta.pagamento;
  _valVenta(pre, "fecha").value = venta.fecha;
  _valVenta(pre, "observacion").value = venta.observacion || "";
  calcularVenta(pre);
}

function limpiarFormularioVenta(pre) {
  const d = Utils.ahora();
  const preCantidad = _valVenta(pre, "cantidad");
  if (preCantidad) preCantidad.value = "1";
  const preVu = _valVenta(pre, "valorUnitario");
  if (preVu) {
    preVu.value = "";
    preVu.dataset.autofillado = "0";
  }
  const preDesc = _valVenta(pre, "descuento");
  if (preDesc) preDesc.value = "0";
  const preObs = _valVenta(pre, "observacion");
  if (preObs) preObs.value = "";
  const preFecha = _valVenta(pre, "fecha");
  if (preFecha) preFecha.value = d;
  calcularVenta(pre);
}

function guardarNuevaVenta() {
  const datos = leerCamposVenta("nueva");
  const res = ServicioVentas.registrar(datos);
  if (!res.ok) {
    toast(res.error, "error");
    return;
  }
  limpiarFormularioVenta("nueva");
  atualizarTudo();
  toast("Venta registrada", "exito");
}

function atualizarListaReciente() {
  const contenedor = document.getElementById("listaRecientes");
  if (!contenedor) return;
  const recientes = [...ServicioMetricas.validas()]
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
    .slice(0, 5);
  if (!recientes.length) {
    contenedor.innerHTML = estadoVacio(
      "↗",
      "Sin ventas aún",
      "Registra la primera venta con el formulario superior.",
    );
    return;
  }
  contenedor.innerHTML = recientes
    .map(
      (v) => `
      <div class="row-card">
        <div class="row-main">
          <div class="row-title">${Utils.esc(v.productoNombre)} <span class="badge badge-soft">×${v.cantidad}</span></div>
          <div class="row-sub">${Utils.fmtFechaHora(v.fecha)} · ${Utils.esc(v.vendedorNombre)} · ${Utils.esc(v.pagamento)}</div>
        </div>
        <div class="row-value">${Utils.moneda(v.valorFinal)}</div>
      </div>`,
    )
    .join("");
}