// Tela: busca/comparar.html — Comparar opções (Fluxo A • Encontrar e comprar, etapa 04)
// Acesso: público. Caso de uso: BP1-10 (comparar preço e distância entre lojas).
// Rotas: GET /api/pecas/{id} (uma por anúncio escolhido), POST /api/carrinho/itens
//
// Como funciona:
//   - Os anúncios vêm do endereço: comparar.html?ids=201,209 (montado pela barra "Comparar opções"
//     dos resultados). No máximo 3, o mesmo limite dos resultados.
//   - A distância usa a localização do cabeçalho (CEP ou GPS). Sem ela, a coluna mostra só a cidade.
//   - O frete não entra na conta: pagamento, frete e prazo são combinados com cada loja (ADR-008, ADR-012).
//   - "Voltar aos resultados" usa os últimos filtros guardados pela tela de resultados (sessionStorage).
//   - Nenhuma regra de negócio aqui: os destaques ("Menor preço", "Mais próxima") só comparam o que a API mandou.
import { obterPeca } from '../../services/pecas.js';
import { adicionarAoCarrinho } from '../../services/carrinho.js';
import { rotuloCondicao, linhaCodigo, IMAGEM_PADRAO, definirCarregando } from '../../components/card-peca.js';
import { mostrarAviso } from '../../components/aviso.js';
import { formatarMoeda, formatarDecimal, pluralizarDiasUteis } from '../../utils/formatacao.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const MAXIMO_COMPARAR = 3; // o mesmo de resultados.js
const MINIMO_COMPARAR = 2;
const CHAVE_LOCALIZACAO = 'bp:localizacao'; // a mesma do cabecalho.js
const CHAVE_ULTIMA_BUSCA = 'bp:ultima-busca'; // gravada por resultados.js
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';

const FORMAS_PAGAMENTO = {
  PIX: 'Pix',
  DINHEIRO: 'dinheiro',
  CARTAO_CREDITO: 'cartão de crédito',
  CARTAO_DEBITO: 'cartão de débito',
  BOLETO: 'boleto',
  FATURADO: 'faturado para CNPJ',
};

// BP1-10, passo 5: reordenar por menor preço da peça ou menor distância
export const ORDENACOES = [
  { valor: 'preco', texto: 'Menor preço da peça' },
  { valor: 'distancia', texto: 'Menor distância', precisaLocal: true },
  { valor: 'selecao', texto: 'Ordem em que você escolheu' },
];

function lerJson(chave) {
  try { return JSON.parse(sessionStorage.getItem(chave)); } catch (e) { return null; }
}

function lerUltimaBusca() {
  try { return sessionStorage.getItem(CHAVE_ULTIMA_BUSCA) || ''; } catch (e) { return ''; }
}

const precoFinal = (p) => Number(p.precoPromocional ?? p.preco);
const primeiraLetraMaiuscula = (texto) => (texto ? texto[0].toUpperCase() + texto.slice(1) : texto);

function paginaComparar() {
  return {
    ORDENACOES,
    ids: [],
    pecas: [],
    indisponiveis: 0,
    carregando: true,
    erro: '',
    ordenar: 'preco', // BP1-10, passo 4: começa pela oferta de menor valor
    local: null,
    ultimaBusca: '',

    // ---------- Início ----------

    init() {
      const params = new URLSearchParams(window.location.search);
      this.ids = [...new Set((params.get('ids') || '').split(',').map(Number).filter((id) => id > 0))]
        .slice(0, MAXIMO_COMPARAR);
      this.local = lerJson(CHAVE_LOCALIZACAO);
      this.ultimaBusca = lerUltimaBusca();

      document.addEventListener('localizacao:alterada', (e) => {
        this.local = e.detail;
        this.carregar();
      });

      this.carregar();
    },

    async carregar() {
      this.erro = '';
      this.indisponiveis = 0;
      if (this.ids.length < MINIMO_COMPARAR) {
        this.carregando = false;
        return;
      }
      this.carregando = true;
      const local = this.local || {};

      // Uma requisição por anúncio, todas ao mesmo tempo
      const respostas = await Promise.allSettled(this.ids.map((id) => obterPeca(id, local)));
      const erroGrave = respostas.find((r) => r.status === 'rejected' && r.reason?.status !== 404);
      this.indisponiveis = respostas.filter((r) => r.status === 'rejected' && r.reason?.status === 404).length;

      if (erroGrave) {
        this.erro = erroGrave.reason?.mensagem || ERRO_GENERICO;
        this.pecas = [];
      } else {
        this.pecas = respostas.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      }
      if (this.ordenar === 'distancia' && !this.local) this.ordenar = 'preco';
      this.carregando = false;
    },

    // ---------- Textos da página ----------

    get suficiente() {
      return this.pecas.length >= MINIMO_COMPARAR;
    },

    get colunas() {
      const lista = [...this.pecas];
      if (this.ordenar === 'preco') lista.sort((a, b) => precoFinal(a) - precoFinal(b));
      if (this.ordenar === 'distancia') lista.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
      if (this.ordenar === 'selecao') lista.sort((a, b) => this.ids.indexOf(a.idPeca) - this.ids.indexOf(b.idPeca));
      return lista;
    },

    // "Farol direito Chevrolet Onix 2020–2023 • OEM 52159336 • 2 anúncios selecionados"
    get resumo() {
      const primeira = this.colunas[0]; // o anúncio da primeira coluna, como no protótipo
      if (!primeira) return '';
      const oems = new Set(this.pecas.map((p) => p.codigoOem).filter(Boolean));
      const codigo = oems.size === 1 && this.pecas.every((p) => p.codigoOem) ? `OEM ${primeira.codigoOem}` : '';
      return [primeira.titulo, codigo, `${this.pecas.length} anúncios selecionados`].filter(Boolean).join(' • ');
    },

    get termoDaBusca() {
      return new URLSearchParams(this.ultimaBusca).get('q') || '';
    },

    get linkResultados() {
      return `${linkPara('resultados')}${this.ultimaBusca ? `?${this.ultimaBusca}` : ''}`;
    },

    // ---------- Linhas da tabela ----------

    textoPreco(p) {
      const promocao = p.precoPromocional != null && Number(p.precoPromocional) < Number(p.preco);
      return promocao ? `${formatarMoeda(p.precoPromocional)} (de ${formatarMoeda(p.preco)})` : formatarMoeda(p.preco);
    },
    textoCondicao(p) {
      return rotuloCondicao(p).replace(' • ', ' / ') || '—';
    },
    textoEstoque(p) {
      const qtd = Number(p.quantidadeEstoque) || 0;
      const unidades = `${qtd} ${qtd === 1 ? 'unidade' : 'unidades'}`;
      return p.prontaEntrega ? `${unidades} • pronta entrega` : unidades;
    },
    textoExpedicao(p) {
      return p.prontaEntrega ? 'Pronta entrega' : pluralizarDiasUteis(p.prazoExpedicaoDias || 1);
    },
    textoCidade(p) {
      return p.loja?.cidade && p.loja?.estado ? `${p.loja.cidade}/${p.loja.estado}` : '';
    },
    textoDistancia(p) {
      const cidade = this.textoCidade(p);
      return p.distanciaKm != null ? `${formatarDecimal(p.distanciaKm)} km • ${cidade}` : cidade || '—';
    },
    textoRecebimento(p) {
      const l = p.loja || {};
      const formas = [
        l.retiradaBalcao ? 'Retirada no balcão' : '',
        l.motoboyProprio ? 'motoboy a combinar' : l.entregaCombinar ? 'entrega a combinar' : '',
      ].filter(Boolean);
      return primeiraLetraMaiuscula(formas.join(' • ')) || 'Combine com a loja';
    },
    textoPagamento(p) {
      const formas = (p.loja?.formasPagamento || []).map((f) => FORMAS_PAGAMENTO[f] || f);
      return primeiraLetraMaiuscula(formas.join(' • ')) || 'Combine com a loja';
    },
    textoAvaliacao(p) {
      const l = p.loja || {};
      if (!l.avaliacaoMedia) return 'Sem avaliações ainda';
      const total = l.totalAvaliacoes ? ` • ${l.totalAvaliacoes} ${l.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'}` : '';
      return `★ ${formatarDecimal(l.avaliacaoMedia)}${total}`;
    },
    resumoLoja(p) {
      return [formatarMoeda(precoFinal(p)), p.distanciaKm != null ? `${formatarDecimal(p.distanciaKm)} km` : this.textoCidade(p)]
        .filter(Boolean).join(' • ');
    },

    // Destaques: só compara os dados recebidos (ex.: "Menor preço e mais próxima", "Motoboy disponível")
    destaques(p) {
      const lista = this.pecas;
      const menorPreco = Math.min(...lista.map(precoFinal));
      const comDistancia = lista.filter((x) => x.distanciaKm != null);
      const menorDistancia = comDistancia.length ? Math.min(...comDistancia.map((x) => x.distanciaKm)) : null;
      const melhorNota = Math.max(...lista.map((x) => x.loja?.avaliacaoMedia || 0));
      const unico = (valor, campo) => lista.filter((x) => campo(x) === valor).length === 1;

      const principais = [];
      if (precoFinal(p) === menorPreco && unico(menorPreco, precoFinal)) principais.push('menor preço');
      if (menorDistancia != null && p.distanciaKm === menorDistancia && unico(menorDistancia, (x) => x.distanciaKm)) principais.push('mais próxima');
      if (!principais.length && (p.loja?.avaliacaoMedia || 0) === melhorNota && unico(melhorNota, (x) => x.loja?.avaliacaoMedia || 0)) {
        principais.push('melhor avaliação');
      }

      const etiquetas = [];
      if (principais.length) etiquetas.push({ texto: primeiraLetraMaiuscula(principais.join(' e ')), tipo: 'verde' });
      if (p.loja?.motoboyProprio) etiquetas.push({ texto: 'Motoboy disponível', tipo: 'azul' });
      if (p.prontaEntrega && !principais.length) etiquetas.push({ texto: 'Pronta entrega', tipo: 'azul' });
      return etiquetas;
    },

    foto(p) {
      return p.fotos?.[0]?.url || p.fotoUrl || IMAGEM_PADRAO;
    },
    codigo(p) {
      return linhaCodigo(p);
    },

    // ---------- Links ----------

    linkDetalhe(p) {
      return linkPara('detalhePeca', { id: p.idPeca });
    },
    linkLoja(p) {
      return linkPara('lojaPublica', { id: p.loja?.idLoja });
    },

    // BP1-28: conversa com a loja sobre esta peça (precisa estar logado)
    async conversar(p) {
      const destino = linkPara('conversas', { loja: p.loja?.idLoja, peca: p.idPeca });
      const usuario = window.Cabecalho ? await window.Cabecalho.pronto : null;
      window.location.href = usuario ? destino : linkLogin(destino);
    },

    abrirLocalizacao() {
      // O painel do cabeçalho pede o CEP ou a localização do aparelho, com o aviso da LGPD (ADR-013)
      const botao = document.querySelector('#cabecalho [data-abre="painel-localizacao"]');
      if (!botao) return;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (botao.getAttribute('aria-expanded') !== 'true') botao.click();
      else document.getElementById('cabecalho-cep')?.focus();
    },

    // ---------- Ações ----------

    // BP1-10, passo 7: escolhe a oferta e adiciona ao carrinho
    async adicionar(evento, p) {
      const botao = evento.currentTarget;
      const usuario = window.Cabecalho ? await window.Cabecalho.pronto : null;
      // Visitante vai para o login e volta para esta comparação (Documentação do Front-end, "Navegação")
      if (!usuario) {
        window.location.href = linkLogin(window.location.href);
        return;
      }
      botao.dataset.acao = 'carrinho';
      definirCarregando(botao, true);
      try {
        const resposta = await adicionarAoCarrinho(p.idPeca, 1);
        if (typeof resposta?.quantidadeTotal === 'number') {
          document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: resposta.quantidadeTotal } }));
        }
        mostrarAviso({
          tipo: 'sucesso',
          texto: `Adicionado ao carrinho: ${p.titulo} (${p.loja?.nomeLoja}).`,
          link: { href: linkPara('carrinho'), texto: 'Ver carrinho' },
        });
      } catch (erro) {
        if (erro?.status === 401) {
          window.location.href = linkLogin(window.location.href);
          return;
        }
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      } finally {
        definirCarregando(botao, false);
      }
    },

    // "Remover seleção": volta para os resultados sem nada marcado
    removerSelecao() {
      window.location.href = this.linkResultados;
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('compararOpcoes', paginaComparar);
});