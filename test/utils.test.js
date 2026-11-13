import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prog } from '../src/lib/utils.js'

// Revisão de 12/11/2026: o membro recebe só as próprias tarefas em D.t; o % vinha diferente do da gestão.
test('prog usa a contagem de todas as tarefas que vem da API', () => {
  const D = { p: [], t: [{ projetoId: 'p1', status: 'concluida' }] }
  assert.equal(prog(D, { id: 'p1', tarefas: { total: 4, concluidas: 1 } }), 25)
  assert.equal(prog(D, { id: 'p1', tarefas: { total: 0, concluidas: 0 } }), 0)
})

test('prog acha a contagem pelo projeto de D.p quando recebe só o id', () => {
  const D = { p: [{ id: 'p1', tarefas: { total: 3, concluidas: 3 } }], t: [] }
  assert.equal(prog(D, { id: 'p1' }), 100)
})

test('sem contagem da API, cai nas tarefas carregadas', () => {
  const D = {
    p: [],
    t: [
      { projetoId: 'p1', status: 'concluida' },
      { projetoId: 'p1', status: 'pendente' },
    ],
  }
  assert.equal(prog(D, { id: 'p1' }), 50)
})
