// Serviço de peças: uma função por rota de /api/pecas (Documentação do Back-end, seção 5.5).
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS:
//   1. Descomente o import do api.js.
//   2. Troque USAR_SIMULACAO para false e apague o import de ./simulacao.js.
//   3. Apague as funções simular*() do fim do arquivo.

// import { api } from '../api.js';
import { esperar, anunciosSimulados } from './simulacao.js';

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

/** PATCH /api/pecas/{id}/pausar (BP1-46) */
export async function pausarAnuncio(idPeca) {
  if (USAR_SIMULACAO) return simularMudarStatus(idPeca, 'PAUSADO');
  // return api.patch(`/pecas/${idPeca}/pausar`);
}

/** PATCH /api/pecas/{id}/reativar (BP1-46) */
export async function reativarAnuncio(idPeca) {
  if (USAR_SIMULACAO) return simularMudarStatus(idPeca, 'ATIVO');
  // return api.patch(`/pecas/${idPeca}/reativar`);
}

/** DELETE /api/pecas/{id} — exclusão lógica (BP1-44) */
export async function excluirAnuncio(idPeca) {
  if (USAR_SIMULACAO) return simularExcluir(idPeca);
  // return api.delete(`/pecas/${idPeca}`);
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
  const peca = anunciosSimulados.find((p) => p.idPeca === idPeca);
  if (!peca) throw { status: 404, mensagem: 'Anúncio não encontrado.' };
  if (novoStatus === 'ATIVO' && peca.quantidadeEstoque === 0) {
    throw { status: 409, erro: 'ESTOQUE_ZERADO', mensagem: 'Atualize o estoque antes de reativar este anúncio.' };
  }
  peca.status = novoStatus;
  return { ...peca };
}

async function simularExcluir(idPeca) {
  await esperar(400);
  const indice = anunciosSimulados.findIndex((p) => p.idPeca === idPeca);
  if (indice === -1) throw { status: 404, mensagem: 'Anúncio não encontrado.' };
  anunciosSimulados.splice(indice, 1);
}