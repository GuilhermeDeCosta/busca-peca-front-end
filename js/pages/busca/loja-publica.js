// Tela: busca/loja-publica.html — Loja pública (Fluxo A • Encontrar e comprar, A05)
// Acesso: público. Casos de uso: BP1-15 (avaliação técnica da loja), BP1-55 (logo e banner),
//   BP1-14 (formas de pagamento), BP1-18 (retirada e frete grátis), BP1-28 (conversar com a loja)
// Rotas: GET /api/lojas/{id}, GET /api/lojas/{id}/avaliacoes, GET /api/busca?loja={id},
//        POST /api/carrinho/itens, POST e DELETE /api/favoritos
//
// Como funciona:
//   - A loja vem do endereço: loja-publica.html?id=11 (links dos cards, da comparação e do detalhe).
//   - A API não manda endereço completo, telefone nem documento da loja (ADR-013): só cidade e UF.
//   - "Peças da loja" usa a mesma busca dos resultados, filtrada pela loja.
//   - Visitante que clica em carrinho, favoritos ou conversa vai para o login e volta para esta loja.
import { obterLojaPublica, listarAvaliacoesLoja } from '../../services/lojas.js';
import { buscarPecas } from '../../services/busca.js';
import { listarCategorias } from '../../services/catalogo.js';
import { adicionarAoCarrinho } from '../../services/carrinho.js';
import { adicionarFavorito, removerFavorito } from '../../services/favoritos.js';
import {
  htmlCardPeca, htmlCardsCarregando, ligarImagensPadrao, definirCarregando, definirFavorito,
} from '../../components/card-peca.js';
import { numerosDePagina } from '../../components/paginacao.js';
import { mostrarAviso } from '../../components/aviso.js';
import { formatarMoeda, formatarDecimal } from '../../utils/formatacao.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const PECAS_POR_PAGINA = 6; // protótipo A05: 2 linhas de 3 cards
const AVALIACOES_POR_VEZ = 3;
const MINIMO_CARACTERES = 3; // o mesmo da busca (BP1-4)
const ESPERA_DIGITACAO_MS = 400;
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';

const FORMAS_PAGAMENTO = {
  PIX: 'Pix',
  DINHEIRO: 'dinheiro no balcão',
  CARTAO_CREDITO: 'cartão de crédito',
  CARTAO_DEBITO: 'cartão de débito',
  BOLETO: 'boleto',
  FATURADO: 'faturado para CNPJ',
};
export const ORDENACOES = [
  { valor: 'recentes', texto: 'Mais recentes' },
  { valor: 'preco', texto: 'Menor preço' },
  { valor: 'preco_desc', texto: 'Maior preço' },
];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const primeiraLetraMaiuscula = (texto) => (texto ? texto[0].toUpperCase() + texto.slice(1) : texto);
const pecasNaTela = new Map();
let temporizadorBusca = null;

async function usuarioLogado() {
  return window.Cabecalho ? window.Cabecalho.pronto : null;
}

function paginaLoja() {
  return {
    ORDENACOES,
    idLoja: 0,
    loja: null,
    carregando: true,
    naoEncontrada: false,
    erro: '',

    // Avaliações (BP1-15)
    avaliacoes: [],
    totalAvaliacoes: 0,
    paginaAvaliacoes: 0,
    totalPaginasAvaliacoes: 1,
    carregandoAvaliacoes: false,

    // Peças da loja
    categorias: [],
    q: '',
    categoria: '',
    ordenar: 'recentes',
    pagina: 1,
    totalPecas: 0,
    totalPaginas: 1,
    carregandoPecas: true,
    erroPecas: '',
    termoCurto: false,
    requisicao: 0,

    // ---------- Início ----------

    init() {
      this.idLoja = Number(new URLSearchParams(window.location.search).get('id')) || 0;
      ligarImagensPadrao(this.$refs.lista);
      this.carregar();
    },

    async carregar() {
      if (!this.idLoja) {
        this.naoEncontrada = true;
        this.carregando = false;
        return;
      }
      this.carregando = true;
      this.erro = '';
      try {
        this.loja = await obterLojaPublica(this.idLoja);
        document.title = `${this.loja.nomeLoja} • Busca Peças`;
        this.naoEncontrada = false;
      } catch (erro) {
        if (erro?.status === 404) this.naoEncontrada = true;
        else this.erro = erro?.mensagem || ERRO_GENERICO;
        return;
      } finally {
        this.carregando = false;
      }
      // Depois que a loja aparece: avaliações, categorias e peças
      this.$nextTick(() => {
        this.carregarAvaliacoes(true);
        this.carregarPecas();
        listarCategorias()
          .then((c) => { this.categorias = Array.isArray(c) ? c : c?.itens || []; })
          .catch(() => { this.categorias = []; });
      });
    },

    // ---------- Textos da loja ----------

    get inicial() {
      return (this.loja?.nomeLoja || '?').trim()[0].toUpperCase();
    },
    // Frase do banner: a primeira frase da descrição (a API não tem um campo de chamada)
    get chamada() {
      const descricao = (this.loja?.descricao || '').trim();
      return descricao ? descricao.split(/(?<=\.)\s/)[0].replace(/\.$/, '') : this.loja?.nomeLoja;
    },
    get textoAvaliacaoTopo() {
      if (!this.loja?.avaliacaoMedia) return 'Loja sem avaliações ainda';
      const total = this.totalAvaliacoes
        ? ` • ${this.totalAvaliacoes} ${this.totalAvaliacoes === 1 ? 'avaliação técnica' : 'avaliações técnicas'}` : '';
      return `★ ${formatarDecimal(this.loja.avaliacaoMedia)}${total}`;
    },
    get textoLocal() {
      const l = this.loja;
      const cidade = l.cidade && l.estado ? `${l.cidade}/${l.estado}` : '';
      let desde = '';
      if (l.ativaDesde) {
        const [ano, mes] = l.ativaDesde.split('-').map(Number);
        desde = `loja ativa desde ${MESES[mes - 1]} de ${ano}`;
      }
      return [cidade, desde].filter(Boolean).join(' • ');
    },
    get etiquetas() {
      const l = this.loja;
      return [
        { texto: 'Loja ativa', tipo: 'verde' },
        l.vendedorVerificado && { texto: 'Vendedor verificado', tipo: 'verde' },
        l.retiradaBalcao && { texto: 'Retirada no balcão', tipo: 'azul' },
        l.motoboyProprio && { texto: 'Motoboy disponível', tipo: 'azul' },
        l.entregaCombinar && { texto: 'Entrega a combinar', tipo: 'azul' },
      ].filter(Boolean);
    },
    // "Sobre a loja": só mostra as linhas que a loja preencheu
    get informacoes() {
      const l = this.loja;
      const recebimento = [l.retiradaBalcao && 'retirada no balcão', l.motoboyProprio && 'motoboy',
        l.entregaCombinar && 'entrega a combinar'].filter(Boolean).join(' • ');
      const formas = (l.metodosPagamento || []).map((m) => FORMAS_PAGAMENTO[m] || m).join(' • ');
      let freteGratis = '';
      if (l.freteGratisRaioKm) {
        freteGratis = `Até ${formatarDecimal(l.freteGratisRaioKm).replace(',0', '')} km`;
        if (l.pedidoMinimoFreteGratis) freteGratis += ` em pedidos acima de ${formatarMoeda(l.pedidoMinimoFreteGratis)}`;
      }
      return [
        { rotulo: 'Localização', valor: l.cidade && l.estado ? `${l.cidade}/${l.estado}` : '' },
        { rotulo: 'Atendimento', valor: l.horarioRetirada },
        { rotulo: 'Recebimento', valor: primeiraLetraMaiuscula(recebimento) },
        { rotulo: 'Frete grátis', valor: freteGratis },
        { rotulo: 'Formas aceitas', valor: primeiraLetraMaiuscula(formas) },
      ].filter((i) => i.valor);
    },

    // ---------- Avaliações (BP1-15) ----------

    async carregarAvaliacoes(primeiraVez = false) {
      this.carregandoAvaliacoes = true;
      try {
        const proxima = primeiraVez ? 1 : this.paginaAvaliacoes + 1;
        const resposta = await listarAvaliacoesLoja(this.idLoja, { pagina: proxima, tamanho: AVALIACOES_POR_VEZ });
        this.avaliacoes = primeiraVez ? resposta.itens : [...this.avaliacoes, ...resposta.itens];
        this.paginaAvaliacoes = resposta.pagina;
        this.totalPaginasAvaliacoes = resposta.totalPaginas;
        this.totalAvaliacoes = resposta.totalRegistros;
      } catch (erro) {
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || 'Não foi possível carregar as avaliações.' });
      } finally {
        this.carregandoAvaliacoes = false;
      }
    },
    get temMaisAvaliacoes() {
      return this.paginaAvaliacoes < this.totalPaginasAvaliacoes;
    },
    estrelas(nota) {
      return '★★★★★☆☆☆☆☆'.slice(5 - nota, 10 - nota);
    },
    dataAvaliacao(iso) {
      return iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
    },

    // ---------- Peças da loja ----------

    aoDigitar() {
      clearTimeout(temporizadorBusca);
      temporizadorBusca = setTimeout(() => this.aplicarFiltros(), ESPERA_DIGITACAO_MS);
    },
    aplicarFiltros() {
      clearTimeout(temporizadorBusca);
      this.pagina = 1;
      this.carregarPecas();
    },

    async carregarPecas() {
      const q = this.q.trim();
      this.termoCurto = q.length > 0 && q.length < MINIMO_CARACTERES;
      if (this.termoCurto) return;

      const minha = ++this.requisicao;
      this.carregandoPecas = true;
      this.erroPecas = '';
      this.$refs.lista.setAttribute('aria-busy', 'true');
      this.$refs.lista.innerHTML = htmlCardsCarregando(3);
      try {
        const resposta = await buscarPecas({
          loja: this.idLoja, q, categoria: this.categoria, ordenar: this.ordenar,
          pagina: this.pagina, tamanho: PECAS_POR_PAGINA,
        });
        if (minha !== this.requisicao) return;
        this.totalPecas = resposta.totalRegistros || 0;
        this.totalPaginas = resposta.totalPaginas || 1;
        (resposta.itens || []).forEach((p) => pecasNaTela.set(Number(p.idPeca), p));
        this.$refs.lista.innerHTML = (resposta.itens || []).map((p) => `<div class="col">${htmlCardPeca(p)}</div>`).join('');
      } catch (erro) {
        if (minha !== this.requisicao) return;
        this.totalPecas = 0;
        this.erroPecas = erro?.mensagem || ERRO_GENERICO;
        this.$refs.lista.innerHTML = '';
      } finally {
        if (minha === this.requisicao) {
          this.carregandoPecas = false;
          this.$refs.lista.removeAttribute('aria-busy');
        }
      }
    },

    get filtrando() {
      return Boolean(this.q.trim() || this.categoria);
    },
    get semPecas() {
      return !this.carregandoPecas && !this.erroPecas && !this.termoCurto && this.totalPecas === 0;
    },
    limparFiltros() {
      this.q = '';
      this.categoria = '';
      this.aplicarFiltros();
    },
    get paginas() {
      return numerosDePagina(this.pagina, this.totalPaginas);
    },
    irParaPagina(numero) {
      if (numero < 1 || numero > this.totalPaginas || numero === this.pagina) return;
      this.pagina = numero;
      this.carregarPecas();
      this.$refs.topoPecas.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.$refs.topoPecas.focus({ preventScroll: true });
    },

    // ---------- Ações ----------

    irParaLogin(destino = window.location.href) {
      window.location.href = linkLogin(destino);
    },

    // BP1-28: conversa com a loja (sem peça específica)
    async conversar() {
      const destino = linkPara('conversas', { loja: this.idLoja });
      if (!(await usuarioLogado())) return this.irParaLogin(destino);
      window.location.href = destino;
    },

    async aoClicarLista(evento) {
      const botao = evento.target.closest('button[data-acao]');
      if (!botao || botao.disabled) return;
      const id = Number(botao.closest('[data-id-peca]')?.dataset.idPeca);
      const peca = pecasNaTela.get(id);
      if (!(await usuarioLogado())) return this.irParaLogin(linkPara('detalhePeca', { id }));

      definirCarregando(botao, true);
      try {
        if (botao.dataset.acao === 'carrinho') {
          const resposta = await adicionarAoCarrinho(id, 1);
          if (typeof resposta?.quantidadeTotal === 'number') {
            document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: resposta.quantidadeTotal } }));
          }
          mostrarAviso({ tipo: 'sucesso', texto: `Adicionado ao carrinho: ${peca?.titulo || 'peça'}.`, link: { href: linkPara('carrinho'), texto: 'Ver carrinho' } });
        }
        if (botao.dataset.acao === 'favorito') {
          const favoritar = botao.getAttribute('aria-pressed') !== 'true';
          if (favoritar) await adicionarFavorito(id);
          else await removerFavorito(id);
          definirFavorito(botao, favoritar, peca?.titulo || 'peça');
          mostrarAviso(favoritar
            ? { tipo: 'sucesso', texto: 'Peça salva nos favoritos.', link: { href: linkPara('favoritos'), texto: 'Ver favoritos' } }
            : { tipo: 'sucesso', texto: 'Peça removida dos favoritos.' });
        }
      } catch (erro) {
        if (erro?.status === 401) return this.irParaLogin(linkPara('detalhePeca', { id }));
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      } finally {
        definirCarregando(botao, false);
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('lojaPublica', paginaLoja);
});
