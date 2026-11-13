// Serviço de lojas: uma função por rota de /api/lojas (Documentação do Back-end, seção 5.6).
//
// ENQUANTO A API NÃO EXISTE: USAR_SIMULACAO = true devolve respostas falsas no
// mesmo formato que a API vai devolver, para a tela funcionar de ponta a ponta.
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS:
//   1. Descomente o import do api.js abaixo.
//   2. Troque USAR_SIMULACAO para false.
//   3. Apague as funções simular*() do fim do arquivo e o import de ./simulacao.js.
// Nenhuma outra mudança é necessária na tela.

// import { api } from '../api.js';
import { esperar as esperarSimulacao, lojaSimulada, anunciosSimulados, pedidosSimulados, ultimaConversaSimulada } from './simulacao.js';

const USAR_SIMULACAO = true;

/**
 * POST /api/lojas — cria a loja e dá ao usuário o papel VENDEDOR (BP1-67).
 * @param {object} dados corpo da requisição já em camelCase, CPF/CNPJ e CEP só com dígitos
 * @returns {Promise<object>} loja criada
 * Em caso de erro, rejeita com { status, erro, mensagem, campos: [{ campo, mensagem }] }
 * (formato único de erro da API, seção 6 do back-end).
 */
export async function criarLoja(dados) {
  if (USAR_SIMULACAO) return simularCriarLoja(dados);
  // return api.post('/lojas', dados);
}

/**
 * Preenche cidade, UF, rua e bairro a partir do CEP, "quando disponível"
 * (Documentação do Front-end, Formulários). Ainda não há rota prevista no back-end;
 * enquanto isso devolve null e o usuário digita o endereço.
 * @returns {Promise<{logradouro, bairro, cidade, estado} | null>}
 */
export async function buscarEnderecoPorCep(cep) {
  if (USAR_SIMULACAO) return simularBuscarCep(cep);
  return null; // trocar pela rota quando ela existir, ex.: api.get(`/enderecos/cep/${cep}`)
}

/**
 * GET /api/lojas/minha — dados da própria loja (nome, cidade, nota) (BP1-55).
 */
export async function obterMinhaLoja() {
  if (USAR_SIMULACAO) {
    await esperarSimulacao(300);
    return { ...lojaSimulada };
  }
  // return api.get('/lojas/minha');
}

/**
 * GET /api/lojas/minha/painel — dados do painel da Minha Loja (BP1-32, 52, 65).
 * @returns {Promise<{
 *   loja: object,
 *   indicadores: { anunciosAtivos: number, baixoEstoque: number, pedidosRecebidos: number, aguardandoAceite: number },
 *   alertasEstoque: { idPeca: number, titulo: string, quantidadeEstoque: number }[],
 *   ultimaConversa: object | null
 * }>}
 */
export async function obterPainel() {
  if (USAR_SIMULACAO) return simularPainel();
  // return api.get('/lojas/minha/painel');
}

// ---------------------------------------------------------------------------
// Simulações (apagar quando a API estiver pronta)
// ---------------------------------------------------------------------------

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

async function simularCriarLoja(dados) {
  await esperar(900);
  console.info('[simulação] POST /api/lojas', dados);

  // Para testar o estado de erro sem API: use um nome de loja começando com "erro".
  if (dados.nomeLoja.toLowerCase().startsWith('erro')) {
    throw {
      status: 400,
      erro: 'DADOS_INVALIDOS',
      mensagem: 'Revise o CNPJ e o CEP e confirme o aceite dos termos do vendedor.',
      campos: [{ campo: 'cnpjCpf', mensagem: 'Documento já vinculado a outra loja.' }],
    };
  }

  return {
    idLoja: 1,
    nomeLoja: dados.nomeLoja,
    ativa: true,
    avaliacaoMedia: 0,
    cidade: dados.endereco.cidade,
    estado: dados.endereco.estado,
  };
}

async function simularBuscarCep(cep) {
  await esperar(400);
  if (cep === '13010110') {
    return { logradouro: 'Rua das Oficinas', bairro: 'Centro', cidade: 'Campinas', estado: 'SP' };
  }
  return null;
}

async function simularPainel() {
  await esperarSimulacao(500);
  const ativos = anunciosSimulados.filter((p) => p.status === 'ATIVO');
  const baixos = ativos.filter((p) => p.quantidadeEstoque <= p.limiteAlertaEstoque);
  return {
    loja: { ...lojaSimulada },
    indicadores: {
      anunciosAtivos: ativos.length,
      baixoEstoque: baixos.length,
      pedidosRecebidos: pedidosSimulados.length,
      aguardandoAceite: pedidosSimulados.filter((p) => p.status === 'AGUARDANDO_ACEITE').length,
    },
    alertasEstoque: baixos.map(({ idPeca, titulo, quantidadeEstoque }) => ({ idPeca, titulo, quantidadeEstoque })),
    ultimaConversa: { ...ultimaConversaSimulada },
  };
}