import { request } from './api.js'

export const avisos = {
  listar: () => request('/avisos', { auth: true }),
  marcarLidos: codigos => request('/avisos/lidos', { method: 'PATCH', auth: true, body: codigos ? { codigos } : {} }),
}
