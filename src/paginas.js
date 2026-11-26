import carregarPagina from './lib/carregarPagina'

// Cada página vira um arquivo separado, baixado na primeira visita (ou antes, pelo menu:
// src/lib/antecipar.js). Fica fora do App.jsx porque o Layout também usa e o App importa o Layout.
export const Dashboard = carregarPagina(() => import('./pages/Dashboard'))
export const Projetos = carregarPagina(() => import('./pages/Projetos'))
export const Projeto = carregarPagina(() => import('./pages/Projeto'))
export const Tarefas = carregarPagina(() => import('./pages/Tarefas'))
export const Capacitacoes = carregarPagina(() => import('./pages/Capacitacoes'))
export const Estrategia = carregarPagina(() => import('./pages/Estrategia'))
export const Biblioteca = carregarPagina(() => import('./pages/Biblioteca'))
export const Precificacao = carregarPagina(() => import('./pages/Precificacao'))
export const Pessoas = carregarPagina(() => import('./pages/Pessoas'))
export const Perfil = carregarPagina(() => import('./pages/Perfil'))
export const Configuracoes = carregarPagina(() => import('./pages/Configuracoes'))
export const CompletarPerfil = carregarPagina(() => import('./pages/CompletarPerfil'))
export const CriarSenha = carregarPagina(() => import('./pages/CriarSenha'))
export const EsqueciSenha = carregarPagina(() => import('./pages/EsqueciSenha'))

/** Caminho do menu (`nav`, vindo da API) → página. O menu baixa essas páginas com antecedência. */
export const PAGINAS = {
  '/': Dashboard,
  '/tarefas': Tarefas,
  '/projetos': Projetos,
  '/capacitacoes': Capacitacoes,
  '/biblioteca': Biblioteca,
  '/estrategia': Estrategia,
  '/precificacao': Precificacao,
  '/usuarios': Pessoas,
  '/perfil': Perfil,
  '/configuracoes': Configuracoes,
}
