// Tela: minha-loja/pedido-recebido.html?id=2081 — Pedido recebido (visão do vendedor)
// Acesso: vendedor dono da loja do pedido. Fluxo C • Operar pedidos recebidos.
// Casos de uso: BP1-26 (aceitar/recusar), BP1-28 (conversa), BP1-29 (retirada), BP1-33 (envio), BP1-27 (concluir).
// Rotas (Documentação do Back-end v2, seções 5.8 e 5.9):
//   GET   /api/pedidos/{id}                      detalhe
//   PATCH /api/pedidos/{id}/aceitar | /recusar   resposta da loja
//   PATCH /api/pedidos/{id}/em-preparacao        (rota nova, vem do protótipo)
//   PATCH /api/pedidos/{id}/pronto-retirada      retirada no balcão
//   POST  /api/pedidos/{id}/confirmar-retirada   confere o código e conclui
//   PATCH /api/pedidos/{id}/enviar | /concluir   entrega
//   GET/POST /api/conversas/{id}/mensagens       conversa com o comprador
import {
  obterPedido, aceitarPedido, recusarPedido, marcarEmPreparacao, marcarProntoRetirada,
  confirmarRetirada, registrarEnvio, concluirEntrega, normalizarCodigo, USAR_SIMULACAO,
} from '../../services/pedidos.js';
import {
  abrirConversaDoPedido, listarMensagens, enviarMensagem, marcarConversaComoLida,
} from '../../services/conversas.js';
import { formatarMoeda } from '../../utils/formatacao.js';
import { mascararTelefone } from '../../utils/mascaras.js';

const FUSO = 'America/Sao_Paulo';
const ERRO_GENERICO = 'Verifique sua conexão e tente novamente.';

const STATUS = {
  AGUARDANDO_ACEITE: { rotulo: 'Aguardando aceite', classe: 'etiqueta--alerta' },
  ACEITO: { rotulo: 'Aceito', classe: 'etiqueta--info' },
  EM_PREPARACAO: { rotulo: 'Em preparação', classe: 'etiqueta--info' },
  PRONTO_RETIRADA: { rotulo: 'Pronto para retirada', classe: 'etiqueta--info' },
  EM_ENTREGA: { rotulo: 'Em entrega', classe: 'etiqueta--info' },
  CONCLUIDO: { rotulo: 'Concluído', classe: 'etiqueta--sucesso' },
  RECUSADO: { rotulo: 'Recusado', classe: 'etiqueta--erro' },
  CANCELADO: { rotulo: 'Cancelado pelo comprador', classe: 'etiqueta--neutra' },
};

// Etapas da linha do tempo por modalidade
const ETAPAS = {
  RETIRADA: [
    ['AGUARDANDO_ACEITE', 'Pedido recebido'], ['ACEITO', 'Aceite da loja'], ['EM_PREPARACAO', 'Em preparação'],
    ['PRONTO_RETIRADA', 'Pronto para retirada'], ['CONCLUIDO', 'Concluído'],
  ],
  ENTREGA: [
    ['AGUARDANDO_ACEITE', 'Pedido recebido'], ['ACEITO', 'Aceite da loja'], ['EM_PREPARACAO', 'Em preparação'],
    ['EM_ENTREGA', 'Enviado'], ['CONCLUIDO', 'Concluído'],
  ],
};

const MODALIDADES_ENVIO = { PROPRIA: 'Entrega própria', MOTOBOY: 'Motoboy', TRANSPORTADORA: 'Transportadora' };

const estado = {
  idPedido: null,
  pedido: null,
  idUsuario: null,
  mensagens: [],
  modoRecusa: false,
  ocupado: false,
};

const $ = (id) => document.getElementById(id);

// ---------- Utilitários ----------

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const chaveDia = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO });

function dataValida(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "recebido em 16/10/2026 às 10:15"
function recebidoEm(iso) {
  const d = dataValida(iso);
  if (!d) return '';
  const [dia, hora] = fmtDataHora.format(d).split(', ');
  return `recebido em ${dia} às ${hora}`;
}

// "16/10 • 10:15"
function diaEHora(iso) {
  const d = dataValida(iso);
  return d ? `${fmtDiaMes.format(d)} • ${fmtHora.format(d)}` : '';
}

// Mensagens: "10:20" hoje, "16/10, 10:20" em outros dias
function horaMensagem(iso) {
  const d = dataValida(iso);
  if (!d) return '';
  return chaveDia.format(d) === chaveDia.format(new Date()) ? fmtHora.format(d) : `${fmtDiaMes.format(d)}, ${fmtHora.format(d)}`;
}

function unidades(n) {
  return `${n} ${Number(n) === 1 ? 'unidade' : 'unidades'}`;
}

function linha(rotulo, valorHtml, classeValor = '') {
  return `<div class="linha-dado"><dt>${esc(rotulo)}</dt><dd class="${classeValor}">${valorHtml}</dd></div>`;
}

// Quem recebe os avisos ("Oficina Rumo Certo recebeu o aviso.")
function nomeComprador() {
  return estado.pedido?.comprador?.nome || 'O comprador';
}

// ---------- Avisos (resultado das ações) ----------

function mostrarAviso(tipo, titulo, texto) {
  const aviso = $('aviso-acao');
  aviso.className = `aviso-estado aviso-estado--${tipo} mb-4`;
  aviso.innerHTML = `<p class="aviso-estado__titulo">${esc(titulo)}</p><p class="mb-0">${esc(texto)}</p>`;
  aviso.hidden = false;
  aviso.focus({ preventScroll: true });
  aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function esconderAviso() {
  $('aviso-acao').hidden = true;
}

// Executa uma ação com o botão em "carregando" e trata os erros comuns
async function executar(botao, textoCarregando, acao, tituloErro) {
  if (estado.ocupado) return;
  estado.ocupado = true;
  esconderAviso();
  const textoOriginal = botao?.innerHTML;
  if (botao) {
    botao.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(textoCarregando)}`;
  }
  travarAcoes(true);

  try {
    await acao();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    if (erro?.status === 409) {
      // O pedido mudou em outro lugar (ex.: comprador cancelou): recarrega e avisa
      await recarregarPedido();
      mostrarAviso('alerta', 'O pedido mudou de situação', 'Os dados foram atualizados. Confira antes de continuar.');
    } else if (erro?.tratado) {
      // erro já mostrado perto do campo
    } else {
      mostrarAviso('erro', tituloErro, erro?.mensagem || ERRO_GENERICO);
    }
  } finally {
    if (botao && document.body.contains(botao)) botao.innerHTML = textoOriginal;
    estado.ocupado = false;
    travarAcoes(false);
  }
}

function travarAcoes(travar) {
  document.querySelectorAll('[data-acao-pedido]').forEach((el) => {
    el.disabled = travar || el.dataset.bloqueado === 'true';
  });
}

// ---------- Renderização ----------

function renderizarTopo() {
  const p = estado.pedido;
  const status = STATUS[p.status] || { rotulo: p.status, classe: 'etiqueta--neutra' };
  document.title = `Pedido ${p.codigo} • Busca Peças`;
  $('migalha-codigo').textContent = p.codigo;
  $('titulo-pedido').textContent = `Pedido ${p.codigo}`;
  $('subtitulo-pedido').textContent = [p.comprador?.nome, recebidoEm(p.dataPedido)].filter(Boolean).join(' • ');
  $('etiqueta-status').className = `etiqueta ${status.classe}`;
  $('etiqueta-status').textContent = status.rotulo;
}

function textoEstoque(item) {
  const st = estado.pedido.status;
  if (st === 'RECUSADO' || st === 'CANCELADO') return `${unidades(item.estoqueAtual)} • quantidade devolvida ao estoque`;
  if (st === 'AGUARDANDO_ACEITE') {
    const q = item.quantidade;
    return `${unidades(item.estoqueAtual)} • ${q === 1 ? '1 reservada' : `${q} reservadas`} para este pedido`;
  }
  return unidades(item.estoqueAtual);
}

function renderizarItens() {
  const p = estado.pedido;
  const itens = p.itens || [];
  const html = itens.map((i, indice) => {
    const peca = [i.titulo, i.descricaoCurta].filter(Boolean).join(' • ');
    const codigos = [i.sku && `SKU ${i.sku}`, i.codigoOem && `OEM ${i.codigoOem}`].filter(Boolean).join(' • ');
    const alerta = p.status === 'AGUARDANDO_ACEITE' ? 'texto-alerta' : '';
    return `<dl class="lista-dados${indice ? ' lista-dados--separada' : ''}">
        ${linha('Peça', esc(peca))}
        ${codigos ? linha('Código', esc(codigos)) : ''}
        ${linha('Quantidade', esc(`${unidades(i.quantidade)} × ${formatarMoeda(i.precoUnitario)}`))}
        ${i.estoqueAtual != null ? linha('Estoque atual', esc(textoEstoque(i)), alerta) : ''}
      </dl>`;
  }).join('');

  const totais = `<dl class="lista-dados${itens.length > 1 ? ' lista-dados--separada' : ''}">
      ${linha('Valor dos itens', esc(formatarMoeda(p.valorItens)), 'texto-destaque')}
      ${Number(p.valorFrete) > 0 ? linha('Frete', esc(formatarMoeda(p.valorFrete))) : ''}
    </dl>`;

  // Com um item só, "Valor dos itens" fica logo depois da quantidade, como no protótipo
  $('itens-pedido').innerHTML = itens.length === 1
    ? html.replace('</dl>', '') + totais.replace(/<dl[^>]*>/, '')
    : html + totais;
}

function renderizarComprador() {
  const p = estado.pedido;
  const c = p.comprador || {};
  const local = [c.cidade, c.estado].filter(Boolean).join('/');
  const telefone = c.telefone ? mascararTelefone(c.telefone) : '';
  const contato = [
    c.nomeContato && esc(c.nomeContato),
    telefone && `<a href="tel:+55${esc(String(c.telefone).replace(/\D/g, ''))}">${esc(telefone)}</a>`,
  ].filter(Boolean).join(' • ');

  let recebimento = p.modalidadeEntrega === 'ENTREGA' ? 'Entrega a combinar com o comprador' : 'Retirada no balcão';
  if (p.modalidadeEntrega === 'ENTREGA' && p.enderecoEntrega) recebimento += `<br><span class="texto-suave">${esc(p.enderecoEntrega)}</span>`;

  let envio = '';
  if (p.entrega?.modalidade) {
    envio = [MODALIDADES_ENVIO[p.entrega.modalidade] || p.entrega.modalidade, p.entrega.transportadora,
      p.entrega.codigoRastreio && `rastreio ${p.entrega.codigoRastreio}`].filter(Boolean).join(' • ');
  }

  $('dados-comprador').innerHTML = [
    linha('Oficina', esc([c.nome, local].filter(Boolean).join(' • '))),
    contato ? linha('Contato', contato) : '',
    linha('Recebimento', recebimento),
    envio ? linha('Envio', esc(envio)) : '',
    p.observacao ? linha('Observação', `“${esc(p.observacao)}”`) : '',
  ].join('');
}

function renderizarLinhaDoTempo() {
  const p = estado.pedido;
  const datas = {};
  (p.historico || []).forEach((h) => { datas[h.status] = h.data; });
  datas.AGUARDANDO_ACEITE ??= p.dataPedido;

  let etapas;
  if (p.status === 'RECUSADO' || p.status === 'CANCELADO') {
    etapas = [
      { rotulo: 'Pedido recebido', feito: true, info: diaEHora(datas.AGUARDANDO_ACEITE) },
      {
        rotulo: p.status === 'RECUSADO' ? 'Recusado pela loja' : 'Cancelado pelo comprador',
        feito: true, encerrado: true, info: diaEHora(datas[p.status]) || 'Feito',
      },
    ];
  } else {
    const lista = ETAPAS[p.modalidadeEntrega] || ETAPAS.RETIRADA;
    const atual = lista.findIndex(([st]) => st === p.status);
    // Com histórico, uma etapa que não aparece nele foi pulada (ex.: aceito → pronto direto)
    const temHistorico = (p.historico || []).length > 0;
    etapas = lista.map(([st, rotulo], i) => {
      const pulada = temHistorico && i < atual && !datas[st];
      const feito = i <= atual && !pulada;
      let info = '—';
      if (feito) info = diaEHora(datas[st]) || 'Feito';
      else if (i === atual + 1) {
        if (p.status === 'PRONTO_RETIRADA') info = 'Aguardando o comprador';
        else if (p.status === 'EM_ENTREGA') info = 'Aguardando a entrega';
        else info = 'Aguardando você';
      }
      return { rotulo, feito, info, atual: i === atual };
    });
  }

  $('linha-do-tempo').innerHTML = etapas.map((e) => `
    <li class="etapa${e.feito ? ' etapa--feita' : ''}${e.encerrado ? ' etapa--encerrada' : ''}"${e.atual ? ' aria-current="step"' : ''}>
      <span class="etapa__marcador" aria-hidden="true"></span>
      <span class="etapa__rotulo">${esc(e.rotulo)}<span class="visually-hidden">${e.feito ? ' (feito)' : ' (pendente)'}</span></span>
      <span class="etapa__info">${esc(e.info)}</span>
    </li>`).join('');

  const motivo = p.status === 'RECUSADO' ? p.motivoRecusa : p.status === 'CANCELADO' ? p.motivoCancelamento : '';
  $('motivo-encerramento').hidden = !motivo;
  $('motivo-encerramento').textContent = motivo ? `Motivo: ${motivo}` : '';
}

function renderizarAcoes() {
  const p = estado.pedido;
  const st = p.status;
  const retirada = p.modalidadeEntrega !== 'ENTREGA';
  const aguardando = st === 'AGUARDANDO_ACEITE';
  const emAndamento = ['ACEITO', 'EM_PREPARACAO', 'PRONTO_RETIRADA', 'EM_ENTREGA'].includes(st);

  // Responder ou recusar
  $('cartao-responder').hidden = !aguardando || estado.modoRecusa;
  $('cartao-recusar').hidden = !aguardando || !estado.modoRecusa;

  // Após o aceite
  $('cartao-apos-aceite').hidden = !emAndamento;
  $('botao-em-preparacao').hidden = st !== 'ACEITO';
  $('botao-pronto-retirada').hidden = !retirada || !['ACEITO', 'EM_PREPARACAO'].includes(st);
  $('form-envio').hidden = retirada || !['ACEITO', 'EM_PREPARACAO'].includes(st);
  $('bloco-concluir-entrega').hidden = st !== 'EM_ENTREGA';
  $('grupo-avancar').hidden = $('botao-em-preparacao').hidden && $('botao-pronto-retirada').hidden;
  $('texto-apos-aceite').textContent = st === 'EM_ENTREGA'
    ? 'Quando o comprador receber a peça, confirme a entrega para concluir.'
    : st === 'PRONTO_RETIRADA'
      ? 'O pedido está separado. Confira o código quando o comprador chegar.'
      : 'Avance o pedido conforme o atendimento.';

  // Retirada no balcão: visível em toda a etapa, liberada quando está pronto
  const blocoRetirada = $('bloco-retirada');
  blocoRetirada.hidden = !retirada || !emAndamento;
  const podeConfirmar = st === 'PRONTO_RETIRADA';
  $('separador-retirada').hidden = blocoRetirada.hidden || $('grupo-avancar').hidden;
  $('codigo-retirada').disabled = !podeConfirmar;
  $('botao-confirmar-retirada').dataset.bloqueado = String(!podeConfirmar);
  $('botao-confirmar-retirada').disabled = !podeConfirmar || estado.ocupado;
  $('dica-retirada').textContent = podeConfirmar
    ? 'Peça o código somente no momento da entrega da peça.'
    : 'Disponível depois de marcar o pedido como pronto para retirada.';

  // Situação final
  const final = ['CONCLUIDO', 'RECUSADO', 'CANCELADO'].includes(st);
  $('cartao-situacao').hidden = !final;
  if (final) {
    const textos = {
      CONCLUIDO: ['Pedido concluído', retirada ? 'A retirada foi confirmada no balcão. O recibo e a avaliação ficam liberados para o comprador.' : 'A entrega foi confirmada. O recibo e a avaliação ficam liberados para o comprador.'],
      RECUSADO: ['Pedido recusado', `O comprador recebeu o motivo${p.motivoRecusa ? ` (“${p.motivoRecusa}”)` : ''}. A quantidade voltou ao estoque.`],
      CANCELADO: ['Pedido cancelado pelo comprador', `O cancelamento foi feito antes do envio${p.motivoCancelamento ? ` (“${p.motivoCancelamento}”)` : ''}. A quantidade voltou ao estoque.`],
    }[st];
    $('situacao-titulo').textContent = textos[0];
    $('situacao-texto').textContent = textos[1];
  }
}

function renderizarPedido() {
  renderizarTopo();
  renderizarItens();
  renderizarComprador();
  renderizarLinhaDoTempo();
  renderizarAcoes();
  $('estado-pagina').hidden = true;
  $('conteudo-pedido').hidden = false;
}

function renderizarEstado(tipo, titulo, texto, comBotaoTentar = false) {
  $('conteudo-pedido').hidden = true;
  $('titulo-pedido').textContent = titulo;
  $('subtitulo-pedido').textContent = '';
  $('etiqueta-status').hidden = true;
  const caixa = $('estado-pagina');
  caixa.hidden = false;
  caixa.innerHTML = tipo === 'carregando'
    ? `<div class="d-flex align-items-center gap-2 texto-suave"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>${esc(texto)}</div>`
    : `<div class="aviso-estado aviso-estado--${tipo}" role="alert">
        <p class="aviso-estado__titulo">${esc(titulo)}</p>
        <p class="mb-3">${esc(texto)}</p>
        <div class="d-flex flex-wrap gap-2">
          ${comBotaoTentar ? '<button type="button" class="btn btn-contorno-azul" id="botao-tentar">Tentar de novo</button>' : ''}
          <a class="btn btn-contorno-azul" href="painel.html">Ir para o painel da loja</a>
        </div>
      </div>`;
  $('botao-tentar')?.addEventListener('click', carregarPedido);
}

// ---------- Conversa ----------

function ehMinha(m) {
  if (typeof m.propria === 'boolean') return m.propria;
  return estado.idUsuario != null && m.idRemetente === estado.idUsuario;
}

function renderizarMensagens({ rolar = true } = {}) {
  const caixa = $('mensagens');
  if (!estado.mensagens.length) {
    caixa.innerHTML = '<p class="texto-suave small mb-0">Nenhuma mensagem ainda. Combine aqui o horário de retirada, o pagamento ou a entrega.</p>';
  } else {
    caixa.innerHTML = estado.mensagens.map((m) => {
      const minha = ehMinha(m);
      const autor = minha ? 'Você' : (m.nomeRemetente || nomeComprador());
      return `<div class="balao${minha ? ' balao--minha' : ''}">
          <p class="balao__texto">${esc(m.conteudo)}</p>
          <p class="balao__meta">${esc(autor)} • <time datetime="${esc(m.dataEnvio)}">${esc(horaMensagem(m.dataEnvio))}</time></p>
        </div>`;
    }).join('');
  }
  if (rolar) caixa.scrollTop = caixa.scrollHeight;

  const link = $('link-conversa-completa');
  link.hidden = !estado.pedido?.idConversa;
  if (estado.pedido?.idConversa) link.href = `../conta/conversas.html?id=${encodeURIComponent(estado.pedido.idConversa)}`;
}

async function carregarMensagens() {
  const idConversa = estado.pedido?.idConversa;
  if (!idConversa) {
    estado.mensagens = [];
    renderizarMensagens();
    return;
  }
  $('mensagens').innerHTML = '<p class="texto-suave small mb-0"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Carregando conversa…</p>';
  try {
    const resposta = await listarMensagens(idConversa);
    estado.mensagens = resposta.itens || [];
    renderizarMensagens();
    marcarConversaComoLida(idConversa).catch(() => {});
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    $('mensagens').innerHTML = `<p class="small mb-0 texto-erro">Não foi possível carregar a conversa.
      <button type="button" class="btn btn-link btn-sm p-0 align-baseline texto-erro fw-semibold" id="botao-tentar-conversa">Tentar de novo</button></p>`;
    $('botao-tentar-conversa').addEventListener('click', carregarMensagens);
  }
}

async function enviarMensagemChat(evento) {
  evento.preventDefault();
  const campo = $('campo-mensagem');
  const erroCampo = $('erro-mensagem');
  const conteudo = campo.value.trim();
  erroCampo.hidden = true;
  campo.classList.remove('is-invalid');
  if (!conteudo) {
    erroCampo.textContent = 'Escreva uma mensagem antes de enviar.';
    erroCampo.hidden = false;
    campo.classList.add('is-invalid');
    campo.focus();
    return;
  }

  const botao = $('botao-enviar-mensagem');
  const textoBotao = botao.innerHTML;
  botao.disabled = true;
  campo.disabled = true;
  botao.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enviando…';
  try {
    if (!estado.pedido.idConversa) {
      const conversa = await abrirConversaDoPedido(estado.pedido.idPedido);
      estado.pedido.idConversa = conversa.idConversa;
    }
    const nova = await enviarMensagem(estado.pedido.idConversa, conteudo);
    estado.mensagens.push({ propria: true, ...nova });
    campo.value = '';
    atualizarContadorMensagem();
    renderizarMensagens();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    erroCampo.textContent = erro?.mensagem || 'Não foi possível enviar. Tente novamente.';
    erroCampo.hidden = false;
  } finally {
    botao.disabled = false;
    campo.disabled = false;
    botao.innerHTML = textoBotao;
    campo.focus();
  }
}

function atualizarContadorMensagem() {
  const campo = $('campo-mensagem');
  $('contador-mensagem').textContent = campo.value.length > campo.maxLength * 0.8
    ? `${campo.value.length}/${campo.maxLength}` : '';
}

// ---------- Ações do pedido ----------

function aplicarPedido(novo) {
  // A API devolve o pedido atualizado; se não devolver, recarrega
  if (novo && novo.idPedido) {
    estado.pedido = { ...estado.pedido, ...novo };
    renderizarPedido();
    return Promise.resolve();
  }
  return recarregarPedido();
}

function aceitar() {
  executar($('botao-aceitar'), 'Aceitando…', async () => {
    await aplicarPedido(await aceitarPedido(estado.idPedido));
    const estoque = (estado.pedido.itens || []).length === 1 && estado.pedido.itens[0].estoqueAtual != null
      ? ` Estoque atual: ${unidades(estado.pedido.itens[0].estoqueAtual)}.` : '';
    mostrarAviso('sucesso', 'Pedido aceito', `${nomeComprador()} recebeu o aviso.${estoque}`);
  }, 'Não foi possível aceitar o pedido');
}

function abrirRecusa() {
  estado.modoRecusa = true;
  esconderAviso();
  renderizarAcoes();
  $('motivo-recusa').focus();
}

function voltarDaRecusa() {
  estado.modoRecusa = false;
  limparErrosRecusa();
  renderizarAcoes();
  $('botao-recusar').focus();
}

function limparErrosRecusa() {
  ['motivo-recusa', 'mensagem-recusa'].forEach((id) => $(id).classList.remove('is-invalid'));
  $('erro-motivo').hidden = true;
  $('erro-mensagem-recusa').hidden = true;
}

function confirmarRecusa(evento) {
  evento.preventDefault();
  limparErrosRecusa();
  const motivo = $('motivo-recusa').value;
  const mensagem = $('mensagem-recusa').value.trim();

  if (!motivo) {
    $('motivo-recusa').classList.add('is-invalid');
    $('erro-motivo').hidden = false;
    $('motivo-recusa').focus();
    return;
  }
  if (motivo === 'Outro motivo' && !mensagem) {
    $('mensagem-recusa').classList.add('is-invalid');
    $('erro-mensagem-recusa').hidden = false;
    $('mensagem-recusa').focus();
    return;
  }

  // Em "Outro motivo", o texto do vendedor é o próprio motivo (pedido.motivo_recusa, até 255)
  const motivoFinal = motivo === 'Outro motivo' ? mensagem.slice(0, 255) : motivo;

  executar($('botao-confirmar-recusa'), 'Recusando…', async () => {
    await aplicarPedido(await recusarPedido(estado.idPedido, { motivo: motivoFinal, mensagem }));
    estado.modoRecusa = false;
    renderizarAcoes();
    mostrarAviso('alerta', 'Pedido recusado', 'Motivo enviado ao comprador. A quantidade voltou ao estoque.');
  }, 'Não foi possível recusar o pedido');
}

function emPreparacao() {
  executar($('botao-em-preparacao'), 'Salvando…', async () => {
    await aplicarPedido(await marcarEmPreparacao(estado.idPedido));
    mostrarAviso('sucesso', 'Pedido em preparação', `${nomeComprador()} recebeu o aviso.`);
  }, 'Não foi possível marcar em preparação');
}

function prontoRetirada() {
  executar($('botao-pronto-retirada'), 'Salvando…', async () => {
    await aplicarPedido(await marcarProntoRetirada(estado.idPedido));
    mostrarAviso('sucesso', 'Pronto para retirada', `${nomeComprador()} recebeu o aviso. Confira o código de retirada quando ele chegar ao balcão.`);
  }, 'Não foi possível marcar como pronto para retirada');
}

function confirmarCodigo(evento) {
  evento.preventDefault();
  const campo = $('codigo-retirada');
  const erroCodigo = $('erro-codigo');
  erroCodigo.hidden = true;
  campo.classList.remove('is-invalid');
  const codigo = campo.value.trim().toUpperCase();

  if (!normalizarCodigo(codigo)) {
    erroCodigo.innerHTML = '<p class="aviso-estado__titulo">Informe o código</p><p class="mb-0">Digite o código que o comprador mostrar no balcão.</p>';
    erroCodigo.hidden = false;
    campo.classList.add('is-invalid');
    campo.focus();
    return;
  }

  executar($('botao-confirmar-retirada'), 'Conferindo…', async () => {
    try {
      await aplicarPedido(await confirmarRetirada(estado.idPedido, codigo));
    } catch (erro) {
      const codigoErrado = erro?.status === 422 || erro?.status === 400 || erro?.erro === 'CODIGO_RETIRADA_INVALIDO';
      if (!codigoErrado || erro?.status === 409) throw erro;
      erroCodigo.innerHTML = '<p class="aviso-estado__titulo">Código não confere</p><p class="mb-0">Confira com o comprador e digite novamente.</p>';
      erroCodigo.hidden = false;
      campo.classList.add('is-invalid');
      campo.disabled = false;
      campo.select();
      throw { tratado: true };
    }
    campo.value = '';
    mostrarAviso('sucesso', 'Retirada confirmada', `Código ${codigo} confere. O pedido foi concluído.`);
  }, 'Não foi possível confirmar a retirada');
}

function enviar(evento) {
  evento.preventDefault();
  const modalidade = $('modalidade-envio').value;
  const transportadora = $('transportadora').value.trim();
  const codigoRastreio = $('codigo-rastreio').value.trim();
  $('erro-transportadora').hidden = true;
  $('transportadora').classList.remove('is-invalid');

  if (modalidade === 'TRANSPORTADORA' && !transportadora) {
    $('erro-transportadora').hidden = false;
    $('transportadora').classList.add('is-invalid');
    $('transportadora').focus();
    return;
  }

  const dados = { modalidade };
  if (transportadora) dados.transportadora = transportadora;
  if (codigoRastreio) dados.codigoRastreio = codigoRastreio;

  executar($('botao-enviar-pedido'), 'Salvando…', async () => {
    await aplicarPedido(await registrarEnvio(estado.idPedido, dados));
    mostrarAviso('sucesso', 'Pedido enviado', `${nomeComprador()} recebeu o aviso${codigoRastreio ? ' com o código de rastreio' : ''}.`);
  }, 'Não foi possível registrar o envio');
}

function concluir() {
  executar($('botao-concluir-entrega'), 'Concluindo…', async () => {
    await aplicarPedido(await concluirEntrega(estado.idPedido));
    mostrarAviso('sucesso', 'Entrega confirmada', 'O pedido foi concluído.');
  }, 'Não foi possível confirmar a entrega');
}

// ---------- Carregamento ----------

function irParaLogin() {
  const voltar = window.location.pathname + window.location.search;
  window.location.href = `../conta/login.html?voltar=${encodeURIComponent(voltar)}`;
}

async function recarregarPedido() {
  try {
    estado.pedido = await obterPedido(estado.idPedido);
    renderizarPedido();
  } catch (erro) {
    if (erro?.status === 401) irParaLogin();
  }
}

async function carregarPedido() {
  renderizarEstado('carregando', 'Pedido', 'Carregando pedido…');
  try {
    estado.pedido = await obterPedido(estado.idPedido);
    $('etiqueta-status').hidden = false;
    renderizarPedido();
    carregarMensagens();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    if (erro?.status === 404 || erro?.status === 403) {
      renderizarEstado('alerta', 'Pedido não encontrado', 'Este pedido não existe ou não é da sua loja. Confira o link ou abra o pedido pelo painel.');
    } else {
      renderizarEstado('erro', 'Não foi possível carregar o pedido', erro?.mensagem || ERRO_GENERICO, true);
    }
  }
}

async function aplicarUsuario() {
  const usuario = await window.Cabecalho?.pronto;
  if (!usuario) {
    // Com a API de verdade, a tela é só para quem está logado
    if (window.Cabecalho && !USAR_SIMULACAO) irParaLogin();
    return;
  }
  estado.idUsuario = usuario.idUsuario ?? usuario.id ?? null;
  if (estado.mensagens.length) renderizarMensagens({ rolar: false });
}

function ligarEventos() {
  $('botao-aceitar').addEventListener('click', aceitar);
  $('botao-recusar').addEventListener('click', abrirRecusa);
  $('botao-voltar-recusa').addEventListener('click', voltarDaRecusa);
  $('form-recusa').addEventListener('submit', confirmarRecusa);
  $('botao-em-preparacao').addEventListener('click', emPreparacao);
  $('botao-pronto-retirada').addEventListener('click', prontoRetirada);
  $('form-retirada').addEventListener('submit', confirmarCodigo);
  $('form-envio').addEventListener('submit', enviar);
  $('botao-concluir-entrega').addEventListener('click', concluir);
  $('form-mensagem').addEventListener('submit', enviarMensagemChat);
  $('campo-mensagem').addEventListener('input', atualizarContadorMensagem);

  // Código de retirada em maiúsculas enquanto digita
  $('codigo-retirada').addEventListener('input', (e) => {
    const campo = e.target;
    const pos = campo.selectionStart;
    campo.value = campo.value.toUpperCase();
    campo.setSelectionRange(pos, pos);
  });

  // Transportadora só faz sentido para a modalidade TRANSPORTADORA
  $('modalidade-envio').addEventListener('change', () => {
    $('grupo-transportadora').hidden = $('modalidade-envio').value !== 'TRANSPORTADORA';
  });

  $('mensagem-recusa').addEventListener('input', () => {
    const c = $('mensagem-recusa');
    $('contador-recusa').textContent = `${c.value.length}/${c.maxLength}`;
  });
}

function iniciar() {
  ligarEventos();
  aplicarUsuario();

  estado.idPedido = new URLSearchParams(window.location.search).get('id');
  if (!estado.idPedido) {
    renderizarEstado('alerta', 'Nenhum pedido selecionado', 'Abra um pedido pelo painel da loja ou pela notificação de novo pedido.');
    return;
  }
  $('migalha-codigo').textContent = `Pedido ${estado.idPedido}`;
  carregarPedido();
}

iniciar();