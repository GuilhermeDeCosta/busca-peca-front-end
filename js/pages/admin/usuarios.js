// Tela: admin/usuarios.html — Administração • Usuários (?conta=3 abre uma conta)
// Acesso: papel interno de administração. Casos de uso: BP1-49 (contas e status), BP1-56 (papéis e permissões).
// Fluxo E • Administração. ADR-006 (permissões), ADR-013 (auditoria com justificativa).
// Rotas (Documentação do Back-end v2, seção 5.12):
//   GET   /api/admin/usuarios?busca=&status=&papel=   lista
//   GET   /api/admin/usuarios/resumo                  cartões do topo (rota nova)
//   GET   /api/admin/usuarios/{id}                    detalhe
//   PATCH /api/admin/usuarios/{id}/status             suspender, reativar, banir
//   PUT   /api/admin/usuarios/{id}/papeis             papéis internos
//   GET   /api/admin/usuarios/{id}/historico          histórico da conta (rota nova)
//   GET   /api/admin/papeis • PUT /api/admin/papeis/{id}/permissoes
import {
  listarUsuarios, obterResumoUsuarios, obterUsuario, alterarStatusUsuario, alterarPapeisUsuario,
  listarHistoricoUsuario, listarPapeis, alterarPermissoesPapel, USAR_SIMULACAO,
} from '../../services/admin.js';

const TAMANHO_PAGINA = 20;
const ESPERA_BUSCA_MS = 400;
const MIN_JUSTIFICATIVA = 10;
const FUSO = 'America/Sao_Paulo';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const STATUS = {
  ATIVO: { rotulo: 'Ativa', classe: 'etiqueta--sucesso' },
  BLOQUEADO: { rotulo: 'Suspensa', classe: 'etiqueta--alerta' },
  BANIDO: { rotulo: 'Banida', classe: 'etiqueta--erro' },
  INATIVO: { rotulo: 'Inativa', classe: 'etiqueta--neutra' },
};

const ROTULOS_PAPEL = {
  COMPRADOR: 'Usuário', VENDEDOR: 'Vendedor', ADMINISTRADOR: 'Administrador geral', MODERADOR: 'Moderador', SUPORTE: 'Suporte',
};

const ROTULOS_PERMISSAO = {
  GERENCIAR_USUARIOS: 'Ver contas, suspender e reativar',
  GERENCIAR_PERMISSOES: 'Atribuir papéis e permissões; consultar auditoria',
  PUBLICAR_TERMOS: 'Publicar termos e políticas',
  ENVIAR_NOTIFICACOES: 'Enviar notificações gerais',
  MODERAR_DISPUTA: 'Mediar disputas',
};

const ROTULOS_ACAO = {
  SUSPENDER: 'Conta suspensa', REATIVAR: 'Conta reativada', BANIR: 'Conta banida', ALTERAR_PAPEIS: 'Papéis alterados',
};

const estado = {
  filtros: { busca: '', status: '', papel: '' },
  pagina: 0,
  lista: null,          // { itens, totalRegistros, totalPaginas }
  carregandoLista: false,
  requisicaoLista: 0,
  papeis: [],           // papéis internos vindos da API
  semPermissaoPapeis: false,
  editandoPermissoes: false,
  idSelecionado: null,
  conta: null,          // detalhe da conta selecionada
  requisicaoConta: 0,
  confirmandoBanimento: false,
  ocupado: false,
  idUsuarioLogado: null,
};

const $ = (id) => document.getElementById(id);

// ---------- Utilitários ----------

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO });
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const fmtNumero = new Intl.NumberFormat('pt-BR');

function data(iso, comHora = false) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return (comHora ? fmtDataHora : fmtData).format(d);
}

function rotuloPapel(nome) {
  const daApi = estado.papeis.find((p) => p.nome === nome)?.rotulo;
  return daApi || ROTULOS_PAPEL[nome] || nome.charAt(0) + nome.slice(1).toLowerCase();
}

function textoPapeis(papeis) {
  return (papeis || []).map(rotuloPapel).join(' • ') || '—';
}

function ehInterno(nome) {
  const papel = estado.papeis.find((p) => p.nome === nome);
  return papel ? papel.interno !== false : ['ADMINISTRADOR', 'MODERADOR', 'SUPORTE'].includes(nome);
}

function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

function ehPropriaConta(conta) {
  return estado.idUsuarioLogado != null && Number(conta?.idUsuario) === Number(estado.idUsuarioLogado);
}

function irParaLogin() {
  window.location.href = `../conta/login.html?voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

function mensagemDeErro(erro, padrao) {
  if (erro?.status === 403) return 'Você não tem permissão para esta ação. Fale com um administrador geral.';
  return erro?.mensagem || padrao;
}

function atualizarUrl() {
  const url = new URL(window.location.href);
  const { busca, status, papel } = estado.filtros;
  const params = { busca: busca.trim(), status, papel, conta: estado.idSelecionado };
  Object.entries(params).forEach(([k, v]) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k)));
  history.replaceState(null, '', url);
}

function mostrarAcessoRestrito(texto) {
  $('conteudo-admin').hidden = true;
  const caixa = $('acesso-restrito');
  caixa.hidden = false;
  caixa.querySelector('p').textContent = texto;
}

// ---------- Cartões do topo ----------

async function carregarResumo() {
  try {
    const r = await obterResumoUsuarios();
    const mes = MESES[new Date().getMonth()];
    $('resumo-ativas').textContent = fmtNumero.format(r.contasAtivas ?? 0);
    $('resumo-ativas-info').textContent = r.novasNaSemana != null ? `+${fmtNumero.format(r.novasNaSemana)} nesta semana` : '';
    $('resumo-lojas').textContent = fmtNumero.format(r.lojasAtivas ?? 0);
    $('resumo-lojas-info').textContent = r.lojasCriadasNoMes != null ? `${fmtNumero.format(r.lojasCriadasNoMes)} criadas em ${mes}` : '';
    $('resumo-suspensas').textContent = fmtNumero.format(r.suspensas ?? 0);
    $('resumo-suspensas-info').textContent = r.suspensas ? 'Revisão em até 7 dias' : 'Nenhuma aguardando revisão';
    $('resumo-banidas').textContent = fmtNumero.format(r.banidas ?? 0);
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    // Sem o resumo a tela continua funcionando; os cartões mostram "—"
    ['resumo-ativas', 'resumo-lojas', 'resumo-suspensas', 'resumo-banidas'].forEach((id) => { $(id).textContent = '—'; });
  }
}

// ---------- Tabela de contas ----------

function htmlAcoes(u) {
  const ver = `<button type="button" class="link-acao" data-ver="${esc(u.idUsuario)}">Ver<span class="visually-hidden"> ${esc(u.nome)}</span></button>`;
  let segunda = '';
  if (u.status === 'BANIDO') {
    return `<button type="button" class="link-acao" data-ver="${esc(u.idUsuario)}" data-acao-rapida="historico">Ver histórico<span class="visually-hidden"> de ${esc(u.nome)}</span></button>`;
  }
  if (Number(u.idUsuario) === Number(estado.idUsuarioLogado)) return ver;
  if (u.status === 'BLOQUEADO' || u.status === 'INATIVO') segunda = ['reativar', 'ATIVO'];
  else if ((u.papeis || []).some(ehInterno)) segunda = ['editar papéis', 'papeis'];
  else segunda = ['suspender', 'BLOQUEADO'];
  return `${ver} / <button type="button" class="link-acao" data-ver="${esc(u.idUsuario)}" data-acao-rapida="${segunda[1]}">${segunda[0]}<span class="visually-hidden"> ${esc(u.nome)}</span></button>`;
}

function renderizarTabela() {
  const corpo = $('corpo-tabela');
  const lista = estado.lista;
  $('cartao-contas').setAttribute('aria-busy', String(estado.carregandoLista));

  if (estado.carregandoLista && !lista) {
    corpo.innerHTML = Array.from({ length: 5 }, () => `<tr class="placeholder-glow" aria-hidden="true">${
      '<td><span class="placeholder rounded col-10"></span></td>'.repeat(7)}</tr>`).join('');
    $('rodape-tabela').textContent = 'Carregando contas…';
    return;
  }
  if (!lista) return;

  if (!lista.itens.length) {
    const temFiltro = estado.filtros.busca.trim() || estado.filtros.status || estado.filtros.papel;
    corpo.innerHTML = `<tr><td colspan="7" class="text-center texto-suave py-4">${temFiltro
      ? 'Nenhuma conta encontrada com esses filtros.' : 'Nenhuma conta cadastrada.'}</td></tr>`;
  } else {
    corpo.innerHTML = lista.itens.map((u) => {
      const st = STATUS[u.status] || { rotulo: u.status, classe: 'etiqueta--neutra' };
      const selecionada = String(u.idUsuario) === String(estado.idSelecionado);
      return `<tr class="${selecionada ? 'linha--selecionada' : ''}"${selecionada ? ' aria-selected="true"' : ''}>
          <td class="fw-medium">${esc(u.nome)}</td>
          <td class="celula-email">${esc(u.email)}</td>
          <td>${esc(u.nomeLoja || '—')}</td>
          <td>${esc(textoPapeis(u.papeis))}</td>
          <td><span class="etiqueta ${st.classe}">${esc(st.rotulo)}</span></td>
          <td>${esc(data(u.dataCadastro))}</td>
          <td class="text-nowrap">${htmlAcoes(u)}</td>
        </tr>`;
    }).join('');
  }

  const total = lista.totalRegistros ?? lista.itens.length;
  const inicio = estado.pagina * TAMANHO_PAGINA;
  $('rodape-tabela').textContent = lista.itens.length
    ? `Exibindo ${lista.itens.length === total ? lista.itens.length : `${inicio + 1}–${inicio + lista.itens.length}`} de ${fmtNumero.format(total)} ${total === 1 ? 'conta' : 'contas'}`
    : '';
  const totalPaginas = lista.totalPaginas ?? 1;
  $('paginacao').hidden = totalPaginas <= 1;
  $('pagina-atual').textContent = `Página ${estado.pagina + 1} de ${totalPaginas}`;
  $('botao-pagina-anterior').disabled = estado.pagina === 0 || estado.carregandoLista;
  $('botao-pagina-proxima').disabled = estado.pagina + 1 >= totalPaginas || estado.carregandoLista;
}

async function carregarLista() {
  const requisicao = ++estado.requisicaoLista;
  estado.carregandoLista = true;
  $('erro-lista').hidden = true;
  renderizarTabela();
  try {
    const resposta = await listarUsuarios({ ...estado.filtros, busca: estado.filtros.busca.trim(), pagina: estado.pagina, tamanho: TAMANHO_PAGINA });
    if (requisicao !== estado.requisicaoLista) return;
    estado.lista = { ...resposta, itens: resposta.itens || [] };
  } catch (erro) {
    if (requisicao !== estado.requisicaoLista) return;
    if (erro?.status === 401) return irParaLogin();
    if (erro?.status === 403) return mostrarAcessoRestrito('Sua conta não tem a permissão para gerenciar usuários (GERENCIAR_USUARIOS).');
    $('erro-lista').hidden = false;
    $('erro-lista-texto').textContent = mensagemDeErro(erro, 'Não foi possível carregar as contas. Verifique sua conexão e tente de novo.');
  } finally {
    if (requisicao === estado.requisicaoLista) {
      estado.carregandoLista = false;
      renderizarTabela();
    }
  }
}

// Atualiza uma linha da tabela sem recarregar tudo (depois de uma ação)
function atualizarLinha(conta) {
  const item = estado.lista?.itens.find((u) => String(u.idUsuario) === String(conta.idUsuario));
  if (!item) return;
  item.status = conta.status;
  item.papeis = conta.papeis;
  renderizarTabela();
}

// ---------- Conta selecionada ----------

function linhaDado(rotulo, valor) {
  return `<div class="linha-dado"><dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd></div>`;
}

function textoSituacao(c) {
  const ultima = c.ultimaAcao;
  const quem = ultima?.responsavel ? ` por ${ultima.responsavel}` : '';
  const quando = ultima?.data ? ` em ${data(ultima.data)}` : '';
  switch (c.status) {
    case 'BLOQUEADO': return `Suspensa${quando}${quem}.`;
    case 'BANIDO': return `Banida${quando}${quem}. O banimento é definitivo.`;
    case 'INATIVO': return 'Inativada a pedido do próprio usuário.';
    default:
      return ultima?.acao === 'REATIVAR' ? `Ativa • reativada${quando}${quem}.` : `Ativa desde ${data(c.dataCadastro)}.`;
  }
}

function textoAnuncios(c) {
  if (!c.anuncios) return '';
  const { ativos = 0, pausados = 0 } = c.anuncios;
  if (c.status !== 'ATIVO' && pausados && !ativos) return `${plural(pausados, 'anúncio pausado', 'anúncios pausados')} automaticamente`;
  return [ativos && plural(ativos, 'ativo', 'ativos'), pausados && plural(pausados, 'pausado', 'pausados')].filter(Boolean).join(' • ') || 'Nenhum anúncio';
}

function opcoesDeAcao(c) {
  if (c.status === 'BANIDO') return []; // banimento é definitivo
  const opcoes = [];
  if (c.status === 'ATIVO') opcoes.push(['BLOQUEADO', 'Suspender conta']);
  if (c.status === 'BLOQUEADO' || c.status === 'INATIVO') opcoes.push(['ATIVO', 'Reativar conta']);
  if (estado.papeis.length && !estado.semPermissaoPapeis) opcoes.push(['papeis', 'Alterar papéis internos']);
  return opcoes;
}

function renderizarConta() {
  const c = estado.conta;
  const vazio = $('conta-vazia');
  const corpo = $('conta-detalhe');

  if (!estado.idSelecionado) {
    $('titulo-conta').textContent = 'Conta selecionada';
    vazio.hidden = false;
    corpo.hidden = true;
    return;
  }
  vazio.hidden = true;
  corpo.hidden = false;

  if (!c) {
    $('titulo-conta').textContent = 'Conta selecionada';
    $('conta-situacao').innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Carregando conta…';
    $('conta-dados').innerHTML = '';
    $('form-acao').hidden = true;
    $('conta-sem-acao').hidden = true;
    $('bloco-historico').hidden = true;
    $('botao-historico').hidden = true;
    return;
  }

  $('titulo-conta').textContent = `Conta selecionada • ${c.nome}`;
  $('conta-situacao').textContent = textoSituacao(c);

  const dados = [];
  if (c.status !== 'ATIVO' && c.ultimaAcao?.justificativa) dados.push(linhaDado('Motivo registrado', c.ultimaAcao.justificativa));
  if (c.documento) dados.push(linhaDado(c.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ', c.documento));
  if (c.nomeLoja) dados.push(linhaDado('Loja', c.nomeLoja));
  dados.push(linhaDado('Papéis', textoPapeis(c.papeis)));
  if (c.anuncios) dados.push(linhaDado('Anúncios', textoAnuncios(c)));
  if (c.pedidosEmAndamento) dados.push(linhaDado('Pedidos em andamento', c.pedidosEmAndamento.resumo || (c.pedidosEmAndamento.total ? plural(c.pedidosEmAndamento.total, 'pedido', 'pedidos') : 'Nenhum')));
  $('conta-dados').innerHTML = dados.join('');

  // Ações possíveis
  const propria = ehPropriaConta(c);
  const opcoes = propria ? [] : opcoesDeAcao(c);
  $('form-acao').hidden = !opcoes.length;
  $('conta-sem-acao').hidden = Boolean(opcoes.length);
  $('conta-sem-acao').textContent = propria
    ? 'Esta é a sua conta. Mudanças nela precisam ser feitas por outra pessoa da administração.'
    : c.status === 'BANIDO' ? 'Conta banida: não há ações disponíveis. Consulte o histórico abaixo.' : 'Nenhuma ação disponível para esta conta.';

  if (opcoes.length) {
    const select = $('nova-acao');
    const anterior = select.value;
    select.innerHTML = opcoes.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('');
    if (opcoes.some(([v]) => v === anterior)) select.value = anterior;
    $('botao-banir').hidden = c.status === 'BANIDO';
    renderizarCamposDaAcao();
  }
  renderizarBanimento();
  $('botao-historico').hidden = false;
  $('botao-fechar-conta').hidden = Boolean(opcoes.length); // sem formulário, não há "Cancelar"
}

function renderizarCamposDaAcao() {
  const c = estado.conta;
  const papeis = $('nova-acao').value === 'papeis';
  $('grupo-papeis').hidden = !papeis;
  if (papeis) {
    const internos = estado.papeis.filter((p) => p.interno !== false);
    $('lista-papeis-conta').innerHTML = internos.map((p) => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="papel-${esc(p.nome)}" value="${esc(p.nome)}"${c.papeis.includes(p.nome) ? ' checked' : ''}>
        <label class="form-check-label" for="papel-${esc(p.nome)}">${esc(rotuloPapel(p.nome))}
          <span class="texto-suave small d-block">${esc(p.descricao || (p.permissoes || []).map((x) => ROTULOS_PERMISSAO[x] || x).join(', '))}</span></label>
      </div>`).join('');
  }
  $('botao-confirmar-acao').textContent = 'Confirmar ação';
}

function renderizarBanimento() {
  const confirmando = estado.confirmandoBanimento;
  $('confirmacao-banimento').hidden = !confirmando;
  $('botoes-acao').hidden = confirmando;
  $('nova-acao').disabled = confirmando;
  $('grupo-papeis').classList.toggle('opacity-50', confirmando);
  if (confirmando) $('texto-banimento').textContent =
    `Banir ${estado.conta.nome} é definitivo: a conta perde o acesso e os anúncios saem do ar. ` +
    'Pedidos em andamento continuam visíveis para os compradores.';
}

function mostrarAvisoConta(tipo, texto) {
  const aviso = $('aviso-conta');
  aviso.className = `aviso aviso--${tipo} mb-3`;
  aviso.textContent = texto;
  aviso.hidden = false;
}

function limparErrosForm() {
  $('justificativa').classList.remove('is-invalid');
  $('erro-justificativa').hidden = true;
  $('erro-papeis').hidden = true;
}

async function selecionarConta(id, { acao = null } = {}) {
  estado.idSelecionado = String(id);
  estado.conta = null;
  estado.confirmandoBanimento = false;
  $('aviso-conta').hidden = true;
  $('bloco-historico').hidden = true;
  $('justificativa').value = '';
  limparErrosForm();
  atualizarUrl();
  renderizarTabela();
  renderizarConta();
  $('cartao-conta').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const requisicao = ++estado.requisicaoConta;
  try {
    const conta = await obterUsuario(id);
    if (requisicao !== estado.requisicaoConta) return;
    estado.conta = conta;
    renderizarConta();
    if (acao === 'historico') abrirHistorico();
    else if (acao && [...$('nova-acao').options].some((o) => o.value === acao)) {
      $('nova-acao').value = acao;
      renderizarCamposDaAcao();
    }
    $('titulo-conta').focus({ preventScroll: true });
  } catch (erro) {
    if (requisicao !== estado.requisicaoConta) return;
    if (erro?.status === 401) return irParaLogin();
    estado.idSelecionado = null;
    renderizarConta();
    renderizarTabela();
    atualizarUrl();
    mostrarAvisoConta('erro', erro?.status === 404 ? 'Conta não encontrada.' : mensagemDeErro(erro, 'Não foi possível abrir a conta. Tente de novo.'));
    $('aviso-conta').hidden = false;
    $('conta-vazia').hidden = true;
  }
}

function cancelarSelecao() {
  estado.idSelecionado = null;
  estado.conta = null;
  estado.confirmandoBanimento = false;
  estado.requisicaoConta += 1;
  $('aviso-conta').hidden = true;
  atualizarUrl();
  renderizarTabela();
  renderizarConta();
}

function validarJustificativa() {
  const texto = $('justificativa').value.trim();
  if (texto.length >= MIN_JUSTIFICATIVA) return texto;
  $('justificativa').classList.add('is-invalid');
  $('erro-justificativa').textContent = texto
    ? `Escreva pelo menos ${MIN_JUSTIFICATIVA} caracteres explicando o motivo.`
    : 'A justificativa é obrigatória: ela fica registrada no histórico da conta.';
  $('erro-justificativa').hidden = false;
  $('justificativa').focus();
  return null;
}

async function executarAcao(botao, textoCarregando, acao) {
  if (estado.ocupado) return;
  estado.ocupado = true;
  const original = botao.innerHTML;
  botao.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(textoCarregando)}`;
  document.querySelectorAll('#form-acao button, #form-acao select, #form-acao textarea').forEach((el) => { el.disabled = true; });
  try {
    await acao();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    if (erro?.campos?.length) {
      const campo = erro.campos.find((x) => x.campo === 'justificativa');
      if (campo) {
        $('justificativa').classList.add('is-invalid');
        $('erro-justificativa').textContent = campo.mensagem;
        $('erro-justificativa').hidden = false;
      }
    }
    mostrarAvisoConta('erro', mensagemDeErro(erro, 'Não foi possível concluir a ação. Tente de novo.'));
    if (erro?.status === 409) recarregarConta();
  } finally {
    estado.ocupado = false;
    botao.innerHTML = original;
    document.querySelectorAll('#form-acao button, #form-acao select, #form-acao textarea').forEach((el) => { el.disabled = false; });
    renderizarBanimento();
  }
}

async function recarregarConta() {
  try {
    estado.conta = await obterUsuario(estado.idSelecionado);
    atualizarLinha(estado.conta);
    renderizarConta();
  } catch (e) { /* mantém o que está na tela */ }
}

function depoisDaAcao(conta, texto) {
  estado.conta = conta?.idUsuario ? { ...estado.conta, ...conta } : estado.conta;
  estado.confirmandoBanimento = false;
  $('justificativa').value = '';
  atualizarLinha(estado.conta);
  renderizarConta();
  mostrarAvisoConta('sucesso', texto);
  carregarResumo();
  if (!$('bloco-historico').hidden) abrirHistorico();
  if (!conta?.idUsuario) recarregarConta(); // a API não devolveu o detalhe
}

function confirmarAcao(evento) {
  evento.preventDefault();
  limparErrosForm();
  $('aviso-conta').hidden = true;
  const acao = $('nova-acao').value;

  if (acao === 'papeis') {
    const marcados = [...$('lista-papeis-conta').querySelectorAll('input:checked')].map((i) => i.value);
    const externos = estado.conta.papeis.filter((p) => !ehInterno(p));
    const novos = [...externos, ...marcados];
    const iguais = novos.length === estado.conta.papeis.length && novos.every((p) => estado.conta.papeis.includes(p));
    if (iguais) {
      $('erro-papeis').textContent = 'Nenhum papel mudou.';
      $('erro-papeis').hidden = false;
      return;
    }
    if (!novos.length) {
      $('erro-papeis').textContent = 'A conta precisa ter pelo menos um papel.';
      $('erro-papeis').hidden = false;
      return;
    }
    const justificativa = validarJustificativa();
    if (!justificativa) return;
    executarAcao($('botao-confirmar-acao'), 'Salvando…', async () => {
      const conta = await alterarPapeisUsuario(estado.conta.idUsuario, { papeis: novos, justificativa });
      depoisDaAcao(conta, `Papéis de ${estado.conta.nome} atualizados. A mudança vale no próximo acesso dela à API.`);
      carregarPapeis();
    });
    return;
  }

  const justificativa = validarJustificativa();
  if (!justificativa) return;
  const textos = {
    BLOQUEADO: ['Suspendendo…', `Conta suspensa. ${estado.conta.nome} perdeu o acesso e os anúncios foram pausados.`],
    ATIVO: ['Reativando…', `Conta reativada. ${estado.conta.nome} já pode entrar de novo.`],
  }[acao];
  executarAcao($('botao-confirmar-acao'), textos[0], async () => {
    const conta = await alterarStatusUsuario(estado.conta.idUsuario, { status: acao, justificativa });
    depoisDaAcao(conta, textos[1]);
  });
}

function pedirBanimento() {
  limparErrosForm();
  $('aviso-conta').hidden = true;
  estado.confirmandoBanimento = true;
  renderizarBanimento();
  $('justificativa').focus();
}

function confirmarBanimento() {
  limparErrosForm();
  const justificativa = validarJustificativa();
  if (!justificativa) return;
  executarAcao($('botao-confirmar-banimento'), 'Banindo…', async () => {
    const conta = await alterarStatusUsuario(estado.conta.idUsuario, { status: 'BANIDO', justificativa });
    depoisDaAcao(conta, `Conta banida. ${estado.conta.nome} não tem mais acesso e os anúncios saíram do ar.`);
  });
}

async function abrirHistorico() {
  const bloco = $('bloco-historico');
  const lista = $('lista-historico');
  bloco.hidden = false;
  $('botao-historico').setAttribute('aria-expanded', 'true');
  lista.innerHTML = '<li class="texto-suave small"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Carregando histórico…</li>';
  try {
    const itens = await listarHistoricoUsuario(estado.idSelecionado);
    lista.innerHTML = itens.length ? itens.map((h) => `
      <li class="historico__item">
        <p class="mb-1"><strong>${esc(ROTULOS_ACAO[h.acao] || h.acao)}</strong>
          <span class="texto-suave"> • ${esc(data(h.data, true))}${h.responsavel ? ` • ${esc(h.responsavel)}` : ''}</span></p>
        ${h.justificativa ? `<p class="mb-0 texto-suave">“${esc(h.justificativa)}”</p>` : ''}
      </li>`).join('') : '<li class="texto-suave small">Nenhuma ação administrativa registrada nesta conta.</li>';
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    lista.innerHTML = `<li class="small texto-erro">${esc(mensagemDeErro(erro, 'Não foi possível carregar o histórico.'))}</li>`;
  }
}

function alternarHistorico() {
  if ($('bloco-historico').hidden) abrirHistorico();
  else {
    $('bloco-historico').hidden = true;
    $('botao-historico').setAttribute('aria-expanded', 'false');
  }
}

// ---------- Papéis e permissões ----------

function renderizarPapeis() {
  const corpo = $('corpo-papeis');
  $('aviso-papeis').hidden = true;
  if (estado.semPermissaoPapeis) {
    $('tabela-papeis').hidden = true;
    $('botoes-papeis').hidden = true;
    $('form-permissoes').hidden = true;
    $('aviso-papeis').hidden = false;
    $('aviso-papeis').className = 'aviso aviso--alerta';
    $('aviso-papeis').textContent = 'Sua conta não tem a permissão para ver e editar papéis (GERENCIAR_PERMISSOES).';
    return;
  }
  const internos = estado.papeis.filter((p) => p.interno !== false);
  corpo.innerHTML = internos.length ? internos.map((p) => `
    <tr>
      <td class="fw-semibold">${esc(rotuloPapel(p.nome))}</td>
      <td>${esc(p.descricao || (p.permissoes || []).map((x) => ROTULOS_PERMISSAO[x] || x).join(', ') || 'Nenhuma permissão')}</td>
      <td>${esc(p.totalPessoas ?? '—')}</td>
    </tr>`).join('') : '<tr><td colspan="3" class="texto-suave">Nenhum papel interno cadastrado.</td></tr>';

  $('tabela-papeis').hidden = estado.editandoPermissoes;
  $('botoes-papeis').hidden = estado.editandoPermissoes;
  $('form-permissoes').hidden = !estado.editandoPermissoes;
}

async function carregarPapeis() {
  try {
    estado.papeis = await listarPapeis();
    estado.semPermissaoPapeis = false;
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    if (erro?.status === 403) estado.semPermissaoPapeis = true;
    else {
      $('corpo-papeis').innerHTML = '<tr><td colspan="3" class="texto-erro small">Não foi possível carregar os papéis.</td></tr>';
      return;
    }
  }
  renderizarPapeis();
  renderizarTabela(); // rótulos dos papéis podem ter vindo da API
  if (estado.conta) renderizarConta();
}

function abrirEdicaoPermissoes() {
  const internos = estado.papeis.filter((p) => p.interno !== false);
  if (!internos.length) return;
  estado.editandoPermissoes = true;
  $('papel-editado').innerHTML = internos.map((p) => `<option value="${esc(p.idPapel)}">${esc(rotuloPapel(p.nome))}</option>`).join('');
  // Começa por um papel editável (o Administrador geral fica travado)
  const editavel = internos.find((p) => p.nome !== 'ADMINISTRADOR');
  if (editavel) $('papel-editado').value = String(editavel.idPapel);
  $('justificativa-permissoes').value = '';
  renderizarPapeis();
  renderizarCheckboxPermissoes();
  $('papel-editado').focus();
}

function todasAsPermissoes() {
  const codigos = new Set(Object.keys(ROTULOS_PERMISSAO));
  estado.papeis.forEach((p) => (p.permissoes || []).forEach((c) => codigos.add(c)));
  return [...codigos];
}

function renderizarCheckboxPermissoes() {
  const papel = estado.papeis.find((p) => String(p.idPapel) === $('papel-editado').value);
  if (!papel) return;
  const travado = papel.nome === 'ADMINISTRADOR';
  $('nota-admin-geral').hidden = !travado;
  $('botao-salvar-permissoes').disabled = travado;
  $('lista-permissoes').innerHTML = todasAsPermissoes().map((codigo) => `
    <div class="form-check">
      <input class="form-check-input" type="checkbox" id="perm-${esc(codigo)}" value="${esc(codigo)}"
        ${(papel.permissoes || []).includes(codigo) ? 'checked' : ''}${travado ? ' disabled' : ''}>
      <label class="form-check-label" for="perm-${esc(codigo)}">${esc(ROTULOS_PERMISSAO[codigo] || codigo)}
        <span class="texto-suave small">(${esc(codigo)})</span></label>
    </div>`).join('');
  $('erro-permissoes').hidden = true;
}

function fecharEdicaoPermissoes() {
  estado.editandoPermissoes = false;
  renderizarPapeis();
  $('botao-editar-permissoes').focus();
}

async function salvarPermissoes(evento) {
  evento.preventDefault();
  const papel = estado.papeis.find((p) => String(p.idPapel) === $('papel-editado').value);
  const erroCaixa = $('erro-permissoes');
  erroCaixa.hidden = true;
  const permissoes = [...$('lista-permissoes').querySelectorAll('input:checked')].map((i) => i.value);
  const justificativa = $('justificativa-permissoes').value.trim();
  if (justificativa.length < MIN_JUSTIFICATIVA) {
    erroCaixa.textContent = `Explique a mudança com pelo menos ${MIN_JUSTIFICATIVA} caracteres; ela fica no histórico.`;
    erroCaixa.hidden = false;
    $('justificativa-permissoes').focus();
    return;
  }
  const botao = $('botao-salvar-permissoes');
  botao.disabled = true;
  botao.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Salvando…';
  try {
    await alterarPermissoesPapel(papel.idPapel, { permissoes, justificativa });
    estado.editandoPermissoes = false;
    await carregarPapeis();
    $('aviso-papeis').className = 'aviso aviso--sucesso mb-3';
    $('aviso-papeis').textContent = `Permissões de ${rotuloPapel(papel.nome)} atualizadas. Valem a partir da próxima requisição de cada pessoa.`;
    $('aviso-papeis').hidden = false;
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    erroCaixa.textContent = mensagemDeErro(erro, 'Não foi possível salvar as permissões.');
    erroCaixa.hidden = false;
  } finally {
    botao.disabled = false;
    botao.textContent = 'Salvar permissões';
  }
}

function atribuirPapel() {
  const c = estado.conta;
  const pode = c && !ehPropriaConta(c) && c.status !== 'BANIDO';
  if (pode) {
    $('nova-acao').value = 'papeis';
    renderizarCamposDaAcao();
    $('cartao-conta').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('lista-papeis-conta').querySelector('input')?.focus({ preventScroll: true });
    return;
  }
  $('aviso-papeis').className = 'aviso aviso--info mb-3';
  $('aviso-papeis').textContent = 'Primeiro escolha na tabela a conta que vai receber o papel (clique em “Ver”).';
  $('aviso-papeis').hidden = false;
  $('campo-busca').focus();
}

// ---------- Eventos ----------

function ligarEventos() {
  let espera;
  $('campo-busca').addEventListener('input', (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      estado.filtros.busca = e.target.value;
      estado.pagina = 0;
      atualizarUrl();
      carregarLista();
    }, ESPERA_BUSCA_MS);
  });
  ['filtro-status', 'filtro-papel'].forEach((id) => $(id).addEventListener('change', (e) => {
    estado.filtros[id === 'filtro-status' ? 'status' : 'papel'] = e.target.value;
    estado.pagina = 0;
    atualizarUrl();
    carregarLista();
  }));

  $('botao-pagina-anterior').addEventListener('click', () => { estado.pagina -= 1; carregarLista(); });
  $('botao-pagina-proxima').addEventListener('click', () => { estado.pagina += 1; carregarLista(); });
  $('botao-tentar-lista').addEventListener('click', carregarLista);

  $('corpo-tabela').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-ver]');
    if (botao) selecionarConta(botao.dataset.ver, { acao: botao.dataset.acaoRapida || null });
  });

  $('nova-acao').addEventListener('change', () => { limparErrosForm(); renderizarCamposDaAcao(); });
  $('justificativa').addEventListener('input', () => {
    limparErrosForm();
    $('contador-justificativa').textContent = `${$('justificativa').value.length}/500`;
  });
  $('form-acao').addEventListener('submit', confirmarAcao);
  $('botao-banir').addEventListener('click', pedirBanimento);
  $('botao-confirmar-banimento').addEventListener('click', confirmarBanimento);
  $('botao-voltar-banimento').addEventListener('click', () => {
    estado.confirmandoBanimento = false;
    renderizarBanimento();
    $('botao-banir').focus();
  });
  $('botao-cancelar').addEventListener('click', cancelarSelecao);
  $('botao-fechar-conta').addEventListener('click', cancelarSelecao);
  $('botao-historico').addEventListener('click', alternarHistorico);

  $('botao-editar-permissoes').addEventListener('click', abrirEdicaoPermissoes);
  $('botao-atribuir-papel').addEventListener('click', atribuirPapel);
  $('papel-editado').addEventListener('change', renderizarCheckboxPermissoes);
  $('form-permissoes').addEventListener('submit', salvarPermissoes);
  $('botao-cancelar-permissoes').addEventListener('click', fecharEdicaoPermissoes);
}

// ---------- Início ----------

async function verificarAcesso() {
  const cabecalho = window.Cabecalho;
  let usuario = await cabecalho?.pronto;
  if (!usuario && USAR_SIMULACAO) {
    // Simulação: mostra o administrador de exemplo no cabeçalho
    usuario = { idUsuario: 100, nome: 'Equipe Busca Peça', papeis: ['COMPRADOR', 'ADMINISTRADOR'], administrador: true };
    cabecalho?.definirUsuario(usuario);
  }
  if (!usuario) { irParaLogin(); return false; }
  if (cabecalho && !cabecalho.ehAdmin(usuario)) {
    mostrarAcessoRestrito('Esta área é só para a equipe interna do Busca Peça. Se você deveria ter acesso, peça a um administrador geral.');
    return false;
  }
  estado.idUsuarioLogado = usuario.idUsuario ?? usuario.id ?? null;
  return true;
}

async function iniciar() {
  const params = new URLSearchParams(window.location.search);
  estado.filtros.busca = params.get('busca') || '';
  estado.filtros.status = STATUS[params.get('status')] ? params.get('status') : '';
  estado.filtros.papel = params.get('papel') || '';
  $('campo-busca').value = estado.filtros.busca;
  $('filtro-status').value = estado.filtros.status;
  $('filtro-papel').value = estado.filtros.papel;

  ligarEventos();
  renderizarTabela();
  if (!(await verificarAcesso())) return;

  carregarResumo();
  carregarPapeis();
  await carregarLista();
  if (params.get('conta')) selecionarConta(params.get('conta'));
}

iniciar();