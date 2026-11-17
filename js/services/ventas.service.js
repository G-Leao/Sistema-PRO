/* ============================================================
   SERVIÇO DE VENDAS — regras de negócio (independente da UI).
   Todas as operações são assíncronas e devolvem o envelope
   { ok, data } / { ok:false, error:{code,message} }.
   No futuro esta camada vira o cliente da API; as regras abaixo
   passam a ser reforçadas pelo backend.
   ============================================================ */

const ServicioVentas = {
  /* Quantidade × Valor unitário − Desconto = Valor final */
  calcular(datos) {
    const cantidad = Math.max(0, Utils.parsearNumero(datos && datos.cantidad) || 0);
    const valorUnitario = Math.max(0, Utils.parsearNumero(datos && datos.valorUnitario) || 0);
    const descuento = Math.max(0, Utils.parsearNumero(datos && datos.descuento) || 0);
    const bruto = Utils.redondear(cantidad * valorUnitario);
    return {
      cantidad,
      valorUnitario,
      descuento,
      bruto,
      valorFinal: Utils.redondear(Math.max(0, bruto - descuento)),
    };
  },

  /* opcoes.permitirInativoId: produto inativo já vinculado à venda editada */
  validar(datos, opcoes) {
    if (!datos) return "Dados inválidos.";
    const producto = State.productos.find((p) => p.id === datos.productoId);
    if (!producto) return "Selecione um produto válido.";
    if (producto.activo === false && !(opcoes && opcoes.permitirInativoId === producto.id)) {
      return "O produto selecionado está inativo.";
    }
    const vendedor = State.vendedores.find((v) => v.id === datos.vendedorId);
    if (!vendedor) return "Selecione um vendedor válido.";
    const cantidad = Utils.parsearNumero(datos.cantidad);
    if (!(cantidad > 0)) return "A quantidade deve ser maior que zero.";
    if (cantidad > LIMITES.quantidadeMax) return "A quantidade informada é grande demais.";
    const valorUnitario = Utils.parsearNumero(datos.valorUnitario);
    if (!(valorUnitario > 0)) return "O valor unitário deve ser maior que zero.";
    if (valorUnitario > LIMITES.valorMax) return "O valor unitário informado é grande demais.";
    const descuento = Utils.parsearNumero(datos.descuento) || 0;
    if (descuento < 0) return "O desconto não pode ser negativo.";
    if (descuento > Utils.redondear(cantidad * valorUnitario)) {
      return "O desconto não pode ser maior que o valor bruto da venda.";
    }
    if (!FORMAS_PAGAMENTO.includes(datos.pagamento)) return "Forma de pagamento inválida.";
    if (datos.fecha && !Utils.normalizarFecha(datos.fecha)) return "Data e hora inválidas.";
    if (String(datos.observacion || "").length > LIMITES.observacao) {
      return `A observação pode ter no máximo ${LIMITES.observacao} caracteres.`;
    }
    return null;
  },

  /* delta positivo baixa estoque; negativo devolve */
  _revisarStock(productoId, delta) {
    const p = State.productos.find((x) => x.id === productoId);
    if (!p || p.stock === null) return null; // sem controle de estoque
    if (p.stock - delta < 0) {
      const disp = Number.isInteger(p.stock) ? p.stock : Math.floor(p.stock);
      return `Estoque insuficiente para "${p.nombre}". Disponível: ${disp}`;
    }
    return null;
  },

  _aplicarStock(productoId, delta) {
    const p = State.productos.find((x) => x.id === productoId);
    if (!p || p.stock === null) return;
    p.stock = Utils.redondear(p.stock - delta);
  },

  async registrar(datos) {
    const error = this.validar(datos);
    if (error) return Resultado.erro("validacao", error);
    const calc = this.calcular(datos);
    return State.executar(
      ["ventas", "productos"],
      () => {
        const producto = State.productos.find((p) => p.id === datos.productoId);
        const vendedor = State.vendedores.find((v) => v.id === datos.vendedorId);
        const conflict = this._revisarStock(producto.id, calc.cantidad);
        if (conflict) return Resultado.erro("estoque_insuficiente", conflict);
        const venta = {
          id: Utils.id(),
          productoId: producto.id,
          productoNombre: producto.nombre,
          vendedorId: vendedor.id,
          vendedorNombre: vendedor.nombre,
          cantidad: calc.cantidad,
          valorUnitario: calc.valorUnitario,
          descuento: calc.descuento,
          valorFinal: calc.valorFinal,
          pagamento: datos.pagamento,
          fecha: Utils.normalizarFecha(datos.fecha) || Utils.ahora(),
          observacion: String(datos.observacion || "").trim(),
          estado: "valida",
        };
        this._aplicarStock(producto.id, venta.cantidad);
        State.ventas.push(venta);
        return Resultado.ok({ venta });
      },
      { entidade: "venda", acao: "criar" },
    );
  },

  async actualizar(id, datos) {
    const vieja0 = State.ventas.find((v) => v.id === id);
    if (!vieja0) return Resultado.erro("nao_encontrado", "Venda não encontrada.");
    const error = this.validar(datos, { permitirInativoId: vieja0.productoId });
    if (error) return Resultado.erro("validacao", error);
    const calc = this.calcular(datos);
    return State.executar(
      ["ventas", "productos"],
      () => {
        const idx = State.ventas.findIndex((v) => v.id === id);
        const vieja = State.ventas[idx];
        const producto = State.productos.find((p) => p.id === datos.productoId);
        const vendedor = State.vendedores.find((v) => v.id === datos.vendedorId);

        /* Estoque só é movimentado quando a venda está válida:
           vendas anuladas já devolveram seu estoque. */
        if (vieja.estado === "valida") {
          this._aplicarStock(vieja.productoId, -vieja.cantidad);
          const conflict = this._revisarStock(producto.id, calc.cantidad);
          if (conflict) return Resultado.erro("estoque_insuficiente", `Não foi possível salvar: ${conflict}`);
          this._aplicarStock(producto.id, calc.cantidad);
        }

        State.ventas[idx] = {
          ...vieja,
          productoId: producto.id,
          productoNombre: producto.nombre,
          vendedorId: vendedor.id,
          vendedorNombre: vendedor.nombre,
          cantidad: calc.cantidad,
          valorUnitario: calc.valorUnitario,
          descuento: calc.descuento,
          valorFinal: calc.valorFinal,
          pagamento: datos.pagamento,
          fecha: Utils.normalizarFecha(datos.fecha) || vieja.fecha,
          observacion: String(datos.observacion || "").trim(),
        };
        return Resultado.ok({ venta: State.ventas[idx] });
      },
      { entidade: "venda", acao: "atualizar", id },
    );
  },

  async eliminar(id) {
    if (!State.ventas.some((v) => v.id === id)) return Resultado.erro("nao_encontrado", "Venda não encontrada.");
    return State.executar(
      ["ventas", "productos"],
      () => {
        const idx = State.ventas.findIndex((v) => v.id === id);
        const venta = State.ventas[idx];
        if (venta.estado === "valida") this._aplicarStock(venta.productoId, -venta.cantidad);
        State.ventas.splice(idx, 1);
        return Resultado.ok(null);
      },
      { entidade: "venda", acao: "excluir", id },
    );
  },

  async anular(id) {
    const v0 = State.ventas.find((v) => v.id === id);
    if (!v0) return Resultado.erro("nao_encontrado", "Venda não encontrada.");
    if (v0.estado !== "valida") return Resultado.erro("estado_invalido", "A venda já está anulada.");
    return State.executar(
      ["ventas", "productos"],
      () => {
        const venta = State.ventas.find((v) => v.id === id);
        this._aplicarStock(venta.productoId, -venta.cantidad);
        venta.estado = "anulada";
        return Resultado.ok({ venta });
      },
      { entidade: "venda", acao: "anular", id },
    );
  },

  async revalidar(id) {
    const v0 = State.ventas.find((v) => v.id === id);
    if (!v0) return Resultado.erro("nao_encontrado", "Venda não encontrada.");
    if (v0.estado !== "anulada") return Resultado.erro("estado_invalido", "A venda já está válida.");
    return State.executar(
      ["ventas", "productos"],
      () => {
        const venta = State.ventas.find((v) => v.id === id);
        const conflict = this._revisarStock(venta.productoId, venta.cantidad);
        if (conflict) return Resultado.erro("estoque_insuficiente", conflict);
        this._aplicarStock(venta.productoId, venta.cantidad);
        venta.estado = "valida";
        return Resultado.ok({ venta });
      },
      { entidade: "venda", acao: "revalidar", id },
    );
  },

  async eliminarTodas() {
    return State.executar(
      ["ventas", "productos"],
      () => {
        State.ventas.forEach((v) => {
          if (v.estado === "valida") this._aplicarStock(v.productoId, -v.cantidad);
        });
        State.ventas = [];
        return Resultado.ok(null);
      },
      { entidade: "venda", acao: "excluir_todas" },
    );
  },
};
