import assert from 'node:assert/strict'
import { test } from 'node:test'
import { valoresIniciais } from '../src/lib/formulario.js'

test('select sem valor inicial começa na primeira opção', () => {
  const campos = [
    {
      k: 'tipo',
      o: [
        ['a', 'A'],
        ['b', 'B'],
      ],
    },
    { k: 'nome' },
  ]
  assert.deepEqual(valoresIniciais(campos, { nome: 'x' }), { nome: 'x', tipo: 'a' })
})

test('valor já dado, inclusive vazio de propósito, é mantido', () => {
  const campos = [
    {
      k: 'tipo',
      o: [
        ['', 'Nenhum'],
        ['b', 'B'],
      ],
    },
    { k: 'sigilo', o: [['todos', 'Todos']] },
  ]
  assert.deepEqual(valoresIniciais(campos, { tipo: '', sigilo: 'gestao' }), { tipo: '', sigilo: 'gestao' })
})
