import { configuracoes, pessoas } from '../services/pessoas.js'
import { projetos } from '../services/projetos.js'
import { tarefas } from '../services/tarefas.js'
import { adaptTask } from './apiMappers.js'

/**
 * Dados da página de um projeto. Se a API devolver só o cartão (projeto de que a pessoa não vê os
 * detalhes), as tarefas não são usadas: a busca delas, feita junto para não esperar duas rodadas,
 * devolve 200 com a lista vazia (a API filtra o que a pessoa não vê), e o resultado é descartado.
 * Fora do cartão, qualquer erro dessa busca sobe e a memória da aba apaga a chave.
 */
export async function carregarProjeto(codigo, gestor) {
  const buscaTarefas = tarefas.listar({ codigoProjeto: codigo }).catch(erro => ({ erro }))
  // Classes (31b): para o formulário de edição, como pessoas e áreas.
  const [projeto, gente, areas, classes] = await Promise.all([
    projetos.buscar(codigo),
    gestor ? pessoas.listar() : [],
    gestor ? configuracoes.areas() : [],
    gestor ? configuracoes.classes() : [],
  ])
  if (projeto.cartao) return { projeto, gente, areas, classes, tarefas: [] }
  const lista = await buscaTarefas
  if (lista.erro) throw lista.erro
  return { projeto, gente, areas, classes, tarefas: lista.map(adaptTask) }
}
