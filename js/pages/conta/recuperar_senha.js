// =========================================================
// RECUPERAR SENHA (Fluxo D • etapa 04 • BP1-40, passos 3 a 7)
// POST /api/auth/recuperar-senha  →  { email }
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
    const form = document.getElementById('form-recuperar');
    const campoEmail = document.getElementById('email');
    const botaoEnviar = document.getElementById('botao-enviar');
    const botaoReenviar = document.getElementById('botao-reenviar');
    const alerta = document.getElementById('alerta');

    let emailEnviado = null; // e-mail que já recebeu as instruções

    function emailValido(valor) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
    }

    function validar() {
        const valor = campoEmail.value.trim();
        if (!valor) {
            marcarErro('email', 'Informe seu e-mail.');
            return false;
        }
        if (!emailValido(valor)) {
            marcarErro('email', 'Informe um e-mail válido.');
            return false;
        }
        return true;
    }

    async function solicitar(botao) {
        limparErro('email');
        esconderAlerta(alerta);

        if (!validar()) {
            campoEmail.focus();
            return;
        }

        const email = campoEmail.value.trim();
        carregando(botao, true, 'Enviando…');
        const resposta = await postar('/auth/recuperar-senha', { email: email });
        carregando(botao, false);

        // Passo 7: instruções enviadas
        if (resposta.ok) {
            emailEnviado = email;
            botaoEnviar.hidden = true;
            botaoReenviar.hidden = false;
            mostrarAlerta(alerta, 'sucesso', 'Instruções enviadas',
                'Enviamos as instruções para ' + email + '. Verifique sua caixa de entrada e o spam. O link vale por 30 minutos.');
            return;
        }

        // Fluxo alternativo: e-mail sem conta → corrigir ou voltar ao login
        if (resposta.status === 404) {
            marcarErro('email', 'Não encontramos uma conta com este e-mail. Confira o endereço ou volte para o login.');
            campoEmail.focus();
            return;
        }

        // 400: mensagem da API embaixo do campo
        if (resposta.status === 400) {
            const doCampo = (resposta.dados.campos || []).find(c => c.campo === 'email');
            marcarErro('email', doCampo ? doCampo.mensagem : (resposta.dados.mensagem || 'Informe um e-mail válido.'));
            campoEmail.focus();
            return;
        }

        // 409 e outras recusas: a API já manda a mensagem pronta
        if (resposta.status >= 400 && resposta.status < 500 && resposta.dados.mensagem) {
            mostrarAlerta(alerta, 'erro', 'Não foi possível enviar', resposta.dados.mensagem);
            return;
        }

        // 500, 503, sem resposta ou 15 s: falha no envio do e-mail (ADR-012), o usuário pode tentar de novo
        mostrarAlerta(alerta, 'erro', 'Não foi possível enviar',
            'O serviço está indisponível. Tente novamente ou fale com ' + EMAIL_CONTATO + '.');
    }

    form.addEventListener('submit', function (evento) {
        evento.preventDefault();
        solicitar(botaoEnviar);
    });

    botaoReenviar.addEventListener('click', function () {
        solicitar(botaoReenviar);
    });

    // Trocou o e-mail depois do envio: volta para "Enviar instruções"
    campoEmail.addEventListener('input', function () {
        limparErro('email');
        if (emailEnviado && campoEmail.value.trim() !== emailEnviado) {
            emailEnviado = null;
            botaoEnviar.hidden = false;
            botaoReenviar.hidden = true;
            esconderAlerta(alerta);
        }
    });
})();