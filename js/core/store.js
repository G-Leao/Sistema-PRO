/* ============================================================
   STORE — camada única de persistência.

   Contrato (assíncrono, para permitir trocar o LocalStorage por um
   cliente de API REST sem tocar em telas ou serviços):

     Store.carregarVendas()      -> Promise<Array>
     Store.guardarVendas(lista)  -> Promise<void>   (lança StoreError)
     ... idem Vendedores, Productos, Config
     Store.escutarAlteracoesExternas(callback)

   Nenhum outro arquivo acessa localStorage diretamente, exceto o
   script inline de <head> que aplica o tema antes da primeira
   pintura (evita "flash" de tema errado).

   Chaves de dados preservadas: vendas, vendedores, produtos, config, meta.
   Veja docs/ARQUITETURA.md para o plano de substituição por API.
   ============================================================ */

class StoreError extends Error {
  constructor(operacao, chave, causa) {
    super(`Falha de persistência (${operacao}: ${chave})`);
    this.name = "StoreError";
    this.operacao = operacao;
    this.chave = chave;
    this.causa = causa;
  }
}

/* ---------- Adaptador: LocalStorage (implementação atual) ---------- */
const AdaptadorLocalStorage = {
  nome: "localStorage",
  _memoria: {},
  _usandoMemoria: false,

  _storage() {
    try {
      const teste = "__pro_teste__";
      localStorage.setItem(teste, "1");
      localStorage.removeItem(teste);
      return localStorage;
    } catch (e) {
      this._usandoMemoria = true;
      return null;
    }
  },

  /* Lê o texto bruto da chave (null se não existir) */
  lerBruto(chave) {
    const st = this._storage();
    if (!st) return Object.prototype.hasOwnProperty.call(this._memoria, chave) ? this._memoria[chave] : null;
    try {
      return st.getItem(chave);
    } catch (e) {
      throw new StoreError("leitura", chave, e);
    }
  },

  gravarBruto(chave, texto) {
    const st = this._storage();
    if (!st) {
      this._memoria[chave] = texto;
      return;
    }
    try {
      st.setItem(chave, texto);
    } catch (e) {
      throw new StoreError("gravacao", chave, e);
    }
  },

  /* Lê e interpreta JSON. Se o conteúdo estiver corrompido, preserva
     uma cópia em "<chave>__corrompido_<timestamp>" para que a próxima
     gravação não destrua o que ainda pode ser recuperado. */
  ler(chave, fallback, avisos) {
    const bruto = this.lerBruto(chave);
    if (bruto === null || bruto === "") return fallback;
    try {
      return JSON.parse(bruto);
    } catch (e) {
      try {
        this.gravarBruto(`${chave}__corrompido_${Date.now()}`, bruto);
      } catch (_) {
        /* sem espaço: segue sem a cópia */
      }
      if (avisos) avisos.push(`Os dados de "${chave}" estavam corrompidos. Uma cópia foi preservada e a lista foi iniciada vazia.`);
      return fallback;
    }
  },

  gravar(chave, valor) {
    this.gravarBruto(chave, JSON.stringify(valor));
  },

  /* Notifica alterações feitas por outra aba/janela do navegador */
  escutar(chaves, callback) {
    window.addEventListener("storage", (ev) => {
      if (ev.key === null || chaves.includes(ev.key)) callback(ev.key);
    });
  },
};

/* ---------- Store: interface usada pelo resto da aplicação ---------- */
const Store = {
  adaptador: AdaptadorLocalStorage,
  avisos: [],

  CHAVES: {
    vendas: "vendas",
    vendedores: "vendedores",
    produtos: "produtos",
    config: "config",
    metaLegada: "meta",
    backup: "pro_backup_pre_v2",
    tema: "pro_tema",
  },

  /* Permite, no futuro, trocar o adaptador (ex.: ApiAdapter) mantendo
     exatamente a mesma interface pública. */
  usarAdaptador(adaptador) {
    this.adaptador = adaptador;
  },

  armazenamentoDisponivel() {
    return !this.adaptador._usandoMemoria;
  },

  /* --- Ventas --- */
  async carregarVendas() {
    return this.adaptador.ler(this.CHAVES.vendas, [], this.avisos);
  },
  async guardarVendas(lista) {
    this.adaptador.gravar(this.CHAVES.vendas, lista);
  },

  /* --- Vendedores --- */
  async carregarVendedores() {
    return this.adaptador.ler(this.CHAVES.vendedores, [], this.avisos);
  },
  async guardarVendedores(lista) {
    this.adaptador.gravar(this.CHAVES.vendedores, lista);
  },

  /* --- Productos --- */
  async carregarProductos() {
    return this.adaptador.ler(this.CHAVES.produtos, [], this.avisos);
  },
  async guardarProductos(lista) {
    this.adaptador.gravar(this.CHAVES.produtos, lista);
  },

  /* --- Configuração (metas) --- */
  async carregarConfig() {
    return this.adaptador.ler(this.CHAVES.config, null, this.avisos);
  },
  async guardarConfig(config) {
    this.adaptador.gravar(this.CHAVES.config, config);
  },

  /* Meta legada (número solto) — somente leitura, para migração */
  async carregarMetaLegada() {
    try {
      const n = parseFloat(this.adaptador.lerBruto(this.CHAVES.metaLegada));
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  },

  /* Cópia de segurança dos dados brutos ANTES da primeira migração.
     Reversível: basta restaurar cada chave a partir de pro_backup_pre_v2. */
  async criarBackupDeMigracao() {
    try {
      if (this.adaptador.lerBruto(this.CHAVES.backup) !== null) return false;
      const copia = {};
      let temDados = false;
      ["vendas", "vendedores", "produtos", "config", "meta"].forEach((k) => {
        const bruto = this.adaptador.lerBruto(k);
        if (bruto !== null) {
          copia[k] = bruto;
          temDados = true;
        }
      });
      if (!temDados) return false;
      this.adaptador.gravar(this.CHAVES.backup, { criadoEm: new Date().toISOString(), dados: copia });
      return true;
    } catch (e) {
      this.avisos.push("Não foi possível criar a cópia de segurança antes da migração.");
      return false;
    }
  },

  /* Texto bruto de uma chave, para comparar se a migração alterou algo */
  textoBruto(chave) {
    try {
      return this.adaptador.lerBruto(chave);
    } catch (e) {
      return null;
    }
  },

  escutarAlteracoesExternas(callback) {
    const chaves = [this.CHAVES.vendas, this.CHAVES.vendedores, this.CHAVES.produtos, this.CHAVES.config];
    this.adaptador.escutar(chaves, callback);
  },

  /* Preferências do dispositivo (ex.: tema). Permanecem locais mesmo
     depois da migração para API. Síncrono de propósito. */
  preferencia(chave) {
    try {
      return this.adaptador.lerBruto(chave);
    } catch (e) {
      return null;
    }
  },
  definirPreferencia(chave, valor) {
    try {
      this.adaptador.gravarBruto(chave, String(valor));
    } catch (e) {
      /* preferência é opcional */
    }
  },
};
