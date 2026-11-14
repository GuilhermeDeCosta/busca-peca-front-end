/* =========================================================
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

    // Aceita camelCase ou snake_case vindos da API
    function pegar(obj) {
        const nomes = Array.prototype.slice.call(arguments, 1);
        for (let i = 0; i < nomes.length; i++) {
            if (obj && obj[nomes[i]] !== undefined && obj[nomes[i]] !== null) return obj[nomes[i]];
        }
        return '';
    }

    function dataBR(valor) {
        const d = new Date(valor);
        return valor && !isNaN(d) ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';
    }

    // ---------- Máscaras ----------
    function mascaraTelefone(v) {
        const d = digitos(v).slice(0, 11);
        if (d.length <= 2) return d ? '(' + d : '';
        if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
        if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
        return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    }

    function mascaraCep(v) {
        const d = digitos(v).slice(0, 8);
        return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
    }

    function mascaraDocumento(v) {
        const d = digitos(v);
        if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return d;
    }

    // ---------- Erros nos campos (classes do Bootstrap) ----------
    function marcarErro(id, mensagem) {
        const campo = $(id);
        const saida = $('erro-' + id);
        if (!campo) return;
        campo.classList.toggle('is-invalid', Boolean(mensagem));
        campo.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
        if (saida) saida.textContent = mensagem || '';
    }

    function limparErros(form) {
        form.querySelectorAll('.is-invalid').forEach(function (el) {
            el.classList.remove('is-invalid');
            el.removeAttribute('aria-invalid');
        });
        form.querySelectorAll('.invalid-feedback').forEach(function (el) { el.textContent = ''; });
    }

    // Aplica erros { campo: mensagem } e leva o foco ao primeiro
    function aplicarErros(erros) {
        const ids = Object.keys(erros);
        ids.forEach(function (id) { marcarErro(id, erros[id]); });
        if (ids.length && $(ids[0])) $(ids[0]).focus();
        return ids.length === 0;
    }

    // A API devolve campos como objeto { campo: msg } ou lista [{ campo, mensagem }]
    function errosDaApi(dados, mapa) {
        const erros = {};
        const campos = dados && dados.campos;
        const lista = Array.isArray(campos) ? campos
            : Object.keys(campos || {}).map(function (c) { return { campo: c, mensagem: campos[c] }; });
        lista.forEach(function (c) {
            const id = (mapa && mapa[c.campo]) || c.campo;
            if ($(id)) erros[id] = c.mensagem;
        });
        return erros;
    }

    // ---------- Avisos ----------
    const ICONES = { sucesso: 'bi-check-circle', erro: 'bi-exclamation-circle', info: 'bi-info-circle' };

    function mostrarAviso(id, tipo, texto) {
        const aviso = $(id);
        aviso.className = 'perfil-aviso perfil-aviso--' + tipo + ' ' + (aviso.dataset.margem || 'mt-3');
        aviso.textContent = '';
        const icone = document.createElement('i');
        icone.className = 'bi ' + ICONES[tipo];
        icone.setAttribute('aria-hidden', 'true');
        const span = document.createElement('span');
        span.textContent = texto;                       // textContent: nada vira HTML
        aviso.append(icone, span);
        aviso.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
        aviso.hidden = false;
    }

    function esconderAviso(id) { $(id).hidden = true; }

    function mensagemFalha(resposta, padrao) {
        if (resposta.status >= 400 && resposta.status < 500 && resposta.dados.mensagem) return resposta.dados.mensagem;
        return padrao || 'Não foi possível salvar. Tente novamente.';
    }

    // ---------- Botão carregando (bloqueia clique duplo) ----------
    function carregando(botao, ligado, textoCarregando) {
        const texto = botao.querySelector('.btn__texto');
        if (!texto.dataset.original) texto.dataset.original = texto.textContent;
        botao.disabled = ligado;
        botao.setAttribute('aria-busy', String(ligado));
        botao.querySelector('.spinner-border').hidden = !ligado;
        texto.textContent = ligado ? textoCarregando : texto.dataset.original;
    }

    // =========================================================
    // 1. CARREGAR A TELA
    // =========================================================
    async function carregar() {
        $('perfil-carregando').hidden = false;
        $('perfil-erro').hidden = true;
        $('perfil-conteudo').hidden = true;

        const [rUsuario, rEnderecos] = await Promise.all([
            chamar('GET', ROTAS.usuario),
            chamar('GET', ROTAS.enderecos)
        ]);
        if (rUsuario.status === 401) return;   // já está indo para o login

        $('perfil-carregando').hidden = true;
        if (!rUsuario.ok) {
            $('perfil-erro-texto').textContent = 'Não foi possível carregar seu perfil.';
            $('perfil-erro').hidden = false;
            return;
        }

        usuario = rUsuario.dados;
        enderecos = rEnderecos.ok ? listaDe(rEnderecos.dados) : [];

        preencherPessoais();
        preencherEmpresa();
        preencherNotificacoes();
        preencherTermos();
        desenharEnderecos();
        if (!rEnderecos.ok) mostrarAviso('aviso-enderecos', 'erro', 'Não foi possível carregar seus endereços agora.');
        atualizarImpacto();

        $('perfil-conteudo').hidden = false;
    }

    function listaDe(dados) {
        return Array.isArray(dados) ? dados : (dados.itens || dados.content || []);
    }

    function temLoja() {
        return Boolean(pegar(usuario, 'loja') || pegar(usuario, 'temLoja'));
    }

    function nomeLoja() {
        const loja = pegar(usuario, 'loja');
        return pegar(loja, 'nomeLoja', 'nome_loja', 'nome') || 'sua loja';
    }

    // =========================================================
    // 2. DADOS PESSOAIS • PATCH /usuarios/me
    // =========================================================
    function preencherPessoais() {
        $('nome').value = pegar(usuario, 'nome');
        $('telefone').value = mascaraTelefone(pegar(usuario, 'telefone'));
        $('email').value = pegar(usuario, 'email');

        const status = String(pegar(usuario, 'status') || 'ATIVO').toUpperCase();
        const etiqueta = $('etiqueta-conta');
        etiqueta.textContent = limpar(pegar(usuario, 'nome')) + ' • conta ' + (status === 'ATIVO' ? 'ativa' : 'inativa');
        etiqueta.className = 'etiqueta' + (status === 'ATIVO' ? '' : ' etiqueta--neutra');
    }

    $('telefone').addEventListener('input', function (e) { e.target.value = mascaraTelefone(e.target.value); });

    $('form-pessoais').addEventListener('submit', async function (e) {
        e.preventDefault();
        const form = e.currentTarget;
        const botao = form.querySelector('[type="submit"]');
        limparErros(form);
        esconderAviso('aviso-pessoais');

        const dados = {
            nome: limpar($('nome').value),
            telefone: digitos($('telefone').value),
            email: $('email').value.trim().toLowerCase()
        };

        const erros = {};
        if (!dados.nome) erros.nome = 'Informe seu nome completo.';
        else if (dados.nome.length > 150) erros.nome = 'Use no máximo 150 caracteres.';
        if (dados.telefone && (dados.telefone.length < 10 || dados.telefone.length > 11)) {
            erros.telefone = 'Informe o telefone com DDD.';
        }
        if (!dados.email) erros.email = 'Informe seu e-mail.';
        else if (!emailValido(dados.email)) erros.email = 'Informe um e-mail válido.';
        if (!aplicarErros(erros)) return;

        carregando(botao, true, 'Salvando…');
        const r = await chamar('PATCH', ROTAS.usuario, dados);
        carregando(botao, false);

        if (r.ok) {
            Object.assign(usuario, dados, r.dados);
            preencherPessoais();
            mostrarAviso('aviso-pessoais', 'sucesso', 'Dados salvos.');
            return;
        }
        if (r.status === 409) {
            aplicarErros({ email: 'Este e-mail já é usado por outra conta.' });
            return;
        }
        if (r.status === 400) {
            const doCampo = errosDaApi(r.dados);
            if (Object.keys(doCampo).length) { aplicarErros(doCampo); return; }
        }
        mostrarAviso('aviso-pessoais', 'erro', mensagemFalha(r));
    });

    // =========================================================
    // 3. DADOS EMPRESARIAIS • PATCH /usuarios/me
    // =========================================================
    function preencherEmpresa() {
        $('nomeExibicao').value = pegar(usuario, 'nomeExibicao', 'nome_exibicao');
        $('razaoSocial').value = pegar(usuario, 'razaoSocial', 'razao_social');
        $('inscricaoEstadual').value = pegar(usuario, 'inscricaoEstadual', 'inscricao_estadual');

        const doc = digitos(pegar(usuario, 'cnpjCpf', 'cnpj_cpf', 'documento'));
        $('rotulo-documento').textContent = doc.length === 11 ? 'CPF' : 'CNPJ';
        $('documento').value = doc ? mascaraDocumento(doc) : 'Não informado';

        const verificada = Boolean(pegar(usuario, 'identidadeVerificada', 'identidade_verificada'));
        const etiqueta = $('etiqueta-verificacao');
        etiqueta.textContent = verificada ? 'Identidade verificada' : 'Sem verificação cadastral';
        etiqueta.className = 'etiqueta' + (verificada ? '' : ' etiqueta--neutra');

        $('ajuda-documento').textContent = temLoja()
            ? 'O documento é o mesmo da sua loja ' + nomeLoja() + '. Para alterar, fale com o suporte.'
            : 'O CPF ou CNPJ é pedido só quando você criar sua loja.';
    }

    $('form-empresa').addEventListener('submit', async function (e) {
        e.preventDefault();
        const form = e.currentTarget;
        const botao = form.querySelector('[type="submit"]');
        limparErros(form);
        esconderAviso('aviso-empresa');

        const dados = {
            nomeExibicao: limpar($('nomeExibicao').value),
            razaoSocial: limpar($('razaoSocial').value),
            inscricaoEstadual: limpar($('inscricaoEstadual').value)
        };

        const erros = {};
        if (!dados.nomeExibicao) erros.nomeExibicao = 'Informe o nome da oficina ou empresa.';
        else if (dados.nomeExibicao.length > 80) erros.nomeExibicao = 'Use no máximo 80 caracteres.';
        if (dados.razaoSocial.length > 150) erros.razaoSocial = 'Use no máximo 150 caracteres.';
        if (dados.inscricaoEstadual && !/^(ISENTO|[\d.\-/]{2,20})$/i.test(dados.inscricaoEstadual)) {
            erros.inscricaoEstadual = 'Use só números ou "ISENTO".';
        }
        if (!aplicarErros(erros)) return;

        carregando(botao, true, 'Salvando…');
        const r = await chamar('PATCH', ROTAS.usuario, dados);
        carregando(botao, false);

        if (r.ok) {
            Object.assign(usuario, dados, r.dados);
            mostrarAviso('aviso-empresa', 'sucesso', 'Dados empresariais salvos.');
            // Atualiza o nome da oficina no cabeçalho, se ele já carregou
            if (window.Cabecalho && window.Cabecalho.usuario) window.Cabecalho.usuario.nomeExibicao = dados.nomeExibicao;
            return;
        }
        if (r.status === 400) {
            const doCampo = errosDaApi(r.dados);
            if (Object.keys(doCampo).length) { aplicarErros(doCampo); return; }
        }
        mostrarAviso('aviso-empresa', 'erro', mensagemFalha(r));
    });

    // =========================================================
    // 4. MEUS ENDEREÇOS • /usuarios/me/enderecos
    // =========================================================
    UFS.forEach(function (uf) {
        const opcao = document.createElement('option');
        opcao.value = uf;
        opcao.textContent = uf;
        $('estado').appendChild(opcao);
    });

    function desenharEnderecos() {
        const lista = $('lista-enderecos');
        lista.textContent = '';
        $('enderecos-vazio').hidden = enderecos.length > 0;

        // Principal primeiro
        enderecos.slice().sort(function (a, b) { return Number(Boolean(b.principal)) - Number(Boolean(a.principal)); })
            .forEach(function (end) {
                const item = document.createElement('li');
                item.className = 'perfil-endereco';

                const etiquetas = [];
                if (end.principal) etiquetas.push('Principal');
                if (pegar(end, 'identificacao', 'apelido')) etiquetas.push(pegar(end, 'identificacao', 'apelido'));
                if (etiquetas.length) {
                    const etiqueta = document.createElement('span');
                    etiqueta.className = 'etiqueta etiqueta--azul';
                    etiqueta.textContent = etiquetas.join(' • ');
                    item.appendChild(etiqueta);
                }

                const linha1 = document.createElement('p');
                linha1.className = 'perfil-endereco__rua';
                linha1.textContent = end.logradouro + ', ' + end.numero +
                    (end.complemento ? ' • ' + end.complemento : '') + ' • ' + end.bairro;

                const linha2 = document.createElement('p');
                linha2.textContent = end.cidade + '/' + end.estado + ' • CEP ' + mascaraCep(end.cep);

                const linha3 = document.createElement('p');
                linha3.className = 'perfil-ajuda';
                const tel = mascaraTelefone(pegar(usuario, 'telefone'));
                linha3.textContent = limpar(pegar(usuario, 'nome')) + (tel ? ' • ' + tel : '');

                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'btn btn--contorno mt-2';
                botao.textContent = 'Editar endereço';
                botao.setAttribute('aria-label', 'Editar endereço ' + end.logradouro + ', ' + end.numero);
                botao.addEventListener('click', function () { abrirFormEndereco(end); });

                item.append(linha1, linha2, linha3, botao);
                lista.appendChild(item);
            });
    }

    function abrirFormEndereco(end) {
        const form = $('form-endereco');
        enderecoEditando = end || null;
        limparErros(form);
        esconderAviso('aviso-enderecos');

        $('titulo-form-endereco').textContent = end ? 'Editar endereço' : 'Novo endereço';
        $('identificacao').value = pegar(end, 'identificacao', 'apelido');
        $('cep').value = mascaraCep(pegar(end, 'cep'));
        $('logradouro').value = pegar(end, 'logradouro');
        $('numero').value = pegar(end, 'numero');
        $('bairro').value = pegar(end, 'bairro');
        $('cidade').value = pegar(end, 'cidade');
        $('estado').value = pegar(end, 'estado');
        $('complemento').value = pegar(end, 'complemento');
        // O primeiro endereço já nasce como principal
        $('principal').checked = end ? Boolean(end.principal) : enderecos.length === 0;

        form.hidden = false;
        $('titulo-form-endereco').focus();
    }

    function fecharFormEndereco() {
        $('form-endereco').hidden = true;
        enderecoEditando = null;
        $('botao-adicionar-endereco').focus();
    }

    $('botao-adicionar-endereco').addEventListener('click', function () { abrirFormEndereco(null); });
    $('botao-cancelar-endereco').addEventListener('click', fecharFormEndereco);

    // CEP: máscara e preenchimento automático da cidade e da UF (quando a API responde)
    let ultimoCepConsultado = '';
    $('cep').addEventListener('input', async function (e) {
        e.target.value = mascaraCep(e.target.value);
        marcarErro('cep', '');
        const cep = digitos(e.target.value);
        if (cep.length !== 8 || cep === ultimoCepConsultado) return;
        ultimoCepConsultado = cep;

        $('cep-buscando').hidden = false;
        const r = await chamar('GET', ROTAS.cep + cep);
        $('cep-buscando').hidden = true;
        if (!r.ok) return;   // o aviso azul já explica que dá para preencher à mão

        const d = r.dados;
        if (pegar(d, 'logradouro') && !$('logradouro').value) $('logradouro').value = pegar(d, 'logradouro');
        if (pegar(d, 'bairro') && !$('bairro').value) $('bairro').value = pegar(d, 'bairro');
        if (pegar(d, 'cidade', 'localidade')) $('cidade').value = pegar(d, 'cidade', 'localidade');
        if (pegar(d, 'estado', 'uf')) $('estado').value = pegar(d, 'estado', 'uf');
        $('numero').focus();
    });

    $('form-endereco').addEventListener('submit', async function (e) {
        e.preventDefault();
        const form = e.currentTarget;
        const botao = form.querySelector('[type="submit"]');
        limparErros(form);
        esconderAviso('aviso-enderecos');

        const dados = {
            identificacao: limpar($('identificacao').value),
            cep: digitos($('cep').value),
            logradouro: limpar($('logradouro').value),
            numero: limpar($('numero').value).toUpperCase() === 'SN' ? 'S/N' : limpar($('numero').value),
            bairro: limpar($('bairro').value),
            cidade: limpar($('cidade').value),
            estado: $('estado').value,
            complemento: limpar($('complemento').value),
            principal: $('principal').checked
        };

        const erros = {};
        if (dados.cep.length !== 8) erros.cep = 'Informe um CEP com 8 números.';
        if (!dados.logradouro) erros.logradouro = 'Informe a rua.';
        if (!dados.numero) erros.numero = 'Informe o número ou S/N.';
        if (!dados.bairro) erros.bairro = 'Informe o bairro.';
        if (!dados.cidade) erros.cidade = 'Informe a cidade.';
        else if (!dados.estado) { erros.cidade = 'Escolha a UF.'; $('estado').classList.add('is-invalid'); }
        if (!aplicarErros(erros)) return;

        carregando(botao, true, 'Salvando…');
        const id = enderecoEditando && pegar(enderecoEditando, 'idEndereco', 'id_endereco', 'id');
        const r = id
            ? await chamar('PUT', ROTAS.enderecos + '/' + id, dados)
            : await chamar('POST', ROTAS.enderecos, dados);
        carregando(botao, false);

        if (r.ok) {
            const salvo = Object.assign({}, enderecoEditando || {}, dados, r.dados);
            // Só um endereço principal por usuário (a API garante; a tela acompanha)
            if (salvo.principal) enderecos.forEach(function (x) { x.principal = false; });
            if (enderecoEditando) enderecos[enderecos.indexOf(enderecoEditando)] = salvo;
            else enderecos.push(salvo);

            desenharEnderecos();
            $('form-endereco').hidden = true;
            enderecoEditando = null;
            mostrarAviso('aviso-enderecos', 'sucesso', id ? 'Endereço atualizado.' : 'Endereço adicionado.');
            return;
        }
        if (r.status === 400) {
            const doCampo = errosDaApi(r.dados, { estado: 'cidade' });
            if (Object.keys(doCampo).length) { aplicarErros(doCampo); return; }
        }
        mostrarAviso('aviso-enderecos', 'erro', mensagemFalha(r));
    });

    // =========================================================
    // 5. NOTIFICAÇÕES • PUT /usuarios/me/notificacoes
    // =========================================================
    function preencherNotificacoes() {
        const p = pegar(usuario, 'notificacoes', 'preferenciasNotificacao') || {};
        $('notif-pedidos').checked = p.statusPedido !== false;      // padrão: ligado
        $('notif-loja').checked = p.novoPedido !== false;           // padrão: ligado
        $('notif-novidades').checked = p.novidades === true;        // opcional: desligado (LGPD)
        $('opcao-loja').hidden = !temLoja();
    }

    $('form-notificacoes').addEventListener('submit', async function (e) {
        e.preventDefault();
        const botao = e.currentTarget.querySelector('[type="submit"]');
        esconderAviso('aviso-notificacoes');

        const dados = {
            statusPedido: $('notif-pedidos').checked,
            novoPedido: temLoja() ? $('notif-loja').checked : false,
            novidades: $('notif-novidades').checked
        };

        carregando(botao, true, 'Salvando…');
        const r = await chamar('PUT', ROTAS.notificacoes, dados);
        carregando(botao, false);

        if (r.ok) {
            usuario.notificacoes = dados;
            mostrarAviso('aviso-notificacoes', 'sucesso', 'Preferências salvas.');
        } else {
            mostrarAviso('aviso-notificacoes', 'erro', mensagemFalha(r));
        }
    });

    // =========================================================
    // 6. TERMOS E PRIVACIDADE
    // =========================================================
    function preencherTermos() {
        const aceite = pegar(usuario, 'aceiteTermos', 'aceite');
        const data = pegar(aceite, 'data', 'dataAceite', 'data_aceite');
        if (!data) return;
        const versao = pegar(aceite, 'versao');
        $('texto-aceite').textContent = 'Aceite registrado em ' + dataBR(data) + (versao ? ' para a versão ' + versao : '') + '.';
        $('texto-aceite').hidden = false;
    }

    // =========================================================
    // 7. GERENCIAR MINHA CONTA (LGPD • ADR-013)
    // =========================================================

    // Baixar meus dados: arquivo gerado pela API
    $('botao-baixar-dados').addEventListener('click', async function () {
        const botao = this;
        esconderAviso('aviso-dados');
        carregando(botao, true, 'Preparando…');
        const r = await chamar('GET', ROTAS.exportar);
        carregando(botao, false);

        if (!r.ok) {
            mostrarAviso('aviso-dados', 'erro', mensagemFalha(r, 'Não foi possível gerar o arquivo agora. Tente novamente.'));
            return;
        }
        const arquivo = r.dados instanceof Blob
            ? r.dados
            : new Blob([JSON.stringify(r.dados, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(arquivo);
        link.download = 'meus-dados-busca-peca.' + (arquivo.type.includes('json') ? 'json' : 'zip');
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
        mostrarAviso('aviso-dados', 'sucesso', 'Download iniciado. O arquivo tem os dados da sua conta.');
    });

    const painelConfirmar = $('painel-confirmar');
    const botoesSolicitar = document.querySelectorAll('[data-solicitar]');

    function atualizarImpacto() {
        if (!usuario) return;
        const tipo = $('tipoSolicitacao').value;
        const loja = temLoja();
        let texto;
        if (tipo === 'INATIVAR') {
            texto = loja
                ? 'A ' + nomeLoja() + ' e seus anúncios ficarão indisponíveis para novos pedidos. Esta ação não cancela pedidos anteriores.'
                : 'Sua conta ficará indisponível até ser reativada. Seu histórico de pedidos é mantido.';
        } else {
            texto = 'Seus dados pessoais serão excluídos ou anonimizados' +
                (loja ? ', e a ' + nomeLoja() + ' e seus anúncios serão removidos' : '') +
                '. Pedidos em andamento precisam ser concluídos antes. Esta ação não pode ser desfeita.';
        }
        $('texto-impacto').textContent = texto;
        $('rotulo-impacto').textContent = loja ? 'Entendi o impacto na conta e na minha loja.' : 'Entendi o impacto na minha conta.';
    }

    function abrirConfirmacao(tipo) {
        const form = $('form-confirmar');
        form.reset();
        limparErros(form);
        esconderAviso('aviso-confirmar');
        form.querySelectorAll('input, select, button').forEach(function (el) { el.disabled = false; });
        $('tipoSolicitacao').value = tipo;
        atualizarImpacto();
        painelConfirmar.hidden = false;
        botoesSolicitar.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
        $('titulo-confirmar').focus();
    }

    function fecharConfirmacao() {
        painelConfirmar.hidden = true;
        botoesSolicitar.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        botoesSolicitar[0].focus();
    }

    botoesSolicitar.forEach(function (b) {
        b.addEventListener('click', function () { abrirConfirmacao(b.dataset.solicitar); });
    });
    $('tipoSolicitacao').addEventListener('change', atualizarImpacto);
    $('botao-manter-conta').addEventListener('click', fecharConfirmacao);

    $('form-confirmar').addEventListener('submit', async function (e) {
        e.preventDefault();
        const form = e.currentTarget;
        const botao = form.querySelector('[type="submit"]');
        limparErros(form);
        esconderAviso('aviso-confirmar');

        const tipo = $('tipoSolicitacao').value;
        const email = $('confirmarEmail').value.trim().toLowerCase();
        const erros = {};
        if (!email) erros.confirmarEmail = 'Digite seu e-mail para confirmar.';
        else if (email !== String(pegar(usuario, 'email')).toLowerCase()) erros.confirmarEmail = 'O e-mail não é o da sua conta.';
        if (!$('entendiImpacto').checked) erros.entendiImpacto = 'Marque para confirmar que entendeu o impacto.';
        if (!aplicarErros(erros)) return;

        carregando(botao, true, 'Enviando…');
        const r = await chamar('POST', ROTAS.solicitacao, { tipo: tipo, email: email });
        carregando(botao, false);

        if (r.ok) {
            form.querySelectorAll('input, select, button[type="submit"]').forEach(function (el) { el.disabled = true; });
            mostrarAviso('aviso-confirmar', 'sucesso', tipo === 'EXCLUIR'
                ? 'Solicitação de exclusão registrada. Você receberá a confirmação por e-mail e será desconectado.'
                : 'Conta inativada. Você será desconectado em instantes.');
            // A API encerra a sessão; leva para a página inicial
            setTimeout(function () { window.location.href = PAGINA_INICIAL; }, 4000);
            return;
        }
        // 409: há pedidos em andamento ou outra pendência
        mostrarAviso('aviso-confirmar', 'erro', r.status === 409
            ? (r.dados.mensagem || 'Há pedidos em andamento. Conclua-os com as lojas antes de continuar.')
            : mensagemFalha(r, 'Não foi possível registrar a solicitação. Tente novamente.'));
    });

    // ---------- Início ----------
    $('botao-tentar-de-novo').addEventListener('click', carregar);
    carregar();
})();