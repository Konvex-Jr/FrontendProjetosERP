import { request } from './api.js'
import { clientesParaApi } from '../lib/clientesProjeto.js'

/**
 * Chamadas diretas do módulo Projetos e da aba Equipe.
 * Substituem o caminho antigo (up('p') + persistCollection).
 */
const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, auth: true, body })

/** Campos vazios do formulário viram null, para a API limpar o valor. */
const vazioComoNull = dados => Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, v === '' ? null : v]))
const numeroOuNada = v => (v === '' || v === null || v === undefined ? undefined : Number(v))

export const STATUS_PROJETO = [
  ['em_execucao', 'Em andamento'],
  ['atencao', 'Atenção'],
  ['bloqueado', 'Bloqueado'],
  ['concluido', 'Concluído'],
  ['arquivado', 'Arquivado'],
]
export const COR_STATUS_PROJETO = { em_execucao: '', atencao: 'wa', bloqueado: 'er', concluido: 'ok', arquivado: '' }
export const PRIORIDADE_PROJETO = [
  ['alta', 'Alta'],
  ['media', 'Média'],
  ['baixa', 'Baixa'],
]

/** Projetos ativos: Em andamento, Atenção e Bloqueado. */
export const STATUS_ATIVOS = ['em_execucao', 'atencao', 'bloqueado']

export const rotuloStatusProjeto = s => STATUS_PROJETO.find(([k]) => k === s)?.[1] || s || '—'
export const rotuloPrioridade = s => PRIORIDADE_PROJETO.find(([k]) => k === s)?.[1] || '—'

/** Converte o formulário do projeto no corpo da API. */
export function corpoProjeto(dados) {
  // `acesso` (lista da sessão 20) saiu na 27a e o sigilo saiu na 31a (todo projeto é fechado): descartados se vierem.
  // `clienteNome` saiu na 31b (virou a lista `clientes`, que só vai se o formulário a trouxe: quem tem clientes.ver).
  const {
    progresso,
    clientes,
    clienteNome: _clienteNome,
    acesso: _acesso,
    visibilidade: _visibilidade,
    sigiloso: _sigiloso,
    ...resto
  } = vazioComoNull(dados)
  return {
    ...resto,
    ...(Array.isArray(clientes) ? { clientes: clientesParaApi(clientes) } : {}),
    ...(numeroOuNada(progresso) !== undefined ? { progresso: Number(progresso) } : {}),
  }
}

/** Converte o formulário da participação no corpo da API. */
export function corpoParticipacao(dados) {
  return vazioComoNull(dados)
}

export const projetos = {
  listar: (filtro = {}) => {
    const qs = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString()
    return get('/projetos' + (qs ? '?' + qs : ''))
  },
  buscar: codigo => get(`/projetos/${codigo}`),
  criar: dados => send('POST', '/projetos', corpoProjeto(dados)),
  editar: (codigo, dados) => send('PUT', `/projetos/${codigo}`, corpoProjeto(dados)),
  alterarStatus: (codigo, status) => send('PATCH', `/projetos/${codigo}/status`, { status }),
  excluir: codigo => send('DELETE', `/projetos/${codigo}`),
  /** Colunas do quadro: `corpo` vem de `corpoColunas`; devolve as colunas salvas. */
  gravarColunas: (codigo, corpo) => send('PUT', `/projetos/${codigo}/colunas`, corpo),
  /** Líder do projeto: código de alguém da equipe atual, ou null para tirar. */
  definirLider: (codigo, codigoUsuario) => send('PUT', `/projetos/${codigo}/lider`, { codigoUsuario: codigoUsuario || null }),
}

/** Aba Equipe. Cada chamada devolve { projeto }. */
export const equipe = {
  adicionar: (codigoProjeto, dados) => send('POST', `/projetos/${codigoProjeto}/membros`, corpoParticipacao(dados)),
  editar: (codigoProjeto, codigoParticipacao, dados) =>
    send('PUT', `/projetos/${codigoProjeto}/membros/${codigoParticipacao}`, corpoParticipacao(dados)),
  encerrar: (codigoProjeto, codigoParticipacao, dataSaida) =>
    send('POST', `/projetos/${codigoProjeto}/membros/${codigoParticipacao}/encerrar`, dataSaida ? { dataSaida } : {}),
}
