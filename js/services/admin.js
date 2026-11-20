// Serviço da área administrativa: uma função por rota de /api/admin
// (Documentação do Back-end v2, seção 5.12 • casos de uso BP1-49, BP1-51, BP1-54 e BP1-56 • ADR-006, 013).
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

// ---------------------------------------------------------------------------
// Termos e políticas — /api/admin/termos (BP1-54, ADR-013) • permissão PUBLICAR_TERMOS
//
// Tipos: TERMOS_USO, POLITICA_PRIVACIDADE e TERMOS_VENDEDOR (este último ainda
// não está no CHECK da tabela termo_uso).
// Status: RASCUNHO → AGENDADA (vigência no futuro) ou VIGENTE → ARQUIVADA
// (quando outra versão do mesmo documento entra em vigor). Hoje a tabela só
// tem a coluna "vigente"; os demais status e campos abaixo são novos.
//
// Formato esperado de cada versão (TermoAdminResponse):
//   {
//     idTermo, tipo, versao: '1.3', status: 'RASCUNHO',
//     dataVigencia: '2026-12-01',          // data em que entra (ou entrou) em vigor
//     dataPublicacao: '2026-11-20T10:00:00', // null enquanto for rascunho
//     totalAceites: 1198,                  // contagem de aceite_termo
//     resumoMudancas, exigeNovoAceite: true, avisarUsuarios: true,
//     nomeArquivo: 'termos-v1.3.md', tamanhoArquivo: 18432, arquivoUrl: null,
//     conteudo: '## 1. ...'                // só no detalhe (GET /admin/termos/{id})
//   }
// ---------------------------------------------------------------------------

/** GET /api/admin/termos — versões de todos os documentos (sem o conteúdo). */
export async function listarTermos() {
  if (USAR_SIMULACAO) {
    await esperar(450);
    return termosSimulados.map(({ conteudo, ...resto }) => structuredClone(resto));
  }
  const dados = await api.get('/admin/termos');
  return Array.isArray(dados) ? dados : (dados?.itens || []);
}

/** GET /api/admin/termos/{id} — ROTA NOVA: uma versão com o conteúdo (prévia, comparação e download). */
export async function obterTermo(idTermo) {
  if (USAR_SIMULACAO) {
    await esperar(300);
    return structuredClone(termoSimulado(idTermo));
  }
  return api.get(`/admin/termos/${encodeURIComponent(idTermo)}`);
}

// Monta o corpo multipart: parte "dados" (JSON) + parte "arquivo" (PDF ou Markdown, opcional).
// No Spring: @RequestPart("dados") TermoRequest dados, @RequestPart(value = "arquivo", required = false) MultipartFile arquivo
function corpoTermo(dados, arquivo) {
  const corpo = new FormData();
  corpo.append('dados', new Blob([JSON.stringify(dados)], { type: 'application/json' }));
  if (arquivo) corpo.append('arquivo', arquivo, arquivo.name);
  return corpo;
}

/**
 * POST /api/admin/termos — cria uma versão em rascunho (multipart).
 * dados: { tipo, versao, dataVigencia: 'AAAA-MM-DD', resumoMudancas, exigeNovoAceite, avisarUsuarios, conteudo? }
 * "conteudo" vai junto quando o arquivo é Markdown (o front já leu o texto).
 * 409 VERSAO_EM_USO quando tipo + versão já existem (uk_termo_uso_tipo_versao).
 */
export async function criarRascunhoTermo(dados, arquivo = null) {
  if (USAR_SIMULACAO) return simularSalvarTermo(null, dados, arquivo);
  return api.post('/admin/termos', corpoTermo(dados, arquivo));
}

/** PUT /api/admin/termos/{id} — ROTA NOVA: altera um rascunho (multipart, mesmo corpo do POST). */
export async function atualizarRascunhoTermo(idTermo, dados, arquivo = null) {
  if (USAR_SIMULACAO) return simularSalvarTermo(idTermo, dados, arquivo);
  return api.put(`/admin/termos/${encodeURIComponent(idTermo)}`, corpoTermo(dados, arquivo));
}

/** DELETE /api/admin/termos/{id} — ROTA NOVA: exclui um rascunho (409 se já foi publicado). */
export async function excluirRascunhoTermo(idTermo) {
  if (USAR_SIMULACAO) {
    await esperar(400);
    const t = termoSimulado(idTermo);
    if (t.status !== 'RASCUNHO') throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'Só rascunhos podem ser excluídos.' };
    termosSimulados.splice(termosSimulados.indexOf(t), 1);
    return;
  }
  await api.delete(`/admin/termos/${encodeURIComponent(idTermo)}`);
}

/**
 * PATCH /api/admin/termos/{id}/publicar — publica o rascunho (BP1-54).
 * Vigência hoje → VIGENTE (a anterior vira ARQUIVADA); no futuro → AGENDADA.
 * Com exigeNovoAceite, todos precisam aceitar de novo no próximo acesso.
 * Devolve a versão atualizada + contasAfetadas (quantas contas vão precisar aceitar).
 */
export async function publicarTermo(idTermo) {
  if (USAR_SIMULACAO) return simularPublicarTermo(idTermo);
  return api.patch(`/admin/termos/${encodeURIComponent(idTermo)}/publicar`);
}

// ---------------------------------------------------------------------------
// Notificações gerais — /api/admin/notificacoes (BP1-51) • permissão ENVIAR_NOTIFICACOES
//
// Um "aviso" é o envio feito pela administração. Ao enviar, a API cria uma
// linha em notificacao (tipo AVISO_ADMIN, id_admin_origem) para cada pessoa
// do público e por canal. Título, público, categoria, link, agendamento e
// status do aviso ainda não têm tabela: precisam de uma nova (ex.: aviso_admin).
//
// Formato esperado de cada aviso (AvisoAdminResponse):
//   {
//     idAviso, titulo, mensagem, link: 'pages/institucional/termos-de-uso.html' | null, textoAcao: 'Ler termos' | null,
//     publico: 'TODOS' | 'VENDEDORES' | 'COMPRADORES' | 'VENDEDORES_SEM_ANUNCIOS',
//     categoria: 'ATUALIZACAO' | 'MANUTENCAO' | 'DICA' | 'SEGURANCA',
//     canais: ['SISTEMA', 'EMAIL'],
//     status: 'RASCUNHO' | 'AGENDADO' | 'ENVIADO' | 'CANCELADO',
//     enviarEm: '2026-11-25T09:00:00-03:00' | null,   // null = enviar agora
//     dataEnvio: null,                                  // quando foi enviado de fato
//     alcance: 214                                      // pessoas que receberam (ou vão receber)
//   }
// ---------------------------------------------------------------------------

/** GET /api/admin/notificacoes — ROTA NOVA: avisos enviados, agendados e rascunhos (mais recentes primeiro). */
export async function listarAvisos() {
  if (USAR_SIMULACAO) {
    await esperar(400);
    return structuredClone(avisosSimulados);
  }
  const dados = await api.get('/admin/notificacoes?pagina=0&tamanho=50');
  return Array.isArray(dados) ? dados : (dados?.itens || []);
}

/** GET /api/admin/notificacoes/alcance?publico= — ROTA NOVA: quantas contas o público alcança. Devolve { total }. */
export async function obterAlcance(publico) {
  if (USAR_SIMULACAO) {
    await esperar(200);
    return { total: ALCANCE_SIMULADO[publico] ?? 0 };
  }
  return api.get(`/admin/notificacoes/alcance?publico=${encodeURIComponent(publico)}`);
}

/**
 * POST /api/admin/notificacoes — cria o aviso (BP1-51).
 * Corpo: { titulo, mensagem, link, textoAcao, publico, categoria, canais, enviarEm, rascunho }
 *   rascunho: true  → só salva (status RASCUNHO)
 *   enviarEm: null  → envia agora (status ENVIADO)
 *   enviarEm: data  → agenda (status AGENDADO); a API envia na hora marcada
 * Devolve o aviso com status e alcance.
 */
export async function criarAviso(dados) {
  if (USAR_SIMULACAO) return simularSalvarAviso(null, dados);
  return api.post('/admin/notificacoes', dados);
}

/** PUT /api/admin/notificacoes/{id} — ROTA NOVA: altera um rascunho ou um aviso agendado (mesmo corpo do POST). */
export async function atualizarAviso(idAviso, dados) {
  if (USAR_SIMULACAO) return simularSalvarAviso(idAviso, dados);
  return api.put(`/admin/notificacoes/${encodeURIComponent(idAviso)}`, dados);
}

/** DELETE /api/admin/notificacoes/{id} — ROTA NOVA: exclui um rascunho ou cancela um agendado (409 se já foi enviado). */
export async function excluirAviso(idAviso) {
  if (USAR_SIMULACAO) {
    await esperar(400);
    const aviso = avisoSimulado(idAviso);
    if (aviso.status === 'ENVIADO') throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'Este aviso já foi enviado e não pode ser cancelado.' };
    if (aviso.status === 'AGENDADO') aviso.status = 'CANCELADO';
    else avisosSimulados.splice(avisosSimulados.indexOf(aviso), 1);
    return;
  }
  await api.delete(`/admin/notificacoes/${encodeURIComponent(idAviso)}`);
}

/**
 * GET /api/admin/notificacoes/alertas — ROTA NOVA: alertas automáticos ligados ou desligados.
 * { STATUS_PEDIDO: true, NOVA_MENSAGEM: true, ESTOQUE_BAIXO: true, PROMOCOES_FAVORITAS: false }
 */
export async function obterAlertasAutomaticos() {
  if (USAR_SIMULACAO) {
    await esperar(250);
    return { ...alertasSimulados };
  }
  return api.get('/admin/notificacoes/alertas');
}

/** PUT /api/admin/notificacoes/alertas — ROTA NOVA: mesmo formato do GET. Devolve o que ficou salvo. */
export async function salvarAlertasAutomaticos(alertas) {
  if (USAR_SIMULACAO) {
    await esperar(450);
    Object.assign(alertasSimulados, alertas);
    return { ...alertasSimulados };
  }
  return api.put('/admin/notificacoes/alertas', alertas);
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

// ---------- Simulação: termos e políticas ----------

const TERMOS_USO_12 = `## 1. Sobre o Busca Peça
O Busca Peça conecta oficinas e lojas de autopeças para comprar e vender peças, inclusive o estoque parado das oficinas.

## 2. Cadastro e conta
Cada pessoa ou empresa tem uma conta com CPF ou CNPJ. A mesma conta compra e, ao criar uma loja, também vende.

## 3. Anúncios
A loja é responsável pelas informações do anúncio: código da peça, condição, aplicação, preço e estoque.

## 4. Pagamento e entrega
Pagamento, frete e retirada são combinados diretamente entre as partes, fora da plataforma.

## 5. Pedidos
Cada pedido é aceito ou recusado pela loja. Recusas e cancelamentos devolvem a quantidade ao estoque.

## 6. Avaliações
Depois de concluir um pedido, o comprador pode avaliar a loja com uma nota de 1 a 5.

## 7. Suspensão de contas
Contas que descumprirem estes termos podem ser suspensas pela moderação.`;

const TERMOS_USO_13 = `## 1. Sobre o Busca Peça
O Busca Peça conecta oficinas e lojas de autopeças para comprar e vender peças, inclusive o estoque parado das oficinas.

## 2. Cadastro e conta
Cada pessoa ou empresa tem uma conta com CPF ou CNPJ. A mesma conta compra e, ao criar uma loja, também vende.

## 3. Anúncios
A loja é responsável pelas informações do anúncio: código da peça, condição, aplicação, preço e estoque.

## 4. Pagamento e entrega
Nesta fase, pagamento, frete e retirada são combinados diretamente entre as partes, fora da plataforma. Quando o pagamento integrado for lançado, esta seção será atualizada e um novo aceite será solicitado.

## 5. Pedidos
Cada pedido é aceito ou recusado pela loja. Recusas e cancelamentos devolvem a quantidade ao estoque.

## 6. Avaliações
Depois de concluir um pedido, o comprador pode avaliar a loja com uma nota de 1 a 5.

- A avaliação deve tratar da peça e do atendimento.
- Avaliações técnicas (aplicação, compatibilidade, defeito) precisam informar o veículo.
- Avaliações com ofensas ou dados pessoais são removidas pela moderação.

## 7. Suspensão de contas
Contas que descumprirem estes termos podem ser suspensas pela moderação, sempre com justificativa registrada e direito de resposta pelo suporte.`;

const termosSimulados = [
  { idTermo: 5, tipo: 'TERMOS_USO', versao: '1.2', status: 'VIGENTE', dataVigencia: '2026-10-01', dataPublicacao: '2026-09-24T10:00:00-03:00',
    totalAceites: 1198, resumoMudancas: 'Regras de pedidos e devolução ao estoque.', exigeNovoAceite: true, avisarUsuarios: true,
    nomeArquivo: 'termos-v1.2.md', tamanhoArquivo: 16896, arquivoUrl: null, conteudo: TERMOS_USO_12 },
  { idTermo: 6, tipo: 'POLITICA_PRIVACIDADE', versao: '1.2', status: 'VIGENTE', dataVigencia: '2026-10-01', dataPublicacao: '2026-09-24T10:05:00-03:00',
    totalAceites: 1198, resumoMudancas: 'Prazo de guarda dos registros de auditoria.', exigeNovoAceite: true, avisarUsuarios: true,
    nomeArquivo: 'privacidade-v1.2.md', tamanhoArquivo: 12288, arquivoUrl: null,
    conteudo: '## 1. Dados coletados\nNome, documento, contato, endereço e histórico de pedidos.\n\n## 2. Uso dos dados\nOs dados servem para operar a conta, os pedidos e a segurança da plataforma.\n\n## 3. Guarda\nRegistros de auditoria ficam guardados por 5 anos, sem dados pessoais desnecessários.' },
  { idTermo: 3, tipo: 'TERMOS_USO', versao: '1.1', status: 'ARQUIVADA', dataVigencia: '2026-06-15', dataPublicacao: '2026-06-08T10:00:00-03:00',
    totalAceites: 842, resumoMudancas: 'Inclusão das regras de anúncios.', exigeNovoAceite: true, avisarUsuarios: false,
    nomeArquivo: 'termos-v1.1.md', tamanhoArquivo: 14336, arquivoUrl: null,
    conteudo: '## 1. Sobre o Busca Peça\nO Busca Peça conecta oficinas e lojas de autopeças.\n\n## 2. Anúncios\nA loja é responsável pelas informações do anúncio.' },
  { idTermo: 4, tipo: 'TERMOS_VENDEDOR', versao: '1.0', status: 'VIGENTE', dataVigencia: '2026-06-01', dataPublicacao: '2026-05-25T10:00:00-03:00',
    totalAceites: 214, resumoMudancas: 'Primeira versão.', exigeNovoAceite: true, avisarUsuarios: false,
    nomeArquivo: 'termos-vendedor-v1.0.pdf', tamanhoArquivo: 98304, arquivoUrl: null,
    conteudo: '## 1. Obrigações da loja\nManter estoque e preços atualizados e responder aos pedidos.\n\n## 2. Sem comissões\nNenhuma taxa ou comissão é cobrada nesta fase.' },
  { idTermo: 7, tipo: 'TERMOS_USO', versao: '1.3', status: 'RASCUNHO', dataVigencia: '2026-12-01', dataPublicacao: null,
    totalAceites: 0, resumoMudancas: 'Ajuste na seção de pagamento e entrega; inclusão de regras para avaliações técnicas.',
    exigeNovoAceite: true, avisarUsuarios: true, nomeArquivo: 'termos-v1.3.md', tamanhoArquivo: 18432, arquivoUrl: null, conteudo: TERMOS_USO_13 },
];

function termoSimulado(id) {
  const t = termosSimulados.find((x) => x.idTermo === Number(id));
  if (!t) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Versão não encontrada.' };
  return t;
}

async function simularSalvarTermo(idTermo, dados, arquivo) {
  await esperar(600);
  const repetida = termosSimulados.find((t) => t.tipo === dados.tipo && t.versao === dados.versao && t.idTermo !== Number(idTermo));
  if (repetida) {
    throw { status: 409, erro: 'VERSAO_EM_USO', mensagem: `Já existe uma versão ${dados.versao} ${repetida.status === 'RASCUNHO' ? 'em rascunho' : 'publicada'} para este documento.` };
  }
  let termo = idTermo ? termoSimulado(idTermo) : null;
  if (termo && termo.status !== 'RASCUNHO') throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'Só rascunhos podem ser alterados.' };
  if (!termo) {
    termo = { idTermo: Math.max(...termosSimulados.map((t) => t.idTermo)) + 1, status: 'RASCUNHO', dataPublicacao: null, totalAceites: 0, arquivoUrl: null, conteudo: '' };
    termosSimulados.push(termo);
  }
  Object.assign(termo, {
    tipo: dados.tipo, versao: dados.versao, dataVigencia: dados.dataVigencia, resumoMudancas: dados.resumoMudancas,
    exigeNovoAceite: dados.exigeNovoAceite, avisarUsuarios: dados.avisarUsuarios,
  });
  if (arquivo) Object.assign(termo, { nomeArquivo: arquivo.name, tamanhoArquivo: arquivo.size, conteudo: dados.conteudo || '' });
  return structuredClone(termo);
}

async function simularPublicarTermo(idTermo) {
  await esperar(700);
  const termo = termoSimulado(idTermo);
  if (termo.status !== 'RASCUNHO') throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'Esta versão já foi publicada.' };
  if (!termo.nomeArquivo) throw { status: 400, erro: 'DADOS_INVALIDOS', mensagem: 'Envie o texto completo antes de publicar.' };
  const hoje = new Date().toISOString().slice(0, 10);
  termo.dataPublicacao = new Date().toISOString();
  if (termo.dataVigencia <= hoje) {
    termosSimulados.filter((t) => t.tipo === termo.tipo && t.status === 'VIGENTE').forEach((t) => { t.status = 'ARQUIVADA'; });
    termo.status = 'VIGENTE';
  } else {
    termo.status = 'AGENDADA';
  }
  return { ...structuredClone(termo), contasAfetadas: termo.exigeNovoAceite ? (termo.tipo === 'TERMOS_VENDEDOR' ? 214 : 1248) : 0 };
}

// ---------- Simulação: notificações gerais ----------

const ALCANCE_SIMULADO = { TODOS: 1231, VENDEDORES: 214, COMPRADORES: 1017, VENDEDORES_SEM_ANUNCIOS: 38 };

// Datas relativas a hoje: o agendado fica sempre no futuro
function diaRelativo(dias, hora, minuto) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}

const avisosSimulados = [
  { idAviso: 3, titulo: 'Nova versão dos Termos de uso em 01/12', categoria: 'ATUALIZACAO', publico: 'VENDEDORES', canais: ['SISTEMA'],
    mensagem: 'A versão 1.3 traz ajustes na seção de pagamento e entrega. Você precisará aceitar os novos termos no próximo acesso.',
    link: 'pages/institucional/termos-de-uso.html', textoAcao: 'Ler termos', status: 'AGENDADO', enviarEm: diaRelativo(5, 9, 0), dataEnvio: null, alcance: 214 },
  { idAviso: 2, titulo: 'Manutenção programada no domingo', categoria: 'MANUTENCAO', publico: 'TODOS', canais: ['SISTEMA', 'EMAIL'],
    mensagem: 'O Busca Peça ficará fora do ar no domingo, das 2h às 4h, para manutenção.',
    link: null, textoAcao: null, status: 'ENVIADO', enviarEm: diaRelativo(-2, 8, 0), dataEnvio: diaRelativo(-2, 8, 0), alcance: 1231 },
  { idAviso: 1, titulo: 'Dica: cadastre peças pelo código OEM', categoria: 'DICA', publico: 'VENDEDORES_SEM_ANUNCIOS', canais: ['SISTEMA'],
    mensagem: 'Com o código OEM, EAN ou SKU, os dados da peça são preenchidos para você revisar. Leva menos de um minuto.',
    link: 'pages/minha-loja/form-peca.html', textoAcao: 'Cadastrar peça', status: 'ENVIADO', enviarEm: diaRelativo(-10, 14, 0), dataEnvio: diaRelativo(-10, 14, 0), alcance: 38 },
];

const alertasSimulados = { STATUS_PEDIDO: true, NOVA_MENSAGEM: true, ESTOQUE_BAIXO: true, PROMOCOES_FAVORITAS: false };

function avisoSimulado(id) {
  const a = avisosSimulados.find((x) => x.idAviso === Number(id));
  if (!a) throw { status: 404, erro: 'NAO_ENCONTRADO', mensagem: 'Aviso não encontrado.' };
  return a;
}

async function simularSalvarAviso(idAviso, dados) {
  await esperar(650);
  let aviso = idAviso ? avisoSimulado(idAviso) : null;
  if (aviso && !['RASCUNHO', 'AGENDADO'].includes(aviso.status)) {
    throw { status: 409, erro: 'STATUS_INVALIDO', mensagem: 'Este aviso já foi enviado e não pode ser alterado.' };
  }
  if (dados.enviarEm && new Date(dados.enviarEm) <= new Date()) {
    throw { status: 400, erro: 'DADOS_INVALIDOS', mensagem: 'Verifique os campos destacados.', campos: [{ campo: 'enviarEm', mensagem: 'Escolha um horário no futuro.' }] };
  }
  if (!aviso) {
    aviso = { idAviso: Math.max(0, ...avisosSimulados.map((a) => a.idAviso)) + 1 };
    avisosSimulados.unshift(aviso);
  }
  const status = dados.rascunho ? 'RASCUNHO' : dados.enviarEm ? 'AGENDADO' : 'ENVIADO';
  Object.assign(aviso, {
    titulo: dados.titulo, mensagem: dados.mensagem, link: dados.link, textoAcao: dados.textoAcao,
    publico: dados.publico, categoria: dados.categoria, canais: [...dados.canais],
    status, enviarEm: dados.enviarEm, dataEnvio: status === 'ENVIADO' ? new Date().toISOString() : null,
    alcance: ALCANCE_SIMULADO[dados.publico] ?? 0,
  });
  return structuredClone(aviso);
}