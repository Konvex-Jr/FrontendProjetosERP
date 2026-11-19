import { request } from './api.js'
import { configuracoes } from './pessoas.js'
import { cargaPorPessoa } from '../lib/ocupacao.js'

const get = path => request(path, { auth: true })
const consulta = semana => (semana ? `?semana=${encodeURIComponent(semana)}` : '')

export const ocupacao = {
  todas: semana => get(`/ocupacao${consulta(semana)}`),
  dePessoa: (codigo, semana) => get(`/ocupacao/${codigo}${consulta(semana)}`),
}

/** Apoio ao formulário de tarefa: horas por dificuldade e % da semana. Nunca falha (vazio se a chamada falhar). */
export async function apoioTarefa(semana) {
  const [horas, lista] = await Promise.all([configuracoes.horasDificuldade().catch(() => null), ocupacao.todas(semana).catch(() => [])])
  return { horas, carga: cargaPorPessoa(lista) }
}
