// Serviço de conversas: uma função por rota de /api/conversas
// (Documentação do Back-end v2, seção 5.9 • caso de uso BP1-28).
//
// QUANDO A API ESTIVER PRONTA: troque USAR_SIMULACAO para false e apague o
// bloco "SIMULAÇÃO" do fim do arquivo.
//
// Formato esperado de cada conversa na lista (ConversaResumoResponse):
//   {
//     idConversa: 504,
//     papel: 'COMPRADOR' | 'VENDEDOR',   // o papel do usuário logado nesta conversa ("Compra" ou "Minha Loja")
//     nomeContato: 'Autopeças Avenida',  // a outra parte: a loja (se comprador) ou a oficina compradora (se vendedor)
//     idPedido: 1042, codigoPedido: 'BP-1042', statusPedido: 'AGUARDANDO_ACEITE',
//     tituloPeca: 'Farol direito Chevrolet Onix 2020–2023',
//     tituloPecaCurto: 'Farol direito Onix', // opcional: usado na lista; sem ele, a lista usa tituloPeca
//     ultimaMensagem: { conteudo, dataEnvio, propria },  // null se ainda não há mensagens
//     naoLidas: 1                         // mensagens da outra parte ainda não lidas
//   }
//
// Formato esperado de cada mensagem (MensagemResponse):
//   { idMensagem, idRemetente, nomeRemetente, conteudo, dataEnvio, lida, propria }
//   "propria" (opcional) = true quando quem enviou é o usuário logado. Sem ela,
//   a tela compara idRemetente com o id do usuário logado.

import { api } from '../api.js';
import { esperar } from './simulacao.js';

export const USAR_SIMULACAO = true;

/**
 * GET /api/conversas — conversas do usuário, com não lidas (BP1-28).
 * Aceita a resposta como lista ou como página ({ itens }).
 * @returns {Promise<object[]>}
 */
export async function listarConversas() {
  if (USAR_SIMULACAO) {
    await esperar(500);
    return conversasSimuladas.map(resumoSimulado);
  }
  const dados = await api.get('/conversas?pagina=0&tamanho=100');
  return Array.isArray(dados) ? dados : (dados?.itens || []);
}

/**
 * POST /api/conversas — abre a conversa ligada a um pedido.
 * Corpo: { idPedido }. Se já existir, a API pode devolver a existente.
 * @returns {Promise<{ idConversa: number }>}
 */
export async function abrirConversaDoPedido(idPedido) {
  if (USAR_SIMULACAO) {
    await esperar(300);
    const idConversa = 900 + Number(idPedido) % 100;
    mensagensSimuladas[idConversa] ??= [];
    return { idConversa };
  }
  return api.post('/conversas', { idPedido });
}

/**
 * GET /api/conversas/{id}/mensagens — mensagens em ordem (da mais antiga para a mais nova), paginadas.
 * A página 0 traz as mais antigas; para abrir no fim da conversa, a tela pede a última página.
 * @returns {Promise<{ itens: object[], pagina: number, tamanho: number, totalRegistros: number, totalPaginas: number }>}
 */
export async function listarMensagens(idConversa, { pagina = 0, tamanho = 50 } = {}) {
  if (USAR_SIMULACAO) {
    await esperar(400);
    const todas = mensagensSimuladas[idConversa];
    if (!todas) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Conversa não encontrada.' };
    return {
      itens: structuredClone(todas.slice(pagina * tamanho, (pagina + 1) * tamanho)),
      pagina, tamanho, totalRegistros: todas.length, totalPaginas: Math.ceil(todas.length / tamanho),
    };
  }
  const params = new URLSearchParams({ pagina, tamanho });
  return api.get(`/conversas/${encodeURIComponent(idConversa)}/mensagens?${params}`);
}

/**
 * POST /api/conversas/{id}/mensagens — envia mensagem. Corpo: { conteudo } (até 2000 caracteres).
 * @returns {Promise<object>} a mensagem criada
 */
export async function enviarMensagem(idConversa, conteudo) {
  if (USAR_SIMULACAO) {
    await esperar(400);
    const nova = {
      idMensagem: Date.now(), idRemetente: 1, nomeRemetente: 'Você',
      conteudo, dataEnvio: new Date().toISOString(), lida: false, propria: true,
    };
    (mensagensSimuladas[idConversa] ??= []).push(nova);
    return structuredClone(nova);
  }
  return api.post(`/conversas/${encodeURIComponent(idConversa)}/mensagens`, { conteudo });
}

/** PATCH /api/conversas/{id}/lida — marca como lidas as mensagens da outra parte. */
export async function marcarConversaComoLida(idConversa) {
  if (USAR_SIMULACAO) {
    (mensagensSimuladas[idConversa] || []).forEach((m) => { if (!m.propria) m.lida = true; });
    return;
  }
  await api.patch(`/conversas/${encodeURIComponent(idConversa)}/lida`);
}

// =========================================================================
// SIMULAÇÃO — apagar este bloco quando a API estiver pronta.
// 501, 502 e 503 são as conversas dos pedidos BP-2081, BP-2080 e BP-2078
// (pedidos.js); 504 a 506 são compras da Ana em outras lojas (protótipo).
// As mudanças ficam em memória até recarregar a página.
// =========================================================================

// Datas relativas a hoje, para a lista mostrar "09:48" e "Ontem" como no protótipo
function horario(diasAtras, hora, minuto) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}

const conversasSimuladas = [
  { idConversa: 504, papel: 'COMPRADOR', nomeContato: 'Autopeças Avenida', idPedido: 1042, codigoPedido: 'BP-1042', statusPedido: 'AGUARDANDO_ACEITE', tituloPeca: 'Farol direito Chevrolet Onix 2020–2023', tituloPecaCurto: 'Farol direito Onix' },
  { idConversa: 501, papel: 'VENDEDOR', nomeContato: 'Oficina Rumo Certo', idPedido: 2081, codigoPedido: 'BP-2081', statusPedido: 'AGUARDANDO_ACEITE', tituloPeca: 'Alternador Bosch 90A • linha GM', tituloPecaCurto: 'Alternador Bosch 90A' },
  { idConversa: 505, papel: 'COMPRADOR', nomeContato: 'Motor Norte Peças', idPedido: 1043, codigoPedido: 'BP-1043', statusPedido: 'ACEITO', tituloPeca: 'Filtro de óleo Tecfil PSL55', tituloPecaCurto: 'Filtro de óleo Tecfil' },
  { idConversa: 503, papel: 'VENDEDOR', nomeContato: 'Auto Center Parque', idPedido: 2078, codigoPedido: 'BP-2078', statusPedido: 'PRONTO_RETIRADA', tituloPeca: 'Retrovisor Onix • lado esquerdo, elétrico', tituloPecaCurto: 'Retrovisor Onix' },
  { idConversa: 506, papel: 'COMPRADOR', nomeContato: 'Rota Sul Autopeças', idPedido: 1039, codigoPedido: 'BP-1039', statusPedido: 'PRONTO_RETIRADA', tituloPeca: 'Retrovisor Onix • lado direito', tituloPecaCurto: 'Retrovisor Onix' },
  { idConversa: 502, papel: 'VENDEDOR', nomeContato: 'Mecânica Boa Vista', idPedido: 2080, codigoPedido: 'BP-2080', statusPedido: 'ACEITO', tituloPeca: 'Filtro de ar Tecfil ARL6079', tituloPecaCurto: 'Filtros de ar' },
];

const mensagensSimuladas = {
  504: [
    { idMensagem: 11, idRemetente: 1, nomeRemetente: 'Você', conteudo: 'A peça é para Onix 1.0 2020. Podem confirmar o conector antes da retirada?', dataEnvio: horario(0, 9, 44), lida: true, propria: true },
    { idMensagem: 12, idRemetente: 21, nomeRemetente: 'Autopeças Avenida', conteudo: 'Olá, Ana! Vamos conferir o OEM 52159336 e responder por aqui.', dataEnvio: horario(0, 9, 48), lida: true, propria: false },
    { idMensagem: 13, idRemetente: 21, nomeRemetente: 'Autopeças Avenida', conteudo: 'Conferido: conector original de 3 pinos, serve no 1.0 e no 1.4. Pode retirar amanhã a partir das 9h.', dataEnvio: horario(0, 10, 5), lida: true, propria: false },
    { idMensagem: 14, idRemetente: 1, nomeRemetente: 'Você', conteudo: 'Perfeito, passo às 9h30. Obrigada!', dataEnvio: horario(0, 10, 7), lida: true, propria: true },
  ],
  501: [
    { idMensagem: 1, idRemetente: 7, nomeRemetente: 'Oficina Rumo Certo', conteudo: 'Bom dia! Consigo retirar o alternador amanhã?', dataEnvio: horario(0, 9, 20), lida: false, propria: false },
  ],
  505: [
    { idMensagem: 21, idRemetente: 1, nomeRemetente: 'Você', conteudo: 'Boa tarde! Que horas posso retirar o filtro?', dataEnvio: horario(1, 13, 2), lida: true, propria: true },
    { idMensagem: 22, idRemetente: 22, nomeRemetente: 'Motor Norte Peças', conteudo: 'Pedido aceito. Pode retirar a partir das 14h.', dataEnvio: horario(1, 13, 10), lida: true, propria: false },
  ],
  503: [
    { idMensagem: 4, idRemetente: 1, nomeRemetente: 'Você', conteudo: 'Retrovisor separado, pode retirar a partir das 14h.', dataEnvio: '2026-10-15T15:21:00-03:00', lida: true, propria: true },
  ],
  506: [
    { idMensagem: 31, idRemetente: 23, nomeRemetente: 'Rota Sul Autopeças', conteudo: 'Separando o retrovisor para retirada.', dataEnvio: '2026-10-14T11:05:00-03:00', lida: true, propria: false },
  ],
  502: [
    { idMensagem: 3, idRemetente: 8, nomeRemetente: 'Mecânica Boa Vista', conteudo: 'Obrigado! Retiro na sexta.', dataEnvio: '2026-10-14T09:10:00-03:00', lida: true, propria: false },
  ],
};

function resumoSimulado(conversa) {
  const mensagens = mensagensSimuladas[conversa.idConversa] || [];
  const ultima = mensagens[mensagens.length - 1];
  return structuredClone({
    ...conversa,
    ultimaMensagem: ultima ? { conteudo: ultima.conteudo, dataEnvio: ultima.dataEnvio, propria: ultima.propria } : null,
    naoLidas: mensagens.filter((m) => !m.propria && !m.lida).length,
  });
}