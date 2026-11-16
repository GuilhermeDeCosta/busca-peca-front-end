// Serviço de catálogo: categorias e veículos (Documentação do Back-end, seção 5.3).
//
// QUANDO A API E O api.js ESTIVEREM PRONTOS: descomente o import do api.js e as linhas
// "return api...", troque USAR_SIMULACAO para false e apague o import de ./simulacao.js.

// import { api } from '../api.js';
import { esperar, categoriasSimuladas, veiculosSimulados } from './simulacao.js';

const USAR_SIMULACAO = true;

// Lista fixa até existir uma rota de marcas de peça
const MARCAS_PECA = ['Bosch', 'Valeo', 'Magneti Marelli', 'NGK', 'Cofap', 'Monroe', 'SKF', 'Gates',
  'Dayco', 'Mann-Filter', 'Tecfil', 'Fras-le', 'Cobreq', 'Delphi', 'Denso', 'Mahle', 'Original da montadora', 'Outra'];

/**
 * GET /api/categorias — árvore de categorias e subcategorias (BP1-6).
 * @returns {Promise<{ idCategoria: number, nome: string, subcategorias: { idCategoria: number, nome: string }[] }[]>}
 */
export async function listarCategorias() {
  if (USAR_SIMULACAO) {
    await esperar(250);
    return structuredClone(categoriasSimuladas);
  }
  // return api.get('/categorias');
}

/**
 * GET /api/veiculos/marcas — marcas de veículo disponíveis.
 * @returns {Promise<string[]>}
 */
export async function listarMarcasVeiculo() {
  if (USAR_SIMULACAO) {
    await esperar(250);
    return Object.keys(veiculosSimulados);
  }
  // return api.get('/veiculos/marcas');
}

/**
 * GET /api/veiculos?marca= — modelos de uma marca.
 * A rota devolve veículos (marca, modelo, ano, versão); aqui ficam só os nomes de modelo, sem repetir.
 * @returns {Promise<string[]>}
 */
export async function listarModelos(marca) {
  if (!marca) return [];
  if (USAR_SIMULACAO) {
    await esperar(200);
    return [...(veiculosSimulados[marca] || [])];
  }
  // const veiculos = await api.get(`/veiculos?marca=${encodeURIComponent(marca)}`);
  // return [...new Set(veiculos.map((v) => v.modelo))].sort();
}

/**
 * Marcas de peça (Bosch, NGK...). Ainda não há rota no back-end; enquanto isso usa uma lista fixa.
 * @returns {Promise<string[]>}
 */
export async function listarMarcasPeca() {
  return [...MARCAS_PECA]; // trocar pela rota quando ela existir
}

/**
 * GET /api/veiculos?marca=&modelo= — veículos (modelos, versões e anos) de uma marca.
 * O modelo é opcional: sem ele, vêm todos os veículos da marca.
 * Usado no filtro de Ano da busca e para montar o parâmetro "veiculo" de GET /api/busca.
 * @returns {Promise<{ idVeiculo: number, marca: string, modelo: string, ano: number, versao: string }[]>}
 */
export async function listarVeiculos(marca, modelo) {
  if (!marca) return [];
  if (USAR_SIMULACAO) {
    await esperar(200);
    const modelos = (veiculosSimulados[marca] || []).filter((m) => !modelo || m === modelo);
    // Simulação: um veículo por modelo e ano, de 2010 a 2024, com id inventado
    return modelos.flatMap((m) => {
      const base = (Object.keys(veiculosSimulados).indexOf(marca) + 1) * 1000 + veiculosSimulados[marca].indexOf(m) * 100;
      return Array.from({ length: 15 }, (_, i) => ({ idVeiculo: base + i + 1, marca, modelo: m, ano: 2010 + i, versao: '' }));
    });
  }
  // const params = new URLSearchParams({ marca });
  // if (modelo) params.set('modelo', modelo);
  // return api.get(`/veiculos?${params}`);
}
