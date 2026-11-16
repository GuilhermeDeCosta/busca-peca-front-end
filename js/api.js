/* =========================================================
   CLIENTE DA API • js/api.js
   Único arquivo que fala com a API (ADR-014).
   Código do PDF "Busca Peça API: guia do time", seção "Como o front chama a API".

   Três cuidados em toda chamada:
   1. credentials: 'include'  → o navegador envia o cookie HttpOnly do login
   2. CSRF em POST/PUT/PATCH/DELETE → cabeçalho X-XSRF-TOKEN (token buscado em GET /auth/csrf)
   3. Abrir o front em http://localhost:5500 (nunca 127.0.0.1:5500)

   Uso (só em scripts type="module"):
     import { api } from '../api.js';
     const categorias = await api.get('/categorias');
   Em erro, rejeita com { status, erro, mensagem, campos: [{ campo, mensagem }] }.
   ========================================================= */

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8080/api'
  : 'https://api.buscapeca.com.br/api';

const TEMPO_LIMITE_MS = 15000;

let tokenCsrf = null; // só em memória

async function chamar(metodo, rota, corpo, jaTentou = false) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    const headers = { Accept: 'application/json' };
    const ehForm = corpo instanceof FormData;
    if (corpo && !ehForm) headers['Content-Type'] = 'application/json';

    if (metodo !== 'GET') {
      if (!tokenCsrf) {
        const r = await fetch(API_URL + '/auth/csrf', { credentials: 'include' });
        tokenCsrf = (await r.json()).token;
      }
      headers['X-XSRF-TOKEN'] = tokenCsrf;
    }

    const resposta = await fetch(API_URL + rota, {
      method: metodo,
      credentials: 'include',
      headers,
      signal: controle.signal,
      body: corpo ? (ehForm ? corpo : JSON.stringify(corpo)) : undefined,
    });

    const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null);

    // Token CSRF vencido: busca outro e repete uma vez
    if (resposta.status === 403 && dados?.erro === 'CSRF_INVALIDO' && !jaTentou) {
      tokenCsrf = null;
      return chamar(metodo, rota, corpo, true);
    }

    if (!resposta.ok) throw dados || { status: resposta.status, mensagem: 'Não foi possível concluir.' };
    return dados;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (rota) => chamar('GET', rota),
  post: (rota, corpo) => chamar('POST', rota, corpo),
  put: (rota, corpo) => chamar('PUT', rota, corpo),
  patch: (rota, corpo) => chamar('PATCH', rota, corpo),
  delete: (rota) => chamar('DELETE', rota),
};
