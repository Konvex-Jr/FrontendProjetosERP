import assert from 'node:assert/strict'
import { test } from 'node:test'
import { corpoNovaTarefa, corpoTarefa, papelNasTarefas, soMudouStatus, tarefas } from '../src/services/tarefas.js'
import { sessao } from '../src/services/api.js'

const capturar = async fn => {
  const original = globalThis.fetch
  const chamadas = []
  globalThis.fetch = async (url, init) => {
    chamadas.push({ url: String(url).replace(/^https?:\/\/[^/]+/, ''), method: init.method, body: init.body ? JSON.parse(init.body) : undefined })
    return { ok: true, status: 200, text: async () => '{}' }
  }
  try { await fn() } finally { globalThis.fetch = original }
  return chamadas
}

const tarefa = {
  id: 't1', projetoId: 'p1', titulo: ' Requisitos ', descricao: '', inicio: '2026-11-03', fim: '2026-11-07',
  status: 'pendente', prioridade: 'P2', responsaveis: ['u1'], dependeDe: undefined,
  checklist: [{ id: 'c1', texto: 'Levantar', feito: 1 }],
}

test('corpos da tarefa seguem o contrato da API', () => {
  const nova = corpoNovaTarefa('p1', { titulo: 'X', inicio: '2026-11-03', fim: '2026-11-07' })
  assert.equal(nova.codigoProjeto, 'p1')
  assert.equal(nova.prioridade, 'P3')
  assert.deepEqual(nova.codigosResponsaveis, [])
  assert.equal(nova.dataInicio.slice(0, 10), '2026-11-03')

  const corpo = corpoTarefa(tarefa)
  assert.equal(corpo.titulo, 'Requisitos')
  assert.equal(corpo.descricao, null)
  assert.equal(corpo.codigoDependencia, null)
  assert.deepEqual(corpo.checklist, [{ codigo: 'c1', texto: 'Levantar', feito: true }])
})

test('salvar usa PATCH quando só o status muda e PUT no resto', async () => {
  assert.equal(soMudouStatus(tarefa, { ...tarefa, status: 'concluida', conclusao: '2026-11-03' }), true)
  assert.equal(soMudouStatus(tarefa, { ...tarefa, status: 'andamento', fim: '2026-11-14' }), false)

  sessao.salvar({ token: 'tk', refreshToken: 'rt' })
  const chamadas = await capturar(async () => {
    await tarefas.listar({ codigoProjeto: 'p1' })
    await tarefas.criar('p1', tarefa)
    await tarefas.salvar(tarefa, { ...tarefa, status: 'concluida' })
    await tarefas.salvar(tarefa, { ...tarefa, titulo: 'Outra' })
    await tarefas.excluir('t1')
  })
  sessao.limpar()

  assert.deepEqual(chamadas.map(c => [c.method, c.url]), [
    ['GET', '/tarefas?codigoProjeto=p1'],
    ['POST', '/tarefas'],
    ['PATCH', '/tarefas/t1/status'],
    ['PUT', '/tarefas/t1'],
    ['DELETE', '/tarefas/t1'],
  ])
  assert.deepEqual(chamadas[2].body, { status: 'concluida' })
})

test('papel nas tarefas: gestão e líder organizam; participante só as suas; de fora só vê', () => {
  const projeto = {
    lider: { codigo: 'lid' },
    participacoes: [
      { usuario: { codigo: 'lid' }, dataSaida: null },
      { usuario: { codigo: 'par' }, dataSaida: null },
      { usuario: { codigo: 'saiu' }, dataSaida: '2026-10-01' },
    ],
  }
  const sua = { responsaveis: ['par'] }, outra = { responsaveis: ['lid'] }
  const gestao = papelNasTarefas({ me: 'g', gestao: true, projeto })
  assert.equal(gestao.organiza, true)
  const lider = papelNasTarefas({ me: 'lid', gestao: false, projeto })
  assert.equal(lider.lider, true)
  assert.equal(lider.podeStatus(sua), true)
  const par = papelNasTarefas({ me: 'par', gestao: false, projeto })
  assert.equal(par.organiza, false)
  assert.equal(par.participa, true)
  assert.equal(par.podeStatus(sua), true)
  assert.equal(par.podeStatus(outra), false)
  assert.equal(par.podeApagarComentario({ autor: { codigo: 'par' } }), true)
  assert.equal(par.podeApagarComentario({ autor: { codigo: 'lid' } }), false)
  const saiu = papelNasTarefas({ me: 'saiu', gestao: false, projeto })
  assert.equal(saiu.participa, false)
  assert.equal(saiu.podeStatus({ responsaveis: ['saiu'] }), false)
})
