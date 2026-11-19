// Serviço de notificações: uma função por rota de /api/notificacoes
// (Documentação do Back-end v2, seção 5.11 • caso de uso BP1-51).
//
// ENQUANTO A API NÃO EXISTE: USAR_SIMULACAO = true devolve respostas falsas no
// mesmo formato que a API vai devolver, para a tela funcionar de ponta a ponta.
//
// QUANDO A API ESTIVER PRONTA:
//   1. Troque USAR_SIMULACAO para false.
//   2. Apague o bloco "SIMULAÇÃO" do fim do arquivo e o import de ./simulacao.js.
// Nenhuma outra mudança é necessária na tela.
//
// Formato esperado de cada notificação (NotificacaoResponse, JSON em camelCase):
//   {
//     idNotificacao: 12,
//     tipo: 'NOVO_PEDIDO' | 'STATUS_PEDIDO' | 'ESTOQUE_BAIXO' | 'PECA_DISPONIVEL' | 'NOVA_MENSAGEM' | 'AVISO_ADMIN',
//     titulo: 'Novo pedido na sua loja',   // opcional: sem ele a tela usa um título padrão pelo tipo
//     mensagem: 'Oficina Rumo Certo pediu…', // coluna notificacao.mensagem (até 500 caracteres)
//     lida: false,
//     dataEnvio: '2026-11-17T10:15:00',     // coluna notificacao.data_envio
//     idReferencia: 2081,                    // opcional: id do pedido, da conversa ou da peça (monta o botão)
//     link: null,                            // opcional, só AVISO_ADMIN: caminho a partir da raiz do front
//     textoAcao: null                        // opcional, só AVISO_ADMIN: texto do botão (ex.: 'Ler termos')
//   }

import { api } from '../api.js';
import { esperar } from './simulacao.js';

export const USAR_SIMULACAO = true;

// Tipos de cada filtro da tela. A API recebe a lista em ?tipos=A,B (Spring converte em List<String>).
export const TIPOS_POR_CATEGORIA = {
  PEDIDOS: ['STATUS_PEDIDO', 'NOVA_MENSAGEM', 'PECA_DISPONIVEL'],
  MINHA_LOJA: ['NOVO_PEDIDO', 'ESTOQUE_BAIXO'],
  BUSCA_PECA: ['AVISO_ADMIN'],
};

/**
 * GET /api/notificacoes — lista paginada, lidas e não lidas, da mais recente para a mais antiga.
 * Parâmetros que o back-end precisa aceitar:
 *   pagina (começa em 0), tamanho, lida=false (só não lidas), tipos=NOVO_PEDIDO,ESTOQUE_BAIXO
 * @param {{ pagina?: number, tamanho?: number, somenteNaoLidas?: boolean, tipos?: string[] }} filtros
 * @returns {Promise<{ itens: object[], pagina: number, tamanho: number, totalRegistros: number, totalPaginas: number }>}
 * Em erro, rejeita com { status, erro, mensagem } (formato único de erro da API).
 */
export async function listarNotificacoes({ pagina = 0, tamanho = 6, somenteNaoLidas = false, tipos = [] } = {}) {
  if (USAR_SIMULACAO) return simularListar({ pagina, tamanho, somenteNaoLidas, tipos });

  const params = new URLSearchParams({ pagina, tamanho });
  if (somenteNaoLidas) params.set('lida', 'false');
  if (tipos.length) params.set('tipos', tipos.join(','));
  return api.get(`/notificacoes?${params}`);
}

/**
 * GET /api/notificacoes/nao-lidas/total — contador do sino e do filtro "Não lidas".
 * Aceita a resposta como número puro ou como { total }.
 * @returns {Promise<number>}
 */
export async function contarNaoLidas() {
  if (USAR_SIMULACAO) {
    await esperar(200);
    return notificacoesSimuladas.filter((n) => !n.lida).length;
  }
  const dados = await api.get('/notificacoes/nao-lidas/total');
  return typeof dados === 'number' ? dados : Number(dados?.total ?? dados?.quantidade ?? 0);
}

/**
 * PATCH /api/notificacoes/{id}/lida — marca uma notificação como lida.
 * @returns {Promise<void>}
 */
export async function marcarComoLida(idNotificacao) {
  if (USAR_SIMULACAO) {
    await esperar(250);
    const n = notificacoesSimuladas.find((x) => x.idNotificacao === Number(idNotificacao));
    if (!n) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Notificação não encontrada.' };
    n.lida = true;
    return;
  }
  await api.patch(`/notificacoes/${idNotificacao}/lida`);
}

/**
 * PATCH /api/notificacoes/lidas — marca todas as notificações do usuário como lidas.
 * @returns {Promise<void>}
 */
export async function marcarTodasComoLidas() {
  if (USAR_SIMULACAO) {
    await esperar(400);
    notificacoesSimuladas.forEach((n) => { n.lida = true; });
    return;
  }
  await api.patch('/notificacoes/lidas');
}

// =========================================================================
// SIMULAÇÃO — apagar este bloco quando a API estiver pronta.
// Dados do protótipo (Fluxo C • Notificações). Ficam em memória: marcar como
// lida muda os dados até recarregar a página.
// =========================================================================

// Datas relativas a hoje, para a tela mostrar "Hoje" e "Ontem" como no protótipo
function horario(diasAtras, hora, minuto) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}

const notificacoesSimuladas = [
  {
    idNotificacao: 8, tipo: 'NOVO_PEDIDO', lida: false, dataEnvio: horario(0, 10, 15), idReferencia: 2081,
    titulo: 'Novo pedido na sua loja',
    mensagem: 'Oficina Rumo Certo pediu 1 Alternador Bosch 90A (BP-2081). Responda para não perder a venda.',
  },
  {
    idNotificacao: 7, tipo: 'NOVA_MENSAGEM', lida: false, dataEnvio: horario(0, 10, 5), idReferencia: 503,
    titulo: 'Nova mensagem de Autopeças Avenida',
    mensagem: '“Conferido: conector original de 3 pinos…” sobre o pedido BP-1042.',
  },
  {
    idNotificacao: 6, tipo: 'ESTOQUE_BAIXO', lida: false, dataEnvio: horario(0, 8, 0), idReferencia: 102,
    titulo: 'Estoque baixo',
    mensagem: 'Retrovisor Onix (RET-ON20) está com 1 unidade. Atualize o estoque para evitar pedidos que você não pode atender.',
  },
  {
    idNotificacao: 5, tipo: 'STATUS_PEDIDO', lida: true, dataEnvio: horario(1, 16, 40), idReferencia: 1043,
    titulo: 'Pedido aceito',
    mensagem: 'Motor Norte Peças aceitou o pedido BP-1043. Combine a entrega pela conversa.',
  },
  {
    idNotificacao: 4, tipo: 'STATUS_PEDIDO', lida: true, dataEnvio: '2026-10-14T11:12:00-03:00', idReferencia: 1039,
    titulo: 'Pronto para retirada',
    mensagem: 'Rota Sul Autopeças separou o pedido BP-1039. Código de retirada: RS-6190.',
  },
  {
    idNotificacao: 3, tipo: 'AVISO_ADMIN', lida: true, dataEnvio: '2026-10-01T09:00:00-03:00', idReferencia: null,
    titulo: 'Termos de uso atualizados',
    mensagem: 'A versão 1.2 está vigente desde 01/10/2026.',
    link: 'pages/institucional/termos-de-uso.html', textoAcao: 'Ler termos',
  },
  {
    idNotificacao: 2, tipo: 'PECA_DISPONIVEL', lida: true, dataEnvio: '2026-09-28T15:30:00-03:00', idReferencia: 108,
    titulo: 'Peça disponível',
    mensagem: 'Sensor de oxigênio Gol voltou ao estoque em Horizonte Peças, a 3 km de você.',
  },
  {
    idNotificacao: 1, tipo: 'STATUS_PEDIDO', lida: true, dataEnvio: '2026-09-22T17:05:00-03:00', idReferencia: 1031,
    titulo: 'Pedido concluído',
    mensagem: 'O pedido BP-1031 foi retirado em Auto Peças Central. Avalie a loja quando puder.',
  },
];

async function simularListar({ pagina, tamanho, somenteNaoLidas, tipos }) {
  await esperar(500);
  const filtradas = notificacoesSimuladas
    .filter((n) => !somenteNaoLidas || !n.lida)
    .filter((n) => !tipos.length || tipos.includes(n.tipo))
    .sort((a, b) => new Date(b.dataEnvio) - new Date(a.dataEnvio));
  return {
    itens: structuredClone(filtradas.slice(pagina * tamanho, (pagina + 1) * tamanho)),
    pagina,
    tamanho,
    totalRegistros: filtradas.length,
    totalPaginas: Math.ceil(filtradas.length / tamanho),
  };
}