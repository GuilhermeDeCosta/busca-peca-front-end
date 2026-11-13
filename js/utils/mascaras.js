// Máscaras de digitação. Na hora de enviar, use somenteDigitos() (CPF, CNPJ e CEP vão só com dígitos).

export function somenteDigitos(valor = '') {
  return String(valor).replace(/\D/g, '');
}

export function mascararCpf(valor) {
  return somenteDigitos(valor).slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function mascararCnpj(valor) {
  return somenteDigitos(valor).slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function mascararCep(valor) {
  return somenteDigitos(valor).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

export function mascararTelefone(valor) {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Dinheiro: "74900" -> "R$ 749,00" enquanto digita (os dígitos são os centavos)
export function mascararMoeda(valor) {
  const centavos = Number(somenteDigitos(valor).slice(0, 11) || 0);
  if (!centavos) return '';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// "R$ 1.234,50" -> 1234.5 (para enviar à API)
export function moedaParaNumero(valor) {
  return Number(somenteDigitos(valor) || 0) / 100;
}

// 1234.5 -> "R$ 1.234,50" (para preencher o campo ao editar)
export function numeroParaMoeda(numero) {
  if (numero == null || Number.isNaN(Number(numero))) return '';
  return Number(numero).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}