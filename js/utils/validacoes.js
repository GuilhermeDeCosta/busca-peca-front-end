// Validações simples de formato. A API confere tudo de novo; aqui é só para avisar antes do envio.
import { somenteDigitos } from './mascaras.js';

function todosIguais(d) {
  return /^(\d)\1+$/.test(d);
}

export function validarCpf(valor) {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || todosIguais(d)) return false;
  const digito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10]);
}

export function validarCnpj(valor) {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || todosIguais(d)) return false;
  const digito = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, peso, i) => acc + Number(base[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(d.slice(0, 12)) === Number(d[12]) && digito(d.slice(0, 13)) === Number(d[13]);
}

export function validarCep(valor) {
  return somenteDigitos(valor).length === 8;
}

export function validarTelefone(valor) {
  const tamanho = somenteDigitos(valor).length;
  return tamanho === 10 || tamanho === 11;
}

// EAN/GTIN (8, 12, 13 ou 14 dígitos) com dígito verificador
export function validarGtin(valor) {
  const d = somenteDigitos(valor);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const corpo = d.slice(0, -1).split('').reverse();
  const soma = corpo.reduce((acc, n, i) => acc + Number(n) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === Number(d.at(-1));
}

/**
 * Formato do código usado na consulta por OEM, EAN ou SKU (BP1-9, passo 4).
 * Recebe o código já normalizado (maiúsculas, sem espaços). Só deixa passar letras, números e
 * poucos separadores, o que também barra scripts e caracteres estranhos antes de ir para a API.
 * @returns {string} mensagem de erro, ou '' se o formato está certo
 */
export function validarCodigoPeca(tipo, codigo) {
  if (!codigo) return 'Digite o código para buscar.';
  if (tipo === 'EAN') {
    if (![8, 12, 13, 14].includes(codigo.length)) return 'EAN deve ter 8, 12, 13 ou 14 números.';
    if (!validarGtin(codigo)) return 'EAN inválido: o último número (dígito verificador) não confere. Confira o código de barras.';
    return '';
  }
  if (tipo === 'OEM') {
    if (!/^[A-Z0-9/]+$/.test(codigo)) return 'OEM aceita só letras, números e barra.';
    if (codigo.length < 3) return 'OEM deve ter pelo menos 3 caracteres.';
    return '';
  }
  if (!/^[A-Z0-9][A-Z0-9._\-/]*$/.test(codigo)) return 'SKU aceita letras, números, ponto, hífen, sublinhado e barra.';
  if (codigo.length < 2) return 'SKU deve ter pelo menos 2 caracteres.';
  return '';
}