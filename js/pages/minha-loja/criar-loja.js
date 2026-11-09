// Tela: minha-loja/criar-loja.html — Criar loja e habilitar papel de vendedor (BP1-67)
// Acesso: logado e sem loja. Rota: POST /api/lojas
import { criarLoja, buscarEnderecoPorCep } from '../../services/lojas.js';
import { somenteDigitos, mascararCpf, mascararCnpj, mascararCep, mascararTelefone } from '../../utils/mascaras.js';
import { validarCpf, validarCnpj, validarCep, validarTelefone } from '../../utils/validacoes.js';
// import { exigirLogin } from '../../auth.js'; // ativar quando auth.js existir

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB',
  'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

// Mensagem do fluxo alternativo do caso de uso BP1-67
const MENSAGEM_ERRO_PADRAO = (tipo) =>
  `Revise o ${tipo} e o CEP e confirme o aceite dos termos do vendedor.`;

// Nome do campo na API -> nome do campo no formulário (para marcar em vermelho os campos que a API devolver)
const CAMPOS_API = {
  nomeLoja: 'nomeLoja',
  descricao: 'descricao',
  cnpjCpf: 'documento',
  telefone: 'telefone',
  'endereco.cep': 'cep',
  'endereco.cidade': 'cidade',
  'endereco.estado': 'estado',
  'endereco.logradouro': 'logradouro',
  'endereco.numero': 'numero',
  'endereco.bairro': 'bairro',
  metodosPagamento: 'metodosPagamento',
  aceiteTermos: 'aceiteTermos',
};

// Ordem dos campos na tela, para levar o foco ao primeiro com erro
const ORDEM_CAMPOS = ['nomeLoja', 'descricao', 'documento', 'telefone', 'cep', 'cidade', 'estado',
  'logradouro', 'numero', 'bairro', 'atendimento', 'metodosPagamento', 'aceiteTermos'];

function paginaCriarLoja() {
  return {
    ufs: UFS,
    form: {
      nomeLoja: '',
      descricao: '',
      tipoDocumento: 'CNPJ',
      documento: '',
      telefone: '',
      cep: '',
      cidade: '',
      estado: '',
      logradouro: '',
      numero: '',
      bairro: '',
      retiradaBalcao: true,
      entregaCombinar: true,
      motoboyProprio: false,
      metodosPagamento: ['PIX', 'FATURADO'],
      aceiteTermos: false, // LGPD: aceite nunca vem marcado (ADR-013)
    },
    erros: {},
    estado: 'formulario', // formulario | erro | sucesso
    mensagemErro: '',
    enviando: false,
    buscandoCep: false,
    lojaCriada: null,

    async init() {
      // Quando auth.js existir: só usuário logado e SEM loja pode ficar nesta tela.
      // const usuario = await exigirLogin();
      // if (usuario.temLoja) window.location.replace('painel.html');
    },

    // ----- Prévia -----
    get inicialLoja() {
      return (this.form.nomeLoja.trim()[0] || 'L').toUpperCase();
    },
    get localPrevia() {
      const local = this.form.cidade && this.form.estado
        ? `${this.form.cidade}/${this.form.estado}`
        : this.form.cidade || 'Sua cidade';
      return `${local} • loja nova`;
    },

    // ----- Máscaras -----
    aoDigitarDocumento(evento) {
      const mascarar = this.form.tipoDocumento === 'CNPJ' ? mascararCnpj : mascararCpf;
      this.form.documento = evento.target.value = mascarar(evento.target.value);
      delete this.erros.documento;
    },
    trocarTipoDocumento() {
      this.form.documento = '';
      delete this.erros.documento;
    },
    aoDigitarTelefone(evento) {
      this.form.telefone = evento.target.value = mascararTelefone(evento.target.value);
      delete this.erros.telefone;
    },
    async aoDigitarCep(evento) {
      this.form.cep = evento.target.value = mascararCep(evento.target.value);
      delete this.erros.cep;
      if (!validarCep(this.form.cep)) return;

      this.buscandoCep = true;
      try {
        const endereco = await buscarEnderecoPorCep(somenteDigitos(this.form.cep));
        if (endereco) {
          // Só preenche o que o usuário ainda não digitou
          this.form.cidade ||= endereco.cidade;
          this.form.estado ||= endereco.estado;
          this.form.logradouro ||= endereco.logradouro;
          this.form.bairro ||= endereco.bairro;
        }
      } catch {
        // Sem preenchimento automático: o usuário digita o endereço normalmente
      } finally {
        this.buscandoCep = false;
      }
    },

    // ----- Validação no navegador (a API confere tudo de novo) -----
    validar() {
      const f = this.form;
      const e = {};
      const obrigatorio = 'Preencha este campo.';

      if (!f.nomeLoja) e.nomeLoja = 'Informe o nome da loja.';
      else if (f.nomeLoja.length < 3) e.nomeLoja = 'Use pelo menos 3 caracteres.';

      if (!f.documento) e.documento = `Informe o ${f.tipoDocumento}.`;
      else if (f.tipoDocumento === 'CNPJ' && !validarCnpj(f.documento)) e.documento = 'CNPJ inválido. Confira os números.';
      else if (f.tipoDocumento === 'CPF' && !validarCpf(f.documento)) e.documento = 'CPF inválido. Confira os números.';

      if (!f.telefone) e.telefone = 'Informe o telefone da loja.';
      else if (!validarTelefone(f.telefone)) e.telefone = 'Telefone com DDD, ex.: (19) 90000-0101.';

      if (!f.cep) e.cep = 'Informe o CEP.';
      else if (!validarCep(f.cep)) e.cep = 'CEP deve ter 8 números.';

      if (!f.cidade) e.cidade = 'Informe a cidade.';
      if (!f.estado) e.estado = 'Escolha a UF.';
      if (!f.logradouro) e.logradouro = obrigatorio;
      if (!f.numero) e.numero = obrigatorio;
      if (!f.bairro) e.bairro = obrigatorio;

      if (!f.retiradaBalcao && !f.entregaCombinar && !f.motoboyProprio) {
        e.atendimento = 'Marque pelo menos uma forma de atendimento.';
      }
      if (!f.metodosPagamento.length) e.metodosPagamento = 'Marque pelo menos uma forma de pagamento.';
      if (!f.aceiteTermos) e.aceiteTermos = 'Para criar a loja, aceite os Termos do vendedor e a Política de Privacidade.';

      return e;
    },

    // Monta o corpo do POST /api/lojas: camelCase, CPF/CNPJ e CEP só com dígitos
    montarRequisicao() {
      const f = this.form;
      const metodos = f.metodosPagamento.flatMap((m) =>
        m === 'CARTAO' ? ['CARTAO_CREDITO', 'CARTAO_DEBITO'] : [m]);

      return {
        nomeLoja: f.nomeLoja,
        descricao: f.descricao.trim() || null,
        tipoPessoa: f.tipoDocumento === 'CNPJ' ? 'PJ' : 'PF',
        cnpjCpf: somenteDigitos(f.documento),
        telefone: somenteDigitos(f.telefone),
        endereco: {
          cep: somenteDigitos(f.cep),
          logradouro: f.logradouro,
          numero: f.numero,
          bairro: f.bairro,
          cidade: f.cidade,
          estado: f.estado,
        },
        retiradaBalcao: f.retiradaBalcao,
        entregaCombinar: f.entregaCombinar,
        motoboyProprio: f.motoboyProprio,
        metodosPagamento: metodos,
        aceiteTermos: f.aceiteTermos,
      };
    },

    async enviar() {
      if (this.enviando) return;

      this.erros = this.validar();
      if (Object.keys(this.erros).length) {
        this.mostrarErro(MENSAGEM_ERRO_PADRAO(this.form.tipoDocumento));
        return;
      }

      this.enviando = true;
      this.estado = 'formulario';
      try {
        this.lojaCriada = await criarLoja(this.montarRequisicao());
        this.estado = 'sucesso';
        this.$nextTick(() => {
          const resultado = document.getElementById('resultado');
          resultado.scrollIntoView({ behavior: 'smooth', block: 'center' });
          resultado.focus({ preventScroll: true });
        });
      } catch (erro) {
        this.tratarErroApi(erro);
      } finally {
        this.enviando = false;
      }
    },

    tratarErroApi(erro) {
      const errosApi = {};
      (erro?.campos || []).forEach(({ campo, mensagem }) => {
        const campoTela = CAMPOS_API[campo];
        if (campoTela) errosApi[campoTela] = mensagem;
      });
      this.erros = errosApi;

      // 400 e 409 trazem mensagem pronta da API; 500 ou sem resposta, mensagem genérica
      const mensagem = erro?.mensagem
        || (erro?.status >= 500 || !erro?.status
          ? 'Não foi possível concluir. Tente novamente.'
          : MENSAGEM_ERRO_PADRAO(this.form.tipoDocumento));
      this.mostrarErro(mensagem);
    },

    mostrarErro(mensagem) {
      this.estado = 'erro';
      this.mensagemErro = mensagem;
      this.$nextTick(() => {
        const primeiro = ORDEM_CAMPOS.find((campo) => this.erros[campo]);
        const alvo = {
          atendimento: 'retiradaBalcao',
          metodosPagamento: 'pagPix',
        }[primeiro] || primeiro;
        document.getElementById(alvo)?.focus();
      });
    },

    cancelar() {
      if (document.referrer && new URL(document.referrer).origin === location.origin) history.back();
      else location.href = '../../index.html';
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('criarLoja', paginaCriarLoja);
});