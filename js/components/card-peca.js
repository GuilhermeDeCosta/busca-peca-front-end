/* =========================================================
   CARD DE PEÇA (componente) • js/components/card-peca.js
   Estilos em css/componentes.css ("CARD DE PEÇA").

   Documentação do Front-end: "Card de peça • Início, resultados, favoritos,
   loja pública • Foto, título, preço (com promoção, se houver), condição,
   loja, distância, selo de pronta entrega".

   O componente só monta o HTML. Os botões ficam com data-acao e a página
   decide o que fazer (chamar os services do carrinho e dos favoritos):
     data-acao="carrinho"  → Adicionar ao carrinho
     data-acao="favorito"  → Salvar ou remover dos favoritos (aria-pressed)
   O <article> tem data-id-peca com o id da peça.

   Uso:
     import { htmlCardPeca, htmlCardsCarregando, ligarImagensPadrao } from '../../components/card-peca.js';
     lista.innerHTML = pecas.map((p) => `<div class="col">${htmlCardPeca(p)}</div>`).join('');
   ========================================================= */
import { formatarMoeda, formatarDecimal, pluralizarDiasUteis, escaparHtml as esc } from '../utils/formatacao.js';
import { RAIZ, linkPara } from '../utils/links.js';

export const IMAGEM_PADRAO = new URL('assets/img/peca-sem-foto.svg', RAIZ).href;

const CONDICOES = {
  NOVO: 'Novo', NOVA: 'Novo', USADO: 'Usado', USADA: 'Usado',
  REMANUFATURADO: 'Remanufaturado', REMANUFATURADA: 'Remanufaturado',
};
const ORIGENS = {
  NACIONAL: 'Nacional', IMPORTADA: 'Importado', IMPORTADO: 'Importado', ORIGINAL: 'Original',
  OEM: 'OEM', GENUINA: 'Genuína', PARALELA: 'Paralela', GENERICA: 'Genérica',
};

// "Novo • Nacional"
export function rotuloCondicao(peca) {
  return [CONDICOES[peca.condicao], ORIGENS[peca.origem]].filter(Boolean).join(' • ');
}

// "OEM 52159336 • Arteb" (OEM primeiro; sem OEM, SKU; sem SKU, EAN)
export function linhaCodigo(peca) {
  const codigo = peca.codigoOem ? `OEM ${peca.codigoOem}`
    : peca.codigoSku ? `SKU ${peca.codigoSku}`
      : peca.codigoEan ? `EAN ${peca.codigoEan}` : '';
  return [codigo, peca.marcaPeca].filter(Boolean).join(' • ');
}

// "4 em estoque • expedição em 1 dia útil" ou "18 em estoque • pronta entrega"
export function linhaEstoque(peca) {
  const qtd = Number(peca.quantidadeEstoque) || 0;
  if (qtd === 0) return 'Sem estoque no momento';
  const prazo = peca.prontaEntrega ? 'pronta entrega' : `expedição em ${pluralizarDiasUteis(peca.prazoExpedicaoDias || 1)}`;
  return `${qtd} em estoque • ${prazo}`;
}

function htmlPreco(peca) {
  const promocao = peca.precoPromocional != null && Number(peca.precoPromocional) < Number(peca.preco);
  if (!promocao) {
    return `<p class="card-peca__preco"><span class="visually-hidden">Preço: </span>${formatarMoeda(peca.preco)}</p>`;
  }
  return `<p class="card-peca__preco">
      <span class="visually-hidden">Preço anterior: </span><s class="card-peca__preco-antigo">${formatarMoeda(peca.preco)}</s>
      <span class="visually-hidden">Preço em promoção: </span>${formatarMoeda(peca.precoPromocional)}
    </p>`;
}

/**
 * HTML de um card de peça.
 * @param {object} peca item de GET /api/busca (ver services/busca.js)
 */
export function htmlCardPeca(peca) {
  const titulo = esc(peca.titulo);
  const loja = peca.loja || {};
  const detalhe = linkPara('detalhePeca', { id: peca.idPeca });
  const semEstoque = !(Number(peca.quantidadeEstoque) > 0);
  const favorito = Boolean(peca.favorito);
  const local = [
    loja.cidade && loja.estado ? `${esc(loja.cidade)}/${esc(loja.estado)}` : '',
    peca.distanciaKm != null ? `${formatarDecimal(peca.distanciaKm)} km` : '',
  ].filter(Boolean).join(' • ');

  return `
  <article class="card-peca" data-id-peca="${esc(peca.idPeca)}">
    <div class="card-peca__topo">
      <span class="card-peca__tag">${esc(rotuloCondicao(peca))}</span>
      <button type="button" class="card-peca__fav" data-acao="favorito" aria-pressed="${favorito}"
              aria-label="${favorito ? 'Remover dos favoritos' : 'Salvar nos favoritos'}: ${titulo}">
        <i class="bi ${favorito ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i>
      </button>
    </div>

    <div class="card-peca__img">
      <img src="${esc(peca.fotoUrl || IMAGEM_PADRAO)}" alt="${titulo}" loading="lazy" width="320" height="180">
    </div>

    <h3 class="card-peca__titulo"><a href="${detalhe}">${titulo}</a></h3>
    <p class="card-peca__codigo">${esc(linhaCodigo(peca))}</p>
    ${htmlPreco(peca)}
    <p class="card-peca__loja">
      <a href="${linkPara('lojaPublica', { id: loja.idLoja })}">${esc(loja.nomeLoja)}</a>
      ${loja.avaliacaoMedia ? `<span class="card-peca__nota"><i class="bi bi-star-fill" aria-hidden="true"></i>
        <span class="visually-hidden">Avaliação </span>${formatarDecimal(loja.avaliacaoMedia)}<span class="visually-hidden"> de 5</span></span>` : ''}
    </p>
    ${local ? `<p class="card-peca__local">${local}</p>` : ''}
    <p class="card-peca__estoque${semEstoque ? ' card-peca__estoque--zerado' : ''}">${linhaEstoque(peca)}</p>

    <div class="card-peca__acoes">
      <button type="button" class="btn btn--verde w-100" data-acao="carrinho" ${semEstoque ? 'disabled' : ''}>
        <i class="bi bi-cart3" aria-hidden="true"></i> ${semEstoque ? 'Indisponível' : 'Adicionar ao carrinho'}
      </button>
      <a class="card-peca__detalhes" href="${detalhe}">Ver detalhes<span class="visually-hidden"> de ${titulo}</span></a>
    </div>
  </article>`;
}

/** Cards "esqueleto" enquanto a lista carrega (indicador de carregamento). */
export function htmlCardsCarregando(quantidade = 4) {
  const card = `
  <div class="col">
    <div class="card-peca placeholder-glow" aria-hidden="true">
      <span class="placeholder col-5 rounded"></span>
      <span class="card-peca__img placeholder w-100"></span>
      <span class="placeholder col-10 rounded"></span>
      <span class="placeholder col-6 rounded"></span>
      <span class="placeholder col-4 placeholder-lg rounded"></span>
      <span class="placeholder col-7 rounded"></span>
      <span class="placeholder col-12 placeholder-lg rounded mt-2" style="min-height:44px"></span>
    </div>
  </div>`;
  return card.repeat(quantidade);
}

/** Se a foto não abrir, troca pela imagem padrão de peça sem foto. */
export function ligarImagensPadrao(container) {
  container.addEventListener('error', (evento) => {
    const img = evento.target;
    if (img.tagName === 'IMG' && img.closest('.card-peca') && img.src !== IMAGEM_PADRAO) img.src = IMAGEM_PADRAO;
  }, true); // "error" não sobe pela árvore; precisa da fase de captura
}

/** Liga ou desliga o estado "carregando" de um botão do card (bloqueia clique duplo). */
export function definirCarregando(botao, carregando, textoCarregando = 'Adicionando…') {
  if (carregando) {
    botao.dataset.htmlOriginal = botao.innerHTML;
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    if (botao.dataset.acao === 'carrinho') {
      botao.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> ${textoCarregando}`;
    }
  } else {
    if (botao.dataset.htmlOriginal) botao.innerHTML = botao.dataset.htmlOriginal;
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
  }
}

/** Atualiza o coração do card depois de favoritar ou remover. */
export function definirFavorito(botao, favorito, titulo) {
  botao.setAttribute('aria-pressed', String(favorito));
  botao.setAttribute('aria-label', `${favorito ? 'Remover dos favoritos' : 'Salvar nos favoritos'}: ${titulo}`);
  botao.dataset.htmlOriginal = `<i class="bi ${favorito ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i>`;
  botao.innerHTML = botao.dataset.htmlOriginal;
}
