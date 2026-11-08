// Formatação para exibição (dinheiro em R$, datas no padrão brasileiro).

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });

export function formatarMoeda(valor) {
  return moeda.format(Number(valor) || 0);
}

export function formatarData(isoOuDate) {
  if (!isoOuDate) return '';
  const d = isoOuDate instanceof Date ? isoOuDate : new Date(isoOuDate);
  return Number.isNaN(d.getTime()) ? '' : data.format(d);
}

// "1 dia útil", "2 dias úteis"
export function pluralizarDiasUteis(dias) {
  return dias === 1 ? '1 dia útil' : `${dias} dias úteis`;
}