// Textos de pausar e reativar anúncio (BP1-46), usados no painel e no formulário de peça.
// Só textos e leitura de erros: quem decide se a ação vale é a API.

/** Conteúdo da janela de confirmação. `anuncio` precisa de titulo e, se houver, codigoSku. */
export function confirmacaoStatus(acao, anuncio) {
  const nome = anuncio.codigoSku ? `${anuncio.titulo} (${anuncio.codigoSku})` : anuncio.titulo;
  if (acao === 'pausar') {
    return {
      titulo: 'Pausar anúncio?',
      texto: `${nome} sai das buscas e deixa de receber pedidos enquanto estiver pausado. `
        + 'Pedidos em andamento continuam normalmente. Você pode reativar quando a peça estiver disponível de novo.',
      botao: 'Pausar anúncio',
      botaoCancelar: 'Manter ativo',
      estilo: 'perigo',
    };
  }
  return {
    titulo: 'Reativar anúncio?',
    texto: `${nome} volta a aparecer nas buscas e pode receber pedidos com o preço e o estoque atuais. `
      + 'Confira a quantidade antes de reativar.',
    botao: 'Reativar anúncio',
    botaoCancelar: 'Manter pausado',
    estilo: 'primario',
  };
}

export function mensagemSucessoStatus(acao, anuncio) {
  return acao === 'pausar'
    ? `Anúncio pausado. ${anuncio.titulo} não aparece mais para os compradores.`
    : `Anúncio reativado. ${anuncio.titulo} voltou a aparecer nas buscas.`;
}

/**
 * Traduz o erro da API em aviso para a tela.
 * 409 ESTOQUE_ZERADO: oferece o atalho para atualizar o estoque.
 * 409 STATUS_INVALIDO: o anúncio mudou em outra aba; a tela recarrega a lista.
 * @returns {{ texto: string, link?: { href: string, texto: string }, recarregar: boolean }}
 */
export function avisoErroStatus(erro, anuncio, linkEditar) {
  if (erro?.erro === 'ESTOQUE_ZERADO') {
    return {
      texto: erro.mensagem || 'Atualize o estoque antes de reativar este anúncio.',
      link: { href: `${linkEditar}#secao-estoque`, texto: 'Atualizar estoque' },
      recarregar: false,
    };
  }
  if (erro?.status === 409 || erro?.status === 404) {
    return {
      texto: erro.mensagem || `O status de ${anuncio.titulo} mudou. A lista foi atualizada.`,
      recarregar: true,
    };
  }
  return { texto: erro?.mensagem || 'Não foi possível concluir. Tente novamente.', recarregar: false };
}