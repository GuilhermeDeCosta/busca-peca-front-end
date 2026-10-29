// =========================================================
// DADOS DE EXEMPLO (no futuro virão do back-end via fetch)
// =========================================================
const categorias = [
    { nome: "Iluminação",   icone: "💡" },
    { nome: "Filtros",      icone: "🧴" },
    { nome: "Retrovisores", icone: "🪞" },
    { nome: "Elétrica",     icone: "⚡" },
    { nome: "Lataria",      icone: "🚗" },
    { nome: "Motor",        icone: "⚙️" }
];

const destaques = [
    { id: 1, nome: "Farol direito Chevrolet Onix 2020-2023", oem: "52141029", loja: "Autopeças Avenida", nota: 4.8, preco: 489.90, estoque: 3, entrega: "Retirada ou entrega hoje", icone: "💡" },
    { id: 2, nome: "Filtro de óleo Tecfil PSL55", oem: "PSL55", loja: "Casa Tecfil", nota: 4.9, preco: 29.90, estoque: 15, entrega: "Entrega em 1 dia útil", icone: "🧴" },
    { id: 3, nome: "Retrovisor elétrico Chevrolet Onix", oem: "52149377", loja: "Retrovisores Centro", nota: 4.6, preco: 219.90, estoque: 2, entrega: "Retirada hoje", icone: "🪞" },
    { id: 4, nome: "Alternador Bosch 90A Onix GM", oem: "F000BL0726", loja: "Elétrica Paulista", nota: 4.7, preco: 749.00, estoque: 1, entrega: "Entrega em 2 dias", icone: "⚡" }
];

const revisao = [
    { id: 5, nome: "Filtro de óleo Tecfil PSL55", oem: "PSL55", loja: "Casa Tecfil", nota: 4.9, preco: 29.90, estoque: 15, entrega: "Entrega em 1 dia útil", icone: "🧴" },
    { id: 6, nome: "Retrovisor elétrico Chevrolet Onix", oem: "52149377", loja: "Retrovisores Centro", nota: 4.6, preco: 219.90, estoque: 2, entrega: "Retirada hoje", icone: "🪞" },
    { id: 7, nome: "Para-choque dianteiro Onix 2020", oem: "26247291", loja: "Lataria Norte", nota: 4.7, preco: 379.90, estoque: 4, entrega: "Entrega em 2 dias", icone: "🚗" }
];

// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

// Formata número como moeda brasileira: 29.9 -> "R$ 29,90"
function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mostra um aviso rápido no canto da tela
function mostrarToast(mensagem) {
    const toast = document.getElementById("toast");
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    setTimeout(() => toast.classList.remove("visivel"), 2200);
}

// =========================================================
// RENDERIZAÇÃO (cria o HTML a partir dos dados)
// =========================================================
function renderizarCategorias() {
    const lista = document.getElementById("lista-categorias");

    lista.innerHTML = categorias.map(cat => `
        <a class="categoria" href="resultados.html?categoria=${encodeURIComponent(cat.nome)}">
            <span class="categoria__icone">${cat.icone}</span>
            ${cat.nome}
        </a>
    `).join("");
}

function criarCard(peca) {
    return `
        <article class="card">
            <div class="card__topo">
                <span class="card__tag">Novo • Nacional</span>
                <button class="card__fav" data-fav="${peca.id}" aria-label="Favoritar">♡</button>
            </div>
            <div class="card__img">${peca.icone}</div>
            <h3 class="card__nome">${peca.nome}</h3>
            <span class="card__meta">OEM ${peca.oem}</span>
            <span class="card__preco">${formatarPreco(peca.preco)}</span>
            <span class="card__meta">${peca.loja} ★ ${peca.nota}</span>
            <span class="card__entrega">${peca.estoque} em estoque • ${peca.entrega}</span>
            <button class="btn btn--verde" data-add="${peca.id}">Adicionar ao carrinho</button>
            <a class="card__detalhes" href="detalhe.html?id=${peca.id}">Ver detalhes</a>
        </article>
    `;
}

function renderizarPecas(idElemento, pecas) {
    document.getElementById(idElemento).innerHTML = pecas.map(criarCard).join("");
}

// =========================================================
// CARRINHO (salvo no localStorage para não sumir ao recarregar)
// =========================================================
function lerCarrinho() {
    try {
        return JSON.parse(localStorage.getItem("carrinho")) || [];
    } catch {
        return [];
    }
}

function salvarCarrinho(carrinho) {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function atualizarContador() {
    const total = lerCarrinho().reduce((soma, item) => soma + item.qtd, 0);
    document.getElementById("cart-count").textContent = total;
}

function adicionarAoCarrinho(id) {
    const todas = [...destaques, ...revisao];
    const peca = todas.find(p => p.id === id);
    if (!peca) return;

    const carrinho = lerCarrinho();
    const existente = carrinho.find(item => item.id === id);

    if (existente) {
        existente.qtd++;
    } else {
        carrinho.push({ id: peca.id, nome: peca.nome, preco: peca.preco, loja: peca.loja, qtd: 1 });
    }

    salvarCarrinho(carrinho);
    atualizarContador();
    mostrarToast(`${peca.nome} adicionado ao carrinho`);
}

// =========================================================
// EVENTOS
// =========================================================

// Busca: em vez de recarregar, manda para a página de resultados com o termo
function configurarBusca(idForm) {
    document.getElementById(idForm).addEventListener("submit", (evento) => {
        evento.preventDefault();
        const termo = evento.target.q.value.trim();

        if (!termo) {
            mostrarToast("Digite o nome, código OEM ou placa da peça");
            return;
        }
        window.location.href = `resultados.html?q=${encodeURIComponent(termo)}`;
    });
}

// Um único "ouvinte" no documento trata os cliques de todos os cards
// (isso se chama delegação de eventos)
document.addEventListener("click", (evento) => {
    const botaoAdd = evento.target.closest("[data-add]");
    if (botaoAdd) {
        adicionarAoCarrinho(Number(botaoAdd.dataset.add));
        return;
    }

    const botaoFav = evento.target.closest("[data-fav]");
    if (botaoFav) {
        const favoritado = botaoFav.textContent === "♥";
        botaoFav.textContent = favoritado ? "♡" : "♥";
        mostrarToast(favoritado ? "Removido dos favoritos" : "Adicionado aos favoritos");
    }
});

// =========================================================
// INICIALIZAÇÃO (roda quando a página abre)
// =========================================================
renderizarCategorias();
renderizarPecas("lista-destaques", destaques);
renderizarPecas("lista-revisao", revisao);
configurarBusca("form-busca-topo");
configurarBusca("form-busca-hero");
atualizarContador();