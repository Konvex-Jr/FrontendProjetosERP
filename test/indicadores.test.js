import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fimDaSemana, indicadores } from '../src/lib/indicadores.js'

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
    u: [{ status: 'ativo' }, { status: 'ativo' }, { status: 'trainee' }, { status: 'alumni' }],
    k: [{ data: '2026-11-04' }, { data: '2026-12-03' }, { data: '2026-12-10' }, { data: '2026-10-01' }],
    t: [
      { status: 'pendente', fim: '2026-11-03' },   // atrasada
      { status: 'andamento', fim: '2026-11-04' },  // semana (vence hoje)
      { status: 'pendente', fim: '2026-11-08' },   // semana (domingo)
      { status: 'pendente', fim: '2026-11-09' },   // próxima semana
      { status: 'concluida', fim: '2026-11-01' },  // concluída não conta
    ],
  }
  const n = Object.fromEntries(indicadores(D, hoje).map(i => [i.chave, i.numero]))
  assert.deepEqual(n, { ativos: 3, atencao: 2, concluidos: 1, membros: 2, capacitacoes: 2, semana: 2, atrasadas: 1 })
  assert.equal(indicadores(D, hoje).length, 7)
})

test('indicadores aguentam dados vazios', () => {
  assert.ok(indicadores({}, hoje).every(i => i.numero === 0))
})
