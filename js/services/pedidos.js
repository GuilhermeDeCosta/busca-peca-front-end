// Serviço de pedidos: uma função por rota de /api/pedidos (Documentação do Back-end v2, seção 5.8).
//
// QUANDO A API ESTIVER PRONTA: troque USAR_SIMULACAO para false e apague o bloco
// "SIMULAÇÃO" do fim do arquivo. listarPedidosRecebidos ainda tem a chamada
// comentada: descomente as 3 linhas dela.
//
// Status do pedido (ADR-009): AGUARDANDO_ACEITE → ACEITO ou RECUSADO →
// EM_PREPARACAO → PRONTO_RETIRADA ou EM_ENTREGA → CONCLUIDO; CANCELADO antes do envio.
// EM_PREPARACAO vem do protótipo (Fluxo C) e ainda precisa entrar na API e no banco.

import { api } from '../api.js';
import { esperar, pedidosSimulados } from './simulacao.js';

export const USAR_SIMULACAO = true;

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

/**
 * GET /api/pedidos/{id} — detalhe do pedido (BP1-27). Comprador ou vendedor do pedido.
 * Formato esperado (PedidoDetalheResponse). Campos marcados "opcional" a tela trata se faltarem:
 * {
 *   idPedido: 2081, codigo: 'BP-2081', status: 'AGUARDANDO_ACEITE',
 *   dataPedido: '2026-10-16T10:15:00',
 *   modalidadeEntrega: 'RETIRADA' | 'ENTREGA',
 *   valorItens: 749.0, valorFrete: 0,
 *   observacao: 'Bom dia! …',                 // opcional: recado do comprador no checkout
 *   motivoRecusa: null, motivoCancelamento: null,
 *   idConversa: 501,                          // opcional: null se ainda não há conversa
 *   comprador: { nome: 'Oficina Rumo Certo', cidade: 'Campinas', estado: 'SP',
 *                nomeContato: 'Carlos Pereira', telefone: '19900000202' },
 *   enderecoEntrega: 'Rua …, Campinas/SP',    // opcional: só quando ENTREGA
 *   itens: [{ idPeca, titulo, descricaoCurta, sku, codigoOem, quantidade, precoUnitario, estoqueAtual }],
 *   historico: [{ status: 'AGUARDANDO_ACEITE', data: '…' }, …],  // opcional: datas da linha do tempo
 *   entrega: { modalidade, transportadora, codigoRastreio }       // opcional: depois de "enviar"
 * }
 * O vendedor NUNCA recebe o código de retirada: ele é conferido em confirmar-retirada.
 */
export async function obterPedido(idPedido) {
  if (USAR_SIMULACAO) {
    await esperar(500);
    return copia(buscarSimulado(idPedido));
  }
  return api.get(`/pedidos/${encodeURIComponent(idPedido)}`);
}

/** PATCH /api/pedidos/{id}/aceitar — aceita o pedido (BP1-26). Devolve o pedido atualizado. */
export async function aceitarPedido(idPedido) {
  if (USAR_SIMULACAO) return simularMudanca(idPedido, ['AGUARDANDO_ACEITE'], 'ACEITO');
  return api.patch(`/pedidos/${encodeURIComponent(idPedido)}/aceitar`);
}

/**
 * PATCH /api/pedidos/{id}/recusar — recusa com motivo e devolve o estoque (BP1-26, ADR-009).
 * Corpo: { motivo: 'Peça sem estoque físico', mensagem: 'texto ao comprador' }.
 * motivo vai para pedido.motivo_recusa (até 255 caracteres); mensagem segue para o comprador.
 */
export async function recusarPedido(idPedido, { motivo, mensagem }) {
  if (USAR_SIMULACAO) {
    const pedido = await simularMudanca(idPedido, ['AGUARDANDO_ACEITE'], 'RECUSADO', (p) => {
      p.motivoRecusa = motivo;
      p.itens.forEach((i) => { i.estoqueAtual += i.quantidade; }); // devolve ao estoque
    });
    return pedido;
  }
  return api.patch(`/pedidos/${encodeURIComponent(idPedido)}/recusar`, { motivo, mensagem });
}

/** PATCH /api/pedidos/{id}/em-preparacao — ROTA NOVA (protótipo Fluxo C), ainda não está na documentação da API. */
export async function marcarEmPreparacao(idPedido) {
  if (USAR_SIMULACAO) return simularMudanca(idPedido, ['ACEITO'], 'EM_PREPARACAO');
  return api.patch(`/pedidos/${encodeURIComponent(idPedido)}/em-preparacao`);
}

/** PATCH /api/pedidos/{id}/pronto-retirada — marca como pronto para retirada (BP1-29). */
export async function marcarProntoRetirada(idPedido) {
  if (USAR_SIMULACAO) return simularMudanca(idPedido, ['ACEITO', 'EM_PREPARACAO'], 'PRONTO_RETIRADA');
  return api.patch(`/pedidos/${encodeURIComponent(idPedido)}/pronto-retirada`);
}

/**
 * POST /api/pedidos/{id}/confirmar-retirada — confere o código do balcão e conclui (BP1-29).
 * Corpo: { codigo: 'HP-3318' }. Código errado: 422 com erro CODIGO_RETIRADA_INVALIDO.
 */
export async function confirmarRetirada(idPedido, codigo) {
  if (USAR_SIMULACAO) {
    await esperar(600);
    const p = buscarSimulado(idPedido);
    if (normalizarCodigo(codigoRetiradaSimulado[p.idPedido]) !== normalizarCodigo(codigo)) {
      throw { status: 422, erro: 'CODIGO_RETIRADA_INVALIDO', mensagem: 'Código de retirada não confere.' };
    }
    return simularMudanca(idPedido, ['PRONTO_RETIRADA'], 'CONCLUIDO', null, 0);
  }
  return api.post(`/pedidos/${encodeURIComponent(idPedido)}/confirmar-retirada`, { codigo });
}

/**
 * PATCH /api/pedidos/{id}/enviar — registra o envio (BP1-33). Só para ENTREGA.
 * Corpo: { modalidade: 'PROPRIA' | 'TRANSPORTADORA' | 'MOTOBOY', transportadora?, codigoRastreio? }
 */
export async function registrarEnvio(idPedido, dadosEnvio) {
  if (USAR_SIMULACAO) {
    return simularMudanca(idPedido, ['ACEITO', 'EM_PREPARACAO'], 'EM_ENTREGA', (p) => { p.entrega = { ...dadosEnvio }; });
  }
  return api.patch(`/pedidos/${encodeURIComponent(idPedido)}/enviar`, dadosEnvio);
}

/** PATCH /api/pedidos/{id}/concluir — confirma a entrega combinada (BP1-27). */
export async function concluirEntrega(idPedido) {
  if (USAR_SIMULACAO) return simularMudanca(idPedido, ['EM_ENTREGA'], 'CONCLUIDO');
  return api.patch(`/pedidos/${encodeURIComponent(idPedido)}/concluir`);
}

export function normalizarCodigo(codigo) {
  return String(codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// =========================================================================
// SIMULAÇÃO — apagar este bloco quando a API estiver pronta.
// Os ids são os mesmos de pedidosSimulados (simulacao.js), para os links do
// painel e de vendas abrirem um pedido. As mudanças ficam em memória.
// =========================================================================

const copia = (obj) => structuredClone(obj);

// Só a simulação conhece os códigos; a API real nunca manda o código ao vendedor.
const codigoRetiradaSimulado = { 2081: 'HP-3318', 2080: 'HP-4410', 2078: 'HP-2207', 2077: 'HP-1975' };

const compradorRumoCerto = {
  nome: 'Oficina Rumo Certo', cidade: 'Campinas', estado: 'SP',
  nomeContato: 'Carlos Pereira', telefone: '19900000202',
};

const detalhesSimulados = {
  2081: {
    idPedido: 2081, codigo: 'BP-2081', status: 'AGUARDANDO_ACEITE', dataPedido: '2026-10-16T10:15:00-03:00',
    modalidadeEntrega: 'RETIRADA', valorItens: 749.0, valorFrete: 0, idConversa: 501,
    observacao: 'Bom dia! Consigo retirar o alternador amanhã?',
    comprador: compradorRumoCerto,
    itens: [{ idPeca: 101, titulo: 'Alternador Bosch 90A', descricaoCurta: 'linha GM', sku: 'ALT-90GM', codigoOem: '0124325163', quantidade: 1, precoUnitario: 749.0, estoqueAtual: 1 }],
    historico: [{ status: 'AGUARDANDO_ACEITE', data: '2026-10-16T10:15:00-03:00' }],
  },
  2080: {
    idPedido: 2080, codigo: 'BP-2080', status: 'ACEITO', dataPedido: '2026-10-16T08:40:00-03:00',
    modalidadeEntrega: 'RETIRADA', valorItens: 85.8, valorFrete: 0, idConversa: 502, observacao: '',
    comprador: { nome: 'Mecânica Boa Vista', cidade: 'Campinas', estado: 'SP', nomeContato: 'Rita Souza', telefone: '19900000303' },
    itens: [{ idPeca: 103, titulo: 'Filtro de ar Tecfil ARL6079', descricaoCurta: 'Gol, Fox e Polo', sku: 'FAR-6079', codigoOem: '6Q0129620', quantidade: 2, precoUnitario: 42.9, estoqueAtual: 6 }],
    historico: [{ status: 'AGUARDANDO_ACEITE', data: '2026-10-16T08:40:00-03:00' }, { status: 'ACEITO', data: '2026-10-16T09:02:00-03:00' }],
  },
  2079: {
    idPedido: 2079, codigo: 'BP-2079', status: 'AGUARDANDO_ACEITE', dataPedido: '2026-10-15T16:05:00-03:00',
    modalidadeEntrega: 'ENTREGA', valorItens: 689.0, valorFrete: 35.0, idConversa: null,
    observacao: 'Entregar no período da tarde, por favor.',
    comprador: { nome: 'Centro Automotivo Lima', cidade: 'Valinhos', estado: 'SP', nomeContato: 'João Lima', telefone: '19900000404' },
    enderecoEntrega: 'Av. dos Imigrantes, 455 • Centro • Valinhos/SP • CEP 13270-000',
    itens: [{ idPeca: 110, titulo: 'Kit embreagem LUK', descricaoCurta: 'VW Gol G5 1.0', sku: 'EMB-GOL10', codigoOem: '620307400', quantidade: 1, precoUnitario: 689.0, estoqueAtual: 0 }],
    historico: [{ status: 'AGUARDANDO_ACEITE', data: '2026-10-15T16:05:00-03:00' }],
  },
  2078: {
    idPedido: 2078, codigo: 'BP-2078', status: 'PRONTO_RETIRADA', dataPedido: '2026-10-15T11:30:00-03:00',
    modalidadeEntrega: 'RETIRADA', valorItens: 219.9, valorFrete: 0, idConversa: 503, observacao: '',
    comprador: { nome: 'Auto Center Parque', cidade: 'Campinas', estado: 'SP', nomeContato: 'Marcos Dias', telefone: '19900000505' },
    itens: [{ idPeca: 102, titulo: 'Retrovisor Onix', descricaoCurta: 'lado esquerdo, elétrico', sku: 'RET-ON20', codigoOem: '52153456', quantidade: 1, precoUnitario: 219.9, estoqueAtual: 1 }],
    historico: [
      { status: 'AGUARDANDO_ACEITE', data: '2026-10-15T11:30:00-03:00' }, { status: 'ACEITO', data: '2026-10-15T11:48:00-03:00' },
      { status: 'EM_PREPARACAO', data: '2026-10-15T13:10:00-03:00' }, { status: 'PRONTO_RETIRADA', data: '2026-10-15T15:20:00-03:00' },
    ],
  },
  2077: {
    idPedido: 2077, codigo: 'BP-2077', status: 'CONCLUIDO', dataPedido: '2026-10-14T14:20:00-03:00',
    modalidadeEntrega: 'RETIRADA', valorItens: 96.0, valorFrete: 0, idConversa: null, observacao: '',
    comprador: { nome: 'Garagem São Jorge', cidade: 'Sumaré', estado: 'SP', nomeContato: 'Jorge Alves', telefone: '19900000606' },
    itens: [{ idPeca: 111, titulo: 'Vela de ignição NGK', descricaoCurta: 'BKR6E', sku: 'VEL-BKR6', codigoOem: '101000033AA', quantidade: 4, precoUnitario: 24.0, estoqueAtual: 12 }],
    historico: [
      { status: 'AGUARDANDO_ACEITE', data: '2026-10-14T14:20:00-03:00' }, { status: 'ACEITO', data: '2026-10-14T14:31:00-03:00' },
      { status: 'PRONTO_RETIRADA', data: '2026-10-14T16:00:00-03:00' }, { status: 'CONCLUIDO', data: '2026-10-15T09:12:00-03:00' },
    ],
  },
};

function buscarSimulado(idPedido) {
  const p = detalhesSimulados[Number(idPedido)];
  if (!p) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado.' };
  return p;
}

// Muda o status se o atual permitir; senão 409, como a API fará
async function simularMudanca(idPedido, permitidos, novoStatus, alterar = null, espera = 600) {
  if (espera) await esperar(espera);
  const p = buscarSimulado(idPedido);
  if (!permitidos.includes(p.status)) {
    throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'O pedido mudou de situação. Atualize a página.' };
  }
  p.status = novoStatus;
  p.historico.push({ status: novoStatus, data: new Date().toISOString() });
  alterar?.(p);
  // Mantém a lista do painel coerente na mesma visita
  const resumo = pedidosSimulados.find((x) => x.idPedido === p.idPedido);
  if (resumo) resumo.status = novoStatus;
  return copia(p);
}