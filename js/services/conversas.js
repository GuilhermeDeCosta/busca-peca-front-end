// Serviço de conversas: uma função por rota de /api/conversas
// (Documentação do Back-end v2, seção 5.9 • caso de uso BP1-28).
//
// QUANDO A API ESTIVER PRONTA: troque USAR_SIMULACAO para false e apague o
// bloco "SIMULAÇÃO" do fim do arquivo.
//
// Formato esperado de cada mensagem (MensagemResponse):
//   { idMensagem, idRemetente, nomeRemetente, conteudo, dataEnvio, lida, propria }
//   "propria" (opcional) = true quando quem enviou é o usuário logado. Sem ela,
//   a tela compara idRemetente com o id do usuário logado.

import { api } from '../api.js';
import { esperar } from './simulacao.js';

const USAR_SIMULACAO = true;

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
 * @returns {Promise<{ itens: object[], pagina: number, tamanho: number, totalRegistros: number, totalPaginas: number }>}
 */
export async function listarMensagens(idConversa, { pagina = 0, tamanho = 50 } = {}) {
  if (USAR_SIMULACAO) {
    await esperar(400);
    const todas = mensagensSimuladas[idConversa] || [];
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

/** PATCH /api/conversas/{id}/lida — marca a conversa como lida. */
export async function marcarConversaComoLida(idConversa) {
  if (USAR_SIMULACAO) return;
  await api.patch(`/conversas/${encodeURIComponent(idConversa)}/lida`);
}

// =========================================================================
// SIMULAÇÃO — apagar este bloco quando a API estiver pronta.
// Conversas 501, 502 e 503 são as dos pedidos BP-2081, BP-2080 e BP-2078.
// =========================================================================

const mensagensSimuladas = {
  501: [
    { idMensagem: 1, idRemetente: 7, nomeRemetente: 'Oficina Rumo Certo', conteudo: 'Bom dia! Consigo retirar o alternador amanhã?', dataEnvio: '2026-10-16T10:20:00-03:00', lida: true, propria: false },
    { idMensagem: 2, idRemetente: 1, nomeRemetente: 'Você', conteudo: 'Bom dia, Carlos! Assim que aceitar o pedido confirmo o horário por aqui.', dataEnvio: '2026-10-16T10:24:00-03:00', lida: true, propria: true },
  ],
  502: [
    { idMensagem: 3, idRemetente: 8, nomeRemetente: 'Mecânica Boa Vista', conteudo: 'Obrigado! Retiro na sexta.', dataEnvio: '2026-10-16T09:10:00-03:00', lida: true, propria: false },
  ],
  503: [
    { idMensagem: 4, idRemetente: 1, nomeRemetente: 'Você', conteudo: 'Retrovisor separado, pode retirar a partir das 14h.', dataEnvio: '2026-10-15T15:21:00-03:00', lida: true, propria: true },
  ],
};