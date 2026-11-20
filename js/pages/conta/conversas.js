// Tela: conta/conversas.html (?id=504 abre uma conversa) — Conversas
// Acesso: logado. Caso de uso: BP1-28. Fluxo C • Operar pedidos recebidos.
// Lista à esquerda e mensagens à direita; no celular, uma de cada vez (Documentação do Front-end).
// Rotas (Documentação do Back-end v2, seção 5.9):
//   GET   /api/conversas                    lista com não lidas
//   GET   /api/conversas/{id}/mensagens     mensagens em ordem, paginadas
//   POST  /api/conversas/{id}/mensagens     envia
//   PATCH /api/conversas/{id}/lida          marca como lida ao abrir
import {
  listarConversas, listarMensagens, enviarMensagem, marcarConversaComoLida, USAR_SIMULACAO,
} from '../../services/conversas.js';

const FUSO = 'America/Sao_Paulo';
const TAMANHO_PAGINA = 50;
const INTERVALO_ATUALIZACAO_MS = 20000; // busca mensagens novas enquanto a aba está aberta
const CELULAR = window.matchMedia('(max-width: 991.98px)');
const TEXTO_SEM_CONVERSA = '<p class="texto-suave small text-center my-5">Escolha uma conversa para ver as mensagens.</p>';

const FILTROS = {
  'todas': () => true,
  'compras': (c) => c.papel === 'COMPRADOR',
  'minha-loja': (c) => c.papel === 'VENDEDOR',
  'nao-lidas': (c) => c.naoLidas > 0,
};

const STATUS_PEDIDO = {
  AGUARDANDO_ACEITE: 'Aguardando aceite', ACEITO: 'Aceito', EM_PREPARACAO: 'Em preparação',
  PRONTO_RETIRADA: 'Pronto para retirada', EM_ENTREGA: 'Em entrega', CONCLUIDO: 'Concluído',
  RECUSADO: 'Recusado', CANCELADO: 'Cancelado',
};

const estado = {
  conversas: [],
  filtro: 'todas',
  busca: '',
  carregandoLista: true,
  erroLista: '',
  idAberta: null,
  mensagens: [],
  paginaMaisAntiga: 0,
  carregandoMensagens: false,
  requisicaoMensagens: 0,
  enviando: false,
  idUsuario: null,
  temLoja: true,
};

const $ = (id) => document.getElementById(id);

// ---------- Utilitários ----------

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Busca sem acento e sem diferença de maiúsculas ("autopecas" acha "Autopeças")
function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const chaveDia = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO });
const fmtCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: FUSO });
const fmtLonga = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSO });

function data(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diaRelativo(d) {
  const hoje = new Date();
  const dia = chaveDia.format(d);
  if (dia === chaveDia.format(hoje)) return 'hoje';
  if (dia === chaveDia.format(new Date(hoje.getTime() - 86400000))) return 'ontem';
  return dia.slice(0, 4) === chaveDia.format(hoje).slice(0, 4) ? 'ano' : 'outro';
}

// Lista: "09:48" • "Ontem" • "14/10" • "14/10/25"
function quandoNaLista(iso) {
  const d = data(iso);
  if (!d) return '';
  return { hoje: fmtHora.format(d), ontem: 'Ontem', ano: fmtDiaMes.format(d), outro: fmtCurta.format(d) }[diaRelativo(d)];
}

// Separador da conversa: "Hoje" • "Ontem" • "16 de outubro de 2026"
function separadorDoDia(d) {
  const rel = diaRelativo(d);
  if (rel === 'hoje') return 'Hoje';
  if (rel === 'ontem') return 'Ontem';
  return fmtLonga.format(d);
}

function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

function conversaAberta() {
  return estado.conversas.find((c) => String(c.idConversa) === String(estado.idAberta)) || null;
}

function ehMinha(m) {
  if (typeof m.propria === 'boolean') return m.propria;
  return estado.idUsuario != null && m.idRemetente === estado.idUsuario;
}

function irParaLogin() {
  const voltar = window.location.pathname + window.location.search;
  window.location.href = `login.html?voltar=${encodeURIComponent(voltar)}`;
}

// ---------- Lista ----------

function ordenarConversas() {
  const quando = (c) => data(c.ultimaMensagem?.dataEnvio)?.getTime() ?? 0;
  estado.conversas.sort((a, b) => quando(b) - quando(a));
}

function conversasVisiveis() {
  const termo = normalizar(estado.busca.trim());
  return estado.conversas
    .filter(FILTROS[estado.filtro])
    .filter((c) => !termo || [c.nomeContato, c.codigoPedido, c.tituloPeca, c.tituloPecaCurto]
      .some((campo) => normalizar(campo).includes(termo)));
}

function htmlItemConversa(c) {
  const ativa = String(c.idConversa) === String(estado.idAberta);
  const naoLida = c.naoLidas > 0;
  const origem = c.papel === 'VENDEDOR' ? 'Minha Loja' : 'Compra';
  const meta = [c.codigoPedido, c.tituloPecaCurto || c.tituloPeca, origem].filter(Boolean).join(' • ');
  const ultima = c.ultimaMensagem;
  const previa = ultima ? `${ultima.propria ? 'Você: ' : ''}${ultima.conteudo}` : 'Nenhuma mensagem ainda';

  return `
    <li>
      <button type="button" class="item-conversa${ativa ? ' item-conversa--ativa' : ''}${naoLida ? ' item-conversa--nao-lida' : ''}"
        data-id="${esc(c.idConversa)}"${ativa ? ' aria-current="true"' : ''}>
        <span class="item-conversa__topo">
          <span class="item-conversa__nome">${esc(c.nomeContato)}</span>
          <span class="item-conversa__hora">${esc(quandoNaLista(ultima?.dataEnvio))}</span>
        </span>
        <span class="item-conversa__meta">${esc(meta)}</span>
        <span class="item-conversa__previa">${esc(previa)}</span>
        ${naoLida ? `<span class="item-conversa__novas">${esc(plural(c.naoLidas, 'nova', 'novas'))}<span class="visually-hidden"> não lida${c.naoLidas === 1 ? '' : 's'}</span></span>` : ''}
      </button>
    </li>`;
}

function renderizarFiltros() {
  const naoLidas = estado.conversas.filter((c) => c.naoLidas > 0).length;
  $('contador-nao-lidas').textContent = naoLidas ? ` • ${naoLidas}` : '';
  document.querySelectorAll('[data-filtro]').forEach((botao) => {
    const ativo = botao.dataset.filtro === estado.filtro;
    botao.classList.toggle('filtro--ativo', ativo);
    botao.setAttribute('aria-pressed', String(ativo));
    if (botao.dataset.filtro === 'minha-loja') botao.hidden = !estado.temLoja;
  });
}

function renderizarLista() {
  renderizarFiltros();
  const lista = $('lista-conversas');
  const caixa = $('estado-lista');
  $('cartao-lista').setAttribute('aria-busy', String(estado.carregandoLista));

  if (estado.carregandoLista) {
    lista.innerHTML = Array.from({ length: 4 }, () => `
      <li class="item-conversa placeholder-glow" aria-hidden="true">
        <span class="placeholder rounded d-block mb-2" style="width: 55%; height: 1rem;"></span>
        <span class="placeholder rounded d-block mb-2" style="width: 75%;"></span>
        <span class="placeholder rounded d-block" style="width: 90%;"></span>
      </li>`).join('');
    caixa.hidden = true;
    return;
  }

  if (estado.erroLista) {
    lista.innerHTML = '';
    caixa.hidden = false;
    caixa.innerHTML = `<div class="aviso aviso--erro" role="alert">
        <p class="mb-2">${esc(estado.erroLista)}</p>
        <button type="button" class="btn btn-link btn-sm p-0 fw-semibold link-erro" data-tentar-lista>Tentar de novo</button>
      </div>`;
    return;
  }

  const visiveis = conversasVisiveis();
  lista.innerHTML = visiveis.map(htmlItemConversa).join('');
  caixa.hidden = visiveis.length > 0;
  if (!visiveis.length) {
    let texto = 'Você ainda não tem conversas. Elas começam a partir de um pedido: pelo detalhe da compra ou pelo pedido recebido na sua loja.';
    if (estado.busca.trim()) texto = `Nenhuma conversa encontrada para “${estado.busca.trim()}”.`;
    else if (estado.filtro === 'nao-lidas') texto = 'Tudo em dia: nenhuma conversa com mensagens novas.';
    else if (estado.filtro !== 'todas') texto = 'Nenhuma conversa neste filtro.';
    caixa.innerHTML = `<p class="texto-suave small text-center my-4">${esc(texto)}</p>`;
  }
}

async function carregarLista({ silencioso = false } = {}) {
  if (!silencioso) {
    estado.carregandoLista = true;
    estado.erroLista = '';
    renderizarLista();
  }
  try {
    estado.conversas = await listarConversas();
    ordenarConversas();
    estado.erroLista = '';
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    if (!silencioso) estado.erroLista = erro?.mensagem || 'Não foi possível carregar as conversas. Verifique sua conexão e tente de novo.';
  } finally {
    estado.carregandoLista = false;
    renderizarLista();
  }
}

// ---------- Conversa aberta ----------

function renderizarCabecalhoConversa() {
  const c = conversaAberta();
  $('conversa-vazia').hidden = Boolean(c);
  $('conversa-aberta').hidden = !c;
  if (!c) return;

  $('conversa-nome').textContent = c.nomeContato;
  $('conversa-sub').textContent = [
    c.codigoPedido && `Pedido ${c.codigoPedido}`, c.tituloPeca, STATUS_PEDIDO[c.statusPedido] || c.statusPedido,
  ].filter(Boolean).join(' • ');

  const link = $('link-ver-pedido');
  link.hidden = !c.idPedido;
  if (c.idPedido) {
    const id = encodeURIComponent(c.idPedido);
    link.href = c.papel === 'VENDEDOR' ? `../minha-loja/pedido-recebido.html?id=${id}` : `../compra/detalhe-pedido.html?id=${id}`;
  }
  $('campo-mensagem').placeholder = c.papel === 'VENDEDOR' ? 'Escreva para o comprador' : 'Escreva para a loja';
  document.title = `${c.nomeContato} • Conversas • Busca Peças`;
}

function renderizarMensagens({ manterPosicao = false, rolarParaFim = true } = {}) {
  const area = $('area-mensagens');
  const caixa = $('mensagens');
  const alturaAntes = area.scrollHeight;
  const topoAntes = area.scrollTop;

  $('botao-anteriores').hidden = estado.carregandoMensagens || estado.paginaMaisAntiga <= 0;

  if (estado.carregandoMensagens && !estado.mensagens.length) {
    caixa.innerHTML = '<p class="texto-suave small mb-0"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Carregando mensagens…</p>';
    return;
  }
  if (!estado.mensagens.length) {
    caixa.innerHTML = '<p class="texto-suave small mb-0">Nenhuma mensagem ainda. Combine aqui retirada, entrega e pagamento.</p>';
    return;
  }

  let diaAnterior = '';
  caixa.innerHTML = estado.mensagens.map((m) => {
    const d = data(m.dataEnvio);
    let separador = '';
    const dia = d ? chaveDia.format(d) : '';
    if (d && dia !== diaAnterior) {
      separador = `<p class="separador-dia">${esc(separadorDoDia(d))}</p>`;
      diaAnterior = dia;
    }
    const minha = ehMinha(m);
    const autor = minha ? 'Você' : (m.nomeRemetente || conversaAberta()?.nomeContato || '');
    return `${separador}
      <div class="balao${minha ? ' balao--minha' : ''}">
        <p class="balao__texto">${esc(m.conteudo)}</p>
        <p class="balao__meta">${esc(autor)} • ${d ? `<time datetime="${esc(d.toISOString())}">${esc(fmtHora.format(d))}</time>` : ''}</p>
      </div>`;
  }).join('');

  if (manterPosicao) area.scrollTop = topoAntes + (area.scrollHeight - alturaAntes);
  else if (rolarParaFim) area.scrollTop = area.scrollHeight;
}

// Abre na última página (mensagens mais novas); a página 0 tem as mais antigas
async function buscarFimDaConversa(idConversa) {
  const primeira = await listarMensagens(idConversa, { pagina: 0, tamanho: TAMANHO_PAGINA });
  const ultimaPagina = Math.max(0, (primeira.totalPaginas ?? 1) - 1);
  if (ultimaPagina === 0) return { itens: primeira.itens || [], pagina: 0 };
  const ultima = await listarMensagens(idConversa, { pagina: ultimaPagina, tamanho: TAMANHO_PAGINA });
  return { itens: ultima.itens || [], pagina: ultimaPagina };
}

function marcarComoLidaSeNecessario() {
  const c = conversaAberta();
  if (!c || !(c.naoLidas > 0)) return;
  c.naoLidas = 0;
  renderizarLista();
  marcarConversaComoLida(c.idConversa).catch(() => {});
}

async function abrirConversa(idConversa, { historico = 'substituir' } = {}) {
  estado.idAberta = String(idConversa);
  const c = conversaAberta();

  // URL e voltar do navegador (no celular, "voltar" fecha a conversa)
  const url = new URL(window.location.href);
  if (url.searchParams.get('id') !== estado.idAberta) {
    url.searchParams.set('id', estado.idAberta);
    if (historico === 'empilhar') history.pushState({ conversa: estado.idAberta }, '', url);
    else if (historico === 'substituir') history.replaceState(history.state, '', url);
  }

  $('layout-conversas').classList.add('mostrando-conversa');
  renderizarLista();
  renderizarCabecalhoConversa();
  limparErroEnvio();

  if (!c) {
    $('conversa-vazia').hidden = false;
    $('conversa-vazia').innerHTML = '<p class="aviso aviso--alerta mb-0">Conversa não encontrada. Ela pode ter sido encerrada ou não ser sua.</p>';
    return;
  }
  $('conversa-vazia').innerHTML = TEXTO_SEM_CONVERSA;

  const requisicao = ++estado.requisicaoMensagens;
  estado.mensagens = [];
  estado.paginaMaisAntiga = 0;
  estado.carregandoMensagens = true;
  renderizarMensagens();
  $('erro-mensagens').hidden = true;

  try {
    const { itens, pagina } = await buscarFimDaConversa(c.idConversa);
    if (requisicao !== estado.requisicaoMensagens) return;
    estado.mensagens = itens;
    estado.paginaMaisAntiga = pagina;
    marcarComoLidaSeNecessario();
  } catch (erro) {
    if (requisicao !== estado.requisicaoMensagens) return;
    if (erro?.status === 401) return irParaLogin();
    $('erro-mensagens').hidden = false;
  } finally {
    if (requisicao === estado.requisicaoMensagens) {
      estado.carregandoMensagens = false;
      renderizarMensagens();
      if (CELULAR.matches) $('conversa-nome').focus({ preventScroll: false });
    }
  }
}

async function carregarAnteriores() {
  const c = conversaAberta();
  if (!c || estado.paginaMaisAntiga <= 0) return;
  const botao = $('botao-anteriores');
  botao.disabled = true;
  botao.textContent = 'Carregando…';
  try {
    const resposta = await listarMensagens(c.idConversa, { pagina: estado.paginaMaisAntiga - 1, tamanho: TAMANHO_PAGINA });
    const vistos = new Set(estado.mensagens.map((m) => m.idMensagem));
    estado.mensagens = [...(resposta.itens || []).filter((m) => !vistos.has(m.idMensagem)), ...estado.mensagens];
    estado.paginaMaisAntiga -= 1;
    renderizarMensagens({ manterPosicao: true });
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
  } finally {
    botao.disabled = false;
    botao.textContent = 'Carregar mensagens anteriores';
  }
}

function fecharConversaNoCelular() {
  estado.idAberta = null;
  estado.requisicaoMensagens += 1;
  $('layout-conversas').classList.remove('mostrando-conversa');
  renderizarLista();
  document.title = 'Conversas • Busca Peças';
  $('campo-busca').focus({ preventScroll: true });
}

function voltarParaLista() {
  if (history.state?.conversa) {
    history.back(); // o popstate fecha a conversa
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('id');
  history.replaceState(null, '', url);
  fecharConversaNoCelular();
}

// ---------- Envio ----------

function limparErroEnvio() {
  $('erro-envio').hidden = true;
  $('campo-mensagem').classList.remove('is-invalid');
}

async function enviar(evento) {
  evento.preventDefault();
  const c = conversaAberta();
  const campo = $('campo-mensagem');
  const conteudo = campo.value.trim();
  limparErroEnvio();
  if (!c || estado.enviando) return;
  if (!conteudo) {
    $('erro-envio').textContent = 'Escreva uma mensagem antes de enviar.';
    $('erro-envio').hidden = false;
    campo.classList.add('is-invalid');
    campo.focus();
    return;
  }

  estado.enviando = true;
  const botao = $('botao-enviar');
  botao.disabled = true;
  botao.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span class="visually-hidden">Enviando</span>';
  try {
    const nova = await enviarMensagem(c.idConversa, conteudo);
    const mensagem = { propria: true, ...nova };
    if (String(estado.idAberta) === String(c.idConversa)) {
      estado.mensagens.push(mensagem);
      renderizarMensagens();
    }
    c.ultimaMensagem = { conteudo: mensagem.conteudo, dataEnvio: mensagem.dataEnvio, propria: true };
    ordenarConversas();
    renderizarLista();
    campo.value = '';
    atualizarContador();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    $('erro-envio').textContent = erro?.mensagem || 'Não foi possível enviar. Tente novamente.';
    $('erro-envio').hidden = false;
  } finally {
    estado.enviando = false;
    botao.disabled = false;
    botao.textContent = 'Enviar';
    campo.focus();
  }
}

function atualizarContador() {
  const campo = $('campo-mensagem');
  $('contador-mensagem').textContent = campo.value.length > campo.maxLength * 0.8 ? `${campo.value.length}/${campo.maxLength}` : '';
}

// ---------- Atualização periódica ----------
// Sem WebSocket na API: a cada 20 s (aba visível) relê a lista; se a conversa
// aberta tiver mensagem mais nova que a última na tela, busca as novas.

async function atualizarEmSegundoPlano() {
  if (document.hidden || estado.carregandoLista || estado.enviando) return;
  await carregarLista({ silencioso: true });
  const c = conversaAberta();
  if (!c || estado.carregandoMensagens) return;

  const ultimaNaTela = data(estado.mensagens[estado.mensagens.length - 1]?.dataEnvio)?.getTime() ?? 0;
  const ultimaNaLista = data(c.ultimaMensagem?.dataEnvio)?.getTime() ?? 0;
  if (ultimaNaLista <= ultimaNaTela) return;

  try {
    const area = $('area-mensagens');
    const pertoDoFim = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
    const { itens } = await buscarFimDaConversa(c.idConversa);
    const vistos = new Set(estado.mensagens.map((m) => m.idMensagem));
    const novas = itens.filter((m) => !vistos.has(m.idMensagem));
    if (!novas.length || String(estado.idAberta) !== String(c.idConversa)) return;
    estado.mensagens.push(...novas);
    renderizarMensagens({ rolarParaFim: pertoDoFim });
    marcarComoLidaSeNecessario();
  } catch (erro) {
    if (erro?.status === 401) irParaLogin();
  }
}

// ---------- Eventos ----------

function ligarEventos() {
  $('campo-busca').addEventListener('input', (e) => {
    estado.busca = e.target.value;
    renderizarLista();
  });

  $('filtros').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-filtro]');
    if (!botao) return;
    estado.filtro = botao.dataset.filtro;
    renderizarLista();
  });

  $('cartao-lista').addEventListener('click', (e) => {
    if (e.target.closest('[data-tentar-lista]')) return carregarLista();
    const item = e.target.closest('.item-conversa[data-id]');
    if (item) abrirConversa(item.dataset.id, { historico: CELULAR.matches ? 'empilhar' : 'substituir' });
  });

  $('botao-voltar').addEventListener('click', voltarParaLista);
  $('botao-anteriores').addEventListener('click', carregarAnteriores);
  $('botao-tentar-mensagens').addEventListener('click', () => abrirConversa(estado.idAberta, { historico: 'nenhum' }));
  $('form-mensagem').addEventListener('submit', enviar);
  $('campo-mensagem').addEventListener('input', () => { limparErroEnvio(); atualizarContador(); });

  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) abrirConversa(id, { historico: 'nenhum' });
    else fecharConversaNoCelular();
  });

  setInterval(atualizarEmSegundoPlano, INTERVALO_ATUALIZACAO_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarEmSegundoPlano(); });
}

// ---------- Usuário logado ----------

async function aplicarUsuario() {
  const usuario = await window.Cabecalho?.pronto;
  if (!usuario) {
    if (window.Cabecalho && !USAR_SIMULACAO) irParaLogin();
    return;
  }
  estado.idUsuario = usuario.idUsuario ?? usuario.id ?? null;
  const papeis = (usuario.papeis || []).map((p) => String(p.nome || p).toUpperCase());
  estado.temLoja = Boolean(usuario.temLoja || usuario.loja || papeis.includes('VENDEDOR'));
  if (!estado.temLoja && estado.filtro === 'minha-loja') estado.filtro = 'todas';
  renderizarLista();
  if (estado.mensagens.length) renderizarMensagens({ rolarParaFim: false });
}

// ---------- Início ----------

async function iniciar() {
  $('aviso-demonstracao').hidden = !USAR_SIMULACAO;
  ligarEventos();
  aplicarUsuario();

  await carregarLista();
  if (estado.erroLista) return;

  const pedido = new URLSearchParams(window.location.search).get('id');
  if (pedido) {
    abrirConversa(pedido, { historico: 'nenhum' });
  } else if (!CELULAR.matches && estado.conversas.length) {
    // No computador abre a mais recente, como no protótipo
    abrirConversa(estado.conversas[0].idConversa, { historico: 'substituir' });
  }
}

iniciar();