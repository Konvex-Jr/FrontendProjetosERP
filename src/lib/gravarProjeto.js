import { projetos } from '../services/projetos.js'

/**
 * Grava o formulário do projeto: cria (sem `antes`) ou edita. A Visibilidade vai sempre (quem edita o
 * projeto marca e desmarca o sigilo). Erros sobem como vieram, inclusive o 400 SIGILOSO_SEM_VOCE de
 * quem ficaria fora do projeto sigiloso.
 */
export async function gravarProjeto(dados, antes) {
  if (!antes) return projetos.criar(dados)
  return projetos.editar(antes.codigo, dados)
}
