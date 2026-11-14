// Serviço de peças: uma função por rota de /api/pecas (Documentação do Back-end, seção 5.5).
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS:
//   1. Descomente o import do api.js (as funções novas já chamam api.* direto).
//   2. Troque USAR_SIMULACAO para false e apague o import de ./simulacao.js.
//   3. Apague as funções simular*() do fim do arquivo.

// import { api } from '../api.js';
import { esperar, anunciosSimulados, referenciasSimuladas, gerarHistoricoPreco } from './simulacao.js';

const USAR_SIMULACAO = true;

/**
 * GET /api/pecas?loja=minha — anúncios da própria loja, com filtros e paginação (BP1-42, 44, 46).
 * @param {{ q?: string, status?: 'ATIVO'|'PAUSADO'|'RASCUNHO'|'', estoque?: 'BAIXO'|'ZERADO'|'NORMAL'|'', pagina?: number, tamanho?: number }} filtros
 * @returns {Promise<{ itens: object[], totalRegistros: number, totalPaginas: number, pagina: number }>}
 */
export async function listarMeusAnuncios(filtros = {}) {
  if (USAR_SIMULACAO) return simularListar(filtros);
  // const params = new URLSearchParams({ loja: 'minha' });
  // Object.entries(filtros).forEach(([chave, valor]) => { if (valor !== '' && valor != null) params.set(chave, valor); });
  // return api.get(`/pecas?${params}`);
}

/**
 * PATCH /api/pecas/{id}/pausar — tira o anúncio das buscas sem excluir (BP1-46).
 * @returns {Promise<{ idPeca: number, status: 'PAUSADO', atualizadoEm: string }>}
 * Rejeita com 409 STATUS_INVALIDO se o anúncio não estiver ativo (ex.: já pausado em outra aba).
 */
export async function pausarAnuncio(idPeca) {
  if (USAR_SIMULACAO) return simularMudarStatus(idPeca, 'PAUSADO');
  // return api.patch(`/pecas/${idPeca}/pausar`);
}

/**
 * PATCH /api/pecas/{id}/reativar — volta o anúncio pausado para as buscas (BP1-46).
 * @returns {Promise<{ idPeca: number, status: 'ATIVO', atualizadoEm: string }>}
 * Rejeita com 409 ESTOQUE_ZERADO se a quantidade for 0, ou 409 STATUS_INVALIDO se não estiver pausado.
 */
export async function reativarAnuncio(idPeca) {
  if (USAR_SIMULACAO) return simularMudarStatus(idPeca, 'ATIVO');
  // return api.patch(`/pecas/${idPeca}/reativar`);
}

/** DELETE /api/pecas/{id} — exclusão lógica (BP1-44) */
export async function excluirAnuncio(idPeca) {
  if (USAR_SIMULACAO) return simularExcluir(idPeca);
  // return api.delete(`/pecas/${idPeca}`);
}

/**
 * GET /api/pecas/autopreenchimento?codigo=&tipo= — consulta a base externa de códigos (BP1-9, BP1-63).
 * @param {'OEM'|'EAN'|'SKU'} tipo
 * @returns {Promise<object|null>} dados de referência, ou null quando o código não é encontrado.
 * Rejeita com { status: 503 | 504 } quando a base externa está fora do ar ou demora (ADR-012).
 */
export async function consultarReferencia(tipo, codigo) {
  if (USAR_SIMULACAO) return simularReferencia(tipo, codigo);
  try {
    return await api.get(`/pecas/autopreenchimento?${new URLSearchParams({ tipo, codigo })}`);
  } catch (erro) {
    if (erro?.status === 404) return null;
    throw erro;
  }
}

/**
 * GET /api/pecas/{id} — carrega um anúncio da própria loja para editar no formulário.
 * @returns {Promise<{ dados: object, aplicacoes: object[], fotos: { idFoto: number, url: string }[] }>}
 */
export async function obterPecaParaEdicao(idPeca) {
  if (USAR_SIMULACAO) return simularObterPeca(idPeca);
  const peca = await api.get(`/pecas/${idPeca}`);
  return { dados: peca, aplicacoes: peca.aplicacoes || [], fotos: peca.fotos || [] };
}

/**
 * Salva o anúncio inteiro, como rascunho ou publicado (BP1-3, 45, 47). Faz em sequência:
 *   1. POST /api/pecas (novo) ou PUT /api/pecas/{id} (edição) com os dados e o status;
 *   2. PUT /api/pecas/{id}/compatibilidades com as aplicações;
 *   3. DELETE /api/pecas/{id}/fotos/{idFoto} das fotos removidas;
 *   4. POST /api/pecas/{id}/fotos (multipart) com as fotos novas;
 *   5. PATCH /api/pecas/{id}/fotos/ordem com a ordem final (a primeira é a capa).
 *
 * @param {{ idPeca?: number, dados: object, aplicacoes: object[],
 *           fotos: { idFoto?: number, arquivo?: File }[], fotosRemovidas: number[],
 *           status: 'RASCUNHO'|'ATIVO'|'PAUSADO' }} anuncio
 * @returns {Promise<{ idPeca: number, salvoEm: string }>}
 */
export async function salvarAnuncio(anuncio) {
  if (USAR_SIMULACAO) return simularSalvar(anuncio);

  const { idPeca, dados, aplicacoes, fotos, fotosRemovidas, status } = anuncio;
  const corpo = { ...dados, status };
  const peca = idPeca ? await api.put(`/pecas/${idPeca}`, corpo) : await api.post('/pecas', corpo);
  const id = peca.idPeca;

  await api.put(`/pecas/${id}/compatibilidades`, { aplicacoes });

  for (const idFoto of fotosRemovidas) await api.delete(`/pecas/${id}/fotos/${idFoto}`);

  const novas = fotos.filter((f) => f.arquivo);
  let idsNovos = [];
  if (novas.length) {
    const formulario = new FormData();
    novas.forEach((f) => formulario.append('fotos', f.arquivo));
    const enviadas = await api.post(`/pecas/${id}/fotos`, formulario); // api.js não deve pôr Content-Type em FormData
    idsNovos = enviadas.map((f) => f.idFoto);
  }

  let proximaNova = 0;
  const ordem = fotos.map((f) => (f.arquivo ? idsNovos[proximaNova++] : f.idFoto));
  if (ordem.length) await api.patch(`/pecas/${id}/fotos/ordem`, { ordem });

  return { idPeca: id, salvoEm: peca.atualizadoEm || new Date().toISOString() };
}

/**
 * GET /api/pecas/{id}/historico-preco — alterações de preço, da mais recente para a mais antiga (BP1-53).
 * A linha mais antiga (precoAnterior nulo) é a publicação do anúncio.
 * @returns {Promise<{ data: string, precoAnterior: number|null, precoNovo: number }[]>}
 */
export async function obterHistoricoPreco(idPeca) {
  if (USAR_SIMULACAO) {
    await esperar(350);
    return gerarHistoricoPreco(idPeca);
  }
  // return api.get(`/pecas/${idPeca}/historico-preco`);
}

// ---------------------------------------------------------------------------
// Simulações (apagar quando a API estiver pronta)
// ---------------------------------------------------------------------------

function nivelEstoque(peca) {
  if (peca.quantidadeEstoque === 0) return 'ZERADO';
  if (peca.quantidadeEstoque <= peca.limiteAlertaEstoque) return 'BAIXO';
  return 'NORMAL';
}

async function simularListar({ q = '', status = '', estoque = '', pagina = 1, tamanho = 5 }) {
  await esperar(450);
  const termo = q.trim().toLowerCase();
  const filtrados = anunciosSimulados.filter((p) =>
    (!termo || `${p.titulo} ${p.codigoSku}`.toLowerCase().includes(termo))
    && (!status || p.status === status)
    && (!estoque || nivelEstoque(p) === estoque));

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanho));
  const inicio = (pagina - 1) * tamanho;
  return {
    itens: filtrados.slice(inicio, inicio + tamanho).map((p) => ({ ...p })),
    totalRegistros: filtrados.length,
    totalPaginas,
    pagina,
  };
}

async function simularMudarStatus(idPeca, novoStatus) {
  await esperar(400);
  const peca = anunciosSimulados.find((p) => p.idPeca === Number(idPeca));
  if (!peca) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Anúncio não encontrado.' };
  // As mesmas regras que a API vai aplicar
  if (novoStatus === 'PAUSADO' && peca.status !== 'ATIVO') {
    throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'Só anúncios ativos podem ser pausados. A lista foi atualizada.' };
  }
  if (novoStatus === 'ATIVO' && peca.status !== 'PAUSADO') {
    throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'Só anúncios pausados podem ser reativados. A lista foi atualizada.' };
  }
  if (novoStatus === 'ATIVO' && peca.quantidadeEstoque === 0) {
    throw { status: 409, erro: 'ESTOQUE_ZERADO', mensagem: 'Este anúncio está sem estoque. Atualize a quantidade antes de reativar.' };
  }
  peca.status = novoStatus;
  peca.atualizadoEm = new Date().toISOString();
  return { idPeca: peca.idPeca, status: peca.status, atualizadoEm: peca.atualizadoEm };
}

async function simularExcluir(idPeca) {
  await esperar(400);
  const indice = anunciosSimulados.findIndex((p) => p.idPeca === idPeca);
  if (indice === -1) throw { status: 404, mensagem: 'Anúncio não encontrado.' };
  anunciosSimulados.splice(indice, 1);
}

async function simularReferencia(tipo, codigo) {
  await esperar(900);
  console.info('[simulação] GET /api/pecas/autopreenchimento', { tipo, codigo });
  // Para testar a base externa fora do ar, use o código 999.
  if (codigo === '999') throw { status: 504, mensagem: 'Base externa sem resposta.' };
  const referencia = referenciasSimuladas[codigo];
  return referencia ? structuredClone(referencia) : null;
}

async function simularObterPeca(idPeca) {
  await esperar(500);
  const p = anunciosSimulados.find((a) => a.idPeca === Number(idPeca));
  if (!p) throw { status: 404, mensagem: 'Anúncio não encontrado.' };
  return {
    dados: {
      titulo: p.titulo, descricao: p.descricao || '', idCategoria: p.idCategoria || null, marcaPeca: p.marcaPeca || '',
      codigoOem: p.codigoOem || '', codigoEan: p.codigoEan || '', codigoSku: p.codigoSku || '',
      caracteristicas: p.caracteristicas || '', condicao: p.condicao, origem: p.origem, preco: p.preco,
      quantidadeEstoque: p.quantidadeEstoque, prontaEntrega: p.prontaEntrega, prazoExpedicaoDias: p.prazoExpedicaoDias,
      status: p.status, atualizadoEm: p.atualizadoEm || null,
    },
    aplicacoes: structuredClone(p.aplicacoes || []),
    fotos: [],
  };
}

async function simularSalvar({ idPeca, dados, aplicacoes, fotos, status }) {
  await esperar(1000);
  console.info('[simulação] salvar anúncio', { idPeca, status, dados, aplicacoes, fotos: fotos.length });
  const salvoEm = new Date().toISOString();
  const registro = { ...dados, aplicacoes, status, limiteAlertaEstoque: 1, atualizadoEm: salvoEm };
  if (idPeca) {
    const existente = anunciosSimulados.find((a) => a.idPeca === Number(idPeca));
    Object.assign(existente, registro);
    return { idPeca: existente.idPeca, salvoEm };
  }
  const novoId = Math.max(0, ...anunciosSimulados.map((a) => a.idPeca)) + 1;
  anunciosSimulados.unshift({ idPeca: novoId, ...registro });
  return { idPeca: novoId, salvoEm };
}