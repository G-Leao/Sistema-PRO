/* ============================================================
   PANTALLA VENDEDORES — equipo, desempeño, metas y comisiones
   ============================================================ */

let _editandoVendedorId = null;

function abrirModalVendedor(id) {
  _editandoVendedorId = id || null;
  const v = _editandoVendedorId ? ServicioVendedores.obtener(_editandoVendedorId) : null;
  document.getElementById("modalVendedorTitulo").textContent = v ? "Editar vendedor" : "Nuevo vendedor";
  document.getElementById("erroVendedor").textContent = "";
  const set = (field, valor) => {
    const el = document.getElementById(`vend${field}`);
    if (el) el.value = valor === undefined || valor === null ? "" : String(valor);
  };
  set("Nombre", v ? v.nombre : "");
  set("Foto", v ? v.foto : "");
  set("Cargo", v ? v.cargo : "");
  set("Meta", v ? (v.metaMensual > 0 ? String(v.metaMensual).replace(".", ",") : "") : "");
  set("Comision", v ? (v.comision > 0 ? String(v.comision).replace(".", ",") : "") : "");
  abrirModal("modalVendedor");
}

function guardarVendedor() {
  const _val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : "";
  };
  const datos = {
    nombre: _val("vendNombre"),
    foto: _val("vendFoto"),
    cargo: _val("vendCargo"),
    metaMensual: _val("vendMeta"),
    comision: _val("vendComision"),
  };
  const res = _editandoVendedorId
    ? ServicioVendedores.actualizar(_editandoVendedorId, datos)
    : ServicioVendedores.crear(datos);
  const errorEl = document.getElementById("erroVendedor");
  if (!res.ok) {
    errorEl.textContent = res.error;
    toast(res.error, "error");
    return;
  }
  errorEl.textContent = "";
  _editandoVendedorId = null;
  cerrarModal("modalVendedor");
  atualizarTudo();
  toast(datos.nombre + " guardado", "exito");
}

function eliminarVendedor(id) {
  const v = ServicioVendedores.obtener(id);
  if (!v) return;
  confirmarAccion(
    "Eliminar vendedor",
    `Se eliminará a "${v.nombre}" y también sus ${(() => {
      const n = State.ventas.filter((x) => x.vendedorId === id).length;
      return n === 1 ? "1 venta" : `${n} ventas`;
    })()}. Esta acción no se puede deshacer.`,
    () => {
      const res = ServicioVendedores.eliminar(id);
      if (res.ok) {
        atualizarTudo();
        toast("Vendedor eliminado");
      } else {
        toast(res.error, "error");
      }
    },
    "Eliminar",
  );
}

function _fotoVendedor(v) {
  const inicial = Utils.esc(v.nombre.charAt(0).toUpperCase());
  if (v.foto) {
    return `<div class="avatar"><img src="${Utils.esc(v.foto)}" alt="" onerror="this.parentNode.innerHTML='${inicial}'"></div>`;
  }
  return `<div class="avatar">${inicial}</div>`;
}

function _barraMeta(pct) {
  return `<div class="barra-mini"><div style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>`;
}

function atualizarVendedores() {
  const lista = document.getElementById("listaVendedores");
  const panel = document.getElementById("perfPanel");
  if (!lista) return;

  const validas = ServicioMetricas.validas();
  const resumenes = State.vendedores.map((v) => ({
    vendedor: v,
    ...ServicioMetricas.resumenVendedor(v.nombre, validas),
  }));

  /* ===== Panel de desempeño (top 3 por facturación) ===== */
  if (panel) {
    if (!resumenes.length) {
      panel.innerHTML = "";
    } else {
      const top = [...resumenes]
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);
      const medallas = ["🥇", "🥈", "🥉"];
      panel.innerHTML = top
        .map(
          (r, i) => `
          <div class="perf-card">
            <div class="puesto">${medallas[i]} #${i + 1}</div>
            <div class="row-title">${Utils.esc(r.vendedor.nombre)}</div>
            <div class="row-sub">${r.total > 0 ? Utils.moneda(r.total) : "Sin ventas"} · ${Utils.moneda(r.comision)} comisión</div>
            ${_barraMeta(r.pctMeta)}
            <div class="row-sub">${r.pctMeta.toFixed(0)}% de la meta del mes</div>
          </div>`,
        )
        .join("");
    }
  }

  if (!resumenes.length) {
    lista.innerHTML = estadoVacio(
      "◔",
      "Ningún vendedor registrado",
      "Crea el primer vendedor con el botón «+ Nuevo vendedor».",
    );
    return;
  }

  lista.innerHTML = resumenes
    .map((r) => {
      const v = r.vendedor;
      const metasBadge = r.pctMeta >= 100 && r.meta > 0
        ? '<span class="badge badge-ok">Meta cumplida</span>'
        : "";
      return `
      <div class="row-card">
        ${_fotoVendedor(v)}
        <div class="row-main">
          <div class="row-title">${Utils.esc(v.nombre)} ${metasBadge}</div>
          <div class="row-sub">${[v.cargo, `Comisión ${r.comisionPct}%`, `Meta ${Utils.moneda(r.meta)}`].map(Utils.esc).join(" · ")}</div>
          <div class="metricas-mini">
            <span class="metrica-mini">Vendido <b>${Utils.moneda(r.total)}</b></span>
            <span class="metrica-mini">Ventas <b>${r.num}</b></span>
            <span class="metrica-mini">Ticket <b>${Utils.moneda(r.ticket)}</b></span>
            <span class="metrica-mini">Comisión <b>${Utils.moneda(r.comision)}</b></span>
            <span class="metrica-mini">Meta mes <b>${r.pctMeta.toFixed(0)}%</b></span>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-icon" title="Editar" onclick="abrirModalVendedor('${v.id}')">✎</button>
          <button class="btn btn-sm btn-icon btn-danger-ghost" title="Eliminar" onclick="eliminarVendedor('${v.id}')">✕</button>
        </div>
      </div>`;
    })
    .join("");
}