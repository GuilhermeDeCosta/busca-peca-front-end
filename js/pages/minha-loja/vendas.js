// Tela: minha-loja/vendas.html — Vendas e desempenho
// Acesso: vendedor. Casos de uso: BP1-32 (vendas), BP1-53 (histórico de preços), BP1-65 (desempenho).
// Rotas: GET /api/lojas/minha, /api/lojas/minha/vendas, /api/lojas/minha/desempenho (a criar),
//        GET /api/pecas/{id}/historico-preco
import { obterMinhaLoja, obterVendas, obterDesempenho } from '../../services/lojas.js';
import { obterHistoricoPreco } from '../../services/pecas.js';
import { formatarMoeda, formatarData } from '../../utils/formatacao.js';
import { baixarCsv } from '../../utils/csv.js';
// import { exigirPapel } from '../../auth.js'; // ativar quando auth.js existir

const MESES_NO_FILTRO = 12;
const VENDAS_POR_PAGINA = 5;
const TAMANHO_EXPORTACAO = 100; // máximo por página aceito pela API
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';
const FUSO = 'America/Sao_Paulo';

const numero = new Intl.NumberFormat('pt-BR');
const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO });

// Mês atual no fuso de Brasília
function mesAtual() {
  const partes = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: FUSO }).formatToParts(new Date());
  return { ano: Number(partes.find((p) => p.type === 'year').value), mes: Number(partes.find((p) => p.type === 'month').value) };
}

function montarPeriodo(ano, mes) {
  const chave = `${ano}-${String(mes).padStart(2, '0')}`;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const nome = nomeMes.format(new Date(Date.UTC(ano, mes - 1, 1)));
  return {
    chave,
    de: `${chave}-01`,
    ate: `${chave}-${String(ultimoDia).padStart(2, '0')}`,
    nomeMes: nome,
    rotulo: `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}`, // "Outubro de 2026"
    rotuloMinusculo: `${nome} de ${ano}`, // "outubro de 2026"
  };
}

function listarPeriodos() {
  let { ano, mes } = mesAtual();
  const periodos = [];
  for (let i = 0; i < MESES_NO_FILTRO; i++) {
    periodos.push(montarPeriodo(ano, mes));
    mes -= 1;
    if (mes === 0) { mes = 12; ano -= 1; }
  }
  return periodos;
}

function mesAnterior(periodo) {
  const [ano, mes] = periodo.chave.split('-').map(Number);
  return mes === 1 ? montarPeriodo(ano - 1, 12) : montarPeriodo(ano, mes - 1);
}

function porcentagem(valor) {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function paginaVendas() {
  return {
    periodos: listarPeriodos(),
    periodoChave: '',
    loja: null,

    // Vendas
    resumo: null,
    vendas: [],
    totalVendas: 0,
    totalPaginas: 1,
    pagina: 1,
    carregandoVendas: true,
    erroVendas: '',

    // Desempenho
    desempenho: [],
    totais: null,
    carregandoDesempenho: true,
    erroDesempenho: '',

    // Histórico de preços
    idPecaHistorico: '',
    historico: [],
    carregandoHistorico: false,
    erroHistorico: '',

    exportando: false,
    avisoExportacao: '',
    requisicaoAtual: 0, // ignora respostas de um período antigo quando o usuário troca rápido

    formatarMoeda,
    formatarData,

    async init() {
      // await exigirPapel('VENDEDOR');
      const pedido = new URLSearchParams(location.search).get('periodo');
      this.periodoChave = this.periodos.some((p) => p.chave === pedido) ? pedido : this.periodos[0].chave;
      obterMinhaLoja().then((loja) => { this.loja = loja; }).catch(() => {});
      await this.carregarPeriodo();
    },

    get periodo() {
      return this.periodos.find((p) => p.chave === this.periodoChave) || this.periodos[0];
    },
    get subtitulo() {
      return [this.loja?.nomeLoja, this.periodo.rotuloMinusculo].filter(Boolean).join(' • ');
    },

    async trocarPeriodo() {
      history.replaceState(null, '', `?periodo=${this.periodoChave}`);
      this.pagina = 1;
      this.avisoExportacao = '';
      await this.carregarPeriodo();
    },

    async carregarPeriodo() {
      const requisicao = ++this.requisicaoAtual;
      await Promise.all([this.carregarVendas(requisicao), this.carregarDesempenho(requisicao)]);
    },

    // ----- Vendas -----
    async carregarVendas(requisicao = this.requisicaoAtual) {
      this.carregandoVendas = true;
      this.erroVendas = '';
      try {
        const { de, ate } = this.periodo;
        const resposta = await obterVendas({ de, ate, pagina: this.pagina, tamanho: VENDAS_POR_PAGINA });
        if (requisicao !== this.requisicaoAtual) return;
        this.resumo = resposta.resumo;
        this.vendas = resposta.itens;
        this.totalVendas = resposta.totalRegistros;
        this.totalPaginas = resposta.totalPaginas;
      } catch (erro) {
        if (requisicao !== this.requisicaoAtual) return;
        this.erroVendas = erro?.mensagem || ERRO_GENERICO;
        this.resumo = null;
        this.vendas = [];
      } finally {
        if (requisicao === this.requisicaoAtual) this.carregandoVendas = false;
      }
    },
    irParaPagina(numeroPagina) {
      if (numeroPagina < 1 || numeroPagina > this.totalPaginas || numeroPagina === this.pagina) return;
      this.pagina = numeroPagina;
      this.carregarVendas();
    },
    get resumoLista() {
      if (!this.totalVendas) return '';
      return `Exibindo ${this.vendas.length} de ${this.totalVendas} ${this.totalVendas === 1 ? 'venda' : 'vendas'}`;
    },
    diaMes(iso) {
      return diaMes.format(new Date(iso));
    },

    // ----- Cards do topo -----
    get cards() {
      const r = this.resumo;
      const t = this.totais;
      const anterior = mesAnterior(this.periodo).nomeMes;

      let comparacao = '';
      if (r) {
        const diferenca = r.vendasConcluidas - r.vendasPeriodoAnterior;
        comparacao = diferenca === 0
          ? `Igual a ${anterior}`
          : `${diferenca > 0 ? '+' : '−'}${Math.abs(diferenca)} em relação a ${anterior}`;
      }

      let taxa = '—';
      let detalheTaxa = 'Nenhum pedido recebido no mês';
      if (r?.pedidosRecebidos) {
        taxa = `${Math.round(((r.pedidosRecebidos - r.pedidosRecusados) / r.pedidosRecebidos) * 100)}%`;
        detalheTaxa = r.pedidosRecusados === 0
          ? 'Nenhum pedido recusado no mês'
          : `${r.pedidosRecusados} ${r.pedidosRecusados === 1 ? 'pedido recusado' : 'pedidos recusados'} no mês`;
      }

      return [
        { rotulo: 'Vendas concluídas', valor: r ? numero.format(r.vendasConcluidas) : '', detalhe: comparacao, carregando: this.carregandoVendas, erro: this.erroVendas },
        { rotulo: 'Valor dos itens vendidos', valor: r ? formatarMoeda(r.valorItens) : '', detalhe: 'Sem cobrança da plataforma', carregando: this.carregandoVendas, erro: this.erroVendas },
        { rotulo: 'Visualizações dos anúncios', valor: t ? numero.format(t.visualizacoes) : '', detalhe: t ? `${numero.format(t.acessosDetalhe)} acessos ao detalhe` : '', carregando: this.carregandoDesempenho, erro: this.erroDesempenho },
        { rotulo: 'Taxa de aceite', valor: r ? taxa : '', detalhe: r ? detalheTaxa : '', carregando: this.carregandoVendas, erro: this.erroVendas },
      ];
    },

    // ----- Desempenho -----
    async carregarDesempenho(requisicao = this.requisicaoAtual) {
      this.carregandoDesempenho = true;
      this.erroDesempenho = '';
      try {
        const { de, ate } = this.periodo;
        const resposta = await obterDesempenho({ de, ate });
        if (requisicao !== this.requisicaoAtual) return;
        this.desempenho = resposta.itens;
        this.totais = resposta.totais;
        // Histórico: mantém a peça escolhida; se não houver, usa o anúncio mais visto
        if (!this.desempenho.some((a) => String(a.idPeca) === String(this.idPecaHistorico))) {
          this.idPecaHistorico = this.desempenho[0] ? String(this.desempenho[0].idPeca) : '';
          this.carregarHistorico();
        }
      } catch (erro) {
        if (requisicao !== this.requisicaoAtual) return;
        this.erroDesempenho = erro?.mensagem || ERRO_GENERICO;
        this.desempenho = [];
        this.totais = null;
      } finally {
        if (requisicao === this.requisicaoAtual) this.carregandoDesempenho = false;
      }
    },
    conversao(a) {
      if (!a.acessosDetalhe) return a.pedidos ? '—' : '0%';
      return porcentagem((a.pedidos / a.acessosDetalhe) * 100);
    },
    etiquetaStatus(a) {
      if (a.status === 'PAUSADO') return { texto: 'Pausado', classe: 'etiqueta--neutra' };
      if (a.status === 'RASCUNHO') return { texto: 'Rascunho', classe: 'etiqueta--neutra' };
      if (a.baixoEstoque) return { texto: 'Baixo estoque', classe: 'etiqueta--atencao' };
      return { texto: 'Ativo', classe: 'etiqueta--ativa' };
    },
    numero(valor) {
      return numero.format(valor);
    },

    // ----- Histórico de preços -----
    async carregarHistorico() {
      const id = this.idPecaHistorico;
      this.historico = [];
      this.erroHistorico = '';
      if (!id) return;
      this.carregandoHistorico = true;
      try {
        const linhas = await obterHistoricoPreco(id);
        if (id !== this.idPecaHistorico) return;
        this.historico = linhas;
      } catch (erro) {
        if (id !== this.idPecaHistorico) return;
        this.erroHistorico = erro?.mensagem || ERRO_GENERICO;
      } finally {
        if (id === this.idPecaHistorico) this.carregandoHistorico = false;
      }
    },
    variacao(linha) {
      if (linha.precoAnterior == null) return { texto: 'Publicado', classe: 'text-secondary' };
      const pct = ((linha.precoNovo - linha.precoAnterior) / linha.precoAnterior) * 100;
      if (Math.abs(pct) < 0.05) return { texto: '0%', classe: 'text-secondary' };
      return {
        texto: `${pct > 0 ? '+' : '−'}${porcentagem(Math.abs(pct))}`,
        classe: pct < 0 ? 'texto-queda' : 'texto-alta',
      };
    },

    // ----- Exportar CSV -----
    async exportar() {
      if (this.exportando) return;
      this.exportando = true;
      this.avisoExportacao = '';
      try {
        const { de, ate, chave } = this.periodo;
        const todas = [];
        let paginaAtual = 1;
        let total = 1;
        do {
          const resposta = await obterVendas({ de, ate, pagina: paginaAtual, tamanho: TAMANHO_EXPORTACAO });
          todas.push(...resposta.itens);
          total = resposta.totalPaginas;
          paginaAtual += 1;
        } while (paginaAtual <= total);

        if (!todas.length) {
          this.avisoExportacao = 'Não há vendas concluídas neste período para exportar.';
          return;
        }
        baixarCsv(
          `vendas-${chave}.csv`,
          ['Pedido', 'Data', 'Comprador', 'Peça', 'Quantidade', 'Valor (R$)'],
          todas.map((v) => [v.codigo, formatarData(v.data), v.comprador, v.peca, v.quantidade, v.valor]),
        );
      } catch (erro) {
        this.avisoExportacao = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.exportando = false;
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('vendasLoja', paginaVendas);
});