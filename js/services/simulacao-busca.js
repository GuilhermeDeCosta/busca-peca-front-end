// DADOS SIMULADOS DA BUSCA — apagar este arquivo quando a API de busca estiver pronta.
// Os objetos seguem o formato que GET /api/busca vai devolver (JSON em camelCase).
// Peças, lojas, preços e estoques são os do protótipo (Fluxo A) e são fictícios.

export { esperar } from './simulacao.js';

const LOJAS = {
  avenida: { idLoja: 11, nomeLoja: 'Autopeças Avenida', avaliacaoMedia: 4.8, cidade: 'Campinas', estado: 'SP', distanciaKm: 3.2 },
  motorNorte: { idLoja: 12, nomeLoja: 'Motor Norte Peças', avaliacaoMedia: 4.9, cidade: 'Campinas', estado: 'SP', distanciaKm: 5.6 },
  horizonte: { idLoja: 1, nomeLoja: 'Horizonte Peças', avaliacaoMedia: 4.8, cidade: 'Campinas', estado: 'SP', distanciaKm: 1.4 },
  rotaSul: { idLoja: 13, nomeLoja: 'Rota Sul Autopeças', avaliacaoMedia: 4.7, cidade: 'Valinhos', estado: 'SP', distanciaKm: 14.8 },
};

// condicao: NOVO | USADO | REMANUFATURADO • origem: NACIONAL | IMPORTADA (ou OEM, GENUINA, PARALELA, GENERICA)
// fotoUrl: null mostra a imagem padrão (assets/img/peca-sem-foto.svg)
export const pecasSimuladas = [
  {
    idPeca: 201, titulo: 'Farol direito Chevrolet Onix 2020–2023', codigoOem: '52159336', codigoSku: 'AV-FAR-ON20D', codigoEan: '',
    marcaPeca: 'Arteb', idCategoria: 52, preco: 489.9, precoPromocional: null, condicao: 'NOVO', origem: 'NACIONAL',
    quantidadeEstoque: 4, prontaEntrega: false, prazoExpedicaoDias: 1, fotoUrl: null, publicadoEm: '2026-11-13T10:00:00-03:00',
    loja: LOJAS.avenida,
  },
  {
    idPeca: 202, titulo: 'Filtro de óleo Tecfil PSL55', codigoOem: '', codigoSku: 'FIL-PSL55', codigoEan: '',
    marcaPeca: 'Tecfil', idCategoria: 43, preco: 29.9, precoPromocional: null, condicao: 'NOVO', origem: 'NACIONAL',
    quantidadeEstoque: 18, prontaEntrega: true, prazoExpedicaoDias: 0, fotoUrl: null, publicadoEm: '2026-11-12T16:00:00-03:00',
    loja: LOJAS.motorNorte,
  },
  {
    idPeca: 203, titulo: 'Retrovisor elétrico Chevrolet Onix', codigoOem: '52163774', codigoSku: '', codigoEan: '',
    marcaPeca: 'Metagal', idCategoria: 51, preco: 219.9, precoPromocional: null, condicao: 'NOVO', origem: 'NACIONAL',
    quantidadeEstoque: 6, prontaEntrega: true, prazoExpedicaoDias: 0, fotoUrl: null, publicadoEm: '2026-11-12T09:00:00-03:00',
    loja: LOJAS.avenida,
  },
  {
    idPeca: 204, titulo: 'Alternador Bosch 90A • linha GM', codigoOem: '', codigoSku: 'ALT-90GM', codigoEan: '',
    marcaPeca: 'Bosch', idCategoria: 11, preco: 749.0, precoPromocional: null, condicao: 'NOVO', origem: 'NACIONAL',
    quantidadeEstoque: 2, prontaEntrega: true, prazoExpedicaoDias: 0, fotoUrl: null, publicadoEm: '2026-11-11T14:00:00-03:00',
    loja: LOJAS.horizonte,
  },
  {
    idPeca: 205, titulo: 'Para-choque dianteiro Onix 2020', codigoOem: '52159318', codigoSku: '', codigoEan: '',
    marcaPeca: 'Original', idCategoria: 5, preco: 379.9, precoPromocional: null, condicao: 'NOVO', origem: 'NACIONAL',
    quantidadeEstoque: 3, prontaEntrega: true, prazoExpedicaoDias: 0, fotoUrl: null, publicadoEm: '2026-11-10T11:00:00-03:00',
    loja: LOJAS.rotaSul,
  },
  {
    idPeca: 206, titulo: 'Farol esquerdo Onix 2020–2023', codigoOem: '52159335', codigoSku: '', codigoEan: '',
    marcaPeca: 'Arteb', idCategoria: 52, preco: 479.9, precoPromocional: null, condicao: 'NOVO', origem: 'NACIONAL',
    quantidadeEstoque: 2, prontaEntrega: false, prazoExpedicaoDias: 2, fotoUrl: null, publicadoEm: '2026-11-09T15:00:00-03:00',
    loja: LOJAS.rotaSul,
  },
  {
    idPeca: 207, titulo: 'Par de faróis Chevrolet Onix', codigoOem: '', codigoSku: 'PAR-ON20', codigoEan: '',
    marcaPeca: 'Arteb', idCategoria: 52, preco: 969.0, precoPromocional: null, condicao: 'NOVO', origem: 'NACIONAL',
    quantidadeEstoque: 4, prontaEntrega: false, prazoExpedicaoDias: 1, fotoUrl: null, publicadoEm: '2026-11-08T10:00:00-03:00',
    loja: LOJAS.avenida,
  },
  {
    idPeca: 208, titulo: 'Lanterna traseira Fiat Argo 2018–2022', codigoOem: '52012345', codigoSku: '', codigoEan: '',
    marcaPeca: 'Fitam', idCategoria: 52, preco: 329.9, precoPromocional: 299.9, condicao: 'NOVO', origem: 'NACIONAL',
    quantidadeEstoque: 3, prontaEntrega: true, prazoExpedicaoDias: 0, fotoUrl: null, publicadoEm: '2026-11-07T09:30:00-03:00',
    loja: LOJAS.avenida,
  },
];

// Favoritos e carrinho em memória: somem ao recarregar a página
export const favoritosSimulados = new Set();
export const carrinhoSimulado = new Map(); // idPeca → quantidade
