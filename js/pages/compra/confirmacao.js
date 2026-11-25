// Tela: compra/confirmacao.html?compra={id} — Pedidos enviados para as lojas (Fluxo A • Encontrar e comprar, A09 / etapa 08)
// Acesso: logado. Casos de uso: BP1-24 (fim da finalização), BP1-20 (histórico), BP1-28 (conversa com a loja)
// Rotas: GET /api/compras/{id}, POST /api/conversas
//
// Como funciona:
//   - O checkout (A08) cria a compra e manda para cá com ?compra=ID. A página busca a compra e mostra
//     um cartão por pedido (um pedido por loja, ADR-009), todos em "Aguardando aceite".
//   - Nenhum valor foi cobrado: o pagamento é combinado direto com cada loja (ADR-008).
//   - "Conversar com a loja" abre (ou reaproveita) a conversa do pedido e vai para conta/conversas.html?id=.
//   - Sem login, a API responde 401 e a página leva para o login, voltando para cá.
import { obterCompra } from '../../services/pedidos.js';
import { abrirConversaDoPedido } from '../../services/conversas.js';
import { mostrarAviso } from '../../components/aviso.js';
import { formatarMoeda, formatarData } from '../../utils/formatacao.js';
import { rotuloStatusPedido, classeStatusPedido, textoModalidade } from '../../utils/status-pedido.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const CHAVE_ULTIMA_BUSCA = 'bp:ultima-busca'; // gravada por resultados.js
const ERRO_GENERICO = 'Não foi possível carregar seus pedidos. Tente novamente.';

function lerSessao(chave) {
  try { return sessionStorage.getItem(chave) || ''; } catch (e) { return ''; }
}

function paginaConfirmacao() {
  return {
    carregando: true,
    erro: '',
    naoEncontrada: false,
    compra: { pedidos: [], total: 0, criadaEm: '' },
    abrindoConversa: {}, // { [idPedido]: true } enquanto abre a conversa

    // ---------- Início ----------

    async init() {
      const idCompra = new URLSearchParams(window.location.search).get('compra');
      this.erro = '';
      this.naoEncontrada = false;
      if (!idCompra) {
        this.naoEncontrada = true;
        this.carregando = false;
        return;
      }
      this.carregando = true;
      try {
        this.compra = await obterCompra(idCompra);
        // Leitor de tela: a página nova começa pelo título, que já diz que deu certo
        this.$nextTick(() => this.$refs.titulo?.focus());
      } catch (erro) {
        if (erro?.status === 401) {
          window.location.href = linkLogin(window.location.href);
          return;
        }
        // 404: compra inexistente ou de outro usuário (a API não diz qual, de propósito)
        if (erro?.status === 404 || erro?.status === 403) this.naoEncontrada = true;
        else this.erro = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.carregando = false;
      }
    },

    // ---------- Textos ----------

    get quantidadePedidos() {
      return this.compra.pedidos.length;
    },
    get tituloResumo() {
      const data = formatarData(this.compra.criadaEm);
      const n = this.quantidadePedidos;
      return `${n} ${n === 1 ? 'pedido criado' : 'pedidos criados'}${data ? ` em ${data}` : ''}`;
    },
    get textoResumo() {
      return this.quantidadePedidos > 1
        ? 'Seu carrinho multiloja foi separado corretamente. Você pode acompanhar cada pedido em Meus pedidos.'
        : 'Seu pedido foi enviado para a loja. Você pode acompanhá-lo em Meus pedidos.';
    },
    get textoTotal() {
      return `Total dos itens: ${formatarMoeda(this.compra.total)} • nenhum pagamento realizado na plataforma.`;
    },
    moeda(valor) {
      return formatarMoeda(valor);
    },
    linhaItem(item) {
      return `${item.quantidade} × ${item.titulo}`;
    },
    rotuloStatus(status) {
      return rotuloStatusPedido(status);
    },
    classeStatus(status) {
      return classeStatusPedido(status);
    },
    modalidade(pedido) {
      return textoModalidade(pedido.modalidade);
    },
    codigoRetirada(pedido) {
      return pedido.modalidade === 'RETIRADA' && pedido.codigoRetirada ? pedido.codigoRetirada : 'Não se aplica';
    },

    // ---------- Links ----------

    linkPedido(pedido) {
      return linkPara('detalhePedido', { id: pedido.idPedido });
    },
    get linkMeusPedidos() {
      return linkPara('minhasCompras');
    },
    get linkBuscar() {
      const busca = lerSessao(CHAVE_ULTIMA_BUSCA);
      return `${linkPara('resultados')}${busca ? `?${busca}` : ''}`;
    },

    // ---------- Conversar com a loja (BP1-28) ----------

    async conversar(pedido) {
      if (this.abrindoConversa[pedido.idPedido]) return;
      this.abrindoConversa[pedido.idPedido] = true;
      try {
        const { idConversa } = await abrirConversaDoPedido(pedido.idPedido);
        window.location.href = linkPara('conversas', { id: idConversa });
      } catch (erro) {
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || 'Não foi possível abrir a conversa. Tente novamente.' });
        this.abrindoConversa[pedido.idPedido] = false;
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('pedidosEnviados', paginaConfirmacao);
});