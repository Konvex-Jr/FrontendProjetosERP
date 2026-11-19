import { request } from './api.js'

const get = path => request(path, { auth: true })
const consulta = semana => (semana ? `?semana=${encodeURIComponent(semana)}` : '')

export const ocupacao = {
  todas: semana => get(`/ocupacao${consulta(semana)}`),
  dePessoa: (codigo, semana) => get(`/ocupacao/${codigo}${consulta(semana)}`),
}
