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

/**
 * GET /api/carrinho — itens agrupados por loja, com subtotal por loja (BP1-22, ADR-009).
 * Acesso: logado (401 sem login). Cada loja vira um pedido separado no checkout.
 * @returns {Promise<{
 *   lojas: { loja: { idLoja, nomeLoja, retiradaBalcao, entregaCombinar, motoboyProprio }, subtotal: number,
 *     itens: { idItem, quantidade, precoUnitario, subtotal, estoqueSuficiente: boolean,
 *       peca: { idPeca, titulo, codigoOem, codigoSku, marcaPeca, fotoUrl, quantidadeEstoque, prontaEntrega, prazoExpedicaoDias } }[] }[],
 *   quantidadeTotal: number, total: number }>}
 * Os valores vêm calculados pela API; a tela só mostra (nenhuma regra de negócio no front).
 */
export async function obterCarrinho() {
  if (USAR_SIMULACAO) { await esperar(350); return montarCarrinhoSimulado(); }
  // return api.get('/carrinho');
}

/**
 * PATCH /api/carrinho/itens/{id} — muda a quantidade; a API confere o estoque (BP1-22).
 * @returns {Promise<object>} o carrinho atualizado (mesmo formato de obterCarrinho)
 * Rejeita com 409 ESTOQUE_INSUFICIENTE: "Quantidade indisponível no estoque no momento".
 */
export async function alterarQuantidadeItem(idItem, quantidade) {
  if (USAR_SIMULACAO) {
    await esperar(300);
    const peca = pecasSimuladas.find((p) => p.idPeca === Number(idItem));
    if (!peca || !carrinhoSimulado.has(peca.idPeca)) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Este item não está mais no carrinho.' };
    if (quantidade > peca.quantidadeEstoque) {
      throw { status: 409, erro: 'ESTOQUE_INSUFICIENTE', mensagem: `Quantidade indisponível no estoque no momento. A loja tem ${peca.quantidadeEstoque}.` };
    }
    carrinhoSimulado.set(peca.idPeca, Math.max(1, quantidade));
    return montarCarrinhoSimulado();
  }
  // return api.patch(`/carrinho/itens/${idItem}`, { quantidade });
}

/**
 * DELETE /api/carrinho/itens/{id} — tira o item do carrinho.
 * @returns {Promise<object>} o carrinho atualizado
 */
export async function removerItemCarrinho(idItem) {
  if (USAR_SIMULACAO) {
    await esperar(300);
    carrinhoSimulado.delete(Number(idItem));
    return montarCarrinhoSimulado();
  }
  // await api.delete(`/carrinho/itens/${idItem}`);
  // return api.get('/carrinho');
}

/**
 * POST /api/carrinho/frete — frete e prazo por loja a partir do CEP (BP1-23).
 * Se o serviço de frete falhar, a loja volta com freteACombinar: true (ADR-012).
 * @param {string} cep só dígitos
 * @returns {Promise<{ regiao: { cidade, uf }, lojas: { idLoja, nomeLoja, retiradaBalcao, freteACombinar: boolean,
 *   opcoes: { tipo: 'NORMAL'|'EXPRESSO', valor: number, prazoDias: number }[] }[] }>}
 * Rejeita com 400 CEP_INVALIDO: "CEP inválido ou área sem cobertura de entrega".
 */
export async function calcularFrete(cep) {
  if (USAR_SIMULACAO) {
    await esperar(600);
    if (!/^\d{8}$/.test(cep) || /^0+$/.test(cep)) {
      throw { status: 400, erro: 'CEP_INVALIDO', mensagem: 'CEP inválido ou área sem cobertura de entrega', campos: [{ campo: 'cep' }] };
    }
    const carrinho = montarCarrinhoSimulado();
    // Simulação do protótipo A07: região encontrada, mas o serviço de frete está indisponível (fallback)
    return {
      regiao: cep.startsWith('13') ? { cidade: 'Campinas', uf: 'SP' } : { cidade: '', uf: '' },
      lojas: carrinho.lojas.map(({ loja }) => ({
        idLoja: loja.idLoja, nomeLoja: loja.nomeLoja, retiradaBalcao: loja.retiradaBalcao, freteACombinar: true, opcoes: [],
      })),
    };
  }
  // return api.post('/carrinho/frete', { cep });
}

// ---------------------------------------------------------------------------
// Simulação do carrinho (apagar junto com simulacao-busca.js)
// ---------------------------------------------------------------------------

function montarCarrinhoSimulado() {
  const porLoja = new Map();
  carrinhoSimulado.forEach((quantidade, idPeca) => {
    const p = pecasSimuladas.find((x) => x.idPeca === idPeca);
    if (!p) return;
    const preco = p.precoPromocional ?? p.preco;
    if (!porLoja.has(p.loja.idLoja)) {
      const { idLoja, nomeLoja, retiradaBalcao, entregaCombinar, motoboyProprio } = p.loja;
      porLoja.set(idLoja, { loja: { idLoja, nomeLoja, retiradaBalcao, entregaCombinar, motoboyProprio }, itens: [], subtotal: 0 });
    }
    const grupo = porLoja.get(p.loja.idLoja);
    const subtotal = Math.round(preco * quantidade * 100) / 100;
    grupo.itens.push({
      idItem: p.idPeca, // na simulação o id do item é o id da peça
      quantidade,
      precoUnitario: preco,
      subtotal,
      estoqueSuficiente: quantidade <= p.quantidadeEstoque,
      peca: {
        idPeca: p.idPeca, titulo: p.titulo, codigoOem: p.codigoOem, codigoSku: p.codigoSku, marcaPeca: p.marcaPeca,
        fotoUrl: p.fotoUrl, quantidadeEstoque: p.quantidadeEstoque, prontaEntrega: p.prontaEntrega, prazoExpedicaoDias: p.prazoExpedicaoDias,
      },
    });
    grupo.subtotal = Math.round((grupo.subtotal + subtotal) * 100) / 100;
  });
  const lojas = [...porLoja.values()];
  return {
    lojas,
    quantidadeTotal: [...carrinhoSimulado.values()].reduce((s, n) => s + n, 0),
    total: Math.round(lojas.reduce((s, l) => s + l.subtotal, 0) * 100) / 100,
  };
}