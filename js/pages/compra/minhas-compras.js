// Tela: compra/minhas-compras.html — Meus pedidos (Fluxo A • Encontrar e comprar, A10 / etapa 09)
// Acesso: logado. Casos de uso: BP1-20 (histórico de pedidos), BP1-27 (acompanhar status)
// Rota: GET /api/compras?q=&status=&de=&ate=&pagina=&tamanho=
//
// Como funciona:
//   - A API devolve COMPRAS, cada uma com o pedido de cada loja (ADR-009). A tabela mostra um pedido por
//     linha, que é como o protótipo acompanha "uma loja de cada vez".
//   - Busca (código, loja ou peça), status e período ficam no endereço (?q=&status=&periodo=2026-10):
//     ao voltar do detalhe do pedido, a lista volta como estava.
//   - "Carregar mais pedidos" pede a próxima página e soma na lista.
//   - O status de cada linha leva ao detalhe do pedido (compra/detalhe-pedido.html?id=).
//   - Sem login, a API responde 401 e a página leva para o login, voltando para cá.
import { listarCompras } from '../../services/pedidos.js';
import { formatarMoeda, formatarData } from '../../utils/formatacao.js';
import { OPCOES_STATUS_PEDIDO, rotuloStatusPedido } from '../../utils/status-pedido.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const COMPRAS_POR_PAGINA = 6;
const ESPERA_BUSCA_MS = 350;
const MESES_NO_FILTRO = 6;
const ERRO_GENERICO = 'Não foi possível carregar seus pedidos. Tente novamente.';
const CHAVE_ULTIMA_BUSCA = 'bp:ultima-busca'; // gravada por resultados.js

function lerSessao(chave) {
  try { return sessionStorage.getItem(chave) || ''; } catch (e) { return ''; }
}

// "2026-10" → { de: '2026-10-01', ate: '2026-10-31' }
function intervaloDoMes(periodo) {
  const [ano, mes] = periodo.split('-').map(Number);
  if (!ano || !mes) return { de: '', ate: '' };
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const mm = String(mes).padStart(2, '0');
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}` };
}

// Mês atual e os anteriores: [{ valor: '2026-11', texto: 'Novembro de 2026' }, ...]
function opcoesDePeriodo() {
  const hoje = new Date();
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  return Array.from({ length: MESES_NO_FILTRO }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 15);
    const texto = nomeMes.format(d);
    return { valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, texto: texto.charAt(0).toUpperCase() + texto.slice(1) };
  });
}

function paginaMeusPedidos() {
  const params = new URLSearchParams(window.location.search);
  return {
    OPCOES_STATUS: OPCOES_STATUS_PEDIDO,
    OPCOES_PERIODO: opcoesDePeriodo(),

    filtros: {
      q: params.get('q') || '',
      status: OPCOES_STATUS_PEDIDO.some((o) => o.valor === params.get('status')) ? params.get('status') : '',
      periodo: /^\d{4}-\d{2}$/.test(params.get('periodo') || '') ? params.get('periodo') : '',
    },
    carregando: true,
    carregandoMais: false,
    erro: '',
    erroMais: '',
    pedidos: [], // uma linha por pedido (compras "achatadas")
    pagina: 0,
    totalPaginas: 1,
    resumo: null,
    _esperaBusca: null,
    _pedidoAtual: 0, // descarta respostas antigas quando o filtro muda rápido

    // ---------- Início ----------

    init() {
      // Um período do endereço que não está na lista (ex.: link antigo) entra como opção, para não sumir
      if (this.filtros.periodo && !this.OPCOES_PERIODO.some((o) => o.valor === this.filtros.periodo)) {
        const [ano, mes] = this.filtros.periodo.split('-');
        this.OPCOES_PERIODO.push({ valor: this.filtros.periodo, texto: `${mes}/${ano}` });
      }
      this.carregar();
    },

    async carregar() {
      const numero = ++this._pedidoAtual;
      this.carregando = true;
      this.erro = '';
      this.erroMais = '';
      this.atualizarEndereco();
      try {
        const resposta = await listarCompras(this.parametros(0));
        if (numero !== this._pedidoAtual) return;
        this.pedidos = this.achatar(resposta.itens);
        this.pagina = resposta.pagina ?? 0;
        this.totalPaginas = resposta.totalPaginas ?? 1;
        if (resposta.resumo) this.resumo = resposta.resumo;
      } catch (erro) {
        if (numero !== this._pedidoAtual) return;
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        this.erro = erro?.mensagem || ERRO_GENERICO;
      } finally {
        if (numero === this._pedidoAtual) this.carregando = false;
      }
    },

    async carregarMais() {
      if (this.carregandoMais || !this.temMais) return;
      this.carregandoMais = true;
      this.erroMais = '';
      const numero = this._pedidoAtual;
      const primeiroNovo = this.pedidos.length;
      try {
        const resposta = await listarCompras(this.parametros(this.pagina + 1));
        if (numero !== this._pedidoAtual) return;
        this.pedidos = this.pedidos.concat(this.achatar(resposta.itens));
        this.pagina = resposta.pagina ?? this.pagina + 1;
        this.totalPaginas = resposta.totalPaginas ?? this.totalPaginas;
        // Teclado: o foco vai para o primeiro pedido que chegou
        this.$nextTick(() => document.querySelectorAll('.meus-pedidos-tabela [data-link-pedido]')[primeiroNovo]?.focus());
      } catch (erro) {
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        this.erroMais = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.carregandoMais = false;
      }
    },

    parametros(pagina) {
      return {
        q: this.filtros.q.trim(),
        status: this.filtros.status,
        ...intervaloDoMes(this.filtros.periodo),
        pagina,
        tamanho: COMPRAS_POR_PAGINA,
      };
    },

    // Compra { criadaEm, pedidos[] } → uma linha por pedido, com a data da compra
    achatar(compras = []) {
      return compras.flatMap((c) => (c.pedidos || []).map((p) => ({ ...p, idCompra: c.idCompra, criadaEm: p.criadoEm || c.criadaEm })));
    },

    // ---------- Filtros ----------

    aoDigitarBusca() {
      clearTimeout(this._esperaBusca);
      this._esperaBusca = setTimeout(() => this.carregar(), ESPERA_BUSCA_MS);
    },
    buscarAgora() {
      clearTimeout(this._esperaBusca);
      this.carregar();
    },
    limparFiltros() {
      this.filtros = { q: '', status: '', periodo: '' };
      this.carregar();
      this.$nextTick(() => this.$refs.busca?.focus());
    },
    get temFiltro() {
      return Boolean(this.filtros.q.trim() || this.filtros.status || this.filtros.periodo);
    },
    atualizarEndereco() {
      const url = new URL(window.location.href);
      ['q', 'status', 'periodo'].forEach((chave) => {
        const valor = String(this.filtros[chave] || '').trim();
        if (valor) url.searchParams.set(chave, valor);
        else url.searchParams.delete(chave);
      });
      window.history.replaceState(null, '', url);
    },

    // ---------- Textos ----------

    get temMais() {
      return this.pagina + 1 < this.totalPaginas;
    },
    get vazio() {
      return !this.carregando && !this.erro && this.pedidos.length === 0;
    },
    get chipsResumo() {
      if (!this.resumo) return [];
      const r = this.resumo;
      return [
        { classe: 'meus-pedidos-chip--alerta', texto: `${r.atencao} aguardando sua atenção`, mostrar: r.atencao > 0 },
        { classe: 'meus-pedidos-chip--info', texto: `${r.andamento} em andamento`, mostrar: r.andamento > 0 },
        { classe: 'meus-pedidos-chip--sucesso', texto: `${r.retirada} ${r.retirada > 1 ? 'disponíveis' : 'disponível'} para retirada`, mostrar: r.retirada > 0 },
      ].filter((c) => c.mostrar);
    },
    get textoQuantidade() {
      const n = this.pedidos.length;
      if (this.carregando) return 'Carregando pedidos…';
      return n === 1 ? '1 pedido na lista.' : `${n} pedidos na lista.`;
    },
    lojaItens(p) {
      const itens = p.resumoItens
        || (p.itens?.length === 1 ? `${p.itens[0].quantidade} × ${p.itens[0].titulo}` : `${(p.itens || []).reduce((s, i) => s + i.quantidade, 0)} itens`);
      return `${p.nomeLoja} • ${itens}`;
    },
    data(p) {
      return formatarData(p.criadaEm);
    },
    moeda(valor) {
      return formatarMoeda(valor);
    },
    codigoRetirada(p) {
      return p.modalidade === 'RETIRADA' && p.codigoRetirada ? p.codigoRetirada : 'Não se aplica';
    },
    rotuloStatus(status) {
      return rotuloStatusPedido(status);
    },
    classeLinkStatus(status) {
      return `meus-pedidos-status meus-pedidos-status--${String(status || '').toLowerCase().replace(/_/g, '-')}`;
    },

    // ---------- Links ----------

    linkPedido(p) {
      return linkPara('detalhePedido', { id: p.idPedido });
    },
    get linkBuscar() {
      const busca = lerSessao(CHAVE_ULTIMA_BUSCA);
      return `${linkPara('resultados')}${busca ? `?${busca}` : ''}`;
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('meusPedidos', paginaMeusPedidos);
});