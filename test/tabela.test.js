import test from 'node:test'
import assert from 'node:assert/strict'
import { haLinhaNova } from '../src/lib/tabela.js'

test('linha com id novo conta como inclusão', () => {
  assert.equal(haLinhaNova(new Set(['a', 'b']), [{ id: 'a' }, { id: 'b' }, { id: 'c' }]), true)
})

test('mesmas linhas, ou menos linhas, não contam', () => {
  assert.equal(haLinhaNova(new Set(['a', 'b']), [{ id: 'a' }, { id: 'b' }]), false)
  assert.equal(haLinhaNova(new Set(['a', 'b']), [{ id: 'b' }]), false)
  assert.equal(haLinhaNova(new Set(), []), false)
})
