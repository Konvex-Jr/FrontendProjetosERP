# Konvex Gestão — Frontend

Frontend React + Vite integrado à API de Gestão de Projetos.

## Requisitos

- Node.js compatível com a versão do Vite usada pelo projeto.
- API backend em execução e banco de dados configurado.

## Configuração

Instale as dependências:

```bash
npm install
```

Copie `.env.example` para `.env` e ajuste a URL da API:

```env
VITE_API_URL=http://localhost:5001
```

Inicie o frontend:

```bash
npm run dev
```

A documentação Swagger do backend fica em `http://localhost:5001/api-docs`.

## Integração implementada

O frontend usa `/auth/login`, `/usuarios`, `/projetos`, `/tarefas`, `/capacitacoes`, `/checkins` e `/feedbacks`. As chamadas autenticadas enviam o JWT no header `access-token`. A sessão é armazenada em `sessionStorage`.

As operações de projeto, tarefa (incluindo checklist), inscrição em capacitação, check-in, feedback, usuário, pastas e metadados de documentos são enviadas à API. O token JWT é enviado no cabeçalho `access-token`. Os alertas e confirmações são centralizados em `src/lib/alerts.js`, baseado no SweetAlert2.

## Limitações da API atual

A API atual não disponibiliza rotas para criar/editar capacitações nem reativar usuários. A tela de precificação é uma simulação local: alterações de valores, horas, margem e impostos não alteram os cadastros da API. Documentos são cadastrados por URL; o backend armazena metadados, não recebe arquivos binários.

### Docker

A imagem do frontend usa `VITE_API_URL=http://localhost:5001` por padrão, alinhado à porta padrão do backend. Ao publicar em outro host, passe `--build-arg VITE_API_URL=https://seu-host-da-api` ao construir a imagem. A URL precisa ser acessível pelo navegador do usuário.


## Testes e senioridades
- `npm test`: executa os testes do cliente HTTP, mapeadores e contratos de chamadas para todas as rotas HTTP declaradas pelo backend.
- `npm run build`: valida o build de produção.
- As opções de senioridade na tela de usuários são carregadas exclusivamente de `GET /senioridades`, que lê a tabela `senioridades` do banco. Não há opções fictícias de fallback nessa tela. Se a API retornar uma lista vazia, verifique se o schema foi aplicado e se a tabela contém registros.

## Testes e CI

- `npm test`: testes das funções puras (`test/`).
- `npm run e2e`: levantamento no navegador (`e2e/levantamento.mjs`). Entra como diretora, gerente e membro e abre todas as telas do menu em 1366 px e 375 px; falha com erro no console, "NaN" na tela ou rolagem horizontal. Precisa da API de desenvolvimento com dados fictícios (no backend: `npm run dev:docker && npm run dados:ficticios`) e do Playwright (`npm i -g playwright && npx playwright install chromium`). Prints em `e2e/prints/`.
- Todo PR roda testes e build no GitHub Actions (`.github/workflows/ci.yml`). A `main` só recebe mudanças por PR com o CI verde.

## Desempenho

O que a pessoa baixa para abrir o sistema tem limite, e o CI cobra.

- `npm run orcamento` (`scripts/orcamento.mjs`): roda no CI depois do build e falha se o `dist/` passar dos limites, medidos em gzip:
  - `index.html` ≤ 2 KB;
  - JS de entrada ≤ 85 KB (hoje ~69 KB);
  - CSS ≤ 50 KB.
- `npm run desempenho` (`e2e/desempenho.mjs`): serve o `dist/` com gzip e os mesmos cabeçalhos de cache do `nginx.conf` e roda o Lighthouse 12 (via `npx`, perfil de celular) na tela de login. Mínimos: desempenho 90, acessibilidade 100, boas práticas 100. Precisa de `npm run build` antes e de um Chrome instalado (se não for achado, use `CHROME_PATH=/caminho/do/chrome`). Para medir outro endereço: `APP_URL=https://... npm run desempenho`.

Se o orçamento estourar, quase sempre é algo pesado importado direto no pacote de entrada. As páginas usam `lazy()` (`src/lib/carregarPagina.js`) e o SweetAlert2 é importado só no primeiro alerta (`src/lib/alerts.js`); siga o mesmo caminho.

O `nginx.conf` comprime com gzip, guarda por 1 ano os arquivos com hash no nome (`/assets/*-<hash>.js|css|woff2`), por 7 dias imagens e ícones e manda `no-cache` no `index.html`. A fonte Inter vem do pacote `@fontsource-variable/inter`, sem Google Fonts.

O sistema é interno e fica fora do Google: `public/robots.txt` com `Disallow: /` e `<meta name="robots" content="noindex">` no `index.html`. Por isso o Lighthouse não mede SEO.
