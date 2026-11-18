// Serviço de busca: uma função por rota de /api/busca (Documentação do Back-end v2, seção 5.4).
//
// ENQUANTO A API NÃO EXISTE: USAR_SIMULACAO = true devolve respostas falsas no
// mesmo formato que a API vai devolver, para a tela funcionar de ponta a ponta.
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS:
//   1. Descomente o import do api.js abaixo e as linhas "return api...".
//   2. Troque USAR_SIMULACAO para false.
//   3. Apague as funções simular*() do fim do arquivo e os imports de simulação.

// import { api } from '../api.js';
import { esperar, pecasSimuladas, favoritosSimulados, buscasSalvasSimuladas } from './simulacao-busca.js';
import { categoriasSimuladas } from './simulacao.js';

const USAR_SIMULACAO = true;

// Filtros que a API recebe em GET /api/busca. Os outros campos da tela não são enviados.
// precoMin, precoMax e ordenar=preco_desc vêm do protótipo (A02) e ainda não estão na
// Documentação do Back-end: combinar com o time da API antes de desligar a simulação.
const PARAMETROS_DA_API = [
  'q', 'codigo', 'loja', 'categoria', 'veiculo', 'tags', 'condicao', 'origem', 'prontaEntrega',
  'cep', 'lat', 'lng', 'raioKm', 'freteGratis', 'retirada', 'formaPagamento', 'notaMinima',
  'precoMin', 'precoMax', 'ordenar', 'pagina', 'tamanho',
];

/** Monta a query string só com os filtros preenchidos. */
export function montarParametros(filtros = {}) {
  const params = new URLSearchParams();
  PARAMETROS_DA_API.forEach((chave) => {
    const valor = filtros[chave];
    if (valor !== undefined && valor !== null && valor !== '') params.set(chave, valor);
  });
  return params;
}

/**
 * GET /api/busca — busca por texto ou código com filtros (BP1-4, 6, 7, 8, 13, 14, 15, 17, 18).
 *
 * @param {{
 *   q?: string, categoria?: number, veiculo?: string (ids separados por vírgula),
 *   condicao?: 'NOVA'|'USADA'|'RECONDICIONADA', origem?: 'NACIONAL'|'IMPORTADA',
 *   prontaEntrega?: boolean, cep?: string, lat?: string, lng?: string, raioKm?: number,
 *   formaPagamento?: 'PIX'|'DINHEIRO'|'CARTAO_CREDITO'|'CARTAO_DEBITO'|'BOLETO'|'FATURADO',
 *   notaMinima?: number, precoMin?: number, precoMax?: number,
 *   ordenar?: 'relevancia'|'preco'|'preco_desc'|'distancia'|'avaliacao', pagina?: number, tamanho?: number
 * }} filtros
 * @param {{ marca?: string, modelo?: string, ano?: number }} [veiculoSimulado] usado só pela simulação
 * @returns {Promise<{ itens: object[], pagina: number, tamanho: number, totalRegistros: number,
 *   totalPaginas: number, totalLojas: number }>}
 *   Cada item: { idPeca, titulo, codigoOem, codigoSku, codigoEan, marcaPeca, preco, precoPromocional,
 *   condicao, origem, quantidadeEstoque, prontaEntrega, prazoExpedicaoDias, fotoUrl, favorito,
 *   distanciaKm (só com cep ou lat/lng), loja: { idLoja, nomeLoja, avaliacaoMedia, cidade, estado } }
 * Em caso de erro, rejeita com { status, erro, mensagem, campos } (seção 6 do back-end).
 */
export async function buscarPecas(filtros = {}, veiculoSimulado = {}) {
  if (USAR_SIMULACAO) return simularBusca(filtros, veiculoSimulado);
  // return api.get(`/busca?${montarParametros(filtros)}`);
}

/**
 * POST /api/busca/salvas — salva os parâmetros de uma busca (BP1-11). Acesso: logado.
 * @param {string} nome nome dado pelo usuário (ex.: "Revisão padrão Gol G5")
 * @param {string} parametros query string da busca (ex.: "q=farol&veiculo=6")
 * @returns {Promise<{ idBuscaSalva: number, nome: string, parametros: string, criadaEm: string }>}
 */
export async function salvarBusca(nome, parametros) {
  if (USAR_SIMULACAO) return simularSalvarBusca(nome, parametros);
  // return api.post('/busca/salvas', { nome, parametros });
}

// ---------------------------------------------------------------------------
// Simulação (apagar junto com simulacao-busca.js)
// ---------------------------------------------------------------------------

const semAcento = (texto = '') => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Categoria principal traz também as subcategorias (BP1-6, fluxo alternativo)
function idsDaCategoria(idCategoria) {
  const id = Number(idCategoria);
  const principal = categoriasSimuladas.find((c) => c.idCategoria === id);
  return principal ? [id, ...principal.subcategorias.map((s) => s.idCategoria)] : [id];
}

function atendeVeiculo(peca, { marca, modelo, ano }) {
  if (!marca) return true;
  return (peca.compatibilidade || []).some((v) => v.marca === marca
    && (!modelo || v.modelo === modelo)
    && (!ano || (Number(ano) >= v.anoInicio && Number(ano) <= v.anoFim)));
}

// Texto pesquisável da peça, com plural simples ("faróis" também acha "farol")
function textoDaPeca(p) {
  const texto = semAcento([p.titulo, p.codigoOem, p.codigoSku, p.codigoEan, p.marcaPeca].join(' '));
  return `${texto} ${texto.replace(/ois\b/g, 'ol').replace(/oes\b/g, 'ao').replace(/s\b/g, '')}`;
}

// "Farol Onix 2020": um ano digitado vale se a peça for compatível com ele
function anoCompativel(p, palavra) {
  if (!/^\d{4}$/.test(palavra)) return false;
  const ano = Number(palavra);
  return (p.compatibilidade || []).some((v) => ano >= v.anoInicio && ano <= v.anoFim);
}

async function simularBusca(filtros = {}, veiculo = {}) {
  await esperar(450);
  const {
    q, loja: idLojaFiltro, categoria, condicao, origem, prontaEntrega, cep, lat, raioKm, formaPagamento, notaMinima,
    precoMin, precoMax, ordenar = 'relevancia', pagina = 1, tamanho = 12,
  } = filtros;

  // Como na API: com menos de 3 caracteres a busca é recusada (BP1-4, fluxo alternativo 6)
  if (q && q.trim().length < 3) {
    throw { status: 400, erro: 'TERMO_CURTO', mensagem: 'Digite pelo menos 3 caracteres para buscar.', campos: [{ campo: 'q' }] };
  }

  const temLocal = Boolean(cep || lat);
  const palavras = semAcento(q || '').split(/\s+/).filter(Boolean);
  const categorias = categoria ? idsDaCategoria(categoria) : null;
  const precoFinal = (p) => p.precoPromocional ?? p.preco;

  let itens = pecasSimuladas.filter((p) => {
    if (!palavras.every((palavra) => textoDaPeca(p).includes(palavra) || anoCompativel(p, palavra))) return false;
    if (idLojaFiltro && p.loja.idLoja !== Number(idLojaFiltro)) return false;    if (idLojaFiltro && p.loja.idLoja !== Number(idLojaFiltro)) return false;
    if (!atendeVeiculo(p, veiculo)) return false;
    if (condicao && p.condicao !== condicao) return false;
    if (origem && p.origem !== origem) return false;
    if (prontaEntrega === true || prontaEntrega === 'true') { if (!p.prontaEntrega) return false; }
    if (prontaEntrega === false || prontaEntrega === 'false') { if (p.prontaEntrega) return false; }
    if (temLocal && raioKm && p.loja.distanciaKm > Number(raioKm)) return false;
    if (formaPagamento && !p.loja.formasPagamento.includes(formaPagamento)) return false;
    if (notaMinima && p.loja.avaliacaoMedia < Number(notaMinima)) return false;
    if (precoMin && precoFinal(p) < Number(precoMin)) return false;
    if (precoMax && precoFinal(p) > Number(precoMax)) return false;
    return p.quantidadeEstoque > 0; // só anúncio ATIVO e com estoque aparece na busca
  });

  const ordens = {
    recentes: (a, b) => b.publicadoEm.localeCompare(a.publicadoEm),    preco: (a, b) => precoFinal(a) - precoFinal(b),
    preco_desc: (a, b) => precoFinal(b) - precoFinal(a),
    distancia: (a, b) => a.loja.distanciaKm - b.loja.distanciaKm,
    avaliacao: (a, b) => b.loja.avaliacaoMedia - a.loja.avaliacaoMedia,
  };
  itens = [...itens].sort(ordens[ordenar] || ordens.relevancia);

  const totalRegistros = itens.length;
  const totalLojas = new Set(itens.map((p) => p.loja.idLoja)).size;
  const inicio = (Number(pagina) - 1) * Number(tamanho);
  return {
    itens: itens.slice(inicio, inicio + Number(tamanho)).map((p) => {
      const { distanciaKm, formasPagamento, ...loja } = p.loja;
      const { compatibilidade, publicadoEm, ...peca } = p;
      return {
        ...structuredClone(peca),
        loja: { ...loja },
        distanciaKm: temLocal ? distanciaKm : null, // a API só calcula a distância com localização
        favorito: favoritosSimulados.has(p.idPeca),
      };
    }),
    pagina: Number(pagina),
    tamanho: Number(tamanho),
    totalRegistros,
    totalPaginas: Math.max(1, Math.ceil(totalRegistros / Number(tamanho))),
    totalLojas,
  };
}

async function simularSalvarBusca(nome, parametros) {
  await esperar(400);
  const limpo = String(nome || '').trim();
  if (!limpo) {
    throw { status: 400, erro: 'VALIDACAO', mensagem: 'Dê um nome para a busca.', campos: [{ campo: 'nome', mensagem: 'Informe um nome.' }] };
  }
  if (buscasSalvasSimuladas.some((b) => b.nome.toLowerCase() === limpo.toLowerCase())) {
    throw { status: 409, erro: 'NOME_DUPLICADO', mensagem: 'Você já tem uma busca salva com esse nome.' };
  }
  const salva = { idBuscaSalva: buscasSalvasSimuladas.length + 1, nome: limpo, parametros, criadaEm: new Date().toISOString() };
  buscasSalvasSimuladas.push(salva);
  return salva;
}
