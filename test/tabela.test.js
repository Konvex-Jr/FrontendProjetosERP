import test from 'node:test'
import assert from 'node:assert/strict'
import { comparar, haLinhaNova, paginar } from '../src/lib/tabela.js'

test('linha com id novo conta como inclusão', () => {
  assert.equal(haLinhaNova(new Set(['a', 'b']), [{ id: 'a' }, { id: 'b' }, { id: 'c' }]), true)
})

test('mesmas linhas, ou menos linhas, não contam', () => {
  assert.equal(haLinhaNova(new Set(['a', 'b']), [{ id: 'a' }, { id: 'b' }]), false)
  assert.equal(haLinhaNova(new Set(['a', 'b']), [{ id: 'b' }]), false)
  assert.equal(haLinhaNova(new Set(), []), false)
})

test('comparar: texto sem ligar para acento e maiúscula, números pela grandeza, vazios no fim', () => {
  assert.deepEqual(['Ítalo', 'bia', 'Ana', 'caio'].sort(comparar), ['Ana', 'bia', 'caio', 'Ítalo'])
  assert.deepEqual([10, 2, 33].sort(comparar), [2, 10, 33])
  assert.deepEqual(['Projeto 10', 'Projeto 2'].sort(comparar), ['Projeto 2', 'Projeto 10'])
  assert.deepEqual(['b', '', 'a', null].sort(comparar).slice(0, 2), ['a', 'b'])
})

test('paginar: tudo numa página quando cabe; página fora do intervalo cai na última', () => {
  const l = Array.from({ length: 45 }, (_, i) => i)
  assert.equal(paginar(l.slice(0, 20), 1, 20).paginas, 1)
  const p2 = paginar(l, 2, 20)
  assert.deepEqual([p2.pagina, p2.paginas, p2.inicio, p2.itens[0], p2.itens.length], [2, 3, 20, 20, 20])
  const p9 = paginar(l, 9, 20)
  assert.deepEqual([p9.pagina, p9.itens.length], [3, 5])
  assert.deepEqual(paginar([], 1, 20), { itens: [], pagina: 1, paginas: 1, inicio: 0 })
  assert.deepEqual(paginar([1, 2, 3], 1, Infinity), { itens: [1, 2, 3], pagina: 1, paginas: 1, inicio: 0 })
})
