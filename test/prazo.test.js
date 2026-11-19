import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PRAZOS, noPrazo } from '../src/lib/prazo.js'
import { d } from '../src/lib/utils.js'

// Quinta-feira, 19/11/2026: a semana vai até domingo, 22/11.
const hoje = d('2026-11-19')
const tarefa = (fim, status = 'andamento') => ({ fim, status })

test('noPrazo: sem filtro mostra tudo, até concluída', () => {
  assert.equal(noPrazo(tarefa('2026-11-01', 'concluida'), '', hoje), true)
  assert.equal(noPrazo(tarefa('2026-12-01'), '', hoje), true)
})

test('noPrazo: atrasadas = abertas com prazo antes de hoje', () => {
  assert.equal(noPrazo(tarefa('2026-11-18'), 'atrasadas', hoje), true)
  assert.equal(noPrazo(tarefa('2026-11-18', 'pendente'), 'atrasadas', hoje), true)
  assert.equal(noPrazo(tarefa('2026-11-19'), 'atrasadas', hoje), false)
  assert.equal(noPrazo(tarefa('2026-11-30'), 'atrasadas', hoje), false)
})

test('noPrazo: concluída fica fora de atrasadas e da semana', () => {
  assert.equal(noPrazo(tarefa('2026-11-10', 'concluida'), 'atrasadas', hoje), false)
  assert.equal(noPrazo(tarefa('2026-11-20', 'concluida'), 'semana', hoje), false)
})

test('noPrazo: semana = abertas que vencem de hoje até domingo', () => {
  assert.equal(noPrazo(tarefa('2026-11-19'), 'semana', hoje), true)
  assert.equal(noPrazo(tarefa('2026-11-22'), 'semana', hoje), true)
  assert.equal(noPrazo(tarefa('2026-11-23'), 'semana', hoje), false)
  assert.equal(noPrazo(tarefa('2026-11-18'), 'semana', hoje), false)
})

test('PRAZOS: opções do seletor', () => {
  assert.deepEqual(
    PRAZOS.map(([v]) => v),
    ['', 'atrasadas', 'semana'],
  )
})
