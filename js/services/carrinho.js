// Serviço do carrinho: uma função por rota de /api/carrinho (Documentação do Back-end, seção 5.7).
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS:
//   1. Descomente o import do api.js abaixo e as linhas "return api...".
//   2. Troque USAR_SIMULACAO para false.
//   3. Apague as funções simular*() do fim do arquivo e o import de ./simulacao-busca.js.

// import { api } from '../api.js';
import { esperar, pecasSimuladas, carrinhoSimulado } from './simulacao-busca.js';

const USAR_SIMULACAO = true;

/**
 * POST /api/carrinho/itens — adiciona uma peça ao carrinho; a API confere o estoque (BP1-22).
 * Acesso: logado. A tela leva o visitante ao login antes de chamar.
 * @returns {Promise<{ idPeca: number, quantidade: number, quantidadeTotal: number }>}
 *   quantidadeTotal = soma das unidades no carrinho, para o contador do cabeçalho.
 * Rejeita com 401 (sessão encerrada) ou 409 ESTOQUE_INSUFICIENTE, no formato único de erro da API.
 */
export async function adicionarAoCarrinho(idPeca, quantidade = 1) {
  if (USAR_SIMULACAO) return simularAdicionar(idPeca, quantidade);
  // return api.post('/carrinho/itens', { idPeca, quantidade });
}

// ---------------------------------------------------------------------------
// Simulação (apagar junto com simulacao-busca.js)
// ---------------------------------------------------------------------------

async function simularAdicionar(idPeca, quantidade) {
  await esperar(500);
  const peca = pecasSimuladas.find((p) => p.idPeca === idPeca);
  if (!peca) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Este anúncio não está mais disponível.' };

  const novaQuantidade = (carrinhoSimulado.get(idPeca) || 0) + quantidade;
  if (novaQuantidade > peca.quantidadeEstoque) {
    throw {
      status: 409,
      erro: 'ESTOQUE_INSUFICIENTE',
      mensagem: `Estoque insuficiente. A loja tem ${peca.quantidadeEstoque} em estoque e você já tem ${carrinhoSimulado.get(idPeca) || 0} no carrinho.`,
    };
  }
  carrinhoSimulado.set(idPeca, novaQuantidade);
  const quantidadeTotal = [...carrinhoSimulado.values()].reduce((soma, n) => soma + n, 0);
  return { idPeca, quantidade: novaQuantidade, quantidadeTotal };
}
