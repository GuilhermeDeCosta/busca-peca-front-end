/* =========================================================
   TERMOS DE USO E PRIVACIDADE • pages/institucional/termos-de-uso.html
   Fluxo D, etapa 02 • BP1-54 • Página pública
 
   - Índice "Nesta página" destaca a seção que está na tela
   - Voltar: volta para a página anterior ou fecha a aba aberta pelo cadastro
   - Baixar versão em PDF: abre a impressão do navegador ("Salvar como PDF")
   - Busca a versão vigente na API: GET /api/termos/vigentes
     Se a API não responder, a página continua mostrando o texto do HTML.
 
   Resposta esperada da API (ajuste os nomes em lerResposta se forem outros):
   {
     "versao": "1.2",
     "dataVigencia": "2026-10-01",
     "dataAtualizacao": "2026-09-28",
     "aceite": { "data": "2026-10-16", "versao": "1.2" },   // só se estiver logado
     "versoesAnteriores": [ { "versao": "1.1", "dataPublicacao": "2026-06-10" } ]
   }
   ========================================================= */
(function () {
    'use strict';
 
    const API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api'
        : 'https://api.buscapeca.com.br/api';
    const TEMPO_LIMITE_MS = 15000;
    const PAGINA_INICIAL = '../busca/main.html';
 
    let vigentes;   // resposta da API (undefined = ainda não carregou, null = falhou)
 
    // ---------- Utilitários ----------
 
    function dataBR(valor) {
        if (!valor) return '';
        const d = new Date(valor);
        return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
 
    async function buscarVigentes() {
        const controle = new AbortController();
        const timer = setTimeout(function () { controle.abort(); }, TEMPO_LIMITE_MS);
        try {
            const r = await fetch(API_URL + '/termos/vigentes', {
                credentials: 'include',          // se estiver logado, a API devolve o aceite
                headers: { Accept: 'application/json' },
                signal: controle.signal
            });
            return r.ok ? await r.json() : null;
        } catch (e) {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }
 
    // Aceita a resposta como objeto único ou lista (Termos + Política)
    function lerResposta(dados) {
        if (!dados) return null;
        const lista = Array.isArray(dados) ? dados : [dados];
        const principal = lista.find(function (t) { return /TERMO/i.test(t.tipo || ''); }) || lista[0];
        return {
            versao: principal.versao,
            vigencia: principal.dataVigencia || principal.data_vigencia || principal.dataPublicacao || principal.data_publicacao,
            atualizacao: principal.dataAtualizacao || principal.data_atualizacao || principal.dataPublicacao || principal.data_publicacao,
            aceite: principal.aceite || null,
            anteriores: principal.versoesAnteriores || principal.versoes_anteriores || []
        };
    }
 
    // ---------- 1. Índice "Nesta página" ----------
 
    function ligarIndice() {
        const links = Array.from(document.querySelectorAll('.termos__indice a'));
        const secoes = links
            .map(function (a) { return document.querySelector(a.getAttribute('href')); })
            .filter(Boolean);
        if (!secoes.length) return;
 
        let travado = false;
 
        function marcar(id) {
            links.forEach(function (a) {
                const ativo = a.getAttribute('href') === '#' + id;
                a.classList.toggle('ativo', ativo);
                if (ativo) a.setAttribute('aria-current', 'true');
                else a.removeAttribute('aria-current');
            });
        }
 
        // Clique no índice: marca na hora (a última seção pode não chegar ao topo da tela)
        links.forEach(function (a) {
            a.addEventListener('click', function () {
                marcar(a.getAttribute('href').slice(1));
                travado = true;
                setTimeout(function () { travado = false; }, 900);
            });
        });
 
        // Rolagem: a primeira seção na metade de cima da tela fica ativa
        const visiveis = {};
        const observador = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (e) { visiveis[e.target.id] = e.isIntersecting; });
            if (travado) return;
            const atual = secoes.find(function (s) { return visiveis[s.id]; });
            if (atual) marcar(atual.id);
        }, { rootMargin: '0px 0px -55% 0px' });
 
        secoes.forEach(function (s) { observador.observe(s); });
        marcar(secoes[0].id);
    }
 
    // ---------- 2. Voltar ----------
 
    function ligarVoltar() {
        document.getElementById('botao-voltar').addEventListener('click', function () {
            let veioDoSite = false;
            try { veioDoSite = new URL(document.referrer).origin === window.location.origin; } catch (e) { /* sem referrer */ }
 
            if (veioDoSite && window.history.length > 1) {
                window.history.back();
                return;
            }
            // Aberta em outra aba (ex.: pelo link do cadastro): fecha a aba.
            // Se o navegador não deixar, leva para a página inicial.
            window.close();
            setTimeout(function () { window.location.href = PAGINA_INICIAL; }, 300);
        });
    }
 
    // ---------- 3. Baixar versão em PDF ----------
 
    function ligarPdf() {
        document.getElementById('botao-pdf').addEventListener('click', function () {
            window.print();   // o CSS de impressão deixa só o texto dos termos
        });
    }
 
    // ---------- 4. Versões anteriores ----------
 
    function mostrarVersoes() {
        const lista = document.getElementById('lista-versoes');
        const info = lerResposta(vigentes);
 
        if (vigentes === undefined) {
            lista.innerHTML = '<li>Carregando…</li>';
            return;
        }
        if (!info) {
            lista.innerHTML = '<li>Não foi possível carregar o histórico agora. Tente novamente mais tarde.</li>';
            return;
        }
        if (!info.anteriores.length) {
            lista.innerHTML = '<li>Nenhuma versão anterior publicada.</li>';
            return;
        }
        lista.innerHTML = '';
        info.anteriores.forEach(function (v) {
            const item = document.createElement('li');
            item.textContent = 'Versão ' + v.versao + ' • publicada em ' + dataBR(v.dataPublicacao || v.data_publicacao);
            lista.appendChild(item);
        });
    }
 
    function ligarVersoes() {
        const botao = document.getElementById('botao-versoes');
        const painel = document.getElementById('versoes-anteriores');
        botao.addEventListener('click', function () {
            const abrir = painel.hidden;
            painel.hidden = !abrir;
            botao.setAttribute('aria-expanded', String(abrir));
            botao.textContent = abrir ? 'Ocultar versões anteriores' : 'Ver versões anteriores';
            if (abrir) mostrarVersoes();
        });
    }
 
    // ---------- 5. Versão vigente (API) ----------
 
    async function carregarVersaoVigente() {
        vigentes = await buscarVigentes();
        const info = lerResposta(vigentes);
 
        if (info && info.versao) {
            const partes = ['Versão ' + info.versao];
            if (info.vigencia) partes.push('vigente desde ' + dataBR(info.vigencia));
            if (info.atualizacao) partes.push('última atualização em ' + dataBR(info.atualizacao));
            document.getElementById('termos-versao').textContent = partes.join(' • ');
        }
 
        if (info && info.aceite && info.aceite.data) {
            const aceite = document.getElementById('termos-aceite');
            aceite.textContent = 'Aceite registrado em ' + dataBR(info.aceite.data) +
                ' para a versão ' + (info.aceite.versao || info.versao) + '.';
            aceite.hidden = false;
        }
 
        // Se o painel de versões já estava aberto, atualiza
        if (!document.getElementById('versoes-anteriores').hidden) mostrarVersoes();
    }
 
    // ---------- Início ----------
 
    ligarIndice();
    ligarVoltar();
    ligarPdf();
    ligarVersoes();
    carregarVersaoVigente();
})();
 