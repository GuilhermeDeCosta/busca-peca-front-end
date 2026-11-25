// Tela: conta/favoritos.html — Favoritos e buscas salvas (Fluxo A • Encontrar e comprar, A06)
// Acesso: logado. Casos de uso: BP1-48 (favoritos), BP1-11 (buscas salvas)
// Rotas: GET /api/favoritos, DELETE /api/favoritos/{idPeca}, GET /api/busca/salvas,
//        PATCH /api/busca/salvas/{id} (renomear), DELETE /api/busca/salvas/{id}, POST /api/carrinho/itens
//
// Como funciona:
//   - O protótipo junta as duas listas numa página. A Documentação do Front-end lista
//     conta/favoritos.html e conta/buscas-salvas.html: a segunda só redireciona para cá (#buscas-salvas).
//   - Sem login, a API responde 401 e a página leva para o login, voltando para cá
//     (mesmo padrão do perfil.js; quando o auth.js existir, trocar por exigirLogin()).
//   - "Repetir busca" abre os resultados com os mesmos filtros guardados.
import { listarFavoritos, removerFavorito } from '../../services/favoritos.js';
import { listarBuscasSalvas, renomearBuscaSalva, removerBuscaSalva } from '../../services/busca.js';
import { listarCategorias } from '../../services/catalogo.js';
import { adicionarAoCarrinho } from '../../services/carrinho.js';
import { htmlCardPeca, htmlCardsCarregando, ligarImagensPadrao, definirCarregando } from '../../components/card-peca.js';
import { mostrarAviso } from '../../components/aviso.js';
import { formatarMoeda } from '../../utils/formatacao.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';

// Textos dos filtros guardados (os mesmos da tela de resultados)
const CONDICOES = { NOVA: 'Novo', USADA: 'Usado', RECONDICIONADA: 'Recondicionado' };
const ORIGENS = { NACIONAL: 'Nacional', IMPORTADA: 'Importado' };
const FORMAS_PAGAMENTO = {
  PIX: 'Pix', DINHEIRO: 'Dinheiro', CARTAO_CREDITO: 'Cartão de crédito', CARTAO_DEBITO: 'Cartão de débito',
  BOLETO: 'Boleto', FATURADO: 'Faturado para CNPJ',
};

function paginaFavoritos() {
  return {
    carregandoFavoritos: true,
    erroFavoritos: '',
    favoritos: [],
    carregandoBuscas: true,
    erroBuscas: '',
    buscas: [],
    categorias: [],

    // Editar nome (protótipo A06)
    edicao: { id: null, nome: '', erro: '', salvando: false },
    // Confirmação para remover busca salva (Documentação do Front-end: "Janela de confirmação")
    remocao: { busca: null, removendo: false },

    // ---------- Início ----------

    init() {
      ligarImagensPadrao(this.$refs.listaFavoritos);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.remocao.busca) this.fecharRemocao();
      });
      listarCategorias()
        .then((c) => { this.categorias = Array.isArray(c) ? c : c?.itens || []; })
        .catch(() => { this.categorias = []; });
      this.carregarFavoritos();
      this.carregarBuscas();
    },

    // 401: sessão encerrada ou visitante → login e volta para esta página
    tratarErro(erro, campo) {
      if (erro?.status === 401) {
        window.location.href = linkLogin(window.location.href);
        return true;
      }
      if (campo) this[campo] = erro?.mensagem || ERRO_GENERICO;
      return false;
    },

    // ---------- Favoritos (BP1-48) ----------

    async carregarFavoritos() {
      this.carregandoFavoritos = true;
      this.erroFavoritos = '';
      this.$refs.listaFavoritos.innerHTML = htmlCardsCarregando(3);
      try {
        this.favoritos = (await listarFavoritos()) || [];
        this.desenharFavoritos();
      } catch (erro) {
        this.$refs.listaFavoritos.innerHTML = '';
        this.tratarErro(erro, 'erroFavoritos');
      } finally {
        this.carregandoFavoritos = false;
      }
    },

    // Card de peça + "Remover dos favoritos" embaixo (protótipo)
    desenharFavoritos() {
      this.$refs.listaFavoritos.innerHTML = this.favoritos.map((p) => `
        <div class="col">
          <div class="favorito">
            ${htmlCardPeca({ ...p, favorito: true })}
            <button type="button" class="btn btn--contorno w-100 favorito__remover" data-acao="remover-favorito" data-id="${Number(p.idPeca)}">
              Remover dos favoritos
            </button>
          </div>
        </div>`).join('');
    },

    async aoClicarFavoritos(evento) {
      const botao = evento.target.closest('button[data-acao]');
      if (!botao || botao.disabled) return;
      const id = Number(botao.dataset.id || botao.closest('[data-id-peca]')?.dataset.idPeca);
      const peca = this.favoritos.find((p) => p.idPeca === id);

      // O coração do card também remove, já que todas as peças desta lista são favoritas
      if (botao.dataset.acao === 'remover-favorito' || botao.dataset.acao === 'favorito') {
        definirCarregando(botao, true);
        try {
          await removerFavorito(id);
          this.favoritos = this.favoritos.filter((p) => p.idPeca !== id);
          this.desenharFavoritos();
          mostrarAviso({ tipo: 'sucesso', texto: `Removido dos favoritos: ${peca?.titulo || 'peça'}.` });
          this.$refs.tituloFavoritos.focus(); // o botão sumiu: o foco vai para o título da lista
        } catch (erro) {
          if (!this.tratarErro(erro)) mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
          definirCarregando(botao, false);
        }
        return;
      }

      if (botao.dataset.acao === 'carrinho') {
        definirCarregando(botao, true);
        try {
          const resposta = await adicionarAoCarrinho(id, 1);
          if (typeof resposta?.quantidadeTotal === 'number') {
            document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: resposta.quantidadeTotal } }));
          }
          mostrarAviso({ tipo: 'sucesso', texto: `Adicionado ao carrinho: ${peca?.titulo || 'peça'}.`, link: { href: linkPara('carrinho'), texto: 'Ver carrinho' } });
        } catch (erro) {
          if (!this.tratarErro(erro)) mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
        } finally {
          definirCarregando(botao, false);
        }
      }
    },

    // ---------- Buscas salvas (BP1-11) ----------

    async carregarBuscas() {
      this.carregandoBuscas = true;
      this.erroBuscas = '';
      try {
        this.buscas = (await listarBuscasSalvas()) || [];
      } catch (erro) {
        this.tratarErro(erro, 'erroBuscas');
      } finally {
        this.carregandoBuscas = false;
      }
    },

    nomeCategoria(id) {
      for (const c of this.categorias) {
        if (String(c.idCategoria) === String(id)) return c.nome;
        const sub = (c.subcategorias || []).find((s) => String(s.idCategoria) === String(id));
        if (sub) return sub.nome;
      }
      return '';
    },
    termo(busca) {
      return new URLSearchParams(busca.parametros).get('q') || 'Todas as peças';
    },
    // "Chevrolet • Onix • 2020 • Novo • Nacional • até 50 km do CEP 13010-110"
    resumoFiltros(busca) {
      const p = new URLSearchParams(busca.parametros);
      const cep = p.get('cep');
      const local = cep ? ` do CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : '';
      const precoMin = p.get('precoMin');
      const precoMax = p.get('precoMax');
      let preco = '';
      if (precoMax) preco = `até ${formatarMoeda(precoMax)}`;
      else if (precoMin) preco = `acima de ${formatarMoeda(precoMin)}`;
      const partes = [
        this.nomeCategoria(p.get('categoria')),
        p.get('marca'), p.get('modelo'), p.get('ano'),
        CONDICOES[p.get('condicao')], ORIGENS[p.get('origem')],
        p.get('prontaEntrega') === 'true' ? 'em estoque' : p.get('prontaEntrega') === 'false' ? 'sob encomenda' : '',
        p.get('raioKm') ? `até ${p.get('raioKm')} km${local}` : '',
        preco,
        p.get('notaMinima') ? `loja ★ ${p.get('notaMinima').replace('.', ',')} ou mais` : '',
        FORMAS_PAGAMENTO[p.get('formaPagamento')],
      ].filter(Boolean);
      return partes.length ? partes.join(' • ') : 'Sem filtros';
    },
    dataSalva(busca) {
      return busca.criadaEm ? `Salva em ${new Date(busca.criadaEm).toLocaleDateString('pt-BR')}` : '';
    },
    linkRepetir(busca) {
      return `${linkPara('resultados')}?${busca.parametros}`;
    },

    // Editar nome
    abrirEdicao(busca) {
      this.edicao = { id: busca.idBuscaSalva, nome: busca.nome, erro: '', salvando: false };
      this.$nextTick(() => {
        this.$refs.painelEdicao?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.$refs.campoNome?.select();
      });
    },
    fecharEdicao() {
      const id = this.edicao.id;
      this.edicao = { id: null, nome: '', erro: '', salvando: false };
      this.$nextTick(() => document.querySelector(`[data-editar="${id}"]`)?.focus());
    },
    get buscaEmEdicao() {
      return this.buscas.find((b) => b.idBuscaSalva === this.edicao.id);
    },
    async salvarNome() {
      const nome = this.edicao.nome.trim();
      if (!nome) {
        this.edicao.erro = 'Dê um nome para a busca.';
        this.$refs.campoNome?.focus();
        return;
      }
      this.edicao.salvando = true;
      this.edicao.erro = '';
      try {
        const atualizada = await renomearBuscaSalva(this.edicao.id, nome);
        const busca = this.buscaEmEdicao;
        if (busca) busca.nome = atualizada?.nome || nome;
        mostrarAviso({ tipo: 'sucesso', texto: 'Nome da busca atualizado.' });
        this.fecharEdicao();
      } catch (erro) {
        if (this.tratarErro(erro)) return;
        const doCampo = (erro?.campos || []).find((c) => c.campo === 'nome');
        this.edicao.erro = doCampo?.mensagem || erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.edicao.salvando = false;
      }
    },

    // Remover (com confirmação)
    pedirRemocao(busca) {
      this.remocao = { busca, removendo: false };
      this.$nextTick(() => this.$refs.cancelarRemocao?.focus());
    },
    fecharRemocao() {
      this.remocao = { busca: null, removendo: false };
    },
    async confirmarRemocao() {
      const busca = this.remocao.busca;
      this.remocao.removendo = true;
      try {
        await removerBuscaSalva(busca.idBuscaSalva);
        this.buscas = this.buscas.filter((b) => b.idBuscaSalva !== busca.idBuscaSalva);
        if (this.edicao.id === busca.idBuscaSalva) this.edicao = { id: null, nome: '', erro: '', salvando: false };
        mostrarAviso({ tipo: 'sucesso', texto: `Busca removida: ${busca.nome}.` });
        this.fecharRemocao();
        this.$refs.tituloBuscas.focus();
      } catch (erro) {
        if (this.tratarErro(erro)) return;
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
        this.remocao.removendo = false;
      }
    },

    // ---------- Links ----------

    get linkResultados() {
      return linkPara('resultados');
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('favoritosBuscas', paginaFavoritos);
});