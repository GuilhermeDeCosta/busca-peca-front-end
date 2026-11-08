// Tela: minha-loja/painel.html — Painel Minha Loja: listar meus anúncios com filtros
// Acesso: vendedor. Rotas: GET /api/lojas/minha/painel, GET /api/pecas?loja=minha, GET /api/pedidos?loja=minha
import { obterPainel } from '../../services/lojas.js';
import { listarMeusAnuncios, pausarAnuncio, reativarAnuncio, excluirAnuncio } from '../../services/pecas.js';
import { listarPedidosRecebidos } from '../../services/pedidos.js';
import { formatarMoeda, formatarData, pluralizarDiasUteis } from '../../utils/formatacao.js';
// import { exigirPapel } from '../../auth.js'; // ativar quando auth.js existir

const ANUNCIOS_POR_PAGINA = 5;
const PEDIDOS_NO_PAINEL = 3;
const ESPERA_BUSCA_MS = 350;
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';

const CONDICOES = { NOVA: 'Novo', USADA: 'Usado', REMANUFATURADA: 'Remanufaturado' };
const ORIGENS = { NACIONAL: 'Nacional', IMPORTADA: 'Importado', ORIGINAL: 'Original', PARALELA: 'Paralela' };
const STATUS_PEDIDO = {
  AGUARDANDO_ACEITE: 'Aguardando aceite',
  ACEITO: 'Aceito',
  RECUSADO: 'Recusado',
  PRONTO_RETIRADA: 'Pronto para retirada',
  EM_ENTREGA: 'Em entrega',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

function paginaPainel() {
  return {
    // Painel
    carregandoPainel: true,
    erroPainel: '',
    loja: null,
    indicadores: { anunciosAtivos: 0, baixoEstoque: 0, pedidosRecebidos: 0, aguardandoAceite: 0 },
    alertasEstoque: [],
    ultimaConversa: null,

    // Meus anúncios
    filtros: { q: '', status: '', estoque: '' },
    anuncios: [],
    totalAnuncios: 0,
    totalPaginas: 1,
    pagina: 1,
    carregandoAnuncios: true,
    erroAnuncios: '',
    selecionado: null,
    emAcao: null, // idPeca com ação em andamento
    temporizadorBusca: null,

    // Pedidos
    pedidos: [],
    carregandoPedidos: true,
    erroPedidos: '',

    // Avisos e confirmação
    aviso: null, // { tipo: 'sucesso' | 'erro', texto }
    confirmacao: { aberta: false, titulo: '', texto: '', botao: '', aoConfirmar: null },

    formatarMoeda,
    formatarData,

    async init() {
      // Quando auth.js existir: sem login vai para o login; sem loja vai para criar-loja.html.
      // await exigirPapel('VENDEDOR');
      await Promise.all([this.carregarPainel(), this.carregarAnuncios(), this.carregarPedidos()]);
    },

    // ----- Carregamento -----
    async carregarPainel() {
      this.carregandoPainel = true;
      this.erroPainel = '';
      try {
        const painel = await obterPainel();
        this.loja = painel.loja;
        this.indicadores = painel.indicadores;
        this.alertasEstoque = painel.alertasEstoque || [];
        this.ultimaConversa = painel.ultimaConversa;
      } catch (erro) {
        this.erroPainel = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.carregandoPainel = false;
      }
    },

    async carregarAnuncios() {
      this.carregandoAnuncios = true;
      this.erroAnuncios = '';
      try {
        const resposta = await listarMeusAnuncios({ ...this.filtros, pagina: this.pagina, tamanho: ANUNCIOS_POR_PAGINA });
        this.anuncios = resposta.itens;
        this.totalAnuncios = resposta.totalRegistros;
        this.totalPaginas = resposta.totalPaginas;
        if (this.selecionado && !this.anuncios.some((a) => a.idPeca === this.selecionado.idPeca)) {
          this.selecionado = null;
        } else if (this.selecionado) {
          this.selecionado = this.anuncios.find((a) => a.idPeca === this.selecionado.idPeca);
        }
      } catch (erro) {
        this.erroAnuncios = erro?.mensagem || ERRO_GENERICO;
        this.anuncios = [];
      } finally {
        this.carregandoAnuncios = false;
      }
    },

    async carregarPedidos() {
      this.carregandoPedidos = true;
      this.erroPedidos = '';
      try {
        const resposta = await listarPedidosRecebidos({ tamanho: PEDIDOS_NO_PAINEL });
        this.pedidos = resposta.itens;
      } catch (erro) {
        this.erroPedidos = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.carregandoPedidos = false;
      }
    },

    // ----- Filtros e paginação -----
    aoDigitarBusca() {
      clearTimeout(this.temporizadorBusca);
      this.temporizadorBusca = setTimeout(() => this.aplicarFiltros(), ESPERA_BUSCA_MS);
    },
    aplicarFiltros() {
      clearTimeout(this.temporizadorBusca);
      this.pagina = 1;
      this.carregarAnuncios();
    },
    limparFiltros() {
      this.filtros = { q: '', status: '', estoque: '' };
      this.aplicarFiltros();
    },
    get temFiltro() {
      return Boolean(this.filtros.q.trim() || this.filtros.status || this.filtros.estoque);
    },
    irParaPagina(numero) {
      if (numero < 1 || numero > this.totalPaginas || numero === this.pagina) return;
      this.pagina = numero;
      this.carregarAnuncios();
    },
    get resumoLista() {
      if (!this.totalAnuncios) return '';
      const plural = this.totalAnuncios === 1 ? 'anúncio' : 'anúncios';
      return `Exibindo ${this.anuncios.length} de ${this.totalAnuncios} ${plural} • preço e estoque editáveis por anúncio.`;
    },

    // ----- Textos da tabela -----
    textoQuantidade(a) {
      if (a.quantidadeEstoque === 0) return '0 • sem estoque';
      if (a.quantidadeEstoque <= a.limiteAlertaEstoque) return `${a.quantidadeEstoque} • baixo estoque`;
      return String(a.quantidadeEstoque);
    },
    estoqueEmAlerta(a) {
      return a.status === 'ATIVO' && a.quantidadeEstoque <= a.limiteAlertaEstoque;
    },
    textoCondicao(a) {
      return [CONDICOES[a.condicao] || a.condicao, ORIGENS[a.origem] || a.origem].filter(Boolean).join(' / ');
    },
    textoDisponibilidade(a) {
      if (a.status === 'PAUSADO') return 'Pausado';
      if (a.status === 'RASCUNHO') return 'Rascunho';
      return `Ativo • ${a.prontaEntrega ? 'pronta entrega' : pluralizarDiasUteis(a.prazoExpedicaoDias)}`;
    },
    linkEditar(a) {
      return `form-peca.html?id=${encodeURIComponent(a.idPeca)}`;
    },

    textoStatusPedido(p) {
      return STATUS_PEDIDO[p.status] || p.status;
    },
    linkDetalhePedido(p) {
      return `pedidos.html?id=${encodeURIComponent(p.idPedido)}`;
    },
    acaoPedido(p) {
      if (p.status === 'ACEITO') return { texto: 'preparar', link: this.linkDetalhePedido(p) };
      if (p.idConversa) return { texto: 'conversa', link: `../conta/conversas.html?id=${encodeURIComponent(p.idConversa)}` };
      return null;
    },

    // ----- Textos do topo -----
    get localLoja() {
      if (!this.loja) return '';
      return [`${this.loja.cidade}/${this.loja.estado}`, this.loja.nomeDono, this.loja.nomeOficina].filter(Boolean).join(' • ');
    },
    get tituloAlerta() {
      const n = this.alertasEstoque.length;
      return n === 1 ? '1 anúncio precisa de atenção' : `${n} anúncios precisam de atenção`;
    },
    get textoAlerta() {
      const nomes = this.alertasEstoque.slice(0, 3).map((a) => a.titulo);
      const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0];
      const resto = this.alertasEstoque.length > 3 ? ` e mais ${this.alertasEstoque.length - 3}` : '';
      return `Confira as quantidades de ${lista}${resto}. Estoque atualizado evita pedidos que você não pode atender.`;
    },
    filtrarBaixoEstoque() {
      this.filtros = { q: '', status: 'ATIVO', estoque: 'BAIXO' };
      this.aplicarFiltros();
      document.getElementById('meus-anuncios')?.scrollIntoView({ behavior: 'smooth' });
    },

    // ----- Seleção e ações -----
    selecionar(a) {
      this.selecionado = this.selecionado?.idPeca === a.idPeca ? null : a;
    },
    get podePausar() { return this.selecionado?.status === 'ATIVO'; },
    get podeReativar() { return this.selecionado?.status === 'PAUSADO'; },
    get podeExcluir() { return this.selecionado?.status === 'RASCUNHO'; },
    get dicaGerenciar() {
      if (!this.selecionado) return 'Selecione um anúncio na tabela para pausar, reativar ou excluir.';
      return `Selecionado: ${this.selecionado.titulo} • ${this.selecionado.codigoSku}.`;
    },

    async executar(a, acao, mensagemSucesso) {
      this.emAcao = a.idPeca;
      this.aviso = null;
      try {
        await acao(a.idPeca);
        this.aviso = { tipo: 'sucesso', texto: mensagemSucesso };
        await Promise.all([this.carregarAnuncios(), this.carregarPainel()]);
      } catch (erro) {
        this.aviso = { tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO };
      } finally {
        this.emAcao = null;
      }
    },
    pausar(a = this.selecionado) {
      if (!a) return;
      this.executar(a, pausarAnuncio, `Anúncio pausado. ${a.titulo} não aparece mais nas buscas.`);
    },
    reativar(a = this.selecionado) {
      if (!a) return;
      this.executar(a, reativarAnuncio, `Anúncio reativado. ${a.titulo} voltou a aparecer nas buscas.`);
    },
    excluir(a = this.selecionado) {
      if (!a) return;
      this.abrirConfirmacao({
        titulo: 'Excluir rascunho?',
        texto: `${a.titulo} (${a.codigoSku}) será removido da sua lista. Pedidos existentes permanecem no histórico.`,
        botao: 'Excluir rascunho',
        aoConfirmar: () => this.executar(a, excluirAnuncio, `Rascunho excluído. ${a.titulo} saiu da sua lista.`).then(() => {
          if (this.selecionado?.idPeca === a.idPeca) this.selecionado = null;
        }),
      });
    },

    // ----- Janela de confirmação -----
    abrirConfirmacao(opcoes) {
      this.elementoAntesDaJanela = document.activeElement;
      this.confirmacao = { aberta: true, ...opcoes };
      this.$nextTick(() => document.getElementById('botao-confirmar')?.focus());
    },
    fecharConfirmacao() {
      this.confirmacao.aberta = false;
      this.elementoAntesDaJanela?.focus?.();
    },
    confirmar() {
      const acao = this.confirmacao.aoConfirmar;
      this.fecharConfirmacao();
      acao?.();
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('painelLoja', paginaPainel);
});