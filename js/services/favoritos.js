// Serviço de favoritos: uma função por rota de /api/favoritos (Documentação do Back-end, seção 5.4).
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS:
//   1. Descomente o import do api.js abaixo e as linhas "return api...".
//   2. Troque USAR_SIMULACAO para false.
//   3. Apague as funções simular*() do fim do arquivo e o import de ./simulacao-busca.js.

// import { api } from '../api.js';
import { esperar, favoritosSimulados } from './simulacao-busca.js';

const USAR_SIMULACAO = true;

/**
 * POST /api/favoritos — favorita uma peça (BP1-48). Acesso: logado.
 * @returns {Promise<{ idPeca: number }>}
 */
export async function adicionarFavorito(idPeca) {
  if (USAR_SIMULACAO) {
    await esperar(300);
    favoritosSimulados.add(idPeca);
    return { idPeca };
  }
  // return api.post('/favoritos', { idPeca });
}

/**
 * DELETE /api/favoritos/{idPeca} — remove dos favoritos (BP1-48). Acesso: logado.
 * @returns {Promise<null>}
 */
export async function removerFavorito(idPeca) {
  if (USAR_SIMULACAO) {
    await esperar(300);
    favoritosSimulados.delete(idPeca);
    return null;
  }
  // return api.delete(`/favoritos/${idPeca}`);
}
