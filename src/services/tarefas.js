import { request } from './api.js'
import alerts from '../lib/alerts.js'
import { textoAviso } from '../lib/ocupacao.js'

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
  dificuldade: t.dificuldade || null,
  codigosResponsaveis: t.responsaveis || [],
})

/** Aviso amarelo (não erro) para cada pessoa acima do teto, vindo da resposta de salvar/mover. Um toast só. */
export function avisarOcupacao(resposta) {
  const avisos = resposta?.avisosOcupacao
  if (avisos?.length) alerts.toastWarning('Ocupação acima do teto', avisos.map(textoAviso).join('\n'))
}

/** De onde a tarefa é: o nome do projeto. */
export const origemTarefa = t => t.projetoNome || 'Projeto'

/** Corpo do POST /tarefas: toda tarefa tem projeto. */
export const corpoNovaTarefa = (codigoProjeto, t) => ({
  codigoProjeto,
  ...base(t),
  ...(t.colunaId ? { codigoColuna: t.colunaId } : {}),
  checklist: (t.checklist || []).map(i => ({
    texto: i.texto,
    feito: Boolean(i.feito),
    ...(i.responsavel ? { codigoResponsavel: i.responsavel } : {}),
  })),
})

/**
 * Corpo do PUT /tarefas/:codigo (envia tudo; a API ignora responsáveis quando quem edita é membro).
 * `codigoColuna` só vai quando a etapa muda em relação a `antes`: na API ele vence o status, e mandar a
 * coluna atual prenderia a tarefa nela (ex.: reabrir arrastando a concluída para uma semana na tela Tarefas).
 * Sem `codigoColuna`, a API leva a tarefa para a coluna do status.
 */
export const corpoTarefa = (t, antes) => ({
  ...base(t),
  status: t.status,
  ...(t.coluna && t.coluna.id !== antes?.coluna?.id ? { codigoColuna: t.coluna.id } : {}),
  codigoDependencia: t.dependeDe || null,
  checklist: (t.checklist || []).map(i => ({
    codigo: i.id,
    texto: i.texto,
    feito: Boolean(i.feito),
    codigoResponsavel: i.responsavel || null,
  })),
  ...(t.status === 'concluida' && t.conclusao ? { dataConclusao: dataApi(t.conclusao) } : {}),
})

/**
 * Erro de quadro desatualizado: a coluna sumiu (`COLUNA_DE_OUTRO_PROJETO`) ou o quadro mudou durante
 * a gravação (409 `QUADRO_MUDOU`). A tela mostra `error.message` e recarrega.
 */
export const quadroDesatualizado = error => ['COLUNA_DE_OUTRO_PROJETO', 'QUADRO_MUDOU'].includes(error?.codigo)

/** Só o status mudou (mesma etapa)? Então basta o PATCH. Etapa junto vai pela edição. */
export function soMudouStatus(antes, depois) {
  const semStatus = t => JSON.stringify({ ...t, status: undefined, conclusao: undefined, coluna: undefined })
  return antes.status !== depois.status && antes.coluna?.id === depois.coluna?.id && semStatus(antes) === semStatus(depois)
}

/** Só a etapa (coluna) mudou? Então basta o PATCH da coluna. */
export function soMudouEtapa(antes, depois) {
  const semEtapa = t => JSON.stringify({ ...t, coluna: undefined })
  return antes.coluna?.id !== depois.coluna?.id && Boolean(depois.coluna) && semEtapa(antes) === semEtapa(depois)
}

/** Só a data de conclusão mudou (continua concluída)? Então basta o PATCH da conclusão. */
export function soMudouConclusao(antes, depois) {
  const semData = t => JSON.stringify({ ...t, conclusao: undefined })
  return (
    antes.status === 'concluida' &&
    depois.status === 'concluida' &&
    Boolean(depois.conclusao) &&
    antes.conclusao !== depois.conclusao &&
    semData(antes) === semData(depois)
  )
}

export const tarefas = {
  listar: (filtro = {}) => {
    const qs = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString()
    return get('/tarefas' + (qs ? '?' + qs : ''))
  },
  criar: (codigoProjeto, t) => send('POST', '/tarefas', corpoNovaTarefa(codigoProjeto, t)),
  editar: (t, antes) => send('PUT', `/tarefas/${t.id}`, corpoTarefa(t, antes)),
  alterarStatus: (codigo, status) => send('PATCH', `/tarefas/${codigo}/status`, { status }),
  mover: (codigo, codigoColuna) => send('PATCH', `/tarefas/${codigo}/coluna`, { codigoColuna }),
  corrigirConclusao: (codigo, data) => send('PATCH', `/tarefas/${codigo}/conclusao`, { dataConclusao: dataApi(data) }),
  marcarItem: (codigo, item, feito) => send('PATCH', `/tarefas/${codigo}/checklist/${item}`, { feito: Boolean(feito) }),
  excluir: codigo => send('DELETE', `/tarefas/${codigo}`),
  comentarios: codigo => get(`/tarefas/${codigo}/comentarios`),
  comentar: (codigo, texto) => send('POST', `/tarefas/${codigo}/comentarios`, { texto }),
  anexos: codigo => get(`/tarefas/${codigo}/anexos`),
  apagarComentario: (codigo, codigoComentario) => send('DELETE', `/tarefas/${codigo}/comentarios/${codigoComentario}`),
  /** Salva usando PATCH quando só a etapa, só o status ou só a data de conclusão mudou; senão PUT. */
  salvar: (antes, depois) =>
    soMudouConclusao(antes, depois)
      ? tarefas.corrigirConclusao(depois.id, depois.conclusao)
      : soMudouEtapa(antes, depois)
        ? tarefas.mover(depois.id, depois.coluna.id)
        : soMudouStatus(antes, depois)
          ? tarefas.alterarStatus(depois.id, depois.status)
          : tarefas.editar(depois, antes),
}

/**
 * O que a pessoa pode fazer nas tarefas do projeto (mesmas regras da API, sessão 8b).
 * Gestão (tarefas.gerirTodas) e líder (ou líder da área, no projeto geral) organizam tudo; participante da equipe atual cria,
 * conclui/reabre só as suas e comenta; quem está fora só vê. Quem criou a tarefa e segue na equipe também edita
 * (`podeEditar`); `podeMarcar` vale para marcar item do checklist e corrigir a data de conclusão.
 */
export function papelNasTarefas({ me, gestao, projeto }) {
  const membros = (projeto?.participacoes || []).filter(x => !x.dataSaida).map(x => x.usuario.codigo)
  const lider = Boolean(me) && (projeto?.lider?.codigo === me || (projeto?.lideresDaArea || []).includes(me))
  const organiza = Boolean(gestao) || lider
  const participa = organiza || membros.includes(me)
  const podeStatus = t => organiza || (participa && (t.responsaveis || []).includes(me))
  const podeEditar = t => organiza || (Boolean(me) && membros.includes(me) && t.criadaPorId === me)
  return {
    lider,
    organiza,
    participa,
    podeStatus,
    podeEditar,
    podeMarcar: t => podeStatus(t) || podeEditar(t),
    podeApagarComentario: c => organiza || c.autor?.codigo === me,
  }
}

/** Regras numa tarefa: as de `papelNasTarefas`, com o projeto da tarefa (`projeto` pode faltar). */
export const papelNaTarefa = ({ me, gestao, projeto }) => papelNasTarefas({ me, gestao, projeto })

/**
 * Ações comuns da tela (kanban, lista, modal). `salvarTarefa(chamada, mensagem)` é da tela:
 * chama a API, mostra o aviso e recarrega.
 */
export const acoesTarefa = salvarTarefa => ({
  tog: t => salvarTarefa(() => tarefas.alterarStatus(t.id, t.status == 'concluida' ? 'andamento' : 'concluida')),
  del: codigo => salvarTarefa(() => tarefas.excluir(codigo), 'Tarefa excluída'),
  mover: (t, colunaId) => salvarTarefa(() => tarefas.mover(t.id, colunaId)),
  salvar: (antes, depois, ok) => salvarTarefa(() => tarefas.salvar(antes, depois), ok),
})
