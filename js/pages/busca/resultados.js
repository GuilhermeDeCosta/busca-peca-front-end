// Tela: busca/resultados.html — Resultados da busca (Fluxo A • Encontrar e comprar, etapas 02 e 03)
// Acesso: público. Casos de uso: BP1-4 (buscar peça), BP1-6 (categoria), BP1-7 (localização),
//   BP-8 (condição), BP1-10 (comparar), BP1-11 (salvar busca), BP1-13 (origem),
//   BP1-14 (forma de pagamento), BP1-15 (avaliação da loja), BP1-17 (pronta entrega)
// Rotas: GET /api/busca, GET /api/categorias, GET /api/veiculos/marcas, GET /api/veiculos,
//        POST /api/busca/salvas, POST /api/carrinho/itens, POST e DELETE /api/favoritos
//
// Como funciona (Documentação do Front-end, "Uso do Alpine.js" e "Navegação"):
//   - Os filtros vêm do endereço (?q=...&categoria=...), então a busca pode ser compartilhada por link.
//   - Mudou um filtro: a lista é refeita na hora (sem recarregar) e o endereço é atualizado.
//   - Os últimos filtros ficam no sessionStorage para o botão "voltar" do detalhe da peça.
//   - A localização vem do cabeçalho (CEP ou GPS, com aviso da LGPD); sem ela, o filtro de distância fica desligado.
//   - Nenhuma regra de negócio aqui: quem decide o resultado é a API.
import { buscarPecas, salvarBusca } from '../../services/busca.js';
import { listarCategorias, listarMarcasVeiculo, listarVeiculos } from '../../services/catalogo.js';
import { adicionarAoCarrinho } from '../../services/carrinho.js';
import { adicionarFavorito, removerFavorito } from '../../services/favoritos.js';
import {
  htmlCardPeca, htmlCardsCarregando, ligarImagensPadrao, definirCarregando, definirFavorito,
} from '../../components/card-peca.js';
import { numerosDePagina } from '../../components/paginacao.js';
import { mostrarAviso } from '../../components/aviso.js';
import { formatarMoeda } from '../../utils/formatacao.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const TAMANHO_PAGINA = 12;
const MAXIMO_COMPARAR = 3;
const MINIMO_CARACTERES = 3;
const CHAVE_LOCALIZACAO = 'bp:localizacao'; // a mesma do cabecalho.js
const CHAVE_ULTIMA_BUSCA = 'bp:ultima-busca'; // últimos filtros (Documentação do Front-end)
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';

// ---------- Opções fixas dos filtros (valores da Documentação do Banco) ----------

export const CONDICOES = [
  { valor: 'NOVA', texto: 'Novo' },
  { valor: 'USADA', texto: 'Usado' },
  { valor: 'RECONDICIONADA', texto: 'Recondicionado' },
];
export const ORIGENS = [
  { valor: 'NACIONAL', texto: 'Nacional' },
  { valor: 'IMPORTADA', texto: 'Importado' },
];
export const DISTANCIAS = [10, 25, 50, 100].map((km) => ({ valor: String(km), texto: `Até ${km} km` }));
export const DISPONIBILIDADES = [
  { valor: 'true', texto: 'Em estoque • pronta entrega', chip: 'Em estoque' },
  { valor: 'false', texto: 'Sob encomenda', chip: 'Sob encomenda' },
];
export const PRECOS = [
  { valor: '0-100', texto: 'R$ 0 a R$ 100' },
  { valor: '0-300', texto: 'R$ 0 a R$ 300' },
  { valor: '0-800', texto: 'R$ 0 a R$ 800' },
  { valor: '800-', texto: 'Acima de R$ 800' },
];
export const NOTAS = [
  { valor: '3', texto: '3 estrelas ou mais' },
  { valor: '4', texto: '4 estrelas ou mais' },
  { valor: '4.5', texto: '4,5 estrelas ou mais' },
];
export const FORMAS_PAGAMENTO = [
  { valor: 'PIX', texto: 'Pix' },
  { valor: 'DINHEIRO', texto: 'Dinheiro' },
  { valor: 'CARTAO_CREDITO', texto: 'Cartão de crédito' },
  { valor: 'CARTAO_DEBITO', texto: 'Cartão de débito' },
  { valor: 'BOLETO', texto: 'Boleto' },
  { valor: 'FATURADO', texto: 'Faturado para CNPJ' },
];
export const ORDENACOES = [
  { valor: 'relevancia', texto: 'Relevância' },
  { valor: 'preco', texto: 'Menor preço' },
  { valor: 'preco_desc', texto: 'Maior preço' },
  { valor: 'distancia', texto: 'Menor distância', precisaLocal: true },
  { valor: 'avaliacao', texto: 'Melhor avaliação da loja' },
];

// Filtros que vão para o endereço da página (e voltam dele)
const CAMPOS_FILTRO = ['categoria', 'marca', 'modelo', 'ano', 'condicao', 'origem', 'raioKm',
  'prontaEntrega', 'preco', 'notaMinima', 'formaPagamento'];

const filtrosVazios = () => Object.fromEntries(CAMPOS_FILTRO.map((c) => [c, '']));
const textoDe = (lista, valor) => lista.find((o) => o.valor === String(valor))?.texto || valor;

function lerLocalizacaoSalva() {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_LOCALIZACAO)); } catch (e) { return null; }
}

// Peças selecionadas para comparar: fora do Alpine para o card não ser redesenhado a cada clique
const idsSelecionados = new Set();
const pecasNaTela = new Map();

function paginaResultados() {
  return {
    // Opções dos selects
    CONDICOES, ORIGENS, DISTANCIAS, DISPONIBILIDADES, PRECOS, NOTAS, FORMAS_PAGAMENTO, ORDENACOES,
    categorias: [],
    marcas: [],
    veiculos: [], // GET /api/veiculos?marca= (modelos e anos da marca escolhida)

    // Estado da busca
    q: '',
    filtros: filtrosVazios(),
    ordenar: 'relevancia',
    pagina: 1,
    local: null,

    // Resposta da API
    carregando: true,
    erro: '',
    termoCurto: false,
    totalRegistros: 0,
    totalLojas: 0,
    totalPaginas: 1,
    requisicao: 0,

    // Interface
    painelAberto: false,
    selecao: [],
    modalSalvar: { aberto: false, nome: '', erro: '', salvando: false },

    // ---------- Início ----------

    async init() {
      this.lerEndereco();
      ligarImagensPadrao(this.$refs.lista);

      // O cabeçalho avisa quando o usuário informa o CEP ou usa o GPS
      document.addEventListener('localizacao:alterada', (e) => {
        this.local = e.detail;
        this.pagina = 1;
        this.buscar();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modalSalvar.aberto) this.fecharModalSalvar();
        else if (e.key === 'Escape' && this.painelAberto) this.fecharPainel();
      });

      this.buscar();
      this.carregarOpcoes();
    },

    // Lê termo, filtros, ordem, página e localização do endereço (?q=...)
    lerEndereco() {
      const params = new URLSearchParams(window.location.search);
      this.q = (params.get('q') || '').trim();
      CAMPOS_FILTRO.forEach((campo) => { this.filtros[campo] = params.get(campo) || ''; });

      // Preço vai para a API como precoMin/precoMax; na tela é uma faixa só
      const min = params.get('precoMin');
      const max = params.get('precoMax');
      if (min || max) this.filtros.preco = `${min || 0}-${max || ''}`;

      this.ordenar = ORDENACOES.some((o) => o.valor === params.get('ordenar')) ? params.get('ordenar') : 'relevancia';
      this.pagina = Math.max(1, Number(params.get('pagina')) || 1);

      const cep = params.get('cep');
      const lat = params.get('lat');
      const lng = params.get('lng');
      if (cep) this.local = { tipo: 'cep', cep, rotulo: `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` };
      else if (lat && lng) this.local = { tipo: 'gps', lat, lng, rotulo: 'Perto de você' };
      else this.local = lerLocalizacaoSalva();
    },

    async carregarOpcoes() {
      try {
        const [categorias, marcas] = await Promise.all([listarCategorias(), listarMarcasVeiculo()]);
        this.categorias = Array.isArray(categorias) ? categorias : categorias?.itens || [];
        this.marcas = marcas || [];
        if (this.filtros.marca) {
          this.veiculos = await listarVeiculos(this.filtros.marca);
          if (this.filtros.modelo || this.filtros.ano) this.buscar(); // agora dá para mandar o id do veículo
        }
      } catch (e) {
        // Sem as opções os filtros de categoria e veículo ficam vazios, mas a lista continua funcionando
        mostrarAviso({ tipo: 'erro', texto: 'Não foi possível carregar categorias e veículos dos filtros.' });
      }
    },

    // ---------- Textos da página ----------

    get modelos() {
      return [...new Set(this.veiculos.map((v) => v.modelo))].sort();
    },
    get anos() {
      return [...new Set(this.veiculos.filter((v) => v.modelo === this.filtros.modelo).map((v) => v.ano))].sort((a, b) => b - a);
    },
    get nomeCategoria() {
      const id = Number(this.filtros.categoria);
      for (const c of this.categorias) {
        if (c.idCategoria === id) return c.nome;
        const sub = (c.subcategorias || []).find((s) => s.idCategoria === id);
        if (sub) return `${c.nome} / ${sub.nome}`;
      }
      return '';
    },
    get textoVeiculo() {
      return [this.filtros.marca, this.filtros.modelo, this.filtros.ano].filter(Boolean).join(' ');
    },
    get titulo() {
      if (this.q) return this.q;
      if (this.filtros.categoria && this.nomeCategoria) return this.nomeCategoria;
      if (this.textoVeiculo) return `Peças para ${this.textoVeiculo}`;
      return 'Todas as peças';
    },
    get resumo() {
      const anuncios = `${this.totalRegistros} ${this.totalRegistros === 1 ? 'anúncio' : 'anúncios'}`;
      const lojas = this.totalLojas ? ` de ${this.totalLojas} ${this.totalLojas === 1 ? 'loja' : 'lojas'}` : '';
      const veiculo = this.textoVeiculo ? ` • opções para ${this.textoVeiculo}` : '';
      return `${anuncios}${lojas}${veiculo}`;
    },
    get vazio() {
      return !this.carregando && !this.erro && !this.termoCurto && this.totalRegistros === 0;
    },
    get categoriasSugeridas() {
      return this.categorias.slice(0, 4);
    },

    // Etiquetas dos filtros ativos (com × para remover)
    get chips() {
      const f = this.filtros;
      const chips = [];
      if (f.categoria) chips.push({ campo: 'categoria', texto: this.nomeCategoria || 'Categoria' });
      if (f.marca) chips.push({ campo: 'marca', texto: f.marca });
      if (f.modelo) chips.push({ campo: 'modelo', texto: f.modelo });
      if (f.ano) chips.push({ campo: 'ano', texto: f.ano });
      if (f.condicao) chips.push({ campo: 'condicao', texto: textoDe(CONDICOES, f.condicao) });
      if (f.origem) chips.push({ campo: 'origem', texto: textoDe(ORIGENS, f.origem) });
      if (f.raioKm && this.local) chips.push({ campo: 'raioKm', texto: `Até ${f.raioKm} km` });
      if (f.prontaEntrega) chips.push({ campo: 'prontaEntrega', texto: DISPONIBILIDADES.find((d) => d.valor === f.prontaEntrega)?.chip });
      if (f.preco) chips.push({ campo: 'preco', texto: this.textoPreco(f.preco) });
      if (f.notaMinima) chips.push({ campo: 'notaMinima', texto: `★ ${String(f.notaMinima).replace('.', ',')} ou mais` });
      if (f.formaPagamento) chips.push({ campo: 'formaPagamento', texto: textoDe(FORMAS_PAGAMENTO, f.formaPagamento) });
      return chips;
    },

    textoPreco(valor) {
      const conhecido = PRECOS.find((p) => p.valor === valor);
      if (conhecido) return conhecido.texto;
      const [min, max] = valor.split('-');
      return max ? `${formatarMoeda(min || 0)} a ${formatarMoeda(max)}` : `Acima de ${formatarMoeda(min)}`;
    },

    // ---------- Filtros ----------

    async aoMudarFiltro(campo) {
      // Veículo em cascata: marca → modelo → ano. Espera os veículos para mandar o id certo à API.
      if (campo === 'marca') {
        this.filtros.modelo = '';
        this.filtros.ano = '';
        this.veiculos = [];
        if (this.filtros.marca) {
          try {
            this.veiculos = await listarVeiculos(this.filtros.marca);
          } catch (e) {
            mostrarAviso({ tipo: 'erro', texto: 'Não foi possível carregar os modelos.' });
          }
        }
      }
      if (campo === 'modelo') this.filtros.ano = '';
      this.pagina = 1;
      this.buscar();
    },

    removerFiltro(campo) {
      this.filtros[campo] = '';
      this.aoMudarFiltro(campo);
    },

    // "Limpar": tira todos os filtros e mantém o termo digitado (BP1-4 e BP-8, fluxo alternativo)
    limparFiltros() {
      this.filtros = filtrosVazios();
      this.veiculos = [];
      this.pagina = 1;
      this.buscar();
    },

    abrirLocalizacao() {
      // O painel do cabeçalho pede o CEP ou a localização do aparelho, com o aviso da LGPD (ADR-013)
      const botao = document.querySelector('#cabecalho [data-abre="painel-localizacao"]');
      if (!botao) return;
      this.fecharPainel();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (botao.getAttribute('aria-expanded') !== 'true') botao.click();
      else document.getElementById('cabecalho-cep')?.focus();
    },

    // ---------- Busca ----------

    // Ids dos veículos escolhidos (parâmetro "veiculo" de GET /api/busca)
    idsVeiculo() {
      const { marca, modelo, ano } = this.filtros;
      if (!marca || !this.veiculos.length) return '';
      return this.veiculos
        .filter((v) => (!modelo || v.modelo === modelo) && (!ano || String(v.ano) === String(ano)))
        .map((v) => v.idVeiculo)
        .join(',');
    },

    filtrosParaApi() {
      const f = this.filtros;
      const [precoMin, precoMax] = (f.preco || '').split('-');
      const local = this.local || {};
      return {
        q: this.q,
        categoria: f.categoria,
        veiculo: this.idsVeiculo(),
        condicao: f.condicao,
        origem: f.origem,
        prontaEntrega: f.prontaEntrega,
        cep: local.cep,
        lat: local.lat,
        lng: local.lng,
        raioKm: this.local ? f.raioKm : '', // sem coordenadas o filtro de distância é ignorado (ADR-012)
        formaPagamento: f.formaPagamento,
        notaMinima: f.notaMinima,
        precoMin: precoMin && precoMin !== '0' ? precoMin : '',
        precoMax: precoMax || '',
        ordenar: this.ordenar === 'distancia' && !this.local ? 'relevancia' : this.ordenar,
        pagina: this.pagina,
        tamanho: TAMANHO_PAGINA,
      };
    },

    // Endereço legível e compartilhável: marca/modelo/ano por nome, preço em precoMin/precoMax
    atualizarEndereco() {
      const f = this.filtros;
      const [precoMin, precoMax] = (f.preco || '').split('-');
      const local = this.local || {};
      const valores = {
        q: this.q,
        ...f,
        preco: '',
        raioKm: this.local ? f.raioKm : '',
        precoMin: precoMin && precoMin !== '0' ? precoMin : '',
        precoMax,
        ordenar: this.ordenar !== 'relevancia' ? this.ordenar : '',
        pagina: this.pagina > 1 ? this.pagina : '',
        cep: local.cep,
        lat: local.lat,
        lng: local.lng,
      };
      const params = new URLSearchParams();
      Object.entries(valores).forEach(([chave, valor]) => { if (valor) params.set(chave, valor); });
      const consulta = params.toString();
      history.replaceState(null, '', consulta ? `?${consulta}` : window.location.pathname);
      try { sessionStorage.setItem(CHAVE_ULTIMA_BUSCA, consulta); } catch (e) { /* navegador bloqueou */ }
      return consulta;
    },

    async buscar() {
      this.atualizarEndereco();
      this.erro = '';

      // BP1-4, fluxo alternativo 6: menos de 3 caracteres não busca
      this.termoCurto = this.q.length > 0 && this.q.length < MINIMO_CARACTERES;
      if (this.termoCurto) {
        this.carregando = false;
        this.totalRegistros = 0;
        this.$refs.lista.innerHTML = '';
        return;
      }

      const minhaRequisicao = ++this.requisicao; // ignora respostas antigas se o usuário mudar rápido
      this.carregando = true;
      this.$refs.lista.setAttribute('aria-busy', 'true');
      this.$refs.lista.innerHTML = htmlCardsCarregando(6);

      try {
        const resposta = await buscarPecas(this.filtrosParaApi(), this.filtros);
        if (minhaRequisicao !== this.requisicao) return;

        this.totalRegistros = resposta.totalRegistros || 0;
        this.totalLojas = resposta.totalLojas || 0;
        this.totalPaginas = resposta.totalPaginas || 1;
        if (this.pagina > this.totalPaginas && this.totalRegistros > 0) {
          this.pagina = this.totalPaginas; // a página pedida não existe mais com os novos filtros
          return this.buscar();
        }
        this.mostrarPecas(resposta.itens || []);
      } catch (erro) {
        if (minhaRequisicao !== this.requisicao) return;
        if (erro?.status === 400 && (erro.campos || []).some((c) => c.campo === 'q')) {
          this.termoCurto = true;
        } else {
          this.erro = erro?.mensagem || ERRO_GENERICO;
        }
        this.totalRegistros = 0;
        this.$refs.lista.innerHTML = '';
      } finally {
        if (minhaRequisicao === this.requisicao) {
          this.carregando = false;
          this.$refs.lista.removeAttribute('aria-busy');
        }
      }
    },

    mostrarPecas(itens) {
      itens.forEach((p) => pecasNaTela.set(Number(p.idPeca), p));
      this.$refs.lista.innerHTML = itens
        .map((p) => `<div class="col">${htmlCardPeca(p, { comparar: true, selecionado: idsSelecionados.has(Number(p.idPeca)) })}</div>`)
        .join('');
    },

    // ---------- Ordenação e paginação ----------

    aoMudarOrdem() {
      this.pagina = 1;
      this.buscar();
    },

    get paginas() {
      return numerosDePagina(this.pagina, this.totalPaginas);
    },

    irParaPagina(numero) {
      if (numero < 1 || numero > this.totalPaginas || numero === this.pagina) return;
      this.pagina = numero;
      this.buscar();
      // Leva o foco para o topo da lista (teclado e leitor de tela)
      this.$refs.topoLista.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.$refs.topoLista.focus({ preventScroll: true });
    },

    // ---------- Painel de filtros no celular ----------

    abrirPainel() {
      this.painelAberto = true;
      document.body.classList.add('overflow-hidden');
      this.$nextTick(() => this.$refs.fecharPainel?.focus());
    },
    fecharPainel() {
      if (!this.painelAberto) return;
      this.painelAberto = false;
      document.body.classList.remove('overflow-hidden');
      this.$refs.botaoFiltros?.focus();
    },

    // ---------- Cliques nos cards ----------

    async aoClicarLista(evento) {
      const botao = evento.target.closest('button[data-acao]');
      if (!botao || botao.disabled) return;
      const idPeca = Number(botao.closest('[data-id-peca]')?.dataset.idPeca);
      if (botao.dataset.acao === 'carrinho') this.adicionar(botao, idPeca);
      if (botao.dataset.acao === 'favorito') this.favoritar(botao, idPeca);
    },

    aoMarcarComparar(evento) {
      const caixa = evento.target;
      if (caixa.dataset.acao !== 'comparar') return;
      const idPeca = Number(caixa.closest('[data-id-peca]')?.dataset.idPeca);
      const peca = pecasNaTela.get(idPeca);
      if (!peca) return;

      if (caixa.checked) {
        if (idsSelecionados.size >= MAXIMO_COMPARAR) {
          caixa.checked = false;
          mostrarAviso({ tipo: 'erro', texto: `Você pode comparar até ${MAXIMO_COMPARAR} opções de cada vez.` });
          return;
        }
        idsSelecionados.add(idPeca);
        this.selecao.push({
          idPeca, titulo: peca.titulo, codigoOem: peca.codigoOem, marcaPeca: peca.marcaPeca, nomeLoja: peca.loja?.nomeLoja,
        });
      } else {
        idsSelecionados.delete(idPeca);
        this.selecao = this.selecao.filter((s) => s.idPeca !== idPeca);
      }
    },

    get resumoSelecao() {
      const oems = new Set(this.selecao.map((s) => s.codigoOem).filter(Boolean));
      const lojas = [...new Set(this.selecao.map((s) => s.nomeLoja))];
      const lojasTexto = lojas.length > 1 ? `${lojas.slice(0, -1).join(', ')} e ${lojas.at(-1)}` : lojas[0] || '';
      if (oems.size === 1 && this.selecao.every((s) => s.codigoOem)) {
        return `${this.selecao[0].marcaPeca || ''} OEM ${[...oems][0]} • ${lojasTexto}`.trim();
      }
      return this.selecao.map((s) => s.titulo).join(' • ');
    },

    get linkComparar() {
      return linkPara('comparar', { ids: this.selecao.map((s) => s.idPeca).join(',') });
    },

    limparSelecao() {
      idsSelecionados.clear();
      this.selecao = [];
      this.$refs.lista.querySelectorAll('[data-acao="comparar"]').forEach((c) => { c.checked = false; });
    },

    // Visitante vai para o login e volta para a peça (Documentação do Front-end, "Navegação")
    irParaLogin(destino) {
      window.location.href = linkLogin(destino);
    },

    async usuarioLogado() {
      return window.Cabecalho ? window.Cabecalho.pronto : null;
    },

    async adicionar(botao, idPeca) {
      if (!(await this.usuarioLogado())) return this.irParaLogin(linkPara('detalhePeca', { id: idPeca }));
      const peca = pecasNaTela.get(idPeca);
      definirCarregando(botao, true);
      try {
        const resposta = await adicionarAoCarrinho(idPeca, 1);
        if (typeof resposta?.quantidadeTotal === 'number') {
          document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: resposta.quantidadeTotal } }));
        }
        mostrarAviso({
          tipo: 'sucesso',
          texto: `Adicionado ao carrinho: ${peca?.titulo || 'peça'}.`,
          link: { href: linkPara('carrinho'), texto: 'Ver carrinho' },
        });
      } catch (erro) {
        if (erro?.status === 401) return this.irParaLogin(linkPara('detalhePeca', { id: idPeca }));
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      } finally {
        definirCarregando(botao, false);
      }
    },

    async favoritar(botao, idPeca) {
      if (!(await this.usuarioLogado())) return this.irParaLogin(linkPara('detalhePeca', { id: idPeca }));
      const peca = pecasNaTela.get(idPeca);
      const favoritar = botao.getAttribute('aria-pressed') !== 'true';
      definirCarregando(botao, true);
      try {
        if (favoritar) await adicionarFavorito(idPeca);
        else await removerFavorito(idPeca);
        if (peca) peca.favorito = favoritar;
        definirFavorito(botao, favoritar, peca?.titulo || 'peça');
        mostrarAviso(favoritar
          ? { tipo: 'sucesso', texto: 'Peça salva nos favoritos.', link: { href: linkPara('favoritos'), texto: 'Ver favoritos' } }
          : { tipo: 'sucesso', texto: 'Peça removida dos favoritos.' });
      } catch (erro) {
        if (erro?.status === 401) return this.irParaLogin(linkPara('detalhePeca', { id: idPeca }));
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      } finally {
        definirCarregando(botao, false);
      }
    },

    // ---------- Salvar busca (BP1-11) ----------

    async abrirModalSalvar() {
      // BP1-11: precisa estar logado; o visitante entra e volta para esta mesma busca
      if (!(await this.usuarioLogado())) return this.irParaLogin(window.location.href);
      this.modalSalvar = { aberto: true, nome: this.titulo, erro: '', salvando: false };
      this.$nextTick(() => this.$refs.nomeBusca?.select());
    },

    fecharModalSalvar() {
      this.modalSalvar.aberto = false;
      this.$nextTick(() => this.$refs.botaoSalvar?.focus());
    },

    async confirmarSalvar() {
      const nome = this.modalSalvar.nome.trim();
      if (!nome) {
        this.modalSalvar.erro = 'Dê um nome para a busca.';
        this.$refs.nomeBusca?.focus();
        return;
      }
      this.modalSalvar.salvando = true;
      this.modalSalvar.erro = '';
      try {
        const parametros = new URLSearchParams(window.location.search);
        parametros.delete('pagina'); // salva os filtros, não a página aberta
        await salvarBusca(nome, parametros.toString());
        this.fecharModalSalvar();
        mostrarAviso({
          tipo: 'sucesso',
          texto: 'Busca salva com sucesso em seu painel.',
          link: { href: linkPara('buscasSalvas'), texto: 'Ver buscas salvas' },
        });
      } catch (erro) {
        if (erro?.status === 401) return this.irParaLogin(window.location.href);
        const doCampo = (erro?.campos || []).find((c) => c.campo === 'nome');
        this.modalSalvar.erro = doCampo?.mensagem || erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.modalSalvar.salvando = false;
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('resultadosBusca', paginaResultados);
});
