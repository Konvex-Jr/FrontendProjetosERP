import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { destinoAviso, temAlerta, textoAviso } from '../src/lib/avisos.js'

const tarefa = { codigo: 't1', titulo: 'Revisar proposta', dataFim: '2026-11-25', projeto: { codigo: 'p1', nome: 'X' } }
const capacitacao = { codigo: 'c1', titulo: 'Git', data: '2026-11-25', hora: '19:00' }

describe('textoAviso', () => {
  it('tarefa recebida', () => {
    assert.equal(textoAviso({ tipo: 'tarefa_recebida', autor: { codigo: 'u', nome: 'Lia' }, tarefa }), 'Lia te deu “Revisar proposta”')
    assert.equal(textoAviso({ tipo: 'tarefa_recebida', autor: null, tarefa }), 'Você recebeu “Revisar proposta”')
  })
  it('capacitação nova e próxima', () => {
    assert.equal(textoAviso({ tipo: 'capacitacao_nova', capacitacao }), 'Nova capacitação: Git, 25/11')
    assert.equal(textoAviso({ tipo: 'capacitacao_proxima', capacitacao }), 'Capacitação: Git, 25/11 às 19:00')
  })
  it('grupos de tarefas, singular e plural', () => {
    assert.equal(textoAviso({ tipo: 'tarefas_atrasadas', tarefas: [tarefa] }), '1 tarefa atrasada')
    assert.equal(textoAviso({ tipo: 'tarefas_atrasadas', tarefas: [tarefa, tarefa, tarefa] }), '3 tarefas atrasadas')
    assert.equal(textoAviso({ tipo: 'tarefas_a_vencer', tarefas: [tarefa] }), '1 tarefa a vencer')
    assert.equal(textoAviso({ tipo: 'tarefas_a_vencer', tarefas: [tarefa, tarefa] }), '2 tarefas a vencer')
  })
  it('sobrecarga, por pessoa e em grupo', () => {
    assert.equal(textoAviso({ tipo: 'sobrecarga', nome: 'Ana Souza', percentual: 129.6 }), 'Ana Souza: 130%')
    assert.equal(textoAviso({ tipo: 'sobrecarga', pessoas: [{ nome: 'A', percentual: 110 }] }), '1 pessoa acima do teto')
    assert.equal(textoAviso({ tipo: 'sobrecarga', pessoas: [{}, {}] }), '2 pessoas acima do teto')
  })
})

describe('destinoAviso', () => {
  it('cada tipo', () => {
    assert.equal(destinoAviso({ tipo: 'tarefa_recebida', tarefa }), '/tarefas?tarefa=t1')
    assert.equal(destinoAviso({ tipo: 'capacitacao_nova', capacitacao }), '/capacitacoes/c1')
    assert.equal(destinoAviso({ tipo: 'capacitacao_proxima', capacitacao }), '/capacitacoes/c1')
    assert.equal(destinoAviso({ tipo: 'sobrecarga', codigoUsuario: 'u9', nome: 'A', percentual: 1 }), '/perfil/u9')
    assert.equal(destinoAviso({ tipo: 'tarefas_atrasadas', tarefas: [tarefa] }), null)
    assert.equal(destinoAviso({ tipo: 'sobrecarga', pessoas: [] }), null)
  })
})

describe('temAlerta', () => {
  it('atrasadas ou sobrecarga', () => {
    assert.equal(temAlerta([{ tipo: 'tarefas_a_vencer', tarefas: [tarefa] }]), false)
    assert.equal(temAlerta([{ tipo: 'tarefas_atrasadas', tarefas: [tarefa] }]), true)
    assert.equal(temAlerta([{ tipo: 'sobrecarga', pessoas: [{}] }]), true)
    assert.equal(temAlerta(undefined), false)
  })
})
