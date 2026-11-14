/* =========================================================
   CABEÇALHO DO SITE (componente) • js/components/cabecalho.js

   Preenche o <header id="cabecalho"></header> de qualquer página com:
   faixa do topo com a localização, logo, busca, usuário logado e menu,
   favoritos, notificações, carrinho com contador e o menu principal.

   Documentação do Front-end: "Cabeçalho • Todas as páginas • Logo, campo
   de busca, ícone do carrinho com quantidade, sino de notificações com
   contador, menu do usuário. Muda conforme o visitante esteja logado,
   tenha loja ou seja admin."

   Rotas da API usadas (Documentação do Back-end):
     GET  /api/auth/me                     quem está logado, papéis e loja
     GET  /api/carrinho                    quantidade no carrinho
     GET  /api/notificacoes/nao-lidas/total contador do sino
     GET  /api/categorias                  lista do menu "Categorias"
     GET  /api/auth/csrf + POST /api/auth/logout   botão "Sair"
   ========================================================= */
(function () {
    'use strict';

    // ---------- Configuração ----------

    // Raiz do projeto, descoberta a partir deste arquivo (js/components/ → ../../).
    // Assim os links funcionam em qualquer pasta de pages/.
    const RAIZ = new URL('../../', document.currentScript.src).href;

    const API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api'
        : 'https://api.buscapeca.com.br/api';

    const TEMPO_LIMITE_MS = 15000;
    const CHAVE_LOCALIZACAO = 'bp:localizacao'; // sessionStorage: filtro de busca, sem dado pessoal

    // Caminhos das páginas a partir da raiz. Mudou o nome de um arquivo? Mude só aqui.
    const ROTAS = {
        inicio: 'index.html',
        resultados: 'pages/busca/resultados.html',
        favoritos: 'pages/conta/favoritos.html',
        perfil: 'pages/conta/perfil.html',
        conversas: 'pages/conta/conversas.html',
        notificacoes: 'pages/conta/notificacoes.html',
        login: 'pages/conta/login.html',
        cadastro: 'pages/conta/cadastro.html',
        carrinho: 'pages/compra/carrinho.html',
        minhasCompras: 'pages/compra/minhas-compras.html',
        painelLoja: 'pages/minha-loja/painel.html',
        criarLoja: 'pages/minha-loja/criar-loja.html',
        novaPeca: 'pages/minha-loja/form-peca.html',
        admin: 'pages/admin/usuarios.html'
    };

    // Menu principal. "caminhos" marca o item ativo pela página aberta.
    // Também dá para forçar com <header id="cabecalho" data-ativo="minha-loja">.
    const MENU = [
        { id: 'inicio', texto: 'Início', rota: 'inicio', caminhos: ['index.html', ''] },
        { id: 'buscar', texto: 'Buscar peças', rota: 'resultados', caminhos: ['pages/busca/'] },
        { id: 'categorias', texto: 'Categorias', painel: true },
        { id: 'favoritos', texto: 'Favoritos', rota: 'favoritos', caminhos: ['pages/conta/favoritos'] },
        { id: 'pedidos', texto: 'Meus pedidos', rota: 'minhasCompras', caminhos: ['pages/compra/'] },
        { id: 'minha-loja', texto: 'Minha Loja', rota: 'painelLoja', caminhos: ['pages/minha-loja/'] },
        { id: 'perfil', texto: 'Meu perfil', rota: 'perfil', caminhos: ['pages/conta/'] }
    ];

    // ---------- Utilitários ----------

    function link(chave, params) {
        const u = new URL(ROTAS[chave], RAIZ);
        Object.entries(params || {}).forEach(function ([k, v]) {
            if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
        });
        return u.href;
    }

    // Leva ao login e volta para a página pedida depois de entrar
    function linkComLogin(chave) {
        return link('login', { voltar: new URL(link(chave)).pathname });
    }

    function esc(texto) {
        return String(texto ?? '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function caminhoAtual() {
        const raiz = new URL(RAIZ).pathname;
        return window.location.pathname.startsWith(raiz)
            ? window.location.pathname.slice(raiz.length)
            : window.location.pathname.replace(/^\//, '');
    }

    function itemAtivo(header) {
        if (header.dataset.ativo) return header.dataset.ativo;
        const atual = caminhoAtual();
        const item = MENU.find(function (m) {
            return (m.caminhos || []).some(function (c) {
                return c === '' ? atual === '' : atual.startsWith(c);
            });
        });
        return item ? item.id : null;
    }

    async function chamarApi(metodo, rota, corpo) {
        const controle = new AbortController();
        const timer = setTimeout(function () { controle.abort(); }, TEMPO_LIMITE_MS);
        try {
            const cabecalhos = { Accept: 'application/json' };
            if (metodo !== 'GET') {
                const r = await fetch(API_URL + '/auth/csrf', { credentials: 'include', signal: controle.signal });
                cabecalhos['X-XSRF-TOKEN'] = (await r.json()).token;
                cabecalhos['Content-Type'] = 'application/json';
            }
            const resposta = await fetch(API_URL + rota, {
                method: metodo,
                credentials: 'include',
                headers: cabecalhos,
                body: corpo ? JSON.stringify(corpo) : undefined,
                signal: controle.signal
            });
            const dados = resposta.status === 204 ? null : await resposta.json().catch(function () { return null; });
            return { ok: resposta.ok, status: resposta.status, dados: dados };
        } catch (e) {
            return { ok: false, status: 0, dados: null };
        } finally {
            clearTimeout(timer);
        }
    }

    // ---------- Montagem do HTML ----------

    function htmlBusca(id, extra) {
        const q = new URLSearchParams(window.location.search).get('q') || '';
        return `
        <form class="cabecalho-busca ${extra}" role="search" action="${link('resultados')}" novalidate>
            <div class="input-group">
                <span class="input-group-text bg-white"><i class="bi bi-search" aria-hidden="true"></i></span>
                <input id="${id}" class="form-control border-start-0" type="search" name="q" value="${esc(q)}"
                       placeholder="Busque por peça, OEM, EAN ou SKU" aria-label="Buscar peças" maxlength="120"
                       autocomplete="off">
            </div>
        </form>`;
    }

    function htmlMenu(ativo) {
        return MENU.map(function (m) {
            const classe = 'nav-link' + (m.id === 'inicio' ? ' ps-0' : '') + (m.id === ativo ? ' active' : '');
            const atual = m.id === ativo ? ' aria-current="page"' : '';
            if (m.painel) {
                return `<li class="nav-item"><button type="button" class="${classe} cabecalho-nav-botao"
                        data-abre="painel-categorias" aria-expanded="false" aria-controls="painel-categorias">
                        ${m.texto} <i class="bi bi-chevron-down small" aria-hidden="true"></i></button></li>`;
            }
            return `<li class="nav-item"><a class="${classe}" data-menu="${m.id}" href="${link(m.rota)}"${atual}>${m.texto}</a></li>`;
        }).join('');
    }

    function montar(header) {
        const ativo = itemAtivo(header);
        header.classList.add('cabecalho');
        header.innerHTML = `
        <a class="visually-hidden-focusable" href="#conteudo">Pular para o conteúdo</a>

        <div class="faixa-topo py-1">
            <div class="container-fluid px-3 px-lg-4 d-flex justify-content-between gap-3">
                <span class="text-truncate">Peças certas. Oficinas em movimento.</span>
                <span class="text-nowrap">
                    <span id="cabecalho-local">Informe sua localização</span> •
                    <button type="button" class="faixa-topo__botao" data-abre="painel-localizacao"
                            aria-expanded="false" aria-controls="painel-localizacao">Alterar localização</button>
                </span>
            </div>
        </div>

        <!-- Painel: alterar localização (ADR-013: explica o motivo e oferece o CEP) -->
        <div id="painel-localizacao" class="cabecalho-painel" hidden>
            <div class="container-fluid px-3 px-lg-4 py-3">
                <p class="small text-secondary mb-2">Usamos a localização só para mostrar a distância até as lojas. Se preferir, informe o CEP.</p>
                <form id="form-localizacao" class="d-flex flex-wrap align-items-start gap-2" novalidate>
                    <div>
                        <label for="cabecalho-cep" class="visually-hidden">CEP</label>
                        <input id="cabecalho-cep" class="form-control" inputmode="numeric" maxlength="9"
                               placeholder="00000-000" aria-describedby="cabecalho-cep-erro">
                        <div id="cabecalho-cep-erro" class="small text-danger mt-1" aria-live="polite"></div>
                    </div>
                    <button type="submit" class="btn btn-primary cabecalho-btn">Usar este CEP</button>
                    <button type="button" id="usar-gps" class="btn btn-outline-secondary cabecalho-btn">
                        <i class="bi bi-geo-alt" aria-hidden="true"></i> Usar minha localização</button>
                </form>
            </div>
        </div>

        <div class="bg-white border-bottom">
            <div class="container-fluid px-3 px-lg-4 d-flex align-items-center gap-3 py-2">
                <a href="${link('inicio')}" class="marca text-nowrap" aria-label="Busca Peças, página inicial">
                    <i class="bi bi-gear-wide-connected" aria-hidden="true"></i> BUSCA PEÇAS
                </a>

                ${htmlBusca('cabecalho-q', 'flex-grow-1 d-none d-md-block')}

                <div class="ms-auto d-flex align-items-center gap-3">
                    <button type="button" class="cabecalho-icone d-md-none" data-abre="busca-mobile"
                            aria-expanded="false" aria-controls="busca-mobile" aria-label="Abrir busca">
                        <i class="bi bi-search" aria-hidden="true"></i></button>

                    <div id="cabecalho-usuario" class="d-flex align-items-center"></div>

                    <a id="link-favoritos" href="${link('favoritos')}" class="cabecalho-icone" aria-label="Favoritos">
                        <i class="bi bi-heart" aria-hidden="true"></i></a>

                    <a id="link-notificacoes" href="${link('notificacoes')}" class="cabecalho-icone" aria-label="Notificações" hidden>
                        <i class="bi bi-bell" aria-hidden="true"></i>
                        <span class="cabecalho-contador" id="contador-notificacoes" hidden></span></a>

                    <a id="link-carrinho" href="${link('carrinho')}" class="cabecalho-icone" aria-label="Carrinho">
                        <i class="bi bi-cart3" aria-hidden="true"></i>
                        <span class="cabecalho-contador" id="contador-carrinho" hidden></span></a>
                </div>
            </div>

            <!-- Busca no celular (abaixo de 768 px) -->
            <div id="busca-mobile" class="container-fluid px-3 pb-2 d-md-none" hidden>
                ${htmlBusca('cabecalho-q-mobile', '')}
            </div>

            <nav class="container-fluid px-3 px-lg-4 d-flex align-items-center menu-principal overflow-auto" aria-label="Menu principal">
                <ul class="nav flex-nowrap">${htmlMenu(ativo)}</ul>
                <a id="link-anunciar" href="${link('criarLoja')}" class="link-anunciar ms-auto text-nowrap ps-3">+ Anuncie suas peças</a>
            </nav>

            <!-- Painel: categorias (fora do <nav> para não ser cortado pela rolagem do menu) -->
            <div id="painel-categorias" class="cabecalho-painel border-top" hidden>
                <div class="container-fluid px-3 px-lg-4 py-3">
                    <ul id="lista-categorias" class="cabecalho-categorias list-unstyled mb-0">
                        <li class="text-secondary small">Carregando categorias…</li>
                    </ul>
                </div>
            </div>
        </div>`;
    }

    // ---------- Usuário (visitante, comprador, vendedor, admin) ----------

    function papeis(usuario) {
        return (usuario.papeis || usuario.roles || []).map(function (p) {
            return String(p.nome || p).toUpperCase();
        });
    }

    function temLoja(usuario) {
        return Boolean(usuario && (usuario.temLoja || usuario.loja || papeis(usuario).includes('VENDEDOR')));
    }

    function ehAdmin(usuario) {
        return Boolean(usuario && papeis(usuario).some(function (p) { return p.includes('ADMIN'); }));
    }

    function mostrarUsuario(header, usuario) {
        const area = header.querySelector('#cabecalho-usuario');

        // Visitante: Entrar e Criar conta
        if (!usuario) {
            area.innerHTML = `
                <a href="${link('login', { voltar: window.location.pathname })}" class="cabecalho-entrar small fw-semibold">Entrar</a>
                <a href="${link('cadastro')}" class="btn btn-sm btn-outline-primary ms-2 d-none d-sm-inline-flex">Criar conta</a>`;
            header.querySelector('#link-favoritos').href = linkComLogin('favoritos');
            header.querySelector('#link-carrinho').href = linkComLogin('carrinho');
            header.querySelector('#link-anunciar').href = linkComLogin('criarLoja');
            header.querySelector('[data-menu="minha-loja"]').href = linkComLogin('criarLoja');
            return;
        }

        const loja = temLoja(usuario);
        const nome = usuario.nome || '';
        const empresa = usuario.nomeExibicao || usuario.nomeEmpresa || '';

        // Menu do usuário conforme o papel (Documentação do Front-end)
        const itens = [
            ['Minhas compras', link('minhasCompras')],
            ['Favoritos', link('favoritos')],
            ['Conversas', link('conversas')],
            ['Perfil', link('perfil')],
            loja ? ['Minha Loja', link('painelLoja')] : ['Quero vender', link('criarLoja')]
        ];
        if (ehAdmin(usuario)) itens.push(['Administração', link('admin')]);

        area.innerHTML = `
            <div class="position-relative">
                <button type="button" class="cabecalho-usuario" data-abre="menu-usuario"
                        aria-expanded="false" aria-controls="menu-usuario" aria-label="Menu da conta de ${esc(nome)}">
                    <span class="d-none d-lg-block text-end lh-sm small">
                        <span class="text-secondary">Olá, ${esc(nome)}</span><br>
                        <strong>${esc(empresa || 'Minha conta')}</strong>
                        <i class="bi bi-chevron-down small" aria-hidden="true"></i>
                    </span>
                    <i class="bi bi-person-circle fs-5 d-lg-none" aria-hidden="true"></i>
                </button>
                <ul id="menu-usuario" class="dropdown-menu dropdown-menu-end cabecalho-menu-usuario" hidden>
                    ${itens.map(function (i) { return `<li><a class="dropdown-item" href="${i[1]}">${i[0]}</a></li>`; }).join('')}
                    <li><hr class="dropdown-divider"></li>
                    <li><button type="button" class="dropdown-item" id="botao-sair">Sair</button></li>
                </ul>
            </div>`;

        header.querySelector('#link-notificacoes').hidden = false;
        header.querySelector('[data-menu="minha-loja"]').href = link(loja ? 'painelLoja' : 'criarLoja');
        header.querySelector('#link-anunciar').href = link(loja ? 'novaPeca' : 'criarLoja');
        header.querySelector('#botao-sair').addEventListener('click', sair);

        // Cidade do endereço principal, se a API mandar e o usuário não escolheu outra
        if (!lerLocalizacao() && usuario.cidade && usuario.uf) {
            header.querySelector('#cabecalho-local').textContent = usuario.cidade + ', ' + usuario.uf;
        }
    }

    async function sair() {
        await chamarApi('POST', '/auth/logout');
        window.location.href = link('inicio');
    }

    // ---------- Contadores ----------

    function definirContador(id, linkId, quantidade, nome) {
        const contador = document.getElementById(id);
        const alvo = document.getElementById(linkId);
        if (!contador || !alvo) return;
        const n = Math.max(0, Number(quantidade) || 0);
        contador.textContent = n > 99 ? '99+' : String(n);
        contador.hidden = n === 0;
        alvo.setAttribute('aria-label', n ? `${nome}, ${n} ${n === 1 ? 'item' : 'itens'}` : nome);
    }

    // Soma as quantidades do carrinho, que vem agrupado por loja
    function contarCarrinho(dados) {
        if (!dados) return 0;
        if (typeof dados.quantidadeTotal === 'number') return dados.quantidadeTotal;
        if (typeof dados.totalItens === 'number') return dados.totalItens;
        const lojas = dados.lojas || dados.grupos || [];
        const itens = lojas.length ? lojas.flatMap(function (l) { return l.itens || []; }) : (dados.itens || []);
        return itens.reduce(function (soma, i) { return soma + (Number(i.quantidade) || 1); }, 0);
    }

    async function carregarContadores() {
        const [carrinho, notificacoes] = await Promise.all([
            chamarApi('GET', '/carrinho'),
            chamarApi('GET', '/notificacoes/nao-lidas/total')
        ]);
        if (carrinho.ok) api.atualizarCarrinho(contarCarrinho(carrinho.dados));
        if (notificacoes.ok) {
            const d = notificacoes.dados;
            api.atualizarNotificacoes(typeof d === 'number' ? d : (d && (d.total ?? d.quantidade)) || 0);
        }
    }

    // ---------- Categorias ----------

    let categoriasCarregadas = false;

    async function carregarCategorias() {
        if (categoriasCarregadas) return;
        const lista = document.getElementById('lista-categorias');
        const resposta = await chamarApi('GET', '/categorias');
        const categorias = resposta.ok ? (Array.isArray(resposta.dados) ? resposta.dados : (resposta.dados?.itens || [])) : null;

        if (!categorias) {
            lista.innerHTML = `<li class="small text-secondary">Não foi possível carregar as categorias.
                <a href="${link('resultados')}">Ver todas as peças</a></li>`;
            return;
        }
        categoriasCarregadas = true;
        lista.innerHTML = categorias.map(function (c) {
            return `<li><a href="${link('resultados', { categoria: c.id })}">${esc(c.nome)}</a></li>`;
        }).join('') + `<li><a class="fw-semibold" href="${link('resultados')}">Ver todas</a></li>`;
    }

    // ---------- Localização ----------

    function lerLocalizacao() {
        try { return JSON.parse(sessionStorage.getItem(CHAVE_LOCALIZACAO)); } catch (e) { return null; }
    }

    function salvarLocalizacao(local) {
        try { sessionStorage.setItem(CHAVE_LOCALIZACAO, JSON.stringify(local)); } catch (e) { /* navegador bloqueou */ }
        document.getElementById('cabecalho-local').textContent = local.rotulo;
        fecharTudo();
        // A página de resultados pode ouvir este evento e refazer a busca por distância
        document.dispatchEvent(new CustomEvent('localizacao:alterada', { detail: local }));
    }

    function ligarLocalizacao() {
        const salva = lerLocalizacao();
        if (salva) document.getElementById('cabecalho-local').textContent = salva.rotulo;

        const cep = document.getElementById('cabecalho-cep');
        const erro = document.getElementById('cabecalho-cep-erro');

        cep.addEventListener('input', function () {
            const d = cep.value.replace(/\D/g, '').slice(0, 8);
            cep.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
            erro.textContent = '';
            cep.classList.remove('is-invalid');
        });

        document.getElementById('form-localizacao').addEventListener('submit', function (e) {
            e.preventDefault();
            const d = cep.value.replace(/\D/g, '');
            if (d.length !== 8) {
                erro.textContent = 'Informe um CEP com 8 números.';
                cep.classList.add('is-invalid');
                cep.focus();
                return;
            }
            salvarLocalizacao({ tipo: 'cep', cep: d, rotulo: 'CEP ' + d.slice(0, 5) + '-' + d.slice(5) });
        });

        document.getElementById('usar-gps').addEventListener('click', function () {
            if (!navigator.geolocation) {
                erro.textContent = 'Seu navegador não informa a localização. Informe o CEP.';
                return;
            }
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    salvarLocalizacao({
                        tipo: 'gps',
                        lat: pos.coords.latitude.toFixed(5),
                        lng: pos.coords.longitude.toFixed(5),
                        rotulo: 'Perto de você'
                    });
                },
                function () {
                    // ADR-012/013: negou ou falhou → CEP como alternativa
                    erro.textContent = 'Não foi possível usar sua localização. Informe o CEP.';
                    cep.focus();
                },
                { timeout: 10000 }
            );
        });
    }

    // ---------- Busca ----------

    function ligarBusca(header) {
        header.querySelectorAll('.cabecalho-busca').forEach(function (form) {
            const campo = form.querySelector('input[name="q"]');
            campo.addEventListener('input', function () { campo.setCustomValidity(''); });

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                const q = campo.value.trim();
                if (q.length === 0) {
                    campo.setCustomValidity('Informe o nome da peça, o código OEM, EAN ou SKU.');
                } else if (q.length < 3) {
                    campo.setCustomValidity('Digite pelo menos 3 caracteres para buscar.');
                }
                if (!campo.checkValidity()) {
                    campo.reportValidity();
                    return;
                }
                // Leva junto a localização escolhida (busca por distância, BP1-7)
                const local = lerLocalizacao() || {};
                window.location.href = link('resultados', { q: q, cep: local.cep, lat: local.lat, lng: local.lng });
            });
        });
    }

    // ---------- Abrir e fechar painéis e menus ----------

    function fecharTudo(exceto) {
        document.querySelectorAll('#cabecalho [data-abre]').forEach(function (botao) {
            const alvo = document.getElementById(botao.dataset.abre);
            if (alvo && alvo !== exceto) {
                alvo.hidden = true;
                botao.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function ligarAberturas(header) {
        header.addEventListener('click', function (e) {
            const botao = e.target.closest('[data-abre]');
            if (!botao) return;
            const alvo = document.getElementById(botao.dataset.abre);
            const abrir = alvo.hidden;
            fecharTudo(alvo);
            alvo.hidden = !abrir;
            alvo.classList.toggle('show', abrir); // dropdown-menu do Bootstrap precisa de .show
            botao.setAttribute('aria-expanded', String(abrir));
            if (!abrir) return;

            if (alvo.id === 'painel-categorias') carregarCategorias();
            const primeiro = alvo.querySelector('input, a, button');
            if (primeiro) primeiro.focus();
        });

        // Clique fora fecha
        document.addEventListener('click', function (e) {
            if (!header.contains(e.target)) fecharTudo();
        });

        // Esc fecha e devolve o foco ao botão que abriu
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            const aberto = header.querySelector('[data-abre][aria-expanded="true"]');
            fecharTudo();
            if (aberto) aberto.focus();
        });
    }

    // ---------- Interface pública (para as páginas usarem) ----------

    let resolverPronto;
    const api = {
        usuario: null,
        // Promise com o usuário logado (ou null). Ex.: Cabecalho.pronto.then(u => ...)
        pronto: new Promise(function (r) { resolverPronto = r; }),
        atualizarCarrinho: function (n) { definirContador('contador-carrinho', 'link-carrinho', n, 'Carrinho'); },
        atualizarNotificacoes: function (n) { definirContador('contador-notificacoes', 'link-notificacoes', n, 'Notificações'); }
    };
    window.Cabecalho = api;

    // A página do carrinho ou da peça pode avisar sem chamar a API de novo:
    // document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: 3 } }))
    document.addEventListener('carrinho:atualizado', function (e) { api.atualizarCarrinho(e.detail.quantidade); });
    document.addEventListener('notificacoes:atualizadas', function (e) { api.atualizarNotificacoes(e.detail.quantidade); });

    // ---------- Início ----------

    async function iniciar() {
        const header = document.getElementById('cabecalho');
        if (!header) return;

        montar(header);
        ligarAberturas(header);
        ligarBusca(header);
        ligarLocalizacao();

        // Quem está logado (401 = visitante; o cabeçalho não redireciona)
        const resposta = await chamarApi('GET', '/auth/me');
        api.usuario = resposta.ok ? resposta.dados : null;
        mostrarUsuario(header, api.usuario);
        resolverPronto(api.usuario);
        document.dispatchEvent(new CustomEvent('cabecalho:pronto', { detail: api.usuario }));

        if (api.usuario) carregarContadores();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();