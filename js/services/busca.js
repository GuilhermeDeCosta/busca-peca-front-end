// Serviço de busca: uma função por rota de /api/busca (Documentação do Back-end, seção 5.4).
//
// ENQUANTO A API NÃO EXISTE: USAR_SIMULACAO = true devolve respostas falsas no
// mesmo formato que a API vai devolver, para a tela funcionar de ponta a ponta.
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS:
//   1. Descomente o import do api.js abaixo e as linhas "return api...".
//   2. Troque USAR_SIMULACAO para false.
//   3. Apague as funções simular*() do fim do arquivo e o import de ./simulacao-busca.js.

// import { api } from '../api.js';
import { esperar, pecasSimuladas, favoritosSimulados } from './simulacao-busca.js';

const USAR_SIMULACAO = true;

/**
 * GET /api/busca — busca por texto ou código com filtros (BP1-4, 6, 7, 8, 13, 14, 15, 17, 18).
 * Só manda os filtros preenchidos.
 *
 * @param {{
 *   q?: string, codigo?: string, categoria?: number, veiculo?: number, condicao?: string, origem?: string,
 *   prontaEntrega?: boolean, cep?: string, lat?: string, lng?: string, raioKm?: number,
 *   ordenar?: 'relevancia'|'preco'|'distancia'|'avaliacao', pagina?: number, tamanho?: number
 * }} filtros
 * @returns {Promise<{ itens: object[], pagina: number, tamanho: number, totalRegistros: number, totalPaginas: number }>}
 *   Cada item: { idPeca, titulo, codigoOem, codigoSku, codigoEan, marcaPeca, preco, precoPromocional,
 *   condicao, origem, quantidadeEstoque, prontaEntrega, prazoExpedicaoDias, fotoUrl, favorito,
 *   distanciaKm (só com cep ou lat/lng), loja: { idLoja, nomeLoja, avaliacaoMedia, cidade, estado } }
 * Em caso de erro, rejeita com { status, erro, mensagem, campos } (seção 6 do back-end).
 */
export async function buscarPecas(filtros = {}) {
  if (USAR_SIMULACAO) return simularBusca(filtros);
  // const params = new URLSearchParams();
  // Object.entries(filtros).forEach(([chave, valor]) => { if (valor !== '' && valor != null) params.set(chave, valor); });
  // return api.get(`/busca?${params}`);
}

// ---------------------------------------------------------------------------
// Simulação (apagar junto com simulacao-busca.js)
// ---------------------------------------------------------------------------

const semAcento = (texto = '') => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function simularBusca({ q, categoria, prontaEntrega, cep, lat, ordenar = 'relevancia', pagina = 1, tamanho = 20 } = {}) {
  await esperar(450);
  const temLocal = Boolean(cep || lat);
  const termo = semAcento(q);

  let itens = pecasSimuladas.filter((p) => {
    if (termo && !semAcento([p.titulo, p.codigoOem, p.codigoSku, p.codigoEan, p.marcaPeca].join(' ')).includes(termo)) return false;
    if (categoria && Number(categoria) !== p.idCategoria) return false;
    if (prontaEntrega && !p.prontaEntrega) return false;
    return p.quantidadeEstoque > 0;
  });

  const ordens = {
    relevancia: (a, b) => b.publicadoEm.localeCompare(a.publicadoEm),
    preco: (a, b) => (a.precoPromocional ?? a.preco) - (b.precoPromocional ?? b.preco),
    distancia: (a, b) => a.loja.distanciaKm - b.loja.distanciaKm,
    avaliacao: (a, b) => b.loja.avaliacaoMedia - a.loja.avaliacaoMedia,
  };
  itens = [...itens].sort(ordens[ordenar] || ordens.relevancia);

  const totalRegistros = itens.length;
  const inicio = (pagina - 1) * tamanho;
  return {
    itens: itens.slice(inicio, inicio + tamanho).map((p) => {
      const { distanciaKm, ...loja } = p.loja;
      return {
        ...structuredClone(p),
        loja: { ...loja },
        distanciaKm: temLocal ? distanciaKm : null, // a API só calcula a distância com localização
        favorito: favoritosSimulados.has(p.idPeca),
      };
    }),
    pagina,
    tamanho,
    totalRegistros,
    totalPaginas: Math.max(1, Math.ceil(totalRegistros / tamanho)),
  };
}
