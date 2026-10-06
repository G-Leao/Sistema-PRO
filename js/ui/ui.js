/* ============================================================
   UI — helpers de interfaz: toast, modales, confirmaciones,
   selects y estados vacíos.
   ============================================================ */

let _toastTimer;

function toast(msg, tipo) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("toast-error", "toast-exito");
  if (tipo === "error") el.classList.add("toast-error");
  else if (tipo === "exito") el.classList.add("toast-exito");
  el.classList.add("mostrar");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("mostrar"), 2400);
}

function abrirModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("activo");
  document.body.classList.add("modal-abierta");
  const primero = el.querySelector("input, select, textarea, button");
  if (primero) setTimeout(() => primero.focus(), 30);
}

function cerrarModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("activo");
  if (!document.querySelector(".modal-overlay.activo")) {
    document.body.classList.remove("modal-abierta");
  }
}

let _confirmarCallback = null;

function confirmarAccion(titulo, mensaje, onConfirmar, botonTexto) {
  document.getElementById("confirmTitulo").textContent = titulo;
  document.getElementById("confirmMensaje").textContent = mensaje;
  document.getElementById("confirmBoton").textContent = botonTexto || "Confirmar";
  _confirmarCallback = onConfirmar || (() => {});
  abrirModal("modalConfirmar");
}

function ejecutarConfirmacion() {
  const cb = _confirmarCallback;
  _confirmarCallback = null;
  cerrarModal("modalConfirmar");
  if (cb) cb();
}

function estadoVacio(icono, titulo, texto) {
  return `<div class="empty-state"><div class="icon">${icono}</div><p><strong>${titulo}</strong></p><p>${texto}</p></div>`;
}

function llenarSelect(id, opciones, conVacio, textoVacio) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = "";
  if (opciones.length === 0 && textoVacio) {
    const op = document.createElement("option");
    op.textContent = textoVacio;
    el.appendChild(op);
    return;
  }
  if (conVacio) {
    const op = document.createElement("option");
    op.value = "";
    op.textContent = textoVacio || "Todos";
    el.appendChild(op);
  }
  opciones.forEach((o) => {
    const op = document.createElement("option");
    op.value = o.value === undefined ? String(o) : o.value;
    op.textContent = o.label === undefined ? String(o) : o.label;
    el.appendChild(op);
  });
}

function opcionesVendedores() {
  return State.vendedores
    .map((v) => ({ value: v.id, label: v.nombre }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt"));
}

function opcionesProductos(incluirInactivos) {
  const lista = incluirInactivos
    ? State.productos
    : State.productos.filter((p) => p.activo !== false);
  return lista
    .map((p) => ({
      value: p.id,
      label: p.activo === false ? `${p.nombre} (inactivo)` : p.nombre,
      producto: p,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt"));
}