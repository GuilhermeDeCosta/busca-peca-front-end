// Tela: compra/carrinho.html — Meu carrinho (Fluxo A • Encontrar e comprar, A07 / etapa 06)
// Acesso: logado. Casos de uso: BP1-22 (carrinho), BP1-23 (cálculo de frete)
// Rotas: GET /api/carrinho, PATCH /api/carrinho/itens/{id}, DELETE /api/carrinho/itens/{id},
//        POST /api/carrinho/frete
//
// Como funciona (Documentação do Front-end, "Uso do Alpine.js" → Carrinho):
//   - Alterar a quantidade e remover itens recalcula subtotais e total sem recarregar a página.
//     Os valores vêm da API em cada resposta: o front não soma preços (nenhuma regra de negócio aqui).
//   - Os itens ficam agrupados por loja; cada loja vira um pedido separado (ADR-009).
//   - Pagamento e frete são combinados com cada loja (ADR-008). Se o frete não puder ser estimado,
//     a tela mostra "frete a combinar" e deixa seguir (ADR-012).
//   - Sem login, a API responde 401 e a página leva para o login, voltando para cá
//     (mesmo padrão do perfil.js; quando o auth.js existir, trocar por exigirLogin()).
import {
  obterCarrinho, alterarQuantidadeItem, removerItemCarrinho, calcularFrete,
} from '../../services/carrinho.js';
import { IMAGEM_PADRAO } from '../../components/card-peca.js';
import { mostrarAviso } from '../../components/aviso.js';
import { formatarMoeda, pluralizarDiasUteis } from '../../utils/formatacao.js';
import { mascararCep, somenteDigitos } from '../../utils/mascaras.js';
import { validarCep } from '../../utils/validacoes.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const CHAVE_LOCALIZACAO = 'bp:localizacao'; // a mesma do cabecalho.js
const CHAVE_ULTIMA_BUSCA = 'bp:ultima-busca'; // gravada por resultados.js
const CHAVE_CEP_ENTREGA = 'bp:cep-entrega'; // CEP de referência, reaproveitado na revisão (checkout)
const ESPERA_QUANTIDADE_MS = 500; // espera o usuário parar de clicar em +/− antes de chamar a API
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';
const TIPOS_FRETE = { NORMAL: 'Entrega normal', EXPRESSO: 'Entrega expressa' };

function lerSessao(chave) {
  try { return sessionStorage.getItem(chave); } catch (e) { return null; }
}
function gravarSessao(chave, valor) {
  try { sessionStorage.setItem(chave, valor); } catch (e) { /* navegador bloqueou */ }
}

const temporizadores = new Map(); // idItem → setTimeout da quantidade

function paginaCarrinho() {
  return {
    carregando: true,
    erro: '',
    carrinho: { lojas: [], quantidadeTotal: 0, total: 0 },
    atualizando: {}, // idItem → true enquanto a API responde
    erros: {}, // idItem → mensagem (ex.: estoque insuficiente)
    quantidades: {}, // idItem → valor no campo (pode estar diferente da API até ela responder)

    // Entrega ou retirada (BP1-23)
    cep: '',
    erroCep: '',
    consultandoCep: false,
    frete: null,

    // ---------- Início ----------

    init() {
      const cepSalvo = lerSessao(CHAVE_CEP_ENTREGA);
      const local = (() => { try { return JSON.parse(lerSessao(CHAVE_LOCALIZACAO)); } catch (e) { return null; } })();
      this.cep = mascararCep(cepSalvo || local?.cep || '');
      this.carregar();
    },

    async carregar() {
      this.carregando = true;
      this.erro = '';
      try {
        this.aplicarCarrinho(await obterCarrinho());
      } catch (erro) {
        if (!this.tratar401(erro)) this.erro = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.carregando = false;
      }
    },

    // Toda resposta da API traz o carrinho inteiro: a tela só substitui o que mostra
    aplicarCarrinho(carrinho) {
      this.carrinho = carrinho || { lojas: [], quantidadeTotal: 0, total: 0 };
      this.carrinho.lojas.forEach((l) => l.itens.forEach((i) => { this.quantidades[i.idItem] = i.quantidade; }));
      // O cabeçalho escuta este evento e atualiza o contador do carrinho
      document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: this.carrinho.quantidadeTotal } }));
    },

    tratar401(erro) {
      if (erro?.status !== 401) return false;
      window.location.href = linkLogin(window.location.href);
      return true;
    },

    // ---------- Textos ----------

    get vazio() {
      return !this.carregando && !this.erro && this.carrinho.lojas.length === 0;
    },
    get quantidadeLojas() {
      return this.carrinho.lojas.length;
    },
    get resumo() {
      const unidades = `${this.carrinho.quantidadeTotal} ${this.carrinho.quantidadeTotal === 1 ? 'unidade' : 'unidades'}`;
      const lojas = `${this.quantidadeLojas} ${this.quantidadeLojas === 1 ? 'loja' : 'lojas'}`;
      return `${unidades} • ${lojas} • cada loja recebe um pedido separado.`;
    },
    get avisoDivisao() {
      const n = this.quantidadeLojas;
      return n > 1
        ? `O carrinho será dividido em ${n} pedidos independentes. Nenhum valor será cobrado pela plataforma.`
        : 'Seu pedido vai para uma loja. Nenhum valor será cobrado pela plataforma.';
    },
    // "Revisar pedidos" só libera sem itens com estoque insuficiente e sem alteração pendente
    get podeRevisar() {
      const semEstoque = this.carrinho.lojas.some((l) => l.itens.some((i) => i.estoqueSuficiente === false));
      const pendente = Object.values(this.atualizando).some(Boolean);
      return !this.carregando && !this.vazio && !semEstoque && !pendente;
    },
    moeda(valor) {
      return formatarMoeda(valor);
    },
    foto(item) {
      return item.peca.fotoUrl || IMAGEM_PADRAO;
    },
    codigo(item) {
      const p = item.peca;
      const codigo = p.codigoOem ? `OEM ${p.codigoOem}` : p.codigoSku ? `SKU ${p.codigoSku}` : '';
      return [codigo, p.marcaPeca].filter(Boolean).join(' • ');
    },
    etiquetaEstoque(loja) {
      if (loja.itens.some((i) => i.estoqueSuficiente === false)) return { texto: 'Estoque insuficiente', tipo: 'vermelho' };
      if (loja.itens.every((i) => i.peca.prontaEntrega)) return { texto: 'Pronta entrega', tipo: 'verde' };
      return { texto: 'Em estoque', tipo: 'verde' };
    },
    linkDetalhe(item) {
      return linkPara('detalhePeca', { id: item.peca.idPeca });
    },
    get linkContinuar() {
      const busca = lerSessao(CHAVE_ULTIMA_BUSCA);
      return `${linkPara('resultados')}${busca ? `?${busca}` : ''}`;
    },
    get linkRevisar() {
      return linkPara('checkout');
    },

    // ---------- Quantidade (BP1-22) ----------

    mudarQuantidade(item, delta) {
      const nova = Math.max(1, Number(this.quantidades[item.idItem] || 1) + delta);
      this.quantidades[item.idItem] = nova;
      this.agendarQuantidade(item);
    },
    aoDigitarQuantidade(item) {
      const valor = Math.floor(Number(this.quantidades[item.idItem]));
      this.quantidades[item.idItem] = valor >= 1 ? valor : 1;
      this.agendarQuantidade(item, 0);
    },
    // Espera um pouco para juntar vários cliques em +/− numa chamada só
    agendarQuantidade(item, espera = ESPERA_QUANTIDADE_MS) {
      this.erros[item.idItem] = '';
      this.atualizando[item.idItem] = true;
      clearTimeout(temporizadores.get(item.idItem));
      temporizadores.set(item.idItem, setTimeout(() => this.enviarQuantidade(item), espera));
    },
    async enviarQuantidade(item) {
      const quantidade = this.quantidades[item.idItem];
      if (quantidade === item.quantidade) {
        this.atualizando[item.idItem] = false;
        return;
      }
      try {
        this.aplicarCarrinho(await alterarQuantidadeItem(item.idItem, quantidade));
      } catch (erro) {
        if (this.tratar401(erro)) return;
        // 409: volta para a quantidade que estava e mostra a mensagem do BP1-22
        this.quantidades[item.idItem] = item.quantidade;
        this.erros[item.idItem] = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.atualizando[item.idItem] = false;
      }
    },

    async remover(item) {
      this.atualizando[item.idItem] = true;
      try {
        this.aplicarCarrinho(await removerItemCarrinho(item.idItem));
        this.frete = null; // as lojas podem ter mudado
        mostrarAviso({ tipo: 'sucesso', texto: `Removido do carrinho: ${item.peca.titulo}.` });
        this.$refs.titulo?.focus(); // o botão vai sumir: o foco passa para o título antes
      } catch (erro) {
        if (!this.tratar401(erro)) mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      } finally {
        this.atualizando[item.idItem] = false;
      }
    },

    // ---------- Entrega ou retirada (BP1-23) ----------

    aoDigitarCep() {
      this.cep = mascararCep(this.cep);
      this.erroCep = '';
    },
    async estimarEntrega() {
      this.frete = null;
      if (!validarCep(this.cep)) {
        this.erroCep = 'CEP inválido ou área sem cobertura de entrega'; // BP1-23, fluxo alternativo
        this.$refs.campoCep?.focus();
        return;
      }
      this.consultandoCep = true;
      try {
        const cep = somenteDigitos(this.cep);
        this.frete = await calcularFrete(cep);
        gravarSessao(CHAVE_CEP_ENTREGA, cep);
      } catch (erro) {
        if (this.tratar401(erro)) return;
        if (erro?.status === 400) {
          this.erroCep = erro.mensagem || 'CEP inválido ou área sem cobertura de entrega';
          this.$refs.campoCep?.focus();
        } else {
          // Serviço fora do ar: segue com frete a combinar (ADR-012)
          this.frete = { regiao: null, lojas: [], falhou: true };
        }
      } finally {
        this.consultandoCep = false;
      }
    },
    get textoRegiao() {
      const r = this.frete?.regiao;
      const lugar = r?.cidade ? `${r.cidade}/${r.uf}` : `CEP ${this.cep}`;
      const lojas = this.frete?.lojas || [];
      const comRetirada = lojas.filter((l) => l.retiradaBalcao).length;
      let retirada = '';
      if (lojas.length && comRetirada === lojas.length) {
        retirada = { 1: ' Retirada disponível na loja.', 2: ' Retirada disponível nas duas lojas.' }[lojas.length]
          || ' Retirada disponível em todas as lojas.';
      } else if (comRetirada) {
        retirada = ` Retirada disponível em ${comRetirada} de ${lojas.length} lojas.`;
      }
      return `${lugar}.${retirada} Prazos e frete precisam ser combinados.`;
    },
    get freteIndisponivel() {
      return Boolean(this.frete) && (this.frete.falhou || this.frete.lojas.every((l) => l.freteACombinar || !l.opcoes?.length));
    },
    get lojasComOpcoes() {
      return (this.frete?.lojas || []).filter((l) => !l.freteACombinar && l.opcoes?.length);
    },
    textoOpcao(o) {
      return `${TIPOS_FRETE[o.tipo] || o.tipo}: ${formatarMoeda(o.valor)} • ${pluralizarDiasUteis(o.prazoDias)}`;
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('meuCarrinho', paginaCarrinho);
});