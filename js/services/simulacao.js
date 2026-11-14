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

// ---------------------------------------------------------------------------
// Vendas e desempenho (tela minha-loja/vendas.html)
// Os números de cada mês são sorteados com uma semente fixa (ano + mês),
// então o mesmo mês mostra sempre os mesmos valores. Outubro de 2026 começa
// com as vendas e métricas do protótipo.
// ---------------------------------------------------------------------------

function sorteador(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMPRADORES = ['Auto Center Parque', 'Mecânica Boa Vista', 'Oficina Rumo Certo', 'Oficina Central',
  'Garagem São Jorge', 'Centro Automotivo Lima', 'Mecânica Irmãos Prado', 'Auto Elétrica Faísca'];

const VENDAS_PROTOTIPO = [
  { codigo: 'BP-2078', dia: 15, comprador: 'Auto Center Parque', idPeca: 102, peca: 'Retrovisor Onix', quantidade: 1, valor: 219.9 },
  { codigo: 'BP-2074', dia: 14, comprador: 'Mecânica Boa Vista', idPeca: 103, peca: 'Filtro de ar', quantidade: 2, valor: 85.8 },
  { codigo: 'BP-2069', dia: 12, comprador: 'Oficina Rumo Certo', idPeca: 101, peca: 'Alternador Bosch 90A', quantidade: 1, valor: 799.0 },
  { codigo: 'BP-2061', dia: 9, comprador: 'Oficina Central', idPeca: 105, peca: 'Bomba d’água', quantidade: 1, valor: 159.9 },
  { codigo: 'BP-2055', dia: 6, comprador: 'Auto Center Parque', idPeca: 103, peca: 'Filtro de ar', quantidade: 3, valor: 128.7 },
];

const METRICAS_PROTOTIPO = {
  101: { visualizacoes: 412, acessosDetalhe: 128, favoritos: 9, pedidos: 5 },
  102: { visualizacoes: 366, acessosDetalhe: 94, favoritos: 6, pedidos: 4 },
  103: { visualizacoes: 241, acessosDetalhe: 52, favoritos: 2, pedidos: 6 },
  104: { visualizacoes: 138, acessosDetalhe: 21, favoritos: 1, pedidos: 0 },
  105: { visualizacoes: 107, acessosDetalhe: 17, favoritos: 0, pedidos: 3 },
};

/** Vendas concluídas de um mês (mes de 1 a 12), da mais recente para a mais antiga. */
export function gerarVendasDoMes(ano, mes) {
  const sortear = sorteador(ano * 100 + mes);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const ehOutubro2026 = ano === 2026 && mes === 10;
  const total = ehOutubro2026 ? 18 : 6 + Math.floor(sortear() * 15);
  const vendas = ehOutubro2026 ? VENDAS_PROTOTIPO.map((v) => ({ ...v })) : [];
  let numero = 2000 + (ano - 2026) * 300 + mes * 25;

  while (vendas.length < total) {
    const peca = anunciosSimulados[Math.floor(sortear() * anunciosSimulados.length)];
    const quantidade = 1 + Math.floor(sortear() * 3);
    vendas.push({
      codigo: `BP-${numero++}`,
      dia: 1 + Math.floor(sortear() * (ehOutubro2026 ? 5 : ultimoDia)),
      comprador: COMPRADORES[Math.floor(sortear() * COMPRADORES.length)],
      idPeca: peca.idPeca,
      peca: peca.titulo,
      quantidade,
      valor: Math.round(peca.preco * quantidade * 100) / 100,
    });
  }

  return vendas
    .map((v, i) => ({
      idPedido: Number(v.codigo.slice(3)) || 1000 + i,
      codigo: v.codigo,
      data: `${ano}-${String(mes).padStart(2, '0')}-${String(v.dia).padStart(2, '0')}T14:00:00-03:00`,
      comprador: v.comprador,
      idPeca: v.idPeca,
      peca: v.peca,
      quantidade: v.quantidade,
      valor: v.valor,
    }))
    .sort((a, b) => b.data.localeCompare(a.data) || b.codigo.localeCompare(a.codigo));
}

/** Pedidos recusados no mês (para a taxa de aceite). */
export function gerarRecusadosDoMes(ano, mes) {
  if (ano === 2026 && mes === 10) return 1;
  return Math.floor(sorteador(ano * 100 + mes + 7)() * 4);
}

/** Métricas de cada anúncio no mês (visualizações, acessos, favoritos, pedidos). */
export function gerarMetricasDoMes(ano, mes) {
  const sortear = sorteador(ano * 100 + mes + 13);
  const ehOutubro2026 = ano === 2026 && mes === 10;
  return anunciosSimulados.map((p) => {
    const fixa = ehOutubro2026 && METRICAS_PROTOTIPO[p.idPeca];
    const visualizacoes = fixa ? fixa.visualizacoes : 20 + Math.floor(sortear() * 380);
    const acessosDetalhe = fixa ? fixa.acessosDetalhe : Math.floor(visualizacoes * (0.05 + sortear() * 0.3));
    return {
      idPeca: p.idPeca,
      titulo: p.titulo,
      codigoSku: p.codigoSku,
      status: p.status,
      baixoEstoque: p.status === 'ATIVO' && p.quantidadeEstoque <= p.limiteAlertaEstoque,
      visualizacoes,
      acessosDetalhe,
      favoritos: fixa ? fixa.favoritos : Math.floor(acessosDetalhe * sortear() * 0.15),
      pedidos: fixa ? fixa.pedidos : (p.status === 'RASCUNHO' ? 0 : Math.floor(acessosDetalhe * sortear() * 0.12)),
    };
  });
}

/** Histórico de preços de uma peça, do mais recente para o mais antigo. */
export function gerarHistoricoPreco(idPeca) {
  const peca = anunciosSimulados.find((p) => p.idPeca === Number(idPeca));
  if (!peca) return [];
  if (peca.idPeca === 101) {
    return [
      { data: '2026-10-14T10:05:00-03:00', precoAnterior: 799.0, precoNovo: 749.0 },
      { data: '2026-10-02T09:30:00-03:00', precoAnterior: 829.0, precoNovo: 799.0 },
      { data: '2026-09-20T16:45:00-03:00', precoAnterior: null, precoNovo: 829.0 },
    ];
  }
  const sortear = sorteador(peca.idPeca);
  const mudancas = Math.floor(sortear() * 3);
  const linhas = [];
  let preco = peca.preco;
  let data = new Date('2026-10-20T10:00:00-03:00');
  for (let i = 0; i < mudancas; i++) {
    const anterior = Math.round(preco * (1 + (sortear() * 0.16 - 0.06)) * 10) / 10;
    linhas.push({ data: data.toISOString(), precoAnterior: anterior, precoNovo: preco });
    preco = anterior;
    data = new Date(data.getTime() - (5 + Math.floor(sortear() * 20)) * 86400000);
  }
  linhas.push({ data: data.toISOString(), precoAnterior: null, precoNovo: preco });
  return linhas;
}