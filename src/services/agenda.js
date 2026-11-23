import { request } from './api.js'

const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, body, auth: true })

/** Agenda unificada e reuniões (sessão 28b). */
export const agenda = {
  periodo: (de, ate, pessoa) =>
    get(`/agenda?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}${pessoa ? `&pessoa=${encodeURIComponent(pessoa)}` : ''}`),
  reuniao: codigo => get(`/reunioes/${codigo}`),
  criar: corpo => send('POST', '/reunioes', corpo),
  editar: (codigo, corpo) => send('PUT', `/reunioes/${codigo}`, corpo),
  excluir: codigo => send('DELETE', `/reunioes/${codigo}`),
}
