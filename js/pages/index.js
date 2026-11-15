// Tela: index.html (raiz do projeto) — Página inicial (Fluxo A • Encontrar e comprar, etapa 01)
// Acesso: público. Casos de uso: BP1-4 (buscar peça), BP1-6 (navegar por categoria).
// Rotas: GET /api/categorias, GET /api/busca
//        e, ao clicar nos cards: POST /api/carrinho/itens, POST e DELETE /api/favoritos
//
// O que a tela faz:
//   - Busca em destaque: valida o texto e leva para resultados.html com o termo e a localização
//   - Categorias: 6 primeiras de GET /api/categorias, cada uma abre os resultados filtrados
//   - Peças em destaque: GET /api/busca?ordenar=relevancia&tamanho=4
//   - Disponíveis para sua próxima revisão: GET /api/busca?prontaEntrega=true&tamanho=3,
//     por distância quando o usuário informou CEP ou localização (cabeçalho)
//   - Carrinho e favoritos: visitante vai para o login e volta para a peça (Documentação do Front-end)
//   - Links de venda mudam se o usuário já tem loja
import { listarCategorias } from '../services/catalogo.js';
import { buscarPecas } from '../services/busca.js';
import { adicionarAoCarrinho } from '../services/carrinho.js';
import { adicionarFavorito, removerFavorito } from '../services/favoritos.js';
import {
  htmlCardPeca, htmlCardsCarregando, ligarImagensPadrao, definirCarregando, definirFavorito,
} from '../components/card-peca.js';
import { mostrarAviso } from '../components/aviso.js';
import { escaparHtml as esc } from '../utils/formatacao.js';
import { linkPara, linkLogin } from '../utils/links.js';

const CATEGORIAS_NA_TELA = 6;
const MINIMO_CARACTERES = 3;
const RAIO_REGIAO_KM = 50;
const CHAVE_LOCALIZACAO = 'bp:localizacao'; // a mesma do cabecalho.js (sessionStorage, sem dado pessoal)
const ERRO_GENERICO = 'Não foi possível concluir. Tente novamente.';

// Ícone de cada categoria pelo nome (a API não manda imagem de categoria)
const ICONES_CATEGORIA = [
  [/ilumina|farol|lanterna|l[aâ]mpada/i, 'bi-lightbulb'],
  [/filtro/i, 'bi-funnel'],
  [/retrovisor|espelho/i, 'bi-car-front'],
  [/el[eé]tric|bateria|alternador/i, 'bi-lightning-charge'],
  [/lataria|carroceria|para-?choque/i, 'bi-car-front-fill'],
  [/motor/i, 'bi-gear-wide-connected'],
  [/freio/i, 'bi-disc'],
  [/suspens|amortecedor/i, 'bi-arrows-expand'],
  [/arrefec|radiador/i, 'bi-thermometer-half'],
  [/transmiss|embreagem|c[aâ]mbio/i, 'bi-gear'],
];

// As duas vitrines de peças da página
const SECOES = {
  destaque: {
    lista: 'lista-destaque',
    quantidade: 4,
    filtros: () => ({ ordenar: 'relevancia', tamanho: 4 }),
    vazio: 'Ainda não há peças anunciadas. Volte em breve ou anuncie as suas.',
  },
  revisao: {
    lista: 'lista-revisao',
    quantidade: 3,
    filtros: () => {
      const local = lerLocalizacao();
      return {
        prontaEntrega: true,
        tamanho: 3,
        ordenar: local ? 'distancia' : 'relevancia',
        ...(local ? { cep: local.cep, lat: local.lat, lng: local.lng, raioKm: RAIO_REGIAO_KM } : {}),
      };
    },
    vazio: 'Nenhuma peça com pronta entrega perto de você agora. Tente outra localização ou veja todas as peças.',
  },
};

const pecasNaTela = new Map(); // idPeca → peça, para os avisos e o login com volta

// ---------- Utilitários ----------

function lerLocalizacao() {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_LOCALIZACAO)); } catch (e) { return null; }
}

// Quem está logado: o cabeçalho pergunta à API (GET /api/auth/me) e avisa por esta Promise
async function usuarioLogado() {
  return window.Cabecalho ? window.Cabecalho.pronto : null;
}

function papeis(usuario) {
  return (usuario?.papeis || usuario?.roles || []).map((p) => String(p.nome || p).toUpperCase());
}

function temLoja(usuario) {
  return Boolean(usuario && (usuario.temLoja || usuario.loja || papeis(usuario).includes('VENDEDOR')));
}

function iconeCategoria(nome) {
  const achado = ICONES_CATEGORIA.find(([regra]) => regra.test(nome || ''));
  return achado ? achado[1] : 'bi-box-seam';
}

function htmlEstado({ icone, texto, botao }) {
  return `
    <div class="col w-100">
      <div class="inicio-estado">
        <i class="bi ${icone}" aria-hidden="true"></i>
        <p>${esc(texto)}</p>
        ${botao || ''}
      </div>
    </div>`;
}

// ---------- Busca em destaque (BP1-4) ----------

function ligarBusca() {
  const form = document.getElementById('form-busca-inicio');
  const campo = document.getElementById('busca-inicio');
  const erro = document.getElementById('busca-inicio-erro');

  const limparErro = () => {
    erro.textContent = '';
    campo.removeAttribute('aria-invalid');
  };
  campo.addEventListener('input', limparErro);

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const q = campo.value.trim();

    // Mesmas mensagens do cabeçalho e do protótipo (estados da busca)
    if (q.length === 0) erro.textContent = 'Informe o nome da peça, o código OEM, EAN ou SKU.';
    else if (q.length < MINIMO_CARACTERES) erro.textContent = `Digite pelo menos ${MINIMO_CARACTERES} caracteres para buscar.`;
    if (erro.textContent) {
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
      return;
    }

    // Leva a localização escolhida junto (busca por distância, BP1-7)
    const local = lerLocalizacao() || {};
    window.location.href = linkPara('resultados', { q, cep: local.cep, lat: local.lat, lng: local.lng });
  });
}

// ---------- Localização (texto abaixo da busca) ----------

function mostrarLocalizacao(usuario) {
  const local = lerLocalizacao();
  const rotulo = local?.rotulo
    || (usuario?.cidade && usuario?.uf ? `${usuario.cidade}/${usuario.uf}` : 'Localização não informada');
  document.getElementById('inicio-local').textContent = rotulo;
}

function ligarLocalizacao() {
  // Abre o painel "Alterar localização" do cabeçalho (lá estão o CEP e o aviso da LGPD)
  document.getElementById('inicio-alterar-local').addEventListener('click', (evento) => {
    evento.stopPropagation(); // o cabeçalho fecha os painéis ao receber clique fora dele
    const botao = document.querySelector('#cabecalho [data-abre="painel-localizacao"]');
    if (!botao) return;
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (botao.getAttribute('aria-expanded') !== 'true') botao.click();
    else document.getElementById('cabecalho-cep')?.focus();
  });

  // O cabeçalho avisa quando o usuário troca o CEP ou usa o GPS
  document.addEventListener('localizacao:alterada', () => {
    mostrarLocalizacao(null);
    carregarSecao('revisao');
  });
}

// ---------- Categorias (BP1-6) ----------

async function carregarCategorias() {
  const lista = document.getElementById('inicio-categorias');
  lista.setAttribute('aria-busy', 'true');
  lista.innerHTML = `
    <li class="col" aria-hidden="true">
      <div class="inicio-categoria placeholder-glow">
        <span class="inicio-categoria__img placeholder w-100"></span>
        <span class="placeholder col-8 mx-auto rounded"></span>
      </div>
    </li>`.repeat(CATEGORIAS_NA_TELA);

  try {
    const resposta = await listarCategorias();
    const categorias = (Array.isArray(resposta) ? resposta : resposta?.itens || []).slice(0, CATEGORIAS_NA_TELA);

    lista.innerHTML = categorias.length
      ? categorias.map((c) => {
        const id = c.idCategoria ?? c.id;
        return `
          <li class="col">
            <a class="inicio-categoria" href="${linkPara('resultados', { categoria: id })}">
              <span class="inicio-categoria__img"><i class="bi ${iconeCategoria(c.nome)}" aria-hidden="true"></i></span>
              <span class="inicio-categoria__nome">${esc(c.nome)}</span>
            </a>
          </li>`;
      }).join('')
      : `<li class="col w-100"><div class="inicio-estado"><p>Nenhuma categoria cadastrada ainda.</p></div></li>`;
  } catch (erro) {
    lista.innerHTML = `
      <li class="col w-100">
        <div class="inicio-estado">
          <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
          <p>${esc(erro?.mensagem || 'Não foi possível carregar as categorias.')}</p>
          <button type="button" class="btn btn--contorno" id="tentar-categorias">Tentar novamente</button>
        </div>
      </li>`;
    document.getElementById('tentar-categorias').addEventListener('click', carregarCategorias);
  } finally {
    lista.removeAttribute('aria-busy');
  }
}

// ---------- Vitrines de peças ----------

async function carregarSecao(nome) {
  const secao = SECOES[nome];
  const lista = document.getElementById(secao.lista);
  lista.setAttribute('aria-busy', 'true');
  lista.innerHTML = htmlCardsCarregando(secao.quantidade);

  try {
    const { itens = [] } = await buscarPecas(secao.filtros());
    itens.forEach((p) => pecasNaTela.set(Number(p.idPeca), p));

    lista.innerHTML = itens.length
      ? itens.map((p) => `<div class="col">${htmlCardPeca(p)}</div>`).join('')
      : htmlEstado({
        icone: 'bi-search',
        texto: secao.vazio,
        botao: `<a class="btn btn--contorno" href="${linkPara('resultados')}">Ver todas as peças</a>`,
      });
  } catch (erro) {
    lista.innerHTML = htmlEstado({
      icone: 'bi-exclamation-circle',
      texto: erro?.mensagem || 'Não foi possível carregar as peças.',
      botao: `<button type="button" class="btn btn--contorno" data-acao="tentar-novamente" data-secao="${nome}">Tentar novamente</button>`,
    });
  } finally {
    lista.removeAttribute('aria-busy');
  }
}

// Visitante vai para o login e, ao entrar, volta para a peça (Documentação do Front-end)
function irParaLogin(idPeca) {
  window.location.href = linkLogin(linkPara('detalhePeca', { id: idPeca }));
}

async function adicionar(botao, idPeca) {
  const usuario = await usuarioLogado();
  if (!usuario) return irParaLogin(idPeca);

  const peca = pecasNaTela.get(idPeca);
  definirCarregando(botao, true);
  try {
    const resposta = await adicionarAoCarrinho(idPeca, 1);
    if (typeof resposta?.quantidadeTotal === 'number') {
      // O cabeçalho escuta este evento e atualiza o contador sem chamar a API de novo
      document.dispatchEvent(new CustomEvent('carrinho:atualizado', { detail: { quantidade: resposta.quantidadeTotal } }));
    }
    mostrarAviso({
      tipo: 'sucesso',
      texto: `Adicionado ao carrinho: ${peca?.titulo || 'peça'}.`,
      link: { href: linkPara('carrinho'), texto: 'Ver carrinho' },
    });
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin(idPeca); // sessão encerrada
    mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
  } finally {
    definirCarregando(botao, false);
  }
}

async function favoritar(botao, idPeca) {
  const usuario = await usuarioLogado();
  if (!usuario) return irParaLogin(idPeca);

  const peca = pecasNaTela.get(idPeca);
  const titulo = peca?.titulo || 'peça';
  const favoritar = botao.getAttribute('aria-pressed') !== 'true';

  definirCarregando(botao, true);
  try {
    if (favoritar) await adicionarFavorito(idPeca);
    else await removerFavorito(idPeca);

    if (peca) peca.favorito = favoritar;
    // A mesma peça pode estar nas duas vitrines: atualiza todos os corações dela
    document.querySelectorAll(`.card-peca[data-id-peca="${idPeca}"] [data-acao="favorito"]`).forEach((b) => {
      if (b !== botao) definirFavorito(b, favoritar, titulo);
    });
    definirFavorito(botao, favoritar, titulo);

    mostrarAviso(favoritar
      ? { tipo: 'sucesso', texto: 'Peça salva nos favoritos.', link: { href: linkPara('favoritos'), texto: 'Ver favoritos' } }
      : { tipo: 'sucesso', texto: 'Peça removida dos favoritos.' });
  } catch (erro) {
    if (erro?.status === 401) return irParaLogin(idPeca);
    mostrarAviso({ tipo: 'erro', texto: erro?.mensagem || ERRO_GENERICO });
  } finally {
    definirCarregando(botao, false);
  }
}

function ligarVitrines() {
  Object.values(SECOES).forEach(({ lista: id }) => {
    const lista = document.getElementById(id);
    ligarImagensPadrao(lista);

    lista.addEventListener('click', (evento) => {
      const botao = evento.target.closest('[data-acao]');
      if (!botao || botao.disabled) return;

      if (botao.dataset.acao === 'tentar-novamente') return carregarSecao(botao.dataset.secao);

      const idPeca = Number(botao.closest('[data-id-peca]')?.dataset.idPeca);
      if (!idPeca) return;
      if (botao.dataset.acao === 'carrinho') adicionar(botao, idPeca);
      if (botao.dataset.acao === 'favorito') favoritar(botao, idPeca);
    });
  });
}

// ---------- Links de venda (Comprar sem complicar / Anuncie suas peças) ----------

function ajustarLinksDeVenda(usuario) {
  const criarLoja = document.getElementById('link-criar-loja');
  const comecar = document.getElementById('link-comecar-vender');

  if (!usuario) {
    // Visitante: entra (ou cria conta) e volta para Criar loja
    criarLoja.href = linkLogin(linkPara('criarLoja'));
    comecar.href = linkLogin(linkPara('criarLoja'));
    return;
  }
  if (temLoja(usuario)) {
    criarLoja.href = linkPara('painelLoja');
    criarLoja.textContent = 'Ir para Minha Loja';
    comecar.href = linkPara('novaPeca');
    comecar.querySelector('[data-texto]').textContent = 'Anunciar uma peça';
  }
}

// ---------- Início ----------

function iniciar() {
  ligarBusca();
  ligarLocalizacao();
  ligarVitrines();
  mostrarLocalizacao(null);

  carregarCategorias();
  carregarSecao('destaque');
  carregarSecao('revisao');

  usuarioLogado().then((usuario) => {
    mostrarLocalizacao(usuario);
    ajustarLinksDeVenda(usuario);
  });
}

iniciar();
