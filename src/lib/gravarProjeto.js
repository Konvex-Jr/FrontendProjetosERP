import { projetos } from '../services/projetos.js'

/**
 * Grava o formulário do projeto: cria (sem `antes`) ou edita. Erros sobem como vieram, inclusive o
 * 400 SEM_ACESSO_AO_CRIAR de quem ficaria sem acesso ao projeto que cria (sessão 31a).
 */
export async function gravarProjeto(dados, antes) {
  if (!antes) return projetos.criar(dados)
  return projetos.editar(antes.codigo, dados)
}
