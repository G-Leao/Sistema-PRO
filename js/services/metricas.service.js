/* ============================================================
   SERVICIO DE MÉTRICAS — cálculos del dashboard y desempeño.
   Funciones puras sobre las ventas: no tocan la UI ni el storage.
   ============================================================ */

const ServicioMetricas = {
  validas(lista) {
    return (lista !== undefined ? lista : State.ventas).filter(
      (v) => v.estado === "valida",
    );
  },

  resumen(lista) {
    const validas = this.validas(lista);
    let totalVendido = 0;
    let totalUnidades = 0;
    const unidadesPorProducto = {};
    const totalPorVendedor = {};

    validas.forEach((v) => {
      totalVendido = Utils.redondear(totalVendido + v.valorFinal);
      totalUnidades += v.cantidad;
      unidadesPorProducto[v.productoNombre] =
        (unidadesPorProducto[v.productoNombre] || 0) + v.cantidad;
      totalPorVendedor[v.vendedorNombre] = Utils.redondear(
        (totalPorVendedor[v.vendedorNombre] || 0) + v.valorFinal,
      );
    });

    const numVentas = validas.length;
    const ticketMedio = numVentas > 0 ? Utils.redondear(totalVendido / numVentas) : 0;

    let masVendido = null;
    let maxUnidades = 0;
    Object.entries(unidadesPorProducto).forEach(([nombre, unidades]) => {
      if (unidades > maxUnidades) {
        maxUnidades = unidades;
        masVendido = nombre;
      }
    });

    let mejorVendedor = null;
    let maxTotal = 0;
    Object.entries(totalPorVendedor).forEach(([nombre, total]) => {
      if (total > maxTotal) {
        maxTotal = total;
        mejorVendedor = nombre;
      }
    });

    return {
      totalVendido,
      numVentas,
      ticketMedio,
      totalUnidades,
      numVendedores: State.vendedores.length,
      masVendido: masVendido ? { nombre: masVendido, unidades: maxUnidades } : null,
      mejorVendedor: mejorVendedor ? { nombre: mejorVendedor, total: maxTotal } : null,
    };
  },

  metaDia(lista, meta) {
    const validas = this.validas(lista);
    const hoy = Utils.hoyDia();
    let totalHoy = 0;
    let numHoy = 0;
    validas.forEach((v) => {
      if (Utils.claveDia(v.fecha) === hoy) {
        totalHoy = Utils.redondear(totalHoy + v.valorFinal);
        numHoy++;
      }
    });
    const pct = meta > 0 ? Math.min(100, (totalHoy / meta) * 100) : 0;
    return { totalHoy, numHoy, meta, pct: Utils.redondear(pct) };
  },

  metaMes(lista, meta) {
    const validas = this.validas(lista);
    const mes = Utils.mesActual(Utils.ahora());
    let totalMes = 0;
    validas.forEach((v) => {
      if (Utils.claveMes(v.fecha) === mes) {
        totalMes = Utils.redondear(totalMes + v.valorFinal);
      }
    });
    const pct = meta > 0 ? Math.min(100, (totalMes / meta) * 100) : 0;
    return { totalMes, meta, pct: Utils.redondear(pct) };
  },

  comparativaMes(lista) {
    const validas = this.validas(lista);
    const ahora = new Date(Utils.ahora());
    const p = (n) => String(n).padStart(2, "0");
    const mesActual = `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}`;
    const fPrev = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const mesAnterior = `${fPrev.getFullYear()}-${p(fPrev.getMonth() + 1)}`;
    let actual = 0;
    let anterior = 0;
    validas.forEach((v) => {
      const m = Utils.claveMes(v.fecha);
      if (m === mesActual) actual = Utils.redondear(actual + v.valorFinal);
      else if (m === mesAnterior) anterior = Utils.redondear(anterior + v.valorFinal);
    });
    const delta = anterior > 0 ? Utils.redondear(((actual - anterior) / anterior) * 100) : null;
    return { mesActual, mesAnterior, actual, anterior, delta };
  },

  serieDiaria(lista, dias) {
    const validas = this.validas(lista);
    const hoy = new Date(Utils.ahora());
    const p = (n) => String(n).padStart(2, "0");
    const labels = [];
    const valores = [];
    const claves = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
      const clave = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      claves.push(clave);
      labels.push(`${p(d.getDate())}/${p(d.getMonth() + 1)}`);
      valores.push(0);
    }
    const mapa = {};
    claves.forEach((c, i) => (mapa[c] = i));
    validas.forEach((v) => {
      const idx = mapa[Utils.claveDia(v.fecha)];
      if (idx !== undefined) {
        valores[idx] = Utils.redondear(valores[idx] + v.valorFinal);
      }
    });
    return { labels, valores };
  },

  serieMensual(lista, meses) {
    const validas = this.validas(lista);
    const hoy = new Date(Utils.ahora());
    const p = (n) => String(n).padStart(2, "0");
    const nombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const labels = [];
    const valores = [];
    const claves = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const clave = `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
      claves.push(clave);
      labels.push(`${nombres[d.getMonth()]} ${d.getFullYear()}`);
      valores.push(0);
    }
    const mapa = {};
    claves.forEach((c, i) => (mapa[c] = i));
    validas.forEach((v) => {
      const idx = mapa[Utils.claveMes(v.fecha)];
      if (idx !== undefined) {
        valores[idx] = Utils.redondear(valores[idx] + v.valorFinal);
      }
    });
    return { labels, valores };
  },

  rankingProductos(lista, limite) {
    const validas = this.validas(lista);
    const mapa = {};
    validas.forEach((v) => {
      mapa[v.productoNombre] = (mapa[v.productoNombre] || 0) + v.cantidad;
    });
    return Object.entries(mapa)
      .map(([nombre, unidades]) => ({ nombre, unidades }))
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, limite || 6);
  },

  rankingVendedores(lista, limite) {
    const validas = this.validas(lista);
    const mapa = {};
    validas.forEach((v) => {
      mapa[v.vendedorNombre] = Utils.redondear(
        (mapa[v.vendedorNombre] || 0) + v.valorFinal,
      );
    });
    return Object.entries(mapa)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limite || 6);
  },

  distribucionPagos(lista) {
    const validas = this.validas(lista);
    const mapa = {};
    FORMAS_PAGAMENTO.forEach((f) => (mapa[f] = 0));
    validas.forEach((v) => {
      mapa[v.pagamento] = (mapa[v.pagamento] || 0) + 1;
    });
    return { labels: Object.keys(mapa), valores: Object.values(mapa) };
  },

  resumenVendedor(vendedorNombre, lista) {
    const validas = this.validas(lista);
    const suyas = validas.filter((v) => v.vendedorNombre === vendedorNombre);
    const total = Utils.redondear(suyas.reduce((s, v) => s + v.valorFinal, 0));
    const num = suyas.length;
    const ticket = num > 0 ? Utils.redondear(total / num) : 0;
    const vendedor = State.vendedores.find((x) => x.nombre === vendedorNombre);
    const comisionPct = vendedor ? vendedor.comision : 0;
    const comision = Utils.redondear(total * (comisionPct / 100));
    const meta = vendedor ? vendedor.metaMensual : 0;
    const mes = Utils.mesActual(Utils.ahora());
    const actualMes = Utils.redondear(
      suyas
        .filter((v) => Utils.claveMes(v.fecha) === mes)
        .reduce((s, v) => s + v.valorFinal, 0),
    );
    const pctMeta = meta > 0 ? Math.min(100, (actualMes / meta) * 100) : 0;
    return { total, num, ticket, comision, comisionPct, meta, actualMes, pctMeta: Utils.redondear(pctMeta) };
  },
};