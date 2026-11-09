// Serviço de pedidos: uma função por rota de /api/pedidos (Documentação do Back-end, seção 5.8).
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS: descomente o import do api.js,
// troque USAR_SIMULACAO para false e apague a simulação.

// import { api } from '../api.js';
import { esperar, pedidosSimulados } from './simulacao.js';

const USAR_SIMULACAO = true;

/**
 * GET /api/pedidos?loja=minha&status= — pedidos recebidos pela loja (BP1-26).
 * @param {{ status?: string, pagina?: number, tamanho?: number }} filtros
 * @returns {Promise<{ itens: object[], totalRegistros: number, totalPaginas: number, pagina: number }>}
 */
export async function listarPedidosRecebidos({ status = '', pagina = 1, tamanho = 3 } = {}) {
  if (USAR_SIMULACAO) {
    await esperar(500);
    const filtrados = pedidosSimulados.filter((p) => !status || p.status === status);
    return {
      itens: filtrados.slice((pagina - 1) * tamanho, pagina * tamanho),
      totalRegistros: filtrados.length,
      totalPaginas: Math.max(1, Math.ceil(filtrados.length / tamanho)),
      pagina,
    };
  }
  // const params = new URLSearchParams({ loja: 'minha', pagina, tamanho });
  // if (status) params.set('status', status);
  // return api.get(`/pedidos?${params}`);
}