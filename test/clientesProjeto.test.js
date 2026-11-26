import test from 'node:test'
import assert from 'node:assert/strict'
import { clientesParaApi, clientesParaFormulario, erroDosClientes, temContatos, textoClientes } from '../src/lib/clientesProjeto.js'

test('clientesParaApi tira linhas em branco e manda vazio como null', () => {
  assert.deepEqual(
    clientesParaApi([
      { nome: ' Ana ', empresa: 'Padaria Sol', telefone: '(34) 99999-1111', email: '' },
      { nome: '', empresa: ' ', telefone: '', email: '' },
      { nome: 'Bruno' },
    ]),
    [
      { nome: 'Ana', empresa: 'Padaria Sol', telefone: '(34) 99999-1111', email: null },
      { nome: 'Bruno', empresa: null, telefone: null, email: null },
    ],
  )
  assert.deepEqual(clientesParaApi(undefined), [])
})

test('clientesParaFormulario troca nulo por texto vazio', () => {
  assert.deepEqual(clientesParaFormulario([{ nome: 'Ana', empresa: null }]), [{ nome: 'Ana', empresa: '', telefone: '', email: '' }])
})

test('erroDosClientes aponta a linha sem nome (contando só as preenchidas)', () => {
  assert.equal(erroDosClientes([{ nome: 'Ana' }, { nome: '', empresa: 'X' }]), 'Informe o nome do cliente 2.')
  assert.equal(erroDosClientes([{ nome: '' }, { nome: 'Ana' }]), '')
})

test('textoClientes e temContatos', () => {
  assert.equal(textoClientes([]), '—')
  assert.equal(textoClientes([{ nome: 'Ana', empresa: 'Sol' }, { nome: 'Bruno' }]), 'Ana (Sol), Bruno')
  assert.equal(temContatos([{ nome: 'Ana', empresa: 'Sol' }]), false)
  assert.equal(temContatos([{ nome: 'Ana', telefone: '1' }]), true)
})
