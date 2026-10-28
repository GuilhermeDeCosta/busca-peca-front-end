# Busca Peça — Front-end

Site responsivo do **Busca Peça** feito em HTML, CSS e JavaScript, sem framework e sem etapa de build (ADR-014).
Este repositório é separado do back-end e conversa com a API apenas por requisições JSON (ADR-001, ADR-015).

---

## Dependências

### O que você precisa instalar no computador

| Ferramenta | Para que serve | Onde baixar |
|---|---|---|
| **Git** | Clonar o repositório e enviar alterações | https://git-scm.com/downloads |
| **VS Code** | Editor do projeto | https://code.visualstudio.com/ |
| **Extensão Live Server** (VS Code) | Servidor local que abre o site em `localhost:5500` | Instalada pelo próprio VS Code (passo 4) |
| **Navegador atualizado** | Chrome, Edge, Firefox ou Safari | — |
| **Back-end rodando** | Fornece os dados (peças, login, pedidos) | Repositório `buscapeca-backend` |

Não é preciso instalar Node.js, npm nem nenhum pacote.

### Bibliotecas usadas pelo site (não precisam ser baixadas)

As bibliotecas são carregadas pela internet (CDN), com versão fixa, por links dentro de cada página HTML.
Por isso, **é preciso estar conectado à internet** para o site aparecer com o visual correto.

| Biblioteca | Versão | Uso |
|---|---|---|
| Bootstrap | 5.3 | Layout, grid, botões, formulários, janelas e avisos |
| Bootstrap Icons | 1.11 | Ícones |
| Alpine.js | 3 | Telas que mudam sem recarregar (carrinho, filtros, checkout) |

---

## Passo a passo para rodar

### 1. Ter acesso ao repositório

Peça para o dono do repositório te adicionar como colaborador e aceite o convite que chega por e-mail.

### 2. Entrar no GitHub pelo VS Code

1. Abra o VS Code.
2. Clique no ícone de **Contas** (bonequinho) no canto inferior esquerdo.
3. Escolha **Entrar com GitHub** e autorize no navegador.

### 3. Clonar o repositório

**Pelo VS Code (recomendado):**

1. Pressione **Ctrl+Shift+P** (no Mac, **Cmd+Shift+P**).
2. Digite **Git: Clone** e escolha **Clone from GitHub**.
3. Selecione o repositório `buscapeca-frontend`.
4. Escolha a pasta do computador onde o projeto vai ficar.
5. Quando o VS Code perguntar, clique em **Abrir**.

**Ou pelo terminal:**

```
git clone https://github.com/<usuario-ou-organizacao>/buscapeca-frontend.git
```

Depois, no VS Code, vá em **Arquivo → Abrir Pasta** e escolha a pasta `buscapeca-frontend`.

### 4. Instalar a extensão recomendada

Ao abrir a pasta, o VS Code mostra o aviso *"Este workspace tem extensões recomendadas"*.
Clique em **Instalar**. Isso instala o **Live Server**.

Se o aviso não aparecer: abra a aba **Extensões** (Ctrl+Shift+X), pesquise **Live Server** (autor: Ritwick Dey) e clique em **Instalar**.

### 5. Iniciar o back-end

Para as telas que mostram dados funcionarem, a API precisa estar rodando em **http://localhost:8080**.
Siga o README do repositório `buscapeca-backend` para iniciá-la.

Sem o back-end, o site abre normalmente, mas as listas ficam vazias e o login não funciona.

### 6. Rodar o site

1. No VS Code, abra o arquivo `index.html`.
2. Clique em **Go Live** na barra azul inferior.
3. O navegador abre em **http://localhost:5500**.

Para parar o servidor, clique em **Port: 5500** na mesma barra.

### 7. Cuidados importantes

- **Não abra o HTML com duplo clique.** O site usa módulos JavaScript e só funciona por um servidor local (Live Server).
- **Use sempre `localhost`, nunca `127.0.0.1`.** O navegador trata os dois como sites diferentes e o cookie de login não é enviado.
- **A porta precisa ser 5500.** É o endereço liberado no back-end (variável `FRONT_ORIGEM`). Quem usar outro servidor, como o do IntelliJ (porta 63342), precisa ajustar `FRONT_ORIGEM` no back-end.

---

## Problemas comuns

| O que acontece | Causa provável | Como resolver |
|---|---|---|
| Aparece uma lista de pastas em vez do site | Ainda não existe `index.html` na raiz | Normal no início do projeto |
| Página sem estilo, só texto | Sem internet (as bibliotecas vêm por CDN) | Conecte-se à internet e recarregue |
| Página em branco | HTML aberto com duplo clique | Abra pelo **Go Live** |
| Login não mantém a sessão | Site aberto por `127.0.0.1` | Troque o endereço para `localhost:5500` |
| Erro de CORS no console (F12) | Back-end parado ou porta diferente de 5500 | Inicie o back-end e confira a porta |
| Listas vazias ou "Não foi possível carregar" | API não está rodando | Inicie o back-end em `localhost:8080` |
| **Go Live** não aparece | Live Server não instalado | Repita o passo 4 |

---

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

Na raiz ficam `index.html` (página inicial) e `404.html` (página não encontrada).

**Regra de nomes:** minúsculas com hífen (`form-peca.html`, `form-peca.js`). Cada página HTML tem um arquivo JS com o mesmo nome na pasta equivalente de `js/pages/`.

Os arquivos `.gitkeep` existem só porque o Git não guarda pastas vazias. Podem ser apagados quando a pasta receber o primeiro arquivo.

---

## Como contribuir

A branch `main` é protegida: ninguém envia direto para ela. Todo trabalho entra por pull request.

1. **Atualize a main:** clique no nome da branch no canto inferior esquerdo do VS Code, escolha **main** e clique em **Sync**.
2. **Crie uma branch** para a tarefa: clique no nome da branch → **Create new branch** → ex.: `feature/login`.
3. **Faça as alterações** e teste com o **Go Live** no celular (modo responsivo do navegador, F12) e no desktop.
4. **Faça o commit** no painel **Controle do Código-Fonte** (Ctrl+Shift+G) com uma mensagem curta, ex.: `feat: tela de login`.
5. **Envie** com **Publish Branch**.
6. **Abra o Pull Request** no GitHub (botão **Compare & pull request**) e escolha um colega como revisor.
7. Depois da aprovação, clique em **Squash and merge**.

Padrão das mensagens de commit: `feat:` (novidade), `fix:` (correção), `style:` (visual), `docs:` (documentação), `refactor:` (reorganização sem mudar comportamento).

---

## O que já foi feito

- [x] Estrutura de pastas e configuração do repositório
- [ ] Etapa 1 — Base: estilos da marca, configuração da API, cabeçalho, rodapé, avisos, página 404
- [ ] Etapa 2 — Autenticação: login, cadastro, recuperar e redefinir senha
- [ ] Etapa 3 — Página inicial: busca em destaque e categorias
- [ ] Etapa 4 — Minha Loja: criar loja, painel, minhas peças, formulário de peça
- [ ] Etapa 5 — Autopreenchimento por código da peça
- [ ] Etapa 6 — Busca: resultados com filtros, detalhe da peça, loja pública, favoritos
- [ ] Etapa 7 — Compra: carrinho, checkout, minhas compras, pedidos recebidos
- [ ] Etapa 8 — Comunicação e pós-venda: conversas, notificações, avaliação
- [ ] Etapa 9 — Administração: usuários, termos, notificações gerais, disputas

Atualize esta lista a cada etapa concluída.