import { request } from './api.js'

/** Regras da simulação (GET: quem simula; PUT: diretores). A simulação em si não é gravada. */
export const precificacao = {
  regras: () => request('/config/precificacao', { auth: true }),
  salvarRegras: regras => request('/config/precificacao', { method: 'PUT', auth: true, body: regras }),
}
