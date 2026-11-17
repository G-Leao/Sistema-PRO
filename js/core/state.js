/* ============================================================
   STATE — estado em memória + migração segura dos dados existentes
   (formato antigo -> atual) sem perda de informação.

   - Registros desconhecidos/extras são PRESERVADOS (spread).
   - Nada é descartado silenciosamente: registros inválidos são
     mantidos no backup de migração (pro_backup_pre_v2).
   - Toda alteração passa por State.executar(): snapshot, mutação,
     persistência e rollback em caso de falha.
   ============================================================ */

const SCHEMA_VERSAO = 2;

function _ventaNormalizada(v) {
  if (!v || typeof v !== "object") return null;
  const valor = Utils.parsearNumero(v.valorFinal ?? v.valor);
  const valorUnitario = Utils.parsearNumero(v.valorUnitario);
  const cantidad = Utils.parsearNumero(v.cantidad);
  return {
    ...v,
    id: v.id || Utils.id(),
    productoId: v.productoId || "",
    productoNombre: v.productoNombre || v.produto || "Produto",
    vendedorId: v.vendedorId || "",
    vendedorNombre: v.vendedorNombre || v.vendedor || "Vendedor",
    cantidad: isNaN(cantidad) ? 1 : cantidad,
    valorUnitario: Utils.redondear(
      isNaN(valorUnitario) ? (isNaN(valor) ? 0 : valor) : valorUnitario,
    ),
    descuento: Utils.redondear(Utils.parsearNumero(v.descuento) || 0),
    valorFinal: Utils.redondear(isNaN(valor) ? 0 : valor),
    pagamento: v.pagamento || "Outros",
    fecha: v.fecha || Utils.dmaAISO(v.data) || Utils.ahora(),
    observacion: v.observacion || "",
    estado: v.estado === "anulada" ? "anulada" : "valida",
  };
}

function _productoDesdeString(nombre) {
  return {
    id: Utils.id(),
    nombre: String(nombre),
    sku: "",
    categoria: "",
    marca: "",
    precioCosto: 0,
    precioVenta: 0,
    stock: null,
    stockMin: 0,
    activo: true,
    imagen: "",
  };
}

function _normalizarProductos(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((p) => {
      if (typeof p === "string") return _productoDesdeString(p);
      if (!p || typeof p !== "object") return null;
      const nombre = String(p.nombre || p.nome || "").trim();
      if (!nombre) return null;
      return {
        ...p,
        id: p.id || Utils.id(),
        nombre,
        sku: String(p.sku || "").trim(),
        categoria: String(p.categoria || "").trim(),
        marca: String(p.marca || "").trim(),
        precioCosto: Utils.redondear(Utils.parsearNumero(p.precioCosto) || 0),
        precioVenta: Utils.redondear(Utils.parsearNumero(p.precioVenta) || 0),
        /* null = sem controle de estoque (comportamento legado) */
        stock:
          p.stock === null || p.stock === undefined || p.stock === ""
            ? null
            : Math.max(0, Number(p.stock) || 0),
        stockMin: Math.max(0, Utils.parsearNumero(p.stockMin) || 0),
        activo: p.activo === undefined ? true : !!p.activo,
        imagen: String(p.imagen || "").trim(),
      };
    })
    .filter(Boolean);
}

function _vendedorDesdeString(nombre) {
  return { id: Utils.id(), nombre: String(nombre), foto: "", cargo: "", metaMensual: 0, comision: 0 };
}

function _normalizarVendedores(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((v) => {
      if (typeof v === "string") return _vendedorDesdeString(v);
      if (!v || typeof v !== "object") return null;
      const nombre = String(v.nombre || v.nome || "").trim();
      if (!nombre) return null;
      return {
        ...v,
        id: v.id || Utils.id(),
        nombre,
        foto: String(v.foto || "").trim(),
        cargo: String(v.cargo || "").trim(),
        metaMensual: Utils.redondear(Utils.parsearNumero(v.metaMensual) || 0),
        comision: Math.min(100, Math.max(0, Utils.parsearNumero(v.comision) || 0)),
      };
    })
    .filter(Boolean);
}

const State = {
  ventas: [],
  vendedores: [],
  productos: [],
  config: { metas: { diaria: 0, mensual: 0 } },

  /* Contexto multiempresa FUTURO. Hoje é sempre nulo: o isolamento por
     empresa será garantido pelo backend, não por este objeto. */
  contexto: { empresaId: null, usuarioId: null },

  _ouvintes: [],

  /* Ponto de extensão para auditoria/rastreabilidade futura.
     Recebe { entidade, acao, id, em } a cada alteração confirmada. */
  aoMudar(fn) {
    this._ouvintes.push(fn);
  },
  _notificar(evento) {
    if (!evento) return;
    const completo = { ...evento, em: new Date().toISOString() };
    this._ouvintes.forEach((fn) => {
      try {
        fn(completo);
      } catch (e) {
        console.error(e);
      }
    });
  },

  async init() {
    await Store.criarBackupDeMigracao();
    await this._carregar();

    /* Só regrava se a migração realmente alterou algo */
    const mudou = (chave, valor) => JSON.stringify(valor) !== Store.textoBruto(chave);
    const C = Store.CHAVES;
    if (mudou(C.vendas, this.ventas)) await Store.guardarVendas(this.ventas);
    if (mudou(C.vendedores, this.vendedores)) await Store.guardarVendedores(this.vendedores);
    if (mudou(C.produtos, this.productos)) await Store.guardarProductos(this.productos);
    if (mudou(C.config, this.config)) await Store.guardarConfig(this.config);
  },

  /* Recarrega do armazenamento (ex.: alteração em outra aba) */
  async recarregar() {
    await this._carregar();
  },

  async _carregar() {
    const cfg = (await Store.carregarConfig()) || { metas: { diaria: 0, mensual: 0 } };
    this.config = { ...cfg };
    if (!this.config.metas || typeof this.config.metas !== "object") this.config.metas = {};
    this.config.metas.diaria = Math.max(0, Utils.parsearNumero(this.config.metas.diaria) || 0);
    this.config.metas.mensual = Math.max(0, Utils.parsearNumero(this.config.metas.mensual) || 0);
    const metaLegada = await Store.carregarMetaLegada();
    if (metaLegada > 0 && !(this.config.metas.diaria > 0)) this.config.metas.diaria = metaLegada;
    this.config.schemaVersao = SCHEMA_VERSAO;

    this.productos = _normalizarProductos(await Store.carregarProductos());
    this.vendedores = _normalizarVendedores(await Store.carregarVendedores());
    this.ventas = ((await Store.carregarVendas()) || []).map(_ventaNormalizada).filter(Boolean);

    /* Vincula vendas legadas aos cadastros atuais pelo nome */
    this.ventas.forEach((venta) => {
      if (!venta.productoId) {
        const p = this.productos.find(
          (x) => x.nombre.trim().toLowerCase() === String(venta.productoNombre).trim().toLowerCase(),
        );
        if (p) venta.productoId = p.id;
      }
      if (!venta.vendedorId) {
        const v = this.vendedores.find(
          (x) => x.nombre.trim().toLowerCase() === String(venta.vendedorNombre).trim().toLowerCase(),
        );
        if (v) venta.vendedorId = v.id;
      }
    });
  },

  _persistir(colecoes) {
    const tarefas = [];
    if (colecoes.includes("ventas")) tarefas.push(() => Store.guardarVendas(this.ventas));
    if (colecoes.includes("vendedores")) tarefas.push(() => Store.guardarVendedores(this.vendedores));
    if (colecoes.includes("productos")) tarefas.push(() => Store.guardarProductos(this.productos));
    if (colecoes.includes("config")) tarefas.push(() => Store.guardarConfig(this.config));
    return tarefas.reduce((p, t) => p.then(t), Promise.resolve());
  },

  /* Executa uma alteração de forma "transacional":
       colecoes: quais coleções serão tocadas (["ventas","productos"])
       mutador:  função síncrona que altera o estado e devolve um Resultado
       evento:   (opcional) { entidade, acao, id } para auditoria
     Se o mutador devolver erro ou a persistência falhar, o estado em
     memória (e o armazenamento, em melhor esforço) volta ao snapshot. */
  async executar(colecoes, mutador, evento) {
    const snap = {
      ventas: Utils.clonar(this.ventas),
      vendedores: Utils.clonar(this.vendedores),
      productos: Utils.clonar(this.productos),
      config: Utils.clonar(this.config),
    };
    const restaurar = () => {
      this.ventas = snap.ventas;
      this.vendedores = snap.vendedores;
      this.productos = snap.productos;
      this.config = snap.config;
    };
    let resultado;
    try {
      resultado = mutador();
      if (!resultado || !resultado.ok) {
        restaurar();
        return resultado || Resultado.erro("erro_interno", "Operação inválida.");
      }
      await this._persistir(colecoes);
    } catch (e) {
      console.error(e);
      restaurar();
      try {
        await this._persistir(colecoes); /* melhor esforço: regrava o snapshot */
      } catch (_) {
        /* mantém o erro original */
      }
      return Resultado.erro(
        "persistencia",
        "Não foi possível salvar os dados neste dispositivo (armazenamento cheio ou bloqueado). Nada foi alterado.",
      );
    }
    this._notificar(evento);
    return resultado;
  },
};
