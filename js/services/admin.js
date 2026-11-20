// Serviço da área administrativa: uma função por rota de /api/admin
// (Documentação do Back-end v2, seção 5.12 • casos de uso BP1-49 e BP1-56 • ADR-006, 013).
//
// QUANDO A API ESTIVER PRONTA: troque USAR_SIMULACAO para false e apague o
// bloco "SIMULAÇÃO" do fim do arquivo.
//
// Status da conta: ATIVO ("Ativa"), BLOQUEADO ("Suspensa", reversível),
// BANIDO ("Banida", definitivo — STATUS NOVO, ainda não está no CHECK da
// tabela usuario) e INATIVO (o próprio usuário pediu a inativação).
//
// Toda ação manda "justificativa": a API grava em log_auditoria (ADR-013).
// Erros seguem o formato único da API: { status, erro, mensagem, campos }.

import { api } from '../api.js';
import { esperar } from './simulacao.js';

export const USAR_SIMULACAO = true;

/**
 * GET /api/admin/usuarios?busca=&status=&papel=&pagina=&tamanho= — lista contas (BP1-49).
 * "papel" é parâmetro novo (filtro da tela). Cada item (UsuarioAdminResumo):
 *   { idUsuario, nome, email, nomeLoja, papeis: ['COMPRADOR','VENDEDOR'], status, dataCadastro }
 * @returns {Promise<{ itens, pagina, tamanho, totalRegistros, totalPaginas }>}
 */
export async function listarUsuarios({ busca = '', status = '', papel = '', pagina = 0, tamanho = 20 } = {}) {
  if (USAR_SIMULACAO) return simularLista({ busca, status, papel, pagina, tamanho });
  const params = new URLSearchParams({ pagina, tamanho });
  if (busca) params.set('busca', busca);
  if (status) params.set('status', status);
  if (papel) params.set('papel', papel);
  return api.get(`/admin/usuarios?${params}`);
}

/**
 * GET /api/admin/usuarios/resumo — ROTA NOVA: números dos cartões do topo.
 * { contasAtivas, novasNaSemana, lojasAtivas, lojasCriadasNoMes, suspensas, banidas }
 */
export async function obterResumoUsuarios() {
  if (USAR_SIMULACAO) {
    await esperar(300);
    return { contasAtivas: 1248, novasNaSemana: 36, lojasAtivas: 214, lojasCriadasNoMes: 12, suspensas: 7, banidas: 2 };
  }
  return api.get('/admin/usuarios/resumo');
}

/**
 * GET /api/admin/usuarios/{id} — detalhe da conta e da loja (BP1-49). Formato esperado:
 * {
 *   idUsuario, nome, email, tipoPessoa: 'PF'|'PJ', documento (já mascarado), telefone,
 *   idLoja, nomeLoja, papeis: [...], status, dataCadastro,
 *   anuncios: { ativos, pausados },              // opcional
 *   pedidosEmAndamento: { total, resumo },       // opcional (ex.: '1 pedido aguardando retirada')
 *   ultimaAcao: { acao, data, responsavel, justificativa }  // opcional: última mudança de status
 * }
 */
export async function obterUsuario(idUsuario) {
  if (USAR_SIMULACAO) {
    await esperar(350);
    return structuredClone(buscarSimulado(idUsuario));
  }
  return api.get(`/admin/usuarios/${encodeURIComponent(idUsuario)}`);
}

/**
 * PATCH /api/admin/usuarios/{id}/status — corpo { status, justificativa }.
 * Suspender = BLOQUEADO, reativar = ATIVO, banir = BANIDO. Devolve o detalhe atualizado.
 * 409 quando o status atual não permite (ex.: conta banida).
 */
export async function alterarStatusUsuario(idUsuario, { status, justificativa }) {
  if (USAR_SIMULACAO) return simularStatus(idUsuario, status, justificativa);
  return api.patch(`/admin/usuarios/${encodeURIComponent(idUsuario)}/status`, { status, justificativa });
}

/**
 * PUT /api/admin/usuarios/{id}/papeis — corpo { papeis: [...todos os papéis da conta], justificativa } (BP1-56).
 * A tela só muda os papéis internos e reenvia COMPRADOR/VENDEDOR como estavam.
 */
export async function alterarPapeisUsuario(idUsuario, { papeis, justificativa }) {
  if (USAR_SIMULACAO) return simularPapeis(idUsuario, papeis, justificativa);
  return api.put(`/admin/usuarios/${encodeURIComponent(idUsuario)}/papeis`, { papeis, justificativa });
}

/**
 * GET /api/admin/usuarios/{id}/historico — ROTA NOVA: ações administrativas sobre a conta (log_auditoria).
 * Cada item: { acao: 'SUSPENDER'|'REATIVAR'|'BANIR'|'ALTERAR_PAPEIS', data, responsavel, justificativa }
 */
export async function listarHistoricoUsuario(idUsuario) {
  if (USAR_SIMULACAO) {
    await esperar(300);
    return structuredClone(historicoSimulado[idUsuario] || []).reverse();
  }
  const dados = await api.get(`/admin/usuarios/${encodeURIComponent(idUsuario)}/historico?pagina=0&tamanho=20`);
  return Array.isArray(dados) ? dados : (dados?.itens || []);
}

/**
 * GET /api/admin/papeis — papéis e suas permissões (BP1-56). Formato esperado:
 *   [{ idPapel, nome: 'MODERADOR', rotulo: 'Moderador', descricao, interno: true, permissoes: ['MODERAR_DISPUTA'], totalPessoas: 4 }]
 */
export async function listarPapeis() {
  if (USAR_SIMULACAO) {
    await esperar(300);
    return structuredClone(papeisSimulados).map((p) => ({
      ...p, totalPessoas: usuariosSimulados.filter((u) => u.papeis.includes(p.nome)).length + (p.extras || 0),
    }));
  }
  const dados = await api.get('/admin/papeis');
  return Array.isArray(dados) ? dados : (dados?.itens || []);
}

/** PUT /api/admin/papeis/{id}/permissoes — corpo { permissoes: ['GERENCIAR_USUARIOS', ...], justificativa }. */
export async function alterarPermissoesPapel(idPapel, { permissoes, justificativa }) {
  if (USAR_SIMULACAO) {
    await esperar(500);
    const papel = papeisSimulados.find((p) => p.idPapel === Number(idPapel));
    if (!papel) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Papel não encontrado.' };
    papel.permissoes = [...permissoes];
    return structuredClone(papel);
  }
  return api.put(`/admin/papeis/${encodeURIComponent(idPapel)}/permissoes`, { permissoes, justificativa });
}

// =========================================================================
// SIMULAÇÃO — apagar este bloco quando a API estiver pronta.
// Contas do protótipo (Fluxo E • Usuários). O admin logado da simulação é a
// "Equipe Busca Peça" (id 100). As mudanças ficam em memória.
// =========================================================================

const papeisSimulados = [
  { idPapel: 3, nome: 'ADMINISTRADOR', rotulo: 'Administrador geral', interno: true, descricao: 'Tudo, inclusive papéis e termos',
    permissoes: ['GERENCIAR_USUARIOS', 'PUBLICAR_TERMOS', 'ENVIAR_NOTIFICACOES', 'GERENCIAR_PERMISSOES', 'MODERAR_DISPUTA'], extras: 0 },
  { idPapel: 4, nome: 'MODERADOR', rotulo: 'Moderador', interno: true, descricao: 'Suspender contas, pausar anúncios, mediar disputas',
    permissoes: ['GERENCIAR_USUARIOS', 'MODERAR_DISPUTA'], extras: 3 },
  { idPapel: 5, nome: 'SUPORTE', rotulo: 'Suporte', interno: true, descricao: 'Ver contas e pedidos, enviar notificações',
    permissoes: ['ENVIAR_NOTIFICACOES'], extras: 5 },
];

const usuariosSimulados = [
  { idUsuario: 1, nome: 'Ana Martins', email: 'ana.martins@example.com', tipoPessoa: 'PJ', documento: '00.000.000/0001-00', telefone: '(19) 90000-0101',
    idLoja: 10, nomeLoja: 'Horizonte Peças', papeis: ['COMPRADOR', 'VENDEDOR'], status: 'ATIVO', dataCadastro: '2026-10-16T09:00:00-03:00',
    anuncios: { ativos: 18, pausados: 1 }, pedidosEmAndamento: { total: 2, resumo: '2 pedidos aguardando aceite' }, ultimaAcao: null },
  { idUsuario: 2, nome: 'Carlos Pereira', email: 'carlos@rumocerto.example.com', tipoPessoa: 'PJ', documento: '11.111.111/0001-11', telefone: '(19) 90000-0202',
    idLoja: null, nomeLoja: null, papeis: ['COMPRADOR'], status: 'ATIVO', dataCadastro: '2026-09-02T14:10:00-03:00',
    anuncios: null, pedidosEmAndamento: { total: 1, resumo: '1 compra aguardando aceite' }, ultimaAcao: null },
  { idUsuario: 3, nome: 'Mecânica Boa Vista', email: 'contato@boavista.example.com', tipoPessoa: 'PJ', documento: '22.222.222/0001-22', telefone: '(19) 90000-0303',
    idLoja: 11, nomeLoja: 'Boa Vista Peças', papeis: ['COMPRADOR', 'VENDEDOR'], status: 'BLOQUEADO', dataCadastro: '2026-08-11T10:00:00-03:00',
    anuncios: { ativos: 0, pausados: 12 }, pedidosEmAndamento: { total: 1, resumo: '1 pedido aguardando retirada' },
    ultimaAcao: { acao: 'SUSPENDER', data: '2026-10-24T15:20:00-03:00', responsavel: 'Juliana Costa', justificativa: '3 pedidos recusados após aceite e reclamação de comprador' } },
  { idUsuario: 4, nome: 'Loja Pneus Já', email: 'vendas@pneusja.example.com', tipoPessoa: 'PJ', documento: '33.333.333/0001-33', telefone: '(19) 90000-0404',
    idLoja: 12, nomeLoja: 'Pneus Já', papeis: ['COMPRADOR', 'VENDEDOR'], status: 'BANIDO', dataCadastro: '2026-07-03T08:30:00-03:00',
    anuncios: { ativos: 0, pausados: 31 }, pedidosEmAndamento: { total: 0, resumo: '' },
    ultimaAcao: { acao: 'BANIR', data: '2026-09-18T11:00:00-03:00', responsavel: 'Equipe Busca Peça', justificativa: 'Venda de peças falsificadas confirmada em 3 disputas' } },
  { idUsuario: 5, nome: 'Juliana Costa', email: 'juliana@buscapeca.example.com', tipoPessoa: 'PF', documento: '***.456.789-**', telefone: '(19) 90000-0505',
    idLoja: null, nomeLoja: null, papeis: ['MODERADOR'], status: 'ATIVO', dataCadastro: '2026-06-01T09:00:00-03:00',
    anuncios: null, pedidosEmAndamento: null, ultimaAcao: null },
  { idUsuario: 6, nome: 'Pedro Almeida', email: 'pedro@buscapeca.example.com', tipoPessoa: 'PF', documento: '***.321.654-**', telefone: '(19) 90000-0606',
    idLoja: null, nomeLoja: null, papeis: ['SUPORTE'], status: 'ATIVO', dataCadastro: '2026-06-15T09:00:00-03:00',
    anuncios: null, pedidosEmAndamento: null, ultimaAcao: null },
  { idUsuario: 7, nome: 'Rafael Souza', email: 'rafael.souza@example.com', tipoPessoa: 'PF', documento: '***.987.123-**', telefone: '(19) 90000-0707',
    idLoja: null, nomeLoja: null, papeis: ['COMPRADOR'], status: 'INATIVO', dataCadastro: '2026-05-20T16:45:00-03:00',
    anuncios: null, pedidosEmAndamento: { total: 0, resumo: '' }, ultimaAcao: null },
  { idUsuario: 100, nome: 'Equipe Busca Peça', email: 'admin@buscapeca.com.br', tipoPessoa: 'PJ', documento: '44.444.444/0001-44', telefone: '',
    idLoja: null, nomeLoja: null, papeis: ['COMPRADOR', 'ADMINISTRADOR'], status: 'ATIVO', dataCadastro: '2026-05-01T08:00:00-03:00',
    anuncios: null, pedidosEmAndamento: null, ultimaAcao: null },
];

const historicoSimulado = {
  3: [{ acao: 'SUSPENDER', data: '2026-10-24T15:20:00-03:00', responsavel: 'Juliana Costa', justificativa: '3 pedidos recusados após aceite e reclamação de comprador' }],
  4: [
    { acao: 'SUSPENDER', data: '2026-09-02T10:00:00-03:00', responsavel: 'Juliana Costa', justificativa: 'Duas disputas abertas por peça falsificada' },
    { acao: 'BANIR', data: '2026-09-18T11:00:00-03:00', responsavel: 'Equipe Busca Peça', justificativa: 'Venda de peças falsificadas confirmada em 3 disputas' },
  ],
  5: [{ acao: 'ALTERAR_PAPEIS', data: '2026-06-01T09:05:00-03:00', responsavel: 'Equipe Busca Peça', justificativa: 'Entrada na equipe de moderação' }],
};

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function buscarSimulado(id) {
  const u = usuariosSimulados.find((x) => x.idUsuario === Number(id));
  if (!u) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Conta não encontrada.' };
  return u;
}

async function simularLista({ busca, status, papel, pagina, tamanho }) {
  await esperar(450);
  const termo = sem(busca.trim());
  const digitos = busca.replace(/\D/g, '');
  const filtradas = usuariosSimulados
    .filter((u) => !status || u.status === status)
    .filter((u) => !papel || u.papeis.includes(papel))
    .filter((u) => !termo
      || [u.nome, u.email, u.nomeLoja].some((c) => sem(c).includes(termo))
      || (digitos.length >= 4 && u.documento.replace(/\D/g, '').includes(digitos)));
  return {
    itens: structuredClone(filtradas.slice(pagina * tamanho, (pagina + 1) * tamanho)).map((u) => ({
      idUsuario: u.idUsuario, nome: u.nome, email: u.email, nomeLoja: u.nomeLoja, papeis: u.papeis, status: u.status, dataCadastro: u.dataCadastro,
    })),
    pagina, tamanho, totalRegistros: filtradas.length, totalPaginas: Math.max(1, Math.ceil(filtradas.length / tamanho)),
  };
}

const ACAO_POR_STATUS = { BLOQUEADO: 'SUSPENDER', ATIVO: 'REATIVAR', BANIDO: 'BANIR' };

async function simularStatus(id, status, justificativa) {
  await esperar(600);
  const u = buscarSimulado(id);
  if (u.status === 'BANIDO') throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'Conta banida não pode mudar de status.' };
  if (u.idUsuario === 100) throw { status: 409, erro: 'ACAO_NA_PROPRIA_CONTA', mensagem: 'Você não pode alterar o status da sua própria conta.' };
  u.status = status;
  const acao = { acao: ACAO_POR_STATUS[status] || 'ALTERAR_STATUS', data: new Date().toISOString(), responsavel: 'Equipe Busca Peça', justificativa };
  u.ultimaAcao = acao;
  if (u.anuncios && status !== 'ATIVO') { u.anuncios.pausados += u.anuncios.ativos; u.anuncios.ativos = 0; }
  (historicoSimulado[u.idUsuario] ??= []).push(acao);
  return structuredClone(u);
}

async function simularPapeis(id, papeis, justificativa) {
  await esperar(600);
  const u = buscarSimulado(id);
  if (u.idUsuario === 100 && !papeis.includes('ADMINISTRADOR')) {
    throw { status: 409, erro: 'ACAO_NA_PROPRIA_CONTA', mensagem: 'Você não pode tirar o próprio papel de administrador.' };
  }
  u.papeis = [...papeis];
  (historicoSimulado[u.idUsuario] ??= []).push({ acao: 'ALTERAR_PAPEIS', data: new Date().toISOString(), responsavel: 'Equipe Busca Peça', justificativa });
  return structuredClone(u);
}