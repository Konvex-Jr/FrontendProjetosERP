import assert from 'node:assert/strict'
import { test } from 'node:test'
import { podeAbrirSecao } from '../src/lib/rotas.js'

const nav = [['projetos', 'Projetos', '/projetos']]

test('podeAbrirSecao libera o início e as telas do menu', () => {
  assert.equal(podeAbrirSecao('', nav), true)
  assert.equal(podeAbrirSecao('projetos', nav), true)
  assert.equal(podeAbrirSecao('pessoas', nav), false)
})

test('podeAbrirSecao libera o perfil mesmo fora do menu', () => {
  assert.equal(podeAbrirSecao('perfil', []), true)
})
