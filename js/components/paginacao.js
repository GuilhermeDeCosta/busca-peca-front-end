/* =========================================================
   PAGINAÇÃO • js/components/paginacao.js
   Estilos em css/componentes.css ("PAGINAÇÃO").

   Documentação do Front-end: "Paginação • Todas as listas • Navegação entre
   páginas a partir do total informado pela API".

   Uso com Alpine (o HTML fica na página):
     import { numerosDePagina } from '../../components/paginacao.js';
     paginas() { return numerosDePagina(this.pagina, this.totalPaginas); }
   ========================================================= */

/**
 * Números que aparecem na paginação. "…" marca páginas escondidas.
 * Ex.: numerosDePagina(6, 12) → [1, '…', 5, 6, 7, '…', 12]
 * @param {number} atual página aberta (começa em 1)
 * @param {number} total total de páginas (totalPaginas da API)
 * @param {number} [vizinhas=1] quantas páginas mostrar de cada lado da atual
 */
export function numerosDePagina(atual, total, vizinhas = 1) {
  if (total <= 1) return [];
  const paginas = new Set([1, total]);
  for (let p = atual - vizinhas; p <= atual + vizinhas; p += 1) {
    if (p >= 1 && p <= total) paginas.add(p);
  }
  const ordenadas = [...paginas].sort((a, b) => a - b);
  return ordenadas.flatMap((p, i) => (i > 0 && p - ordenadas[i - 1] > 1 ? ['…', p] : [p]));
}
