// DADOS SIMULADOS DA BUSCA — apagar este arquivo quando a API de busca estiver pronta.
// Os objetos seguem o formato que GET /api/busca vai devolver (JSON em camelCase).
// Peças, lojas, preços e estoques são os do protótipo (Fluxo A) e são fictícios.
//
// Valores conforme a Documentação do Banco e a base funcional da API (16/11/2026):
//   condicao: NOVA | USADA | RECONDICIONADA      origem: NACIONAL | IMPORTADA
//   formas de pagamento da loja (loja_metodo_pagamento):
//   PIX | DINHEIRO | CARTAO_CREDITO | CARTAO_DEBITO | BOLETO | FATURADO

export { esperar } from './simulacao.js';

// Campos de recebimento da loja (V11 da API): retirada no balcão, motoboy próprio, entrega a combinar
const LOJAS = {
  avenida: {
    idLoja: 11, nomeLoja: 'Autopeças Avenida', avaliacaoMedia: 4.8, totalAvaliacoes: 128, cidade: 'Campinas', estado: 'SP',
    distanciaKm: 3.2, formasPagamento: ['PIX', 'BOLETO', 'FATURADO'],
    retiradaBalcao: true, motoboyProprio: false, entregaCombinar: true,
  },
  motorNorte: {
    idLoja: 12, nomeLoja: 'Motor Norte Peças', avaliacaoMedia: 4.9, totalAvaliacoes: 211, cidade: 'Campinas', estado: 'SP',
    distanciaKm: 5.6, formasPagamento: ['PIX', 'DINHEIRO', 'CARTAO_DEBITO'],
    retiradaBalcao: true, motoboyProprio: true, entregaCombinar: true,
  },
  horizonte: {
    idLoja: 1, nomeLoja: 'Horizonte Peças', avaliacaoMedia: 4.8, totalAvaliacoes: 64, cidade: 'Campinas', estado: 'SP',
    distanciaKm: 1.4, formasPagamento: ['PIX', 'CARTAO_CREDITO'],
    retiradaBalcao: true, motoboyProprio: false, entregaCombinar: false,
  },
  rotaSul: {
    idLoja: 13, nomeLoja: 'Rota Sul Autopeças', avaliacaoMedia: 4.7, totalAvaliacoes: 86, cidade: 'Valinhos', estado: 'SP',
    distanciaKm: 14.8, formasPagamento: ['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'],
    retiradaBalcao: true, motoboyProprio: true, entregaCombinar: true,
  },
  pecaCerta: {
    idLoja: 14, nomeLoja: 'Peça Certa Sumaré', avaliacaoMedia: 3.9, totalAvaliacoes: 17, cidade: 'Sumaré', estado: 'SP',
    distanciaKm: 27.5, formasPagamento: ['PIX', 'DINHEIRO'],
    retiradaBalcao: true, motoboyProprio: false, entregaCombinar: true,
  },
};

const ONIX = [
  { marca: 'Chevrolet', modelo: 'Onix', anoInicio: 2020, anoFim: 2023, versao: '1.0 / 1.0 Turbo • confirmar conectores' },
  { marca: 'Chevrolet', modelo: 'Onix Plus', anoInicio: 2020, anoFim: 2023, versao: 'Consultar aplicação com o vendedor' },
];
const GOL = [{ marca: 'Volkswagen', modelo: 'Gol', anoInicio: 2013, anoFim: 2022 }];
const UNO = [{ marca: 'Fiat', modelo: 'Uno', anoInicio: 2011, anoFim: 2021 }];
const LINHA_GM = [
  { marca: 'Chevrolet', modelo: 'Onix', anoInicio: 2013, anoFim: 2023 },
  { marca: 'Chevrolet', modelo: 'Prisma', anoInicio: 2013, anoFim: 2019 },
];

// Cada peça: campos de GET /api/busca + "compatibilidade" (usada só na simulação para o filtro de veículo)
// fotoUrl: null mostra a imagem padrão (assets/img/peca-sem-foto.svg)
const base = { codigoOem: '', codigoSku: '', codigoEan: '', precoPromocional: null, condicao: 'NOVA', origem: 'NACIONAL', fotoUrl: null };

export const pecasSimuladas = [
  // ---- Faróis do Onix (tela A02 do protótipo: "Farol Onix 2020") ----
  { ...base, idPeca: 201, titulo: 'Farol direito Chevrolet Onix 2020–2023', codigoOem: '52159336', codigoSku: 'AV-FAR-ON20D', marcaPeca: 'Arteb',
    idCategoria: 52, preco: 489.9, quantidadeEstoque: 4, prontaEntrega: false, prazoExpedicaoDias: 1,
    publicadoEm: '2026-11-13T10:00:00-03:00', loja: LOJAS.avenida, compatibilidade: ONIX },
  { ...base, idPeca: 209, titulo: 'Farol direito Onix 2020–2023 Arteb', codigoOem: '52159336', marcaPeca: 'Arteb',
    idCategoria: 52, preco: 519.0, quantidadeEstoque: 2, prontaEntrega: false, prazoExpedicaoDias: 2,
    publicadoEm: '2026-11-12T18:00:00-03:00', loja: LOJAS.rotaSul, compatibilidade: ONIX },
  { ...base, idPeca: 210, titulo: 'Farol direito Onix • original Arteb', codigoOem: '52159336', marcaPeca: 'Arteb',
    idCategoria: 52, preco: 549.9, quantidadeEstoque: 4, prontaEntrega: false, prazoExpedicaoDias: 1,
    publicadoEm: '2026-11-12T08:00:00-03:00', loja: LOJAS.motorNorte, compatibilidade: ONIX },
  { ...base, idPeca: 206, titulo: 'Farol esquerdo Onix 2020–2023', codigoOem: '52159335', marcaPeca: 'Arteb',
    idCategoria: 52, preco: 479.9, quantidadeEstoque: 2, prontaEntrega: false, prazoExpedicaoDias: 2,
    publicadoEm: '2026-11-09T15:00:00-03:00', loja: LOJAS.rotaSul, compatibilidade: ONIX },
  { ...base, idPeca: 207, titulo: 'Par de faróis Chevrolet Onix', codigoSku: 'PAR-ON20', marcaPeca: 'Arteb',
    idCategoria: 52, preco: 969.0, quantidadeEstoque: 4, prontaEntrega: false, prazoExpedicaoDias: 1,
    publicadoEm: '2026-11-08T10:00:00-03:00', loja: LOJAS.avenida, compatibilidade: ONIX },
  { ...base, idPeca: 211, titulo: 'Farol Onix 2020 • conjunto ótico', codigoOem: '52159336', marcaPeca: 'Arteb',
    idCategoria: 52, preco: 499.9, quantidadeEstoque: 2, prontaEntrega: false, prazoExpedicaoDias: 2,
    publicadoEm: '2026-11-06T09:00:00-03:00', loja: LOJAS.rotaSul, compatibilidade: ONIX },

  // ---- Outras peças (página inicial e outras buscas) ----
  { ...base, idPeca: 202, titulo: 'Filtro de óleo Tecfil PSL55', codigoSku: 'FIL-PSL55', marcaPeca: 'Tecfil',
    idCategoria: 43, preco: 29.9, quantidadeEstoque: 18, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-11-12T16:00:00-03:00', loja: LOJAS.motorNorte, compatibilidade: [...LINHA_GM, ...GOL] },
  { ...base, idPeca: 203, titulo: 'Retrovisor elétrico Chevrolet Onix', codigoOem: '52163774', marcaPeca: 'Metagal',
    idCategoria: 51, preco: 219.9, quantidadeEstoque: 6, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-11-12T09:00:00-03:00', loja: LOJAS.avenida, compatibilidade: ONIX },
  { ...base, idPeca: 204, titulo: 'Alternador Bosch 90A • linha GM', codigoOem: '0124325163', codigoSku: 'ALT-90GM', marcaPeca: 'Bosch',
    idCategoria: 11, preco: 749.0, quantidadeEstoque: 2, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-11-11T14:00:00-03:00', loja: LOJAS.horizonte, compatibilidade: LINHA_GM },
  { ...base, idPeca: 205, titulo: 'Para-choque dianteiro Onix 2020', codigoOem: '52159318', marcaPeca: 'Original',
    idCategoria: 5, preco: 379.9, quantidadeEstoque: 3, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-11-10T11:00:00-03:00', loja: LOJAS.rotaSul, compatibilidade: ONIX },
  { ...base, idPeca: 208, titulo: 'Lanterna traseira Fiat Argo 2018–2022', codigoOem: '52012345', marcaPeca: 'Fitam',
    idCategoria: 52, preco: 329.9, precoPromocional: 299.9, quantidadeEstoque: 3, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-11-07T09:30:00-03:00', loja: LOJAS.avenida, compatibilidade: [{ marca: 'Fiat', modelo: 'Argo', anoInicio: 2018, anoFim: 2022 }] },
  { ...base, idPeca: 212, titulo: 'Pastilha de freio dianteira Cobreq', codigoSku: 'PAS-N1234', marcaPeca: 'Cobreq',
    idCategoria: 21, preco: 128.5, quantidadeEstoque: 9, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-11-05T10:00:00-03:00', loja: LOJAS.motorNorte, compatibilidade: [...GOL, ...UNO] },
  { ...base, idPeca: 213, titulo: 'Disco de freio ventilado Gol G5', codigoOem: '5U0615301', marcaPeca: 'Fremax',
    idCategoria: 22, preco: 189.9, quantidadeEstoque: 4, prontaEntrega: false, prazoExpedicaoDias: 3,
    publicadoEm: '2026-11-04T10:00:00-03:00', loja: LOJAS.pecaCerta, compatibilidade: GOL },
  { ...base, idPeca: 214, titulo: 'Amortecedor traseiro Palio usado', codigoSku: 'AMO-PL03', marcaPeca: 'Cofap',
    idCategoria: 31, preco: 112.0, condicao: 'USADA', quantidadeEstoque: 2, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-11-03T10:00:00-03:00', loja: LOJAS.pecaCerta, compatibilidade: [{ marca: 'Fiat', modelo: 'Palio', anoInicio: 2010, anoFim: 2017 }] },
  { ...base, idPeca: 215, titulo: 'Sensor de oxigênio Bosch Gol', codigoOem: '0258006537', marcaPeca: 'Bosch', origem: 'IMPORTADA',
    idCategoria: 13, preco: 189.9, quantidadeEstoque: 6, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-11-02T10:00:00-03:00', loja: LOJAS.horizonte, compatibilidade: GOL },
  { ...base, idPeca: 216, titulo: 'Motor de partida recondicionado Uno', codigoSku: 'MPA-UN01', marcaPeca: 'Valeo', condicao: 'RECONDICIONADA',
    idCategoria: 12, preco: 349.0, quantidadeEstoque: 1, prontaEntrega: false, prazoExpedicaoDias: 2,
    publicadoEm: '2026-11-01T10:00:00-03:00', loja: LOJAS.pecaCerta, compatibilidade: UNO },
  { ...base, idPeca: 217, titulo: 'Correia dentada Gates linha GM', codigoSku: 'COR-5527', marcaPeca: 'Gates',
    idCategoria: 41, preco: 89.9, quantidadeEstoque: 7, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-10-31T10:00:00-03:00', loja: LOJAS.rotaSul, compatibilidade: LINHA_GM },
  { ...base, idPeca: 218, titulo: 'Bomba d’água Uno Fire', codigoSku: 'BOM-UN02', marcaPeca: 'Urba',
    idCategoria: 42, preco: 159.9, quantidadeEstoque: 3, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-10-30T10:00:00-03:00', loja: LOJAS.motorNorte, compatibilidade: UNO },
  { ...base, idPeca: 219, titulo: 'Kit embreagem LUK Gol 1.0', codigoSku: 'EMB-VW06', marcaPeca: 'LUK', origem: 'IMPORTADA',
    idCategoria: 44, preco: 689.0, quantidadeEstoque: 1, prontaEntrega: false, prazoExpedicaoDias: 5,
    publicadoEm: '2026-10-29T10:00:00-03:00', loja: LOJAS.avenida, compatibilidade: GOL },
  { ...base, idPeca: 220, titulo: 'Retrovisor manual Gol G5 esquerdo', codigoSku: 'RET-GL05', marcaPeca: 'Metagal',
    idCategoria: 51, preco: 139.9, quantidadeEstoque: 5, prontaEntrega: true, prazoExpedicaoDias: 0,
    publicadoEm: '2026-10-28T10:00:00-03:00', loja: LOJAS.horizonte, compatibilidade: GOL },
];

// Favoritos, carrinho e buscas salvas em memória: somem ao recarregar a página
export const favoritosSimulados = new Set();
export const carrinhoSimulado = new Map([[201, 1], [202, 2]]); // idPeca → quantidade (carrinho do protótipo A07)
export const buscasSalvasSimuladas = [];


// Descrição e características do detalhe da peça (A04). Peças sem entrada aqui usam um texto padrão.
export const detalhesSimulados = {
  201: {
    descricao: 'Farol dianteiro direito Arteb para Chevrolet Onix 2020 a 2023. Peça nova de origem nacional, com lente transparente e carcaça de encaixe original. Fornecido sem lâmpadas. Lado direito do veículo, lado do passageiro.',
    caracteristicas: '1 farol direito, sem lâmpadas',
  },
  209: {
    descricao: 'Farol direito Arteb para Onix 2020 a 2023, lado do passageiro. Peça nova, nacional, sem lâmpadas.',
    caracteristicas: '1 farol direito, sem lâmpadas',
  },
  204: {
    descricao: 'Alternador novo Bosch 90A, 12 V, com polia de 6 canais. Peça nacional para reposição na linha GM. Confira código, conectores e aplicação antes de solicitar.',
    caracteristicas: '12 V • 90 A • polia 6 canais • conector padrão GM',
  },
};

// Página pública das lojas (A05). Formato de GET /api/lojas/{id} na API (LojaPublicaResponse):
// sem documento, telefone e endereço completo do dono (ADR-013), só cidade e UF.
const EXTRAS_LOJA = {
  11: {
    descricao: 'Loja de autopeças com balcão em Campinas. Atendemos oficinas da região com peças novas nacionais e importadas.',
    horarioRetirada: 'Seg. a sex., 8h–18h • sáb., 8h–12h', freteGratisRaioKm: 5, pedidoMinimoFreteGratis: 300,
    vendedorVerificado: true, ativaDesde: '2025-03-10',
  },
  12: {
    descricao: 'Filtros, correias e peças de manutenção com pronta entrega para oficinas de Campinas.',
    horarioRetirada: 'Seg. a sex., 7h30–18h', freteGratisRaioKm: 10, pedidoMinimoFreteGratis: 200,
    vendedorVerificado: true, ativaDesde: '2024-08-02',
  },
  1: {
    descricao: 'Excedentes de estoque da Oficina Horizonte. Peças novas e revisadas da linha GM, Fiat e VW.',
    horarioRetirada: 'Seg. a sex., 8h–18h • sáb., 8h–12h', freteGratisRaioKm: 10, pedidoMinimoFreteGratis: 200,
    vendedorVerificado: false, ativaDesde: '2026-10-14',
  },
  13: {
    descricao: 'Faróis, lanternas e lataria para a linha GM. Motoboy próprio em Valinhos e Campinas.',
    horarioRetirada: 'Seg. a sáb., 8h–17h', freteGratisRaioKm: null, pedidoMinimoFreteGratis: null,
    vendedorVerificado: true, ativaDesde: '2025-06-21',
  },
  14: {
    descricao: 'Peças usadas e recondicionadas com garantia combinada no balcão.',
    horarioRetirada: 'Seg. a sex., 9h–17h', freteGratisRaioKm: null, pedidoMinimoFreteGratis: null,
    vendedorVerificado: false, ativaDesde: '2026-02-03',
  },
};

export const lojasPublicasSimuladas = Object.values(LOJAS).map((l) => {
  const extra = EXTRAS_LOJA[l.idLoja] || {};
  return {
    idLoja: l.idLoja,
    nomeLoja: l.nomeLoja,
    descricao: extra.descricao || '',
    logoUrl: null,
    bannerUrl: null,
    avaliacaoMedia: l.avaliacaoMedia,
    vendedorVerificado: Boolean(extra.vendedorVerificado),
    cidade: l.cidade,
    estado: l.estado,
    retiradaBalcao: l.retiradaBalcao,
    horarioRetirada: extra.horarioRetirada || '',
    entregaCombinar: l.entregaCombinar,
    motoboyProprio: l.motoboyProprio,
    entregaRapida: l.motoboyProprio,
    freteGratisRaioKm: extra.freteGratisRaioKm ?? null,
    pedidoMinimoFreteGratis: extra.pedidoMinimoFreteGratis ?? null,
    aceitaFaturamentoCnpj: l.formasPagamento.includes('FATURADO'),
    metodosPagamento: [...l.formasPagamento],
    ativaDesde: extra.ativaDesde || null,
    totalAvaliacoes: l.totalAvaliacoes,
  };
});

// Avaliações técnicas (GET /api/lojas/{id}/avaliacoes): uma por pedido concluído (Documentação do Banco)
const COMENTARIOS = [
  { autor: 'Oficina Rumo Certo', nota: 5, comentario: 'Peça conforme o anúncio e retirada rápida no balcão.' },
  { autor: 'Mecânica Boa Vista', nota: 4, comentario: 'Conferiram o conector antes de separar. Atendimento bom.' },
  { autor: 'Auto Center Parque', nota: 5, comentario: 'Embalagem original e nota no balcão.' },
  { autor: 'Oficina Dois Irmãos', nota: 5, comentario: 'Código OEM batia certinho. Voltarei a comprar.' },
  { autor: 'Retífica Santa Cruz', nota: 4, comentario: 'Demorou um pouco para responder, mas a peça veio certa.' },
];
export function avaliacoesSimuladas(idLoja) {
  const loja = Object.values(LOJAS).find((l) => l.idLoja === Number(idLoja));
  const total = loja?.totalAvaliacoes || 0;
  return Array.from({ length: total }, (_, i) => ({
    idAvaliacao: Number(idLoja) * 1000 + i + 1,
    ...COMENTARIOS[i % COMENTARIOS.length],
    dataAvaliacao: new Date(Date.UTC(2026, 9, 28) - i * 86400000 * 2).toISOString(),
  }));
}
