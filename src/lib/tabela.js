/**
 * Há linha com `id` que ainda não estava entre os já vistos? Usada pela `Table` com `reiniciarAoIncluir`:
 * quem acabou de ser adicionado precisa aparecer, mesmo que a busca ou o filtro em uso o escondessem.
 */
export function haLinhaNova(idsVistos, linhas) {
  return linhas.some(l => !idsVistos.has(l.id))
}
