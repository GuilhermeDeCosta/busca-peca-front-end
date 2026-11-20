// Links entre páginas, montados a partir da raiz do projeto.
// Funcionam em qualquer pasta de pages/ (js/utils/ → ../../ é a raiz).
// Os caminhos seguem os do js/components/cabecalho.js. Mudou o nome de um arquivo? Mude aqui e lá.

export const RAIZ = new URL('../../', import.meta.url);

export const PAGINAS = {
  inicio: 'index.html',
  resultados: 'pages/busca/resultados.html',
  detalhePeca: 'pages/busca/detalhe-peca.html',
  lojaPublica: 'pages/busca/loja-publica.html',
  comparar: 'pages/busca/comparar.html',
  login: 'pages/conta/login.html',
  favoritos: 'pages/conta/favoritos.html',
  buscasSalvas: 'pages/conta/favoritos.html#buscas-salvas',
  conversas: 'pages/conta/conversas.html',
  carrinho: 'pages/compra/carrinho.html',
  criarLoja: 'pages/minha-loja/criar-loja.html',
  painelLoja: 'pages/minha-loja/painel.html',
  novaPeca: 'pages/minha-loja/form-peca.html',
};

/**
 * Endereço de uma página com parâmetros. Valores vazios são ignorados.
 * Ex.: linkPara('resultados', { q: 'farol', categoria: 3 })
 */
export function linkPara(pagina, params = {}) {
  const url = new URL(PAGINAS[pagina], RAIZ);
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(chave, valor);
  });
  return url.href;
}

/**
 * Login que volta para a página pedida depois de entrar (login.js lê ?voltar=).
 * @param {string} destino endereço completo da página de volta
 */
export function linkLogin(destino = window.location.href) {
  const url = new URL(destino, window.location.href);
  return linkPara('login', { voltar: url.pathname + url.search });
}
