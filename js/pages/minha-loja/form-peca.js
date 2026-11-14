// Tela: minha-loja/form-peca.html — Cadastrar peça manualmente (4 etapas)
// Também edita: form-peca.html?id=123 (link "Editar" do painel).
// Ao editar um anúncio publicado, permite pausar e reativar (BP1-46).
// Ao editar um anúncio ou rascunho já salvo, permite excluir (com confirmação).
// Acesso: vendedor. Casos de uso: BP1-3, 9, 45, 46, 47, 63.
import { obterMinhaLoja } from '../../services/lojas.js';
import { consultarReferencia, obterPecaParaEdicao, salvarAnuncio, pausarAnuncio, reativarAnuncio, excluirAnuncio } from '../../services/pecas.js';
import { listarCategorias, listarMarcasVeiculo, listarModelos, listarMarcasPeca } from '../../services/catalogo.js';
import { mascararMoeda, moedaParaNumero, numeroParaMoeda, somenteDigitos } from '../../utils/mascaras.js';
import { formatarMoeda, pluralizarDiasUteis } from '../../utils/formatacao.js';
import { confirmacaoStatus, mensagemSucessoStatus, avisoErroStatus, confirmacaoExclusao } from '../../utils/status-anuncio.js';
// import { exigirPapel } from '../../auth.js'; // ativar quando auth.js existir

const FOTOS_MINIMAS = 5; // BP1-47: pelo menos cinco fotos
const FOTOS_MAXIMAS = 5; // limite do protótipo; aumente aqui se a regra mudar
const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024; // 5 MB
const TIPOS_FOTO = ['image/jpeg', 'image/png'];
const ROTULOS_FOTOS = ['Capa', 'Vista traseira', 'Conector', 'Código', 'Embalagem'];
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';

export const CONDICOES = [
  { valor: 'NOVA', texto: 'Novo' },
  { valor: 'USADA', texto: 'Usado' },
  { valor: 'RECONDICIONADA', texto: 'Recondicionado' },
];
export const ORIGENS = [
  { valor: 'NACIONAL', texto: 'Nacional' },
  { valor: 'IMPORTADA', texto: 'Importado' },
];
const PRAZOS = [
  { valor: 0, texto: 'Mesmo dia' },
  { valor: 1, texto: '1 dia útil' },
  { valor: 2, texto: '2 dias úteis' },
  { valor: 3, texto: '3 dias úteis' },
  { valor: 5, texto: '5 dias úteis' },
  { valor: 7, texto: '7 dias úteis' },
];

// Nome do campo na API -> id do campo na tela (para marcar os erros que a API devolver)
const CAMPOS_API = {
  titulo: 'titulo', descricao: 'descricao', idCategoria: 'idCategoria', marcaPeca: 'marcaPeca',
  codigoOem: 'codigoOem', codigoEan: 'codigoEan', codigoSku: 'codigoSku', caracteristicas: 'caracteristicas',
  condicao: 'condicao', origem: 'origem', preco: 'preco', quantidadeEstoque: 'quantidade',
  prazoExpedicaoDias: 'prazoExpedicaoDias', aplicacoes: 'aplicacoes', fotos: 'fotos',
};

// Ordem dos campos na tela, para levar o foco ao primeiro com erro
const ORDEM_CAMPOS = ['titulo', 'descricao', 'idCategoria', 'marcaPeca', 'codigoOem', 'codigoEan', 'codigoSku',
  'caracteristicas', 'condicao', 'origem', 'aplicacoes', 'preco', 'quantidade', 'prazoExpedicaoDias', 'fotos'];

let proximoIdLocal = 1;

function formularioVazio() {
  return {
    titulo: '',
    descricao: '',
    idCategoria: '',
    marcaPeca: '',
    codigoOem: '',
    codigoEan: '',
    codigoSku: '',
    caracteristicas: '',
    condicao: 'NOVA',
    origem: 'NACIONAL',
    preco: '',
    quantidade: '',
    disponibilidade: 'PRONTA',
    prazoExpedicaoDias: 1,
    ativarAposPublicar: true,
  };
}

function paginaFormPeca() {
  return {
    // Opções dos selects
    condicoes: CONDICOES,
    origens: ORIGENS,
    prazos: PRAZOS,
    categorias: [],
    marcasPeca: [],
    marcasVeiculo: [],
    modelos: [],
    fotosMaximas: FOTOS_MAXIMAS,
    fotosMinimas: FOTOS_MINIMAS,

    // Estado geral
    loja: null,
    idPeca: null,
    carregando: true,
    erroCarregar: '',
    form: formularioVazio(),
    erros: {},
    sujo: false,
    salvando: null, // 'rascunho' | 'publicar'
    salvoEm: null,
    statusSalvo: null, // RASCUNHO | ATIVO | PAUSADO
    publicado: false,
    avisoGeral: null, // { tipo: 'erro' | 'sucesso', texto }
    etapaAtual: 1,

    // Etapa 1: consulta pelo código
    consulta: { tipo: 'OEM', codigo: '', estado: '', resumo: '' }, // estado: buscando | encontrado | nao-encontrado | indisponivel

    // Compatibilidade
    novaAplicacao: { marca: '', modelo: '', anoInicial: '', anoFinal: '', versao: '' },
    aplicacoes: [],
    carregandoModelos: false,
    errosAplicacao: {},

    // Fotos: { id, idFoto (do servidor), arquivo (File novo), url }
    fotos: [],
    fotosRemovidas: [],
    arrastando: false,
    erroFotos: '',

    // Confirmação
    confirmacao: { aberta: false, titulo: '', texto: '', botao: '', botaoCancelar: 'Cancelar', estilo: 'perigo', aoConfirmar: null },

    // Pausar e reativar (BP1-46)
    mudandoStatus: false,
    avisoStatus: null, // { tipo: 'sucesso' | 'erro', texto, link? }
    excluindo: false,

    async init() {
      // Quando auth.js existir: só vendedor (sem loja vai para criar-loja.html).
      // await exigirPapel('VENDEDOR');
      this.idPeca = new URLSearchParams(location.search).get('id');

      try {
        const [loja, categorias, marcasPeca, marcasVeiculo] = await Promise.all([
          obterMinhaLoja(), listarCategorias(), listarMarcasPeca(), listarMarcasVeiculo(),
        ]);
        this.loja = loja;
        this.categorias = categorias;
        this.marcasPeca = marcasPeca;
        this.marcasVeiculo = marcasVeiculo;
        if (this.idPeca) await this.carregarPeca();
      } catch (erro) {
        this.erroCarregar = erro?.status === 404 ? 'Anúncio não encontrado.' : (erro?.mensagem || ERRO_GENERICO);
      } finally {
        this.carregando = false;
      }

      this.$watch('form', () => { this.sujo = true; });
      this.$watch('aplicacoes', () => { this.sujo = true; });
      this.$watch('fotos', () => { this.sujo = true; });
      window.addEventListener('beforeunload', (evento) => {
        if (this.sujo && !this.publicado) evento.preventDefault();
      });
      this.$nextTick(() => {
        this.observarEtapas();
        // Vindo do painel por "Atualizar estoque" (form-peca.html?id=X#secao-estoque)
        if (location.hash === '#secao-estoque' && !this.erroCarregar) this.irParaEstoque();
      });
    },

    async carregarPeca() {
      const { dados, aplicacoes, fotos } = await obterPecaParaEdicao(this.idPeca);
      this.form = {
        ...formularioVazio(),
        ...Object.fromEntries(Object.entries(dados).filter(([chave]) => chave in formularioVazio())),
        idCategoria: dados.idCategoria ?? '',
        preco: numeroParaMoeda(dados.preco),
        quantidade: dados.quantidadeEstoque ?? '',
        disponibilidade: dados.prontaEntrega === false ? 'ENCOMENDA' : 'PRONTA',
        prazoExpedicaoDias: dados.prazoExpedicaoDias ?? 1,
        ativarAposPublicar: dados.status !== 'PAUSADO',
      };
      this.aplicacoes = aplicacoes.map((a) => ({ ...a, id: proximoIdLocal++ }));
      this.fotos = fotos.map((f) => ({ id: proximoIdLocal++, idFoto: f.idFoto, arquivo: null, url: f.url }));
      this.statusSalvo = dados.status;
      this.salvoEm = dados.atualizadoEm;
      this.$nextTick(() => { this.sujo = false; });
    },

    // ----- Etapas -----
    get etapas() {
      const f = this.form;
      return [
        { numero: 1, nome: 'Identificação', alvo: 'secao-identificacao', completa: Boolean(f.codigoOem || f.codigoEan || f.codigoSku) },
        { numero: 2, nome: 'Dados e aplicação', alvo: 'secao-informacoes', completa: Boolean(f.titulo && f.idCategoria && this.aplicacoes.length) },
        { numero: 3, nome: 'Estoque e preço', alvo: 'secao-estoque', completa: moedaParaNumero(f.preco) > 0 && f.quantidade !== '' },
        { numero: 4, nome: 'Fotos e publicação', alvo: 'secao-fotos', completa: this.fotos.length >= FOTOS_MINIMAS },
      ];
    },
    irParaEtapa(etapa) {
      document.getElementById(etapa.alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    observarEtapas() {
      if (!('IntersectionObserver' in window)) return;
      const observador = new IntersectionObserver((entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) this.etapaAtual = Number(visivel.target.dataset.etapa);
      }, { rootMargin: '-15% 0px -60% 0px' });
      document.querySelectorAll('[data-etapa]').forEach((secao) => observador.observe(secao));
    },

    // ----- Etapa 1: consulta pelo código -----
    normalizarCodigo(tipo, valor) {
      if (tipo === 'EAN') return somenteDigitos(valor).slice(0, 14);
      // OEM é gravado em maiúsculas, sem espaços, pontos ou hífens
      if (tipo === 'OEM') return valor.toUpperCase().replace(/[\s.\-]/g, '').slice(0, 50);
      return valor.toUpperCase().trim().slice(0, 50);
    },
    aoDigitarCodigoConsulta(evento) {
      this.consulta.codigo = evento.target.value = this.normalizarCodigo(this.consulta.tipo, evento.target.value);
      delete this.erros.consulta;
    },
    async buscarPorCodigo() {
      const { tipo, codigo } = this.consulta;
      if (!codigo) {
        this.erros.consulta = 'Digite o código para buscar.';
        document.getElementById('codigoConsulta')?.focus();
        return;
      }
      if (tipo === 'EAN' && ![8, 12, 13, 14].includes(codigo.length)) {
        this.erros.consulta = 'EAN deve ter 8, 12, 13 ou 14 números.';
        document.getElementById('codigoConsulta')?.focus();
        return;
      }
      delete this.erros.consulta;
      this.consulta.estado = 'buscando';

      // O código fica no formulário em qualquer resultado (BP1-63, fluxo alternativo)
      const campo = { OEM: 'codigoOem', EAN: 'codigoEan', SKU: 'codigoSku' }[tipo];
      this.form[campo] = codigo;

      try {
        const referencia = await consultarReferencia(tipo, codigo);
        if (!referencia) {
          this.consulta.estado = 'nao-encontrado';
          return;
        }
        this.aplicarReferencia(referencia);
        this.consulta.resumo = referencia.titulo;
        this.consulta.estado = 'encontrado';
      } catch {
        this.consulta.estado = 'indisponivel';
      }
    },
    aplicarReferencia(ref) {
      // Preenche só o que ainda está vazio, para não apagar o que o vendedor já digitou
      const campos = ['titulo', 'descricao', 'idCategoria', 'marcaPeca', 'codigoOem', 'codigoEan', 'caracteristicas', 'condicao', 'origem'];
      campos.forEach((campo) => {
        const vazio = this.form[campo] === '' || this.form[campo] == null;
        const padrao = (campo === 'condicao' || campo === 'origem') && this.form[campo] === formularioVazio()[campo];
        if ((vazio || padrao) && ref[campo]) this.form[campo] = ref[campo];
      });
      (ref.aplicacoes || []).forEach((a) => {
        if (!this.aplicacaoRepetida(a)) this.aplicacoes.push({ ...a, id: proximoIdLocal++ });
      });
      this.erros = {};
    },
    continuarManual() {
      document.getElementById('secao-informacoes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => document.getElementById('titulo')?.focus({ preventScroll: true }), 400);
    },

    // ----- Etapa 2: dados -----
    get categoriasAgrupadas() {
      return this.categorias.filter((c) => c.subcategorias?.length);
    },
    nomeCategoria(id) {
      for (const c of this.categorias) {
        if (c.idCategoria === Number(id)) return c.nome;
        const sub = c.subcategorias?.find((s) => s.idCategoria === Number(id));
        if (sub) return `${c.nome} / ${sub.nome}`;
      }
      return '';
    },
    aoDigitarCodigo(campo, tipo, evento) {
      this.form[campo] = evento.target.value = this.normalizarCodigo(tipo, evento.target.value);
      delete this.erros[campo];
    },
    limparErro(campo) {
      delete this.erros[campo];
    },

    // ----- Compatibilidade -----
    async aoTrocarMarcaVeiculo() {
      this.novaAplicacao.modelo = '';
      this.modelos = [];
      if (!this.novaAplicacao.marca) return;
      this.carregandoModelos = true;
      try {
        this.modelos = await listarModelos(this.novaAplicacao.marca);
      } catch {
        this.errosAplicacao.modelo = 'Não foi possível carregar os modelos.';
      } finally {
        this.carregandoModelos = false;
      }
    },
    aplicacaoRepetida(a) {
      return this.aplicacoes.some((x) => x.marca === a.marca && x.modelo === a.modelo
        && Number(x.anoInicial) === Number(a.anoInicial) && Number(x.anoFinal) === Number(a.anoFinal)
        && (x.versao || '').trim().toLowerCase() === (a.versao || '').trim().toLowerCase());
    },
    adicionarAplicacao() {
      const a = this.novaAplicacao;
      const e = {};
      const anoMaximo = new Date().getFullYear() + 1;
      const inicial = Number(a.anoInicial);
      const final = Number(a.anoFinal || a.anoInicial);

      if (!a.marca) e.marca = 'Escolha a marca.';
      if (!a.modelo) e.modelo = 'Escolha o modelo.';
      if (!a.anoInicial) e.ano = 'Informe o ano inicial.';
      else if (inicial < 1950 || inicial > anoMaximo || final < 1950 || final > anoMaximo) e.ano = `Use anos entre 1950 e ${anoMaximo}.`;
      else if (final < inicial) e.ano = 'O ano final não pode ser menor que o inicial.';

      this.errosAplicacao = e;
      if (Object.keys(e).length) return;

      const aplicacao = { marca: a.marca, modelo: a.modelo, anoInicial: inicial, anoFinal: final, versao: a.versao.trim() };
      if (this.aplicacaoRepetida(aplicacao)) {
        this.errosAplicacao = { geral: 'Essa aplicação já está na lista.' };
        return;
      }
      this.aplicacoes.push({ ...aplicacao, id: proximoIdLocal++ });
      delete this.erros.aplicacoes;
      this.novaAplicacao = { marca: a.marca, modelo: '', anoInicial: '', anoFinal: '', versao: '' };
      this.$nextTick(() => document.getElementById('modeloVeiculo')?.focus());
    },
    removerAplicacao(aplicacao) {
      this.aplicacoes = this.aplicacoes.filter((a) => a.id !== aplicacao.id);
    },
    textoAnos(a) {
      return a.anoInicial === a.anoFinal ? String(a.anoInicial) : `${a.anoInicial}–${a.anoFinal}`;
    },

    // ----- Etapa 3: preço e estoque -----
    aoDigitarPreco(evento) {
      this.form.preco = evento.target.value = mascararMoeda(evento.target.value);
      delete this.erros.preco;
    },
    aoDigitarQuantidade(evento) {
      const valor = somenteDigitos(evento.target.value).slice(0, 6);
      this.form.quantidade = evento.target.value = valor;
      delete this.erros.quantidade;
    },

    // ----- Etapa 4: fotos -----
    get vagasFotos() {
      return Math.max(0, FOTOS_MAXIMAS - this.fotos.length);
    },
    get resumoFotos() {
      const n = this.fotos.length;
      return `${n} de ${FOTOS_MINIMAS} fotos adicionadas. A primeira será a capa. Mostre a peça inteira, conectores, código e embalagem.`;
    },
    rotuloFoto(indice) {
      return ROTULOS_FOTOS[indice] || `Foto ${indice + 1}`;
    },
    escolherArquivos() {
      document.getElementById('entradaFotos')?.click();
    },
    aoSelecionarArquivos(evento) {
      this.adicionarArquivos(evento.target.files);
      evento.target.value = ''; // permite escolher o mesmo arquivo de novo
    },
    aoSoltarArquivos(evento) {
      this.arrastando = false;
      this.adicionarArquivos(evento.dataTransfer?.files);
    },
    adicionarArquivos(lista) {
      const arquivos = Array.from(lista || []);
      if (!arquivos.length) return;
      const recusados = [];
      let adicionados = 0;

      for (const arquivo of arquivos) {
        if (!TIPOS_FOTO.includes(arquivo.type)) { recusados.push(`${arquivo.name}: use JPG ou PNG`); continue; }
        if (arquivo.size > TAMANHO_MAXIMO_FOTO) { recusados.push(`${arquivo.name}: acima de 5 MB`); continue; }
        if (this.fotos.length >= FOTOS_MAXIMAS) { recusados.push(`${arquivo.name}: limite de ${FOTOS_MAXIMAS} fotos`); continue; }
        this.fotos.push({ id: proximoIdLocal++, idFoto: null, arquivo, url: URL.createObjectURL(arquivo) });
        adicionados++;
      }
      this.erroFotos = recusados.length ? `Não adicionamos: ${recusados.join('; ')}.` : '';
      if (adicionados) delete this.erros.fotos;
    },
    removerFoto(foto) {
      if (foto.arquivo) URL.revokeObjectURL(foto.url);
      if (foto.idFoto) this.fotosRemovidas.push(foto.idFoto);
      this.fotos = this.fotos.filter((f) => f.id !== foto.id);
      this.erroFotos = '';
    },
    tornarCapa(foto) {
      this.fotos = [foto, ...this.fotos.filter((f) => f.id !== foto.id)];
    },

    // ----- Prévia -----
    get capaUrl() {
      return this.fotos[0]?.url || '';
    },
    get etiquetaPrevia() {
      const condicao = CONDICOES.find((c) => c.valor === this.form.condicao)?.texto;
      const origem = ORIGENS.find((o) => o.valor === this.form.origem)?.texto;
      return [condicao, origem].filter(Boolean).join(' • ');
    },
    get codigosPrevia() {
      const partes = [];
      if (this.form.codigoSku) partes.push(`SKU ${this.form.codigoSku}`);
      else if (this.form.codigoOem) partes.push(`OEM ${this.form.codigoOem}`);
      if (this.form.marcaPeca && this.form.marcaPeca !== 'Outra') partes.push(this.form.marcaPeca);
      return partes.join(' • ');
    },
    get precoPrevia() {
      const valor = moedaParaNumero(this.form.preco);
      return valor > 0 ? formatarMoeda(valor) : 'R$ --';
    },
    get notaLoja() {
      const nota = Number(this.loja?.avaliacaoMedia || 0);
      return nota > 0 ? `★ ${nota.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : 'Sem avaliações';
    },
    get estoquePrevia() {
      if (this.form.quantidade === '') return '';
      const qtd = Number(this.form.quantidade);
      if (qtd === 0) return 'Sem estoque';
      const entrega = this.form.disponibilidade === 'PRONTA'
        ? 'pronta entrega'
        : `envia em ${pluralizarDiasUteis(Number(this.form.prazoExpedicaoDias))}`;
      return `${qtd} em estoque • ${entrega}`;
    },

    // ----- Antes de publicar -----
    get checklist() {
      const f = this.form;
      return [
        { texto: 'Código e compatibilidade conferidos', ok: Boolean(f.codigoOem && this.aplicacoes.length) },
        { texto: 'Preço e estoque atualizados', ok: moedaParaNumero(f.preco) > 0 && f.quantidade !== '' },
        { texto: `${FOTOS_MINIMAS} fotos da peça adicionadas`, ok: this.fotos.length >= FOTOS_MINIMAS },
        { texto: 'Condição e origem informadas', ok: Boolean(f.condicao && f.origem) },
      ];
    },
    get textoSalvoEm() {
      if (!this.salvoEm) return '';
      const d = new Date(this.salvoEm);
      const data = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      const tipo = this.statusSalvo === 'RASCUNHO' ? 'Rascunho salvo' : 'Anúncio salvo';
      return `${tipo} em ${data}, às ${hora}.`;
    },

    // ----- Validação (a API confere tudo de novo) -----
    validar(publicar) {
      const f = this.form;
      const e = {};

      if (!f.titulo.trim()) e.titulo = 'Informe o título do anúncio.';
      else if (f.titulo.trim().length < 5) e.titulo = 'Use pelo menos 5 caracteres.';

      if (f.codigoEan && ![8, 12, 13, 14].includes(f.codigoEan.length)) e.codigoEan = 'EAN deve ter 8, 12, 13 ou 14 números.';

      if (!publicar) return e; // rascunho só precisa do título

      if (!f.idCategoria) e.idCategoria = 'Escolha a categoria.';
      if (!f.codigoOem) e.codigoOem = 'Informe o código OEM.';
      if (!f.condicao) e.condicao = 'Escolha a condição.';
      if (!f.origem) e.origem = 'Escolha a origem.';
      if (!this.aplicacoes.length) e.aplicacoes = 'Adicione pelo menos uma aplicação verificada.';
      if (!(moedaParaNumero(f.preco) > 0)) e.preco = 'Informe um preço maior que zero.';
      if (f.quantidade === '') e.quantidade = 'Informe a quantidade em estoque.';
      if (this.fotos.length < FOTOS_MINIMAS) {
        const faltam = FOTOS_MINIMAS - this.fotos.length;
        e.fotos = `Adicione mais ${faltam} ${faltam === 1 ? 'foto' : 'fotos'} para publicar.`;
      }
      return e;
    },

    // Corpo enviado à API: camelCase, preço em número
    montarDados() {
      const f = this.form;
      return {
        titulo: f.titulo.trim(),
        descricao: f.descricao.trim() || null,
        idCategoria: f.idCategoria ? Number(f.idCategoria) : null,
        marcaPeca: f.marcaPeca || null,
        codigoOem: f.codigoOem || null,
        codigoEan: f.codigoEan || null,
        codigoSku: f.codigoSku || null,
        caracteristicas: f.caracteristicas.trim() || null,
        condicao: f.condicao,
        origem: f.origem,
        preco: moedaParaNumero(f.preco),
        quantidadeEstoque: f.quantidade === '' ? 0 : Number(f.quantidade),
        prontaEntrega: f.disponibilidade === 'PRONTA',
        prazoExpedicaoDias: Number(f.prazoExpedicaoDias),
      };
    },

    async salvar(publicar) {
      if (this.salvando) return;
      this.avisoGeral = null;
      this.erros = this.validar(publicar);
      if (Object.keys(this.erros).length) {
        this.avisoGeral = {
          tipo: 'erro',
          texto: publicar
            ? 'Revise os campos destacados antes de publicar.'
            : 'Para salvar o rascunho, informe pelo menos o título.',
        };
        this.focarPrimeiroErro();
        return;
      }

      // Anúncio já publicado mantém o status atual: pausar e reativar ficam no card "Status do anúncio"
      let status = 'RASCUNHO';
      if (publicar) status = this.jaPublicado ? this.statusSalvo : (this.form.ativarAposPublicar ? 'ATIVO' : 'PAUSADO');
      this.salvando = publicar ? 'publicar' : 'rascunho';
      try {
        const resultado = await salvarAnuncio({
          idPeca: this.idPeca,
          dados: this.montarDados(),
          aplicacoes: this.aplicacoes.map(({ id, ...a }) => a),
          fotos: this.fotos.map(({ idFoto, arquivo }) => ({ idFoto, arquivo })),
          fotosRemovidas: [...this.fotosRemovidas],
          status,
        });
        this.idPeca = resultado.idPeca;
        this.salvoEm = resultado.salvoEm;
        this.statusSalvo = status;
        this.fotosRemovidas = [];
        this.sujo = false;
        history.replaceState(null, '', `?id=${encodeURIComponent(resultado.idPeca)}`);

        if (publicar) {
          this.publicado = true;
          this.$nextTick(() => document.getElementById('resultado-publicacao')?.focus());
        }
      } catch (erro) {
        this.tratarErroApi(erro);
      } finally {
        this.salvando = null;
      }
    },

    tratarErroApi(erro) {
      const errosApi = {};
      (erro?.campos || []).forEach(({ campo, mensagem }) => {
        const campoTela = CAMPOS_API[campo];
        if (campoTela) errosApi[campoTela] = mensagem;
      });
      this.erros = errosApi;
      const texto = erro?.status === 413
        ? 'Uma das fotos passou do tamanho máximo. Troque por uma imagem menor.'
        : (erro?.mensagem || ERRO_GENERICO);
      this.avisoGeral = { tipo: 'erro', texto };
      this.focarPrimeiroErro();
    },

    focarPrimeiroErro() {
      this.$nextTick(() => {
        const primeiro = ORDEM_CAMPOS.find((campo) => this.erros[campo]);
        const alvo = { aplicacoes: 'marcaVeiculo', fotos: 'botaoEscolherFotos' }[primeiro] || primeiro;
        const elemento = document.getElementById(alvo);
        if (elemento) {
          elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
          elemento.focus({ preventScroll: true });
        } else {
          document.getElementById('aviso-geral')?.focus();
        }
      });
    },

    // ----- Status do anúncio publicado (BP1-46) -----
    get jaPublicado() {
      return Boolean(this.idPeca) && (this.statusSalvo === 'ATIVO' || this.statusSalvo === 'PAUSADO');
    },
    get anuncioAtual() {
      return { idPeca: this.idPeca, titulo: this.form.titulo.trim() || 'Este anúncio', codigoSku: this.form.codigoSku };
    },
    pedirMudancaStatus(acao) {
      if (this.mudandoStatus || !this.jaPublicado) return;
      const confirmacao = confirmacaoStatus(acao, this.anuncioAtual);
      if (this.sujo) confirmacao.texto += ' As outras alterações deste formulário continuam sem salvar.';
      this.abrirConfirmacao({ ...confirmacao, aoConfirmar: () => this.mudarStatus(acao) });
    },
    async mudarStatus(acao) {
      this.mudandoStatus = true;
      this.avisoStatus = null;
      try {
        const resultado = await (acao === 'pausar' ? pausarAnuncio : reativarAnuncio)(this.idPeca);
        this.statusSalvo = resultado?.status || (acao === 'pausar' ? 'PAUSADO' : 'ATIVO');
        this.avisoStatus = { tipo: 'sucesso', texto: mensagemSucessoStatus(acao, this.anuncioAtual) };
      } catch (erro) {
        const aviso = avisoErroStatus(erro, this.anuncioAtual, `form-peca.html?id=${encodeURIComponent(this.idPeca)}`);
        this.avisoStatus = { tipo: 'erro', texto: aviso.texto, link: aviso.link };
        if (aviso.recarregar) await this.recarregarStatus();
      } finally {
        this.mudandoStatus = false;
      }
    },
    // Busca de novo só o status, sem mexer no que a pessoa está digitando
    async recarregarStatus() {
      try {
        const { dados } = await obterPecaParaEdicao(this.idPeca);
        this.statusSalvo = dados.status;
      } catch {
        // mantém o status que a tela já tinha
      }
    },
    irParaEstoque() {
      document.getElementById('secao-estoque')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => document.getElementById('quantidade')?.focus({ preventScroll: true }), 400);
    },

    // ----- Excluir anúncio ou rascunho já salvo -----
    get podeExcluir() {
      return Boolean(this.idPeca) && ['ATIVO', 'PAUSADO', 'RASCUNHO'].includes(this.statusSalvo) && !this.publicado;
    },
    get textoExcluir() {
      return this.statusSalvo === 'RASCUNHO' ? 'Excluir rascunho' : 'Excluir anúncio';
    },
    pedirExclusao() {
      if (!this.podeExcluir || this.excluindo) return;
      const anuncio = { ...this.anuncioAtual, status: this.statusSalvo };
      const confirmacao = confirmacaoExclusao(anuncio);
      this.abrirConfirmacao({
        ...confirmacao,
        focoNoCancelar: true, // ação sem volta: Enter não exclui por engano
        aoConfirmar: () => this.excluir(anuncio),
        alternativa: confirmacao.sugerePausar
          ? { texto: 'Pausar em vez disso', acao: () => this.mudarStatus('pausar') }
          : null,
      });
    },
    async excluir(anuncio) {
      this.excluindo = true;
      this.avisoGeral = null;
      try {
        await excluirAnuncio(this.idPeca);
        this.sujo = false; // não pergunta "sair sem salvar?" ao voltar para o painel
        const parametros = new URLSearchParams({ excluido: anuncio.titulo, tipo: anuncio.status });
        location.href = `painel.html?${parametros}`;
      } catch (erro) {
        const aviso = avisoErroStatus(erro, anuncio, `form-peca.html?id=${encodeURIComponent(this.idPeca)}`);
        const link = erro?.status === 404 ? { href: 'painel.html', texto: 'Voltar para Minha Loja' } : aviso.link;
        this.avisoGeral = { tipo: 'erro', texto: aviso.texto, link };
        this.$nextTick(() => document.getElementById('aviso-geral')?.focus());
        this.excluindo = false;
      }
    },

    // ----- Cancelar -----
    cancelar() {
      if (!this.sujo) {
        location.href = 'painel.html';
        return;
      }
      this.abrirConfirmacao({
        titulo: 'Sair sem salvar?',
        texto: 'As alterações que você fez desde o último salvamento serão perdidas.',
        botao: 'Sair sem salvar',
        botaoCancelar: 'Continuar editando',
        estilo: 'perigo',
        aoConfirmar: () => {
          this.sujo = false;
          location.href = 'painel.html';
        },
      });
    },
    abrirConfirmacao(opcoes) {
      this.elementoAntesDaJanela = document.activeElement;
      this.confirmacao = { aberta: true, botaoCancelar: 'Cancelar', estilo: 'perigo', alternativa: null, ...opcoes };
      this.$nextTick(() => document.getElementById(opcoes.focoNoCancelar ? 'botao-cancelar' : 'botao-confirmar')?.focus());
    },
    fecharConfirmacao() {
      this.confirmacao.aberta = false;
      this.elementoAntesDaJanela?.focus?.();
    },
    confirmar() {
      const acao = this.confirmacao.aoConfirmar;
      this.confirmacao.aberta = false;
      acao?.();
    },
    escolherAlternativa() {
      const acao = this.confirmacao.alternativa?.acao;
      this.fecharConfirmacao();
      acao?.();
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('formPeca', paginaFormPeca);
});