// Tela: conta/notificacoes.html — Notificações de pedido e mensagens
// Acesso: logado. Caso de uso: BP1-51. Fluxo C • Operar pedidos recebidos.
// Rotas (Documentação do Back-end v2, seção 5.11):
//   GET   /api/notificacoes                  lista paginada, lidas e não lidas
//   GET   /api/notificacoes/nao-lidas/total  contador do filtro "Não lidas" e do sino
//   PATCH /api/notificacoes/{id}/lida        marca uma como lida (ao abrir o botão da notificação)
//   PATCH /api/notificacoes/lidas            "Marcar todas como lidas"
// As preferências de e-mail ficam em Meu perfil › Notificações (PUT /api/usuarios/me/notificacoes).
import {
  listarNotificacoes, contarNaoLidas, marcarComoLida, marcarTodasComoLidas,
  TIPOS_POR_CATEGORIA, USAR_SIMULACAO,
} from '../../services/notificacoes.js';

const TAMANHO_PAGINA = 6;
const ESPERA_MAXIMA_AO_ABRIR_MS = 1500; // tempo para o PATCH de "lida" antes de mudar de página
const ERRO_GENERICO = 'Não foi possível carregar as notificações. Verifique sua conexão e tente de novo.';
const FUSO = 'America/Sao_Paulo';

// Raiz do front (js/pages/conta/ → ../../../), para montar links vindos da API
const RAIZ = new URL('../../../', import.meta.url);

// Filtros da tela. "categoria" vira ?tipos= na API; "soComLoja" esconde o filtro de quem não vende.
const FILTROS = {
  'todas': { rotulo: 'Todas' },
  'nao-lidas': { rotulo: 'Não lidas', somenteNaoLidas: true },
  'pedidos': { rotulo: 'Pedidos', categoria: 'PEDIDOS' },
  'minha-loja': { rotulo: 'Minha Loja', categoria: 'MINHA_LOJA', soComLoja: true },
  'busca-peca': { rotulo: 'Busca Peça', categoria: 'BUSCA_PECA' },
};

// Como cada tipo aparece. "acao" monta o botão a partir do idReferencia.
const TIPOS = {
  NOVO_PEDIDO: {
    categoria: 'Minha Loja', titulo: 'Novo pedido na sua loja',
    acao: (id) => ({ texto: 'Ver pedido', href: `../minha-loja/pedido-recebido.html?id=${id}` }),
  },
  ESTOQUE_BAIXO: {
    categoria: 'Minha Loja', titulo: 'Estoque baixo',
    acao: (id) => ({ texto: 'Atualizar estoque', href: `../minha-loja/form-peca.html?id=${id}` }),
  },
  STATUS_PEDIDO: {
    categoria: 'Pedidos', titulo: 'Atualização do pedido',
    acao: (id) => ({ texto: 'Ver pedido', href: `../compra/detalhe-pedido.html?id=${id}` }),
  },
  NOVA_MENSAGEM: {
    categoria: 'Pedidos', titulo: 'Nova mensagem',
    acao: (id) => ({ texto: 'Abrir conversa', href: `conversas.html?id=${id}` }),
  },
  PECA_DISPONIVEL: {
    categoria: 'Pedidos', titulo: 'Peça disponível',
    acao: (id) => ({ texto: 'Ver peça', href: `../busca/detalhe-peca.html?id=${id}` }),
  },
  AVISO_ADMIN: {
    categoria: 'Busca Peça', titulo: 'Aviso do Busca Peça',
    acao: null, // usa link e textoAcao enviados pela API
  },
};

// ---------- Estado da tela ----------

const estado = {
  filtro: 'todas',
  itens: [],
  pagina: 0,
  totalPaginas: 0,
  carregando: false,
  carregandoMais: false,
  erro: '',
  totalTodas: null,
  naoLidas: null,
  temLoja: true,
  requisicao: 0, // ignora respostas antigas quando o usuário troca de filtro rápido
};

const $ = (id) => document.getElementById(id);

// ---------- Utilitários ----------

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const chaveDia = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO });
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO });
const diaMesAno = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO });
const completo = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: FUSO });

// "Hoje, 10:15" • "Ontem, 16:40" • "14/10, 11:12" • "22/09/2025, 17:05"
function quando(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const agora = new Date();
  const ontem = new Date(agora.getTime() - 86400000);
  const dia = chaveDia.format(d);
  if (dia === chaveDia.format(agora)) return `Hoje, ${hora.format(d)}`;
  if (dia === chaveDia.format(ontem)) return `Ontem, ${hora.format(d)}`;
  const mesmoAno = dia.slice(0, 4) === chaveDia.format(agora).slice(0, 4);
  return `${(mesmoAno ? diaMes : diaMesAno).format(d)}, ${hora.format(d)}`;
}

// Só aceita links internos do front ou https (evita javascript: vindo de um aviso)
function linkSeguro(caminho) {
  if (!caminho) return null;
  try {
    const url = new URL(caminho, RAIZ);
    if (url.origin === RAIZ.origin || url.protocol === 'https:') return url.href;
  } catch (e) { /* link inválido */ }
  return null;
}

function acaoDa(n) {
  const tipo = TIPOS[n.tipo];
  if (tipo?.acao && n.idReferencia != null) return tipo.acao(encodeURIComponent(n.idReferencia));
  const href = linkSeguro(n.link);
  return href ? { texto: n.textoAcao || 'Ver detalhes', href } : null;
}

function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

// ---------- Cabeçalho, contadores e subtítulo ----------

function atualizarContadores() {
  $('contador-todas').textContent = estado.totalTodas ?? '';
  $('contador-todas-sep').hidden = estado.totalTodas == null;
  $('contador-nao-lidas').textContent = estado.naoLidas ?? '';
  $('contador-nao-lidas-sep').hidden = estado.naoLidas == null;

  const origem = estado.temLoja
    ? 'avisos dos seus pedidos, da sua loja e do Busca Peça.'
    : 'avisos dos seus pedidos e do Busca Peça.';
  let inicio = '';
  if (estado.naoLidas === 0) inicio = 'Nenhuma não lida • ';
  else if (estado.naoLidas > 0) inicio = `${plural(estado.naoLidas, 'não lida', 'não lidas')} • `;
  $('subtitulo').textContent = inicio + origem;

  $('botao-marcar-todas').disabled = estado.naoLidas === 0 || estado.carregando;

  // Sino do cabeçalho (js/components/cabecalho.js escuta este evento)
  if (estado.naoLidas != null) {
    document.dispatchEvent(new CustomEvent('notificacoes:atualizadas', { detail: { quantidade: estado.naoLidas } }));
  }
}

function atualizarFiltros() {
  document.querySelectorAll('[data-filtro]').forEach((botao) => {
    const filtro = FILTROS[botao.dataset.filtro];
    const ativo = botao.dataset.filtro === estado.filtro;
    botao.classList.toggle('filtro--ativo', ativo);
    botao.setAttribute('aria-pressed', String(ativo));
    if (filtro.soComLoja) botao.hidden = !estado.temLoja;
  });
}

function mostrarAviso(tipo, texto) {
  const aviso = $('aviso');
  aviso.className = `aviso aviso--${tipo} mb-3`;
  aviso.textContent = texto;
  aviso.hidden = false;
}

function esconderAviso() {
  $('aviso').hidden = true;
  $('aviso').textContent = '';
}

// ---------- Lista ----------

function htmlItem(n) {
  const tipo = TIPOS[n.tipo] || { categoria: 'Busca Peça', titulo: 'Notificação' };
  const acao = acaoDa(n);
  const naoLida = !n.lida;
  const titulo = n.titulo || tipo.titulo;
  const data = new Date(n.dataEnvio);
  const dataValida = !Number.isNaN(data.getTime());

  let botao = '';
  if (acao) {
    botao = `<a class="btn btn-contorno-azul notificacao__botao" href="${esc(acao.href)}"
               data-acao="abrir" data-id="${esc(n.idNotificacao)}">${esc(acao.texto)}<span class="visually-hidden">: ${esc(titulo)}</span></a>`;
  } else if (naoLida) {
    botao = `<button type="button" class="btn btn-contorno-azul notificacao__botao"
               data-acao="marcar" data-id="${esc(n.idNotificacao)}">Marcar como lida<span class="visually-hidden">: ${esc(titulo)}</span></button>`;
  }

  return `
    <li class="notificacao${naoLida ? ' notificacao--nao-lida' : ''}" data-id="${esc(n.idNotificacao)}" tabindex="-1">
      <span class="notificacao__marcador" aria-hidden="true"></span>
      <div class="notificacao__corpo">
        <h3 class="notificacao__titulo">${naoLida ? '<span class="visually-hidden">Não lida: </span>' : ''}${esc(titulo)}</h3>
        <p class="notificacao__mensagem">${esc(n.mensagem)}</p>
        <p class="notificacao__meta">${esc(tipo.categoria)} •
          ${dataValida ? `<time datetime="${esc(data.toISOString())}" title="${esc(completo.format(data))}">${esc(quando(n.dataEnvio))}</time>` : ''}</p>
      </div>
      ${botao ? `<div class="notificacao__acao">${botao}</div>` : ''}
    </li>`;
}

function htmlCarregando() {
  return Array.from({ length: 3 }, () => `
    <li class="notificacao placeholder-glow" aria-hidden="true">
      <span class="notificacao__marcador"></span>
      <div class="notificacao__corpo">
        <span class="placeholder rounded d-block mb-2" style="width: 40%; height: 1rem;"></span>
        <span class="placeholder rounded d-block mb-2" style="width: 85%;"></span>
        <span class="placeholder rounded d-block" style="width: 25%;"></span>
      </div>
    </li>`).join('');
}

function htmlVazio() {
  if (estado.filtro === 'nao-lidas') {
    return `<div class="vazio">
        <i class="bi bi-check2-circle vazio__icone" aria-hidden="true"></i>
        <p class="vazio__titulo">Tudo em dia</p>
        <p class="mb-3">Você não tem notificações não lidas.</p>
        <button type="button" class="btn btn-contorno-azul" data-trocar-filtro="todas">Ver todas</button>
      </div>`;
  }
  if (estado.filtro !== 'todas') {
    return `<div class="vazio">
        <i class="bi bi-bell vazio__icone" aria-hidden="true"></i>
        <p class="vazio__titulo">Nenhuma notificação de ${esc(FILTROS[estado.filtro].rotulo)}</p>
        <button type="button" class="btn btn-contorno-azul mt-2" data-trocar-filtro="todas">Ver todas</button>
      </div>`;
  }
  return `<div class="vazio">
      <i class="bi bi-bell vazio__icone" aria-hidden="true"></i>
      <p class="vazio__titulo">Você ainda não tem notificações</p>
      <p class="mb-0">Avisos de pedidos, mensagens${estado.temLoja ? ', da sua loja' : ''} e do Busca Peça aparecem aqui.</p>
    </div>`;
}

function renderizar() {
  const lista = $('lista-notificacoes');
  const estadoLista = $('estado-lista');
  const cartao = $('cartao-notificacoes');
  cartao.setAttribute('aria-busy', String(estado.carregando));

  if (estado.carregando) {
    lista.innerHTML = htmlCarregando();
    lista.hidden = false;
    estadoLista.hidden = true;
  } else if (estado.erro) {
    lista.hidden = true;
    estadoLista.hidden = false;
    estadoLista.innerHTML = `<div class="aviso aviso--erro d-flex flex-wrap align-items-center gap-2" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <span>${esc(estado.erro)}</span>
        <button type="button" class="btn btn-link btn-sm p-0 ms-1 link-erro" data-tentar>Tentar de novo</button>
      </div>`;
  } else if (!estado.itens.length) {
    lista.hidden = true;
    estadoLista.hidden = false;
    estadoLista.innerHTML = htmlVazio();
  } else {
    lista.innerHTML = estado.itens.map(htmlItem).join('');
    lista.hidden = false;
    estadoLista.hidden = true;
  }

  const temMais = !estado.carregando && !estado.erro && estado.pagina + 1 < estado.totalPaginas;
  $('area-carregar-mais').hidden = !temMais;
  const botaoMais = $('botao-carregar-mais');
  botaoMais.disabled = estado.carregandoMais;
  botaoMais.querySelector('.spinner-border').hidden = !estado.carregandoMais;
  botaoMais.querySelector('.btn__texto').textContent = estado.carregandoMais
    ? 'Carregando…' : 'Carregar notificações anteriores';

  atualizarContadores();
}

function substituirItem(n) {
  const li = document.querySelector(`#lista-notificacoes > li[data-id="${CSS.escape(String(n.idNotificacao))}"]`);
  if (li) li.outerHTML = htmlItem(n);
}

// ---------- Carregamento ----------

function parametrosDoFiltro() {
  const f = FILTROS[estado.filtro];
  return {
    somenteNaoLidas: Boolean(f.somenteNaoLidas),
    tipos: f.categoria ? TIPOS_POR_CATEGORIA[f.categoria] : [],
  };
}

function irParaLogin() {
  const voltar = window.location.pathname + window.location.search;
  window.location.href = `login.html?voltar=${encodeURIComponent(voltar)}`;
}

async function carregar() {
  const requisicao = ++estado.requisicao;
  estado.carregando = true;
  estado.erro = '';
  estado.itens = [];
  estado.pagina = 0;
  esconderAviso();
  renderizar();

  try {
    const resposta = await listarNotificacoes({ pagina: 0, tamanho: TAMANHO_PAGINA, ...parametrosDoFiltro() });
    if (requisicao !== estado.requisicao) return;
    estado.itens = resposta.itens || [];
    estado.pagina = resposta.pagina ?? 0;
    estado.totalPaginas = resposta.totalPaginas ?? 0;
    if (estado.filtro === 'todas') estado.totalTodas = resposta.totalRegistros ?? estado.itens.length;
  } catch (erro) {
    if (requisicao !== estado.requisicao) return;
    if (erro?.status === 401) return irParaLogin();
    estado.erro = erro?.mensagem || ERRO_GENERICO;
  } finally {
    if (requisicao === estado.requisicao) {
      estado.carregando = false;
      renderizar();
    }
  }
}

async function carregarMais() {
  if (estado.carregandoMais) return;
  const requisicao = estado.requisicao;
  const quantidadeAntes = estado.itens.length;
  estado.carregandoMais = true;
  esconderAviso();
  renderizar();

  try {
    const resposta = await listarNotificacoes({ pagina: estado.pagina + 1, tamanho: TAMANHO_PAGINA, ...parametrosDoFiltro() });
    if (requisicao !== estado.requisicao) return;
    // Evita repetir uma notificação que "desceu" de página porque chegou outra nova
    const vistos = new Set(estado.itens.map((n) => n.idNotificacao));
    estado.itens.push(...(resposta.itens || []).filter((n) => !vistos.has(n.idNotificacao)));
    estado.pagina = resposta.pagina ?? estado.pagina + 1;
    estado.totalPaginas = resposta.totalPaginas ?? estado.totalPaginas;
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    mostrarAviso('erro', erro?.mensagem || 'Não foi possível carregar as notificações anteriores. Tente de novo.');
  } finally {
    estado.carregandoMais = false;
    if (requisicao === estado.requisicao) {
      renderizar();
      // Leva o foco para a primeira notificação nova (teclado e leitor de tela)
      const primeiraNova = $('lista-notificacoes').children[quantidadeAntes];
      if (primeiraNova && estado.itens.length > quantidadeAntes) primeiraNova.focus();
    }
  }
}

async function carregarContadores() {
  const [naoLidas, todas] = await Promise.allSettled([
    contarNaoLidas(),
    // Com outro filtro aberto, a lista não traz o total geral: pede só o total
    estado.filtro === 'todas' ? Promise.resolve(null) : listarNotificacoes({ pagina: 0, tamanho: 1 }),
  ]);
  if (naoLidas.status === 'fulfilled') estado.naoLidas = naoLidas.value;
  if (todas.status === 'fulfilled' && todas.value) estado.totalTodas = todas.value.totalRegistros;
  atualizarContadores();
}

// ---------- Ações ----------

function trocarFiltro(filtro) {
  if (!FILTROS[filtro] || filtro === estado.filtro) return;
  estado.filtro = filtro;
  const url = new URL(window.location.href);
  if (filtro === 'todas') url.searchParams.delete('filtro');
  else url.searchParams.set('filtro', filtro);
  history.replaceState(null, '', url);
  atualizarFiltros();
  carregar();
}

// Marca na tela na hora e avisa a API; desfaz se a API recusar
function marcarNaTela(n) {
  if (n.lida) return null;
  n.lida = true;
  if (estado.naoLidas > 0) estado.naoLidas -= 1;
  substituirItem(n);
  atualizarContadores();
  return marcarComoLida(n.idNotificacao).catch((erro) => {
    n.lida = false;
    if (estado.naoLidas != null) estado.naoLidas += 1;
    substituirItem(n);
    atualizarContadores();
    throw erro;
  });
}

async function abrir(n, evento, href) {
  const abreEmOutraAba = evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.button === 1;
  const pedido = marcarNaTela(n);
  if (abreEmOutraAba || !pedido) {
    pedido?.catch(() => {});
    return; // segue o link normalmente
  }
  evento.preventDefault();
  // Espera o PATCH (no máximo 1,5 s) para não ser cancelado pela troca de página
  await Promise.race([pedido.catch(() => {}), esperar(ESPERA_MAXIMA_AO_ABRIR_MS)]);
  window.location.href = href;
}

async function marcarUma(n) {
  esconderAviso();
  try {
    await marcarNaTela(n);
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    mostrarAviso('erro', erro?.mensagem || 'Não foi possível marcar como lida. Tente de novo.');
  }
}

async function marcarTodas() {
  const botao = $('botao-marcar-todas');
  esconderAviso();
  botao.disabled = true;
  botao.querySelector('.spinner-border').hidden = false;
  botao.querySelector('.btn__texto').textContent = 'Marcando…';

  try {
    await marcarTodasComoLidas();
    estado.itens.forEach((n) => { n.lida = true; });
    estado.naoLidas = 0;
    renderizar();
    mostrarAviso('sucesso', 'Todas as notificações foram marcadas como lidas.');
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    mostrarAviso('erro', erro?.mensagem || 'Não foi possível marcar todas como lidas. Tente de novo.');
  } finally {
    botao.querySelector('.spinner-border').hidden = true;
    botao.querySelector('.btn__texto').textContent = 'Marcar todas como lidas';
    atualizarContadores();
  }
}

// ---------- Eventos ----------

function ligarEventos() {
  $('filtros').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-filtro]');
    if (botao) trocarFiltro(botao.dataset.filtro);
  });

  $('botao-marcar-todas').addEventListener('click', marcarTodas);
  $('botao-carregar-mais').addEventListener('click', carregarMais);

  $('cartao-notificacoes').addEventListener('click', (e) => {
    if (e.target.closest('[data-tentar]')) return carregar();

    const trocar = e.target.closest('[data-trocar-filtro]');
    if (trocar) return trocarFiltro(trocar.dataset.trocarFiltro);

    const alvo = e.target.closest('[data-acao]');
    if (!alvo) return;
    const n = estado.itens.find((x) => String(x.idNotificacao) === alvo.dataset.id);
    if (!n) return;
    if (alvo.dataset.acao === 'abrir') abrir(n, e, alvo.href);
    if (alvo.dataset.acao === 'marcar') marcarUma(n);
  });

  // Clique com o botão do meio também marca como lida
  $('cartao-notificacoes').addEventListener('auxclick', (e) => {
    const alvo = e.target.closest('[data-acao="abrir"]');
    if (!alvo || e.button !== 1) return;
    const n = estado.itens.find((x) => String(x.idNotificacao) === alvo.dataset.id);
    if (n) marcarNaTela(n)?.catch(() => {});
  });
}

// ---------- Usuário logado ----------

function temLoja(usuario) {
  const papeis = (usuario.papeis || usuario.roles || []).map((p) => String(p.nome || p).toUpperCase());
  return Boolean(usuario.temLoja || usuario.loja || papeis.includes('VENDEDOR'));
}

async function aplicarUsuario() {
  const cabecalho = window.Cabecalho;
  if (!cabecalho) return;
  const usuario = await cabecalho.pronto;
  if (!usuario) {
    // Sem login: com a API de verdade, vai para o login. Na simulação, mostra a conta de exemplo.
    if (!USAR_SIMULACAO) irParaLogin();
    return;
  }
  estado.temLoja = temLoja(usuario);
  // Quem não vende não vê o filtro "Minha Loja"
  if (!estado.temLoja && estado.filtro === 'minha-loja') {
    trocarFiltro('todas');
  } else {
    atualizarFiltros();
    atualizarContadores();
  }
  
}

// ---------- Início ----------

function iniciar() {
  const pedido = new URLSearchParams(window.location.search).get('filtro');
  if (FILTROS[pedido]) estado.filtro = pedido;

  ligarEventos();
  atualizarFiltros();
  carregar();
  carregarContadores();
  aplicarUsuario();
}

iniciar();