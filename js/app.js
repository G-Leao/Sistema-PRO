/* ============================================================
   APP — puntos de entrada, navegación y refresco global
   ============================================================ */

const titulos = {
  dashboard: ["Dashboard", "Visão general del negocio"],
  vendas: ["Vendas", "Registra una venta"],
  historico: ["Histórico", "Todas las ventas registradas"],
  produtos: ["Productos", "Catálogo, precios y stock"],
  vendedores: ["Vendedores", "Equipo y desempeño"],
};

function trocarTela(id) {
  if (!titulos[id]) return;
  document
    .querySelectorAll(".tela")
    .forEach((t) => t.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.toggle("ativo", b.dataset.tela === id));
  document.getElementById("tituloTela").textContent = titulos[id][0];
  document.getElementById("subTitulo").textContent = titulos[id][1];
  fecharMenu();
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

function atualizarTudo() {
  atualizarDashboard();
  atualizarProductos();
  atualizarVendedores();
  atualizarListaReciente();
  atualizarHistorico();
}

function atualizarSelectsGlobales() {
  rellenarSelectsVenta("nueva");
  rellenarSelectsVenta("edit");
  rellenarFiltrosHistorico();
  rellenarDatalistCategorias();
}

function iniciarApp() {
  State.init();
  document.getElementById("formVentaNueva").innerHTML = camposVentaHtml("nueva");
  document.getElementById("camposVentaModal").innerHTML = camposVentaHtml("edit");
  atualizarSelectsGlobales();
  limpiarFormularioVenta("nueva");
  atualizarTudo();
  atualizarGraficos();
  document.getElementById("loader").style.display = "none";
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) fecharMenu();
});

iniciarApp();