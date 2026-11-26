import assert from 'node:assert/strict'
import { test } from 'node:test'
import { abasConfiguracoes, alternar, desligadas, linhasPorGrupo, mudou } from '../src/lib/permissoes.js'

const catalogo = [
  { chave: 'pessoas.ver', grupo: 'Pessoas', rotulo: 'Ver Pessoas', descricao: 'd' },
  { chave: 'projetos.ver', grupo: 'Projetos', rotulo: 'Ver Projetos', descricao: 'd' },
  { chave: 'pessoas.gerir', grupo: 'Pessoas', rotulo: 'Gerir pessoas', descricao: 'd' },
]

test('linhasPorGrupo agrupa na ordem em que o grupo aparece no catálogo', () => {
  assert.deepEqual(
    linhasPorGrupo(catalogo).map(g => [g.grupo, g.itens.map(i => i.chave)]),
    [
      ['Pessoas', ['pessoas.ver', 'pessoas.gerir']],
      ['Projetos', ['projetos.ver']],
    ],
  )
  assert.deepEqual(linhasPorGrupo(undefined), [])
})

test('alternar liga e desliga sem mudar a lista original', () => {
  const antes = ['a', 'b']
  assert.deepEqual(alternar(antes, 'c'), ['a', 'b', 'c'])
  assert.deepEqual(alternar(antes, 'a'), ['b'])
  assert.deepEqual(antes, ['a', 'b'])
})

test('mudou ignora a ordem; desligadas lista o que saiu', () => {
  assert.equal(mudou(['a', 'b'], ['b', 'a']), false)
  assert.equal(mudou(['a'], ['a', 'b']), true)
  assert.equal(mudou(['a', 'b'], ['a']), true)
  assert.deepEqual(desligadas(['a', 'b', 'c'], ['b']), ['a', 'c'])
})

test('abasConfiguracoes mostra só as abas que a pessoa pode usar', () => {
  const pode = lista => p => lista.includes(p)
  assert.deepEqual(
    abasConfiguracoes(pode(['config.estrutura', 'config.dificuldade', 'permissoes.gerir'])).map(([k]) => k),
    ['areas', 'cargos', 'senioridades', 'classes', 'dificuldade', 'permissoes'],
  )
  assert.deepEqual(
    abasConfiguracoes(pode(['config.dificuldade'])).map(([k]) => k),
    ['dificuldade'],
  )
  assert.deepEqual(abasConfiguracoes(pode([])), [])
})
