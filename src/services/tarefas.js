import { request } from './api.js'

/**
 * Chamadas diretas do módulo Tarefas.
 * Substituem o caminho antigo (up('t') + persistCollection).
 * As tarefas usam o formato da tela (adaptTask): id, inicio, fim, responsaveis, dependeDe, checklist.
 */
const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, auth: true, body })

/** Data do formulário (AAAA-MM-DD) ao meio-dia, para não mudar de dia com o fuso. */
export const dataApi = valor => (valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toISOString() : null)

const base = t => ({
  titulo: (t.titulo || '').trim(),
  dataInicio: dataApi(t.inicio),
  dataFim: dataApi(t.fim),
  prioridade: t.prioridade || 'P3',
  descricao: t.descricao || null,
  codigosResponsaveis: t.responsaveis || [],
})

/** Corpo do POST /tarefas. */
export const corpoNovaTarefa = (codigoProjeto, t) => ({ codigoProjeto, ...base(t) })

/** Corpo do PUT /tarefas/:codigo (envia tudo; a API ignora responsáveis quando quem edita é membro). */
export const corpoTarefa = t => ({
  ...base(t),
  status: t.status,
  codigoDependencia: t.dependeDe || null,
  checklist: (t.checklist || []).map(i => ({ codigo: i.id, texto: i.texto, feito: Boolean(i.feito) })),
})

/** Só o status mudou? Então basta o PATCH. */
export function soMudouStatus(antes, depois) {
  const semStatus = t => JSON.stringify({ ...t, status: undefined, conclusao: undefined })
  return antes.status !== depois.status && semStatus(antes) === semStatus(depois)
}

export const tarefas = {
  listar: (filtro = {}) => {
    const qs = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString()
    return get('/tarefas' + (qs ? '?' + qs : ''))
  },
  criar: (codigoProjeto, t) => send('POST', '/tarefas', corpoNovaTarefa(codigoProjeto, t)),
  editar: t => send('PUT', `/tarefas/${t.id}`, corpoTarefa(t)),
  alterarStatus: (codigo, status) => send('PATCH', `/tarefas/${codigo}/status`, { status }),
  excluir: codigo => send('DELETE', `/tarefas/${codigo}`),
  /** Salva usando PATCH quando só o status mudou; senão PUT. */
  salvar: (antes, depois) => (soMudouStatus(antes, depois) ? tarefas.alterarStatus(depois.id, depois.status) : tarefas.editar(depois)),
}
