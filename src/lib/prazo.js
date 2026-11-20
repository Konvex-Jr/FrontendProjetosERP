import { d } from './utils.js'
import { fimDaSemana } from './indicadores.js'

/** Opções do seletor de prazo (Tarefas e quadro do projeto). */
export const PRAZOS = [
  ['', 'Prazo: todos'],
  ['atrasadas', 'Atrasadas'],
  ['semana', 'Vencem esta semana'],
]

/** Filtro de prazo (só na tela): atrasadas = abertas com prazo antes de hoje; semana = abertas que vencem de hoje até domingo. */
export function noPrazo(t, prazo, hoje) {
  if (!prazo) return true
  if (t.status == 'concluida') return false
  const fim = d(t.fim)
  if (prazo == 'atrasadas') return fim < hoje
  return fim >= hoje && fim <= fimDaSemana(hoje)
}
