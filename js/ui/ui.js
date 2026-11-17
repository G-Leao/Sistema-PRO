/* ============================================================
   UI — helpers de interface: ações delegadas, toast, modais,
   confirmações, tema, tooltip, selects e estados vazios.
   Nenhum handler inline (onclick) é usado em HTML gerado: tudo
   passa por data-acao / data-input / data-change / data-submit.
   ============================================================ */

const Acoes = {};

function registrarAcoes(mapa) {
  Object.assign(Acoes, mapa);
}

function _executarAcao(nome, el, ev) {
  const fn = Acoes[nome];
  if (!fn) return;
  try {
    const r = fn(el.dataset, el, ev);
    if (r && typeof r.catch === "function") r.catch(_erroInesperado);
  } catch (e) {
    _erroInesperado(e);
  }
}

function _erroInesperado(e) {
  console.error(e);
  toast("Ocorreu um erro inesperado. Tente novamente.", "error");
}

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-acao]");
  if (!el || el.disabled) return;
  _executarAcao(el.dataset.acao, el, ev);
});
document.addEventListener("input", (ev) => {
  const el = ev.target.closest("[data-input]");
  if (el) _executarAcao(el.dataset.input, el, ev);
});
document.addEventListener("change", (ev) => {
  const el = ev.target.closest("[data-change]");
  if (el) _executarAcao(el.dataset.change, el, ev);
});
document.addEventListener("submit", (ev) => {
  const el = ev.target.closest("[data-submit]");
  if (!el) return;
  ev.preventDefault();
  _executarAcao(el.dataset.submit, el, ev);
});

/* Imagens quebradas (foto/produto): troca pela inicial, sem onerror inline */
document.addEventListener(
  "error",
  (ev) => {
    const img = ev.target;
    if (img && img.tagName === "IMG" && img.dataset.inicial !== undefined) {
      const pai = img.parentNode;
      if (pai) pai.textContent = img.dataset.inicial;
    }
  },
  true,
);

/* ===== Toast ===== */
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
  _toastTimer = setTimeout(() => el.classList.remove("mostrar"), tipo === "error" ? 4200 : 2600);
}

/* ===== Modais (foco, Esc, clique fora, armadilha de Tab) ===== */
const _pilhaModais = [];

function abrirModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  _pilhaModais.push({ id, retorno: document.activeElement });
  el.classList.add("activo");
  el.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-abierta");
  const alvo =
    el.querySelector("input:not([type=hidden]):not([readonly]), select, textarea") ||
    el.querySelector("button.btn-primary, .btn-danger, button");
  if (alvo) setTimeout(() => alvo.focus(), 30);
}

function cerrarModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("activo");
  el.setAttribute("aria-hidden", "true");
  const i = _pilhaModais.map((m) => m.id).lastIndexOf(id);
  if (i > -1) {
    const [m] = _pilhaModais.splice(i, 1);
    if (m.retorno && m.retorno.focus && document.contains(m.retorno)) m.retorno.focus();
  }
  if (!document.querySelector(".modal-overlay.activo")) document.body.classList.remove("modal-abierta");
}

document.addEventListener("keydown", (ev) => {
  const topo = _pilhaModais[_pilhaModais.length - 1];
  if (!topo) return;
  if (ev.key === "Escape") {
    ev.preventDefault();
    cerrarModal(topo.id);
    return;
  }
  if (ev.key === "Tab") {
    const el = document.getElementById(topo.id);
    const foc = Array.from(el.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])")).filter(
      (n) => n.offsetParent !== null,
    );
    if (!foc.length) return;
    const primeiro = foc[0];
    const ultimo = foc[foc.length - 1];
    if (ev.shiftKey && document.activeElement === primeiro) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && document.activeElement === ultimo) {
      ev.preventDefault();
      primeiro.focus();
    }
  }
});

document.addEventListener("mousedown", (ev) => {
  if (ev.target.classList && ev.target.classList.contains("modal-overlay")) cerrarModal(ev.target.id);
});

let _confirmarCallback = null;

function confirmarAccion(titulo, mensaje, onConfirmar, botonTexto) {
  document.getElementById("confirmTitulo").textContent = titulo;
  document.getElementById("confirmMensaje").textContent = mensaje;
  document.getElementById("confirmBoton").textContent = botonTexto || "Confirmar";
  _confirmarCallback = onConfirmar || (() => {});
  abrirModal("modalConfirmar");
}

registrarAcoes({
  fecharModal: (ds) => cerrarModal(ds.arg),
  executarConfirmacao: async () => {
    const cb = _confirmarCallback;
    _confirmarCallback = null;
    cerrarModal("modalConfirmar");
    if (cb) await cb();
  },
});

/* ===== Tema (claro/escuro), preferência salva em Store ===== */
function temaAtual() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  Store.definirPreferencia(Store.CHAVES.tema, tema);
  const btn = document.getElementById("btnTema");
  if (btn) {
    const rotulo = tema === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
    btn.setAttribute("aria-label", rotulo);
    btn.title = rotulo;
  }
}

registrarAcoes({
  alternarTema: () => aplicarTema(temaAtual() === "dark" ? "light" : "dark"),
});

/* ===== Tooltip (gráficos) ===== */
(function iniciarTooltip() {
  let tip = null;
  const mostrar = (ev) => {
    const alvo = ev.target.closest && ev.target.closest("[data-tip]");
    tip = tip || document.getElementById("tooltip");
    if (!tip) return;
    if (!alvo) {
      tip.classList.remove("visivel");
      return;
    }
    tip.textContent = "";
    alvo.dataset.tip.split("\n").forEach((linha, i) => {
      const d = document.createElement(i === 0 ? "strong" : "div");
      d.textContent = linha;
      tip.appendChild(d);
    });
    tip.classList.add("visivel");
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = ev.clientX + 14;
    let y = ev.clientY - h - 12;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
    if (y < 8) y = ev.clientY + 16;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
  };
  document.addEventListener("pointermove", mostrar);
  document.addEventListener("pointerdown", mostrar);
  document.addEventListener("pointerleave", () => tip && tip.classList.remove("visivel"));
  window.addEventListener("scroll", () => tip && tip.classList.remove("visivel"), true);
})();

/* ===== Helpers de HTML ===== */
function icone(nome) {
  return `<svg class="ico" aria-hidden="true"><use href="#i-${nome}" /></svg>`;
}

/* titulo e texto devem ser texto simples (são escapados aqui) */
function estadoVacio(iconeNome, titulo, texto) {
  return `<div class="empty-state"><div class="empty-icon">${icone(iconeNome)}</div><p class="empty-title">${Utils.esc(titulo)}</p><p>${Utils.esc(texto)}</p></div>`;
}

function avatarHtml(nome, url, classe) {
  const inicial = Utils.esc(Utils.iniciais(nome));
  const seguro = Utils.urlSegura(url);
  const img = seguro ? `<img src="${Utils.esc(seguro)}" alt="" data-inicial="${inicial}" loading="lazy" referrerpolicy="no-referrer">` : inicial;
  return `<div class="${classe || "avatar"}">${img}</div>`;
}

function llenarSelect(id, opciones, conVacio, textoVacio) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = "";
  if (opciones.length === 0 && textoVacio && !conVacio) {
    const op = document.createElement("option");
    op.value = "";
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
  const lista = incluirInactivos ? State.productos : State.productos.filter((p) => p.activo !== false);
  return lista
    .map((p) => ({
      value: p.id,
      label: p.activo === false ? `${p.nombre} (inativo)` : p.nombre,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt"));
}

function chipVariacao(delta, rotulo) {
  if (delta === null || delta === undefined) return `<span class="trend trend-neutro">${Utils.esc(rotulo)}: sem base</span>`;
  const sobe = delta >= 0;
  return `<span class="trend ${sobe ? "trend-up" : "trend-down"}">${icone(sobe ? "up" : "down")}${Utils.numero(Math.abs(delta), 0)}% <span class="trend-rotulo">${Utils.esc(rotulo)}</span></span>`;
}
