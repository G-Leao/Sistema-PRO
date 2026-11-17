/* ============================================================
   SERVIÇO DE PRODUTOS — regras de negócio (independente da UI)
   ============================================================ */

const ServicioProductos = {
  _normalizar(datos) {
    const vazio =
      datos.stock === null || datos.stock === undefined || String(datos.stock).trim() === "";
    return {
      nombre: String(datos.nombre || "").trim(),
      sku: String(datos.sku || "").trim(),
      categoria: String(datos.categoria || "").trim(),
      marca: String(datos.marca || "").trim(),
      precioCosto: Math.max(0, Utils.redondear(Utils.parsearNumero(datos.precioCosto) || 0)),
      precioVenta: Math.max(0, Utils.redondear(Utils.parsearNumero(datos.precioVenta) || 0)),
      /* vazio = sem controle de estoque */
      stock: vazio ? null : Math.max(0, Math.floor(Utils.parsearNumero(datos.stock) || 0)),
      stockMin: Math.max(0, Math.floor(Utils.parsearNumero(datos.stockMin) || 0)),
      activo: datos.activo === undefined ? true : !!datos.activo,
      imagen: String(datos.imagen || "").trim(),
    };
  },

  _validar(p, idExcluido) {
    if (!p.nombre) return "O nome é obrigatório.";
    if (p.nombre.length > LIMITES.nome) return `O nome pode ter no máximo ${LIMITES.nome} caracteres.`;
    if (!(p.precioVenta > 0)) return "O preço de venda deve ser maior que zero.";
    if (p.precioVenta > LIMITES.valorMax || p.precioCosto > LIMITES.valorMax) return "Preço informado é grande demais.";
    if (p.sku.length > LIMITES.texto) return "O SKU é longo demais.";
    if (p.marca.length > LIMITES.texto || p.categoria.length > LIMITES.texto) {
      return `Marca e categoria podem ter no máximo ${LIMITES.texto} caracteres.`;
    }
    if (p.stock !== null && p.stock > LIMITES.estoqueMax) return "Estoque informado é grande demais.";
    if (p.imagen && !Utils.urlSegura(p.imagen)) return "A imagem deve ser um link http(s) válido.";
    if (
      p.sku &&
      State.productos.some(
        (x) => x.id !== (idExcluido || "") && x.sku && x.sku.trim().toLowerCase() === p.sku.toLowerCase(),
      )
    ) {
      return "Já existe um produto com este SKU.";
    }
    return null;
  },

  async crear(datos) {
    const p = this._normalizar(datos);
    const error = this._validar(p);
    if (error) return Resultado.erro("validacao", error);
    p.id = Utils.id();
    return State.executar(
      ["productos"],
      () => {
        State.productos.push(p);
        return Resultado.ok({ producto: p });
      },
      { entidade: "produto", acao: "criar", id: p.id },
    );
  },

  async actualizar(id, datos) {
    if (!State.productos.some((x) => x.id === id)) return Resultado.erro("nao_encontrado", "Produto não encontrado.");
    const p = this._normalizar(datos);
    const error = this._validar(p, id);
    if (error) return Resultado.erro("validacao", error);
    return State.executar(
      ["productos", "ventas"],
      () => {
        const idx = State.productos.findIndex((x) => x.id === id);
        const anterior = State.productos[idx];
        State.productos[idx] = { ...anterior, ...p };
        return Resultado.ok({ producto: State.productos[idx] });
      },
      { entidade: "produto", acao: "atualizar", id },
    );
  },

  /* O histórico de vendas mantém o nome registrado no momento da venda */
  async eliminar(id) {
    if (!State.productos.some((x) => x.id === id)) return Resultado.erro("nao_encontrado", "Produto não encontrado.");
    return State.executar(
      ["productos"],
      () => {
        State.productos.splice(State.productos.findIndex((x) => x.id === id), 1);
        return Resultado.ok(null);
      },
      { entidade: "produto", acao: "excluir", id },
    );
  },

  obtener(id) {
    return State.productos.find((p) => p.id === id);
  },

  /* Margem = venda − custo (pode ser negativa). Sem custo informado, não há margem. */
  margen(p) {
    if (!(p.precioCosto > 0) || !(p.precioVenta > 0)) return { bruto: null, pct: null };
    const bruto = Utils.redondear(p.precioVenta - p.precioCosto);
    return { bruto, pct: Utils.redondear((bruto / p.precioVenta) * 100) };
  },

  estadoStock(p) {
    if (p.stock === null) return { tipo: "nulo", etiqueta: "Sem controle", clase: "badge-soft" };
    if (p.stock <= 0) return { tipo: "sin", etiqueta: "Sem estoque", clase: "badge-peligro" };
    if (p.stockMin > 0 && p.stock <= p.stockMin) return { tipo: "bajo", etiqueta: "Estoque baixo", clase: "badge-aviso" };
    return { tipo: "ok", etiqueta: "Estoque OK", clase: "badge-ok" };
  },

  categorias() {
    const set = new Set();
    State.productos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt"));
  },
};
