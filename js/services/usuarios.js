// Serviço de usuários: uma função por rota de /api/usuarios e /api/enderecos.
// Estas rotas JÁ EXISTEM na API (base funcional, BP1-134). Os nomes dos campos são os da API
// (UsuarioResponse, EnderecoRequest, EnderecoResponse, CepResponse).
//
// QUANDO O api.js ESTIVER PRONTO:
//   1. Descomente o import do api.js abaixo e as linhas "return api...".
//   2. Troque USAR_SIMULACAO para false.
//   3. Apague o bloco de simulação do fim do arquivo.

// import { api } from '../api.js';
import { esperar } from './simulacao.js';

const USAR_SIMULACAO = true;

/**
 * GET /api/usuarios/me — dados do usuário logado (401 sem login).
 * @returns {Promise<{ idUsuario, nome, nomeExibicao, email, telefone, tipoPessoa, papeis: string[] }>}
 */
export async function obterMeusDados() {
  if (USAR_SIMULACAO) { await esperar(250); return structuredClone(USUARIO_SIMULADO); }
  // return api.get('/usuarios/me');
}

/**
 * GET /api/usuarios/me/enderecos — endereços do usuário (o principal vem marcado).
 * @returns {Promise<{ idEndereco, identificacao, cep, logradouro, numero, complemento, bairro, cidade, estado, principal }[]>}
 */
export async function listarEnderecos() {
  if (USAR_SIMULACAO) { await esperar(250); return structuredClone(enderecosSimulados); }
  // return api.get('/usuarios/me/enderecos');
}

/**
 * POST /api/usuarios/me/enderecos — cadastra um endereço (BP1-24, fluxo alternativo "Alterar endereço").
 * @param {{ identificacao?, cep (só dígitos), logradouro, numero, complemento?, bairro, cidade, estado, principal? }} dados
 * @returns {Promise<object>} o endereço criado, com idEndereco
 * Rejeita com 400 e campos[] quando algum dado está inválido (mensagens da API em português).
 */
export async function cadastrarEndereco(dados) {
  if (USAR_SIMULACAO) return simularCadastroEndereco(dados);
  // return api.post('/usuarios/me/enderecos', dados);
}

/**
 * GET /api/enderecos/cep/{cep} — rua, bairro, cidade e UF a partir do CEP (ViaCEP em produção).
 * @returns {Promise<{ cep, logradouro, bairro, cidade, estado }>} rejeita com 404 se o CEP não existir
 */
export async function consultarCep(cep) {
  if (USAR_SIMULACAO) {
    await esperar(400);
    const achado = CEPS_SIMULADOS[cep];
    if (!achado) throw { status: 404, erro: 'CEP_NAO_ENCONTRADO', mensagem: 'CEP não encontrado. Preencha o endereço manualmente.' };
    return { cep, ...achado };
  }
  // return api.get(`/enderecos/cep/${cep}`);
}

// ---------------------------------------------------------------------------
// Simulação (apagar quando a API estiver ligada). Dados do protótipo, fictícios.
// ---------------------------------------------------------------------------

const USUARIO_SIMULADO = {
  idUsuario: 1, nome: 'Ana Martins', nomeExibicao: 'Oficina Horizonte', email: 'ana.martins@example.com',
  telefone: '19900000101', tipoPessoa: 'PJ', papeis: ['COMPRADOR', 'VENDEDOR'],
};

const enderecosSimulados = [
  {
    idEndereco: 1, identificacao: 'Oficina', cep: '13010110', logradouro: 'Rua das Oficinas', numero: '120',
    complemento: '', bairro: 'Centro', cidade: 'Campinas', estado: 'SP', principal: true,
  },
];

const CEPS_SIMULADOS = {
  13010110: { logradouro: 'Rua das Oficinas', bairro: 'Centro', cidade: 'Campinas', estado: 'SP' },
  13050100: { logradouro: 'Avenida das Peças', bairro: 'Jardim Central', cidade: 'Campinas', estado: 'SP' },
  13270000: { logradouro: '', bairro: '', cidade: 'Valinhos', estado: 'SP' },
};

async function simularCadastroEndereco(dados) {
  await esperar(400);
  const campos = [];
  if (!/^\d{8}$/.test(dados.cep || '')) campos.push({ campo: 'cep', mensagem: 'Informe um CEP com 8 números.' });
  if (!dados.logradouro?.trim()) campos.push({ campo: 'logradouro', mensagem: 'Informe a rua.' });
  if (!dados.numero?.trim()) campos.push({ campo: 'numero', mensagem: 'Informe o número ou S/N.' });
  if (!dados.bairro?.trim()) campos.push({ campo: 'bairro', mensagem: 'Informe o bairro.' });
  if (!dados.cidade?.trim()) campos.push({ campo: 'cidade', mensagem: 'Informe a cidade.' });
  if (!/^[A-Za-z]{2}$/.test(dados.estado || '')) campos.push({ campo: 'estado', mensagem: 'Escolha a UF.' });
  if (campos.length) throw { status: 400, erro: 'VALIDACAO', mensagem: 'Confira os campos destacados.', campos };

  const novo = { ...dados, idEndereco: Math.max(0, ...enderecosSimulados.map((e) => e.idEndereco)) + 1, principal: Boolean(dados.principal) };
  if (novo.principal) enderecosSimulados.forEach((e) => { e.principal = false; });
  enderecosSimulados.push(novo);
  return structuredClone(novo);
}