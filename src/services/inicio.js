import { request } from './api.js'
import { adaptProject, adaptTask, adaptUser } from '../lib/apiMappers.js'
import { capacitacoes } from './capacitacoes.js'

/**
 * Carregamento do app logado. Antes, o início esperava `/auth/me` responder para só então pedir
 * os dados e o menu: duas rodadas seguidas pela rede. Aqui tudo sai junto, numa rodada só.
 */

/** Ações liberadas e menu da pessoa logada (GET /auth/permissoes); a API continua checando cada ação. */
export async function carregarAcesso() {
  const result = await request('/auth/permissoes', { auth: true })
  // Sessão 31a: o cargo atual (nome, posição, área) substitui o perfil fixo.
  return { permissoes: result?.permissoes || [], menu: result?.menu || [], cargo: result?.cargo ?? null }
}

/** Dados compartilhados por várias telas, carregados juntos no início, no login e a cada refresh. */
export async function carregarDadosGlobais() {
  const [users, projects, tasks, trainings, senioridades] = await Promise.all([
    request('/usuarios', { auth: true }),
    request('/projetos', { auth: true }),
    request('/tarefas', { auth: true }),
    capacitacoes.listar(),
    request('/senioridades', { auth: true }),
  ])
  return {
    u: users.map(adaptUser),
    p: projects.map(adaptProject),
    t: tasks.map(adaptTask),
    // Capacitações já adaptadas (services/capacitacoes.js); usadas no Dashboard e na Visão Estratégica.
    k: trainings,
    senioridades,
  }
}

/**
 * Abrir ou recarregar a página com sessão salva: confere a pessoa, carrega os dados e o menu
 * ao mesmo tempo. Se `/auth/me` falhar (ex.: 401 de sessão vencida), rejeita com o erro dele,
 * que traz o `status` usado pelo contexto para decidir se mostra alerta.
 */
export async function carregarInicio() {
  const [eu, dados, acesso] = await Promise.all([request('/auth/me', { auth: true }), carregarDadosGlobais(), carregarAcesso()])
  return { eu, dados, acesso }
}
