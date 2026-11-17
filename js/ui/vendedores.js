/* ============================================================
   TELA VENDEDORES — equipe, ranking, metas e comissões
   ============================================================ */

let _editandoVendedorId = null;

function _barraMeta(pct, rotulo) {
  const v = Math.min(100, Math.max(0, pct));
  return `<div class="barra" role="progressbar" aria-label="${Utils.esc(rotulo)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v)}"><div style="width:${v}%"></div></div>`;
}

function atualizarVendedores() {
  const lista = document.getElementById("listaVendedores");
  const painel = document.getElementById("perfPanel");
  if (!lista) return;

  const ranking = ServicioMetricas.rankingEquipe();

  if (!ranking.length) {
    painel.innerHTML = "";
    lista.innerHTML = estadoVacio("vendedores", "Nenhum vendedor cadastrado", 'Cadastre o primeiro vendedor em "Novo vendedor".');
    return;
  }

  /* Pódio: top 3 por faturamento */
  painel.innerHTML = ranking
    .slice(0, 3)
    .map(
      (r, i) => `
      <div class="card podio-card podio-${i + 1}">
        <div class="podio-pos">${icone("trophy")}<span>${i + 1}º lugar</span></div>
        <div class="podio-id">${avatarHtml(r.vendedor.nombre, r.vendedor.foto, "avatar avatar-lg")}
          <div><div class="nome-linha">${Utils.esc(r.vendedor.nombre)}</div><div class="sub-linha">${Utils.esc(r.vendedor.cargo || "Vendedor")}</div></div></div>
        <div class="podio-valor">${Utils.moneda(r.total)}</div>
        <div class="sub-linha">${r.num} venda(s) · comissão ${Utils.moneda(r.comision)}</div>
      </div>`,
    )
    .join("");

  lista.innerHTML = ranking
    .map((r, i) => {
      const v = r.vendedor;
      const meta =
        r.meta > 0
          ? `${_barraMeta(r.pctMeta, "Atingimento da meta mensal")}<div class="meta-linha"><span>Meta do mês: ${Utils.moneda(r.actualMes)} de ${Utils.moneda(r.meta)}</span><strong>${Utils.percentual(r.pctReal)}</strong></div>`
          : '<div class="meta-linha muted">Sem meta mensal definida</div>';
      return `
      <article class="card vend-card">
        <header class="vend-head">
          <span class="pos pos-${i < 3 ? i + 1 : "n"}">${i + 1}</span>
          ${avatarHtml(v.nombre, v.foto, "avatar avatar-lg")}
          <div class="vend-id">
            <div class="nome-linha">${Utils.esc(v.nombre)} ${r.meta > 0 && r.pctReal >= 100 ? '<span class="badge badge-ok">Meta atingida</span>' : ""}</div>
            <div class="sub-linha">${Utils.esc(v.cargo || "Vendedor")} · Comissão ${Utils.percentual(r.comisionPct, 1)}</div>
          </div>
          <div class="row-actions">
            <button type="button" class="btn btn-sm btn-icon" title="Editar vendedor" aria-label="Editar vendedor" data-acao="abrirModalVendedor" data-id="${Utils.esc(v.id)}">${icone("edit")}</button>
            <button type="button" class="btn btn-sm btn-icon btn-danger-ghost" title="Excluir vendedor" aria-label="Excluir vendedor" data-acao="excluirVendedor" data-id="${Utils.esc(v.id)}">${icone("trash")}</button>
          </div>
        </header>
        <dl class="vend-kpis">
          <div><dt>Faturamento</dt><dd>${Utils.moneda(r.total)}</dd></div>
          <div><dt>Vendas</dt><dd>${Utils.numero(r.num)}</dd></div>
          <div><dt>Ticket médio</dt><dd>${Utils.moneda(r.ticket)}</dd></div>
          <div><dt>Comissão acumulada</dt><dd>${Utils.moneda(r.comision)}</dd></div>
          <div><dt>Meta mensal</dt><dd>${r.meta > 0 ? Utils.moneda(r.meta) : "—"}</dd></div>
        </dl>
        ${meta}
      </article>`;
    })
    .join("");
}

registrarAcoes({
  abrirModalVendedor: (ds) => {
    _editandoVendedorId = ds.id || null;
    const v = _editandoVendedorId ? ServicioVendedores.obtener(_editandoVendedorId) : null;
    document.getElementById("modalVendedorTitulo").textContent = v ? "Editar vendedor" : "Novo vendedor";
    document.getElementById("erroVendedor").textContent = "";
    const set = (campo, valor) => {
      document.getElementById(`vend${campo}`).value = valor === undefined || valor === null ? "" : String(valor);
    };
    set("Nombre", v ? v.nombre : "");
    set("Foto", v ? v.foto : "");
    set("Cargo", v ? v.cargo : "");
    set("Meta", v && v.metaMensual > 0 ? Utils.numeroParaCampo(v.metaMensual) : "");
    set("Comision", v && v.comision > 0 ? Utils.numeroParaCampo(v.comision) : "");
    abrirModal("modalVendedor");
  },

  guardarVendedor: async () => {
    const g = (id) => document.getElementById(id).value;
    const datos = {
      nombre: g("vendNombre"),
      foto: g("vendFoto"),
      cargo: g("vendCargo"),
      metaMensual: g("vendMeta"),
      comision: g("vendComision"),
    };
    const res = _editandoVendedorId
      ? await ServicioVendedores.actualizar(_editandoVendedorId, datos)
      : await ServicioVendedores.crear(datos);
    const erroEl = document.getElementById("erroVendedor");
    if (!res.ok) {
      erroEl.textContent = res.error.message;
      return;
    }
    erroEl.textContent = "";
    _editandoVendedorId = null;
    cerrarModal("modalVendedor");
    atualizarTudo();
    toast(`${res.data.vendedor.nombre} salvo.`, "exito");
  },

  excluirVendedor: (ds) => {
    const v = ServicioVendedores.obtener(ds.id);
    if (!v) return;
    const id = v.id;
    const n = State.ventas.filter((x) => x.vendedorId === id).length;
    confirmarAccion(
      "Excluir vendedor",
      `"${v.nombre}" será excluído e também ${n === 1 ? "1 venda associada" : `${n} vendas associadas`} (o estoque das válidas será devolvido). Esta ação não pode ser desfeita.`,
      async () => {
        const res = await ServicioVendedores.eliminar(id);
        if (!res.ok) return toast(res.error.message, "error");
        atualizarTudo();
        toast("Vendedor excluído.");
      },
      "Excluir",
    );
  },
});
