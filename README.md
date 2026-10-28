# Busca Peça — Front-end

Site responsivo em HTML, CSS e JavaScript, sem framework e sem etapa de build (ADR-014).
Repositório separado do back-end (ADR-015).

## O que precisa para rodar

- **VS Code** com a extensão **Live Server** (o VS Code sugere a instalação ao abrir a pasta).
- **Nenhuma biblioteca para baixar.** Bootstrap 5.3, Bootstrap Icons e Alpine.js 3 são carregados
  por CDN com versão fixa, direto nas páginas HTML (conforme a documentação do front-end).
- A API (`buscapeca-backend`) rodando em `http://localhost:8080` para as telas que usam dados.

## Como rodar

1. Abra a pasta do projeto no VS Code.
2. Abra o `index.html` e clique em **Go Live** na barra inferior.
3. O site abre em **http://localhost:5500**.

Não abra o HTML com duplo clique e use sempre `localhost` (não `127.0.0.1`), senão o login não funciona.

## Estrutura de pastas

| Pasta | O que vai dentro |
|---|---|
| `pages/auth/` | login, cadastro, recuperar-senha, redefinir-senha |
| `pages/busca/` | resultados, detalhe-peca, loja-publica |
| `pages/compra/` | carrinho, checkout, minhas-compras, detalhe-pedido |
| `pages/conta/` | perfil, enderecos, favoritos, buscas-salvas, notificacoes, conversas |
| `pages/minha-loja/` | painel, criar-loja, pecas, form-peca, pedidos, configuracoes |
| `pages/admin/` | usuarios, termos, notificacoes, disputas |
| `pages/institucional/` | termos-de-uso, politica-de-privacidade, sobre |
| `css/` | variaveis.css, base.css, componentes.css |
| `js/` | config.js, api.js, auth.js |
| `js/services/` | uma função por rota da API, por domínio |
| `js/components/` | cabeçalho, rodapé, card, avisos |
| `js/utils/` | formatação, máscaras, validações simples |
| `js/pages/` | um arquivo por página, mesma divisão de `pages/` |
| `assets/img/` | logo, ilustrações, imagem padrão de peça sem foto |
| `assets/favicon/` | ícones do site |

Na raiz ficarão também `index.html` (página inicial) e `404.html` (página não encontrada).

**Regra de nomes:** minúsculas com hífen (`form-peca.html`, `form-peca.js`). Cada página HTML tem um
arquivo JS com o mesmo nome na pasta equivalente de `js/pages/`.

> Os arquivos `.gitkeep` existem só porque o Git não guarda pastas vazias.
> Pode apagar cada um quando a pasta receber o primeiro arquivo.

## Git

- `main` protegida: tudo entra por pull request revisado por outro integrante.
- Uma branch por página ou funcionalidade (ex.: `feature/login`, `feature/form-peca`).

## O que já foi feito

- [x] Estrutura de pastas e configuração do repositório
