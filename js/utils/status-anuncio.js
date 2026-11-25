// Textos de pausar, reativar (BP1-46) e excluir anúncio, usados no painel e no formulário de peça.
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

/**
 * Confirmação de exclusão. Rascunho: texto simples. Anúncio publicado: avisa que não dá para
 * desfazer e, se estiver ativo, oferece pausar no lugar (a janela mostra o botão "Pausar em vez disso").
 */
export function confirmacaoExclusao(anuncio) {
  const nome = anuncio.codigoSku ? `${anuncio.titulo} (${anuncio.codigoSku})` : anuncio.titulo;
  if (anuncio.status === 'RASCUNHO') {
    return {
      titulo: 'Excluir rascunho?',
      texto: `${nome} será removido da sua lista. O rascunho nunca foi publicado, então nenhum comprador o viu.`,
      botao: 'Excluir rascunho',
      botaoCancelar: 'Manter rascunho',
      estilo: 'perigo',
    };
  }
  return {
    titulo: 'Excluir anúncio?',
    texto: `${nome} sai da sua loja e das buscas, e não poderá ser reativado. Pedidos já feitos e o histórico de vendas continuam guardados. `
      + (anuncio.status === 'ATIVO'
        ? 'Se a peça só está indisponível por um tempo, pause em vez de excluir.'
        : 'Esta ação não pode ser desfeita.'),
    botao: 'Excluir anúncio',
    botaoCancelar: 'Manter anúncio',
    estilo: 'perigo',
    sugerePausar: anuncio.status === 'ATIVO',
  };
}

export function mensagemSucessoExclusao(anuncio) {
  return anuncio.status === 'RASCUNHO'
    ? `Rascunho excluído. ${anuncio.titulo} saiu da sua lista.`
    : `Anúncio excluído. ${anuncio.titulo} saiu da sua loja e das buscas.`;
}

export function mensagemSucessoStatus(acao, anuncio) {
  return acao === 'pausar'
    ? `Anúncio pausado. ${anuncio.titulo} não aparece mais para os compradores.`
    : `Anúncio reativado. ${anuncio.titulo} voltou a aparecer nas buscas.`;
}

/**
 * Traduz o erro da API em aviso para a tela.
 * 409 ESTOQUE_ZERADO: oferece o atalho para atualizar o estoque.
 * 409 PEDIDOS_EM_ANDAMENTO (excluir): oferece o atalho para os pedidos recebidos.
 * 409 STATUS_INVALIDO ou 404: o anúncio mudou em outra aba; a tela recarrega a lista.
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
  if (erro?.erro === 'PEDIDOS_EM_ANDAMENTO') {
    return {
      texto: erro.mensagem || 'Esta peça tem pedidos em andamento. Conclua ou recuse antes de excluir, ou pause o anúncio.',
      link: { href: 'pedidos.html', texto: 'Ver pedidos recebidos' },
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