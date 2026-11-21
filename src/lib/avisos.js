import { fm } from './utils.js'

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

/** Texto curto de um aviso (gravado ou da situação). A API já traz os nomes. */
export function textoAviso(item) {
  switch (item.tipo) {
    case 'tarefa_recebida':
      return `${item.autor ? `${item.autor.nome} te deu` : 'Você recebeu'} “${item.tarefa.titulo}”`
    case 'capacitacao_nova':
      return `Nova capacitação: ${item.capacitacao.titulo}, ${fm(item.capacitacao.data)}`
    case 'capacitacao_proxima':
      return `Capacitação: ${item.capacitacao.titulo}, ${fm(item.capacitacao.data)} às ${item.capacitacao.hora}`
    case 'tarefas_atrasadas':
      return plural(item.tarefas.length, 'tarefa atrasada', 'tarefas atrasadas')
    case 'tarefas_a_vencer':
      return plural(item.tarefas.length, 'tarefa a vencer', 'tarefas a vencer')
    case 'sobrecarga':
      if (item.pessoas) return plural(item.pessoas.length, 'pessoa acima do teto', 'pessoas acima do teto')
      return `${item.nome}: ${Math.round(item.percentual)}%`
    default:
      return ''
  }
}

/** Rota do aviso; null quando é um grupo (a tela abre a lista). */
export function destinoAviso(item) {
  if (item.tipo === 'tarefa_recebida') return `/tarefas?tarefa=${item.tarefa.codigo}`
  if (item.tipo === 'capacitacao_nova' || item.tipo === 'capacitacao_proxima') return `/capacitacoes/${item.capacitacao.codigo}`
  if (item.tipo === 'sobrecarga' && item.codigoUsuario) return `/perfil/${item.codigoUsuario}`
  return null
}

export const temAlerta = situacao => (situacao || []).some(i => i.tipo === 'tarefas_atrasadas' || i.tipo === 'sobrecarga')

/** Chave da memória dos avisos de uma pessoa. */
export const chaveAvisos = codigoPessoa => `avisos:${codigoPessoa}`
