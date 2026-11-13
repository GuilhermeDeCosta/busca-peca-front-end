// Tela: minha-loja/configuracoes.html — Editar loja (logo, banner, descrição) e configurações
// Acesso: vendedor. Casos de uso: BP1-14, 18, 55. Rotas: /api/lojas/minha e sub-rotas.
import { obterMinhaLoja, salvarConfiguracoes, pausarLoja, reativarLoja } from '../../services/lojas.js';
import { somenteDigitos, mascararTelefone, mascararCep, mascararCnpj, mascararCpf, mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras.js';
import { validarCep, validarTelefone } from '../../utils/validacoes.js';
// import { exigirPapel } from '../../auth.js'; // ativar quando auth.js existir

const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024; // 5 MB
const TIPOS_IMAGEM = ['image/jpeg', 'image/png'];
const BANNER_LARGURA_MINIMA = 1200; // recomendado 1600 × 400; abaixo disso só avisa
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB',
  'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const RAIOS_FRETE = [
  { valor: '', texto: 'Não ofereço frete grátis' },
  { valor: '3', texto: 'Até 3 km' },
  { valor: '5', texto: 'Até 5 km' },
  { valor: '10', texto: 'Até 10 km' },
  { valor: '15', texto: 'Até 15 km' },
  { valor: '20', texto: 'Até 20 km' },
  { valor: '30', texto: 'Até 30 km' },
];

// Formas de pagamento da tela -> valores da API (Cartão na loja = crédito e débito)
const FORMAS_PAGAMENTO = [
  { valor: 'PIX', texto: 'Pix', api: ['PIX'] },
  { valor: 'FATURADO', texto: 'Boleto para CNPJ (faturado)', api: ['FATURADO'] },
  { valor: 'CARTAO', texto: 'Cartão na loja', api: ['CARTAO_CREDITO', 'CARTAO_DEBITO'] },
  { valor: 'DINHEIRO', texto: 'Dinheiro no balcão', api: ['DINHEIRO'] },
];

// Nome do campo na API -> id do campo na tela
const CAMPOS_API = {
  nomeLoja: 'nomeLoja', descricao: 'descricao', telefone: 'telefone',
  'endereco.cep': 'cep', 'endereco.logradouro': 'logradouro', 'endereco.numero': 'numero',
  'endereco.bairro': 'bairro', 'endereco.cidade': 'cidade', 'endereco.estado': 'estado',
  horarioRetirada: 'horarioRetirada', pedidoMinimoFreteGratis: 'pedidoMinimo', metodosPagamento: 'metodosPagamento',
};
const ORDEM_CAMPOS = ['nomeLoja', 'descricao', 'telefone', 'cep', 'cidade', 'estado', 'logradouro', 'numero', 'bairro',
  'atendimento', 'horarioRetirada', 'pedidoMinimo', 'metodosPagamento'];

function lerDimensoes(url) {
  return new Promise((resolver) => {
    const imagem = new Image();
    imagem.onload = () => resolver({ largura: imagem.naturalWidth, altura: imagem.naturalHeight });
    imagem.onerror = () => resolver(null);
    imagem.src = url;
  });
}

function paginaConfiguracoes() {
  return {
    ufs: UFS,
    raios: RAIOS_FRETE,
    formasPagamento: FORMAS_PAGAMENTO,

    carregando: true,
    erroCarregar: '',
    loja: null,
    form: null,
    erros: {},
    sujo: false,
    salvando: false,
    resultado: null, // { tipo: 'sucesso' | 'erro' | 'arquivo', titulo, texto }
    editandoEndereco: false,

    // Imagens: { url (o que aparece), arquivo (File novo), remover (bool) }
    logo: { url: null, arquivo: null, remover: false },
    banner: { url: null, arquivo: null, remover: false },
    avisoBanner: '',
    arrastandoBanner: false,

    mudandoStatus: false,
    confirmacao: { aberta: false, titulo: '', texto: '', botao: '', aoConfirmar: null },

    async init() {
      // await exigirPapel('VENDEDOR');
      try {
        this.preencher(await obterMinhaLoja());
      } catch (erro) {
        this.erroCarregar = erro?.mensagem || ERRO_GENERICO;
      } finally {
        this.carregando = false;
      }
      this.$watch('form', () => { this.sujo = true; });
      window.addEventListener('beforeunload', (evento) => {
        if (this.sujo) evento.preventDefault();
      });
    },

    // Converte a loja da API para os campos do formulário
    preencher(loja) {
      this.loja = loja;
      const metodos = loja.metodosPagamento || [];
      this.form = {
        nomeLoja: loja.nomeLoja || '',
        descricao: loja.descricao || '',
        telefone: mascararTelefone(loja.telefone || ''),
        cep: mascararCep(loja.endereco?.cep || ''),
        logradouro: loja.endereco?.logradouro || '',
        numero: loja.endereco?.numero || '',
        bairro: loja.endereco?.bairro || '',
        cidade: loja.endereco?.cidade || loja.cidade || '',
        estado: loja.endereco?.estado || loja.estado || '',
        retiradaBalcao: Boolean(loja.retiradaBalcao),
        horarioRetirada: loja.horarioRetirada || '',
        entregaCombinar: Boolean(loja.entregaCombinar),
        entregaRapida: Boolean(loja.entregaRapida),
        raioFrete: loja.freteGratisRaioKm != null ? String(Number(loja.freteGratisRaioKm)) : '',
        pedidoMinimo: numeroParaMoeda(loja.pedidoMinimoFreteGratis),
        pagamentos: FORMAS_PAGAMENTO
          .filter((f) => f.api.some((valor) => metodos.includes(valor)))
          .map((f) => f.valor),
      };
      // Raio que não está na lista (ex.: 7.5 km) ganha uma opção própria
      if (this.form.raioFrete && !RAIOS_FRETE.some((r) => r.valor === this.form.raioFrete)) {
        this.raios = [...RAIOS_FRETE, { valor: this.form.raioFrete, texto: `Até ${this.form.raioFrete.replace('.', ',')} km` }];
      }
      this.limparImagem(this.logo, loja.logoUrl);
      this.limparImagem(this.banner, loja.bannerUrl);
      this.avisoBanner = '';
      this.editandoEndereco = false;
      this.$nextTick(() => { this.sujo = false; });
    },

    limparImagem(imagem, url) {
      if (imagem.arquivo && imagem.url?.startsWith('blob:')) URL.revokeObjectURL(imagem.url);
      imagem.url = url || null;
      imagem.arquivo = null;
      imagem.remover = false;
    },

    // ----- Textos -----
    get inicialLoja() {
      return (this.form?.nomeLoja.trim()[0] || 'L').toUpperCase();
    },
    get documentoFormatado() {
      const doc = this.loja?.cnpjCpf || '';
      return doc.length === 14 ? mascararCnpj(doc) : mascararCpf(doc);
    },
    get rotuloDocumento() {
      return this.loja?.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ';
    },
    get resumoEndereco() {
      const f = this.form;
      if (!f) return '';
      const rua = [f.logradouro, f.numero].filter(Boolean).join(', ');
      const local = f.cidade && f.estado ? `${f.cidade}/${f.estado}` : f.cidade;
      return [rua, f.bairro, local, f.cep && `CEP ${f.cep}`].filter(Boolean).join(' • ');
    },
    get temFreteGratis() {
      return this.form?.raioFrete !== '';
    },

    // ----- Máscaras -----
    aoDigitarTelefone(evento) {
      this.form.telefone = evento.target.value = mascararTelefone(evento.target.value);
      delete this.erros.telefone;
    },
    aoDigitarCep(evento) {
      this.form.cep = evento.target.value = mascararCep(evento.target.value);
      delete this.erros.cep;
    },
    aoDigitarPedidoMinimo(evento) {
      this.form.pedidoMinimo = evento.target.value = mascararMoeda(evento.target.value);
      delete this.erros.pedidoMinimo;
    },
    limparErro(campo) {
      delete this.erros[campo];
    },
    abrirEdicaoEndereco() {
      this.editandoEndereco = true;
      this.$nextTick(() => document.getElementById('cep')?.focus());
    },

    // ----- Logo e banner -----
    validarArquivo(arquivo) {
      if (!TIPOS_IMAGEM.includes(arquivo.type) || arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
        this.resultado = { tipo: 'arquivo', titulo: 'Arquivo não aceito', texto: 'Use JPG ou PNG com até 5 MB.' };
        return false;
      }
      if (this.resultado?.tipo === 'arquivo') this.resultado = null;
      return true;
    },
    escolher(id) {
      document.getElementById(id)?.click();
    },
    aoEscolherLogo(evento) {
      const arquivo = evento.target.files?.[0];
      evento.target.value = '';
      if (!arquivo || !this.validarArquivo(arquivo)) return;
      this.trocarImagem(this.logo, arquivo);
    },
    removerLogo() {
      this.removerImagem(this.logo);
    },
    async aoEscolherBanner(evento) {
      const arquivo = evento.target.files?.[0];
      evento.target.value = '';
      await this.receberBanner(arquivo);
    },
    async aoSoltarBanner(evento) {
      this.arrastandoBanner = false;
      await this.receberBanner(evento.dataTransfer?.files?.[0]);
    },
    async receberBanner(arquivo) {
      if (!arquivo || !this.validarArquivo(arquivo)) return;
      this.trocarImagem(this.banner, arquivo);
      const dimensoes = await lerDimensoes(this.banner.url);
      this.avisoBanner = dimensoes && dimensoes.largura < BANNER_LARGURA_MINIMA
        ? `A imagem tem ${dimensoes.largura} × ${dimensoes.altura} px e pode ficar borrada. O ideal é 1600 × 400 px.`
        : '';
    },
    removerBanner() {
      this.removerImagem(this.banner);
      this.avisoBanner = '';
    },
    trocarImagem(imagem, arquivo) {
      if (imagem.arquivo && imagem.url?.startsWith('blob:')) URL.revokeObjectURL(imagem.url);
      imagem.arquivo = arquivo;
      imagem.url = URL.createObjectURL(arquivo);
      imagem.remover = false;
      this.sujo = true;
    },
    removerImagem(imagem) {
      if (imagem.arquivo && imagem.url?.startsWith('blob:')) URL.revokeObjectURL(imagem.url);
      imagem.arquivo = null;
      imagem.url = null;
      imagem.remover = true;
      this.sujo = true;
    },

    // ----- Validação (a API confere tudo de novo) -----
    validar() {
      const f = this.form;
      const e = {};
      if (!f.nomeLoja.trim()) e.nomeLoja = 'Informe o nome da loja.';
      else if (f.nomeLoja.trim().length < 3) e.nomeLoja = 'Use pelo menos 3 caracteres.';
      if (!f.telefone) e.telefone = 'Informe o telefone da loja.';
      else if (!validarTelefone(f.telefone)) e.telefone = 'Telefone com DDD, ex.: (19) 90000-0101.';

      if (!validarCep(f.cep)) e.cep = 'CEP deve ter 8 números.';
      if (!f.cidade.trim()) e.cidade = 'Informe a cidade.';
      if (!f.estado) e.estado = 'Escolha a UF.';
      if (!f.logradouro.trim()) e.logradouro = 'Preencha este campo.';
      if (!f.numero.trim()) e.numero = 'Preencha este campo.';
      if (!f.bairro.trim()) e.bairro = 'Preencha este campo.';
      if (['cep', 'cidade', 'estado', 'logradouro', 'numero', 'bairro'].some((c) => e[c])) this.editandoEndereco = true;

      if (!f.retiradaBalcao && !f.entregaCombinar && !f.entregaRapida) e.atendimento = 'Marque pelo menos uma forma de receber a peça.';
      if (f.retiradaBalcao && !f.horarioRetirada.trim()) e.horarioRetirada = 'Informe o horário de retirada.';
      if (!f.pagamentos.length) e.metodosPagamento = 'Marque pelo menos uma forma de pagamento.';
      return e;
    },

    montarDados() {
      const f = this.form;
      return {
        nomeLoja: f.nomeLoja.trim(),
        descricao: f.descricao.trim() || null,
        telefone: somenteDigitos(f.telefone),
        endereco: {
          cep: somenteDigitos(f.cep), logradouro: f.logradouro.trim(), numero: f.numero.trim(),
          bairro: f.bairro.trim(), cidade: f.cidade.trim(), estado: f.estado,
        },
        retiradaBalcao: f.retiradaBalcao,
        horarioRetirada: f.retiradaBalcao ? f.horarioRetirada.trim() : null,
        entregaCombinar: f.entregaCombinar,
        entregaRapida: f.entregaRapida,
        freteGratisRaioKm: f.raioFrete === '' ? null : Number(f.raioFrete),
        pedidoMinimoFreteGratis: f.raioFrete === '' ? null : moedaParaNumero(f.pedidoMinimo),
      };
    },

    async salvar() {
      if (this.salvando || !this.sujo) return;
      this.erros = this.validar();
      if (Object.keys(this.erros).length) {
        this.resultado = { tipo: 'erro', titulo: 'Não foi possível salvar', texto: 'Revise os campos destacados.' };
        this.focarPrimeiroErro();
        return;
      }

      this.salvando = true;
      this.resultado = null;
      try {
        const metodosPagamento = FORMAS_PAGAMENTO
          .filter((f) => this.form.pagamentos.includes(f.valor))
          .flatMap((f) => f.api);
        const loja = await salvarConfiguracoes({
          dados: this.montarDados(),
          metodosPagamento,
          logo: { arquivo: this.logo.arquivo, remover: this.logo.remover },
          banner: { arquivo: this.banner.arquivo, remover: this.banner.remover },
        });
        this.preencher(loja);
        this.resultado = { tipo: 'sucesso', titulo: 'Alterações salvas', texto: 'As mudanças já aparecem na página pública.' };
      } catch (erro) {
        const errosApi = {};
        (erro?.campos || []).forEach(({ campo, mensagem }) => {
          if (CAMPOS_API[campo]) errosApi[CAMPOS_API[campo]] = mensagem;
        });
        this.erros = errosApi;
        if (['cep', 'cidade', 'estado', 'logradouro', 'numero', 'bairro'].some((c) => errosApi[c])) this.editandoEndereco = true;
        this.resultado = erro?.status === 413
          ? { tipo: 'arquivo', titulo: 'Arquivo não aceito', texto: 'Use JPG ou PNG com até 5 MB.' }
          : { tipo: 'erro', titulo: 'Não foi possível salvar', texto: erro?.mensagem || ERRO_GENERICO };
        this.focarPrimeiroErro();
      } finally {
        this.salvando = false;
      }
    },

    focarPrimeiroErro() {
      this.$nextTick(() => {
        const primeiro = ORDEM_CAMPOS.find((campo) => this.erros[campo]);
        const alvo = { atendimento: 'retiradaBalcao', metodosPagamento: 'pag-PIX' }[primeiro] || primeiro;
        const elemento = alvo && document.getElementById(alvo);
        if (elemento) {
          elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
          elemento.focus({ preventScroll: true });
        } else {
          document.getElementById('resultado-salvar')?.focus();
        }
      });
    },

    // ----- Status da loja (vale na hora, sem precisar salvar) -----
    pedirPausa() {
      this.abrirConfirmacao({
        titulo: 'Pausar a loja?',
        texto: 'Seus anúncios saem da busca e novos pedidos ficam bloqueados. Pedidos em andamento continuam. Você pode reativar quando quiser.',
        botao: 'Pausar loja',
        aoConfirmar: () => this.mudarStatus(pausarLoja),
      });
    },
    reativar() {
      this.mudarStatus(reativarLoja);
    },
    async mudarStatus(acao) {
      this.mudandoStatus = true;
      try {
        const loja = await acao();
        this.loja.ativa = loja.ativa;
      } catch (erro) {
        this.resultado = { tipo: 'erro', titulo: 'Não foi possível mudar o status', texto: erro?.mensagem || ERRO_GENERICO };
      } finally {
        this.mudandoStatus = false;
      }
    },

    // ----- Janela de confirmação -----
    abrirConfirmacao(opcoes) {
      this.elementoAntesDaJanela = document.activeElement;
      this.confirmacao = { aberta: true, ...opcoes };
      this.$nextTick(() => document.getElementById('botao-confirmar')?.focus());
    },
    fecharConfirmacao() {
      this.confirmacao.aberta = false;
      this.elementoAntesDaJanela?.focus?.();
    },
    confirmar() {
      const acao = this.confirmacao.aoConfirmar;
      this.fecharConfirmacao();
      acao?.();
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('configuracoesLoja', paginaConfiguracoes);
});