/* ============================================================
   SERVIÇO DE VENDEDORES — regras de negócio (independente da UI)
   ============================================================ */

const ServicioVendedores = {
  _normalizar(datos) {
    return {
      nombre: String(datos.nombre || "").trim(),
      foto: String(datos.foto || "").trim(),
      cargo: String(datos.cargo || "").trim(),
      metaMensual: Math.max(0, Utils.redondear(Utils.parsearNumero(datos.metaMensual) || 0)),
      comision: Math.min(100, Math.max(0, Utils.parsearNumero(datos.comision) || 0)),
    };
  },

  _validar(v, idExcluido) {
    if (!v.nombre) return "O nome é obrigatório.";
    if (v.nombre.length > LIMITES.nome) return `O nome pode ter no máximo ${LIMITES.nome} caracteres.`;
    if (v.cargo.length > LIMITES.texto) return `O cargo pode ter no máximo ${LIMITES.texto} caracteres.`;
    if (v.metaMensual > LIMITES.valorMax) return "Meta informada é grande demais.";
    if (v.foto && !Utils.urlSegura(v.foto)) return "A foto deve ser um link http(s) válido.";
    if (State.vendedores.some((x) => x.id !== (idExcluido || "") && x.nombre.trim().toLowerCase() === v.nombre.toLowerCase())) {
      return "Já existe um vendedor com este nome.";
    }
    return null;
  },

  async crear(datos) {
    const v = this._normalizar(datos);
    const error = this._validar(v);
    if (error) return Resultado.erro("validacao", error);
    v.id = Utils.id();
    return State.executar(
      ["vendedores"],
      () => {
        State.vendedores.push(v);
        return Resultado.ok({ vendedor: v });
      },
      { entidade: "vendedor", acao: "criar", id: v.id },
    );
  },

  async actualizar(id, datos) {
    if (!State.vendedores.some((x) => x.id === id)) return Resultado.erro("nao_encontrado", "Vendedor não encontrado.");
    const v = this._normalizar(datos);
    const error = this._validar(v, id);
    if (error) return Resultado.erro("validacao", error);
    return State.executar(
      ["vendedores", "ventas"],
      () => {
        const idx = State.vendedores.findIndex((x) => x.id === id);
        const anterior = State.vendedores[idx];
        State.vendedores[idx] = { ...anterior, ...v };
        /* Se o nome mudou, atualiza o nome exibido nas vendas associadas */
        if (anterior.nombre !== v.nombre) {
          State.ventas.forEach((venta) => {
            if (venta.vendedorId === id) venta.vendedorNombre = v.nombre;
          });
        }
        return Resultado.ok({ vendedor: State.vendedores[idx] });
      },
      { entidade: "vendedor", acao: "atualizar", id },
    );
  },

  /* Comportamento existente (preservado): ao excluir um vendedor, suas
     vendas também são excluídas e o estoque das válidas é devolvido.
     Pendência registrada: no backend, preferir inativar o vendedor para
     não destruir histórico financeiro. */
  async eliminar(id) {
    if (!State.vendedores.some((x) => x.id === id)) return Resultado.erro("nao_encontrado", "Vendedor não encontrado.");
    return State.executar(
      ["vendedores", "ventas", "productos"],
      () => {
        const antes = State.ventas.length;
        State.ventas.forEach((venta) => {
          if (venta.vendedorId === id && venta.estado === "valida") {
            ServicioVentas._aplicarStock(venta.productoId, -venta.cantidad);
          }
        });
        State.ventas = State.ventas.filter((venta) => venta.vendedorId !== id);
        State.vendedores.splice(State.vendedores.findIndex((x) => x.id === id), 1);
        return Resultado.ok({ ventasRemovidas: antes - State.ventas.length });
      },
      { entidade: "vendedor", acao: "excluir", id },
    );
  },

  obtener(id) {
    return State.vendedores.find((v) => v.id === id);
  },
};
