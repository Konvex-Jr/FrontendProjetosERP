/**
 * Há linha com `id` que ainda não estava entre os já vistos? Usada pela `Table` com `reiniciarAoIncluir`:
 * quem acabou de ser adicionado precisa aparecer, mesmo que a busca ou o filtro em uso o escondessem.
 */
export function haLinhaNova(idsVistos, linhas) {
  return linhas.some(l => !idsVistos.has(l.id))
}

/** Compara dois valores para ordenar a tabela: texto em ordem alfabética do português (sem ligar para acento e maiúscula), números pela grandeza. */
export function comparar(x, y) {
  const vazio = v => v === undefined || v === null || v === ''
  if (vazio(x) || vazio(y)) return vazio(x) === vazio(y) ? 0 : vazio(x) ? 1 : -1
  if (typeof x === 'string' || typeof y === 'string')
    return String(x).localeCompare(String(y), 'pt-BR', { sensitivity: 'base', numeric: true })
  return x > y ? 1 : x < y ? -1 : 0
}

/**
 * Página `pagina` (começa em 1) das `linhas`. Com tudo cabendo numa página, `paginas` é 1 e a tela esconde a paginação.
 * Página fora do intervalo (a lista encolheu depois de um filtro) cai na última que existe.
 */
export function paginar(linhas, pagina, porPagina) {
  // Sem limite (Infinity): uma página só (0 * Infinity daria NaN no início do corte).
  if (!Number.isFinite(porPagina)) return { itens: linhas, pagina: 1, paginas: 1, inicio: 0 }
  const paginas = Math.max(1, Math.ceil(linhas.length / porPagina))
  const atual = Math.min(Math.max(1, pagina), paginas)
  const inicio = (atual - 1) * porPagina
  return { itens: linhas.slice(inicio, inicio + porPagina), pagina: atual, paginas, inicio }
}
