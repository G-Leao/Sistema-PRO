/* ============================================================
   UTILIDADES — helpers puros, sem dependência de UI, serviços
   ou persistência.
   ============================================================ */

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Outros"];

/* Limites de validação. O backend futuro deve aplicar os mesmos (ou
   mais restritivos): a validação do navegador nunca é confiável. */
const LIMITES = {
  nome: 120,
  texto: 60,
  observacao: 200,
  url: 500,
  valorMax: 1e9,
  quantidadeMax: 1e6,
  estoqueMax: 1e9,
};

/* Envelope padrão de resposta dos serviços (mesmo formato previsto
   para a futura API REST):
     sucesso: { ok: true,  data: {...} }
     erro:    { ok: false, error: { code, message, fields? } } */
const Resultado = {
  ok(data) {
    return { ok: true, data: data === undefined ? null : data };
  },
  erro(codigo, mensagem, campos) {
    return { ok: false, error: { code: codigo, message: mensagem, fields: campos || null } };
  },
};

const Utils = {
  id() {
    return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  clonar(obj) {
    return typeof structuredClone === "function"
      ? structuredClone(obj)
      : JSON.parse(JSON.stringify(obj));
  },

  /* ==== Formatação (apresentação em pt-BR; os dados internos não mudam) ==== */

  moneda(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },

  moedaCompacta(n) {
    const num = Number(n) || 0;
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(num);
    } catch (e) {
      return Utils.moneda(num);
    }
  },

  numero(n, casas) {
    return (Number(n) || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: casas === undefined ? 2 : casas,
    });
  },

  percentual(n, casas) {
    return Utils.numero(n, casas === undefined ? 0 : casas) + "%";
  },

  /* Valor numérico -> texto de campo de formulário ("1234,5") */
  numeroParaCampo(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "";
    return String(n).replace(".", ",");
  },

  redondear(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  },

  /* Aceita "1.234,56", "1234,56", "1234.56", "1,5"…
     Pontos agrupando milhares ("1.234", "12.345.678") são tratados
     como separador de milhar, como no pt-BR. */
  parsearNumero(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    if (v === null || v === undefined || v === "") return NaN;
    let s = String(v).trim().replace(/[^\d.,-]/g, "");
    if (!s) return NaN;
    const ultimaComa = s.lastIndexOf(",");
    const ultimoPunto = s.lastIndexOf(".");
    if (ultimaComa > -1 && ultimoPunto > -1) {
      if (ultimaComa > ultimoPunto) s = s.replace(/\./g, "").replace(/,/g, ".");
      else s = s.replace(/,/g, "");
    } else if (ultimaComa > -1) {
      const restante = s.length - ultimaComa - 1;
      if (restante > 0 && restante <= 2) s = s.replace(/,/g, ".");
      else s = s.replace(/,/g, "");
    } else if (ultimoPunto > -1 && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  },

  /* ==== Segurança ==== */

  esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  /* Só aceita URLs http(s) ou imagens data: — nunca javascript: etc. */
  urlSegura(url) {
    const u = String(url || "").trim();
    if (!u || u.length > 2000) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(u)) return u;
    return "";
  },

  iniciais(nome) {
    const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    const a = partes[0].charAt(0);
    const b = partes.length > 1 ? partes[partes.length - 1].charAt(0) : "";
    return (a + b).toUpperCase();
  },

  /* ==== Datas: armazenadas como "YYYY-MM-DDTHH:mm" (hora local) ==== */

  dmaAISO(dma) {
    // "26/09/2026" -> "2026-09-26T00:00"
    const partes = String(dma || "").trim().split("/");
    if (partes.length !== 3) return null;
    const p = (n) => String(n).padStart(2, "0");
    return `${partes[2]}-${p(partes[1])}-${p(partes[0])}T00:00`;
  },

  ahora() {
    const f = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}`;
  },

  conZona(iso) {
    if (!iso) return null;
    const f = new Date(iso);
    return isNaN(f.getTime()) ? null : f;
  },

  /* Valida "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm" e devolve a forma completa */
  normalizarFecha(texto) {
    const s = String(texto || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s)) return null;
    const completa = s.length === 10 ? s + "T00:00" : s;
    return Utils.conZona(completa) ? completa : null;
  },

  claveDia(iso) {
    return iso ? String(iso).slice(0, 10) : "";
  },

  claveMes(iso) {
    return iso ? String(iso).slice(0, 7) : "";
  },

  hoyDia() {
    return Utils.claveDia(Utils.ahora());
  },

  /* Chave "YYYY-MM-DD" de hoje deslocada em N dias */
  diaRelativo(deslocamento) {
    const h = new Date();
    const d = new Date(h.getFullYear(), h.getMonth(), h.getDate() + deslocamento);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  mesActual(iso) {
    const f = Utils.conZona(iso) || new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${f.getFullYear()}-${p(f.getMonth() + 1)}`;
  },

  primoDiaMes(iso) {
    const f = Utils.conZona(iso) || new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${f.getFullYear()}-${p(f.getMonth() + 1)}-01`;
  },

  /* Apresentação: DD/MM/AAAA */
  fmtFecha(iso) {
    const f = Utils.conZona(iso);
    if (!f) return "—";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(f.getDate())}/${p(f.getMonth() + 1)}/${f.getFullYear()}`;
  },

  fmtFechaHora(iso) {
    const f = Utils.conZona(iso);
    if (!f) return "—";
    const p = (n) => String(n).padStart(2, "0");
    return `${Utils.fmtFecha(iso)} ${p(f.getHours())}:${p(f.getMinutes())}`;
  },
};
