import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { apagarMemorias, definirPessoa } from '../src/lib/memoriasDaAba.js'
import { esquecerFiltros, guardarFiltros, lerFiltros } from '../src/lib/filtrosTarefas.js'

beforeEach(() => {
  apagarMemorias()
  esquecerFiltros()
})

test('guarda e lê os filtros da pessoa', () => {
  guardarFiltros('A', { filtro: { pessoa: 'A', status: 'Atrasada' }, visao: 'lista' })
  assert.deepEqual(lerFiltros('A'), { filtro: { pessoa: 'A', status: 'Atrasada' }, visao: 'lista' })
})

test('outra pessoa não lê os filtros de A', () => {
  guardarFiltros('A', { filtro: { pessoa: 'A' }, visao: 'kanban' })
  assert.equal(lerFiltros('B'), undefined)
})

test('pessoa indefinida não guarda nem lê', () => {
  guardarFiltros(undefined, { filtro: {}, visao: 'kanban' })
  guardarFiltros(null, { filtro: {}, visao: 'kanban' })
  assert.equal(lerFiltros(undefined), undefined)
  assert.equal(lerFiltros(null), undefined)
})

test('definirPessoa de outra pessoa apaga os filtros', () => {
  definirPessoa('A')
  guardarFiltros('A', { filtro: {}, visao: 'kanban' })
  definirPessoa('B')
  assert.equal(lerFiltros('A'), undefined)
})

test('apagarMemorias apaga os filtros', () => {
  definirPessoa('A')
  guardarFiltros('A', { filtro: {}, visao: 'kanban' })
  apagarMemorias()
  assert.equal(lerFiltros('A'), undefined)
})
