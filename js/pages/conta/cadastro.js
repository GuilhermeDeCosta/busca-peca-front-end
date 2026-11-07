/* =========================================================
   CADASTRO DE CONTA • cadastro.html
   Caso de uso BP1-2 • Fluxo D, etapa 01
   - Sem escolha de perfil: a conta nasce como COMPRADOR (ADR-007)
   - Aceite dos termos obrigatório (ADR-013)
   - A API confere tudo de novo e verifica e-mail repetido (409)
   ========================================================= */
 
/* Endereço da API (Documentação do Back-end: POST /api/usuarios) */
const API_URL = 'http://localhost:8080/api';
const TEMPO_LIMITE_MS = 15000;
 
const form = document.getElementById('form-cadastro');
const botao = document.getElementById('botao-criar');
const alerta = document.getElementById('alerta');
 
const MSG_ERRO_GERAL = 'Não foi possível criar a conta. Revise os campos e confirme o aceite dos termos.';
const MSG_SEM_RESPOSTA = 'Não foi possível concluir. Tente novamente.';
 
let tentouEnviar = false;
 
/* ---------- Funções de apoio ---------- */
const limpar = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
const senhaValida = (s) => s.length >= 8 && /[A-Za-zÀ-ÿ]/.test(s) && /\d/.test(s);
 
/* ---------- Regras de cada campo ---------- */
const regras = {
    nome(v) {
        const t = limpar(v);
        if (!t) return 'Informe seu nome completo.';
        if (t.length > 150) return 'Use no máximo 150 caracteres.';
        return '';
    },
    nome_exibicao(v) {
        const t = limpar(v);
        if (!t) return 'Informe o nome da oficina ou empresa.';
        if (t.length > 80) return 'Use no máximo 80 caracteres.';
        return '';
    },
    email(v) {
        if (!v.trim()) return 'Informe seu e-mail.';
        if (!emailValido(v)) return 'Informe um e-mail válido.';
        return '';
    },
    senha(v) {
        if (!v) return 'Crie uma senha.';
        if (!senhaValida(v)) return 'Use pelo menos 8 caracteres, incluindo letras e números.';
        if (v.length > 72) return 'Use no máximo 72 caracteres.';
        return '';
    },
    confirmar_senha(v) {
        if (!v) return 'Confirme sua senha.';
        if (v !== form.senha.value) return 'As senhas informadas são diferentes. Digite novamente.';
        return '';
    },
    aceite_termos(v, el) {
        return el.checked ? '' : 'Confirme o aceite dos Termos de uso e da Política de Privacidade.';
    }
};
 
/* ---------- Mostrar erro embaixo do campo ---------- */
function marcarCampo(nome, mensagem) {
    const el = form.elements[nome];
    const saida = document.getElementById(nome + '-erro');
    if (!el || !saida) return;
 
    saida.textContent = mensagem;
    el.closest('.campo').classList.toggle('campo--erro', Boolean(mensagem));
    el.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
}
 
function validarCampo(nome) {
    const el = form.elements[nome];
    const mensagem = regras[nome](el.value || '', el);
    marcarCampo(nome, mensagem);
    return !mensagem;
}
 
function validarTudo() {
    const invalidos = Object.keys(regras).filter((nome) => !validarCampo(nome));
    if (invalidos.length) form.elements[invalidos[0]].focus();
    return invalidos.length === 0;
}
 
/* Depois da primeira tentativa, os erros somem conforme o usuário corrige */
form.addEventListener('input', (e) => {
    const nome = e.target.name;
    if (!tentouEnviar || !regras[nome]) return;
    validarCampo(nome);
    if (nome === 'senha' && form.confirmar_senha.value) validarCampo('confirmar_senha');
});
 
/* Ao sair de um campo preenchido, já confere o formato */
form.addEventListener('focusout', (e) => {
    const nome = e.target.name;
    if (regras[nome] && nome !== 'aceite_termos' && e.target.value) validarCampo(nome);
});
 
/* ---------- Alerta de sucesso / erro ---------- */
function mostrarAlerta(tipo, titulo, texto) {
    alerta.className = 'alerta alerta--' + tipo;
    alerta.querySelector('.alerta__icone').textContent = tipo === 'sucesso' ? '✓' : '!';
    document.getElementById('alerta-titulo').textContent = titulo;
    document.getElementById('alerta-texto').textContent = texto;
    alerta.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    alerta.hidden = false;
}
 
/* ---------- Botão carregando (evita clique duplo) ---------- */
function carregando(ativo) {
    botao.disabled = ativo;
    botao.setAttribute('aria-busy', String(ativo));
    botao.querySelector('.btn__girando').hidden = !ativo;
    document.getElementById('botao-texto').textContent = ativo ? 'Criando conta…' : 'Criar conta';
}
 
/* ---------- Mostrar / ocultar senha ---------- */
document.querySelectorAll('.campo__mostrar').forEach((btn) => {
    btn.addEventListener('click', () => {
        const campo = document.getElementById(btn.dataset.alvo);
        const mostrar = campo.type === 'password';
        campo.type = mostrar ? 'text' : 'password';
        btn.textContent = mostrar ? 'Ocultar' : 'Mostrar';
        btn.setAttribute('aria-pressed', String(mostrar));
    });
});
 
/* ---------- Chamada à API: POST /api/usuarios ---------- */
async function cadastrarUsuario(dados) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
 
    try {
        const resposta = await fetch(API_URL + '/usuarios', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(dados),
            signal: controle.signal
        });
        const corpo = await resposta.json().catch(() => null);
        return { status: resposta.status, corpo };
    } catch {
        return { status: 0, corpo: null };       // sem resposta ou tempo esgotado
    } finally {
        clearTimeout(limite);
    }
}
 
/* ---------- Envio do formulário ---------- */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    tentouEnviar = true;
    alerta.hidden = true;
 
    // Fluxo alternativo: informa quais campos precisam ser corrigidos
    if (!validarTudo()) {
        mostrarAlerta('erro', '', MSG_ERRO_GERAL);
        return;
    }
 
    // Só o necessário vai para a API (sem confirmação de senha e sem perfil)
    const dados = {
        nome: limpar(form.nome.value),
        nome_exibicao: limpar(form.nome_exibicao.value),
        email: form.email.value.trim().toLowerCase(),
        senha: form.senha.value,
        aceite_termos: form.aceite_termos.checked
    };
 
    carregando(true);
    const { status, corpo } = await cadastrarUsuario(dados);
    carregando(false);
 
    // 201: conta criada
    if (status === 201 || status === 200) {
        const nome = (corpo && corpo.nome) || dados.nome;
        form.reset();
        tentouEnviar = false;
        Object.keys(regras).forEach((n) => marcarCampo(n, ''));
        mostrarAlerta(
            'sucesso',
            'Conta criada com sucesso',
            `Boas-vindas, ${nome.split(' ')[0]}. Você já pode comprar. Para vender, crie sua loja em Minha Loja.`
        );
        return;
    }
 
    // 400 ou 409: marca os campos que a API devolveu e mantém o que foi digitado
    const campos = (corpo && corpo.campos) || {};
    if (status === 409 && !campos.email) {
        campos.email = 'Este e-mail já tem uma conta. Entre ou recupere sua senha.';
    }
    Object.entries(campos).forEach(([nome, msg]) => marcarCampo(nome, msg));
    const primeiro = Object.keys(campos)[0];
    if (primeiro && form.elements[primeiro]) form.elements[primeiro].focus();
 
    if (status === 400) mostrarAlerta('erro', '', MSG_ERRO_GERAL);
    else if (status === 409) mostrarAlerta('erro', '', (corpo && corpo.mensagem) || 'E-mail já cadastrado.');
    else mostrarAlerta('erro', '', MSG_SEM_RESPOSTA);
});
 