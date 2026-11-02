/* =========================================================
   LOGIN • Busca Peça (Fluxo D / caso de uso BP1-41)
   Arquivo: js/pages/conta/login.js
   ========================================================= */

// ---------- CONFIGURAÇÃO ----------
// true  = funciona sem o back-end (para testar a tela)
// false = chama a API Spring de verdade (POST /api/auth/login)
const MODO_DEMO = true;

const API_URL = 'http://localhost:8080/api';   // depois vem do config.js
const PAGINA_INICIAL = 'main.html';             // para onde ir depois de entrar
const TEMPO_LIMITE_MS = 15000;                  // doc do front: cancela após 15 s

// Usuário de teste do modo demonstração
const USUARIO_DEMO = { email: 'ana.martins@example.com', senha: 'senha123', nome: 'Ana Martins' };


// ---------- ELEMENTOS DA TELA ----------
const form = document.getElementById('form-login');
const inputEmail = document.getElementById('email');
const inputSenha = document.getElementById('senha');
const checkManter = document.getElementById('manter-conectado');
const btnEntrar = document.getElementById('btn-entrar');
const btnMostrar = document.getElementById('mostrar-senha');

const alertaErro = document.getElementById('alerta-erro');
const alertaErroTitulo = document.getElementById('alerta-erro-titulo');
const alertaErroTexto = document.getElementById('alerta-erro-texto');
const alertaSucesso = document.getElementById('alerta-sucesso');
const alertaSucessoTexto = document.getElementById('alerta-sucesso-texto');


// ---------- MOSTRAR / OCULTAR SENHA ----------
btnMostrar.addEventListener('click', () => {
    const visivel = inputSenha.type === 'text';
    inputSenha.type = visivel ? 'password' : 'text';
    btnMostrar.textContent = visivel ? 'Mostrar' : 'Ocultar';
    btnMostrar.setAttribute('aria-pressed', String(!visivel));
    inputSenha.focus();
});


// ---------- VALIDAÇÃO DOS CAMPOS ----------
function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function marcarErro(input, mensagem) {
    const campo = input.closest('.campo');
    const span = document.getElementById('erro-' + input.id);
    campo.classList.add('campo--erro');
    input.setAttribute('aria-invalid', 'true');
    span.textContent = mensagem;
}

function limparErro(input) {
    const campo = input.closest('.campo');
    const span = document.getElementById('erro-' + input.id);
    campo.classList.remove('campo--erro');
    input.removeAttribute('aria-invalid');
    span.textContent = '';
}

function validarFormulario() {
    let ok = true;
    const email = inputEmail.value.trim();
    const senha = inputSenha.value;

    limparErro(inputEmail);
    limparErro(inputSenha);

    if (email === '') {
        marcarErro(inputEmail, 'Informe seu e-mail.');
        ok = false;
    } else if (!emailValido(email)) {
        marcarErro(inputEmail, 'Informe um e-mail válido.');
        ok = false;
    }

    if (senha === '') {
        marcarErro(inputSenha, 'Informe sua senha.');
        ok = false;
    }

    // Leva o cursor para o primeiro campo com problema
    if (!ok) form.querySelector('[aria-invalid="true"]').focus();
    return ok;
}

// Tira o vermelho assim que a pessoa volta a digitar
[inputEmail, inputSenha].forEach((input) => {
    input.addEventListener('input', () => {
        limparErro(input);
        alertaErro.hidden = true;
    });
});


// ---------- AVISOS ----------
function mostrarErroGeral(titulo, texto) {
    alertaSucesso.hidden = true;
    alertaErroTitulo.textContent = titulo;
    alertaErroTexto.textContent = texto;
    alertaErro.hidden = false;
}

function mostrarSucesso(nome) {
    alertaErro.hidden = true;
    alertaSucessoTexto.textContent = nome
        ? `Olá, ${nome}. Seus pedidos e sua loja estão disponíveis.`
        : 'Seus pedidos e sua loja estão disponíveis.';
    alertaSucesso.hidden = false;
}

function carregando(ativo) {
    btnEntrar.disabled = ativo;
    btnEntrar.textContent = ativo ? 'Entrando…' : 'Entrar';
}


// ---------- PARA ONDE VOLTAR DEPOIS DO LOGIN ----------
// Se outra página mandou para cá (erro 401), ela passa ?voltar=caminho
function destinoDepoisDoLogin() {
    const voltar = new URLSearchParams(window.location.search).get('voltar');
    // só aceita caminhos do próprio site (evita redirecionar para site externo)
    if (voltar && !voltar.includes('://') && !voltar.startsWith('//')) {
        return voltar;
    }
    return PAGINA_INICIAL;
}


// ---------- LOGIN DE DEMONSTRAÇÃO ----------
function loginDemo(email, senha) {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (email === USUARIO_DEMO.email && senha === USUARIO_DEMO.senha) {
                resolve({ status: 200, dados: { nome: USUARIO_DEMO.nome } });
            } else {
                resolve({ status: 401, dados: null });
            }
        }, 700);
    });
}


// ---------- LOGIN NA API (Spring Security + JWT em cookie) ----------
async function buscarCsrf(sinal) {
    const resposta = await fetch(`${API_URL}/auth/csrf`, {
        credentials: 'include',
        signal: sinal
    });
    const dados = await resposta.json();
    // O Spring devolve { headerName, token }; se não vier, usa o padrão
    return { cabecalho: dados.headerName || 'X-XSRF-TOKEN', token: dados.token };
}

async function loginApi(email, senha, manterConectado) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

    try {
        const csrf = await buscarCsrf(controle.signal);

        const resposta = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            credentials: 'include',       // o navegador guarda o cookie HttpOnly
            headers: {
                'Content-Type': 'application/json',
                [csrf.cabecalho]: csrf.token
            },
            body: JSON.stringify({ email, senha, manterConectado }),
            signal: controle.signal
        });

        let dados = null;
        try { dados = await resposta.json(); } catch (e) { /* resposta sem corpo */ }

        return { status: resposta.status, dados };
    } finally {
        clearTimeout(timer);
    }
}


// ---------- ENVIO DO FORMULÁRIO ----------
form.addEventListener('submit', async (evento) => {
    evento.preventDefault();          // não recarrega a página
    alertaErro.hidden = true;
    alertaSucesso.hidden = true;

    if (!validarFormulario()) return;

    const email = inputEmail.value.trim().toLowerCase();
    const senha = inputSenha.value;
    const manter = checkManter.checked;

    carregando(true);

    try {
        const { status, dados } = MODO_DEMO
            ? await loginDemo(email, senha)
            : await loginApi(email, senha, manter);

        if (status === 200) {
            mostrarSucesso(dados && dados.nome);
            setTimeout(() => { window.location.href = destinoDepoisDoLogin(); }, 1200);
            return;                    // mantém o botão travado até sair da página
        }

        if (status === 400 && dados && Array.isArray(dados.campos)) {
            // A API lista os campos inválidos: marca cada um
            dados.campos.forEach((c) => {
                const input = document.getElementById(c.campo);
                if (input) marcarErro(input, c.mensagem);
            });
            mostrarErroGeral('Revise os campos', dados.mensagem || 'Alguns dados estão inválidos.');
        } else if (status === 400 || status === 401) {
            mostrarErroGeral('E-mail ou senha incorretos',
                'Confira seus dados ou use a recuperação de senha.');
            inputSenha.value = '';
            inputSenha.focus();
        } else {
            mostrarErroGeral('Não foi possível concluir',
                'Tente novamente em alguns instantes.');
        }
    } catch (erro) {
        // Sem resposta, servidor fora do ar ou passou dos 15 s
        mostrarErroGeral('Não foi possível concluir',
            erro.name === 'AbortError'
                ? 'O servidor demorou para responder. Tente novamente.'
                : 'Verifique sua conexão e tente novamente.');
    }

    carregando(false);
});