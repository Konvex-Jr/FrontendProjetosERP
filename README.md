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
