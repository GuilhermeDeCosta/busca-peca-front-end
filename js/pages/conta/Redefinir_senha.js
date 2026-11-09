// =========================================================
// CRIE UMA NOVA SENHA (Fluxo D • etapa 05 • BP1-40, passos 8 a 15)
// Aberta pelo link do e-mail: redefinir-senha.html?token=...
// POST /api/auth/redefinir-senha  →  { token, novaSenha, confirmacaoSenha }
// =========================================================
(function () {
    'use strict';
 
    // ---------- Configuração ----------
    const API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api'
        : 'https://api.buscapeca.com.br/api';
    const TEMPO_LIMITE_MS = 15000; // o front cancela depois de 15 s
    const EMAIL_CONTATO = 'contato@buscapeca.example.com';
 
    // ---------- Comunicação com a API (cookie + CSRF, ADR-006) ----------
    let tokenCsrf = null; // só em memória, nunca no navegador
 
    async function postar(rota, corpo, jaTentou = false) {
        const controle = new AbortController();
        const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
        try {
            if (!tokenCsrf) {
                const r = await fetch(API_URL + '/auth/csrf', { credentials: 'include', signal: controle.signal });
                tokenCsrf = (await r.json()).token;
            }
            const resposta = await fetch(API_URL + rota, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-XSRF-TOKEN': tokenCsrf
                },
                body: JSON.stringify(corpo),
                signal: controle.signal
            });
 
            // 403 por CSRF vencido: pega um token novo e tenta uma vez de novo
            if (resposta.status === 403 && !jaTentou) {
                tokenCsrf = null;
                return postar(rota, corpo, true);
            }
 
            const dados = resposta.status === 204 ? {} : await resposta.json().catch(() => ({}));
            return { ok: resposta.ok, status: resposta.status, dados: dados || {} };
        } catch (e) {
            // sem resposta ou tempo esgotado
            return { ok: false, status: 0, dados: {} };
        } finally {
            clearTimeout(timer);
        }
    }
 
    // ---------- Campos ----------
    function marcarErro(id, mensagem) {
        const input = document.getElementById(id);
        input.closest('.campo').classList.add('campo--erro');
        input.setAttribute('aria-invalid', 'true');
        document.getElementById(id + '-erro').textContent = mensagem;
    }
 
    function limparErro(id) {
        const input = document.getElementById(id);
        input.closest('.campo').classList.remove('campo--erro');
        input.removeAttribute('aria-invalid');
        document.getElementById(id + '-erro').textContent = '';
    }
 
    // ---------- Avisos (alerta--sucesso / alerta--erro / alerta--atencao) ----------
    function mostrarAlerta(alerta, tipo, titulo, texto) {
        alerta.className = 'alerta alerta--' + tipo;
        alerta.querySelector('.alerta__icone').textContent = tipo === 'sucesso' ? '✓' : '!';
        alerta.querySelector('strong').textContent = titulo; // textContent: nada vira HTML
        alerta.querySelector('p').textContent = texto;
        alerta.hidden = false;
    }
 
    function esconderAlerta(alerta) {
        alerta.hidden = true;
    }
 
    // ---------- Botão carregando (bloqueia clique duplo) ----------
    function carregando(botao, ligado, textoCarregando) {
        const texto = botao.querySelector('.btn__texto');
        if (!texto.dataset.original) texto.dataset.original = texto.textContent;
        botao.disabled = ligado;
        botao.setAttribute('aria-busy', String(ligado));
        botao.querySelector('.btn__girando').hidden = !ligado;
        texto.textContent = ligado ? textoCarregando : texto.dataset.original;
    }
 
    // ---------- Tela ----------
    const blocoForm = document.getElementById('bloco-form');
    const blocoResultado = document.getElementById('bloco-resultado');
    const alertaResultado = document.getElementById('alerta-resultado');
    const botaoResultado = document.getElementById('botao-resultado');
 
    const form = document.getElementById('form-redefinir');
    const campoNova = document.getElementById('nova_senha');
    const campoConfirma = document.getElementById('confirmar_senha');
    const ajudaSenha = document.getElementById('nova_senha-ajuda');
    const botaoSalvar = document.getElementById('botao-salvar');
    const alerta = document.getElementById('alerta');
 
    const REGRA_SENHA = 'Use pelo menos 8 caracteres, incluindo letras e números.';
 