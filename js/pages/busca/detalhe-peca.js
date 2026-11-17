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
 



}
}