/* ============================================================
   PANTALLA DASHBOARD — métricas, metas, comparación y gráficos
   ============================================================ */

function _metaStatus(idStatus, idFaltam, meta, actual, texto) {
  const st = document.getElementById(idStatus);
  const fa = document.getElementById(idFaltam);
  if (!st) return;
  if (meta <= 0) {
    st.textContent = "Sin meta definida";
    st.classList.remove("ok");
    if (fa) fa.textContent = `Define la ${texto} en el panel de metas.`;
  } else if (actual >= meta) {
    st.textContent = "Meta alcanzada";
    st.classList.add("ok");
    if (fa) fa.textContent = "¡Objetivo cumplido!";
  } else {
    st.textContent = "En curso";
    st.classList.remove("ok");
    if (fa) fa.textContent = `Faltan ${Utils.moneda(meta - actual)} para cumplir la ${texto}.`;
  }
}

function actualizarDashboard() {
  const validas = ServicioMetricas.validas();
  const resumen = ServicioMetricas.resumen(validas);
  const metaDia = ServicioMetricas.metaDia(validas, State.config.metas.diaria || 0);
  const metaMes = ServicioMetricas.metaMes(validas, State.config.metas.mensual || 0);
  const comp = ServicioMetricas.comparativaMes(validas);

  /* ===== Cards de métricas ===== */
  const compValor =
    comp.delta === null
      ? "—"
      : `<span class="${comp.delta >= 0 ? "trend-up" : "trend-down"}">${comp.delta >= 0 ? "▲" : "▼"} ${Math.abs(comp.delta).toFixed(0)}%</span>`;
  const cards = [
    { label: "Total vendido", value: Utils.moneda(resumen.totalVendido), hint: `${resumen.numVentas} venta(s) válida(s)` },
    { label: "Ventas", value: String(resumen.numVentas), hint: "Registradas" },
    { label: "Ticket médio", value: Utils.moneda(resumen.ticketMedio), hint: "Por venta" },
    { label: "Produtos vendidos", value: String(resumen.totalUnidades), hint: "Unidades totales" },
    { label: "Vendedores", value: String(resumen.numVendedores), hint: "Integrantes del equipo" },
    { label: "Más vendido", value: Utils.esc(resumen.masVendido ? resumen.masVendido.nombre : "—"), hint: resumen.masVendido ? `${resumen.masVendido.unidades} unidad(es) vendida(s)` : "Sin ventas aún", small: true },
    { label: "Vendedor destacado", value: Utils.esc(resumen.mejorVendedor ? resumen.mejorVendedor.nombre : "—"), hint: resumen.mejorVendedor ? `Mayor volumen: ${Utils.moneda(resumen.mejorVendedor.total)}` : "Sin ventas aún", small: true },
    { label: "vs mes anterior", value: compValor, hint: comp.delta === null ? "Sin datos del mes anterior" : `Este mes: ${Utils.moneda(comp.actual)}`, small: true },
  ];

  const grid = document.getElementById("gridCards");
  if (grid) {
    grid.innerHTML = cards
      .map(
        (c) =>
          `<div class="stat-card"><div class="label">${c.label}</div><div class="value${c.small ? " small" : ""}">${c.value}</div><div class="hint">${c.hint}</div></div>`,
      )
      .join("");
  }

  /* ===== Panel de metas (diaria + mensual) ===== */
  const setBarra = (id, pct) => {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.min(100, Math.max(0, pct)) + "%";
  };
  const setTexto = (id, texto) => {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  };

  setBarra("barraMetaDia", metaDia.pct);
  setTexto("metaDiaAtual", Utils.moneda(metaDia.totalHoy));
  setTexto("metaDiaAlvo", State.config.metas.diaria > 0 ? Utils.moneda(State.config.metas.diaria) : "0,00");
  setTexto("metaDiaPct", Math.floor(metaDia.pct) + "%");
  _metaStatus("metaDiaStatus", "metaDiaFaltam", State.config.metas.diaria || 0, metaDia.totalHoy, "meta del día");

  setBarra("barraMetaMes", metaMes.pct);
  setTexto("metaMesAtual", Utils.moneda(metaMes.totalMes));
  setTexto("metaMesAlvo", State.config.metas.mensual > 0 ? Utils.moneda(State.config.metas.mensual) : "0,00");
  setTexto("metaMesPct", Math.floor(metaMes.pct) + "%");
  _metaStatus("metaMesStatus", "metaMesFaltam", State.config.metas.mensual || 0, metaMes.totalMes, "meta del mes");
}

/* ===== Gráficos (Chart.js) ===== */

const _instanciasGraficos = {};

function _paletaGraficos() {
  return {
    barra: "#00c896",
    grid: "rgba(255,255,255,.08)",
    texto: "#a0a0b8",
    borde: "rgba(255,255,255,.2)",
    multi: ["#00c896", "#00ffcc", "#4db6ff", "#e0a84d", "#ff7a9c", "#b18cff", "#ff9d5c", "#5cd9a6"],
  };
}

function _destruirGrafico(canvasId) {
  const instancia = _instanciasGraficos[canvasId];
  if (instancia) {
    instancia.destroy();
    delete _instanciasGraficos[canvasId];
  }
}

function _mostrarVacio(canvasId, texto) {
  const vacio = document.getElementById("vacio" + canvasId);
  if (vacio) {
    vacio.textContent = texto;
    vacio.style.display = "flex";
  }
}

function _ocultarVacio(canvasId) {
  const vacio = document.getElementById("vacio" + canvasId);
  if (vacio) vacio.style.display = "none";
}

function _tieneDatos(valores) {
  return valores && valores.length && valores.some((v) => v > 0);
}

function _renderBarra(canvasId, labels, valores, fmt, horizontal) {
  _destruirGrafico(canvasId);
  if (!_tieneDatos(valores)) {
    _mostrarVacio(canvasId, "Sin ventas en este período. Registra la primera venta para ver el gráfico.");
    return;
  }
  _ocultarVacio(canvasId);
  if (typeof Chart === "undefined") return;
  const cores = _paletaGraficos();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  _instanciasGraficos[canvasId] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: valores,
          backgroundColor: cores.barra,
          borderRadius: 6,
          maxBarThickness: 30,
        },
      ],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: cores.texto, font: { size: horizontal ? 11 : null }, maxRotation: horizontal ? 0 : 45 },
        },
        y: {
          grid: { color: cores.grid },
          ticks: { color: cores.texto, font: { size: 11 }, callback: (val) => (fmt ? fmt(val) : val) },
          beginAtZero: true,
        },
      },
    },
  });
}

function _renderDona(canvasId, labels, valores) {
  _destruirGrafico(canvasId);
  if (!_tieneDatos(valores)) {
    _mostrarVacio(canvasId, "Sin ventas registradas.");
    return;
  }
  _ocultarVacio(canvasId);
  if (typeof Chart === "undefined") return;
  const cores = _paletaGraficos();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  _instanciasGraficos[canvasId] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: valores,
          backgroundColor: cores.multi,
          borderColor: cores.borde,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: cores.texto, font: { size: 11 }, boxWidth: 10 },
        },
      },
    },
  });
}

function actualizarGraficos() {
  const validas = ServicioMetricas.validas();
  const dia = ServicioMetricas.serieDiaria(validas, 14);
  const mes = ServicioMetricas.serieMensual(validas, 12);
  const rankProd = ServicioMetricas.rankingProductos(validas, 6);
  const rankVend = ServicioMetricas.rankingVendedores(validas, 6);
  const dist = ServicioMetricas.distribucionPagos(validas);

  _renderBarra("graficoFaturamentoDia", dia.labels, dia.valores, Utils.moneda, false);
  _renderBarra("graficoPeriodo", mes.labels, mes.valores, Utils.moneda, false);
  _renderBarra("graficoVendedores", rankVend.map((r) => r.nombre), rankVend.map((r) => r.total), Utils.moneda, false);
  _renderBarra("graficoProductos", rankProd.map((r) => r.nombre), rankProd.map((r) => r.unidades), null, true);
  _renderDona("graficoPagos", dist.labels, dist.valores);
}

function guardarMetas() {
  const diaria = Utils.parsearNumero(document.getElementById("metaDiaInput").value);
  const mensual = Utils.parsearNumero(document.getElementById("metaMesInput").value);
  const d = !isNaN(diaria) && diaria > 0 ? Utils.redondear(diaria) : 0;
  const m = !isNaN(mensual) && mensual > 0 ? Utils.redondear(mensual) : 0;
  if (d <= 0 && m <= 0) {
    toast("Ingresa al menos una meta válida", "error");
    return;
  }
  State.config.metas.diaria = d;
  State.config.metas.mensual = m;
  State.guardarConfig();
  document.getElementById("metaDiaInput").value = "";
  document.getElementById("metaMesInput").value = "";
  atualizarDashboard();
  toast("Metas guardadas", "exito");
}

function quitarMetas() {
  confirmarAccion(
    "Quitar metas",
    "Se eliminarán la meta diaria y la meta mensual configuradas.",
    () => {
      State.config.metas.diaria = 0;
      State.config.metas.mensual = 0;
      State.guardarConfig();
      atualizarDashboard();
      toast("Metas eliminadas");
    },
    "Quitar metas",
  );
}