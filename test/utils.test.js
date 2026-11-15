import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NAV, path, prog, rotuloArquivos } from '../src/lib/utils.js'

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

// Sessão 17: Biblioteca no lugar de Base de Inteligência; saem Iniciativas e Gestão.
test('NAV tem a Biblioteca e não tem mais Base, Iniciativas nem Gestão', () => {
  const chaves = NAV.map(x => x[0])
  assert.ok(chaves.includes('biblioteca'))
  for (const antiga of ['conhecimento', 'iniciativas', 'gestao']) assert.ok(!chaves.includes(antiga), antiga)
  assert.deepEqual(
    NAV.find(x => x[0] === 'biblioteca'),
    ['biblioteca', 'Biblioteca', '/biblioteca'],
  )
  // Mesma posição da antiga Base (depois de Capacitações).
  assert.equal(chaves.indexOf('biblioteca'), chaves.indexOf('capacitacoes') + 1)
})

test('path leva à lista e à ficha da Biblioteca', () => {
  assert.equal(path('biblioteca'), '/biblioteca')
  assert.equal(path('biblioteca', 'b1'), '/biblioteca/b1')
})

test('rotuloArquivos usa singular para 1 e plural para o resto', () => {
  assert.equal(rotuloArquivos(1), '1 arquivo')
  assert.equal(rotuloArquivos(3), '3 arquivos')
})
