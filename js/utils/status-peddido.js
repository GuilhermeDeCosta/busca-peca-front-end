// Status do pedido na visão do COMPRADOR: texto e cor da etiqueta.
// Usado em Pedidos enviados (A09), Meus pedidos e Detalhe do pedido.
//
// Lista do banco (tabela pedido.status) e da Documentação do Back-end v2, seção 5.8:
//   AGUARDANDO_ACEITE → ACEITO ou RECUSADO → PRONTO_RETIRADA ou EM_ENTREGA → CONCLUIDO; CANCELADO antes do envio.
// EM_PREPARACAO veio do protótipo do Fluxo C (já está no pedidos.js da main) e ainda precisa entrar na API.
// As classes ficam em componentes.css, seção "STATUS DO PEDIDO".
// Textos iguais aos do protótipo (Meus pedidos, A10): EM_ENTREGA aparece como "Enviado".

const STATUS_PEDIDO = {
  AGUARDANDO_ACEITE: { rotulo: 'Aguardando aceite', classe: 'status-pedido--alerta' },
  ACEITO: { rotulo: 'Aceito', classe: 'status-pedido--info' },
  EM_PREPARACAO: { rotulo: 'Em preparação', classe: 'status-pedido--info' },
  PRONTO_RETIRADA: { rotulo: 'Pronto para retirada', classe: 'status-pedido--sucesso' },
  EM_ENTREGA: { rotulo: 'Enviado', classe: 'status-pedido--info' },
  CONCLUIDO: { rotulo: 'Concluído', classe: 'status-pedido--sucesso' },
  RECUSADO: { rotulo: 'Recusado', classe: 'status-pedido--erro' },
  CANCELADO: { rotulo: 'Cancelado', classe: 'status-pedido--neutro' },
};

/** Opções do filtro de status, na ordem do andamento do pedido. */
export const OPCOES_STATUS_PEDIDO = Object.entries(STATUS_PEDIDO).map(([valor, s]) => ({ valor, texto: s.rotulo }));

/** "Aguardando aceite", "Concluído"… Status desconhecido aparece como veio da API. */
export function rotuloStatusPedido(status) {
  return STATUS_PEDIDO[status]?.rotulo || String(status || '');
}

/** Classes da etiqueta: "status-pedido status-pedido--alerta". */
export function classeStatusPedido(status) {
  return `status-pedido ${STATUS_PEDIDO[status]?.classe || 'status-pedido--neutro'}`;
}

/** Retirada ou entrega, sempre com o frete a combinar (BP1-23, ADR-012). */
export function textoModalidade(modalidade) {
  return modalidade === 'RETIRADA' ? 'Retirada na loja • frete a combinar' : 'Entrega a combinar • frete a combinar';
}