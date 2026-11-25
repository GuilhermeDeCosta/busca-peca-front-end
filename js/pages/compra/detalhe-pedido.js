// Tela: compra/detalhe-pedido.html?id={idPedido} — Detalhe do pedido (Fluxo A • Encontrar e comprar, A11 / etapa 10)
// Acesso: logado (comprador do pedido). Casos de uso: BP1-27 (acompanhar status), BP1-28 (conversa),
//   BP1-29 (código de retirada), BP1-30 (cancelar), BP1-33 (rastreio), BP1-36 (recibo), BP1-61 (problema), BP1-15 (avaliar)
// Rotas: GET /api/pedidos/{id}, PATCH /api/pedidos/{id}/cancelar, PATCH /api/pedidos/{id}/concluir,
//   GET /api/pedidos/{id}/rastreio, GET /api/pedidos/{id}/recibo, POST /api/pedidos/{id}/avaliacao,
//   POST /api/pedidos/{id}/problemas (multipart), /api/conversas (abrir, listar e enviar mensagens)
//
// Como funciona:
//   - A linha do tempo segue a modalidade: retirada termina em "Pronto para retirada", entrega em "Enviado".
//   - Recusado ou cancelado: a linha do tempo dá lugar ao aviso com o motivo.
//   - O código de retirada só aparece para o comprador e some quando o pedido é cancelado ou recusado.
//   - Os três modais ("00 • Referência", Estados e modais): cancelar (só aguardando aceite),
//     relatar problema (menos em recusado ou cancelado) e avaliar a loja (só depois de concluído, uma vez).
//   - A conversa mostra as últimas mensagens; a primeira mensagem abre a conversa do pedido.
//   - Sem login, a API responde 401 e a página leva para o login, voltando para cá.
import {
  obterPedido, cancelarPedido, confirmarRecebimento, avaliarPedido, registrarProblema, obterRastreio, linkRecibo,
} from '../../services/pedidos.js';
import { abrirConversaDoPedido, listarMensagens, enviarMensagem, USAR_SIMULACAO as CONVERSA_SIMULADA } from '../../services/conversas.js';
import { mostrarAviso } from '../../components/aviso.js';
import { IMAGEM_PADRAO, rotuloCondicao } from '../../components/card-peca.js';
import { formatarMoeda, formatarData, pluralizarDiasUteis } from '../../utils/formatacao.js';
import { rotuloStatusPedido, classeStatusPedido } from '../../utils/status-pedido.js';
import { linkPara, linkLogin } from '../../utils/links.js';

const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';
const MENSAGENS_NO_PAINEL = 4;
const MENSAGEM_MAXIMO = 2000;
const COMENTARIO_MAXIMO = 500;
const DESCRICAO_MINIMO = 10;
const DESCRICAO_MAXIMO = 2000;
const AVALIACAO_MAXIMO = 1000;
const ANEXO_TIPOS = ['image/jpeg', 'image/png', 'application/pdf'];
const ANEXO_TAMANHO_MAXIMO = 5 * 1024 * 1024;
const ANEXOS_MAXIMO = 5;

// Etapas da linha do tempo, por modalidade (status do banco + EM_PREPARACAO do Fluxo C)
const ETAPAS = {
  RETIRADA: [
    { status: 'AGUARDANDO_ACEITE', texto: 'Pedido enviado' },
    { status: 'ACEITO', texto: 'Aceite da loja', depois: 'Aguardando' },
    { status: 'EM_PREPARACAO', texto: 'Em preparação', depois: 'Próxima etapa' },
    { status: 'PRONTO_RETIRADA', texto: 'Pronto para retirada', depois: 'A combinar' },
    { status: 'CONCLUIDO', texto: 'Concluído', depois: 'Após recebimento' },
  ],
  ENTREGA: [
    { status: 'AGUARDANDO_ACEITE', texto: 'Pedido enviado' },
    { status: 'ACEITO', texto: 'Aceite da loja', depois: 'Aguardando' },
    { status: 'EM_PREPARACAO', texto: 'Em preparação', depois: 'Próxima etapa' },
    { status: 'EM_ENTREGA', texto: 'Enviado', depois: 'A combinar' },
    { status: 'CONCLUIDO', texto: 'Concluído', depois: 'Após recebimento' },
  ],
};
const DEPOIS_DO_ACEITE = ['ACEITO', 'EM_PREPARACAO', 'PRONTO_RETIRADA', 'EM_ENTREGA', 'CONCLUIDO'];

export const MOTIVOS_CANCELAMENTO = [
  'Encontrei a peça em outro lugar',
  'Comprei a peça errada',
  'A loja demorou para responder',
  'Não preciso mais da peça',
  'Outro motivo',
];
export const TIPOS_PROBLEMA = [
  { valor: 'PECA_ERRADA', texto: 'Peça diferente do anúncio' },
  { valor: 'DEFEITO', texto: 'Peça com defeito' },
  { valor: 'AVARIA', texto: 'Peça avariada ou embalagem danificada' },
  { valor: 'NAO_ENTREGUE', texto: 'Pedido não entregue' },
  { valor: 'OUTRO', texto: 'Outro problema' },
];
export const ASPECTOS_AVALIACAO = [
  { valor: 'CONFORME_ANUNCIO', texto: 'Peça conforme o anúncio' },
  { valor: 'ATENDIMENTO_RAPIDO', texto: 'Atendimento rápido' },
  { valor: 'PRAZO_CUMPRIDO', texto: 'Prazo combinado cumprido' },
];

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
});
const diaHoraCurto = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

function formatarDataHora(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dataHora.format(d); // "16/10/2026, 09:42"
}

function paginaDetalhePedido() {
  return {
    MOTIVOS_CANCELAMENTO,
    TIPOS_PROBLEMA,
    ASPECTOS_AVALIACAO,
    MENSAGEM_MAXIMO,
    COMENTARIO_MAXIMO,
    DESCRICAO_MAXIMO,
    AVALIACAO_MAXIMO,
    CONVERSA_SIMULADA,

    idPedido: new URLSearchParams(window.location.search).get('id'),
    carregando: true,
    erro: '',
    naoEncontrado: false,
    pedido: null,

    // Conversa
    mensagens: [],
    carregandoConversa: false,
    erroConversa: '',
    novaMensagem: '',
    erroMensagem: '',
    enviandoMensagem: false,

    // Ações
    rastreio: null,
    buscandoRastreio: false,
    confirmandoRecebimento: false,

    // Modais
    modal: '', // 'cancelar' | 'problema' | 'avaliar'
    _quemAbriu: null,
    enviando: false,
    erroModal: '',
    cancelamento: { motivo: '', mensagem: '' },
    problema: { tipoProblema: '', descricao: '', querDevolucao: false, arquivos: [] },
    avaliacao: { nota: 0, aspectos: [], comentario: '' },
    errosModal: {},

    // ---------- Início ----------

    async init() {
      if (!this.idPedido) {
        this.naoEncontrado = true;
        this.carregando = false;
        return;
      }
      await this.carregar();
    },

    async carregar() {
      this.carregando = true;
      this.erro = '';
      try {
        this.pedido = await obterPedido(this.idPedido);
        document.title = `Pedido ${this.pedido.codigo} • Busca Peças`;
        this.carregarConversa();
      } catch (erro) {
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        // 403 e 404: pedido de outra pessoa ou inexistente (a tela não diferencia, de propósito)
        if (erro?.status === 404 || erro?.status === 403) this.naoEncontrado = true;
        else this.erro = erro?.mensagem || 'Não foi possível carregar o pedido. Tente novamente.';
      } finally {
        this.carregando = false;
      }
    },

    // ---------- Cabeçalho do pedido ----------

    get subtitulo() {
      const p = this.pedido;
      const d = new Date(p.dataPedido);
      const quando = Number.isNaN(d.getTime()) ? '' : ` • criado em ${formatarData(d)} às ${hora.format(d)}`;
      return `${p.loja?.nomeLoja || ''}${quando}`;
    },
    get textoAtualizacao() {
      const quando = formatarDataHora(this.pedido.atualizadoEm || this.pedido.dataPedido);
      return quando ? `Atualizado em ${quando}` : '';
    },
    rotuloStatus(status) {
      return rotuloStatusPedido(status);
    },
    classeStatus(status) {
      return classeStatusPedido(status);
    },

    // ---------- Acompanhamento (BP1-27) ----------

    get encerradoSemConcluir() {
      return ['RECUSADO', 'CANCELADO'].includes(this.pedido?.status);
    },
    get etapas() {
      const p = this.pedido;
      const lista = ETAPAS[p.modalidadeEntrega] || ETAPAS.RETIRADA;
      const atual = lista.findIndex((e) => e.status === p.status);
      const datas = Object.fromEntries((p.historico || []).map((h) => [h.status, h.data]));
      return lista.map((e, i) => {
        const feita = i <= atual;
        let detalhe;
        if (datas[e.status]) detalhe = diaHoraCurto.format(new Date(datas[e.status])).replace(', ', ' • ');
        else if (feita) detalhe = 'Concluída';
        else detalhe = i === atual + 1 ? 'Aguardando' : e.depois;
        return { ...e, feita, atual: i === atual, detalhe };
      });
    },
    get avisoEncerrado() {
      const p = this.pedido;
      if (p.status === 'RECUSADO') {
        return { titulo: 'A loja recusou este pedido', texto: p.motivoRecusa ? `Motivo: ${p.motivoRecusa}` : '', fim: 'As peças voltaram ao estoque da loja. Nenhum valor foi cobrado.' };
      }
      return { titulo: 'Pedido cancelado', texto: p.motivoCancelamento ? `Motivo: ${p.motivoCancelamento}` : '', fim: 'A loja foi avisada e as peças voltaram ao estoque. Nenhum valor foi cobrado.' };
    },

    // ---------- Itens ----------

    get tituloItens() {
      return this.pedido.itens.length > 1 ? 'Itens solicitados' : 'Item solicitado';
    },
    foto(item) {
      return item.fotoUrl || IMAGEM_PADRAO;
    },
    usarImagemPadrao(evento) {
      if (evento.target.src !== IMAGEM_PADRAO) evento.target.src = IMAGEM_PADRAO;
    },
    tituloItem(item) {
      return item.marcaPeca && !item.titulo.includes(item.marcaPeca) ? `${item.titulo} ${item.marcaPeca}` : item.titulo;
    },
    linhaCodigos(item) {
      const condicao = rotuloCondicao(item).replace(' • ', ' / ');
      return [item.codigoOem ? `OEM ${item.codigoOem}` : '', condicao].filter(Boolean).join(' • ');
    },
    linhaQuantidade(item) {
      return `${item.quantidade} ${item.quantidade === 1 ? 'unidade' : 'unidades'} × ${formatarMoeda(item.precoUnitario)}`;
    },
    moeda(valor) {
      return formatarMoeda(valor);
    },
    get mostraTotal() {
      return this.pedido.itens.length > 1;
    },
    linkPeca(item) {
      return item.idPeca ? linkPara('detalhePeca', { id: item.idPeca }) : null;
    },

    // ---------- Retirada ou entrega ----------

    get ehRetirada() {
      return this.pedido.modalidadeEntrega === 'RETIRADA';
    },
    get linhaLoja() {
      const l = this.pedido.loja || {};
      return [l.nomeLoja, l.cidade && l.estado ? `${l.cidade}/${l.estado}` : ''].filter(Boolean).join(' • ');
    },
    get textoRetirada() {
      const p = this.pedido;
      const prazo = `Expedição prevista em ${pluralizarDiasUteis(p.prazoExpedicaoDias || 1)}.`;
      switch (p.status) {
        case 'AGUARDANDO_ACEITE': return `${prazo} Aguarde o aceite e combine o horário antes de sair.`;
        case 'ACEITO':
        case 'EM_PREPARACAO': return `${prazo} Combine o horário de retirada pela conversa.`;
        case 'PRONTO_RETIRADA': return 'Seu pedido está separado. Combine o horário e leve o código ao balcão.';
        case 'CONCLUIDO': return 'Pedido retirado no balcão.';
        default: return '';
      }
    },
    get textoEntrega() {
      const p = this.pedido;
      switch (p.status) {
        case 'AGUARDANDO_ACEITE': return 'Aguarde o aceite. Frete, prazo e forma de entrega são combinados com a loja pela conversa.';
        case 'ACEITO':
        case 'EM_PREPARACAO': return 'Combine frete e prazo com a loja pela conversa.';
        case 'EM_ENTREGA': return 'A loja enviou o pedido. Confirme aqui quando receber as peças.';
        case 'CONCLUIDO': return 'Entrega confirmada.';
        default: return '';
      }
    },
    get mostraCodigoRetirada() {
      const p = this.pedido;
      return this.ehRetirada && p.codigoRetirada && !this.encerradoSemConcluir;
    },
    get codigoUsado() {
      return this.pedido.status === 'CONCLUIDO';
    },

    // Rastreio (BP1-33): só quando a loja informou o envio
    async verRastreio() {
      this.buscandoRastreio = true;
      try {
        this.rastreio = await obterRastreio(this.idPedido);
      } catch (erro) {
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || 'Não foi possível consultar o rastreio agora.' });
      } finally {
        this.buscandoRastreio = false;
      }
    },
    get textoRastreio() {
      if (!this.rastreio) return '';
      const previsao = this.rastreio.previsaoEntrega ? ` • previsão ${formatarData(this.rastreio.previsaoEntrega)}` : '';
      return `${this.rastreio.situacao}${previsao} (atualizado em ${formatarDataHora(this.rastreio.atualizadaEm)})`;
    },

    // ---------- Conversa com a loja (BP1-28) ----------

    async carregarConversa() {
      if (!this.pedido?.idConversa) return;
      this.carregandoConversa = true;
      this.erroConversa = '';
      try {
        const pagina = await listarMensagens(this.pedido.idConversa, { pagina: 0, tamanho: 100 });
        this.mensagens = (pagina.itens || []).slice(-MENSAGENS_NO_PAINEL);
      } catch (erro) {
        this.erroConversa = 'Não foi possível carregar a conversa.';
      } finally {
        this.carregandoConversa = false;
      }
    },
    autorMensagem(m) {
      const quem = m.propria ? (m.nomeRemetente && m.nomeRemetente !== 'Você' ? m.nomeRemetente : 'Você') : 'Loja';
      return `${quem} • ${formatarDataHora(m.dataEnvio)}`;
    },
    get linkConversa() {
      return this.pedido?.idConversa ? linkPara('conversas', { id: this.pedido.idConversa }) : null;
    },
    async enviar() {
      const texto = this.novaMensagem.trim();
      this.erroMensagem = '';
      if (!texto) {
        this.erroMensagem = 'Escreva a mensagem antes de enviar.';
        this.$refs.campoMensagem?.focus();
        return;
      }
      this.enviandoMensagem = true;
      try {
        if (!this.pedido.idConversa) {
          const { idConversa } = await abrirConversaDoPedido(this.idPedido);
          this.pedido.idConversa = idConversa;
        }
        const nova = await enviarMensagem(this.pedido.idConversa, texto);
        this.mensagens = [...this.mensagens, nova].slice(-MENSAGENS_NO_PAINEL);
        this.novaMensagem = '';
        this.$nextTick(() => this.$refs.campoMensagem?.focus());
      } catch (erro) {
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        this.erroMensagem = erro?.campos?.[0]?.mensagem || erro?.mensagem || 'Não foi possível enviar. Tente novamente.';
      } finally {
        this.enviandoMensagem = false;
      }
    },

    // ---------- Precisa de ajuda? ----------

    get podeCancelar() {
      return this.pedido?.status === 'AGUARDANDO_ACEITE';
    },
    get textoCancelar() {
      if (this.podeCancelar) return 'Você pode cancelar enquanto o pedido aguarda aceite. Após o aceite, converse com a loja.';
      if (this.encerradoSemConcluir || this.pedido.status === 'CONCLUIDO') return '';
      return 'A loja já aceitou o pedido. Para cancelar, converse com a loja.';
    },
    // Como no protótipo, fica disponível desde o envio; some em pedido recusado ou cancelado
    get podeRelatarProblema() {
      return Boolean(this.pedido) && !this.encerradoSemConcluir && !this.pedido.problema;
    },
    get textoProblema() {
      const pr = this.pedido.problema;
      if (pr) return `Problema registrado (${pr.status === 'RESOLVIDO' ? 'resolvido' : 'em análise pela loja'}). Acompanhe pela conversa.`;
      return '';
    },
    get podeConfirmarRecebimento() {
      return this.pedido?.status === 'EM_ENTREGA';
    },
    get podeAvaliar() {
      return this.pedido?.status === 'CONCLUIDO' && !this.pedido.avaliacao;
    },
    get textoBotaoAvaliar() {
      if (this.pedido.avaliacao) return `Você avaliou com ${this.pedido.avaliacao.nota} de 5 estrelas`;
      return this.podeAvaliar ? `Avaliar ${this.pedido.loja?.nomeLoja || 'a loja'}` : 'Avaliar após conclusão';
    },
    get temRecibo() {
      return DEPOIS_DO_ACEITE.includes(this.pedido?.status);
    },
    baixarRecibo() {
      const link = linkRecibo(this.idPedido);
      if (!link) {
        mostrarAviso({ tipo: 'sucesso', texto: 'Na demonstração o recibo não é gerado. Com a API ligada, o PDF abre em outra aba.' });
        return;
      }
      window.open(link, '_blank', 'noopener');
    },

    async confirmarRecebido() {
      if (this.confirmandoRecebimento) return;
      this.confirmandoRecebimento = true;
      try {
        this.pedido = await confirmarRecebimento(this.idPedido);
        mostrarAviso({ tipo: 'sucesso', texto: 'Recebimento confirmado. Agora você pode avaliar a loja.' });
        this.$nextTick(() => document.getElementById('titulo-pedido')?.focus());
      } catch (erro) {
        this.tratarErroAcao(erro);
      } finally {
        this.confirmandoRecebimento = false;
      }
    },

    tratarErroAcao(erro) {
      if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
      mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
      if (erro?.status === 409) this.carregar(); // o pedido mudou: mostra o status atual
    },

    // ---------- Modais ----------

    abrirModal(nome, evento) {
      this._quemAbriu = evento?.currentTarget || document.activeElement;
      this.erroModal = '';
      this.errosModal = {};
      if (nome === 'cancelar') this.cancelamento = { motivo: '', mensagem: '' };
      if (nome === 'problema') this.problema = { tipoProblema: '', descricao: '', querDevolucao: false, arquivos: [] };
      if (nome === 'avaliar') this.avaliacao = { nota: 0, aspectos: [], comentario: '' };
      this.modal = nome;
      document.body.classList.add('overflow-hidden');
      this.$nextTick(() => document.querySelector(`#modal-${nome} [data-foco-inicial]`)?.focus());
    },
    fecharModal() {
      if (this.enviando) return;
      this.modal = '';
      document.body.classList.remove('overflow-hidden');
      const volta = this._quemAbriu;
      this.$nextTick(() => (document.body.contains(volta) ? volta : document.getElementById('titulo-pedido'))?.focus());
    },
    // Mantém o Tab dentro do modal aberto
    prenderFoco(evento) {
      const caixa = evento.currentTarget;
      const focaveis = [...caixa.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    },
    focarPrimeiroErro() {
      this.$nextTick(() => document.querySelector(`#modal-${this.modal} [aria-invalid="true"]`)?.focus());
    },

    // Cancelar (BP1-30)
    async enviarCancelamento() {
      const erros = {};
      if (!this.cancelamento.motivo) erros.motivo = 'Escolha o motivo do cancelamento.';
      this.errosModal = erros;
      if (Object.keys(erros).length) { this.focarPrimeiroErro(); return; }
      this.enviando = true;
      this.erroModal = '';
      try {
        this.pedido = await cancelarPedido(this.idPedido, {
          motivo: this.cancelamento.motivo,
          mensagem: this.cancelamento.mensagem.trim(),
        });
        this.enviando = false;
        this.fecharModal();
        mostrarAviso({ tipo: 'sucesso', texto: `Pedido ${this.pedido.codigo} cancelado. A loja foi avisada.` });
      } catch (erro) {
        this.enviando = false;
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        this.erroModal = erro?.mensagem || ERRO_GENERICO;
        if (erro?.status === 409) this.carregar();
      }
    },

    // Relatar problema (BP1-61)
    escolherArquivos(evento) {
      const novos = [...(evento.target.files || [])];
      evento.target.value = ''; // permite escolher o mesmo arquivo de novo depois de remover
      const recusados = [];
      novos.forEach((arquivo) => {
        if (!ANEXO_TIPOS.includes(arquivo.type)) recusados.push(`${arquivo.name}: use JPG, PNG ou PDF.`);
        else if (arquivo.size > ANEXO_TAMANHO_MAXIMO) recusados.push(`${arquivo.name}: o limite é 5 MB.`);
        else if (this.problema.arquivos.length >= ANEXOS_MAXIMO) recusados.push(`${arquivo.name}: no máximo ${ANEXOS_MAXIMO} arquivos.`);
        else this.problema.arquivos.push(arquivo);
      });
      this.errosModal = { ...this.errosModal, arquivos: recusados.join(' ') };
    },
    removerArquivo(indice) {
      this.problema.arquivos.splice(indice, 1);
      this.errosModal = { ...this.errosModal, arquivos: '' };
      this.$nextTick(() => this.$refs.botaoAnexo?.focus());
    },
    tamanhoArquivo(arquivo) {
      return arquivo.size >= 1024 * 1024 ? `${(arquivo.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(arquivo.size / 1024))} KB`;
    },
    get resumoPedidoProblema() {
      const p = this.pedido;
      return [`Pedido ${p.codigo}`, p.itens[0]?.titulo, p.loja?.nomeLoja].filter(Boolean).join(' • ');
    },
    async enviarProblema() {
      const pr = this.problema;
      const erros = {};
      if (!pr.tipoProblema) erros.tipoProblema = 'Escolha o tipo de problema.';
      if (pr.descricao.trim().length < DESCRICAO_MINIMO) erros.descricao = `Descreva o que aconteceu (pelo menos ${DESCRICAO_MINIMO} caracteres).`;
      this.errosModal = { ...erros, arquivos: this.errosModal.arquivos || '' };
      if (Object.keys(erros).length) { this.focarPrimeiroErro(); return; }
      this.enviando = true;
      this.erroModal = '';
      try {
        const criado = await registrarProblema(this.idPedido, {
          tipoProblema: pr.tipoProblema, descricao: pr.descricao.trim(), querDevolucao: pr.querDevolucao, arquivos: [...pr.arquivos],
        });
        this.pedido.problema = criado;
        this.enviando = false;
        this.fecharModal();
        mostrarAviso({ tipo: 'sucesso', texto: 'Relato enviado. A loja foi avisada e vai responder pela conversa.' });
      } catch (erro) {
        this.enviando = false;
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        (erro?.campos || []).forEach((c) => { this.errosModal[c.campo] = c.mensagem; });
        this.erroModal = erro?.campos?.length ? '' : (erro?.mensagem || ERRO_GENERICO);
      }
    },

    // Avaliar a loja (BP1-15)
    get textoConclusao() {
      const concluido = (this.pedido.historico || []).find((h) => h.status === 'CONCLUIDO');
      return concluido ? `Pedido ${this.pedido.codigo} concluído em ${formatarData(concluido.data)}.` : `Pedido ${this.pedido.codigo} concluído.`;
    },
    rotuloNota(n) {
      return ['', '1 estrela: ruim', '2 estrelas: regular', '3 estrelas: boa', '4 estrelas: muito boa', '5 estrelas: excelente'][n];
    },
    async enviarAvaliacao() {
      const erros = {};
      if (!this.avaliacao.nota) erros.nota = 'Escolha de 1 a 5 estrelas.';
      this.errosModal = erros;
      if (Object.keys(erros).length) {
        this.$nextTick(() => document.querySelector('#modal-avaliar input[name="nota"]')?.focus());
        return;
      }
      this.enviando = true;
      this.erroModal = '';
      try {
        this.pedido.avaliacao = await avaliarPedido(this.idPedido, {
          nota: this.avaliacao.nota,
          aspectos: [...this.avaliacao.aspectos], // cópia simples: a lista do Alpine é reativa
          comentario: this.avaliacao.comentario.trim(),
        });
        this.enviando = false;
        this.fecharModal();
        mostrarAviso({ tipo: 'sucesso', texto: 'Obrigado! Sua avaliação ajuda outras oficinas a escolher.' });
      } catch (erro) {
        this.enviando = false;
        if (erro?.status === 401) { window.location.href = linkLogin(window.location.href); return; }
        this.erroModal = erro?.mensagem || ERRO_GENERICO;
      }
    },

    // ---------- Links ----------

    get linkMeusPedidos() {
      return linkPara('minhasCompras');
    },
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('detalhePedido', paginaDetalhePedido);
});