import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contagemTarefas, fimDaSemana, indicadores } from '../src/lib/indicadores.js'

// Quarta-feira, 04/11/2026.
const hoje = new Date('2026-11-04T00:00')

test('fimDaSemana devolve o domingo (no domingo, o próprio dia)', () => {
  assert.equal(fimDaSemana(hoje).toDateString(), new Date('2026-11-08T00:00').toDateString())
  const domingo = new Date('2026-11-08T00:00')
  assert.equal(fimDaSemana(domingo).toDateString(), domingo.toDateString())
})

test('os sete indicadores contam projetos, pessoas, capacitações e tarefas', () => {
  const D = {
    p: [{ status: 'em_execucao' }, { status: 'atencao' }, { status: 'bloqueado' }, { status: 'concluido' }, { status: 'arquivado' }],
    u: [{ status: 'ativo' }, { status: 'ativo' }, { status: 'trainee' }, { status: 'inativo' }],
    k: [{ data: '2026-11-04' }, { data: '2026-12-03' }, { data: '2026-12-10' }, { data: '2026-10-01' }],
    t: [
      { status: 'pendente', fim: '2026-11-03' }, // atrasada
      { status: 'andamento', fim: '2026-11-04' }, // semana (vence hoje)
      { status: 'pendente', fim: '2026-11-08' }, // semana (domingo)
      { status: 'pendente', fim: '2026-11-09' }, // próxima semana
      { status: 'concluida', fim: '2026-11-01' }, // concluída não conta
    ],
  }
  const n = Object.fromEntries(indicadores(D, hoje).map(i => [i.chave, i.numero]))
  assert.deepEqual(n, { ativos: 3, atencao: 2, concluidos: 1, membros: 2, capacitacoes: 2, semana: 2, atrasadas: 1 })
  assert.equal(indicadores(D, hoje).length, 7)
})

test('indicadores aguentam dados vazios', () => {
  assert.ok(indicadores({}, hoje).every(i => i.numero === 0))
})

test('indicadores ignoram cartões: nem grupos nem tarefas', () => {
  const D = {
    p: [{ status: 'em_execucao' }, { status: 'em_execucao', cartao: true, tarefasResumo: { atrasadas: 2, semana: 1 } }],
    t: [
      { status: 'pendente', fim: '2026-11-03' },
      { status: 'pendente', fim: '2026-11-05' },
    ],
  }
  const n = Object.fromEntries(indicadores(D, hoje).map(i => [i.chave, i.numero]))
  assert.equal(n.ativos, 1)
  assert.equal(n.atrasadas, 1)
  assert.equal(n.semana, 1)
})

test('contagemTarefas conta só as tarefas vistas: cartão não soma nada', () => {
  const D = {
    t: [
      { status: 'concluida', fim: '2026-11-01' },
      { status: 'a_fazer', fim: '2026-11-01' },
      { status: 'a_fazer', fim: '2026-11-10' },
    ],
    p: [
      { status: 'em_execucao' },
      { status: 'em_execucao', cartao: true, tarefasResumo: { total: 6, concluidas: 2, atrasadas: 1, semana: 1 } },
    ],
  }
  assert.deepEqual(contagemTarefas(D, hoje), { total: 3, late: 1, and: 1, done: 1 })
  assert.deepEqual(contagemTarefas({ t: [], p: [] }, hoje), { total: 0, late: 0, and: 0, done: 0 })
})
