import { configuracoes, pessoas } from '../services/pessoas.js'
import { projetos } from '../services/projetos.js'
import { tarefas } from '../services/tarefas.js'
import { adaptTask } from './apiMappers.js'

/**
 * Dados da página de um projeto. Se a API devolver só o resumo (projeto sigiloso visto por
 * gerente fora da lista), as tarefas não são usadas: a busca delas é recusada e o erro é ignorado.
 * Qualquer outro erro, como o 404 de quem perdeu o acesso, sobe e a memória da aba apaga a chave.
 */
export async function carregarProjeto(codigo, gestor) {
  const buscaTarefas = tarefas.listar({ codigoProjeto: codigo }).catch(erro => ({ erro }))
  const [projeto, gente, areas] = await Promise.all([
    projetos.buscar(codigo),
    gestor ? pessoas.listar() : [],
    gestor ? configuracoes.areas() : [],
  ])
  if (projeto.resumo) return { projeto, gente, areas, tarefas: [] }
  const lista = await buscaTarefas
  if (lista.erro) throw lista.erro
  return { projeto, gente, areas, tarefas: lista.map(adaptTask) }
}
