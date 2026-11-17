/* ============================================================
   APP — ponto de entrada, navegação e atualização global
   ============================================================ */

const titulos = {
  dashboard: ["Dashboard", "Visão geral do negócio"],
  vendas: ["Vendas", "Registre uma nova venda"],
  historico: ["Histórico", "Todas as vendas registradas"],
  produtos: ["Produtos", "Catálogo, preços e estoque"],
  vendedores: ["Vendedores", "Equipe, metas e desempenho"],
};

function trocarTela(id) {
  if (!titulos[id]) return;
  document.querySelectorAll(".tela").forEach((t) => t.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");
  document.querySelectorAll(".nav-item").forEach((b) => {
    const ativo = b.dataset.tela === id;
    b.classList.toggle("ativo", ativo);
    if (ativo) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.getElementById("tituloTela").textContent = titulos[id][0];
  document.getElementById("subTitulo").textContent = titulos[id][1];
  document.title = `${titulos[id][0]} · Pro Vendas`;
  fecharMenu();
  window.scrollTo({ top: 0 });
  if (id === "dashboard") {
    atualizarDashboard();
    atualizarGraficos();
  }
  if (id === "historico") atualizarHistorico();
}

function abrirMenu() {
  document.getElementById("sidebar").classList.add("aberta");
  document.getElementById("backdrop").classList.add("ativo");
}

function fecharMenu() {
  document.getElementById("sidebar").classList.remove("aberta");
  document.getElementById("backdrop").classList.remove("ativo");
}

registrarAcoes({
  trocarTela: (ds) => trocarTela(ds.arg),
  abrirMenu,
  fecharMenu,
});

function atualizarSelectsGlobales() {
  rellenarSelectsVenta("nueva");
  rellenarSelectsVenta("edit");
  rellenarFiltrosHistorico();
  rellenarDatalistCategorias();
}

function atualizarTudo() {
  atualizarSelectsGlobales();
  atualizarDashboard();
  atualizarProductos();
  atualizarVendedores();
  atualizarListaReciente();
  atualizarHistorico();
  if (document.getElementById("dashboard").classList.contains("ativa")) atualizarGraficos();
}

async function iniciarApp() {
  aplicarTema(temaAtual());
  document.getElementById("formVentaNueva").innerHTML = camposVentaHtml("nueva");
  document.getElementById("resumoVentaNueva").innerHTML = resumoVendaHtml("nueva");
  document.getElementById("camposVentaModal").innerHTML = camposVentaHtml("edit");
  document.getElementById("resumoVentaEdit").innerHTML = resumoVendaHtml("edit");

  try {
    await State.init();
  } catch (e) {
    console.error(e);
    toast("Não foi possível carregar os dados salvos.", "error");
  }
  Store.avisos.splice(0).forEach((a) => toast(a, "error"));
  if (!Store.armazenamentoDisponivel()) {
    document.getElementById("storageNote").textContent = "Armazenamento indisponível: os dados não serão salvos";
    toast("O navegador bloqueou o armazenamento local. Os dados não serão salvos.", "error");
  }

  atualizarSelectsGlobales();
  limpiarFormularioVenta("nueva");
  atualizarTudo();
  document.getElementById("loader").style.display = "none";

  /* Alterações feitas em outra aba: recarrega para não sobrescrever dados */
  Store.escutarAlteracoesExternas(async () => {
    await State.recarregar();
    atualizarTudo();
  });
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) fecharMenu();
});

iniciarApp();
