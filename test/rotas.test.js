import assert from 'node:assert/strict'
import { test } from 'node:test'
import { destinoPorPendencia, podeAbrirSecao, situacaoDaSecao } from '../src/lib/rotas.js'

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

test('situacaoDaSecao separa tela sem acesso de endereço que não existe', () => {
  assert.equal(situacaoDaSecao('projetos', nav), 'liberada')
  assert.equal(situacaoDaSecao('', nav), 'liberada')
  assert.equal(situacaoDaSecao('usuarios', nav), 'sem-acesso')
  assert.equal(situacaoDaSecao('xyz', nav), 'inexistente')
})

test('a guarda ignora maiúsculas, como o React Router', () => {
  assert.equal(podeAbrirSecao('PROJETOS', nav), true)
  assert.equal(situacaoDaSecao('Usuarios', nav), 'sem-acesso')
})
