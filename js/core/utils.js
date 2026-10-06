/* ============================================================
   UTILIDADES — helpers puros, sin dependencias de UI ni servicios
   ============================================================ */

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Outros"];

const Utils = {
  id() {
    return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  moneda(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },

  redondear(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  },

  /* Acepta "1.234,56", "1234.56", "1,5"… */
  parsearNumero(v) {
    if (typeof v === "number") return v;
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
    }
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  },

  esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  /* ==== Fechas: se almacenan como "YYYY-MM-DDTHH:mm" (hora local) ==== */

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

  claveDia(iso) {
    return iso ? String(iso).slice(0, 10) : "";
  },

  claveMes(iso) {
    return iso ? String(iso).slice(0, 7) : "";
  },

  hoyDia() {
    return Utils.claveDia(Utils.ahora());
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