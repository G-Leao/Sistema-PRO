/* ============================================================
   SERVIÇO DE MÉTRICAS — cálculos do dashboard e desempenho.
   Funções puras sobre as vendas: não tocam UI nem persistência.
   Agrupamentos usam o ID do vendedor/produto (o nome só é usado
   para vendas legadas ainda sem vínculo).
   ============================================================ */

const ServicioMetricas = {
  validas(lista) {
    return (lista !== undefined ? lista : State.ventas).filter((v) => v.estado === "valida");
  },

  _chaveVendedor(v) {
    return v.vendedorId || "nome:" + String(v.vendedorNombre || "").trim().toLowerCase();
  },
  _chaveProduto(v) {
    return v.productoId || "nome:" + String(v.productoNombre || "").trim().toLowerCase();
  },

  _soma(lista, filtro) {
    let total = 0;
    let n = 0;
    lista.forEach((v) => {
      if (filtro(v)) {
        total = Utils.redondear(total + v.valorFinal);
        n++;
      }
    });
    return { total, n };
  },

  _delta(atual, anterior) {
    return anterior > 0 ? Utils.redondear(((atual - anterior) / anterior) * 100) : null;
  },

  resumen(lista) {
    const validas = this.validas(lista);
    let totalVendido = 0;
    let totalUnidades = 0;
    const porProduto = {};
    const porVendedor = {};

    validas.forEach((v) => {
      totalVendido = Utils.redondear(totalVendido + v.valorFinal);
      totalUnidades += v.cantidad;
      const kp = this._chaveProduto(v);
      porProduto[kp] = porProduto[kp] || { nombre: v.productoNombre, unidades: 0 };
      porProduto[kp].unidades += v.cantidad;
      const kv = this._chaveVendedor(v);
      porVendedor[kv] = porVendedor[kv] || { nombre: v.vendedorNombre, total: 0 };
      porVendedor[kv].total = Utils.redondear(porVendedor[kv].total + v.valorFinal);
    });

    const numVentas = validas.length;
    const ticketMedio = numVentas > 0 ? Utils.redondear(totalVendido / numVentas) : 0;
    const masVendido = Object.values(porProduto).sort((a, b) => b.unidades - a.unidades)[0] || null;
    const mejor = Object.values(porVendedor).sort((a, b) => b.total - a.total)[0] || null;

    return {
      totalVendido,
      numVentas,
      ticketMedio,
      totalUnidades,
      numVendedores: State.vendedores.length,
      masVendido: masVendido && masVendido.unidades > 0 ? masVendido : null,
      mejorVendedor: mejor && mejor.total > 0 ? mejor : null,
    };
  },

  /* Faturamento do dia, com comparação com o dia anterior */
  dia(lista) {
    const validas = this.validas(lista);
    const hoje = Utils.hoyDia();
    const ontem = Utils.diaRelativo(-1);
    const h = this._soma(validas, (v) => Utils.claveDia(v.fecha) === hoje);
    const o = this._soma(validas, (v) => Utils.claveDia(v.fecha) === ontem);
    return { total: h.total, num: h.n, anterior: o.total, delta: this._delta(h.total, o.total) };
  },

  metaDia(lista, meta) {
    const d = this.dia(lista);
    const pctReal = meta > 0 ? (d.total / meta) * 100 : 0;
    return {
      totalHoy: d.total,
      numHoy: d.num,
      meta,
      pct: Utils.redondear(Math.min(100, pctReal)),
      pctReal: Utils.redondear(pctReal),
      restante: Utils.redondear(Math.max(0, meta - d.total)),
    };
  },

  metaMes(lista, meta) {
    const validas = this.validas(lista);
    const mes = Utils.mesActual(Utils.ahora());
    const m = this._soma(validas, (v) => Utils.claveMes(v.fecha) === mes);
    const pctReal = meta > 0 ? (m.total / meta) * 100 : 0;
    return {
      totalMes: m.total,
      meta,
      pct: Utils.redondear(Math.min(100, pctReal)),
      pctReal: Utils.redondear(pctReal),
      restante: Utils.redondear(Math.max(0, meta - m.total)),
    };
  },

  comparativaMes(lista) {
    const validas = this.validas(lista);
    const ahora = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const mesActual = `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}`;
    const fPrev = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const mesAnterior = `${fPrev.getFullYear()}-${p(fPrev.getMonth() + 1)}`;
    const actual = this._soma(validas, (v) => Utils.claveMes(v.fecha) === mesActual).total;
    const anterior = this._soma(validas, (v) => Utils.claveMes(v.fecha) === mesAnterior).total;
    return { mesActual, mesAnterior, actual, anterior, delta: this._delta(actual, anterior) };
  },

  serieDiaria(lista, dias) {
    const validas = this.validas(lista);
    const hoy = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const labels = [];
    const valores = [];
    const claves = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
      claves.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
      labels.push(`${p(d.getDate())}/${p(d.getMonth() + 1)}`);
      valores.push(0);
    }
    const mapa = {};
    claves.forEach((c, i) => (mapa[c] = i));
    validas.forEach((v) => {
      const idx = mapa[Utils.claveDia(v.fecha)];
      if (idx !== undefined) valores[idx] = Utils.redondear(valores[idx] + v.valorFinal);
    });
    return { labels, valores, claves };
  },

  serieMensual(lista, meses) {
    const validas = this.validas(lista);
    const hoy = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const nombres = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const labels = [];
    const valores = [];
    const claves = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      claves.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}`);
      labels.push(`${nombres[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`);
      valores.push(0);
    }
    const mapa = {};
    claves.forEach((c, i) => (mapa[c] = i));
    validas.forEach((v) => {
      const idx = mapa[Utils.claveMes(v.fecha)];
      if (idx !== undefined) valores[idx] = Utils.redondear(valores[idx] + v.valorFinal);
    });
    return { labels, valores, claves };
  },

  rankingProductos(lista, limite) {
    const mapa = {};
    this.validas(lista).forEach((v) => {
      const k = this._chaveProduto(v);
      mapa[k] = mapa[k] || { nombre: v.productoNombre, unidades: 0, total: 0 };
      mapa[k].unidades += v.cantidad;
      mapa[k].total = Utils.redondear(mapa[k].total + v.valorFinal);
    });
    return Object.values(mapa)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, limite || 6);
  },

  rankingVendedores(lista, limite) {
    const mapa = {};
    this.validas(lista).forEach((v) => {
      const k = this._chaveVendedor(v);
      mapa[k] = mapa[k] || { id: v.vendedorId, nombre: v.vendedorNombre, total: 0, num: 0 };
      mapa[k].total = Utils.redondear(mapa[k].total + v.valorFinal);
      mapa[k].num++;
    });
    return Object.values(mapa)
      .sort((a, b) => b.total - a.total)
      .slice(0, limite || 6);
  },

  distribucionPagos(lista) {
    const mapa = {};
    const totais = {};
    FORMAS_PAGAMENTO.forEach((f) => {
      mapa[f] = 0;
      totais[f] = 0;
    });
    this.validas(lista).forEach((v) => {
      mapa[v.pagamento] = (mapa[v.pagamento] || 0) + 1;
      totais[v.pagamento] = Utils.redondear((totais[v.pagamento] || 0) + v.valorFinal);
    });
    const labels = Object.keys(mapa);
    return { labels, valores: labels.map((l) => mapa[l]), totais: labels.map((l) => totais[l]) };
  },

  /* Resumo individual. Recebe o objeto vendedor (vínculo por ID; vendas
     legadas sem ID são associadas pelo nome). */
  resumenVendedor(vendedor, lista) {
    const nome = String(vendedor.nombre || "").trim().toLowerCase();
    const suyas = this.validas(lista).filter(
      (v) =>
        v.vendedorId === vendedor.id ||
        (!v.vendedorId && String(v.vendedorNombre || "").trim().toLowerCase() === nome),
    );
    const total = Utils.redondear(suyas.reduce((s, v) => s + v.valorFinal, 0));
    const num = suyas.length;
    const ticket = num > 0 ? Utils.redondear(total / num) : 0;
    const comisionPct = vendedor.comision || 0;
    const comision = Utils.redondear(total * (comisionPct / 100));
    const meta = vendedor.metaMensual || 0;
    const mes = Utils.mesActual(Utils.ahora());
    const actualMes = Utils.redondear(
      suyas.filter((v) => Utils.claveMes(v.fecha) === mes).reduce((s, v) => s + v.valorFinal, 0),
    );
    const pctReal = meta > 0 ? (actualMes / meta) * 100 : 0;
    return {
      total,
      num,
      ticket,
      comision,
      comisionPct,
      meta,
      actualMes,
      pctMeta: Utils.redondear(Math.min(100, pctReal)),
      pctReal: Utils.redondear(pctReal),
    };
  },

  /* Ranking completo da equipe (inclui quem ainda não vendeu) */
  rankingEquipe(lista) {
    const validas = this.validas(lista);
    return State.vendedores
      .map((vendedor) => ({ vendedor, ...this.resumenVendedor(vendedor, validas) }))
      .sort((a, b) => b.total - a.total || a.vendedor.nombre.localeCompare(b.vendedor.nombre, "pt"));
  },
};
