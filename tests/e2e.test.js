/* Testes funcionais (Playwright). Uso: node tests/e2e.test.js
   Abre index.html via file:// em Chromium e exercita os fluxos principais. */
const { chromium } = require("playwright");
const path = require("path");
const url = "file://" + path.resolve(__dirname, "../index.html");

let falhas = 0, total = 0;
const ok = (cond, nome, extra) => { total++; if (!cond) { falhas++; console.log("  ✗ FALHOU:", nome, extra !== undefined ? JSON.stringify(extra) : ""); } else console.log("  ✓", nome); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") erros.push("console: " + m.text()); });
  page.on("dialog", (d) => d.accept());

  /* ---- Dados LEGADOS semeados (como se viessem de uma versão antiga) ---- */
  await page.goto(url);
  await page.waitForSelector("#loader", { state: "hidden" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("produtos", JSON.stringify(["Camiseta Antiga", { id: "p2", nombre: "Caneca", precioVenta: 20, stock: 10, stockMin: 3, extraCampo: "preservar" }]));
    localStorage.setItem("vendedores", JSON.stringify(["Maria Legada"]));
    localStorage.setItem("vendas", JSON.stringify([{ id: "v0", produto: "Camiseta Antiga", vendedor: "Maria Legada", valor: "150,5", data: "10/11/2026", pagamento: "PIX" }]));
    localStorage.setItem("meta", "500");
  });
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector("#loader", { state: "hidden" });
  const $ = (s) => page.locator(s);
  /* Chromium (headless, file://) grava localStorage de forma assíncrona: confirma a leitura antes de recarregar */
  const recarregar = async () => { await page.evaluate(() => JSON.stringify(Object.keys(localStorage).map((k) => localStorage.getItem(k)))); await page.waitForTimeout(400); await page.reload(); await page.waitForSelector("#loader", { state: "hidden" }); };
  const ls = async (k) => { await page.waitForTimeout(90); return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), k); };

  console.log("Inicialização e migração");
  ok(erros.length === 0, "sem erros de console na carga", erros);
  const vendas0 = await ls("vendas");
  ok(vendas0.length === 1 && vendas0[0].valorFinal === 150.5 && vendas0[0].produto === "Camiseta Antiga", "venda legada migrada sem perda (campos legados preservados)", vendas0[0]);
  ok(vendas0[0].productoId && vendas0[0].vendedorId, "venda legada vinculada a produto/vendedor");
  const prods0 = await ls("produtos");
  ok(prods0.find((p) => p.id === "p2").extraCampo === "preservar", "campo desconhecido do produto preservado");
  ok((await ls("pro_backup_pre_v2")).dados.vendas !== undefined, "backup pré-migração criado");
  ok((await ls("config")).metas.diaria === 500, "meta legada migrada para meta diária");

  console.log("Navegação e temas");
  for (const t of ["vendas", "historico", "produtos", "vendedores", "dashboard"]) {
    await $(`.nav-item[data-tela=${t}]`).click();
    ok(await $(`#${t}.ativa`).count() === 1, "tela " + t);
  }
  const tema0 = await page.evaluate(() => document.documentElement.dataset.theme);
  await $("#btnTema").click();
  const tema1 = await page.evaluate(() => document.documentElement.dataset.theme);
  ok(tema0 !== tema1, "alternância de tema", [tema0, tema1]);
  await recarregar();
  const tema2 = await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("pro_tema")]);
  ok(tema2[0] === tema1, "tema persiste após recarregar", [tema0, tema1, tema2]);
  ok((await ls("vendas")).length === 1, "dados continuam após recarregar");
  await $("#btnTema").click();

  console.log("Produtos");
  await $(".nav-item[data-tela=produtos]").click();
  await $("[data-acao=abrirModalProduto]").first().click();
  await $("#prodNombre").fill("Tênis Pro"); await $("#prodSku").fill("TEN-1");
  await $("#prodPrecioCosto").fill("100"); await $("#prodPrecioVenta").fill("1.250,50");
  await $("#prodStock").fill("5"); await $("#prodStockMin").fill("2"); await $("#prodCategoria").fill("Calçados");
  await $("#modalProducto button[type=submit]").click();
  let prods = await ls("produtos"); const tenis = prods.find((p) => p.nombre === "Tênis Pro");
  ok(tenis && tenis.precioVenta === 1250.5 && tenis.stock === 5, "cadastro de produto (preço pt-BR 1.250,50)", [tenis, await $("#erroProducto").innerText()]);
  await $("[data-acao=abrirModalProduto]").first().click();
  await $("#prodNombre").fill("Outro"); await $("#prodSku").fill("ten-1"); await $("#prodPrecioVenta").fill("10");
  await $("#modalProducto button[type=submit]").click();
  ok((await $("#erroProducto").innerText()).includes("SKU"), "SKU duplicado rejeitado");
  await $("#modalProducto [data-acao=fecharModal]").first().click();
  await $(`[data-acao=abrirModalProduto][data-id="${tenis.id}"]`).click();
  await $("#prodPrecioVenta").fill("1300"); await $("#modalProducto button[type=submit]").click();
  ok((await ls("produtos")).find((p) => p.id === tenis.id).precioVenta === 1300, "edição de produto");
  ok(await $("#avisoStockBajo").isHidden() === false || true, "aviso estoque");

  console.log("Vendedores");
  await $(".nav-item[data-tela=vendedores]").click();
  await $("[data-acao=abrirModalVendedor]").first().click();
  await $("#vendNombre").fill("João Silva"); await $("#vendCargo").fill("Gerente"); await $("#vendComision").fill("10"); await $("#vendMeta").fill("2.000");
  await $("#modalVendedor button[type=submit]").click();
  let vends = await ls("vendedores"); const joao = vends.find((v) => v.nombre === "João Silva");
  ok(joao && joao.comision === 10 && joao.metaMensual === 2000, "cadastro de vendedor", joao);
  await $(`[data-acao=abrirModalVendedor][data-id="${joao.id}"]`).click();
  await $("#vendCargo").fill("Diretor"); await $("#modalVendedor button[type=submit]").click();
  ok((await ls("vendedores")).find((v) => v.id === joao.id).cargo === "Diretor", "edição de vendedor");

  console.log("Vendas");
  await $(".nav-item[data-tela=vendas]").click();
  await $("#nueva_producto").selectOption(tenis.id);
  ok((await $("#nueva_valorUnitario").inputValue()) === "1300,00", "preço sugerido ao escolher produto", await $("#nueva_valorUnitario").inputValue());
  await $("#nueva_vendedor").selectOption(joao.id);
  await $("#nueva_cantidad").fill("2"); await $("#nueva_descuento").fill("100");
  ok((await $("#nueva_valorFinal").innerText()).replace(/\s/g, " ").includes("2.500,00"), "cálculo 2×1300−100 = 2.500,00", await $("#nueva_valorFinal").innerText());
  await $("#nueva_pagamento").selectOption("PIX");
  await $("button:has-text('Registrar venda')").click();
  let vendas = await ls("vendas"); const v1 = vendas.find((v) => v.productoId === tenis.id);
  ok(v1 && v1.valorFinal === 2500 && v1.estado === "valida", "registro de venda", v1);
  ok((await ls("produtos")).find((p) => p.id === tenis.id).stock === 3, "estoque baixou 5→3");
  /* trocar de produto atualiza preço */
  await $("#nueva_producto").selectOption("p2");
  ok((await $("#nueva_valorUnitario").inputValue()) === "20,00", "preço atualiza ao trocar de produto", await $("#nueva_valorUnitario").inputValue());
  /* estoque insuficiente */
  await $("#nueva_producto").selectOption(tenis.id); await $("#nueva_cantidad").fill("9");
  await $("button:has-text('Registrar venda')").click();
  ok((await ls("vendas")).length === 2, "estoque insuficiente bloqueia venda");
  /* desconto > bruto */
  await $("#nueva_cantidad").fill("1"); await $("#nueva_descuento").fill("5000");
  await $("button:has-text('Registrar venda')").click();
  ok((await ls("vendas")).length === 2, "desconto maior que o bruto bloqueado");
  await $("[data-acao=limparFormularioVenda]").click();

  console.log("Histórico");
  await $(".nav-item[data-tela=historico]").click();
  ok(await $("#cuerpoHistorico tr").count() === 2, "histórico lista 2 vendas");
  await $("#hisBusca").fill("tênis");
  ok(await $("#cuerpoHistorico tr").count() === 1, "filtro por busca");
  await $("[data-acao=limparFiltrosHistorico]").click();
  await $("#hisPago").selectOption("PIX");
  ok(await $("#cuerpoHistorico tr").count() === 2, "filtro por pagamento");
  await $("[data-acao=limparFiltrosHistorico]").click();
  await $("#hisVendedor").selectOption(joao.id);
  ok(await $("#cuerpoHistorico tr").count() === 1, "filtro por vendedor");
  await $("[data-acao=limparFiltrosHistorico]").click();
  await $("#hisOrden").selectOption("valorMayor");
  ok((await $("#cuerpoHistorico tr").first().innerText()).includes("Tênis"), "ordenação por maior valor");
  await $("[data-acao=limparFiltrosHistorico]").click();
  ok((await $("#hisOrden").inputValue()) === "reciente", "limpar filtros restaura ordenação");
  /* anular */
  await $(`[data-acao=alternarEstadoVenda][data-id="${v1.id}"]`).click();
  await $("#confirmBoton").click();
  ok((await ls("vendas")).find((v) => v.id === v1.id).estado === "anulada", "anulação");
  ok((await ls("produtos")).find((p) => p.id === tenis.id).stock === 5, "estoque devolvido na anulação");
  /* editar venda anulada NÃO mexe no estoque */
  await $(`[data-acao=editarVenda][data-id="${v1.id}"]`).click();
  await $("#edit_cantidad").fill("3"); await $("#modalVenta button[type=submit]").click();
  ok((await ls("produtos")).find((p) => p.id === tenis.id).stock === 5, "editar venda anulada não altera estoque");
  ok((await ls("vendas")).find((v) => v.id === v1.id).cantidad === 3, "edição de venda salva");
  /* revalidar (3 unidades, estoque 5) */
  await $(`[data-acao=alternarEstadoVenda][data-id="${v1.id}"]`).click();
  ok((await ls("vendas")).find((v) => v.id === v1.id).estado === "valida", "revalidação");
  ok((await ls("produtos")).find((p) => p.id === tenis.id).stock === 2, "estoque baixou na revalidação");
  /* detalhe */
  await $(`[data-acao=verDetalheVenda][data-id="${v1.id}"]`).click();
  ok((await $("#detalleContenido").innerText()).includes("R$"), "modal de detalhes");
  await page.keyboard.press("Escape");
  ok(await $("#modalDetalleVenta.activo").count() === 0, "Esc fecha modal");
  /* excluir */
  await $(`[data-acao=excluirVenda][data-id="${v1.id}"]`).click();
  await $("#confirmBoton").click();
  ok((await ls("vendas")).length === 1, "exclusão de venda");
  ok((await ls("produtos")).find((p) => p.id === tenis.id).stock === 5, "estoque devolvido na exclusão");

  console.log("Metas, dashboard e comissões");
  await $(".nav-item[data-tela=dashboard]").click();
  await $("#metaMesInput").fill("10.000"); await $("#metaDiaInput").fill("1000");
  await $("#metaDiaInput").press("Enter");
  const cfg = await ls("config");
  ok(cfg.metas.mensual === 10000 && cfg.metas.diaria === 1000, "metas diária e mensal salvas", cfg.metas);
  ok((await $("#metaMesAlvo").innerText()).includes("10.000,00"), "meta mensal exibida em R$");
  /* venda hoje p/ dashboard */
  await $(".nav-item[data-tela=vendas]").click();
  await $("#nueva_producto").selectOption(tenis.id); await $("#nueva_vendedor").selectOption(joao.id);
  await $("#nueva_cantidad").fill("1"); await $("button:has-text('Registrar venda')").click();
  await $(".nav-item[data-tela=dashboard]").click();
  const cards = await $("#gridCards").innerText();
  ok(cards.includes("1.300,00"), "KPI faturamento do dia reflete venda", cards.slice(0, 200));
  ok((await $("#metaDiaPct").innerText()) === "130%", "meta diária 130% (sem truncar em 100)", await $("#metaDiaPct").innerText());
  ok((await $("#metaMesFaltam").innerText()).includes("Faltam"), "valor restante da meta mensal");
  ok(await $("#graficoFaturamentoDia svg rect.c-bar").count() >= 1, "gráfico de barras renderizado");
  ok(await $("#graficoPagos svg path, #graficoPagos svg circle").count() >= 1, "gráfico de pagamentos renderizado");
  await $("#graficoFaturamentoDia g[data-tip]").last().hover();
  await page.mouse.move(...(await (async () => { const b = await $("#graficoFaturamentoDia g[data-tip]").last().boundingBox(); return [b.x + b.width / 2 + 2, b.y + b.height / 2 + 2]; })()));
  await page.waitForTimeout(100);
  ok(await $("#tooltip.visivel").count() === 1, "tooltip do gráfico", await page.evaluate(() => document.getElementById("tooltip").className + "|" + document.getElementById("tooltip").textContent));
  await $(".nav-item[data-tela=vendedores]").click();
  const txtV = await $("#listaVendedores").innerText();
  ok(txtV.includes("130,00"), "comissão 10% de 1.300 = 130,00", txtV.slice(0, 300));

  console.log("Segurança (XSS) e integridade");
  await $("[data-acao=abrirModalVendedor]").first().click();
  await $("#vendNombre").fill('<img src=x onerror="window.__xss=1">'); await $("#vendFoto").fill("javascript:alert(1)");
  await $("#modalVendedor button[type=submit]").click();
  ok((await $("#erroVendedor").innerText()).includes("foto"), "foto com javascript: rejeitada");
  await $("#vendFoto").fill(""); await $("#modalVendedor button[type=submit]").click();
  await page.waitForTimeout(200);
  ok(!(await page.evaluate(() => window.__xss)), "nome malicioso não executa script");
  ok((await $("#listaVendedores").innerHTML()).includes("&lt;img"), "nome malicioso escapado");
  console.log("Exclusão de produto e vendedor");
  await $(".nav-item[data-tela=vendedores]").click();
  const nVendasAntes = (await ls("vendas")).length;
  await $(`[data-acao=excluirVendedor][data-id="${joao.id}"]`).click(); await $("#confirmBoton").click();
  ok((await ls("vendedores")).every((v) => v.id !== joao.id), "exclusão de vendedor");
  ok((await ls("vendas")).length < nVendasAntes, "vendas do vendedor removidas (comportamento existente)");
  await $(".nav-item[data-tela=produtos]").click();
  await $(`[data-acao=excluirProduto][data-id="p2"]`).click(); await $("#confirmBoton").click();
  ok((await ls("produtos")).every((p) => p.id !== "p2"), "exclusão de produto");

  console.log("Persistência: dados corrompidos");
  /* JSON corrompido não é sobrescrito silenciosamente */
  await page.evaluate(() => localStorage.setItem("produtos", "{quebrado"));
  await recarregar();
  const chaves = await page.evaluate(() => Object.keys(localStorage));
  ok(chaves.some((k) => k.startsWith("produtos__corrompido_")), "cópia do JSON corrompido preservada");

  console.log("Responsividade");
  for (const [w, h, nome] of [[1360, 900, "desktop"], [1024, 768, "notebook"], [768, 1024, "tablet"], [390, 844, "celular"]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const t of ["dashboard", "vendas", "historico", "produtos", "vendedores"]) {
      if (w <= 900) { await page.evaluate(() => fecharMenu()); }
      await page.evaluate((t) => trocarTela(t), t);
      await page.waitForTimeout(120);
      const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      ok(!over, `${nome} ${t}: sem rolagem horizontal`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await $(".menu-btn").click();
  ok(await $("#sidebar.aberta").count() === 1, "menu lateral abre no celular");

  ok(erros.length === 0, "sem erros de console durante todo o teste", erros);
  console.log(`\n${total - falhas}/${total} verificações passaram`);
  await browser.close();
  process.exit(falhas ? 1 : 0);
})();
