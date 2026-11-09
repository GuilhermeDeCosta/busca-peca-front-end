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
    // Token de uso único que veio no link (fica só em memória)
    const token = new URLSearchParams(window.location.search).get('token');
 
    // ---------- Mostrar / Ocultar senha ----------
    document.querySelectorAll('.campo__mostrar').forEach(function (botao) {
        botao.addEventListener('click', function () {
            const input = document.getElementById(botao.dataset.alvo);
            const mostrar = input.type === 'password';
            input.type = mostrar ? 'text' : 'password';
            botao.textContent = mostrar ? 'Ocultar' : 'Mostrar';
            botao.setAttribute('aria-pressed', String(mostrar));
        });
    });
 
    // ---------- Resultado: senha atualizada ou link expirado ----------
    function mostrarResultado(tipo) {
        blocoForm.hidden = true;
        campoNova.value = '';
        campoConfirma.value = '';
 
        if (tipo === 'sucesso') {
            mostrarAlerta(alertaResultado, 'sucesso', 'Senha atualizada',
                'Sua senha foi alterada. Entre novamente com a nova senha.');
            botaoResultado.textContent = 'Ir para o login';
            botaoResultado.href = 'login.html';
            botaoResultado.className = 'btn btn--verde btn--bloco';
        } else {
            mostrarAlerta(alertaResultado, 'atencao', 'Link expirado',
                'Este link já foi usado ou passou de 30 minutos. Solicite um novo e-mail de recuperação.');
            botaoResultado.textContent = 'Solicitar novo link';
            botaoResultado.href = 'recuperar-senha.html';
            botaoResultado.className = 'btn btn--contorno btn--bloco';
        }
 
        blocoResultado.hidden = false;
        alertaResultado.querySelector('strong').focus();
    }
 
    // Link sem token: não tem o que validar
    if (!token) {
        mostrarResultado('expirado');
        return;
    }
 
    // ---------- Validação (a API confere tudo de novo) ----------
    function senhaValida(valor) {
        return valor.length >= 8 && /[A-Za-zÀ-ÿ]/.test(valor) && /\d/.test(valor);
    }
 
    function validar() {
        const nova = campoNova.value;
        const confirma = campoConfirma.value;
        let primeiroErro = null;
 
        if (!nova) {
            marcarErro('nova_senha', 'Informe a nova senha.');
            primeiroErro = campoNova;
        } else if (!senhaValida(nova)) {
            marcarErro('nova_senha', REGRA_SENHA);
            ajudaSenha.hidden = true; // a regra vira o erro, sem repetir o texto
            primeiroErro = campoNova;
        }
 
        if (!confirma) {
            marcarErro('confirmar_senha', 'Confirme a nova senha.');
            primeiroErro = primeiroErro || campoConfirma;
        } else if (nova && confirma !== nova) {
            marcarErro('confirmar_senha', 'Digite a mesma senha nos dois campos.');
            mostrarAlerta(alerta, 'erro', 'As senhas não conferem',
                'As senhas informadas são diferentes. Digite novamente.');
            primeiroErro = primeiroErro || campoConfirma;
        }
 
        if (primeiroErro) primeiroErro.focus();
        return !primeiroErro;
    }
 
    // A API recusou o token (inválido, já usado ou vencido)?
    function tokenRecusado(resposta) {
        const d = resposta.dados;
        return resposta.status === 404 || resposta.status === 410
            || /TOKEN|LINK/i.test(d.erro || '')
            || (d.campos || []).some(c => c.campo === 'token');
    }
 
    form.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limparErro('nova_senha');
        limparErro('confirmar_senha');
        esconderAlerta(alerta);
 
        if (!validar()) return;
 
        carregando(botaoSalvar, true, 'Salvando…');
        const resposta = await postar('/auth/redefinir-senha', {
            token: token,
            novaSenha: campoNova.value,
            confirmacaoSenha: campoConfirma.value
        });
        carregando(botaoSalvar, false);
 
        // Passos 12 a 14: a API salva o novo hash e invalida o token
        if (resposta.ok) {
            mostrarResultado('sucesso');
            return;
        }
 
        if (tokenRecusado(resposta)) {
            mostrarResultado('expirado');
            return;
        }
 
        // 400: erros nos campos vindos da API
        if (resposta.status === 400 && resposta.dados.campos && resposta.dados.campos.length) {
            const mapa = { novaSenha: 'nova_senha', confirmacaoSenha: 'confirmar_senha' };
            resposta.dados.campos.forEach(function (c) {
                if (mapa[c.campo]) marcarErro(mapa[c.campo], c.mensagem);
            });
            return;
        }
 
        const mensagem = resposta.status >= 400 && resposta.status < 500 && resposta.dados.mensagem
            ? resposta.dados.mensagem
            : 'Não foi possível concluir. Tente novamente.';
        mostrarAlerta(alerta, 'erro', 'Não foi possível salvar', mensagem);
    });
 
    [campoNova, campoConfirma].forEach(function (campo) {
        campo.addEventListener('input', function () {
            limparErro(campo.id);
            esconderAlerta(alerta);
            if (campo === campoNova) ajudaSenha.hidden = false;
        });
    });
})();
 