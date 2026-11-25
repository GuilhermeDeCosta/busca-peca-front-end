// Serviço de pedidos: uma função por rota de /api/compras e /api/pedidos (Documentação do Back-end v2, seção 5.8).
// Junta o lado do VENDEDOR (Fluxo C, que já está na main) e o do COMPRADOR (Fluxo A: checkout,
// confirmação, Meus pedidos e Detalhe do pedido). No merge do Fluxo A com a main, fique com ESTE arquivo.
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
    // Pedidos recebidos pela loja (Fluxo C) ficam em detalhesSimulados; os da Ana como compradora, no fim do arquivo
    if (!detalhesSimulados[Number(idPedido)]) return simularPedidoComprador(idPedido);
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
// FLUXO A (comprador): checkout, confirmação, Meus pedidos e Detalhe do pedido
// Com a API ligada, troque cada "if (USAR_SIMULACAO) …" pela linha comentada logo abaixo.
// =========================================================================

/**
 * POST /api/compras — checkout: cria a COMPRA e um PEDIDO por loja, gera o código de retirada
 * e baixa o estoque numa transação (BP1-24, ADR-009). Nenhum valor é cobrado (ADR-008).
 * @param {{ idEndereco: number|null, lojas: { idLoja: number, modalidade: 'RETIRADA'|'ENTREGA',
 *   observacao: string, cienciaPagamentoDireto: true }[] }} dados
 * @returns {Promise<{ idCompra: number, criadaEm: string, total: number,
 *   pedidos: { idPedido, codigo, idLoja, nomeLoja, status: 'AGUARDANDO_ACEITE', modalidade,
 *     codigoRetirada: string|null, subtotal: number, itens: { titulo, quantidade, precoUnitario }[] }[] }>}
 * Rejeita com 409 (PRECO_ALTERADO ou ESTOQUE_INSUFICIENTE) quando algo mudou desde o carrinho
 * (BP1-24, passo 6): nada é gravado e o comprador volta ao carrinho.
 */
export async function finalizarCompra(dados) {
  if (USAR_SIMULACAO) return simularFinalizarCompra(dados);
  return api.post('/compras', dados);
}

/**
 * GET /api/compras/{id} — detalhe da compra com o pedido de cada loja (tela de confirmação, A09).
 * @returns {Promise<object>} mesmo formato da resposta de finalizarCompra
 */
export async function obterCompra(idCompra) {
  if (USAR_SIMULACAO) {
    await esperar(300);
    const compra = lerCompraSimulada(idCompra);
    if (!compra) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Compra não encontrada.' };
    return compra;
  }
  return api.get(`/compras/${encodeURIComponent(idCompra)}`);
}

/**
 * GET /api/compras — histórico do comprador, uma compra por vez com o pedido de cada loja (BP1-20, BP1-27).
 * Página da API (PaginaResposta): { itens, pagina, tamanho, totalRegistros, totalPaginas }, com pagina começando em 0.
 *
 * PARA COMBINAR COM O TIME DA API (a rota existe na documentação, mas os filtros e o "resumo" não):
 *   - filtros: q (código, loja ou peça), status, de e ate (AAAA-MM-DD, como em /lojas/minha/vendas)
 *   - cada pedido com: idPedido, codigo, nomeLoja, status, modalidade, codigoRetirada, subtotal,
 *     resumoItens ("1 farol") e itens [{ titulo, quantidade }]
 *   - resumo: { atencao, andamento, retirada } contando TODOS os pedidos do comprador, sem filtro
 *
 * @param {{ q?: string, status?: string, de?: string, ate?: string, pagina?: number, tamanho?: number }} filtros
 */
export async function listarCompras({ q = '', status = '', de = '', ate = '', pagina = 0, tamanho = 6 } = {}) {
  if (USAR_SIMULACAO) return simularListarCompras({ q, status, de, ate, pagina, tamanho });
  const params = new URLSearchParams({ pagina, tamanho });
  Object.entries({ q, status, de, ate }).forEach(([chave, valor]) => { if (valor) params.set(chave, valor); });
  return api.get(`/compras?${params}`);
}

/*
 * Detalhe do pedido na visão do COMPRADOR (A11) usa o mesmo GET /api/pedidos/{id} (obterPedido, acima).
 * Além dos campos que o vendedor recebe, o comprador precisa de (PARA COMBINAR COM O TIME DA API):
 *   loja: { idLoja, nomeLoja, cidade, estado, enderecoRetirada }   // endereço só para quem tem pedido (ADR-013)
 *   codigoRetirada: 'AV-7421'        // só para o comprador e só na RETIRADA
 *   prazoExpedicaoDias: 1, atualizadoEm: '…'
 *   itens[].fotoUrl, itens[].condicao, itens[].origem
 *   avaliacao: null | { nota, comentario, dataAvaliacao }   // já avaliou?
 *   problema: null | { idProblema, status }                  // já relatou um problema?
 */

/**
 * PATCH /api/pedidos/{id}/cancelar — o comprador cancela enquanto aguarda o aceite (BP1-30).
 * Corpo: { motivo, mensagem }. motivo vai para pedido.motivo_cancelamento (até 255); mensagem segue para a loja.
 * O estoque volta para a loja (ADR-009). Devolve o pedido atualizado; 409 se a loja já aceitou.
 */
export async function cancelarPedido(idPedido, { motivo, mensagem = '' }) {
  if (USAR_SIMULACAO) {
    return simularMudancaComprador(idPedido, ['AGUARDANDO_ACEITE'], 'CANCELADO', (o) => { o.motivoCancelamento = motivo; },
      'A loja já aceitou este pedido. Converse com a loja para combinar o cancelamento.');
  }
  return api.patch(`/pedidos/${encodeURIComponent(idPedido)}/cancelar`, { motivo, mensagem });
}

/**
 * PATCH /api/pedidos/{id}/concluir — o comprador confirma que recebeu a entrega (BP1-27).
 * Mesma rota de concluirEntrega (lado do vendedor); separada aqui só por causa da simulação.
 */
export async function confirmarRecebimento(idPedido) {
  if (USAR_SIMULACAO) return simularMudancaComprador(idPedido, ['EM_ENTREGA'], 'CONCLUIDO');
  return api.patch(`/pedidos/${encodeURIComponent(idPedido)}/concluir`);
}

/**
 * POST /api/pedidos/{id}/avaliacao — avalia a loja depois da conclusão (BP1-15).
 * Corpo: { nota: 1 a 5, comentario (até 1000), aspectos: ['CONFORME_ANUNCIO', 'ATENDIMENTO_RAPIDO', 'PRAZO_CUMPRIDO'] }.
 * "aspectos" vem do protótipo e NÃO tem coluna na tabela avaliacao: combinar com o time ou tirar daqui.
 */
export async function avaliarPedido(idPedido, { nota, comentario = '', aspectos = [] }) {
  if (USAR_SIMULACAO) {
    await esperar(600);
    const o = sobreposicao(idPedido);
    if (o.avaliacao) throw { status: 409, erro: 'JA_AVALIADO', mensagem: 'Este pedido já foi avaliado.' };
    o.avaliacao = { nota, comentario, aspectos, dataAvaliacao: new Date().toISOString() };
    gravarSobreposicao(idPedido, o);
    return structuredClone(o.avaliacao);
  }
  return api.post(`/pedidos/${encodeURIComponent(idPedido)}/avaliacao`, { nota, comentario, aspectos });
}

/**
 * POST /api/pedidos/{id}/problemas — registra problema com anexos, em multipart (BP1-61).
 * Campos: tipoProblema (PECA_ERRADA, DEFEITO, AVARIA, NAO_ENTREGUE, OUTRO), descricao,
 * querDevolucao (true/false) e arquivos (JPG, PNG ou PDF até 5 MB cada).
 * querDevolucao NÃO tem coluna em problema_pedido: a API pode usar para abrir a devolução (BP1-31). Combinar.
 */
export async function registrarProblema(idPedido, { tipoProblema, descricao, querDevolucao = false, arquivos = [] }) {
  if (USAR_SIMULACAO) {
    await esperar(800);
    const o = sobreposicao(idPedido);
    o.problema = { idProblema: 700 + (Number(idPedido) % 100), status: 'ABERTO', tipoProblema, querDevolucao, anexos: arquivos.length };
    gravarSobreposicao(idPedido, o);
    return structuredClone(o.problema);
  }
  const form = new FormData();
  form.append('tipoProblema', tipoProblema);
  form.append('descricao', descricao);
  form.append('querDevolucao', String(querDevolucao));
  arquivos.forEach((arquivo) => form.append('arquivos', arquivo));
  return api.post(`/pedidos/${encodeURIComponent(idPedido)}/problemas`, form);
}

/**
 * GET /api/pedidos/{id}/rastreio — situação e previsão da entrega (BP1-33).
 * @returns {Promise<{ situacao: string, atualizadaEm: string, previsaoEntrega?: string }>}
 */
export async function obterRastreio(idPedido) {
  if (USAR_SIMULACAO) {
    await esperar(500);
    return { situacao: 'Saiu para entrega', atualizadaEm: new Date().toISOString(), previsaoEntrega: new Date(Date.now() + 864e5).toISOString() };
  }
  return api.get(`/pedidos/${encodeURIComponent(idPedido)}/rastreio`);
}

/**
 * GET /api/pedidos/{id}/recibo — recibo em PDF, a partir de ACEITO (BP1-36).
 * É um arquivo, não JSON: a tela abre o endereço direto (o cookie de login vai junto).
 * O endereço da API repete o de api.js; se ele mudar lá, mude aqui. Na simulação devolve null.
 */
export function linkRecibo(idPedido) {
  if (USAR_SIMULACAO) return null;
  const base = window.location.hostname === 'localhost' ? 'http://localhost:8080/api' : 'https://api.buscapeca.com.br/api';
  return `${base}/pedidos/${encodeURIComponent(idPedido)}/recibo`;
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

// =========================================================================
// SIMULAÇÃO DO FLUXO A (comprador) — apagar junto com o bloco acima quando a API estiver pronta.
// =========================================================================

// ---------------------------------------------------------------------------
// Simulação do checkout.
// A compra simulada fica no sessionStorage só para a tela de confirmação conseguir lê-la
// depois de trocar de página. Com a API, nada disso fica no navegador.
// ---------------------------------------------------------------------------

const CHAVE_COMPRA_SIMULADA = 'bp:simulacao-compras';

function lerCompraSimulada(idCompra) {
  try { return (JSON.parse(sessionStorage.getItem(CHAVE_COMPRA_SIMULADA)) || {})[idCompra] || null; } catch (e) { return null; }
}

async function simularFinalizarCompra({ idEndereco, lojas = [] }) {
  const { pecasSimuladas, carrinhoSimulado } = await import('./simulacao-busca.js');
  await esperar(800);
  if (!lojas.length || !carrinhoSimulado.size) throw { status: 400, erro: 'CARRINHO_VAZIO', mensagem: 'Seu carrinho está vazio.' };
  if (lojas.some((l) => !l.cienciaPagamentoDireto)) {
    throw { status: 400, erro: 'CIENCIA_OBRIGATORIA', mensagem: 'Confirme que leu as condições de cada loja.' };
  }
  if (lojas.some((l) => l.modalidade === 'ENTREGA') && !idEndereco) {
    throw { status: 400, erro: 'ENDERECO_OBRIGATORIO', mensagem: 'Escolha o endereço de entrega.', campos: [{ campo: 'idEndereco' }] };
  }

  // Passo 6 do BP1-24: confere o estoque de novo antes de gravar
  const itens = [...carrinhoSimulado.entries()].map(([idPeca, quantidade]) => ({ peca: pecasSimuladas.find((p) => p.idPeca === idPeca), quantidade }));
  const semEstoque = itens.find((i) => i.quantidade > i.peca.quantidadeEstoque);
  if (semEstoque) {
    throw { status: 409, erro: 'ESTOQUE_INSUFICIENTE', mensagem: `O estoque de "${semEstoque.peca.titulo}" mudou. Ajuste a quantidade no carrinho.` };
  }

  const ultimo = Number(sessionStorage.getItem('bp:simulacao-ultimo-pedido')) || 1041;
  let numero = ultimo;
  const pedidos = lojas.map((l) => {
    numero += 1;
    const daLoja = itens.filter((i) => i.peca.loja.idLoja === l.idLoja);
    const subtotal = Math.round(daLoja.reduce((s, i) => s + (i.peca.precoPromocional ?? i.peca.preco) * i.quantidade, 0) * 100) / 100;
    const nomeLoja = daLoja[0]?.peca.loja.nomeLoja || '';
    return {
      idPedido: numero,
      codigo: `BP-${numero}`,
      idLoja: l.idLoja,
      nomeLoja,
      status: 'AGUARDANDO_ACEITE',
      modalidade: l.modalidade,
      observacao: l.observacao || '',
      codigoRetirada: l.modalidade === 'RETIRADA' ? `${(nomeLoja.split(' ')[1] || nomeLoja).normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}-${7400 + numero % 100}` : null,
      subtotal,
      itens: daLoja.map((i) => ({ idPeca: i.peca.idPeca, titulo: i.peca.titulo, quantidade: i.quantidade, precoUnitario: i.peca.precoPromocional ?? i.peca.preco })),
    };
  });
  const compra = {
    idCompra: numero,
    criadaEm: new Date().toISOString(),
    total: Math.round(pedidos.reduce((s, p) => s + p.subtotal, 0) * 100) / 100,
    idEndereco,
    pedidos,
  };
  try {
    const todas = JSON.parse(sessionStorage.getItem(CHAVE_COMPRA_SIMULADA)) || {};
    todas[compra.idCompra] = compra;
    sessionStorage.setItem(CHAVE_COMPRA_SIMULADA, JSON.stringify(todas));
    sessionStorage.setItem('bp:simulacao-ultimo-pedido', String(numero));
  } catch (e) { /* sem sessionStorage a confirmação não acha a compra simulada */ }
  carrinhoSimulado.clear(); // a API esvazia o carrinho depois de criar os pedidos
  return structuredClone(compra);
}

// ---------------------------------------------------------------------------
// Simulação do histórico (Meus pedidos, A10). Mesmos pedidos do protótipo.
// As compras feitas no checkout simulado (sessionStorage) aparecem no topo.
// ---------------------------------------------------------------------------

const pedidoHist = (idPedido, nomeLoja, resumoItens, titulo, quantidade, subtotal, modalidade, status, codigoRetirada) => ({
  idPedido, codigo: `BP-${idPedido}`, nomeLoja, status, modalidade,
  codigoRetirada: modalidade === 'RETIRADA' ? codigoRetirada : null,
  subtotal, resumoItens, itens: [{ titulo, quantidade }],
});
const compraHist = (idCompra, criadaEm, pedidos) => ({
  idCompra, criadaEm, pedidos, total: Math.round(pedidos.reduce((s, p) => s + p.subtotal, 0) * 100) / 100,
});

// Compra do exemplo do protótipo (BP-1042 e BP-1043). Some quando o checkout simulado criar os seus próprios BP-1042/1043.
const COMPRA_EXEMPLO = compraHist(1041, '2026-10-16T09:42:00-03:00', [
  { ...pedidoHist(1042, 'Autopeças Avenida', '1 farol', 'Farol direito Chevrolet Onix 2020–2023', 1, 489.9, 'RETIRADA', 'AGUARDANDO_ACEITE', 'AV-7421'), observacao: 'A peça é para Onix 1.0 2020.' },
  pedidoHist(1043, 'Motor Norte Peças', '2 filtros', 'Filtro de óleo Tecfil PSL55', 2, 59.8, 'ENTREGA', 'ACEITO'),
]);
const HISTORICO_SIMULADO = [
  compraHist(1038, '2026-10-14T15:20:00-03:00', [pedidoHist(1039, 'Rota Sul Autopeças', '1 retrovisor', 'Retrovisor elétrico esquerdo HB20 2019–2022', 1, 219.9, 'RETIRADA', 'EM_PREPARACAO', 'RS-6190')]),
  compraHist(1033, '2026-10-13T10:05:00-03:00', [pedidoHist(1034, 'Motor Norte Peças', '1 alternador', 'Alternador Bosch 90A Gol G5', 1, 749, 'ENTREGA', 'EM_ENTREGA')]),
  compraHist(1028, '2026-10-10T08:40:00-03:00', [pedidoHist(1029, 'Autopeças Avenida', '1 filtro', 'Filtro de ar Tecfil ARL6079', 1, 29.9, 'RETIRADA', 'PRONTO_RETIRADA', 'AV-5382')]),
  compraHist(1017, '2026-10-06T17:10:00-03:00', [pedidoHist(1018, 'Horizonte Peças', '1 correia', 'Correia dentada Gates Onix 1.0', 1, 89.9, 'RETIRADA', 'CONCLUIDO', 'HZ-4101')]),
  compraHist(1006, '2026-10-02T11:30:00-03:00', [pedidoHist(1007, 'Rota Sul Autopeças', '1 para-choque', 'Para-choque dianteiro Fiat Argo 2018–2022', 1, 379.9, 'ENTREGA', 'CANCELADO')]),
  // Página 2 ("Carregar mais pedidos")
  compraHist(998, '2026-09-24T09:15:00-03:00', [
    pedidoHist(999, 'Peça Certa Sumaré', '4 velas', 'Vela de ignição NGK BKR6E', 4, 103.6, 'RETIRADA', 'CONCLUIDO', 'PC-3318'),
    pedidoHist(1000, 'Autopeças Avenida', '1 bomba', 'Bomba d’água Urba Onix 1.4', 1, 164.9, 'RETIRADA', 'CONCLUIDO', 'AV-2207'),
  ]),
  compraHist(990, '2026-09-15T14:00:00-03:00', [pedidoHist(991, 'Motor Norte Peças', '1 jogo de pastilhas', 'Pastilha de freio Cobreq dianteira Gol', 1, 119.9, 'ENTREGA', 'CONCLUIDO')]),
  compraHist(981, '2026-09-03T16:45:00-03:00', [pedidoHist(982, 'Rota Sul Autopeças', '1 amortecedor', 'Amortecedor traseiro Cofap HB20', 1, 289.9, 'RETIRADA', 'RECUSADO', 'RS-4410')]),
  compraHist(970, '2026-08-21T10:20:00-03:00', [pedidoHist(971, 'Horizonte Peças', '2 lâmpadas', 'Lâmpada H4 Philips 60/55W', 2, 59.8, 'RETIRADA', 'CONCLUIDO', 'HZ-3001')]),
];

const STATUS_ATENCAO = ['PRONTO_RETIRADA', 'EM_ENTREGA']; // ir buscar ou confirmar o recebimento
const STATUS_ANDAMENTO = ['AGUARDANDO_ACEITE', 'ACEITO', 'EM_PREPARACAO'];
const normalizarBusca = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const soDigitos = (t) => String(t || '').replace(/\D/g, '');

function comprasSimuladas() {
  let daSessao = [];
  try { daSessao = Object.values(JSON.parse(sessionStorage.getItem(CHAVE_COMPRA_SIMULADA)) || {}); } catch (e) { /* sem sessionStorage */ }
  const codigosDaSessao = new Set(daSessao.flatMap((c) => c.pedidos.map((p) => p.codigo)));
  const exemplo = COMPRA_EXEMPLO.pedidos.some((p) => codigosDaSessao.has(p.codigo)) ? [] : [COMPRA_EXEMPLO];
  // Status mudados no detalhe do pedido (cancelar, confirmar recebimento) valem também aqui
  const mudancas = lerSobreposicoes();
  return [...daSessao, ...exemplo, ...HISTORICO_SIMULADO]
    .map((c) => ({ ...c, pedidos: c.pedidos.map((p) => (mudancas[p.idPedido]?.status ? { ...p, status: mudancas[p.idPedido].status } : p)) }))
    .sort((a, b) => new Date(b.criadaEm) - new Date(a.criadaEm));
}

async function simularListarCompras({ q, status, de, ate, pagina, tamanho }) {
  await esperar(450);
  const todas = comprasSimuladas();
  const termo = normalizarBusca(q).trim();
  const digitos = soDigitos(q);
  const pedidoPassa = (p) => {
    if (status && p.status !== status) return false;
    if (!termo) return true;
    if (digitos && digitos === soDigitos(p.codigo)) return true;
    const textos = [p.codigo, p.nomeLoja, p.resumoItens, ...(p.itens || []).map((i) => i.titulo)];
    return textos.some((t) => normalizarBusca(t).includes(termo));
  };
  const dataPassa = (c) => {
    const dia = new Date(c.criadaEm).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
    return (!de || dia >= de) && (!ate || dia <= ate);
  };
  const filtradas = todas
    .filter(dataPassa)
    .map((c) => ({ ...c, pedidos: c.pedidos.filter(pedidoPassa) }))
    .filter((c) => c.pedidos.length);
  const pedidos = todas.flatMap((c) => c.pedidos);
  return structuredClone({
    itens: filtradas.slice(pagina * tamanho, (pagina + 1) * tamanho),
    pagina,
    tamanho,
    totalRegistros: filtradas.length,
    totalPaginas: Math.max(1, Math.ceil(filtradas.length / tamanho)),
    resumo: {
      atencao: pedidos.filter((p) => STATUS_ATENCAO.includes(p.status)).length,
      andamento: pedidos.filter((p) => STATUS_ANDAMENTO.includes(p.status)).length,
      retirada: pedidos.filter((p) => p.status === 'PRONTO_RETIRADA').length,
    },
  });
}

// ---------------------------------------------------------------------------
// Simulação do detalhe do pedido do comprador (A11). Monta o detalhe a partir das compras simuladas
// (histórico + checkout). Cancelar, confirmar recebimento, avaliar e relatar problema ficam guardados
// no sessionStorage, para Meus pedidos mostrar o status novo depois de voltar.
// ---------------------------------------------------------------------------

const CHAVE_SOBREPOSICAO = 'bp:simulacao-pedidos-comprador';

// Endereço de retirada: o comprador só vê porque tem pedido com a loja (ADR-013)
const LOJAS_RETIRADA = {
  'Autopeças Avenida': { idLoja: 11, cidade: 'Campinas', estado: 'SP', enderecoRetirada: 'Av. das Peças, 450 • Jardim Central • CEP 13050-100' },
  'Motor Norte Peças': { idLoja: 12, cidade: 'Campinas', estado: 'SP', enderecoRetirada: 'Rua Barão de Itapura, 1210 • Guanabara • CEP 13073-300' },
  'Horizonte Peças': { idLoja: 1, cidade: 'Campinas', estado: 'SP', enderecoRetirada: 'Rua das Oficinas, 88 • Centro • CEP 13010-110' },
  'Rota Sul Autopeças': { idLoja: 13, cidade: 'Valinhos', estado: 'SP', enderecoRetirada: 'Av. Independência, 2300 • Vila Santana • CEP 13276-100' },
  'Peça Certa Sumaré': { idLoja: 14, cidade: 'Sumaré', estado: 'SP', enderecoRetirada: 'Rua Dom Barreto, 410 • Centro • CEP 13170-040' },
};
// Conversas da simulação de conversas.js (504, 505 e 506 são da Ana)
const CONVERSA_DO_PEDIDO = { 1042: 504, 1043: 505, 1039: 506 };
const EXTRAS_HISTORICO = {
  1034: { entrega: { transportadora: 'Jadlog', codigoRastreio: 'JD014572289BR' } },
  1007: { motivoCancelamento: 'Encontrei a peça em outro lugar' },
  982: { motivoRecusa: 'Peça sem estoque físico. O retrovisor do mostruário estava com a carcaça trincada.' },
  971: { avaliacao: { nota: 5, comentario: 'Lâmpadas originais, retirada rápida.', dataAvaliacao: '2026-08-22T10:00:00-03:00' } },
};
const ENDERECO_ENTREGA_ANA = 'Rua das Oficinas, 120 • Centro • Campinas/SP • CEP 13010-110';
const SEQUENCIA = {
  RETIRADA: ['AGUARDANDO_ACEITE', 'ACEITO', 'EM_PREPARACAO', 'PRONTO_RETIRADA', 'CONCLUIDO'],
  ENTREGA: ['AGUARDANDO_ACEITE', 'ACEITO', 'EM_PREPARACAO', 'EM_ENTREGA', 'CONCLUIDO'],
};

function lerSobreposicoes() {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_SOBREPOSICAO)) || {}; } catch (e) { return {}; }
}
function sobreposicao(idPedido) {
  return lerSobreposicoes()[idPedido] || {};
}
function gravarSobreposicao(idPedido, dados) {
  try {
    const todas = lerSobreposicoes();
    todas[idPedido] = dados;
    sessionStorage.setItem(CHAVE_SOBREPOSICAO, JSON.stringify(todas));
  } catch (e) { /* sem sessionStorage a mudança só vale até recarregar */ }
}

// Datas do histórico: cada etapa algumas horas depois da anterior
function historicoAte(modalidade, status, criadaEm) {
  const seq = SEQUENCIA[modalidade] || SEQUENCIA.RETIRADA;
  const inicio = new Date(criadaEm).getTime();
  if (status === 'CANCELADO') return [{ status: 'AGUARDANDO_ACEITE', data: criadaEm }, { status, data: new Date(inicio + 2 * 36e5).toISOString() }];
  if (status === 'RECUSADO') return [{ status: 'AGUARDANDO_ACEITE', data: criadaEm }, { status, data: new Date(inicio + 36e5).toISOString() }];
  const ate = Math.max(0, seq.indexOf(status));
  return seq.slice(0, ate + 1).map((s, i) => ({ status: s, data: new Date(inicio + i * 5 * 36e5 + (i ? 18 * 6e4 : 0)).toISOString() }));
}

async function simularPedidoComprador(idPedido) {
  await esperar(450);
  const id = Number(idPedido);
  const compra = comprasSimuladas().find((c) => c.pedidos.some((p) => p.idPedido === id));
  if (!compra) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado.' };
  const p = compra.pedidos.find((x) => x.idPedido === id);
  const { pecasSimuladas } = await import('./simulacao-busca.js');
  const o = sobreposicao(id);
  const extras = EXTRAS_HISTORICO[id] || {};
  const historico = o.historico || historicoAte(p.modalidade, p.status, compra.criadaEm);
  const itens = (p.itens || []).map((i) => {
    const peca = pecasSimuladas.find((x) => x.idPeca === i.idPeca) || pecasSimuladas.find((x) => x.titulo === i.titulo);
    const quantidade = i.quantidade || 1;
    return {
      idPeca: i.idPeca ?? peca?.idPeca ?? null,
      titulo: i.titulo,
      marcaPeca: peca?.marcaPeca || '',
      codigoOem: peca?.codigoOem || '',
      condicao: peca?.condicao || 'NOVA',
      origem: peca?.origem || 'NACIONAL',
      fotoUrl: peca?.fotos?.[0]?.url || peca?.fotoUrl || null,
      quantidade,
      precoUnitario: i.precoUnitario ?? Math.round((p.subtotal / quantidade) * 100) / 100,
    };
  });
  return structuredClone({
    idPedido: id,
    codigo: p.codigo,
    status: p.status,
    dataPedido: compra.criadaEm,
    atualizadoEm: historico[historico.length - 1]?.data || compra.criadaEm,
    modalidadeEntrega: p.modalidade,
    valorItens: p.subtotal,
    valorFrete: 0,
    observacao: p.observacao || '',
    motivoRecusa: extras.motivoRecusa || null,
    motivoCancelamento: o.motivoCancelamento || extras.motivoCancelamento || null,
    idConversa: CONVERSA_DO_PEDIDO[id] || null,
    loja: { nomeLoja: p.nomeLoja, ...(LOJAS_RETIRADA[p.nomeLoja] || { cidade: '', estado: '', enderecoRetirada: '' }) },
    codigoRetirada: p.modalidade === 'RETIRADA' ? p.codigoRetirada : null,
    prazoExpedicaoDias: Math.max(1, ...itens.map((i) => pecasSimuladas.find((x) => x.idPeca === i.idPeca)?.prazoExpedicaoDias || 1)),
    enderecoEntrega: p.modalidade === 'ENTREGA' ? ENDERECO_ENTREGA_ANA : null,
    entrega: extras.entrega || null,
    itens,
    historico,
    avaliacao: o.avaliacao || extras.avaliacao || null,
    problema: o.problema || null,
  });
}

// Muda o status de um pedido do comprador se o atual permitir; senão 409, como a API fará
async function simularMudancaComprador(idPedido, permitidos, novoStatus, alterar = null, mensagem409 = 'O pedido mudou de situação. Atualize a página.') {
  const atual = await simularPedidoComprador(idPedido);
  await esperar(300);
  if (!permitidos.includes(atual.status)) throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: mensagem409 };
  const o = sobreposicao(idPedido);
  o.status = novoStatus;
  o.historico = [...atual.historico, { status: novoStatus, data: new Date().toISOString() }];
  alterar?.(o);
  gravarSobreposicao(idPedido, o);
  return simularPedidoComprador(idPedido);
}