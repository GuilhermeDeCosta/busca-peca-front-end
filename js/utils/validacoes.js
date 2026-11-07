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