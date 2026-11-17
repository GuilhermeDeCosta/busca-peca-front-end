// Tela: busca/detalhe-peca.html — Detalhe da peça (Fluxo A • Encontrar e comprar, etapa 05)
// Acesso: público. Casos de uso: BP1-4 (ver a peça), BP1-10 (comparar outras ofertas), BP1-22 (carrinho),
//   BP1-28 (conversar com a loja), BP1-48 (favoritos), BP1-52 (avise-me quando chegar), BP1-66 (alternativas)
// Rotas: GET /api/pecas/{id}, GET /api/pecas/{id}/ofertas, GET /api/pecas/{id}/alternativas,
//        POST /api/carrinho/itens, POST e DELETE /api/favoritos, POST /api/pecas/{id}/aviso-disponibilidade
//
// Como funciona:
//   - A peça vem do endereço: detalhe-peca.html?id=201 (links dos cards e da comparação).
//   - A distância usa a localização do cabeçalho; o "CEP para referência" consulta só esta loja.
//   - Frete e pagamento são combinados com a loja (ADR-008, ADR-012): a tela não calcula frete.
//   - Visitante que clica em carrinho, favoritos ou conversa vai para o login e volta para esta peça.
import { obterPeca, listarOfertas, listarAlternativas, pedirAvisoDisponibilidade } from '../../services/pecas.js';
import { adicionarAoCarrinho } from '../../services/carrinho.js';
import { adicionarFavorito, removerFavorito } from '../../services/favoritos.js';
import {
  htmlCardPeca, htmlCardsCarregando, ligarImagensPadrao, definirCarregando, definirFavorito,
  rotuloCondicao, IMAGEM_PADRAO,
} from '../../components/card-peca.js';
import { mostrarAviso } from '../../components/aviso.js';
import { formatarMoeda, formatarDecimal, pluralizarDiasUteis } from '../../utils/formatacao.js';
import { mascararCep, somenteDigitos } from '../../utils/mascaras.js';
import { validarCep } from '../../utils/validacoes.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const MAXIMO_COMPARAR = 3; // o mesmo dos resultados e da comparação
const OUTRAS_OPCOES = 3; // cards em "Outras opções para comparar" (protótipo A04)
const CHAVE_LOCALIZACAO = 'bp:localizacao'; // a mesma do cabecalho.js
const CHAVE_ULTIMA_BUSCA = 'bp:ultima-busca'; // gravada por resultados.js
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';
const ESTOQUE_INSUFICIENTE = 'Quantidade indisponível no estoque no momento'; // BP1-22, fluxo alternativo

const CONDICOES = { NOVA: 'Novo', USADA: 'Usado', RECONDICIONADA: 'Recondicionado' };
const ORIGENS = { NACIONAL: 'Nacional', IMPORTADA: 'Importado' };

function lerJson(chave) {
  try { return JSON.parse(sessionStorage.getItem(chave)); } catch (e) { return null; }
}
function lerUltimaBusca() {
  try { return sessionStorage.getItem(CHAVE_ULTIMA_BUSCA) || ''; } catch (e) { return ''; }
}
const primeiraLetraMaiuscula = (texto) => (texto ? texto[0].toUpperCase() + texto.slice(1) : texto);

async function usuarioLogado() {
  return window.Cabecalho ? window.Cabecalho.pronto : null;
}

function paginaDetalhe() {
  return {
    idPeca: 0,
    peca: null,
    carregando: true,
    naoEncontrada: false,
    erro: '',
    local: null,
    ultimaBusca: '',

    fotoAtual: 0,
    quantidade: 1,
    erroQuantidade: '',
    adicionando: false,
    comprando: false,
    salvandoFavorito: false,
    avisoPedido: false,

    // Entrega e retirada (CEP para referência)
    cep: '',
    erroCep: '',
    consultandoCep: false,
    resultadoCep: null,

    // Outras opções (BP1-10 e BP1-66)
    carregandoOutras: true,
    ofertas: [],
    outras: [],

    // ---------- Início ----------

    init() {
      this.idPeca = Number(new URLSearchParams(window.location.search).get('id')) || 0;
      this.local = lerJson(CHAVE_LOCALIZACAO);
      this.ultimaBusca = lerUltimaBusca();
      if (this.local?.cep) this.cep = mascararCep(this.local.cep);
      ligarImagensPadrao(this.$refs.outras);

      document.addEventListener('localizacao:alterada', (e) => {
        this.local = e.detail;
        this.carregar();
      });
      document.addEventListener('keydown', (e) => {
        // Setas trocam a foto quando o foco está na galeria
        if (!this.$refs.galeria?.contains(document.activeElement)) return;
        if (e.key === 'ArrowRight') this.trocarFoto(this.fotoAtual + 1);
        if (e.key === 'ArrowLeft') this.trocarFoto(this.fotoAtual - 1);
      });

      this.carregar();
    },

    async carregar() {
      if (!this.idPeca) {
        this.carregando = false;
        this.naoEncontrada = true;
        return;
      }
      this.carregando = true;
      this.erro = '';
      try {
        this.peca = await obterPeca(this.idPeca, this.local || {});
        this.naoEncontrada = false;
        this.fotoAtual = 0;
        this.quantidade = Math.min(Math.max(1, this.quantidade), this.estoque || 1);
        document.title = `${this.peca.titulo} • Busca Peças`;
        this.carregarOutras();
      } catch (erro) {
        if (erro?.status === 404) this.naoEncontrada = true;
        else this.erro = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.carregando = false;
      }
    },
 
    // "Outras opções para comparar": primeiro a mesma peça em outras lojas, depois alternativas
    async carregarOutras() {
      this.carregandoOutras = true;
      this.$refs.outras.innerHTML = htmlCardsCarregando(OUTRAS_OPCOES);
      const local = this.local || {};
      const [ofertas, alternativas] = await Promise.allSettled([
        listarOfertas(this.idPeca, local), listarAlternativas(this.idPeca, local),
      ]);
      this.ofertas = ofertas.status === 'fulfilled' ? ofertas.value || [] : [];
      const lista = [...this.ofertas, ...(alternativas.status === 'fulfilled' ? alternativas.value || [] : [])];
      const vistos = new Set();
      this.outras = lista.filter((p) => !vistos.has(p.idPeca) && vistos.add(p.idPeca)).slice(0, OUTRAS_OPCOES);
      this.$refs.outras.innerHTML = this.outras.map((p) => `<div class="col">${htmlCardPeca(p)}</div>`).join('');
      this.carregandoOutras = false;
    },

    // ---------- Textos ----------

    get estoque() {
      return Number(this.peca?.quantidadeEstoque) || 0;
    },
    get semEstoque() {
      return this.estoque === 0;
    },
    get fotos() {
      const fotos = (this.peca?.fotos || []).map((f) => f.url).filter(Boolean);
      return fotos.length ? fotos : [IMAGEM_PADRAO];
    },
    get temFotoReal() {
      return (this.peca?.fotos || []).length > 0;
    },
    get linhaCodigos() {
      const p = this.peca;
      return [p.marcaPeca, p.codigoOem && `OEM ${p.codigoOem}`, p.codigoSku && `SKU ${p.codigoSku}`].filter(Boolean).join(' • ');
    },
    get etiquetas() {
      const p = this.peca;
      return [
        { texto: CONDICOES[p.condicao] || p.condicao, tipo: 'cinza' },
        { texto: ORIGENS[p.origem] || p.origem, tipo: 'cinza' },
        this.semEstoque ? { texto: 'Sem estoque', tipo: 'vermelho' }
          : { texto: p.prontaEntrega ? 'Pronta entrega' : 'Em estoque', tipo: 'verde' },
      ].filter((e) => e.texto);
    },
    get temPromocao() {
      const p = this.peca;
      return p.precoPromocional != null && Number(p.precoPromocional) < Number(p.preco);
    },
    get precoFinal() {
      return formatarMoeda(this.temPromocao ? this.peca.precoPromocional : this.peca.preco);
    },
    get precoAntigo() {
      return formatarMoeda(this.peca.preco);
    },
    get textoEstoque() {
      if (this.semEstoque) return 'Sem estoque no momento';
      return `${this.estoque} ${this.estoque === 1 ? 'unidade disponível' : 'unidades disponíveis'}`;
    },
    get textoExpedicao() {
      if (this.peca.prontaEntrega) return 'Pronta entrega. Combine a retirada ou a entrega com a loja.';
      return `Expedição em ${pluralizarDiasUteis(this.peca.prazoExpedicaoDias || 1)} após combinar com a loja.`;
    },
    get textoAvaliacao() {
      const l = this.peca.loja || {};
      if (!l.avaliacaoMedia) return 'Loja sem avaliações ainda';
      const total = l.totalAvaliacoes ? ` • ${l.totalAvaliacoes} ${l.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'}` : '';
      return `★ ${formatarDecimal(l.avaliacaoMedia)}${total}`;
    },
    get textoLocalLoja() {
      const l = this.peca.loja || {};
      const cidade = l.cidade && l.estado ? `${l.cidade}/${l.estado}` : '';
      const distancia = this.peca.distanciaKm != null ? `${formatarDecimal(this.peca.distanciaKm)} km de você` : '';
      return [cidade, distancia].filter(Boolean).join(' • ');
    },
    get textoRecebimento() {
      const l = this.peca.loja || {};
      const formas = [
        l.retiradaBalcao ? 'retirada na loja' : '',
        l.motoboyProprio ? 'motoboy a combinar' : l.entregaCombinar ? 'entrega a combinar' : '',
      ].filter(Boolean);
      const texto = formas.length ? formas.join(' ou ') : 'combine a entrega com a loja';
      return `${primeiraLetraMaiuscula(texto)}. Frete não incluído no preço da peça.`;
    },
    get categoriaTexto() {
      const c = this.peca.categoria;
      if (!c) return '';
      return c.pai ? `${c.pai.nome} • ${c.nome}` : c.nome;
    },
    // Tabela "Descrição técnica"
    get especificacoes() {
      const p = this.peca;
      const naoInformado = 'Não informado pela loja';
      return [
        { rotulo: 'Marca / categoria', valor: [p.marcaPeca, this.categoriaTexto].filter(Boolean).join(' / ') || naoInformado },
        { rotulo: 'Código OEM', valor: p.codigoOem || naoInformado },
        { rotulo: 'EAN', valor: p.codigoEan || naoInformado },
        { rotulo: 'SKU da loja', valor: p.codigoSku || naoInformado },
        { rotulo: 'Condição / origem', valor: rotuloCondicao(p).replace(' • ', ' / ') || naoInformado },
        { rotulo: 'Características', valor: p.caracteristicas || naoInformado },
      ];
    },
    textoAnos(a) {
      if (!a.anoInicial && !a.anoFinal) return '—';
      if (a.anoInicial === a.anoFinal || !a.anoFinal) return String(a.anoInicial);
      return `${a.anoInicial}–${a.anoFinal}`;
    },

    // ---------- Links ----------

    get linkResultados() {
      return `${linkPara('resultados')}${this.ultimaBusca ? `?${this.ultimaBusca}` : ''}`;
    },
    linkCategoria(idCategoria) {
      return linkPara('resultados', { categoria: idCategoria });
    },
    get linkLoja() {
      return linkPara('lojaPublica', { id: this.peca?.loja?.idLoja });
    },
    // BP1-10: "Comparar outras ofertas" só aparece quando há outra loja com a mesma peça (fluxo alternativo)
    get linkComparar() {
      const ids = [this.idPeca, ...this.ofertas.map((o) => o.idPeca)].slice(0, MAXIMO_COMPARAR);
      return linkPara('comparar', { ids: ids.join(',') });
    },

    // ---------- Galeria ----------

    trocarFoto(indice) {
      const total = this.fotos.length;
      this.fotoAtual = (indice + total) % total;
    },
    textoAltFoto(indice) {
      return this.fotos.length > 1 ? `${this.peca.titulo} • foto ${indice + 1} de ${this.fotos.length}` : this.peca.titulo;
    },
    usarImagemPadrao(evento) {
      if (evento.target.src !== IMAGEM_PADRAO) evento.target.src = IMAGEM_PADRAO;
    },

    // ---------- Quantidade (BP1-22) ----------

    mudarQuantidade(delta) {
      this.quantidade = Number(this.quantidade) + delta;
      this.conferirQuantidade();
    },
    conferirQuantidade() {
      const qtd = Math.floor(Number(this.quantidade));
      this.erroQuantidade = '';
      if (!qtd || qtd < 1) {
        this.quantidade = 1;
      } else if (qtd > this.estoque) {
        this.quantidade = this.estoque;
        this.erroQuantidade = `${ESTOQUE_INSUFICIENTE}. Máximo: ${this.estoque}.`;
      } else {
        this.quantidade = qtd;
      }
    },

    // ---------- Ações ----------

    irParaLogin(destino = window.location.href) {
      window.location.href = linkLogin(destino);
    },

    // BP1-22: adiciona e, em "Comprar", segue direto para o carrinho
    async adicionar(irParaCarrinho = false) {
      if (!(await usuarioLogado())) return this.irParaLogin();
      this.conferirQuantidade();
      if (this.erroQuantidade) return;

      if (irParaCarrinho) this.comprando = true;
      else this.adicionando = true;
      try {
        const resposta = await adicionarAoCarrinho(this.idPeca, this.quantidade);
        if (typeof resposta?.quantidadeTotal === 'number') {
          document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: resposta.quantidadeTotal } }));
        }
        if (irParaCarrinho) {
          window.location.href = linkPara('carrinho');
          return;
        }
        mostrarAviso({
          tipo: 'sucesso',
          texto: `Peça adicionada com sucesso: ${this.quantidade} × ${this.peca.titulo}. Continue comprando ou`,
          link: { href: linkPara('carrinho'), texto: 'Ir para o carrinho' },
        });
      } catch (erro) {
        if (erro?.status === 401) return this.irParaLogin();
        // 409: a API confere o estoque de novo (pode ter mudado desde que a página abriu)
        if (erro?.status === 409) this.erroQuantidade = erro.mensagem || ESTOQUE_INSUFICIENTE;
        else mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      } finally {
        this.adicionando = false;
        this.comprando = false;
      }
    },

    // BP1-48: salvar ou remover dos favoritos
    async alternarFavorito() {
      if (!(await usuarioLogado())) return this.irParaLogin();
      const favoritar = !this.peca.favorito;
      this.salvandoFavorito = true;
      try {
        if (favoritar) await adicionarFavorito(this.idPeca);
        else await removerFavorito(this.idPeca);
        this.peca.favorito = favoritar;
        mostrarAviso(favoritar
          ? { tipo: 'sucesso', texto: 'Peça salva nos favoritos.', link: { href: linkPara('favoritos'), texto: 'Ver favoritos' } }
          : { tipo: 'sucesso', texto: 'Peça removida dos favoritos.' });
      } catch (erro) {
        if (erro?.status === 401) return this.irParaLogin();
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      } finally {
        this.salvandoFavorito = false;
      }
    },
