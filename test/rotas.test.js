import assert from 'node:assert/strict'
import { test } from 'node:test'
import { destinoPorPendencia, podeAbrirSecao } from '../src/lib/rotas.js'

const nav = [['projetos', 'Projetos', '/projetos']]

test('podeAbrirSecao libera o início e as telas do menu', () => {
  assert.equal(podeAbrirSecao('', nav), true)
  assert.equal(podeAbrirSecao('projetos', nav), true)
  assert.equal(podeAbrirSecao('pessoas', nav), false)
})

test('podeAbrirSecao libera o perfil mesmo fora do menu', () => {
  assert.equal(podeAbrirSecao('perfil', []), true)
})

test('destinoPorPendencia leva quem tem pendência à tela de completar', () => {
  assert.equal(destinoPorPendencia(['curso']), '/completar-perfil')
  assert.equal(destinoPorPendencia([]), null)
  assert.equal(destinoPorPendencia(undefined), null)
})
