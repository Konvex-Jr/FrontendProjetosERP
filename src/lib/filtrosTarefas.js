import { aoTrocarPessoa } from './memoriasDaAba.js'

// Filtros e visão da tela Tarefas, guardados só na memória da aba (nada em localStorage). Cada
// registro é de uma pessoa: outra pessoa não lê, e a troca de conta ou o fim da sessão apagam tudo.
const guardados = new Map()

/** Filtros guardados da pessoa ({ filtro, visao }) ou undefined. */
export function lerFiltros(pessoa) {
  return pessoa ? guardados.get(pessoa) : undefined
}

/** Guarda os filtros da pessoa; sem pessoa (ainda não carregou) não guarda nada. */
export function guardarFiltros(pessoa, filtros) {
  if (pessoa) guardados.set(pessoa, filtros)
}

export function esquecerFiltros() {
  guardados.clear()
}

aoTrocarPessoa(esquecerFiltros)
