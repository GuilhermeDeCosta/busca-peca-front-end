// DADOS SIMULADOS — apagar este arquivo quando a API estiver pronta.
// Os objetos seguem o formato que a API vai devolver (JSON em camelCase).
// Ficam em memória: pausar, reativar ou excluir muda os dados até recarregar a página.

export const esperar = (ms = 500) => new Promise((resolver) => setTimeout(resolver, ms));

export const lojaSimulada = {
  idLoja: 1,
  nomeLoja: 'Horizonte Peças',
  cidade: 'Campinas',
  estado: 'SP',
  nomeDono: 'Ana Martins',
  nomeOficina: 'Oficina Horizonte',
  bannerUrl: null, // ex.: '../../assets/img/banner-exemplo.jpg' para testar com imagem
  logoUrl: null,
  ativa: true,
  avaliacaoMedia: 4.8,
  // Usados na tela Configurações da loja
  descricao: 'Excedentes de estoque da Oficina Horizonte. Peças novas e revisadas da linha GM, Fiat e VW.',
  telefone: '19900000101',
  tipoPessoa: 'PJ',
  cnpjCpf: '11222333000181',
  endereco: { cep: '13010110', logradouro: 'Rua das Oficinas', numero: '120', bairro: 'Centro', cidade: 'Campinas', estado: 'SP' },
  retiradaBalcao: true,
  horarioRetirada: 'Seg. a sex., 8h–18h • sáb., 8h–12h',
  entregaCombinar: true,
  entregaRapida: false,
  freteGratisRaioKm: 10,
  pedidoMinimoFreteGratis: 200,
  metodosPagamento: ['PIX', 'FATURADO'],
};

// status: ATIVO | PAUSADO | RASCUNHO
export const anunciosSimulados = [
  { idPeca: 101, titulo: 'Alternador Bosch 90A', codigoSku: 'ALT-90GM', preco: 749.0, quantidadeEstoque: 2, limiteAlertaEstoque: 3, condicao: 'NOVA', origem: 'NACIONAL', status: 'ATIVO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 102, titulo: 'Retrovisor Onix', codigoSku: 'RET-ON20', preco: 219.9, quantidadeEstoque: 1, limiteAlertaEstoque: 2, condicao: 'NOVA', origem: 'NACIONAL', status: 'ATIVO', prontaEntrega: false, prazoExpedicaoDias: 1 },
  { idPeca: 103, titulo: 'Filtro de ar', codigoSku: 'FIL-AR01', preco: 42.9, quantidadeEstoque: 18, limiteAlertaEstoque: 3, condicao: 'NOVA', origem: 'NACIONAL', status: 'ATIVO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 104, titulo: 'Correia auxiliar', codigoSku: 'COR-GM01', preco: 89.9, quantidadeEstoque: 0, limiteAlertaEstoque: 2, condicao: 'NOVA', origem: 'NACIONAL', status: 'PAUSADO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 105, titulo: 'Bomba d’água', codigoSku: 'BOM-GM02', preco: 159.9, quantidadeEstoque: 1, limiteAlertaEstoque: 2, condicao: 'NOVA', origem: 'NACIONAL', status: 'RASCUNHO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 106, titulo: 'Pastilha de freio dianteira', codigoSku: 'PAS-FD10', preco: 128.5, quantidadeEstoque: 9, limiteAlertaEstoque: 2, condicao: 'NOVA', origem: 'NACIONAL', status: 'ATIVO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 107, titulo: 'Amortecedor traseiro Palio', codigoSku: 'AMO-PL03', preco: 312.0, quantidadeEstoque: 4, limiteAlertaEstoque: 2, condicao: 'USADA', origem: 'NACIONAL', status: 'ATIVO', prontaEntrega: false, prazoExpedicaoDias: 2 },
  { idPeca: 108, titulo: 'Sensor de oxigênio Gol', codigoSku: 'SEN-OX04', preco: 189.9, quantidadeEstoque: 6, limiteAlertaEstoque: 2, condicao: 'NOVA', origem: 'IMPORTADA', status: 'ATIVO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 109, titulo: 'Radiador Fiat Uno', codigoSku: 'RAD-UN05', preco: 420.0, quantidadeEstoque: 2, limiteAlertaEstoque: 2, condicao: 'NOVA', origem: 'NACIONAL', status: 'PAUSADO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 110, titulo: 'Kit embreagem VW', codigoSku: 'EMB-VW06', preco: 689.0, quantidadeEstoque: 1, limiteAlertaEstoque: 1, condicao: 'NOVA', origem: 'NACIONAL', status: 'ATIVO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 111, titulo: 'Velas de ignição (jogo)', codigoSku: 'VEL-IG07', preco: 96.0, quantidadeEstoque: 12, limiteAlertaEstoque: 3, condicao: 'NOVA', origem: 'IMPORTADA', status: 'ATIVO', prontaEntrega: true, prazoExpedicaoDias: 0 },
  { idPeca: 112, titulo: 'Farol dianteiro Celta', codigoSku: 'FAR-CE08', preco: 275.0, quantidadeEstoque: 1, limiteAlertaEstoque: 1, condicao: 'USADA', origem: 'NACIONAL', status: 'RASCUNHO', prontaEntrega: false, prazoExpedicaoDias: 3 },
];

// status: AGUARDANDO_ACEITE | ACEITO | RECUSADO | PRONTO_RETIRADA | EM_ENTREGA | CONCLUIDO | CANCELADO
export const pedidosSimulados = [
  { idPedido: 2081, codigo: 'BP-2081', comprador: 'Oficina Rumo Certo', resumoItens: '1 alternador Bosch', data: '2026-10-16T09:12:00-03:00', valorItens: 749.0, status: 'AGUARDANDO_ACEITE', idConversa: 501 },
  { idPedido: 2080, codigo: 'BP-2080', comprador: 'Mecânica Boa Vista', resumoItens: '2 filtros de ar', data: '2026-10-16T08:40:00-03:00', valorItens: 85.8, status: 'ACEITO', idConversa: 502 },
  { idPedido: 2079, codigo: 'BP-2079', comprador: 'Centro Automotivo Lima', resumoItens: '1 kit embreagem VW', data: '2026-10-15T16:05:00-03:00', valorItens: 689.0, status: 'AGUARDANDO_ACEITE', idConversa: null },
  { idPedido: 2078, codigo: 'BP-2078', comprador: 'Auto Center Parque', resumoItens: '1 retrovisor', data: '2026-10-15T11:30:00-03:00', valorItens: 219.9, status: 'PRONTO_RETIRADA', idConversa: 503 },
  { idPedido: 2077, codigo: 'BP-2077', comprador: 'Garagem São Jorge', resumoItens: '4 velas de ignição', data: '2026-10-14T14:20:00-03:00', valorItens: 96.0, status: 'CONCLUIDO', idConversa: null },
];

export const ultimaConversaSimulada = {
  idConversa: 501,
  comprador: 'Oficina Rumo Certo',
  codigoPedido: 'BP-2081',
  ultimaMensagem: 'Bom dia! Consigo retirar o alternador amanhã?',
};

export const categoriasSimuladas = [
  { idCategoria: 1, nome: 'Elétrica', subcategorias: [
    { idCategoria: 11, nome: 'Alternadores' }, { idCategoria: 12, nome: 'Motores de partida' },
    { idCategoria: 13, nome: 'Sensores' }, { idCategoria: 14, nome: 'Velas e cabos' } ] },
  { idCategoria: 2, nome: 'Freios', subcategorias: [
    { idCategoria: 21, nome: 'Pastilhas' }, { idCategoria: 22, nome: 'Discos' }, { idCategoria: 23, nome: 'Fluidos' } ] },
  { idCategoria: 3, nome: 'Suspensão', subcategorias: [
    { idCategoria: 31, nome: 'Amortecedores' }, { idCategoria: 32, nome: 'Bandejas' } ] },
  { idCategoria: 4, nome: 'Motor', subcategorias: [
    { idCategoria: 41, nome: 'Correias' }, { idCategoria: 42, nome: 'Bombas d’água' }, { idCategoria: 43, nome: 'Filtros' },
    { idCategoria: 44, nome: 'Embreagem' }, { idCategoria: 45, nome: 'Arrefecimento' } ] },
  { idCategoria: 5, nome: 'Carroceria', subcategorias: [
    { idCategoria: 51, nome: 'Retrovisores' }, { idCategoria: 52, nome: 'Faróis e lanternas' } ] },
];

export const veiculosSimulados = {
  Chevrolet: ['Celta', 'Corsa', 'Onix', 'Prisma', 'S10'],
  Fiat: ['Palio', 'Siena', 'Strada', 'Uno'],
  Ford: ['Fiesta', 'Ka', 'Ranger'],
  Volkswagen: ['Fox', 'Gol', 'Polo', 'Saveiro', 'Voyage'],
  Renault: ['Clio', 'Logan', 'Sandero'],
};

// Base externa de códigos (GET /api/pecas/autopreenchimento)
export const referenciasSimuladas = {
  '0124325163': {
    titulo: 'Alternador Bosch 90A • linha GM',
    descricao: 'Alternador novo Bosch 90A, 12 V, com polia de 6 canais. Peça nacional para reposição na linha GM. Confira código, conectores e aplicação antes de solicitar. Embalagem com 1 unidade.',
    idCategoria: 11,
    marcaPeca: 'Bosch',
    codigoOem: '0124325163',
    codigoEan: '',
    caracteristicas: '12 V • 90 A • polia 6 canais • conector padrão GM',
    condicao: 'NOVA',
    origem: 'NACIONAL',
    aplicacoes: [{ marca: 'Chevrolet', modelo: 'Corsa', anoInicial: 2002, anoFinal: 2012, versao: '1.0 / 1.4 • confirmar OEM' }],
  },
};