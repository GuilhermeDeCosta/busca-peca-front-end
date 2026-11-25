// Tela: compra/checkout.html — Revise seus pedidos (Fluxo A • Encontrar e comprar, A08 / etapa 07)
// Acesso: logado. Casos de uso: BP1-24 (finalização da compra), BP1-23 (frete a combinar)
// Rotas: GET /api/carrinho, GET /api/usuarios/me, GET e POST /api/usuarios/me/enderecos,
//        GET /api/enderecos/cep/{cep}, POST /api/compras
//
// Como funciona (Documentação do Front-end, "Uso do Alpine.js" → Checkout):
//   - Cada loja escolhe retirada ou entrega a combinar; o endereço só é exigido se alguma loja for entrega.
//   - O comprador confirma, loja por loja, que leu as condições e que o pagamento é direto (ADR-008).
//   - "Confirmar pedidos" chama POST /api/compras: a API cria um pedido por loja (ADR-009), confere preço
//     e estoque de novo e gera o código de retirada. Se algo mudou (409), nada é gravado e o comprador volta ao carrinho.
//   - Sem login, a API responde 401 e a página leva para o login, voltando para cá.
import { obterCarrinho } from '../../services/carrinho.js';
import { obterMeusDados, listarEnderecos, cadastrarEndereco, consultarCep } from '../../services/usuarios.js';
import { finalizarCompra } from '../../services/pedidos.js';
import { mostrarAviso } from '../../components/aviso.js';
import { formatarMoeda, pluralizarDiasUteis } from '../../utils/formatacao.js';
import { mascararCep, somenteDigitos } from '../../utils/mascaras.js';
import { validarCep } from '../../utils/validacoes.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';
const OBSERVACAO_MAXIMO = 500;
export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI',
  'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const enderecoVazio = () => ({
  identificacao: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', principal: false,
});

function formatarTelefone(telefone = '') {
  const d = somenteDigitos(telefone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return telefone;
}

function paginaCheckout() {
  return {
    UFS,
    OBSERVACAO_MAXIMO,
    carregando: true,
    erro: '',
    carrinho: { lojas: [], quantidadeTotal: 0, total: 0 },
    usuario: null,
    enderecos: [],
    idEndereco: null,

    // Escolhas por loja: { [idLoja]: { modalidade, observacao, ciente } }
    escolhas: {},

    // "Alterar endereço" (BP1-24, fluxo alternativo)
    editandoEndereco: false,
    novoEndereco: enderecoVazio(),
    errosEndereco: {},
    buscandoCep: false,
    salvandoEndereco: false,

    // Confirmação
    tentouConfirmar: false,
    confirmando: false,
    erroConfirmar: '',
    mudouNoCarrinho: false,

    // ---------- Início ----------

    async init() {
      this.carregando = true;
      try {
        const [carrinho, usuario, enderecos] = await Promise.all([obterCarrinho(), obterMeusDados(), listarEnderecos()]);
        // As escolhas de cada loja precisam existir antes de a lista de lojas aparecer
        const escolhas = {};
        (carrinho?.lojas || []).forEach((g) => {
          escolhas[g.loja.idLoja] = { modalidade: this.opcoesRecebimento(g.loja)[0]?.valor || 'ENTREGA', observacao: '', ciente: false };
        });
        this.escolhas = escolhas;
        this.usuario = usuario;
        this.enderecos = enderecos || [];
        this.idEndereco = (this.enderecos.find((e) => e.principal) || this.enderecos[0])?.idEndereco ?? null;
        this.carrinho = carrinho || { lojas: [] };
        if (!this.enderecos.length) this.abrirNovoEndereco();
      } catch (erro) {
        if (erro?.status === 401) {
          window.location.href = linkLogin(window.location.href);
          return;
        }
        this.erro = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.carregando = false;
      }
    },

    // ---------- Textos ----------

    get vazio() {
      return !this.carregando && !this.erro && this.carrinho.lojas.length === 0;
    },
    get quantidadeLojas() {
      return this.carrinho.lojas.length;
    },
    get textoBotao() {
      if (this.confirmando) return 'Enviando para as lojas…';
      return this.quantidadeLojas > 1 ? `Confirmar os ${this.quantidadeLojas} pedidos` : 'Confirmar o pedido';
    },
    get avisoDivisao() {
      return this.quantidadeLojas > 1
        ? `O carrinho será dividido em ${this.quantidadeLojas} pedidos independentes. Nenhum valor será cobrado pela plataforma.`
        : 'Seu pedido vai para uma loja. Nenhum valor será cobrado pela plataforma.';
    },
    moeda(valor) {
      return formatarMoeda(valor);
    },
    get enderecoEscolhido() {
      return this.enderecos.find((e) => e.idEndereco === this.idEndereco) || null;
    },
    linhaRua(e) {
      return [`${e.logradouro}, ${e.numero}`, e.complemento, e.bairro].filter(Boolean).join(' • ');
    },
    linhaCidade(e) {
      return `${e.cidade}/${e.estado} • CEP ${mascararCep(e.cep)}`;
    },
    rotuloEndereco(e) {
      return `${e.identificacao ? `${e.identificacao}: ` : ''}${e.logradouro}, ${e.numero} • ${e.cidade}/${e.estado}${e.principal ? ' (principal)' : ''}`;
    },
    get contato() {
      const u = this.usuario || {};
      return [u.email, formatarTelefone(u.telefone)].filter(Boolean).join(' • ');
    },
    get nomeContato() {
      const u = this.usuario || {};
      return [u.nome, u.nomeExibicao].filter(Boolean).join(' • ');
    },

    // Retirada e/ou entrega, conforme o que a loja oferece (dados de recebimento da loja, V11)
    opcoesRecebimento(loja) {
      const opcoes = [];
      if (loja.retiradaBalcao) opcoes.push({ valor: 'RETIRADA', texto: 'Retirada na loja' });
      if (loja.motoboyProprio) opcoes.push({ valor: 'ENTREGA', texto: 'Entrega por motoboy (a combinar)' });
      else if (loja.entregaCombinar) opcoes.push({ valor: 'ENTREGA', texto: 'Entrega a combinar' });
      return opcoes.length ? opcoes : [{ valor: 'ENTREGA', texto: 'Entrega a combinar' }];
    },
    linhaItem(item) {
      const unidade = item.quantidade > 1 ? ` • ${formatarMoeda(item.precoUnitario)} cada` : '';
      return `${item.quantidade} × ${item.peca.titulo}${unidade}`;
    },
    textoPrazo(grupo) {
      const todosProntos = grupo.itens.every((i) => i.peca.prontaEntrega);
      const prazo = todosProntos ? 'Pronta entrega'
        : `Expedição em ${pluralizarDiasUteis(Math.max(...grupo.itens.map((i) => i.peca.prazoExpedicaoDias || 1)))}`;
      return `${prazo} • confirme dia e horário com a loja.`;
    },
    placeholderObservacao(idLoja) {
      return this.escolhas[idLoja]?.modalidade === 'RETIRADA'
        ? 'Ex.: Confirmar disponibilidade e horário antes da retirada.'
        : 'Ex.: Entregar no portão da oficina, das 8h às 17h.';
    },

    // ---------- Regras de tela (o que falta preencher) ----------

    get precisaEndereco() {
      return Object.values(this.escolhas).some((e) => e.modalidade === 'ENTREGA');
    },
    get faltaEndereco() {
      return this.precisaEndereco && !this.idEndereco;
    },
    get faltaCiencia() {
      return Object.values(this.escolhas).some((e) => !e.ciente);
    },
    get podeConfirmar() {
      return !this.carregando && !this.vazio && !this.faltaEndereco && !this.faltaCiencia && !this.confirmando && !this.editandoEndereco;
    },

    // ---------- Novo endereço ----------

    abrirNovoEndereco() {
      this.novoEndereco = enderecoVazio();
      this.errosEndereco = {};
      this.editandoEndereco = true;
      this.$nextTick(() => this.$refs.cepNovo?.focus());
    },
    cancelarNovoEndereco() {
      this.editandoEndereco = false;
      this.$nextTick(() => this.$refs.botaoEditarEndereco?.focus());
    },
    async aoDigitarCepNovo() {
      this.novoEndereco.cep = mascararCep(this.novoEndereco.cep);
      this.errosEndereco.cep = '';
      if (!validarCep(this.novoEndereco.cep)) return;
      // CEP completo: preenche rua, bairro, cidade e UF pela API (Documentação do Front-end, "Formulários")
      this.buscandoCep = true;
      try {
        const achado = await consultarCep(somenteDigitos(this.novoEndereco.cep));
        ['logradouro', 'bairro', 'cidade', 'estado'].forEach((c) => { if (achado[c]) this.novoEndereco[c] = achado[c]; });
        this.$nextTick(() => (achado.logradouro ? this.$refs.numeroNovo : this.$refs.ruaNovo)?.focus());
      } catch (erro) {
        this.errosEndereco.cep = erro?.status === 404 ? erro.mensagem : '';
      } finally {
        this.buscandoCep = false;
      }
    },
    async salvarNovoEndereco() {
      const n = this.novoEndereco;
      const erros = {};
      if (!validarCep(n.cep)) erros.cep = 'Informe um CEP com 8 números.';
      if (!n.logradouro.trim()) erros.logradouro = 'Informe a rua.';
      if (!n.numero.trim()) erros.numero = 'Informe o número ou S/N.';
      if (!n.bairro.trim()) erros.bairro = 'Informe o bairro.';
      if (!n.cidade.trim()) erros.cidade = 'Informe a cidade.';
      if (!n.estado) erros.estado = 'Escolha a UF.';
      this.errosEndereco = erros;
      if (Object.keys(erros).length) {
        this.$nextTick(() => document.querySelector('.checkout-endereco-form .is-invalid')?.focus());
        return;
      }
      this.salvandoEndereco = true;
      try {
        const criado = await cadastrarEndereco({ ...n, cep: somenteDigitos(n.cep), estado: n.estado.toUpperCase() });
        if (criado.principal) this.enderecos.forEach((e) => { e.principal = false; });
        this.enderecos.push(criado);
        this.idEndereco = criado.idEndereco;
        this.editandoEndereco = false;
        mostrarAviso({ tipo: 'sucesso', texto: 'Endereço salvo e escolhido para a entrega.' });
        this.$nextTick(() => this.$refs.botaoEditarEndereco?.focus());
      } catch (erro) {
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        // 400: a API manda a mensagem de cada campo (Documentação do Front-end, tabela de erros)
        (erro?.campos || []).forEach((c) => { this.errosEndereco[c.campo] = c.mensagem; });
        if (!erro?.campos?.length) mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      } finally {
        this.salvandoEndereco = false;
      }
    },

    // ---------- Confirmar (BP1-24, passos 8 e 9) ----------

    async confirmar() {
      this.tentouConfirmar = true;
      this.erroConfirmar = '';
      if (!this.podeConfirmar) {
        // Leva o foco ao primeiro ponto pendente
        this.$nextTick(() => document.querySelector('[data-pendente="true"]')?.focus());
        return;
      }
      this.confirmando = true;
      try {
        const compra = await finalizarCompra({
          idEndereco: this.precisaEndereco ? this.idEndereco : null,
          lojas: this.carrinho.lojas.map((g) => ({
            idLoja: g.loja.idLoja,
            modalidade: this.escolhas[g.loja.idLoja].modalidade,
            observacao: this.escolhas[g.loja.idLoja].observacao.trim(),
            cienciaPagamentoDireto: this.escolhas[g.loja.idLoja].ciente,
          })),
        });
        document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: 0 } }));
        window.location.href = linkPara('confirmacao', { compra: compra.idCompra });
      } catch (erro) {
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        // 409: preço ou estoque mudou desde o carrinho. Nada foi gravado (BP1-24, passo 6).
        this.mudouNoCarrinho = erro?.status === 409;
        this.erroConfirmar = erro?.mensagem || ERRO_GENERICO;
        this.confirmando = false;
        this.$nextTick(() => this.$refs.erroConfirmar?.focus());
      }
    },

    get linkCarrinho() {
      return linkPara('carrinho');
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('revisarPedidos', paginaCheckout);
});