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

/** Categorias das tarefas avulsas (sessão 8c); mesma lista da API. */
export const CATEGORIAS = [['inovacao', 'Inovação'], ['capacitacao', 'Capacitação'], ['execucao', 'Execução']]
export const rotuloCategoria = c => CATEGORIAS.find(x => x[0] === c)?.[1] || c || ''
/** De onde a tarefa é: nome do projeto ou categoria da avulsa. */
export const origemTarefa = t => (t.avulsa ? rotuloCategoria(t.categoria) : t.projetoNome || 'Projeto')

/** Corpo do POST /tarefas: com projeto, ou avulsa com `t.categoria`. */
export const corpoNovaTarefa = (codigoProjeto, t) =>
  codigoProjeto ? { codigoProjeto, ...base(t) } : { categoria: t.categoria, ...base(t) }

/** Corpo do PUT /tarefas/:codigo (envia tudo; a API ignora responsáveis quando quem edita é membro). */
export const corpoTarefa = t => ({
  ...base(t),
  ...(t.avulsa ? { categoria: t.categoria } : {}),
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
  comentarios: codigo => get(`/tarefas/${codigo}/comentarios`),
  comentar: (codigo, texto) => send('POST', `/tarefas/${codigo}/comentarios`, { texto }),
  apagarComentario: (codigo, codigoComentario) => send('DELETE', `/tarefas/${codigo}/comentarios/${codigoComentario}`),
  /** Salva usando PATCH quando só o status mudou; senão PUT. */
  salvar: (antes, depois) => (soMudouStatus(antes, depois) ? tarefas.alterarStatus(depois.id, depois.status) : tarefas.editar(depois)),
}

/**
 * O que a pessoa pode fazer nas tarefas do projeto (mesmas regras da API, sessão 8b).
 * Gestão (tarefas.gerirTodas) e líder organizam tudo; participante da equipe atual cria,
 * conclui/reabre só as suas e comenta; quem está fora só vê.
 */
export function papelNasTarefas({ me, gestao, projeto }) {
  const membros = (projeto?.participacoes || []).filter(x => !x.dataSaida).map(x => x.usuario.codigo)
  const lider = Boolean(me) && projeto?.lider?.codigo === me
  const organiza = Boolean(gestao) || lider
  const participa = organiza || membros.includes(me)
  return {
    lider,
    organiza,
    participa,
    podeStatus: t => organiza || (participa && (t.responsaveis || []).includes(me)),
    podeApagarComentario: c => organiza || c.autor?.codigo === me,
  }
}

/**
 * Regras numa tarefa qualquer (de projeto ou avulsa), como a API (`regrasTarefa.ts`, sessão 8c).
 * Avulsa: a gestão (tarefas.atribuir) organiza; o responsável conclui/reabre e comenta.
 * De projeto: as regras de `papelNasTarefas`, com o projeto da tarefa (`projeto` pode faltar).
 */
export function papelNaTarefa({ me, gestao, atribui, projeto, tarefa }) {
  if (!tarefa?.avulsa) return papelNasTarefas({ me, gestao, projeto })
  const responsavel = (tarefa.responsaveis || []).includes(me)
  const organiza = Boolean(atribui)
  return {
    lider: false,
    organiza,
    participa: organiza || responsavel,
    podeStatus: t => organiza || (t.responsaveis || []).includes(me),
    podeApagarComentario: c => organiza || c.autor?.codigo === me,
  }
}

/**
 * Ações comuns da tela (kanban, lista, modal). `salvarTarefa(chamada, mensagem)` é da tela:
 * chama a API, mostra o aviso e recarrega.
 */
export const acoesTarefa = salvarTarefa => ({
  tog: t => salvarTarefa(() => tarefas.alterarStatus(t.id, t.status == 'concluida' ? 'andamento' : 'concluida')),
  del: codigo => salvarTarefa(() => tarefas.excluir(codigo), 'Tarefa excluída'),
  salvar: (antes, depois, ok) => salvarTarefa(() => tarefas.salvar(antes, depois), ok),
})
