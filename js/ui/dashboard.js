/* ============================================================
   TELA DASHBOARD — indicadores, metas, comparativos e gráficos.
   Os gráficos são SVG/HTML próprios (sem biblioteca externa):
   funcionam offline, herdam as cores dos temas via variáveis CSS
   e possuem tooltips.
   ============================================================ */

function _statusMeta(idStatus, idFaltam, meta, atual, restante, rotulo) {
  const st = document.getElementById(idStatus);
  const fa = document.getElementById(idFaltam);
  if (!st) return;
  st.className = "badge";
  if (meta <= 0) {
    st.textContent = "Sem meta definida";
    st.classList.add("badge-soft");
    if (fa) fa.textContent = `Defina a ${rotulo} abaixo para acompanhar o atingimento.`;
  } else if (atual >= meta) {
    st.textContent = "Meta atingida";
    st.classList.add("badge-ok");
    if (fa) fa.textContent = "Objetivo cumprido.";
  } else {
    st.textContent = "Em andamento";
    st.classList.add("badge-info");
    if (fa) fa.textContent = `Faltam ${Utils.moneda(restante)} para atingir a ${rotulo}.`;
  }
}

function _setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function _setBarra(idBarra, idProg, pct, pctReal) {
  const el = document.getElementById(idBarra);
  if (el) el.style.width = Math.min(100, Math.max(0, pct)) + "%";
  const pr = document.getElementById(idProg);
  if (pr) pr.setAttribute("aria-valuenow", String(Math.round(Math.min(100, pctReal))));
}

function atualizarDashboard() {
  const validas = ServicioMetricas.validas();
  const resumo = ServicioMetricas.resumen(validas);
  const dia = ServicioMetricas.dia(validas);
  const comp = ServicioMetricas.comparativaMes(validas);
  const mDia = State.config.metas.diaria || 0;
  const mMes = State.config.metas.mensual || 0;
  const metaDia = ServicioMetricas.metaDia(validas, mDia);
  const metaMes = ServicioMetricas.metaMes(validas, mMes);

  const cards = [
    { ico: "money", label: "Faturamento total", valor: Utils.moneda(resumo.totalVendido), dica: `${Utils.numero(resumo.totalUnidades)} unidade(s) vendida(s)` },
    { ico: "calendar", label: "Faturamento do dia", valor: Utils.moneda(dia.total), extra: chipVariacao(dia.delta, "vs ontem"), dica: `${dia.num} venda(s) hoje` },
    { ico: "trophy", label: "Faturamento do mês", valor: Utils.moneda(metaMes.totalMes), extra: chipVariacao(comp.delta, "vs mês anterior"), dica: `Mês anterior: ${Utils.moneda(comp.anterior)}` },
    { ico: "receipt", label: "Quantidade de vendas", valor: Utils.numero(resumo.numVentas), dica: "Vendas válidas" },
    { ico: "tag", label: "Ticket médio", valor: Utils.moneda(resumo.ticketMedio), dica: "Valor médio por venda" },
    { ico: "vendedores", label: "Vendedores", valor: Utils.numero(resumo.numVendedores), dica: resumo.mejorVendedor ? `Destaque: ${resumo.mejorVendedor.nombre}` : "Equipe cadastrada" },
  ];

  const grid = document.getElementById("gridCards");
  if (grid) {
    grid.innerHTML = cards
      .map(
        (c) => `<div class="card kpi">
          <div class="kpi-top"><span class="label">${Utils.esc(c.label)}</span><span class="kpi-ico">${icone(c.ico)}</span></div>
          <div class="kpi-valor">${Utils.esc(c.valor)}</div>
          <div class="kpi-base">${c.extra || ""}<span class="hint">${Utils.esc(c.dica)}</span></div>
        </div>`,
      )
      .join("");
  }

  _setBarra("barraMetaDia", "progDia", metaDia.pct, metaDia.pctReal);
  _setTexto("metaDiaAtual", Utils.moneda(metaDia.totalHoy));
  _setTexto("metaDiaAlvo", Utils.moneda(mDia));
  _setTexto("metaDiaPct", Utils.percentual(metaDia.pctReal));
  _statusMeta("metaDiaStatus", "metaDiaFaltam", mDia, metaDia.totalHoy, metaDia.restante, "meta diária");

  _setBarra("barraMetaMes", "progMes", metaMes.pct, metaMes.pctReal);
  _setTexto("metaMesAtual", Utils.moneda(metaMes.totalMes));
  _setTexto("metaMesAlvo", Utils.moneda(mMes));
  _setTexto("metaMesPct", Utils.percentual(metaMes.pctReal));
  _statusMeta("metaMesStatus", "metaMesFaltam", mMes, metaMes.totalMes, metaMes.restante, "meta mensal");
}

/* ===== Gráficos ===== */

const _NS = "http://www.w3.org/2000/svg";

function _tem(valores) {
  return valores && valores.some((v) => v > 0);
}

function _escalaNice(max) {
  if (max <= 0) return { max: 1, passo: 0.25 };
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  const topo = nice * exp;
  return { max: topo, passo: topo / 4 };
}

function _svgEl(nome, attrs, texto) {
  const el = document.createElementNS(_NS, nome);
  Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
  if (texto !== undefined) el.textContent = texto;
  return el;
}

/* Barras verticais responsivas; re-renderizadas no resize */
function _graficoBarras(containerId, serie, textoVazio, rotuloTooltip) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = "";
  if (!_tem(serie.valores)) {
    box.innerHTML = `<div class="chart-empty">${Utils.esc(textoVazio)}</div>`;
    return;
  }
  const W = Math.max(280, box.clientWidth || 600);
  const H = 250;
  const m = { t: 12, r: 8, b: 28, l: W < 420 ? 64 : 72 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const { max, passo } = _escalaNice(Math.max(...serie.valores));
  const svg = _svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `${rotuloTooltip}: total ${Utils.moneda(serie.valores.reduce((a, b) => a + b, 0))}` });

  for (let i = 0; i <= 4; i++) {
    const v = passo * i;
    const y = m.t + ih - (v / max) * ih;
    svg.appendChild(_svgEl("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: "c-grid" }));
    svg.appendChild(_svgEl("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", class: "c-text" }, Utils.moedaCompacta(v)));
  }
  const n = serie.valores.length;
  const slot = iw / n;
  const larg = Math.min(34, slot * 0.64);
  const cada = slot < 28 ? Math.ceil(28 / slot) : 1;
  serie.valores.forEach((v, i) => {
    const h = (v / max) * ih;
    const x = m.l + slot * i + (slot - larg) / 2;
    const y = m.t + ih - h;
    const g = _svgEl("g", { "data-tip": `${serie.labels[i]}\n${rotuloTooltip}: ${Utils.moneda(v)}` });
    g.appendChild(_svgEl("rect", { x: m.l + slot * i, y: m.t, width: slot, height: ih, class: "c-hit" }));
    if (v > 0) g.appendChild(_svgEl("rect", { x, y, width: larg, height: Math.max(2, h), rx: 4, class: "c-bar" }));
    else g.appendChild(_svgEl("rect", { x, y: m.t + ih - 2, width: larg, height: 2, rx: 1, class: "c-bar-zero" }));
    svg.appendChild(g);
    if (i % cada === 0 || i === n - 1) {
      svg.appendChild(_svgEl("text", { x: x + larg / 2, y: H - 8, "text-anchor": "middle", class: "c-text" }, serie.labels[i]));
    }
  });
  box.appendChild(svg);
}

function _graficoPagamentos(dist) {
  const box = document.getElementById("graficoPagos");
  if (!box) return;
  box.innerHTML = "";
  const total = dist.valores.reduce((a, b) => a + b, 0);
  if (!total) {
    box.innerHTML = `<div class="chart-empty">Sem vendas registradas.</div>`;
    return;
  }
  const S = 168;
  const R = 70;
  const r = 46;
  const c = S / 2;
  const svg = _svgEl("svg", { viewBox: `0 0 ${S} ${S}`, width: S, height: S, role: "img", "aria-label": `${total} vendas por forma de pagamento`, class: "donut" });
  let ang = -Math.PI / 2;
  const itens = dist.labels.map((l, i) => ({ l, v: dist.valores[i], t: dist.totais[i], i })).filter((x) => x.v > 0);
  itens.forEach((it, idx) => {
    const fatia = (it.v / total) * Math.PI * 2;
    const tip = `${it.l}\n${it.v} venda(s) · ${Utils.percentual((it.v / total) * 100, 1)}\n${Utils.moneda(it.t)}`;
    if (itens.length === 1) {
      const circ = _svgEl("circle", { cx: c, cy: c, r: (R + r) / 2, fill: "none", "stroke-width": R - r, class: `c-s${idx % 6}`, "data-tip": tip });
      svg.appendChild(circ);
    } else {
      const a1 = ang;
      const a2 = ang + fatia;
      const p = (rad, a) => `${c + rad * Math.cos(a)} ${c + rad * Math.sin(a)}`;
      const grande = fatia > Math.PI ? 1 : 0;
      const d = `M ${p(R, a1)} A ${R} ${R} 0 ${grande} 1 ${p(R, a2)} L ${p(r, a2)} A ${r} ${r} 0 ${grande} 0 ${p(r, a1)} Z`;
      svg.appendChild(_svgEl("path", { d, class: `c-f${idx % 6}`, "data-tip": tip }));
    }
    ang += fatia;
  });
  svg.appendChild(_svgEl("text", { x: c, y: c - 2, "text-anchor": "middle", class: "donut-num" }, String(total)));
  svg.appendChild(_svgEl("text", { x: c, y: c + 15, "text-anchor": "middle", class: "c-text" }, total === 1 ? "venda" : "vendas"));
  box.appendChild(svg);

  const leg = document.createElement("ul");
  leg.className = "legenda";
  itens.forEach((it, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="sw sw${idx % 6}"></span><span class="leg-nome">${Utils.esc(it.l)}</span><span class="leg-val">${Utils.percentual((it.v / total) * 100, 0)}</span>`;
    leg.appendChild(li);
  });
  box.appendChild(leg);
}

function _rankingBarrasHtml(itens, vazio) {
  if (!itens.length) return `<div class="chart-empty">${Utils.esc(vazio)}</div>`;
  const max = Math.max(...itens.map((i) => i.valor));
  return `<ol class="ranking">${itens
    .map(
      (it, i) => `<li data-tip="${Utils.esc(it.tip)}">
        <span class="pos pos-${i < 3 ? i + 1 : "n"}">${i + 1}</span>
        ${it.avatar || ""}
        <div class="rk-main">
          <div class="rk-linha"><span class="rk-nome">${Utils.esc(it.nome)}</span><span class="rk-valor">${Utils.esc(it.rotulo)}</span></div>
          <div class="barra barra-fina"><div style="width:${max > 0 ? Math.max(3, (it.valor / max) * 100) : 0}%"></div></div>
        </div>
      </li>`,
    )
    .join("")}</ol>`;
}

function atualizarGraficos() {
  const validas = ServicioMetricas.validas();
  const dia = ServicioMetricas.serieDiaria(validas, 14);
  const mes = ServicioMetricas.serieMensual(validas, 12);
  const rankProd = ServicioMetricas.rankingProductos(validas, 6);
  const rankVend = ServicioMetricas.rankingVendedores(validas, 5);
  const dist = ServicioMetricas.distribucionPagos(validas);

  _graficoBarras("graficoFaturamentoDia", dia, "Sem vendas nos últimos 14 dias.", "Faturamento");
  _graficoBarras("graficoPeriodo", mes, "Sem vendas nos últimos 12 meses.", "Faturamento");
  _graficoPagamentos(dist);

  const rv = document.getElementById("rankingVendedoresDash");
  if (rv) {
    rv.innerHTML = _rankingBarrasHtml(
      rankVend.map((r) => {
        const cad = State.vendedores.find((v) => v.id === r.id);
        return {
          nome: r.nombre,
          valor: r.total,
          rotulo: Utils.moneda(r.total),
          tip: `${r.nombre}\n${Utils.moneda(r.total)} · ${r.num} venda(s)`,
          avatar: avatarHtml(r.nombre, cad ? cad.foto : "", "avatar avatar-sm"),
        };
      }),
      "Sem vendas registradas.",
    );
  }
  const rp = document.getElementById("graficoProdutos");
  if (rp) {
    rp.innerHTML = _rankingBarrasHtml(
      rankProd.map((r) => ({
        nome: r.nombre,
        valor: r.unidades,
        rotulo: `${Utils.numero(r.unidades)} un.`,
        tip: `${r.nombre}\n${Utils.numero(r.unidades)} unidade(s)\n${Utils.moneda(r.total)} faturados`,
      })),
      "Sem vendas registradas.",
    );
  }
}

let _resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (document.getElementById("dashboard").classList.contains("ativa")) atualizarGraficos();
  }, 150);
});

registrarAcoes({
  guardarMetas: async () => {
    const diaria = Utils.parsearNumero(document.getElementById("metaDiaInput").value);
    const mensual = Utils.parsearNumero(document.getElementById("metaMesInput").value);
    const d = !isNaN(diaria) && diaria > 0 ? Utils.redondear(diaria) : null;
    const m = !isNaN(mensual) && mensual > 0 ? Utils.redondear(mensual) : null;
    if (d === null && m === null) {
      toast("Informe ao menos uma meta válida.", "error");
      return;
    }
    if ((d || 0) > LIMITES.valorMax || (m || 0) > LIMITES.valorMax) {
      toast("Valor de meta grande demais.", "error");
      return;
    }
    /* Campo em branco mantém a meta atual (não zera a outra) */
    const res = await State.executar(
      ["config"],
      () => {
        if (d !== null) State.config.metas.diaria = d;
        if (m !== null) State.config.metas.mensual = m;
        return Resultado.ok(null);
      },
      { entidade: "meta", acao: "atualizar" },
    );
    if (!res.ok) return toast(res.error.message, "error");
    document.getElementById("metaDiaInput").value = "";
    document.getElementById("metaMesInput").value = "";
    atualizarDashboard();
    toast("Metas salvas.", "exito");
  },

  removerMetas: () => {
    confirmarAccion(
      "Remover metas",
      "A meta diária e a meta mensal configuradas serão removidas.",
      async () => {
        const res = await State.executar(
          ["config"],
          () => {
            State.config.metas.diaria = 0;
            State.config.metas.mensual = 0;
            return Resultado.ok(null);
          },
          { entidade: "meta", acao: "remover" },
        );
        if (!res.ok) return toast(res.error.message, "error");
        atualizarDashboard();
        toast("Metas removidas.");
      },
      "Remover metas",
    );
  },
});
