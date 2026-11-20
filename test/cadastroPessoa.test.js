import assert from 'node:assert/strict'
import { test } from 'node:test'
import { corpoNovaPessoa, opcoesMudarStatus, podeRedefinirSenha } from '../src/lib/cadastroPessoa.js'

test('mudar status não oferece trainee, salvo para quem já é trainee', () => {
  assert.deepEqual(
    opcoesMudarStatus('ativo').map(([k]) => k),
    ['ativo', 'alumni', 'inativo'],
  )
  assert.deepEqual(
    opcoesMudarStatus('alumni').map(([k]) => k),
    ['ativo', 'alumni', 'inativo'],
  )
  assert.deepEqual(
    opcoesMudarStatus('trainee').map(([k]) => k),
    ['ativo', 'trainee', 'alumni', 'inativo'],
  )
})

test('a gestão manda link de senha a ativo e a trainee', () => {
  assert.equal(podeRedefinirSenha('ativo'), true)
  assert.equal(podeRedefinirSenha('trainee'), true)
  assert.equal(podeRedefinirSenha('alumni'), false)
  assert.equal(podeRedefinirSenha('inativo'), false)
})

test('nova pessoa: trainee vai como membro e ninguém leva senha (a pessoa cria pelo convite)', () => {
  assert.deepEqual(corpoNovaPessoa({ nome: 'Tê', status: 'trainee', perfil: 'gerente', senha: 'segredo123', dataEntrada: '' }), {
    nome: 'Tê',
    status: 'trainee',
    perfil: 'membro',
  })
  assert.deepEqual(corpoNovaPessoa({ nome: 'Ana', status: 'ativo', perfil: 'gerente', senha: 'x', dataEntrada: '2026-11-01' }), {
    nome: 'Ana',
    status: 'ativo',
    perfil: 'gerente',
    dataEntrada: '2026-11-01',
  })
})
