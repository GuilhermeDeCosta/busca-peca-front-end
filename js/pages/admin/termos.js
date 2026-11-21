// Tela: admin/termos.html — Administração • Termos e políticas (?versao=5 abre a prévia de uma versão)
// Acesso: papel interno com a permissão PUBLICAR_TERMOS. Caso de uso: BP1-54. Fluxo E • ADR-013.
// Rotas (Documentação do Back-end v2, seção 5.12):
//   GET    /api/admin/termos                 versões
//   GET    /api/admin/termos/{id}            uma versão com o conteúdo (rota nova)
//   POST   /api/admin/termos                 cria rascunho (multipart: dados + arquivo)
//   PUT    /api/admin/termos/{id}            altera rascunho (rota nova)
//   DELETE /api/admin/termos/{id}            exclui rascunho (rota nova)
//   PATCH  /api/admin/termos/{id}/publicar   publica (vigente ou agendada)
import {
  listarTermos, obterTermo, criarRascunhoTermo, atualizarRascunhoTermo, excluirRascunhoTermo, publicarTermo,
  USAR_SIMULACAO,
} from '../../services/admin.js';

const FUSO = 'America/Sao_Paulo';
const TAMANHO_MAXIMO_ARQUIVO = 5 * 1024 * 1024; // 5 MB
const MIN_RESUMO = 10;
const DIAS_AVISO = 7;

const DOCUMENTOS = {
  TERMOS_USO: { nome: 'Termos de uso', arquivo: 'termos-de-uso' },
  POLITICA_PRIVACIDADE: { nome: 'Política de Privacidade', arquivo: 'politica-de-privacidade' },
  TERMOS_VENDEDOR: { nome: 'Termos do vendedor', arquivo: 'termos-do-vendedor' },
};

const STATUS = {
  VIGENTE: { rotulo: 'Vigente', classe: 'etiqueta--sucesso' },
  AGENDADA: { rotulo: 'Agendada', classe: 'etiqueta--info' },
  ARQUIVADA: { rotulo: 'Arquivada', classe: 'etiqueta--neutra' },
  RASCUNHO: { rotulo: 'Rascunho', classe: 'etiqueta--alerta' },
};

const estado = {
  termos: [],
  carregando: true,
  idExcluindo: null,        // rascunho com confirmação de exclusão aberta na tabela
  idEditando: null,         // rascunho carregado no formulário (null = nova versão)
  termoEditando: null,
  versaoSugerida: true,     // a versão foi preenchida pela tela (pode trocar ao mudar o documento)
  arquivo: null,            // File escolhido agora
  conteudoArquivo: '',      // texto do Markdown escolhido agora
  confirmandoPublicacao: false,
  ocupado: false,
  previa: null,             // { termo, conteudo, base: { versao, conteudo } | null }
  modoPrevia: 'alteracoes', // alteracoes | comparar | completo
  requisicaoPrevia: 0,
};

const $ = (id) => document.getElementById(id);

// ---------- Utilitários ----------

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const chaveDia = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO });
const fmtNumero = new Intl.NumberFormat('pt-BR');

function hojeIso() {
  return chaveDia.format(new Date());
}

function somarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function dataBr(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '—';
}

function tamanhoLegivel(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function nomeDocumento(tipo) {
  return DOCUMENTOS[tipo]?.nome || tipo;
}

// Compara "1.10" > "1.9" por partes numéricas
function compararVersoes(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const dif = (pa[i] || 0) - (pb[i] || 0);
    if (dif) return dif;
  }
  return 0;
}

function proximaVersao(tipo) {
  const versoes = estado.termos.filter((t) => t.tipo === tipo).map((t) => t.versao).sort(compararVersoes);
  const maior = versoes[versoes.length - 1];
  if (!maior) return '1.0';
  const partes = maior.split('.').map(Number);
  if (partes.length === 1) partes.push(0);
  partes[partes.length - 1] += 1;
  return partes.join('.');
}

function vigenteDo(tipo) {
  return estado.termos.find((t) => t.tipo === tipo && t.status === 'VIGENTE') || null;
}

function irParaLogin() {
  window.location.href = `../conta/login.html?voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

function mensagemDeErro(erro, padrao) {
  if (erro?.status === 403) return 'Sua conta não tem a permissão para publicar termos (PUBLICAR_TERMOS).';
  return erro?.mensagem || padrao;
}

function mostrarAcessoRestrito(texto) {
  $('conteudo-admin').hidden = true;
  const caixa = $('acesso-restrito');
  caixa.hidden = false;
  caixa.querySelector('p:last-child').textContent = texto;
}

// ---------- Markdown (só o necessário, sempre escapando antes) ----------

function inline(texto) {
  return esc(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])[*_](\S(?:.*?\S)?)[*_](?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function markdownParaHtml(md) {
  const linhas = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let paragrafo = [];
  let lista = null; // { tag, itens }

  const fecharParagrafo = () => {
    if (paragrafo.length) html.push(`<p>${inline(paragrafo.join(' '))}</p>`);
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) html.push(`<${lista.tag}>${lista.itens.map((i) => `<li>${inline(i)}</li>`).join('')}</${lista.tag}>`);
    lista = null;
  };

  linhas.forEach((linha) => {
    const titulo = linha.match(/^(#{1,6})\s+(.+)$/);
    const itemSimples = linha.match(/^\s*[-*+]\s+(.+)$/);
    const itemNumerado = linha.match(/^\s*\d+[.)]\s+(.+)$/);
    if (titulo) {
      fecharParagrafo(); fecharLista();
      const nivel = Math.min(6, titulo[1].length + 2);
      html.push(`<h${nivel} class="previa__titulo-secao">${inline(titulo[2])}</h${nivel}>`);
    } else if (itemSimples || itemNumerado) {
      fecharParagrafo();
      const tag = itemSimples ? 'ul' : 'ol';
      if (lista && lista.tag !== tag) fecharLista();
      lista ??= { tag, itens: [] };
      lista.itens.push((itemSimples || itemNumerado)[1]);
    } else if (!linha.trim()) {
      fecharParagrafo(); fecharLista();
    } else {
      fecharLista();
      paragrafo.push(linha.trim());
    }
  });
  fecharParagrafo(); fecharLista();
  return html.join('');
}

// Divide pelo título (##); a chave ignora a numeração ("4. Pagamento" = "Pagamento")
function secoes(md) {
  const lista = [];
  let atual = { titulo: '', chave: '', linhas: [] };
  String(md || '').replace(/\r\n?/g, '\n').split('\n').forEach((linha) => {
    const t = linha.match(/^#{1,6}\s+(.+)$/);
    if (t) {
      if (atual.titulo || atual.linhas.some((l) => l.trim())) lista.push(atual);
      const chave = t[1].replace(/^\d+(\.\d+)*[.)]?\s*/, '').trim().toLowerCase();
      atual = { titulo: t[1].trim(), chave, linhas: [] };
    } else {
      atual.linhas.push(linha);
    }
  });
  if (atual.titulo || atual.linhas.some((l) => l.trim())) lista.push(atual);
  return lista.map((s) => ({ ...s, corpo: s.linhas.join('\n').trim() }));
}

const normalizarTexto = (t) => t.replace(/\s+/g, ' ').trim();

function alteracoes(novo, antigo) {
  const antes = secoes(antigo);
  const depois = secoes(novo);
  const mudancas = [];
  depois.forEach((s) => {
    const anterior = antes.find((a) => a.chave === s.chave);
    if (!anterior) mudancas.push({ tipo: 'nova', titulo: s.titulo, depois: s.corpo, antes: '' });
    else if (normalizarTexto(anterior.corpo) !== normalizarTexto(s.corpo)) mudancas.push({ tipo: 'alterada', titulo: s.titulo, depois: s.corpo, antes: anterior.corpo });
  });
  antes.forEach((a) => {
    if (!depois.some((s) => s.chave === a.chave)) mudancas.push({ tipo: 'removida', titulo: a.titulo, depois: '', antes: a.corpo });
  });
  return mudancas;
}

// ---------- Tabela ----------

function ordenarTermos(lista) {
  return [...lista].sort((a, b) => {
    if ((a.status === 'RASCUNHO') !== (b.status === 'RASCUNHO')) return a.status === 'RASCUNHO' ? 1 : -1;
    return String(b.dataVigencia || '').localeCompare(String(a.dataVigencia || '')) || a.tipo.localeCompare(b.tipo);
  });
}

function htmlAcoes(t) {
  const nome = `${nomeDocumento(t.tipo)} ${t.versao}`;
  if (String(estado.idExcluindo) === String(t.idTermo)) {
    return `<span class="texto-erro fw-semibold">Excluir?</span>
      <button type="button" class="link-acao texto-erro fw-semibold" data-acao="confirmar-exclusao" data-id="${esc(t.idTermo)}">Sim<span class="visually-hidden">, excluir ${esc(nome)}</span></button> ·
      <button type="button" class="link-acao" data-acao="cancelar-exclusao">Não</button>`;
  }
  const sr = `<span class="visually-hidden"> ${esc(nome)}</span>`;
  const ver = `<button type="button" class="link-acao" data-acao="ver" data-id="${esc(t.idTermo)}">Ver${sr}</button>`;
  const baixar = `<button type="button" class="link-acao" data-acao="baixar" data-id="${esc(t.idTermo)}">baixar${sr}</button>`;
  if (t.status === 'RASCUNHO') {
    return `<button type="button" class="link-acao" data-acao="editar" data-id="${esc(t.idTermo)}">Editar${sr}</button> /
      <button type="button" class="link-acao" data-acao="excluir" data-id="${esc(t.idTermo)}">excluir${sr}</button>`;
  }
  if (t.status === 'ARQUIVADA') return ver;
  return `${ver} / ${baixar}`;
}

function renderizarTabela() {
  const corpo = $('corpo-termos');
  $('cartao-versoes').setAttribute('aria-busy', String(estado.carregando));
  if (estado.carregando) {
    corpo.innerHTML = Array.from({ length: 4 }, () => `<tr class="placeholder-glow" aria-hidden="true">${
      '<td><span class="placeholder rounded col-9"></span></td>'.repeat(6)}</tr>`).join('');
    return;
  }
  if (!estado.termos.length) {
    corpo.innerHTML = '<tr><td colspan="6" class="text-center texto-suave py-4">Nenhuma versão cadastrada. Comece pela “Nova versão” ao lado.</td></tr>';
    return;
  }
  corpo.innerHTML = ordenarTermos(estado.termos).map((t) => {
    const st = STATUS[t.status] || { rotulo: t.status, classe: 'etiqueta--neutra' };
    const emEdicao = String(t.idTermo) === String(estado.idEditando);
    const vista = String(t.idTermo) === String(estado.previa?.termo?.idTermo);
    const aceites = ['RASCUNHO', 'AGENDADA'].includes(t.status) ? '—' : fmtNumero.format(t.totalAceites ?? 0);
    return `<tr class="${emEdicao || vista ? 'linha--selecionada' : ''}">
        <td>${esc(nomeDocumento(t.tipo))}</td>
        <td>${esc(t.versao)}</td>
        <td>${t.status === 'RASCUNHO' ? '—' : esc(dataBr(t.dataVigencia))}</td>
        <td>${aceites}</td>
        <td><span class="etiqueta ${st.classe}">${esc(st.rotulo)}</span></td>
        <td class="text-nowrap">${htmlAcoes(t)}</td>
      </tr>`;
  }).join('');
}

async function carregarTermos() {
  estado.carregando = true;
  $('erro-termos').hidden = true;
  renderizarTabela();
  try {
    estado.termos = await listarTermos();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    if (erro?.status === 403) return mostrarAcessoRestrito('Sua conta não tem a permissão para publicar termos (PUBLICAR_TERMOS). Peça a um administrador geral.');
    $('erro-termos-texto').textContent = mensagemDeErro(erro, 'Não foi possível carregar as versões. Verifique sua conexão e tente de novo.');
    $('erro-termos').hidden = false;
  } finally {
    estado.carregando = false;
    renderizarTabela();
  }
}

// ---------- Prévia ----------

function renderizarPrevia() {
  const p = estado.previa;
  const caixa = $('previa-conteudo');
  const etiquetas = $('previa-etiquetas');
  if (!p) {
    $('titulo-previa').textContent = 'Prévia';
    caixa.innerHTML = '<p class="texto-suave small mb-0">Escolha uma versão na tabela (“Ver”) ou envie um arquivo Markdown para ver a prévia.</p>';
    etiquetas.innerHTML = '';
    return;
  }

  const t = p.termo;
  const nome = `${nomeDocumento(t.tipo)} ${t.versao || ''}`.trim();
  const rascunho = t.status === 'RASCUNHO';
  $('titulo-previa').textContent = p.local
    ? `Prévia do arquivo enviado • ${nome}`
    : rascunho ? `Prévia do rascunho • ${nome}` : `${nome} • ${STATUS[t.status]?.rotulo || t.status}`;

  if (p.carregando) {
    caixa.innerHTML = '<p class="texto-suave small mb-0"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Carregando o texto…</p>';
    etiquetas.innerHTML = '';
    return;
  }

  if (!p.conteudo) {
    const link = t.arquivoUrl ? ` <a href="${esc(t.arquivoUrl)}" target="_blank" rel="noopener">Abrir ${esc(t.nomeArquivo || 'arquivo')}</a>.` : '';
    caixa.innerHTML = `<p class="texto-suave small mb-0">A prévia aparece para arquivos Markdown. ${t.nomeArquivo
      ? `Este texto foi enviado como ${esc(t.nomeArquivo)} e será publicado como está.${link}` : 'Esta versão ainda não tem o texto completo.'}</p>`;
    etiquetas.innerHTML = '';
    return;
  }

  const base = (rascunho || p.local) ? p.base : null;
  const mudancas = base?.conteudo ? alteracoes(p.conteudo, base.conteudo) : [];
  const modo = base && mudancas.length ? estado.modoPrevia : 'completo';

  if (modo === 'comparar') {
    caixa.innerHTML = mudancas.map((m) => `
      <section class="comparacao">
        <h4 class="previa__titulo-secao">${inline(m.titulo || 'Introdução')} <span class="etiqueta etiqueta--${m.tipo === 'removida' ? 'erro' : m.tipo === 'nova' ? 'info' : 'alerta'} ms-1">${{ nova: 'nova', alterada: 'alterada', removida: 'removida' }[m.tipo]}</span></h4>
        <div class="row g-2">
          <div class="col-md-6"><div class="comparacao__lado comparacao__lado--antes"><p class="comparacao__rotulo">Versão ${esc(base.versao)}</p>${m.antes ? markdownParaHtml(m.antes) : '<p class="texto-suave">—</p>'}</div></div>
          <div class="col-md-6"><div class="comparacao__lado comparacao__lado--depois"><p class="comparacao__rotulo">Versão ${esc(t.versao || 'nova')}</p>${m.depois ? markdownParaHtml(m.depois) : '<p class="texto-suave">Seção removida.</p>'}</div></div>
        </div>
      </section>`).join('');
  } else if (modo === 'alteracoes') {
    caixa.innerHTML = mudancas.filter((m) => m.tipo !== 'removida').map((m) =>
      `${m.titulo ? `<h4 class="previa__titulo-secao">${inline(m.titulo)}</h4>` : ''}${markdownParaHtml(m.depois)}`).join('')
      || '<p class="texto-suave small">Só houve remoção de seções. Use “Comparar” para ver o que saiu.</p>';
  } else {
    caixa.innerHTML = markdownParaHtml(p.conteudo);
  }

  const botoes = [];
  if (base) {
    botoes.push(mudancas.length
      ? `<span class="etiqueta etiqueta--alerta">${mudancas.length === 1 ? '1 seção alterada' : `${mudancas.length} seções alteradas`}</span>`
      : `<span class="etiqueta etiqueta--neutra">Sem mudanças em relação à versão ${esc(base.versao)}</span>`);
    if (mudancas.length) {
      botoes.push(`<button type="button" class="etiqueta etiqueta--botao" data-modo="${modo === 'comparar' ? 'alteracoes' : 'comparar'}" aria-pressed="${modo === 'comparar'}">${
        modo === 'comparar' ? 'Ver só as alterações' : `Comparar com a versão ${esc(base.versao)}`}</button>`);
      botoes.push(`<button type="button" class="etiqueta etiqueta--botao" data-modo="${modo === 'completo' ? 'alteracoes' : 'completo'}" aria-pressed="${modo === 'completo'}">${
        modo === 'completo' ? 'Ver só as alterações' : 'Ver texto completo'}</button>`);
    }
  } else if (rascunho || p.local) {
    botoes.push('<span class="etiqueta etiqueta--info">Primeira versão deste documento</span>');
  }
  etiquetas.innerHTML = botoes.join('');
}

async function baseDaComparacao(tipo, idIgnorar) {
  const vigente = estado.termos.find((t) => t.tipo === tipo && t.status === 'VIGENTE' && String(t.idTermo) !== String(idIgnorar));
  if (!vigente) return null;
  try {
    const completo = await obterTermo(vigente.idTermo);
    return { versao: vigente.versao, conteudo: completo.conteudo || '' };
  } catch (e) {
    return null;
  }
}

async function verVersao(idTermo, { rolar = true } = {}) {
  const resumo = estado.termos.find((t) => String(t.idTermo) === String(idTermo));
  if (!resumo) return;
  const requisicao = ++estado.requisicaoPrevia;
  estado.previa = { termo: resumo, carregando: true };
  estado.modoPrevia = 'alteracoes';
  renderizarPrevia();
  renderizarTabela();
  const url = new URL(window.location.href);
  url.searchParams.set('versao', idTermo);
  history.replaceState(null, '', url);
  if (rolar) $('cartao-previa').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const termo = await obterTermo(idTermo);
    const base = resumo.status === 'RASCUNHO' ? await baseDaComparacao(resumo.tipo, idTermo) : null;
    if (requisicao !== estado.requisicaoPrevia) return;
    estado.previa = { termo: { ...resumo, ...termo }, conteudo: termo.conteudo || '', base };
  } catch (erro) {
    if (requisicao !== estado.requisicaoPrevia) return;
    if (erro?.status === 401) return irParaLogin();
    estado.previa = null;
    $('previa-conteudo').innerHTML = `<p class="small texto-erro mb-0">${esc(mensagemDeErro(erro, 'Não foi possível abrir esta versão.'))}</p>`;
    return;
  }
  renderizarPrevia();
  renderizarTabela();
  if (rolar) $('titulo-previa').focus({ preventScroll: true });
}

// Prévia do Markdown escolhido no formulário (antes de salvar)
async function previaDoArquivoLocal() {
  if (!estado.conteudoArquivo) return;
  const tipo = $('tipo-documento').value;
  const requisicao = ++estado.requisicaoPrevia;
  const base = await baseDaComparacao(tipo, estado.idEditando);
  if (requisicao !== estado.requisicaoPrevia) return;
  estado.previa = {
    local: true,
    termo: { tipo, versao: $('versao').value.trim(), status: 'RASCUNHO', idTermo: estado.idEditando },
    conteudo: estado.conteudoArquivo,
    base,
  };
  estado.modoPrevia = 'alteracoes';
  renderizarPrevia();
}

async function baixarVersao(idTermo) {
  try {
    const t = await obterTermo(idTermo);
    const a = document.createElement('a');
    if (t.arquivoUrl) {
      a.href = t.arquivoUrl;
      a.target = '_blank';
      a.rel = 'noopener';
    } else if (t.conteudo) {
      a.href = URL.createObjectURL(new Blob([t.conteudo], { type: 'text/markdown;charset=utf-8' }));
      a.download = `${DOCUMENTOS[t.tipo]?.arquivo || 'termo'}-v${t.versao}.md`;
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } else {
      throw { mensagem: 'Esta versão não tem texto para baixar.' };
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    $('erro-termos-texto').textContent = mensagemDeErro(erro, 'Não foi possível baixar esta versão.');
    $('erro-termos').hidden = false;
  }
}

// ---------- Formulário ----------

function mostrarResultado(tipo, titulo, texto) {
  const r = $('resultado');
  r.className = `aviso-estado aviso-estado--${tipo} mt-3`;
  r.innerHTML = `<p class="aviso-estado__titulo">${esc(titulo)}</p><p class="mb-0">${esc(texto)}</p>`;
  r.hidden = false;
}

function limparErros() {
  ['versao', 'data-vigencia', 'resumo'].forEach((id) => $(id).classList.remove('is-invalid'));
  ['erro-versao', 'erro-vigencia', 'erro-resumo', 'erro-arquivo'].forEach((id) => { $(id).hidden = true; });
  $('resultado').hidden = true;
}

function erroCampo(idCampo, idErro, texto) {
  if (idCampo) $(idCampo).classList.add('is-invalid');
  $(idErro).textContent = texto;
  $(idErro).hidden = false;
}

function renderizarArquivo() {
  const temNovo = Boolean(estado.arquivo);
  const existente = !temNovo && estado.termoEditando?.nomeArquivo;
  $('arquivo-titulo').textContent = temNovo || existente ? 'Trocar texto completo (PDF ou Markdown)' : 'Enviar texto completo (PDF ou Markdown)';
  $('arquivo-info').textContent = temNovo
    ? `${estado.arquivo.name} • ${tamanhoLegivel(estado.arquivo.size)}`
    : existente ? `${estado.termoEditando.nomeArquivo} • ${tamanhoLegivel(estado.termoEditando.tamanhoArquivo)} (já enviado)` : 'Arraste o arquivo para cá ou clique para escolher • até 5 MB';
  $('botao-remover-arquivo').hidden = !temNovo;
}

function atualizarDicaAviso() {
  const data = $('data-vigencia').value;
  const avisar = $('avisar-usuarios').checked;
  const dica = $('dica-aviso');
  if (!avisar || !data) { dica.textContent = ''; return; }
  const diaAviso = somarDias(data, -DIAS_AVISO);
  dica.textContent = diaAviso <= hojeIso()
    ? 'A vigência é em menos de 7 dias: o aviso sai assim que a versão for publicada.'
    : `O aviso sai em ${dataBr(diaAviso)}.`;
}

function renderizarModoFormulario() {
  const editando = Boolean(estado.idEditando);
  const t = estado.termoEditando;
  $('titulo-form').textContent = editando ? `Editar rascunho • ${nomeDocumento(t.tipo)} ${t.versao}` : 'Nova versão';
  $('botao-nova-versao').hidden = !editando;
  $('confirmacao-publicacao').hidden = !estado.confirmandoPublicacao;
  $('botoes-form').hidden = estado.confirmandoPublicacao;
  renderizarArquivo();
}

function preencherFormulario(termo) {
  $('tipo-documento').value = termo?.tipo || 'TERMOS_USO';
  $('versao').value = termo?.versao || proximaVersao($('tipo-documento').value);
  estado.versaoSugerida = !termo;
  $('data-vigencia').value = termo?.dataVigencia ? String(termo.dataVigencia).slice(0, 10) : somarDias(hojeIso(), DIAS_AVISO + 7);
  $('resumo').value = termo?.resumoMudancas || '';
  $('exigir-aceite').checked = termo ? termo.exigeNovoAceite !== false : true;
  $('avisar-usuarios').checked = termo ? termo.avisarUsuarios !== false : true;
  estado.arquivo = null;
  estado.conteudoArquivo = '';
  $('arquivo-termo').value = '';
  atualizarContadorResumo();
  atualizarDicaAviso();
}

async function editarRascunho(idTermo, { rolar = true } = {}) {
  const resumo = estado.termos.find((t) => String(t.idTermo) === String(idTermo));
  if (!resumo) return;
  limparErros();
  estado.idEditando = resumo.idTermo;
  estado.termoEditando = resumo;
  estado.confirmandoPublicacao = false;
  preencherFormulario(resumo);
  renderizarModoFormulario();
  renderizarTabela();
  if (rolar) {
    $('cartao-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('titulo-form').focus({ preventScroll: true });
  }
  verVersao(idTermo, { rolar: false });
}

function novaVersao({ focar = true } = {}) {
  limparErros();
  estado.idEditando = null;
  estado.termoEditando = null;
  estado.confirmandoPublicacao = false;
  preencherFormulario(null);
  renderizarModoFormulario();
  renderizarTabela();
  if (focar) $('tipo-documento').focus();
}

function dadosDoFormulario() {
  return {
    tipo: $('tipo-documento').value,
    versao: $('versao').value.trim(),
    dataVigencia: $('data-vigencia').value,
    resumoMudancas: $('resumo').value.trim(),
    exigeNovoAceite: $('exigir-aceite').checked,
    avisarUsuarios: $('avisar-usuarios').checked,
    ...(estado.conteudoArquivo ? { conteudo: estado.conteudoArquivo } : {}),
  };
}

function validar(dados, { publicar }) {
  limparErros();
  let primeiro = null;
  const marcar = (campo, idErro, texto) => { erroCampo(campo, idErro, texto); primeiro ??= campo || 'area-arquivo'; };

  if (!/^\d{1,3}(\.\d{1,3}){0,2}$/.test(dados.versao)) {
    marcar('versao', 'erro-versao', 'Use números separados por ponto, como 1.3.');
  } else {
    const repetida = estado.termos.find((t) => t.tipo === dados.tipo && t.versao === dados.versao && String(t.idTermo) !== String(estado.idEditando));
    const vigente = vigenteDo(dados.tipo);
    if (repetida) {
      marcar('versao', 'erro-versao', `Já existe uma versão ${dados.versao} ${repetida.status === 'RASCUNHO' ? 'em rascunho' : 'publicada'} para este documento.`);
    } else if (vigente && compararVersoes(dados.versao, vigente.versao) <= 0) {
      marcar('versao', 'erro-versao', `A nova versão precisa ser maior que a vigente (${vigente.versao}).`);
    }
  }
  if (!dados.dataVigencia) marcar('data-vigencia', 'erro-vigencia', 'Informe a data de início da vigência.');
  else if (dados.dataVigencia < hojeIso()) marcar('data-vigencia', 'erro-vigencia', 'A vigência não pode começar no passado.');
  if (dados.resumoMudancas.length < MIN_RESUMO) marcar('resumo', 'erro-resumo', `Descreva as mudanças com pelo menos ${MIN_RESUMO} caracteres; o resumo aparece para os usuários.`);
  if (publicar && !estado.arquivo && !estado.termoEditando?.nomeArquivo) marcar(null, 'erro-arquivo', 'Envie o texto completo antes de publicar.');

  if (primeiro) {
    if (primeiro === 'area-arquivo') $('area-arquivo').focus();
    else $(primeiro).focus();
    return false;
  }
  return true;
}

function travarFormulario(travar) {
  document.querySelectorAll('#form-termo input, #form-termo select, #form-termo textarea, #form-termo button').forEach((el) => { el.disabled = travar; });
  $('area-arquivo').classList.toggle('area-arquivo--travada', travar);
}

async function salvar(dados) {
  const termo = estado.idEditando
    ? await atualizarRascunhoTermo(estado.idEditando, dados, estado.arquivo)
    : await criarRascunhoTermo(dados, estado.arquivo);
  // Daqui em diante o formulário edita este rascunho
  estado.idEditando = termo.idTermo;
  estado.termoEditando = termo;
  estado.arquivo = null;
  $('arquivo-termo').value = '';
  return termo;
}

function tratarErroDeSalvar(erro, prefixo = '') {
  if (erro?.status === 401) return irParaLogin();
  if (erro?.status === 409 && erro?.erro === 'VERSAO_EM_USO') {
    erroCampo('versao', 'erro-versao', erro.mensagem);
    mostrarResultado('erro', 'Número de versão em uso', erro.mensagem);
    return;
  }
  (erro?.campos || []).forEach((c) => {
    const mapa = { versao: ['versao', 'erro-versao'], dataVigencia: ['data-vigencia', 'erro-vigencia'], resumoMudancas: ['resumo', 'erro-resumo'], arquivo: [null, 'erro-arquivo'] };
    if (mapa[c.campo]) erroCampo(mapa[c.campo][0], mapa[c.campo][1], c.mensagem);
  });
  mostrarResultado('erro', 'Não foi possível concluir', prefixo + mensagemDeErro(erro, 'Verifique sua conexão e tente de novo.'));
}

async function salvarRascunho() {
  if (estado.ocupado) return;
  const dados = dadosDoFormulario();
  if (!validar(dados, { publicar: false })) return;
  estado.ocupado = true;
  const botao = $('botao-salvar-rascunho');
  const texto = botao.textContent;
  botao.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Salvando…';
  travarFormulario(true);
  try {
    const termo = await salvar(dados);
    await carregarTermos();
    renderizarModoFormulario();
    mostrarResultado('sucesso', 'Rascunho salvo', `${nomeDocumento(termo.tipo)} ${termo.versao} ainda não está visível para os usuários.`);
    verVersao(termo.idTermo, { rolar: false });
  } catch (erro) {
    tratarErroDeSalvar(erro);
  } finally {
    estado.ocupado = false;
    travarFormulario(false);
    botao.textContent = texto;
  }
}

function pedirPublicacao() {
  const dados = dadosDoFormulario();
  if (!validar(dados, { publicar: true })) return;
  const hoje = dados.dataVigencia <= hojeIso();
  const vigente = vigenteDo(dados.tipo);
  $('texto-publicacao').textContent = [
    `${nomeDocumento(dados.tipo)} ${dados.versao} ${hoje ? 'entra em vigor hoje' : `entra em vigor em ${dataBr(dados.dataVigencia)}`}`
      + (vigente ? ` e substitui a versão ${vigente.versao}.` : '.'),
    dados.exigeNovoAceite ? 'Todas as contas vão precisar aceitar o novo texto no próximo acesso.' : 'As contas não precisarão aceitar de novo.',
    dados.avisarUsuarios ? 'Os usuários recebem uma notificação 7 dias antes da vigência.' : '',
  ].filter(Boolean).join(' ');
  estado.confirmandoPublicacao = true;
  renderizarModoFormulario();
  $('botao-confirmar-publicacao').focus();
}

async function confirmarPublicacao() {
  if (estado.ocupado) return;
  const dados = dadosDoFormulario();
  estado.ocupado = true;
  const botao = $('botao-confirmar-publicacao');
  botao.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Publicando…';
  travarFormulario(true);
  let salvo = false;
  try {
    const rascunho = await salvar(dados);
    salvo = true;
    const publicado = await publicarTermo(rascunho.idTermo);
    const nome = `${nomeDocumento(publicado.tipo)} ${publicado.versao}`;
    const contas = publicado.exigeNovoAceite && publicado.contasAfetadas
      ? ` ${fmtNumero.format(publicado.contasAfetadas)} ${publicado.contasAfetadas === 1 ? 'conta precisará' : 'contas precisarão'} aceitar novamente.` : '';
    estado.confirmandoPublicacao = false;
    estado.idEditando = null;
    estado.termoEditando = null;
    preencherFormulario(null);
    await carregarTermos();
    preencherFormulario(null); // sugere a próxima versão com a lista nova
    renderizarModoFormulario();
    mostrarResultado('sucesso', publicado.status === 'AGENDADA' ? 'Versão agendada' : 'Versão publicada',
      publicado.status === 'AGENDADA'
        ? `${nome} entra em vigor em ${dataBr(publicado.dataVigencia)}.${contas}`
        : `${nome} já está em vigor.${contas}`);
    verVersao(publicado.idTermo, { rolar: false });
  } catch (erro) {
    estado.confirmandoPublicacao = false;
    renderizarModoFormulario();
    if (salvo) await carregarTermos();
    tratarErroDeSalvar(erro, salvo ? 'O rascunho foi salvo, mas a publicação falhou. ' : '');
  } finally {
    estado.ocupado = false;
    travarFormulario(false);
    botao.textContent = 'Confirmar publicação';
  }
}

async function excluirRascunho(idTermo) {
  try {
    await excluirRascunhoTermo(idTermo);
    estado.idExcluindo = null;
    if (String(estado.idEditando) === String(idTermo)) novaVersao();
    if (String(estado.previa?.termo?.idTermo) === String(idTermo)) { estado.previa = null; renderizarPrevia(); }
    await carregarTermos();
    mostrarResultado('sucesso', 'Rascunho excluído', 'A versão em rascunho foi apagada.');
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin();
    estado.idExcluindo = null;
    renderizarTabela();
    $('erro-termos-texto').textContent = mensagemDeErro(erro, 'Não foi possível excluir o rascunho.');
    $('erro-termos').hidden = false;
  }
}

// ---------- Arquivo ----------

async function escolherArquivo(arquivo) {
  $('erro-arquivo').hidden = true;
  if (!arquivo) return;
  const nome = arquivo.name.toLowerCase();
  const ehMarkdown = /\.(md|markdown|txt)$/.test(nome);
  const ehPdf = nome.endsWith('.pdf');
  if (!ehMarkdown && !ehPdf) {
    erroCampo(null, 'erro-arquivo', 'Envie um arquivo PDF ou Markdown (.md).');
    $('arquivo-termo').value = '';
    return;
  }
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
    erroCampo(null, 'erro-arquivo', `O arquivo tem ${tamanhoLegivel(arquivo.size)}; o limite é 5 MB.`);
    $('arquivo-termo').value = '';
    return;
  }
  estado.arquivo = arquivo;
  estado.conteudoArquivo = ehMarkdown ? await arquivo.text() : '';
  renderizarArquivo();
  if (ehMarkdown) previaDoArquivoLocal();
  else {
    estado.previa = { local: true, termo: { tipo: $('tipo-documento').value, versao: $('versao').value.trim(), status: 'RASCUNHO', nomeArquivo: arquivo.name }, conteudo: '' };
    renderizarPrevia();
  }
}

function removerArquivo() {
  estado.arquivo = null;
  estado.conteudoArquivo = '';
  $('arquivo-termo').value = '';
  renderizarArquivo();
  if (estado.previa?.local) {
    if (estado.idEditando) verVersao(estado.idEditando, { rolar: false });
    else { estado.previa = null; renderizarPrevia(); }
  }
}

function atualizarContadorResumo() {
  $('contador-resumo').textContent = `${$('resumo').value.length}/500`;
}

// ---------- Eventos ----------

function ligarEventos() {
  $('corpo-termos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.acao) {
      case 'ver': verVersao(id); break;
      case 'baixar': baixarVersao(id); break;
      case 'editar': editarRascunho(id); break;
      case 'excluir':
        estado.idExcluindo = id;
        renderizarTabela();
        document.querySelector('[data-acao="confirmar-exclusao"]')?.focus();
        break;
      case 'confirmar-exclusao': excluirRascunho(id); break;
      case 'cancelar-exclusao': estado.idExcluindo = null; renderizarTabela(); break;
      default:
    }
  });
  $('botao-tentar-termos').addEventListener('click', carregarTermos);

  $('previa-etiquetas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (!b) return;
    estado.modoPrevia = b.dataset.modo;
    renderizarPrevia();
  });

  $('tipo-documento').addEventListener('change', () => {
    if (estado.versaoSugerida && !estado.idEditando) $('versao').value = proximaVersao($('tipo-documento').value);
    limparErros();
    if (estado.previa?.local) previaDoArquivoLocal();
  });
  $('versao').addEventListener('input', () => { estado.versaoSugerida = false; $('versao').classList.remove('is-invalid'); $('erro-versao').hidden = true; });
  $('data-vigencia').addEventListener('change', atualizarDicaAviso);
  $('avisar-usuarios').addEventListener('change', atualizarDicaAviso);
  $('resumo').addEventListener('input', atualizarContadorResumo);

  // Arquivo: clique, teclado e arrastar
  const area = $('area-arquivo');
  area.addEventListener('click', () => { if (!estado.ocupado) $('arquivo-termo').click(); });
  area.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !estado.ocupado) { e.preventDefault(); $('arquivo-termo').click(); }
  });
  ['dragenter', 'dragover'].forEach((ev) => area.addEventListener(ev, (e) => { e.preventDefault(); area.classList.add('area-arquivo--arrastando'); }));
  ['dragleave', 'drop'].forEach((ev) => area.addEventListener(ev, (e) => { e.preventDefault(); area.classList.remove('area-arquivo--arrastando'); }));
  area.addEventListener('drop', (e) => { if (!estado.ocupado) escolherArquivo(e.dataTransfer.files[0]); });
  $('arquivo-termo').addEventListener('change', (e) => escolherArquivo(e.target.files[0]));
  $('botao-remover-arquivo').addEventListener('click', removerArquivo);

  $('form-termo').addEventListener('submit', (e) => { e.preventDefault(); pedirPublicacao(); });
  $('botao-salvar-rascunho').addEventListener('click', salvarRascunho);
  $('botao-confirmar-publicacao').addEventListener('click', confirmarPublicacao);
  $('botao-voltar-publicacao').addEventListener('click', () => {
    estado.confirmandoPublicacao = false;
    renderizarModoFormulario();
    $('botao-publicar').focus();
  });
  $('botao-nova-versao').addEventListener('click', () => novaVersao());
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
  $('data-vigencia').min = hojeIso();
  ligarEventos();
  renderizarTabela();
  renderizarPrevia();
  if (!(await verificarAcesso())) return;

  await carregarTermos();
  if (!$('acesso-restrito').hidden) return;

  // Retoma o rascunho mais recente, como no protótipo; senão, formulário de nova versão
  const rascunho = ordenarTermos(estado.termos).filter((t) => t.status === 'RASCUNHO').pop();
  const pedida = new URLSearchParams(window.location.search).get('versao');
  if (rascunho) editarRascunho(rascunho.idTermo, { rolar: false });
  else novaVersao({ focar: false });
  if (pedida && String(pedida) !== String(rascunho?.idTermo)) verVersao(pedida, { rolar: false });
  else if (!rascunho) {
    const vigente = vigenteDo('TERMOS_USO');
    if (vigente) verVersao(vigente.idTermo, { rolar: false });
  }
}

iniciar();