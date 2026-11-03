/**
 * Atalho de uma tela para outra com um filtro já escolhido (ex.: indicador do Dashboard
 * "Tarefas atrasadas" abre o painel Tarefas já filtrado). Fica só na memória:
 * a tela de destino lê uma vez ao abrir; recarregar a página volta ao padrão.
 */
const pendentes = new Map()

export const abrirCom = (tela, filtro) => pendentes.set(tela, filtro)

/** Lê o filtro pendente. Apaga logo depois (não na hora: o StrictMode chama o inicializador duas vezes). */
export function consumir(tela) {
  const filtro = pendentes.get(tela)
  if (filtro) setTimeout(() => pendentes.delete(tela), 0)
  return filtro
}
