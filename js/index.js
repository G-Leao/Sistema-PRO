/* ============================================================
   CAMADA DE PERSISTÊNCIA (isolada — futura troca por API REST)
   ============================================================ */
const Store = {
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  },

  getVendas() {
    return this._get("vendas", []);
  },
  saveVendas(v) {
    this._set("vendas", v);
  },

  getVendedores() {
    return this._get("vendedores", []);
  },
  saveVendedores(v) {
    this._set("vendedores", v);
  },

  getProdutos() {
    return this._get("produtos", []);
  },
  saveProdutos(v) {
    this._set("produtos", v);
  },

  getMeta() {
    return parseFloat(localStorage.getItem("meta")) || 0;
  },
  saveMeta(v) {
    localStorage.setItem("meta", v);
  },
};

let vendas = Store.getVendas();
let vendedores = Store.getVendedores();
let produtos = Store.getProdutos();
let meta = Store.getMeta();

function fmtMoeda(n) {
  return (n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const titulos = {
  dashboard: ["Dashboard", "Visão geral do dia"],
  vendas: ["Vendas", "Registre e acompanhe as vendas"],
  produtos: ["Produtos", "Catálogo usado nas vendas"],
  vendedores: ["Vendedores", "Equipe e desempenho"],
};

function trocarTela(id) {
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
  if (id === "dashboard") atualizarGraficos();
}

function abrirMenu() {
  document.getElementById("sidebar").classList.add("aberta");
  document.getElementById("backdrop").classList.add("ativo");
}
function fecharMenu() {
  document.getElementById("sidebar").classList.remove("aberta");
  document.getElementById("backdrop").classList.remove("ativo");
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("mostrar");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("mostrar"), 2200);
}

/* ============================================================
   META
   ============================================================ */
function definirMeta() {
  const valor = document.getElementById("metaInput").value;
  if (!valor || parseFloat(valor) <= 0) {
    toast("Digite uma meta válida");
    return;
  }
  meta = parseFloat(valor);
  Store.saveMeta(meta);
  document.getElementById("metaInput").value = "";
  atualizarDashboard();
  toast("Meta salva");
}

/* ============================================================
   PRODUTOS
   ============================================================ */
function addProduto() {
  const input = document.getElementById("nomeProduto");
  const erro = document.getElementById("erroProduto");
  let nome = input.value.trim();
  erro.textContent = "";
  input.classList.remove("input-erro");

  if (!nome) {
    erro.textContent = "Digite um nome.";
    input.classList.add("input-erro");
    return;
  }
  nome = nome.charAt(0).toUpperCase() + nome.slice(1);

  if (produtos.some((p) => p.toLowerCase() === nome.toLowerCase())) {
    erro.textContent = "Esse produto já existe.";
    input.classList.add("input-erro");
    return;
  }

  produtos.push(nome);
  Store.saveProdutos(produtos);
  input.value = "";
  atualizarProdutos();
  atualizarSelectProdutos();
  toast("Produto adicionado");
}

function removerProduto(index) {
  if (!confirm("Remover este produto?")) return;
  produtos.splice(index, 1);
  Store.saveProdutos(produtos);
  atualizarTudo();
  toast("Produto removido");
}

function atualizarProdutos() {
  const lista = document.getElementById("listaProdutos");
  const busca = (
    document.getElementById("buscaProduto").value || ""
  ).toLowerCase();
  const filtrados = produtos
    .map((p, i) => ({ nome: p, index: i }))
    .filter((p) => p.nome.toLowerCase().includes(busca));

  if (produtos.length === 0) {
    lista.innerHTML = `<div class="empty-state"><div class="icon">▤</div><p>Nenhum produto cadastrado ainda.<br>Adicione o primeiro produto acima.</p></div>`;
    return;
  }
  if (filtrados.length === 0) {
    lista.innerHTML = `<div class="empty-state"><p>Nenhum produto encontrado para "${busca}".</p></div>`;
    return;
  }

  lista.innerHTML = filtrados
    .map((p) => {
      const qtdVendida = vendas.filter((v) => v.produto === p.nome).length;
      return `
      <div class="row-card">
        <div class="row-main">
          <div class="row-title">${p.nome}</div>
          <div class="row-sub">${qtdVendida} venda(s) registrada(s)</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-danger-ghost" onclick="removerProduto(${p.index})">Remover</button>
        </div>
      </div>`;
    })
    .join("");
}

function atualizarSelectProdutos() {
  const select = document.getElementById("produto");
  select.innerHTML = "";
  if (produtos.length === 0) {
    select.innerHTML = '<option value="">Cadastre um produto primeiro</option>';
    return;
  }
  produtos.forEach((p) => {
    const op = document.createElement("option");
    op.value = p;
    op.textContent = p;
    select.appendChild(op);
  });
}

/* ============================================================
   VENDEDORES
   ============================================================ */
function addVendedor() {
  const input = document.getElementById("nomeVendedor");
  const nome = input.value.trim();
  if (!nome) {
    toast("Digite um nome");
    return;
  }
  vendedores.push(nome);
  Store.saveVendedores(vendedores);
  input.value = "";
  atualizarTudo();
  toast("Vendedor adicionado");
}

function removerVendedor(index) {
  if (
    !confirm(
      "Remover este vendedor? As vendas associadas a ele também serão removidas.",
    )
  )
    return;
  const nome = vendedores[index];
  vendas = vendas.filter((v) => v.vendedor !== nome);
  Store.saveVendas(vendas);
  vendedores.splice(index, 1);
  Store.saveVendedores(vendedores);
  atualizarTudo();
  toast("Vendedor removido");
}

function atualizarVendedores() {
  const lista = document.getElementById("listaVendedores");
  if (vendedores.length === 0) {
    lista.innerHTML = `<div class="empty-state"><div class="icon">◔</div><p>Nenhum vendedor cadastrado ainda.</p></div>`;
    return;
  }
  lista.innerHTML = vendedores
    .map((v, index) => {
      const vendasDele = vendas.filter((x) => x.vendedor === v);
      const totalDele = vendasDele.reduce((s, x) => s + x.valor, 0);
      return `
      <div class="row-card">
        <div class="row-main">
          <div class="row-title">${v}</div>
          <div class="row-sub">${vendasDele.length} venda(s) · ${fmtMoeda(totalDele)} no total</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-danger-ghost" onclick="removerVendedor(${index})">Remover</button>
        </div>
      </div>`;
    })
    .join("");
}

function atualizarSelect() {
  const select = document.getElementById("vendedorSelect");
  select.innerHTML = "";
  if (vendedores.length === 0) {
    select.innerHTML =
      '<option value="">Cadastre um vendedor primeiro</option>';
    return;
  }
  vendedores.forEach((v) => {
    const op = document.createElement("option");
    op.value = v;
    op.textContent = v;
    select.appendChild(op);
  });
}

/* ============================================================
   VENDAS
   ============================================================ */
function addVenda() {
  const produto = document.getElementById("produto").value;
  const valorInput = document.getElementById("valor");
  const vendedor = document.getElementById("vendedorSelect").value;
  const valor = valorInput.value.trim();

  if (!produto || !vendedor || valor === "") {
    toast("Preencha todos os campos");
    return;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(valor)) {
    toast("Digite um valor válido");
    return;
  }

  vendas.push({
    produto,
    valor: parseFloat(valor),
    vendedor,
    data: new Date().toLocaleDateString("pt-BR"),
  });
  Store.saveVendas(vendas);
  valorInput.value = "";
  atualizarTudo();
  toast("Venda registrada");
}

function removerVenda(index) {
  if (!confirm("Remover esta venda?")) return;
  vendas.splice(index, 1);
  Store.saveVendas(vendas);
  atualizarTudo();
  toast("Venda removida");
}

function editarVenda(index) {
  const venda = vendas[index];
  const novoValor = prompt("Editar valor da venda:", venda.valor);
  if (novoValor === null) return;
  if (!/^\d+(\.\d{1,2})?$/.test(novoValor)) {
    toast("Valor inválido");
    return;
  }
  vendas[index].valor = parseFloat(novoValor);
  Store.saveVendas(vendas);
  atualizarTudo();
  toast("Venda atualizada");
}

function limparVendas() {
  if (!confirm("Apagar todas as vendas? Esta ação não pode ser desfeita."))
    return;
  vendas = [];
  Store.saveVendas(vendas);
  atualizarTudo();
  toast("Vendas removidas");
}

function toggleGrupo(el) {
  const body = el.nextElementSibling;
  const abrir = body.style.display !== "block";
  body.style.display = abrir ? "block" : "none";
  el.querySelector(".chev").textContent = abrir ? "▾" : "▸";
}

function atualizarVendas() {
  const lista = document.getElementById("listaVendas");
  const busca = (
    document.getElementById("buscaVenda").value || ""
  ).toLowerCase();

  const vendasFiltradas = vendas
    .map((v, i) => ({ ...v, index: i }))
    .filter(
      (v) =>
        v.produto.toLowerCase().includes(busca) ||
        v.vendedor.toLowerCase().includes(busca),
    );

  if (vendas.length === 0) {
    lista.innerHTML = `<div class="empty-state"><div class="icon">↗</div><p>Nenhuma venda registrada ainda.<br>Cadastre a primeira venda acima.</p></div>`;
    return;
  }
  if (vendasFiltradas.length === 0) {
    lista.innerHTML = `<div class="empty-state"><p>Nenhuma venda encontrada para "${busca}".</p></div>`;
    return;
  }

  const grupos = {};
  vendasFiltradas.forEach((v) => {
    const chave = v.produto + "_" + v.valor;
    (grupos[chave] = grupos[chave] || []).push(v);
  });

  lista.innerHTML = Object.values(grupos)
    .map((grupo) => {
      const p = grupo[0];
      return `
      <div class="venda-group">
        <div class="venda-group-head" onclick="toggleGrupo(this)">
          <div class="row-main">
            <div class="row-title"><span class="chev">▸</span> ${p.produto}</div>
            <div class="row-sub">${grupo.length} venda(s)</div>
          </div>
          <div class="row-value">${fmtMoeda(p.valor)}</div>
        </div>
        <div class="venda-group-body">
          ${grupo
            .map(
              (v) => `
            <div class="venda-item">
              <span>${v.vendedor} · ${v.data}</span>
              <span class="row-actions">
                <button class="btn btn-sm btn-icon" onclick="editarVenda(${v.index})">✎</button>
                <button class="btn btn-sm btn-icon btn-danger-ghost" onclick="removerVenda(${v.index})">✕</button>
              </span>
            </div>`,
            )
            .join("")}
        </div>
      </div>`;
    })
    .join("");
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString("pt-BR");
  let total = 0,
    totalHoje = 0;
  const contagemProdutos = {},
    vendasHoje = {};

  vendas.forEach((v) => {
    total += v.valor;
    if (v.data === hoje) totalHoje += v.valor;
    contagemProdutos[v.produto] = (contagemProdutos[v.produto] || 0) + 1;
    if (v.data === hoje)
      vendasHoje[v.vendedor] = (vendasHoje[v.vendedor] || 0) + 1;
  });

  let maisVendido = "—",
    maiorProduto = 0;
  for (const p in contagemProdutos) {
    if (contagemProdutos[p] > maiorProduto) {
      maiorProduto = contagemProdutos[p];
      maisVendido = p;
    }
  }

  let vendedorTop = null,
    maiorVendas = 0;
  for (const v in vendasHoje) {
    if (vendasHoje[v] > maiorVendas) {
      maiorVendas = vendasHoje[v];
      vendedorTop = v;
    }
  }

  let progresso = meta > 0 ? Math.min((totalHoje / meta) * 100, 100) : 0;
  document.getElementById("barraProgresso").style.width = progresso + "%";
  document.getElementById("metaAtual").textContent = fmtMoeda(totalHoje);
  document.getElementById("metaAlvo").textContent = meta
    .toFixed(2)
    .replace(".", ",");
  document.getElementById("metaPct").textContent = progresso.toFixed(0) + "%";

  const statusEl = document.getElementById("metaStatus");
  const faltamEl = document.getElementById("metaFaltam");
  if (meta <= 0) {
    statusEl.textContent = "Sem meta definida";
    statusEl.classList.remove("ok");
    faltamEl.textContent = "";
  } else if (totalHoje >= meta) {
    statusEl.textContent = "Meta atingida";
    statusEl.classList.add("ok");
    faltamEl.textContent = "Meta do dia concluída 🎉";
  } else {
    statusEl.textContent = "Em andamento";
    statusEl.classList.remove("ok");
    faltamEl.textContent = `Faltam ${fmtMoeda(meta - totalHoje)} para bater a meta`;
  }

  document.getElementById("total").textContent = fmtMoeda(total);
  document.getElementById("qtd").textContent = vendas.length;
  document.getElementById("maisVendido").textContent = maisVendido;
  document.getElementById("vendedorDia").textContent = vendedorTop
    ? `${vendedorTop} (${maiorVendas})`
    : "Sem vendas hoje";
}

/* ============================================================
   GRÁFICOS (Chart.js) — instâncias controladas e destruídas
   ============================================================ */
let graficoProdutos = null;
let graficoVendedores = null;

function paletaTema() {
  return {
    grid: "rgba(255,255,255,.08)",
    text: "#a0a0b8",
    bar: "#00c896",
  };
}

function atualizarGraficos() {
  const cores = paletaTema();

  const contagemProdutos = {};
  vendas.forEach((v) => {
    contagemProdutos[v.produto] = (contagemProdutos[v.produto] || 0) + 1;
  });
  const topProdutos = Object.entries(contagemProdutos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const contagemVendedores = {};
  vendas.forEach((v) => {
    contagemVendedores[v.vendedor] =
      (contagemVendedores[v.vendedor] || 0) + v.valor;
  });
  const topVendedores = Object.entries(contagemVendedores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: cores.text, font: { size: 11 } },
      },
      y: {
        grid: { color: cores.grid },
        ticks: { color: cores.text, font: { size: 11 } },
        beginAtZero: true,
      },
    },
  };

  if (graficoProdutos) graficoProdutos.destroy();
  const ctxP = document.getElementById("graficoProdutos");
  if (ctxP) {
    graficoProdutos = new Chart(ctxP, {
      type: "bar",
      data: {
        labels: topProdutos.map((p) => p[0]),
        datasets: [
          {
            data: topProdutos.map((p) => p[1]),
            backgroundColor: cores.bar,
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      },
      options: baseOpts,
    });
  }

  if (graficoVendedores) graficoVendedores.destroy();
  const ctxV = document.getElementById("graficoVendedores");
  if (ctxV) {
    graficoVendedores = new Chart(ctxV, {
      type: "bar",
      data: {
        labels: topVendedores.map((v) => v[0]),
        datasets: [
          {
            data: topVendedores.map((v) => v[1]),
            backgroundColor: cores.bar,
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        ...baseOpts,
        scales: {
          ...baseOpts.scales,
          y: {
            ...baseOpts.scales.y,
            ticks: {
              ...baseOpts.scales.y.ticks,
              callback: (v) => "R$ " + v,
            },
          },
        },
      },
    });
  }
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
function atualizarTudo() {
  atualizarDashboard();
  atualizarVendas();
  atualizarVendedores();
  atualizarSelect();
  atualizarProdutos();
  atualizarSelectProdutos();
  if (document.getElementById("dashboard").classList.contains("ativa"))
    atualizarGraficos();
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) fecharMenu();
});

atualizarTudo();
