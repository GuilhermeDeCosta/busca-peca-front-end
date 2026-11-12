* =========================================================
   MEU PERFIL E CONFIGURAÇÕES • pages/conta/perfil.html
   Fluxo D, etapa 06 • BP1-60 (Personalizar perfil) • ADR-013 (LGPD)
 
   O que a tela faz:
   - Dados pessoais: nome, telefone e e-mail
   - Dados empresariais: nome da oficina, razão social e inscrição estadual
     (CPF/CNPJ só aparece; é informado ao criar a loja)
   - Meus endereços: lista, edita, adiciona e define o principal
   - Notificações: preferências por tipo
   - Termos e privacidade: links e data do aceite
   - Gerenciar conta: baixar meus dados, inativar ou excluir (com confirmação)
 
   Página só para quem está logado: sem login (401) leva para o login.
   ========================================================= */
(function () {
    'use strict';
 
    // ---------- Configuração ----------
    const API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api'
        : 'https://api.buscapeca.com.br/api';
    const TEMPO_LIMITE_MS = 15000;
    const PAGINA_LOGIN = 'login.html';
    const PAGINA_INICIAL = '../busca/main.html';
 
    // Rotas da API. As duas primeiras estão na Documentação do Front-end;
    // as demais ainda precisam ser criadas no back-end (mude aqui se o nome for outro).
    const ROTAS = {
        usuario: '/usuarios/me',                         // GET e PATCH
        enderecos: '/usuarios/me/enderecos',             // GET, POST e PUT /{id}
        notificacoes: '/usuarios/me/notificacoes',       // PUT
        exportar: '/usuarios/me/exportar',               // GET (LGPD: baixar meus dados)
        solicitacao: '/usuarios/me/solicitacoes',        // POST { tipo: INATIVAR | EXCLUIR }
        cep: '/enderecos/cep/'                           // GET /enderecos/cep/{cep}
    };
 
    const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
        'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
 
    let usuario = null;      // dados vindos de GET /usuarios/me
    let enderecos = [];      // lista vinda de GET /usuarios/me/enderecos
    let enderecoEditando = null;   // null = novo endereço
 
    // ---------- Comunicação com a API (cookie + CSRF, ADR-006) ----------
    let tokenCsrf = null; // só em memória
 
    async function chamar(metodo, rota, corpo, jaTentou) {
        const controle = new AbortController();
        const timer = setTimeout(function () { controle.abort(); }, TEMPO_LIMITE_MS);
        try {
            const cabecalhos = { Accept: 'application/json' };
            if (metodo !== 'GET') {
                if (!tokenCsrf) {
                    const r = await fetch(API_URL + '/auth/csrf', { credentials: 'include', signal: controle.signal });
                    tokenCsrf = (await r.json()).token;
                }
                cabecalhos['X-XSRF-TOKEN'] = tokenCsrf;
                cabecalhos['Content-Type'] = 'application/json';
            }
            const resposta = await fetch(API_URL + rota, {
                method: metodo,
                credentials: 'include',
                headers: cabecalhos,
                body: corpo ? JSON.stringify(corpo) : undefined,
                signal: controle.signal
            });
 
            // 403 por CSRF vencido: pega um token novo e tenta mais uma vez
            if (resposta.status === 403 && metodo !== 'GET' && !jaTentou) {
                tokenCsrf = null;
                return chamar(metodo, rota, corpo, true);
            }
            // Sessão expirou: volta para o login e depois para cá
            if (resposta.status === 401) {
                irParaLogin();
                return { ok: false, status: 401, dados: {} };
            }
 
            const tipo = resposta.headers.get('Content-Type') || '';
            const dados = resposta.status === 204 ? {}
                : tipo.includes('json') ? await resposta.json().catch(function () { return {}; })
                : await resposta.blob();
            return { ok: resposta.ok, status: resposta.status, dados: dados || {} };
        } catch (e) {
            return { ok: false, status: 0, dados: {} };   // sem resposta ou 15 s
        } finally {
            clearTimeout(timer);
        }
    }
 
    function irParaLogin() {
        window.location.href = PAGINA_LOGIN + '?voltar=' + encodeURIComponent(window.location.pathname);
    }
 
    // ---------- Utilitários ----------
    const $ = function (id) { return document.getElementById(id); };
    const digitos = function (v) { return String(v || '').replace(/\D/g, ''); };
    const limpar = function (v) { return String(v || '').replace(/\s+/g, ' ').trim(); };
    const emailValido = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
 