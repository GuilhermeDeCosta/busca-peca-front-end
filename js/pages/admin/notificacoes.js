// Tela: admin/notificacoes.html — Administração • Notificações gerais
// Acesso: papel interno com a permissão ENVIAR_NOTIFICACOES. Caso de uso: BP1-51. Fluxo E.
// Rotas (Documentação do Back-end v2, seção 5.12; as marcadas "nova" ainda não estão na documentação):
//   POST   /api/admin/notificacoes                envia, agenda ou salva rascunho
//   GET    /api/admin/notificacoes                enviados e agendados (nova)
//   PUT    /api/admin/notificacoes/{id}           altera rascunho ou agendado (nova)
//   DELETE /api/admin/notificacoes/{id}           exclui rascunho ou cancela agendado (nova)
//   GET    /api/admin/notificacoes/alcance        quantas contas o público alcança (nova)
//   GET/PUT /api/admin/notificacoes/alertas       alertas automáticos (nova)
import {
  listarAvisos, obterAlcance, criarAviso, atualizarAviso, excluirAviso,
  obterAlertasAutomaticos, salvarAlertasAutomaticos, USAR_SIMULACAO,
} from '../../services/admin.js';

const FUSO = 'America/Sao_Paulo';
const ANTECEDENCIA_MINIMA_MIN = 5;   // agendamento precisa estar pelo menos 5 min no futuro
const LIMITE_PREVIA = 90;            // a prévia corta a mensagem como o sino do usuário

const PUBLICOS = {
  TODOS: { rotulo: 'Todos', alcance: (n) => `${n} ${n === '1' ? 'conta ativa receberá' : 'contas ativas receberão'} este aviso.` },
  VENDEDORES: { rotulo: 'Todos os vendedores', alcance: (n) => `${n} ${n === '1' ? 'loja ativa receberá' : 'lojas ativas receberão'} este aviso.` },
  COMPRADORES: { rotulo: 'Compradores (sem loja)', alcance: (n) => `${n} ${n === '1' ? 'comprador receberá' : 'compradores receberão'} este aviso.` },
  VENDEDORES_SEM_ANUNCIOS: { rotulo: 'Vendedores sem anúncios', alcance: (n) => `${n} ${n === '1' ? 'vendedor sem anúncios receberá' : 'vendedores sem anúncios receberão'} este aviso.` },
};

const CANAIS = { SISTEMA: 'Sistema', EMAIL: 'e-mail' };

const STATUS = {
  AGENDADO: { rotulo: 'Agendado', classe: 'etiqueta--alerta' },
  ENVIADO: { rotulo: 'Enviado', classe: 'etiqueta--sucesso' },
  RASCUNHO: { rotulo: 'Rascunho', classe: 'etiqueta--neutra' },
  CANCELADO: { rotulo: 'Cancelado', classe: 'etiqueta--erro' },
};

const estado = {
  avisos: [],
  carregandoAvisos: true,
  alcance: {},              // cache por público
  idEditando: null,
  avisoEditando: null,
  idCancelando: null,       // confirmação na tabela
  confirmandoEnvio: false,
  ocupado: false,
  alertasSalvos: null,
};

const $ = (id) => document.getElementById(id);

// ---------- Utilitários ----------

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const fmtNumero = new Intl.NumberFormat('pt-BR');
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const fmtDiaMesHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: FUSO });
const fmtPartes = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FUSO });

function dataHora(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : fmtDataHora.format(d).replace(', ', ' ');
}

// { data: 'AAAA-MM-DD', hora: 'HH:MM' } no fuso de Brasília
function partesBrasilia(date) {
  const p = Object.fromEntries(fmtPartes.formatToParts(date).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

// "2026-11-25" + "09:00" → ISO com o fuso de Brasília (o Brasil não tem horário de verão desde 2019)
function isoBrasilia(data, hora) {
  return data && hora ? `${data}T${hora}:00-03:00` : null;
}

function irParaLogin() {
  window.location.href = `../conta/login.html?voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

function mensagemDeErro(erro, padrao) {
  if (erro?.status === 403) return 'Sua conta não tem a permissão para enviar notificações (ENVIAR_NOTIFICACOES).';
  return erro?.mensagem || padrao;
}

function mostrarAcessoRestrito(texto) {
  $('conteudo-admin').hidden = true;
  const caixa = $('acesso-restrito');
  caixa.hidden = false;
  caixa.querySelector('p:last-child').textContent = texto;
}

// Link do aviso: caminho do front (pages/...) ou https. O sino resolve a partir da raiz do front.
function linkValido(link) {
  if (!link) return true;
  if (/^https:\/\/[^\s]+\.[^\s]+$/i.test(link)) return true;
  return /^\/?pages\/[\w\-/.]+\.html(\?[\w\-=&%.]*)?(#[\w-]*)?$/.test(link);
}

function normalizarLink(link) {
  return link.startsWith('/pages/') ? link.slice(1) : link;
}

// ---------- Formulário ----------

function envioAgendado() {
  return $('envio-agendado').checked;
}

function dadosDoFormulario({ rascunho = false } = {}) {
  const link = $('link-acao').value.trim();
  return {
    titulo: $('titulo').value.trim(),
    mensagem: $('mensagem').value.trim(),
    link: link ? normalizarLink(link) : null,
    textoAcao: link ? ($('texto-acao').value.trim() || null) : null,
    publico: $('publico').value,
    categoria: $('categoria').value,
    canais: [...document.querySelectorAll('[name="canal"]:checked')].map((c) => c.value),
    enviarEm: envioAgendado() ? isoBrasilia($('data-envio').value, $('hora-envio').value) : null,
    rascunho,
  };
}

function limparErros() {
  ['titulo', 'mensagem', 'link-acao', 'data-envio', 'hora-envio'].forEach((id) => $(id).classList.remove('is-invalid'));
  ['erro-titulo', 'erro-mensagem', 'erro-link', 'erro-canais', 'erro-envio'].forEach((id) => { $(id).hidden = true; });
  $('resultado').hidden = true;
}

function erroCampo(idCampo, idErro, texto) {
  if (idCampo) $(idCampo).classList.add('is-invalid');
  $(idErro).textContent = texto;
  $(idErro).hidden = false;
}

function validar(dados, { rascunho }) {
  limparErros();
  const erros = [];
  if (!dados.titulo) erros.push(['titulo', 'erro-titulo', 'Escreva o título do aviso.']);
  if (!rascunho || dados.mensagem) {
    if (dados.mensagem.length < 10) erros.push(['mensagem', 'erro-mensagem', 'Escreva a mensagem (pelo menos 10 caracteres).']);
  }
  if (dados.link && !linkValido(dados.link)) {
    erros.push(['link-acao', 'erro-link', 'Use um endereço do site começando com pages/ (ex.: pages/institucional/termos-de-uso.html) ou um link https.']);
  }
  if (!rascunho && !dados.canais.length) erros.push([null, 'erro-canais', 'Escolha pelo menos um canal.']);
  if (envioAgendado()) {
    if (!$('data-envio').value || !$('hora-envio').value) {
      erros.push(['data-envio', 'erro-envio', 'Informe a data e a hora do envio.']);
    } else if (!rascunho && new Date(dados.enviarEm) < new Date(Date.now() + ANTECEDENCIA_MINIMA_MIN * 60000)) {
      erros.push(['hora-envio', 'erro-envio', `Escolha um horário pelo menos ${ANTECEDENCIA_MINIMA_MIN} minutos no futuro.`]);
    }
  }
  erros.forEach(([campo, idErro, texto]) => erroCampo(campo, idErro, texto));
  if (erros.length) {
    (erros[0][0] ? $(erros[0][0]) : document.querySelector('[name="canal"]')).focus();
    return false;
  }
  return true;
}

function atualizarBotoes() {
  const agendado = envioAgendado();
  $('botao-enviar').textContent = agendado ? 'Agendar aviso' : 'Enviar aviso';
  $('grupo-agendamento').hidden = !agendado;
  const rotulo = $('rotulo-agendado');
  const data = $('data-envio').value;
  const hora = $('hora-envio').value;
  rotulo.textContent = data && hora ? `Agendar para ${data.split('-').reverse().join('/')} às ${hora}` : 'Agendar para uma data e hora';
}

function atualizarContadores() {
  $('contador-titulo').textContent = `${$('titulo').value.length}/${$('titulo').maxLength}`;
  $('contador-mensagem').textContent = `${$('mensagem').value.length}/${$('mensagem').maxLength}`;
}

async function atualizarAlcance() {
  const publico = $('publico').value;
  const dica = $('dica-alcance');
  if (estado.alcance[publico] == null) {
    dica.textContent = 'Calculando o alcance…';
    try {
      estado.alcance[publico] = (await obterAlcance(publico))?.total ?? null;
    } catch (erro) {
      if (erro?.status === 401) return irParaLogin();
      estado.alcance[publico] = null;
    }
  }
  if ($('publico').value !== publico) return; // trocou enquanto carregava
  const total = estado.alcance[publico];
  dica.textContent = total == null ? 'Não foi possível calcular o alcance agora.' : PUBLICOS[publico].alcance(fmtNumero.format(total));
}

function renderizarPrevia() {
  const titulo = $('titulo').value.trim();
  const mensagem = $('mensagem').value.trim();
  const link = $('link-acao').value.trim();
  $('previa-titulo').textContent = titulo || 'Título do aviso';
  $('previa-titulo').classList.toggle('previa--vazia', !titulo);
  $('previa-mensagem').textContent = mensagem
    ? (mensagem.length > LIMITE_PREVIA ? `${mensagem.slice(0, LIMITE_PREVIA).trimEnd()}…` : mensagem)
    : 'A mensagem aparece aqui.';
  $('previa-mensagem').classList.toggle('previa--vazia', !mensagem);

  let quando = 'agora';
  if (envioAgendado() && $('data-envio').value && $('hora-envio').value) {
    quando = fmtDiaMesHora.format(new Date(isoBrasilia($('data-envio').value, $('hora-envio').value)));
  }
  $('previa-meta').textContent = `Busca Peça • ${quando}`;

  $('previa-botao').hidden = !link;
  $('previa-botao').textContent = $('texto-acao').value.trim() || 'Ver detalhes';
  $('grupo-texto-acao').hidden = !link;

  const email = $('canal-email').checked;
  $('previa-email').hidden = !email;
  $('previa-email-assunto').textContent = titulo || 'Título do aviso';
  $('previa-sistema').hidden = !$('canal-sistema').checked;
  $('previa-sem-canal').hidden = $('canal-sistema').checked || email;
}

function renderizarModo() {
  const editando = Boolean(estado.idEditando);
  const status = estado.avisoEditando?.status;
  $('titulo-form').textContent = !editando ? 'Novo aviso' : status === 'AGENDADO' ? 'Editar aviso agendado' : 'Editar rascunho';
  $('botao-novo-aviso').hidden = !editando;
  $('botoes-form').hidden = estado.confirmandoEnvio;
  $('confirmacao-envio').hidden = !estado.confirmandoEnvio;
}

function preencherFormulario(aviso) {
  $('publico').value = aviso?.publico || 'TODOS';
  $('categoria').value = aviso?.categoria || 'ATUALIZACAO';
  $('titulo').value = aviso?.titulo || '';
  $('mensagem').value = aviso?.mensagem || '';
  $('link-acao').value = aviso?.link || '';
  $('texto-acao').value = aviso?.textoAcao || '';
  $('canal-sistema').checked = aviso ? aviso.canais?.includes('SISTEMA') : true;
  $('canal-email').checked = aviso ? aviso.canais?.includes('EMAIL') : false;

  // Agendamento: mantém o horário do aviso ou sugere amanhã às 09:00
  const sugestao = new Date(Date.now() + 86400000);
  const partes = aviso?.enviarEm ? partesBrasilia(new Date(aviso.enviarEm)) : { data: partesBrasilia(sugestao).data, hora: '09:00' };
  $('data-envio').value = partes.data;
  $('hora-envio').value = partes.hora;
  $('envio-agora').checked = !aviso?.enviarEm;
  $('envio-agendado').checked = Boolean(aviso?.enviarEm);

  atualizarContadores();
  atualizarBotoes();
  atualizarAlcance();
  renderizarPrevia();
}

function mostrarResultado(tipo, titulo, texto) {
  const r = $('resultado');
  r.className = `aviso-estado aviso-estado--${tipo} mt-3`;
  r.innerHTML = `<p class="aviso-estado__titulo">${esc(titulo)}</p><p class="mb-0">${esc(texto)}</p>`;
  r.hidden = false;
}

function travarFormulario(travar) {
  document.querySelectorAll('#form-aviso input, #form-aviso select, #form-aviso textarea, #form-aviso button').forEach((el) => { el.disabled = travar; });
}

function novoAviso({ focar = true } = {}) {
  estado.idEditando = null;
  estado.avisoEditando = null;
  estado.confirmandoEnvio = false;
  limparErros();
  preencherFormulario(null);
  renderizarModo();
  renderizarTabela();
  if (focar) $('publico').focus();
}

function editarAviso(idAviso) {
  const aviso = estado.avisos.find((a) => String(a.idAviso) === String(idAviso));
  if (!aviso) return;
  estado.idEditando = aviso.idAviso;
  estado.avisoEditando = aviso;
  estado.confirmandoEnvio = false;
  limparErros();
  preencherFormulario(aviso);
  renderizarModo();
  renderizarTabela();
  $('cartao-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('titulo-form').focus({ preventScroll: true });
}

// "Reutilizar" um aviso enviado: copia para um novo
function reutilizarAviso(idAviso) {
  const aviso = estado.avisos.find((a) => String(a.idAviso) === String(idAviso));
  if (!aviso) return;
  novoAviso({ focar: false });
  preencherFormulario({ ...aviso, enviarEm: null });
  $('cartao-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('titulo').focus({ preventScroll: true });
  $('titulo').select();
}

async function salvar(dados, textoCarregando, botao) {
  estado.ocupado = true;
  const original = botao.textContent;
  botao.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(textoCarregando)}`;
  travarFormulario(true);
  try {
    const aviso = estado.idEditando ? await atualizarAviso(estado.idEditando, dados) : await criarAviso(dados);
    await carregarAvisos();
    return aviso;
  } catch (erro) {
    if (erro?.status === 401) { irParaLogin(); return null; }
    const mapa = { titulo: ['titulo', 'erro-titulo'], mensagem: ['mensagem', 'erro-mensagem'], link: ['link-acao', 'erro-link'], canais: [null, 'erro-canais'], enviarEm: ['hora-envio', 'erro-envio'] };
    (erro?.campos || []).forEach((c) => { if (mapa[c.campo]) erroCampo(mapa[c.campo][0], mapa[c.campo][1], c.mensagem); });
    mostrarResultado('erro', 'Não foi possível concluir', mensagemDeErro(erro, 'Verifique sua conexão e tente de novo.'));
    if (erro?.status === 409) carregarAvisos();
    return null;
  } finally {
    estado.ocupado = false;
    travarFormulario(false);
    botao.textContent = original;
  }
}

async function salvarRascunho() {
  if (estado.ocupado) return;
  const dados = dadosDoFormulario({ rascunho: true });
  if (!validar(dados, { rascunho: true })) return;
  const aviso = await salvar(dados, 'Salvando…', $('botao-rascunho'));
  if (!aviso) return;
  estado.idEditando = aviso.idAviso;
  estado.avisoEditando = aviso;
  renderizarModo();
  renderizarTabela();
  mostrarResultado('sucesso', 'Rascunho salvo', 'O aviso ainda não foi enviado. Você pode continuar depois pela tabela “Enviados e agendados”.');
}

function pedirEnvio(evento) {
  evento.preventDefault();
  if (estado.ocupado) return;
  const dados = dadosDoFormulario();
  if (!validar(dados, { rascunho: false })) return;
  if (dados.enviarEm) { enviar(dados); return; } // agendamento pode ser cancelado depois: sem confirmação

  const total = estado.alcance[dados.publico];
  $('texto-envio').textContent = `${total != null ? `${fmtNumero.format(total)} ${total === 1 ? 'pessoa recebe' : 'pessoas recebem'}` : 'O público escolhido recebe'} o aviso agora`
    + ` por ${dados.canais.map((c) => (c === 'SISTEMA' ? 'sino de notificações' : 'e-mail')).join(' e ')}. Depois de enviado, não dá para desfazer.`;
  estado.confirmandoEnvio = true;
  renderizarModo();
  $('botao-confirmar-envio').focus();
}

async function enviar(dados = dadosDoFormulario()) {
  const agendado = Boolean(dados.enviarEm);
  const botao = agendado ? $('botao-enviar') : $('botao-confirmar-envio');
  const aviso = await salvar(dados, agendado ? 'Agendando…' : 'Enviando…', botao);
  estado.confirmandoEnvio = false;
  renderizarModo();
  if (!aviso) return;
  const alcance = aviso.alcance != null ? `${fmtNumero.format(aviso.alcance)} ${aviso.alcance === 1 ? 'pessoa' : 'pessoas'}` : 'o público escolhido';
  novoAviso({ focar: false });
  if (aviso.status === 'AGENDADO') {
    mostrarResultado('sucesso', 'Aviso agendado', `“${aviso.titulo}” sai em ${dataHora(aviso.enviarEm)} para ${alcance}. Dá para editar ou cancelar até lá.`);
  } else {
    mostrarResultado('sucesso', 'Aviso enviado', `“${aviso.titulo}” foi enviado para ${alcance}.`);
  }
}

// ---------- Tabela ----------

function htmlAcoes(a) {
  const sr = `<span class="visually-hidden"> ${esc(a.titulo)}</span>`;
  if (String(estado.idCancelando) === String(a.idAviso)) {
    const pergunta = a.status === 'AGENDADO' ? 'Cancelar envio?' : 'Excluir rascunho?';
    return `<span class="texto-erro fw-semibold">${pergunta}</span>
      <button type="button" class="link-acao texto-erro fw-semibold" data-acao="confirmar-cancelamento" data-id="${esc(a.idAviso)}">Sim${sr}</button> ·
      <button type="button" class="link-acao" data-acao="manter">Não</button>`;
  }
  if (a.status === 'AGENDADO' || a.status === 'RASCUNHO') {
    return `<button type="button" class="link-acao" data-acao="editar" data-id="${esc(a.idAviso)}">Editar${sr}</button> /
      <button type="button" class="link-acao" data-acao="cancelar" data-id="${esc(a.idAviso)}">${a.status === 'AGENDADO' ? 'cancelar' : 'excluir'}${sr}</button>`;
  }
  return `<button type="button" class="link-acao" data-acao="reutilizar" data-id="${esc(a.idAviso)}">Reutilizar${sr}</button>`;
}

function renderizarTabela() {
  const corpo = $('corpo-avisos');
  $('cartao-avisos').setAttribute('aria-busy', String(estado.carregandoAvisos));
  if (estado.carregandoAvisos) {
    corpo.innerHTML = Array.from({ length: 3 }, () => `<tr class="placeholder-glow" aria-hidden="true">${
      '<td><span class="placeholder rounded col-9"></span></td>'.repeat(7)}</tr>`).join('');
    return;
  }
  if (!estado.avisos.length) {
    corpo.innerHTML = '<tr><td colspan="7" class="text-center texto-suave py-4">Nenhum aviso enviado ainda.</td></tr>';
    return;
  }
  corpo.innerHTML = estado.avisos.map((a) => {
    const st = STATUS[a.status] || { rotulo: a.status, classe: 'etiqueta--neutra' };
    const data = a.status === 'ENVIADO' ? (a.dataEnvio || a.enviarEm) : a.enviarEm;
    const editando = String(a.idAviso) === String(estado.idEditando);
    return `<tr class="${editando ? 'linha--selecionada' : ''}">
        <td class="celula-titulo">${esc(a.titulo)}</td>
        <td>${esc(PUBLICOS[a.publico]?.rotulo || a.publico)}</td>
        <td>${esc((a.canais || []).map((c) => CANAIS[c] || c).join(' • '))}</td>
        <td class="text-nowrap">${data ? esc(dataHora(data)) : '—'}</td>
        <td>${a.alcance != null ? esc(fmtNumero.format(a.alcance)) : '—'}</td>
        <td><span class="etiqueta ${st.classe}">${esc(st.rotulo)}</span></td>
        <td class="text-nowrap">${htmlAcoes(a)}</td>
      </tr>`;
  }).join('');
}

async function carregarAvisos() {
  estado.carregandoAvisos = !estado.avisos.length;
  $('erro-avisos').hidden = true;
  renderizarTabela();
  try {
    estado.avisos = await listarAvisos();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    if (erro?.status === 403) return mostrarAcessoRestrito('Sua conta não tem a permissão para enviar notificações (ENVIAR_NOTIFICACOES). Peça a um administrador geral.');
    $('erro-avisos-texto').textContent = mensagemDeErro(erro, 'Não foi possível carregar os avisos. Verifique sua conexão e tente de novo.');
    $('erro-avisos').hidden = false;
  } finally {
    estado.carregandoAvisos = false;
    renderizarTabela();
  }
}

async function cancelarAviso(idAviso) {
  const aviso = estado.avisos.find((a) => String(a.idAviso) === String(idAviso));
  try {
    await excluirAviso(idAviso);
    estado.idCancelando = null;
    if (String(estado.idEditando) === String(idAviso)) novoAviso({ focar: false });
    await carregarAvisos();
    mostrarResultado('sucesso', aviso?.status === 'AGENDADO' ? 'Envio cancelado' : 'Rascunho excluído',
      aviso?.status === 'AGENDADO' ? `“${aviso.titulo}” não será enviado.` : 'O rascunho foi apagado.');
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    estado.idCancelando = null;
    renderizarTabela();
    $('erro-avisos-texto').textContent = mensagemDeErro(erro, 'Não foi possível cancelar o aviso.');
    $('erro-avisos').hidden = false;
    if (erro?.status === 409) carregarAvisos();
  }
}

// ---------- Alertas automáticos ----------

function alertasDaTela() {
  return Object.fromEntries([...document.querySelectorAll('[name="alerta"]')].map((c) => [c.value, c.checked]));
}

function atualizarBotaoAlertas() {
  const mudou = estado.alertasSalvos && JSON.stringify(alertasDaTela()) !== JSON.stringify(estado.alertasSalvos);
  $('botao-salvar-alertas').disabled = !mudou;
}

async function carregarAlertas() {
  try {
    const alertas = await obterAlertasAutomaticos();
    document.querySelectorAll('[name="alerta"]').forEach((c) => { c.checked = Boolean(alertas[c.value]); c.disabled = false; });
    estado.alertasSalvos = alertasDaTela();
    atualizarBotaoAlertas();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    const aviso = $('aviso-alertas');
    aviso.className = 'aviso aviso--erro mt-3';
    aviso.textContent = erro?.status === 403
      ? 'Sua conta pode ver esta tela, mas não pode alterar os alertas automáticos.'
      : mensagemDeErro(erro, 'Não foi possível carregar os alertas automáticos.');
    aviso.hidden = false;
  }
}

async function salvarAlertas() {
  const botao = $('botao-salvar-alertas');
  const aviso = $('aviso-alertas');
  botao.disabled = true;
  botao.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Salvando…';
  try {
    const salvos = await salvarAlertasAutomaticos(alertasDaTela());
    document.querySelectorAll('[name="alerta"]').forEach((c) => { if (c.value in salvos) c.checked = Boolean(salvos[c.value]); });
    estado.alertasSalvos = alertasDaTela();
    aviso.className = 'aviso aviso--sucesso mt-3';
    aviso.textContent = 'Configurações salvas. Valem para os próximos eventos.';
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    aviso.className = 'aviso aviso--erro mt-3';
    aviso.textContent = erro?.status === 403
      ? 'Sua conta não pode alterar os alertas automáticos.'
      : mensagemDeErro(erro, 'Não foi possível salvar. Tente de novo.');
  } finally {
    aviso.hidden = false;
    botao.textContent = 'Salvar configurações';
    atualizarBotaoAlertas();
  }
}

// ---------- Eventos ----------

function ligarEventos() {
  $('form-aviso').addEventListener('submit', pedirEnvio);
  $('botao-rascunho').addEventListener('click', salvarRascunho);
  $('botao-confirmar-envio').addEventListener('click', () => enviar());
  $('botao-voltar-envio').addEventListener('click', () => { estado.confirmandoEnvio = false; renderizarModo(); $('botao-enviar').focus(); });
  $('botao-novo-aviso').addEventListener('click', () => novoAviso());

  $('publico').addEventListener('change', atualizarAlcance);
  const erroDoCampo = { titulo: 'erro-titulo', mensagem: 'erro-mensagem', 'link-acao': 'erro-link' };
  ['titulo', 'mensagem', 'link-acao', 'texto-acao'].forEach((id) => $(id).addEventListener('input', () => {
    $(id).classList.remove('is-invalid');
    if (erroDoCampo[id]) $(erroDoCampo[id]).hidden = true;
    atualizarContadores();
    renderizarPrevia();
  }));
  document.querySelectorAll('[name="canal"]').forEach((c) => c.addEventListener('change', () => { $('erro-canais').hidden = true; renderizarPrevia(); }));
  document.querySelectorAll('[name="envio"], #data-envio, #hora-envio').forEach((el) => el.addEventListener('change', () => {
    ['data-envio', 'hora-envio'].forEach((id) => $(id).classList.remove('is-invalid'));
    $('erro-envio').hidden = true;
    estado.confirmandoEnvio = false;
    renderizarModo();
    atualizarBotoes();
    renderizarPrevia();
  }));

  $('corpo-avisos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.acao) {
      case 'editar': editarAviso(id); break;
      case 'reutilizar': reutilizarAviso(id); break;
      case 'cancelar':
        estado.idCancelando = id;
        renderizarTabela();
        document.querySelector('[data-acao="confirmar-cancelamento"]')?.focus();
        break;
      case 'confirmar-cancelamento': cancelarAviso(id); break;
      case 'manter': estado.idCancelando = null; renderizarTabela(); break;
      default:
    }
  });
  $('botao-tentar-avisos').addEventListener('click', carregarAvisos);

  document.querySelectorAll('[name="alerta"]').forEach((c) => c.addEventListener('change', () => { $('aviso-alertas').hidden = true; atualizarBotaoAlertas(); }));
  $('botao-salvar-alertas').addEventListener('click', salvarAlertas);
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
  $('data-envio').min = partesBrasilia(new Date()).data;
  ligarEventos();
  renderizarTabela();
  if (!(await verificarAcesso())) return;

  novoAviso({ focar: false });
  carregarAlertas();
  await carregarAvisos();
}

iniciar();