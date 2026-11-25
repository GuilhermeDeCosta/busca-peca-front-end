/* =========================================================
   AVISOS (toast) • js/components/aviso.js
   Estilos em css/componentes.css ("AVISO FLUTUANTE").

   Documentação do Front-end: "Avisos (toast) • Todas as páginas •
   Mensagens rápidas de sucesso e erro no canto da tela".

   Uso:
     import { mostrarAviso } from '../../components/aviso.js';
     mostrarAviso({ tipo: 'sucesso', texto: 'Peça salva.', link: { href: '...', texto: 'Ver favoritos' } });
     mostrarAviso({ tipo: 'erro', texto: 'Não foi possível concluir. Tente novamente.' });
   ========================================================= */
import { escaparHtml as esc } from '../utils/formatacao.js';

const DURACAO_PADRAO_MS = 6000;
let regiao = null;
let temporizador = null;

function criarRegiao() {
  regiao = document.createElement('div');
  regiao.className = 'aviso-flutuante';
  regiao.setAttribute('aria-live', 'polite');
  document.body.appendChild(regiao);

  regiao.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-fechar-aviso]')) fecharAviso();
  });
  // Mouse em cima ou foco dentro: o aviso espera para sumir
  regiao.addEventListener('mouseenter', () => clearTimeout(temporizador));
  regiao.addEventListener('focusin', () => clearTimeout(temporizador));
}

export function mostrarAviso({ tipo = 'sucesso', texto, link, duracaoMs = DURACAO_PADRAO_MS }) {
  if (!regiao) criarRegiao();
  clearTimeout(temporizador);

  const icone = tipo === 'erro' ? 'bi-exclamation-circle' : 'bi-check-circle';
  regiao.innerHTML = `
    <div class="aviso aviso--${tipo === 'erro' ? 'erro' : 'sucesso'} d-flex align-items-start gap-2 shadow-sm"
         ${tipo === 'erro' ? 'role="alert"' : ''}>
      <i class="bi ${icone} mt-1" aria-hidden="true"></i>
      <div class="flex-grow-1">
        ${esc(texto)}
        ${link ? `<a class="aviso__link" href="${esc(link.href)}">${esc(link.texto)}</a>` : ''}
      </div>
      <button type="button" class="btn-close" data-fechar-aviso aria-label="Fechar aviso"></button>
    </div>`;

  temporizador = setTimeout(fecharAviso, duracaoMs);
}

export function fecharAviso() {
  clearTimeout(temporizador);
  if (regiao) regiao.innerHTML = '';
}
