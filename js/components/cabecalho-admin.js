/* =========================================================
   CABEÇALHO DA ÁREA ADMINISTRATIVA (componente) • js/components/cabecalho-admin.js

   Usado pelas páginas de pages/admin/ (Fluxo E • Administração) no lugar
   do cabecalho.js do marketplace. Preenche o <header id="cabecalho"> com:
   faixa "Área administrativa • Acesso interno" e o papel do usuário, logo,
   busca de peças, usuário logado e o menu Usuários, Termos, Notificações
   gerais e Disputas, com "Voltar ao marketplace".

   Usa as mesmas classes de css/componentes.css do cabeçalho do site.
   Marca o item ativo pela página aberta ou por <header data-ativo="usuarios">.

   Rotas da API: GET /api/auth/me • GET /api/auth/csrf + POST /api/auth/logout

   Interface para as páginas (igual à do cabecalho.js):
     window.Cabecalho.pronto          Promise com o usuário logado (ou null)
     window.Cabecalho.ehAdmin(u)      true se tem papel interno de administração
     window.Cabecalho.definirUsuario(u)  mostra um usuário (usado pela simulação)
   ========================================================= */
(function () {
    'use strict';

    const RAIZ = new URL('../../', document.currentScript.src).href;

    const API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api'
        : 'https://api.buscapeca.com.br/api';

    const TEMPO_LIMITE_MS = 15000;

    const ROTAS = {
        marketplace: 'pages/busca/main.html',
        resultados: 'pages/busca/resultados.html',
        perfil: 'pages/conta/perfil.html',
        login: 'pages/conta/login.html'
    };

    // Menu da administração (Documentação do Front-end • pasta admin/)
    const MENU = [
        { id: 'usuarios', texto: 'Usuários', caminho: 'pages/admin/usuarios.html' },
        { id: 'termos', texto: 'Termos', caminho: 'pages/admin/termos.html' },
        { id: 'notificacoes', texto: 'Notificações gerais', caminho: 'pages/admin/notificacoes.html' },
        { id: 'disputas', texto: 'Disputas', caminho: 'pages/admin/disputas.html' }
    ];

    // Papéis internos (ADR-007). O primeiro que a conta tiver aparece na faixa do topo.
    const PAPEIS_INTERNOS = {
        ADMINISTRADOR: 'Administrador geral',
        MODERADOR: 'Moderador',
        SUPORTE: 'Suporte'
    };

    function link(caminho, params) {
        const u = new URL(caminho, RAIZ);
        Object.entries(params || {}).forEach(function ([k, v]) { if (v) u.searchParams.set(k, v); });
        return u.href;
    }

    function esc(texto) {
        return String(texto ?? '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function papeis(usuario) {
        return (usuario?.papeis || usuario?.roles || []).map(function (p) { return String(p.nome || p).toUpperCase(); });
    }

    function papelInterno(usuario) {
        const nome = papeis(usuario).find(function (p) { return PAPEIS_INTERNOS[p]; });
        return nome ? PAPEIS_INTERNOS[nome] : '';
    }

    function ehAdmin(usuario) {
        return Boolean(usuario && (usuario.administrador || papelInterno(usuario)));
    }

    async function chamarApi(metodo, rota) {
        const controle = new AbortController();
        const timer = setTimeout(function () { controle.abort(); }, TEMPO_LIMITE_MS);
        try {
            const cabecalhos = { Accept: 'application/json' };
            if (metodo !== 'GET') {
                const r = await fetch(API_URL + '/auth/csrf', { credentials: 'include', signal: controle.signal });
                cabecalhos['X-XSRF-TOKEN'] = (await r.json()).token;
            }
            const resposta = await fetch(API_URL + rota, { method: metodo, credentials: 'include', headers: cabecalhos, signal: controle.signal });
            const dados = resposta.status === 204 ? null : await resposta.json().catch(function () { return null; });
            return { ok: resposta.ok, status: resposta.status, dados: dados };
        } catch (e) {
            return { ok: false, status: 0, dados: null };
        } finally {
            clearTimeout(timer);
        }
    }

    function itemAtivo(header) {
        if (header.dataset.ativo) return header.dataset.ativo;
        const item = MENU.find(function (m) { return window.location.pathname.endsWith(m.caminho); });
        return item ? item.id : null;
    }

    function montar(header) {
        const ativo = itemAtivo(header);
        header.classList.add('cabecalho', 'cabecalho--admin');
        header.innerHTML = `
        <a class="visually-hidden-focusable" href="#conteudo">Pular para o conteúdo</a>

        <div class="faixa-topo py-1">
            <div class="container-fluid px-3 px-lg-4 d-flex justify-content-between gap-3">
                <span class="text-truncate text-uppercase">Área administrativa • Acesso interno</span>
                <span class="text-nowrap" id="cabecalho-papel"></span>
            </div>
        </div>

        <div class="bg-white border-bottom">
            <div class="container-fluid px-3 px-lg-4 d-flex align-items-center gap-3 py-2">
                <a href="${link(ROTAS.marketplace)}" class="marca text-nowrap" aria-label="Busca Peças, voltar ao marketplace">
                    <i class="bi bi-gear-wide-connected" aria-hidden="true"></i> BUSCA PEÇAS
                </a>

                <form class="cabecalho-busca flex-grow-1 d-none d-md-block" role="search" action="${link(ROTAS.resultados)}">
                    <div class="input-group">
                        <span class="input-group-text bg-white"><i class="bi bi-search" aria-hidden="true"></i></span>
                        <input class="form-control border-start-0" type="search" name="q" minlength="3" maxlength="120"
                               placeholder="Busque por peça, OEM, EAN ou SKU" aria-label="Buscar peças" autocomplete="off">
                    </div>
                </form>

                <div class="ms-auto d-flex align-items-center gap-3">
                    <div id="cabecalho-usuario" class="d-flex align-items-center"></div>
                </div>
            </div>

            <nav class="container-fluid px-3 px-lg-4 d-flex align-items-center menu-principal overflow-auto" aria-label="Menu da administração">
                <ul class="nav flex-nowrap">
                    ${MENU.map(function (m, i) {
                        const ehAtivo = m.id === ativo;
                        return `<li class="nav-item"><a class="nav-link${i === 0 ? ' ps-0' : ''}${ehAtivo ? ' active' : ''}"
                            href="${link(m.caminho)}"${ehAtivo ? ' aria-current="page"' : ''}>${m.texto}</a></li>`;
                    }).join('')}
                </ul>
                <a href="${link(ROTAS.marketplace)}" class="link-anunciar ms-auto text-nowrap ps-3">Voltar ao marketplace</a>
            </nav>
        </div>`;
    }

    function mostrarUsuario(usuario) {
        const header = document.getElementById('cabecalho');
        const area = header.querySelector('#cabecalho-usuario');
        const papel = papelInterno(usuario);
        header.querySelector('#cabecalho-papel').textContent = papel ? `Papel: ${papel}` : '';

        if (!usuario) {
            area.innerHTML = `<a href="${link(ROTAS.login, { voltar: window.location.pathname })}" class="cabecalho-entrar small fw-semibold">Entrar</a>`;
            return;
        }

        const nome = usuario.nome || usuario.nomeExibicao || '';
        area.innerHTML = `
            <div class="position-relative">
                <button type="button" class="cabecalho-usuario" id="botao-menu-admin" aria-expanded="false"
                        aria-controls="menu-usuario-admin" aria-label="Menu da conta de ${esc(nome)}">
                    <span class="d-none d-lg-block text-end lh-sm small">
                        <span class="text-secondary">Olá, ${esc(nome)}</span><br>
                        <strong>${esc(papel ? 'Administrador' : 'Minha conta')}</strong>
                        <i class="bi bi-chevron-down small" aria-hidden="true"></i>
                    </span>
                    <i class="bi bi-person-circle fs-5 d-lg-none" aria-hidden="true"></i>
                </button>
                <ul id="menu-usuario-admin" class="dropdown-menu dropdown-menu-end cabecalho-menu-usuario" hidden>
                    <li><a class="dropdown-item" href="${link(ROTAS.marketplace)}">Voltar ao marketplace</a></li>
                    <li><a class="dropdown-item" href="${link(ROTAS.perfil)}">Meu perfil</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><button type="button" class="dropdown-item" id="botao-sair-admin">Sair</button></li>
                </ul>
            </div>`;

        const botao = area.querySelector('#botao-menu-admin');
        const menu = area.querySelector('#menu-usuario-admin');
        function fechar() { menu.hidden = true; menu.classList.remove('show'); botao.setAttribute('aria-expanded', 'false'); }
        botao.addEventListener('click', function () {
            const abrir = menu.hidden;
            menu.hidden = !abrir;
            menu.classList.toggle('show', abrir);
            botao.setAttribute('aria-expanded', String(abrir));
            if (abrir) menu.querySelector('a').focus();
        });
        document.addEventListener('click', function (e) { if (!area.contains(e.target)) fechar(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !menu.hidden) { fechar(); botao.focus(); }
        });
        area.querySelector('#botao-sair-admin').addEventListener('click', async function () {
            await chamarApi('POST', '/auth/logout');
            window.location.href = link(ROTAS.marketplace);
        });
    }

    let resolverPronto;
    const interfacePublica = {
        usuario: null,
        pronto: new Promise(function (r) { resolverPronto = r; }),
        ehAdmin: ehAdmin,
        papelInterno: papelInterno,
        definirUsuario: function (usuario) {
            interfacePublica.usuario = usuario;
            mostrarUsuario(usuario);
        }
    };
    window.Cabecalho = interfacePublica;

    async function iniciar() {
        const header = document.getElementById('cabecalho');
        if (!header) return;
        montar(header);

        const resposta = await chamarApi('GET', '/auth/me');
        interfacePublica.usuario = resposta.ok ? resposta.dados : null;
        mostrarUsuario(interfacePublica.usuario);
        resolverPronto(interfacePublica.usuario);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();