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

As operações de projeto, tarefa, inscrição em capacitação, check-in, feedback e usuário são enviadas à API. Os alertas e confirmações usam uma abstração em `src/lib/alerts.js`, baseada no SweetAlert2, para centralizar o estilo e o comportamento.

## Limitações da API atual

A API disponibilizada não possui rotas para criar capacitações, editar feedbacks separadamente, reativar usuários, gerir competências/estratégia, nem persistir checklist de tarefas. Essas áreas não são simuladas como se estivessem persistidas no backend. O cadastro de documentos por URL e a gestão de pastas também não possuem telas dedicadas neste frontend.
