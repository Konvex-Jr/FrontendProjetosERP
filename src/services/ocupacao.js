import { request } from './api.js'
import { configuracoes } from './pessoas.js'
import { cargaPorPessoa, segundaDaSemana } from '../lib/ocupacao.js'

const get = path => request(path, { auth: true })
const consulta = semana => (semana ? `?semana=${encodeURIComponent(semana)}` : '')

export const ocupacao = {
  todas: semana => get(`/ocupacao${consulta(semana)}`),
  dePessoa: (codigo, semana) => get(`/ocupacao/${codigo}${consulta(semana)}`),
}

/**
 * Apoio ao formulário de tarefa: horas por dificuldade e % da semana do `dia` (AAAA-MM-DD).
 * Nunca lança: dia inválido, chamada que falha ou resposta estranha viram `{ horas: null, carga: {} }`.
 */
export async function apoioTarefa(dia) {
  try {
    const semana = dia ? segundaDaSemana(dia) : undefined
    const [horas, lista] = await Promise.all([configuracoes.horasDificuldade().catch(() => null), ocupacao.todas(semana).catch(() => [])])
    return { horas, carga: cargaPorPessoa(lista) }
  } catch {
    return { horas: null, carga: {} }
  }
}
