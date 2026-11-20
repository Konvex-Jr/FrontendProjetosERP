import assert from 'node:assert/strict'
import { test } from 'node:test'
import { forcaSenha, regrasSenha } from '../src/lib/senha.js'

test('forcaSenha: fraca quando alguma regra falha', () => {
  assert.equal(forcaSenha('abc'), 'fraca')
  assert.equal(forcaSenha(''), 'fraca')
  assert.equal(forcaSenha('konvex@123'), 'fraca')
})

test('forcaSenha: média no mínimo e forte com 12+ ou 2+ especiais e minúscula', () => {
  assert.equal(forcaSenha('Konvex@123'), 'media')
  assert.equal(forcaSenha('Konvex@123456'), 'forte')
  assert.equal(forcaSenha('Konvex@#12a'), 'forte')
})

test('regrasSenha: espaço é caractere especial', () => {
  const regras = regrasSenha('KONVEX 12')
  assert.deepEqual(
    regras.map(r => r.chave),
    ['tamanho', 'maiuscula', 'numero', 'especial'],
  )
  assert.ok(regras.every(r => r.ok))
})

test('regrasSenha: marca só o que falta', () => {
  assert.deepEqual(
    regrasSenha('abc').map(r => r.ok),
    [false, false, false, false],
  )
  assert.equal(regrasSenha('Abcdefgh1').find(r => r.chave === 'especial').ok, false)
})

test('regrasSenha: dígito é só \\p{Nd}, como no back (² não vale como número)', () => {
  const regras = regrasSenha('Abcdefg²!')
  assert.equal(regras.find(r => r.chave === 'numero').ok, false)
  assert.equal(forcaSenha('Abcdefg²!'), 'fraca')
})
