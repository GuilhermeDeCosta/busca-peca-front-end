// Tela: admin/disputas.html — Administração • Disputas (?disputa=12 abre uma disputa)
// Acesso: papel interno com a permissão MODERAR_DISPUTA. Caso de uso: BP1-35. Fluxo E.
// ADR-006 (só papéis internos com permissão de mediação), ADR-008 (reembolso combinado entre as partes), ADR-013 (auditoria).
// Rotas (Documentação do Back-end v2, seção 5.12; as marcadas "nova" ainda não estão na documentação):
//   GET   /api/admin/disputas?status=             fila
//   GET   /api/admin/disputas/resumo              cartões do topo (nova)
//   GET   /api/admin/disputas/{id}                detalhe, evidências e conversa (nova)
//   PATCH /api/admin/disputas/{id}/decisao        registra a decisão
//   POST  /api/admin/disputas/{id}/solicitacoes   pede mais informações às partes (nova)
import {
  listarDisputas, obterResumoDisputas, obterDisputa, registrarDecisaoDisputa, pedirInformacoesDisputa, USAR_SIMULACAO,
} from '../../services/admin.js';
import { formatarMoeda } from '../../utils/formatacao.js';

const FUSO = 'America/Sao_Paulo';
const MIN_JUSTIFICATIVA = 20;
const MIN_PEDIDO_INFO = 10;
const DIAS_UTEIS_DEVOLUCAO = 5;

const MOTIVOS = {
  PECA_ERRADA: 'Peça diferente do anúncio', DEFEITO: 'Defeito após instalação', AVARIA: 'Peça avariada',
  NAO_ENTREGUE: 'Pedido não entregue', OUTRO: 'Outro motivo',
};

const RESULTADOS = {
  FAVORAVEL_COMPRADOR: { rotulo: 'Favorável ao comprador', detalhe: 'devolução e reembolso combinados', prazo: 'Prazo para devolução' },
  FAVORAVEL_LOJA: { rotulo: 'Favorável à loja', detalhe: 'encerrar sem devolução', prazo: null },
  ACORDO_PARCIAL: { rotulo: 'Acordo parcial', detalhe: 'troca da peça', prazo: 'Prazo para a troca' },
};

const TEXTO_SEM_DISPUTA = '<p class="small texto-suave mb-0">Escolha uma disputa na fila para ver os detalhes e registrar a decisão.</p>';

const estado = {
  disputas: [],
  filtro: '',
  carregandoLista: true,
  idSelecionada: null,
  disputa: null,
  requisicaoDetalhe: 0,
  modo: 'decidir',        // decidir | confirmar | informacoes
  ocupado: false,
};

const $ = (id) => document.getElementById(id);

// ---------- Utilitários ----------

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const chaveDia = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO });
const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO });
const fmtDiaMesHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const fmtNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const hojeIso = () => chaveDia.format(new Date());

function dataBr(valor) {
  if (!valor) return '—';
  // "AAAA-MM-DD" é uma data sem hora: não passa por Date para não mudar de dia com o fuso
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.split('-').reverse().join('/');
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : fmtData.format(d);
}

function diaEHora(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fmtDiaMesHora.format(d);
}

function somarDiasUteis(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  let faltam = dias;
  while (faltam > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) faltam -= 1;
  }
  return d.toISOString().slice(0, 10);
}

function diferencaDias(isoA, isoB) {
  return Math.round((new Date(`${isoA}T12:00:00`) - new Date(`${isoB}T12:00:00`)) / 86400000);
}

function codigoDisputa(d) {
  return d.codigo || `DP-${String(d.idDisputa).padStart(4, '0')}`;
}

function motivoDe(d) {
  return d.motivo || MOTIVOS[d.tipoProblema] || 'Outro motivo';
}

// Só abre links da API (https, ou caminho do mesmo site); nunca javascript:
function urlSegura(url) {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.href);
    if (u.protocol === 'https:' || u.origin === window.location.origin || u.hostname === 'localhost') return u.href;
  } catch (e) { /* inválida */ }
  return null;
}

function irParaLogin() {
  window.location.href = `../conta/login.html?voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

function mensagemDeErro(erro, padrao) {
  if (erro?.status === 403) return 'Sua conta não tem a permissão para mediar disputas (MODERAR_DISPUTA).';
  return erro?.mensagem || padrao;
}

function mostrarAcessoRestrito(texto) {
  $('conteudo-admin').hidden = true;
  const caixa = $('acesso-restrito');
  caixa.hidden = false;
  caixa.querySelector('p:last-child').textContent = texto;
}

// "Aberta • vence hoje", "Em análise", "Resolvida"…
function situacao(d) {
  if (d.status === 'ENCERRADA') return { rotulo: 'Resolvida', classe: 'etiqueta--sucesso' };
  if (d.status === 'EM_MEDIACAO') return { rotulo: 'Em análise', classe: 'etiqueta--info' };
  if (!d.prazoMediacao) return { rotulo: 'Aberta', classe: 'etiqueta--alerta' };
  const dias = diferencaDias(String(d.prazoMediacao).slice(0, 10), hojeIso());
  if (dias < 0) return { rotulo: 'Aberta • prazo vencido', classe: 'etiqueta--erro' };
  if (dias === 0) return { rotulo: 'Aberta • vence hoje', classe: 'etiqueta--erro' };
  if (dias === 1) return { rotulo: 'Aberta • vence amanhã', classe: 'etiqueta--alerta' };
  return { rotulo: 'Aberta', classe: 'etiqueta--alerta' };
}

// ---------- Resumo ----------

async function carregarResumo() {
  let r;
  try {
    r = await obterResumoDisputas();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    // Sem a rota de resumo, conta pela fila carregada
    const hoje = hojeIso();
    r = {
      abertas: estado.disputas.filter((d) => d.status === 'ABERTA').length,
      vencendoHoje: estado.disputas.filter((d) => d.status !== 'ENCERRADA' && String(d.prazoMediacao).slice(0, 10) === hoje).length,
      emAnalise: estado.disputas.filter((d) => d.status === 'EM_MEDIACAO').length,
      resolvidasNoMes: estado.disputas.filter((d) => d.status === 'ENCERRADA' && String(d.dataFechamento || '').slice(0, 7) === hoje.slice(0, 7)).length,
      tempoMedioDias: null,
    };
  }
  $('resumo-abertas').textContent = fmtNumero.format(r.abertas ?? 0);
  $('resumo-abertas-info').innerHTML = r.vencendoHoje
    ? `${esc(r.vencendoHoje)} com <span class="texto-erro">prazo vencendo hoje</span>`
    : 'Nenhum prazo vencendo hoje';
  $('resumo-analise').textContent = fmtNumero.format(r.emAnalise ?? 0);
  $('resumo-resolvidas').textContent = fmtNumero.format(r.resolvidasNoMes ?? 0);
  $('resumo-resolvidas-info').textContent = r.tempoMedioDias != null
    ? `Tempo médio: ${fmtNumero.format(r.tempoMedioDias)} ${r.tempoMedioDias === 1 ? 'dia' : 'dias'}` : '';
}

// ---------- Fila ----------

function ordenar(lista) {
  const peso = { ABERTA: 0, EM_MEDIACAO: 0, ENCERRADA: 1 };
  return [...lista].sort((a, b) => (peso[a.status] ?? 0) - (peso[b.status] ?? 0)
    || (a.status === 'ENCERRADA'
      ? String(b.dataFechamento || '').localeCompare(String(a.dataFechamento || ''))
      : String(a.prazoMediacao || '9').localeCompare(String(b.prazoMediacao || '9'))
        || String(a.dataAbertura).localeCompare(String(b.dataAbertura))));
}

function renderizarFila() {
  const corpo = $('corpo-disputas');
  $('cartao-fila').setAttribute('aria-busy', String(estado.carregandoLista));
  if (estado.carregandoLista) {
    corpo.innerHTML = Array.from({ length: 4 }, () => `<tr class="placeholder-glow" aria-hidden="true">${
      '<td><span class="placeholder rounded col-9"></span></td>'.repeat(6)}</tr>`).join('');
    return;
  }
  if (!estado.disputas.length) {
    corpo.innerHTML = `<tr><td colspan="6" class="text-center texto-suave py-4">${estado.filtro
      ? 'Nenhuma disputa com este status.' : 'Nenhuma disputa aberta. Quando comprador e loja não chegarem a um acordo, ela aparece aqui.'}</td></tr>`;
    return;
  }
  corpo.innerHTML = estado.disputas.map((d) => {
    const st = situacao(d);
    const sel = String(d.idDisputa) === String(estado.idSelecionada);
    return `<tr class="linha-disputa${sel ? ' linha--selecionada' : ''}" data-id="${esc(d.idDisputa)}">
        <td><button type="button" class="link-acao fw-medium" data-abrir="${esc(d.idDisputa)}"${sel ? ' aria-current="true"' : ''}>${esc(codigoDisputa(d))}</button></td>
        <td>${esc(d.codigoPedido || '—')}</td>
        <td>${esc(d.comprador)} × ${esc(d.loja)}</td>
        <td>${esc(motivoDe(d))}</td>
        <td>${esc(dataBr(d.dataAbertura))}</td>
        <td><span class="etiqueta ${st.classe}">${esc(st.rotulo)}</span></td>
      </tr>`;
  }).join('');
}

async function carregarFila() {
  estado.carregandoLista = !estado.disputas.length;
  $('erro-fila').hidden = true;
  renderizarFila();
  try {
    estado.disputas = ordenar(await listarDisputas({ status: estado.filtro }));
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    if (erro?.status === 403) return mostrarAcessoRestrito('Sua conta não tem a permissão para mediar disputas (MODERAR_DISPUTA). Peça a um administrador geral.');
    $('erro-fila-texto').textContent = mensagemDeErro(erro, 'Não foi possível carregar as disputas. Verifique sua conexão e tente de novo.');
    $('erro-fila').hidden = false;
  } finally {
    estado.carregandoLista = false;
    renderizarFila();
  }
}

// ---------- Detalhe ----------

function linhaDado(rotulo, valorHtml) {
  return `<div class="linha-dado"><dt>${esc(rotulo)}</dt><dd>${valorHtml}</dd></div>`;
}

function iconeArquivo(e) {
  const tipo = String(e.tipo || e.nome || '').toLowerCase();
  if (/image|\.(jpe?g|png|webp|gif)$/.test(tipo)) return 'bi-image';
  if (/pdf/.test(tipo)) return 'bi-file-earmark-pdf';
  if (/video|\.(mp4|mov)$/.test(tipo)) return 'bi-camera-video';
  return 'bi-file-earmark';
}

function renderizarDetalhe() {
  const d = estado.disputa;
  $('detalhe-vazio').hidden = Boolean(estado.idSelecionada);
  $('detalhe').hidden = !estado.idSelecionada;
  $('cartao-conversa').hidden = !d;
  $('cartao-decisao').hidden = !estado.idSelecionada;
  if (!estado.idSelecionada) return;

  if (!d) {
    $('titulo-detalhe').textContent = 'Disputa';
    $('sub-detalhe').innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Carregando a disputa…';
    $('dados-detalhe').innerHTML = '';
    $('bloco-evidencias').hidden = true;
    $('bloco-solicitacoes').hidden = true;
    $('decisao-conteudo').hidden = true;
    return;
  }

  $('titulo-detalhe').textContent = `${codigoDisputa(d)} • ${motivoDe(d)}`;
  const item = d.pedido?.itens?.[0];
  $('sub-detalhe').textContent = [
    d.codigoPedido && `Pedido ${d.codigoPedido}`,
    item?.titulo && (d.pedido.itens.length > 1 ? `${item.titulo} e mais ${d.pedido.itens.length - 1}` : item.titulo),
    d.pedido?.valorTotal != null && formatarMoeda(d.pedido.valorTotal),
    d.pedido?.dataConclusao ? `concluído em ${dataBr(d.pedido.dataConclusao)}` : null,
  ].filter(Boolean).join(' • ');

  const dados = [
    linhaDado('Comprador', esc(d.comprador + (d.compradorContato ? ` (${d.compradorContato})` : ''))),
    linhaDado('Loja', esc(d.loja)),
    linhaDado('Relato do comprador', d.relato ? `“${esc(d.relato)}”` : '<span class="texto-suave">Sem relato</span>'),
    linhaDado('Resposta da loja', d.respostaLoja ? `“${esc(d.respostaLoja)}”` : '<span class="texto-suave">A loja ainda não respondeu</span>'),
  ];
  if (d.status !== 'ENCERRADA' && d.prazoMediacao) {
    const st = situacao(d);
    dados.push(linhaDado('Prazo da mediação', `${esc(dataBr(String(d.prazoMediacao).slice(0, 10)))}${st.classe === 'etiqueta--erro' ? ` <span class="texto-erro">(${esc(st.rotulo.split(' • ')[1])})</span>` : ''}`));
  }
  $('dados-detalhe').innerHTML = dados.join('');

  const evidencias = d.evidencias || [];
  $('bloco-evidencias').hidden = false;
  $('lista-evidencias').innerHTML = evidencias.length ? evidencias.map((e) => {
    const url = urlSegura(e.url);
    const conteudo = `<i class="bi ${iconeArquivo(e)} evidencia__icone" aria-hidden="true"></i>
      <span class="evidencia__rotulo">Arquivo anexado</span><span class="evidencia__nome">${esc(e.nome || 'arquivo')}</span>`;
    return url
      ? `<a class="evidencia" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${conteudo}<span class="visually-hidden"> (abre em nova aba)</span></a>`
      : `<div class="evidencia evidencia--sem-link" title="Arquivo sem endereço para abrir">${conteudo}</div>`;
  }).join('') : '<p class="small texto-suave mb-0">Nenhum arquivo anexado.</p>';

  const sol = d.solicitacoes || [];
  $('bloco-solicitacoes').hidden = !sol.length;
  $('lista-solicitacoes').innerHTML = sol.map((s) => `
    <li><span class="texto-suave">${esc(diaEHora(s.data))}${s.moderador ? ` • ${esc(s.moderador)}` : ''} • para ${esc((s.destinatarios || []).map((x) => (x === 'LOJA' ? 'a loja' : 'o comprador')).join(' e '))}</span>
      <br>“${esc(s.mensagem)}”</li>`).join('');

  renderizarConversa();
  renderizarDecisao();
}

function renderizarConversa() {
  const mensagens = estado.disputa?.mensagens || [];
  $('lista-mensagens').innerHTML = mensagens.length ? mensagens.map((m) => `
    <li class="mensagem-historico">
      <p class="mensagem-historico__meta">${esc(m.autor || 'Participante')} • <time datetime="${esc(m.dataEnvio)}">${esc(diaEHora(m.dataEnvio))}</time></p>
      <p class="mensagem-historico__texto">${esc(m.conteudo)}</p>
    </li>`).join('') : '<li class="small texto-suave">Não houve conversa entre as partes neste pedido.</li>';
}

// ---------- Decisão ----------

function resultadoEscolhido() {
  return document.querySelector('[name="resultado"]:checked')?.value || '';
}

function renderizarDecisao() {
  const d = estado.disputa;
  $('decisao-conteudo').hidden = false;
  const encerrada = d.status === 'ENCERRADA';
  $('form-decisao').hidden = encerrada || estado.modo === 'informacoes';
  $('form-informacoes').hidden = encerrada || estado.modo !== 'informacoes';
  $('decisao-registrada').hidden = !encerrada;

  if (encerrada) {
    const dec = d.decisao || {};
    const r = RESULTADOS[dec.resultado];
    $('decisao-registrada').innerHTML = `
      <p class="small texto-suave mb-3">Decisão registrada${dec.data ? ` em ${esc(dataBr(dec.data))}` : ''}${dec.moderador ? ` por ${esc(dec.moderador)}` : ''}.</p>
      <dl class="lista-dados mb-0">
        ${linhaDado('Resultado', r ? `<strong>${esc(r.rotulo)}</strong> • ${esc(r.detalhe)}` : esc(dec.resultado || '—'))}
        ${linhaDado('Justificativa', dec.justificativa ? `“${esc(dec.justificativa)}”` : '—')}
        ${dec.prazoDevolucao ? linhaDado(r?.prazo || 'Prazo', esc(dataBr(dec.prazoDevolucao))) : ''}
        ${dec.pausarAnuncio && d.anuncio ? linhaDado('Anúncio', `${esc(d.anuncio.sku || '')} pausado até a correção`) : ''}
      </dl>`;
    return;
  }

  const resultado = resultadoEscolhido();
  const info = RESULTADOS[resultado];
  $('grupo-prazo').hidden = !info?.prazo;
  if (info?.prazo) $('rotulo-prazo').textContent = info.prazo;

  const anuncioAtivo = d.anuncio && d.anuncio.status !== 'PAUSADO';
  $('grupo-pausar').hidden = !anuncioAtivo;
  if (anuncioAtivo) $('rotulo-pausar').textContent = `Pausar o anúncio ${d.anuncio.sku || ''} até a correção da descrição`.replace('  ', ' ');

  $('botoes-decisao').hidden = estado.modo === 'confirmar';
  $('confirmacao-decisao').hidden = estado.modo !== 'confirmar';
  document.querySelectorAll('#form-decisao input, #form-decisao textarea').forEach((el) => { el.disabled = estado.modo === 'confirmar' || estado.ocupado; });
}

function prepararFormulario() {
  const d = estado.disputa;
  document.querySelectorAll('[name="resultado"]').forEach((r) => { r.checked = false; });
  $('justificativa').value = '';
  $('prazo-devolucao').value = somarDiasUteis(hojeIso(), DIAS_UTEIS_DEVOLUCAO);
  $('prazo-devolucao').min = hojeIso();
  // Peça diferente do anúncio: a sugestão é pausar o anúncio até a loja corrigir
  $('pausar-anuncio').checked = d?.tipoProblema === 'PECA_ERRADA';
  document.querySelectorAll('[name="destinatario"]').forEach((c) => { c.checked = true; });
  $('mensagem-info').value = '';
  limparErros();
  estado.modo = 'decidir';
  atualizarContador();
}

function limparErros() {
  ['justificativa', 'prazo-devolucao', 'mensagem-info'].forEach((id) => $(id).classList.remove('is-invalid'));
  ['erro-resultado', 'erro-prazo', 'erro-info', 'erro-destinatarios'].forEach((id) => { $(id).hidden = true; });
}

function mostrarResultado(tipo, titulo, texto) {
  const r = $('resultado-decisao');
  r.className = `aviso-estado aviso-estado--${tipo} mt-3`;
  r.innerHTML = `<p class="aviso-estado__titulo">${esc(titulo)}</p><p class="mb-0">${esc(texto)}</p>`;
  r.hidden = false;
}

function atualizarContador() {
  $('contador-justificativa').textContent = `${$('justificativa').value.length}/2000`;
}

function pedirConfirmacao(evento) {
  evento.preventDefault();
  limparErros();
  $('resultado-decisao').hidden = true;
  const resultado = resultadoEscolhido();
  const justificativa = $('justificativa').value.trim();
  const info = RESULTADOS[resultado];

  if (!resultado) {
    $('erro-resultado').hidden = false;
    document.querySelector('[name="resultado"]').focus();
    return;
  }
  if (justificativa.length < MIN_JUSTIFICATIVA) {
    $('justificativa').classList.add('is-invalid');
    mostrarResultado('erro', 'Justificativa obrigatória', justificativa
      ? `Explique a decisão com pelo menos ${MIN_JUSTIFICATIVA} caracteres; o texto vai para as duas partes.`
      : 'Escreva a justificativa antes de registrar a decisão.');
    $('justificativa').focus();
    return;
  }
  if (info.prazo && (!$('prazo-devolucao').value || $('prazo-devolucao').value < hojeIso())) {
    $('prazo-devolucao').classList.add('is-invalid');
    $('erro-prazo').hidden = false;
    $('prazo-devolucao').focus();
    return;
  }

  const d = estado.disputa;
  const pausar = !$('grupo-pausar').hidden && $('pausar-anuncio').checked;
  $('texto-decisao').textContent = [
    `Registrar decisão ${info.rotulo.toLowerCase()} (${info.detalhe}) em ${codigoDisputa(d)}?`,
    'A disputa será encerrada e comprador e loja recebem a justificativa.',
    info.prazo ? `${info.prazo}: ${dataBr($('prazo-devolucao').value)}.` : '',
    pausar ? `O anúncio ${d.anuncio.sku || ''} será pausado.` : '',
    'A decisão não pode ser alterada depois.',
  ].filter(Boolean).join(' ');
  estado.modo = 'confirmar';
  renderizarDecisao();
  $('botao-confirmar-decisao').focus();
}

async function registrarDecisao() {
  if (estado.ocupado) return;
  const d = estado.disputa;
  const resultado = resultadoEscolhido();
  const info = RESULTADOS[resultado];
  const dados = {
    resultado,
    justificativa: $('justificativa').value.trim(),
    prazoDevolucao: info.prazo ? $('prazo-devolucao').value : null,
    pausarAnuncio: !$('grupo-pausar').hidden && $('pausar-anuncio').checked,
  };
  estado.ocupado = true;
  const botao = $('botao-confirmar-decisao');
  botao.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Registrando…';
  $('botao-voltar-decisao').disabled = true;
  try {
    const atualizada = await registrarDecisaoDisputa(d.idDisputa, dados);
    estado.disputa = atualizada?.idDisputa ? { ...d, ...atualizada } : await obterDisputa(d.idDisputa);
    estado.modo = 'decidir';
    renderizarDetalhe();
    mostrarResultado('sucesso', 'Decisão registrada', `Comprador e loja foram notificados.${
      dados.prazoDevolucao ? ` ${info.prazo}: ${dataBr(dados.prazoDevolucao)}.` : ''}${dados.pausarAnuncio ? ` Anúncio ${d.anuncio?.sku || ''} pausado.` : ''}`);
    await carregarFila();
    carregarResumo();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    estado.modo = 'decidir';
    const campo = (erro?.campos || []).find((c) => c.campo === 'justificativa');
    if (campo) $('justificativa').classList.add('is-invalid');
    mostrarResultado('erro', campo ? 'Justificativa obrigatória' : 'Não foi possível registrar', campo?.mensagem || mensagemDeErro(erro, 'Verifique sua conexão e tente de novo.'));
    if (erro?.status === 409) recarregarDetalhe();
  } finally {
    estado.ocupado = false;
    botao.textContent = 'Confirmar decisão';
    $('botao-voltar-decisao').disabled = false;
    if (estado.disputa?.status !== 'ENCERRADA') renderizarDecisao();
  }
}

function abrirPedidoInformacoes() {
  limparErros();
  $('resultado-decisao').hidden = true;
  estado.modo = 'informacoes';
  renderizarDecisao();
  $('mensagem-info').focus();
}

async function enviarPedidoInformacoes(evento) {
  evento.preventDefault();
  if (estado.ocupado) return;
  limparErros();
  const destinatarios = [...document.querySelectorAll('[name="destinatario"]:checked')].map((c) => c.value);
  const mensagem = $('mensagem-info').value.trim();
  if (!destinatarios.length) { $('erro-destinatarios').hidden = false; document.querySelector('[name="destinatario"]').focus(); return; }
  if (mensagem.length < MIN_PEDIDO_INFO) {
    $('mensagem-info').classList.add('is-invalid');
    $('erro-info').hidden = false;
    $('mensagem-info').focus();
    return;
  }
  estado.ocupado = true;
  const botao = $('botao-enviar-info');
  botao.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enviando…';
  try {
    const d = estado.disputa;
    const atualizada = await pedirInformacoesDisputa(d.idDisputa, { destinatarios, mensagem });
    estado.disputa = atualizada?.idDisputa ? { ...d, ...atualizada } : await obterDisputa(d.idDisputa);
    $('mensagem-info').value = '';
    estado.modo = 'decidir';
    renderizarDetalhe();
    const quem = destinatarios.length > 1 ? 'Comprador e loja foram notificados'
      : destinatarios[0] === 'LOJA' ? 'A loja foi notificada' : 'O comprador foi notificado';
    mostrarResultado('sucesso', 'Pedido enviado', `${quem}. A disputa está em análise.`);
    await carregarFila();
    carregarResumo();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    mostrarResultado('erro', 'Não foi possível enviar', mensagemDeErro(erro, 'Verifique sua conexão e tente de novo.'));
  } finally {
    estado.ocupado = false;
    botao.textContent = 'Enviar pedido';
  }
}

// ---------- Seleção ----------

async function selecionar(idDisputa, { rolar = true } = {}) {
  estado.idSelecionada = String(idDisputa);
  estado.disputa = null;
  $('resultado-decisao').hidden = true;
  $('detalhe-vazio').innerHTML = TEXTO_SEM_DISPUTA;
  const url = new URL(window.location.href);
  url.searchParams.set('disputa', idDisputa);
  history.replaceState(null, '', url);
  renderizarFila();
  renderizarDetalhe();
  if (rolar) $('cartao-detalhe').scrollIntoView({ behavior: 'smooth', block: 'start' });

  const requisicao = ++estado.requisicaoDetalhe;
  try {
    const d = await obterDisputa(idDisputa);
    if (requisicao !== estado.requisicaoDetalhe) return;
    estado.disputa = d;
    prepararFormulario();
    renderizarDetalhe();
    if (rolar) $('titulo-detalhe').focus({ preventScroll: true });
  } catch (erro) {
    if (requisicao !== estado.requisicaoDetalhe) return;
    if (erro?.status === 401) return irParaLogin();
    estado.idSelecionada = null;
    renderizarFila();
    renderizarDetalhe();
    $('detalhe-vazio').innerHTML = `<p class="aviso aviso--erro mb-0">${esc(erro?.status === 404 ? 'Disputa não encontrada.' : mensagemDeErro(erro, 'Não foi possível abrir a disputa.'))}</p>`;
  }
}

async function recarregarDetalhe() {
  try {
    estado.disputa = await obterDisputa(estado.idSelecionada);
    renderizarDetalhe();
    carregarFila();
  } catch (e) { /* mantém o que está na tela */ }
}

// ---------- Eventos ----------

function ligarEventos() {
  $('corpo-disputas').addEventListener('click', (e) => {
    if (window.getSelection()?.toString()) return; // não abre ao selecionar texto
    const linha = e.target.closest('tr[data-id]');
    if (linha) selecionar(linha.dataset.id);
  });
  $('filtro-status').addEventListener('change', async (e) => {
    estado.filtro = e.target.value;
    estado.disputas = [];
    await carregarFila();
  });
  $('botao-tentar-fila').addEventListener('click', carregarFila);

  document.querySelectorAll('[name="resultado"]').forEach((r) => r.addEventListener('change', () => {
    $('erro-resultado').hidden = true;
    renderizarDecisao();
  }));
  $('justificativa').addEventListener('input', () => {
    $('justificativa').classList.remove('is-invalid');
    $('resultado-decisao').hidden = true;
    atualizarContador();
  });
  $('prazo-devolucao').addEventListener('change', () => { $('prazo-devolucao').classList.remove('is-invalid'); $('erro-prazo').hidden = true; });
  $('form-decisao').addEventListener('submit', pedirConfirmacao);
  $('botao-confirmar-decisao').addEventListener('click', registrarDecisao);
  $('botao-voltar-decisao').addEventListener('click', () => { estado.modo = 'decidir'; renderizarDecisao(); $('botao-registrar').focus(); });

  $('botao-pedir-info').addEventListener('click', abrirPedidoInformacoes);
  $('form-informacoes').addEventListener('submit', enviarPedidoInformacoes);
  $('botao-voltar-info').addEventListener('click', () => { estado.modo = 'decidir'; limparErros(); renderizarDecisao(); $('botao-pedir-info').focus(); });
  $('mensagem-info').addEventListener('input', () => { $('mensagem-info').classList.remove('is-invalid'); $('erro-info').hidden = true; });
  document.querySelectorAll('[name="destinatario"]').forEach((c) => c.addEventListener('change', () => { $('erro-destinatarios').hidden = true; }));
}

// ---------- Início ----------

async function verificarAcesso() {
  const cabecalho = window.Cabecalho;
  let usuario = await cabecalho?.pronto;
  if (!usuario && USAR_SIMULACAO) {
    usuario = { idUsuario: 100, nome: 'Equipe Busca Peça', papeis: ['COMPRADOR', 'ADMINISTRADOR'], administrador: true };
    cabecalho?.definirUsuario(usuario);
  }
  if (!usuario) { irParaLogin(); return false; }
  if (cabecalho && !cabecalho.ehAdmin(usuario)) {
    mostrarAcessoRestrito('Esta área é só para a equipe interna do Busca Peça. Se você deveria ter acesso, peça a um administrador geral.');
    return false;
  }
  return true;
}

async function iniciar() {
  ligarEventos();
  renderizarFila();
  renderizarDetalhe();
  if (!(await verificarAcesso())) return;

  await carregarFila();
  if (!$('acesso-restrito').hidden) return;
  carregarResumo();

  // Abre a pedida no link ou a primeira da fila que ainda precisa de decisão, como no protótipo
  const pedida = new URLSearchParams(window.location.search).get('disputa');
  const primeira = estado.disputas.find((d) => d.status !== 'ENCERRADA') || estado.disputas[0];
  if (pedida) selecionar(pedida, { rolar: false });
  else if (primeira) selecionar(primeira.idDisputa, { rolar: false });
}

iniciar();