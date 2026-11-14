// Gera e baixa um arquivo CSV no formato que o Excel brasileiro abre direto:
// separador ";", vírgula nos decimais e BOM no início para os acentos aparecerem certos.

function celula(valor) {
  if (valor == null) return '';
  let texto = typeof valor === 'number'
    ? (Number.isInteger(valor) ? String(valor) : valor.toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    : String(valor);
  // Evita que o Excel trate o texto como fórmula (=, +, -, @ no início)
  if (/^[=+\-@]/.test(texto) && typeof valor !== 'number') texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * @param {string} nomeArquivo ex.: 'vendas-2026-10.csv'
 * @param {string[]} cabecalho nomes das colunas
 * @param {(string|number|null)[][]} linhas
 */
export function baixarCsv(nomeArquivo, cabecalho, linhas) {
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(celula).join(';')).join('\r\n');
  const arquivo = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}