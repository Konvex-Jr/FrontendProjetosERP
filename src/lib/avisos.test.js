import { describe, expect, it } from 'vitest'
import { destinoAviso, temAlerta, textoAviso } from './avisos.js'

const tarefa = { codigo: 't1', titulo: 'Revisar proposta', dataFim: '2026-11-25', projeto: { codigo: 'p1', nome: 'X' } }
const capacitacao = { codigo: 'c1', titulo: 'Git', data: '2026-11-25', hora: '19:00' }

describe('textoAviso', () => {
  it('tarefa recebida', () => {
    expect(textoAviso({ tipo: 'tarefa_recebida', autor: { codigo: 'u', nome: 'Lia' }, tarefa })).toBe('Lia te deu “Revisar proposta”')
    expect(textoAviso({ tipo: 'tarefa_recebida', autor: null, tarefa })).toBe('Você recebeu “Revisar proposta”')
  })
  it('capacitação nova e próxima', () => {
    expect(textoAviso({ tipo: 'capacitacao_nova', capacitacao })).toBe('Nova capacitação: Git, 25/11')
    expect(textoAviso({ tipo: 'capacitacao_proxima', capacitacao })).toBe('Capacitação: Git, 25/11 às 19:00')
  })
  it('grupos de tarefas, singular e plural', () => {
    expect(textoAviso({ tipo: 'tarefas_atrasadas', tarefas: [tarefa] })).toBe('1 tarefa atrasada')
    expect(textoAviso({ tipo: 'tarefas_atrasadas', tarefas: [tarefa, tarefa, tarefa] })).toBe('3 tarefas atrasadas')
    expect(textoAviso({ tipo: 'tarefas_a_vencer', tarefas: [tarefa] })).toBe('1 tarefa a vencer')
    expect(textoAviso({ tipo: 'tarefas_a_vencer', tarefas: [tarefa, tarefa] })).toBe('2 tarefas a vencer')
  })
  it('sobrecarga, por pessoa e em grupo', () => {
    expect(textoAviso({ tipo: 'sobrecarga', nome: 'Ana Souza', percentual: 129.6 })).toBe('Ana Souza: 130%')
    expect(textoAviso({ tipo: 'sobrecarga', pessoas: [{ nome: 'A', percentual: 110 }] })).toBe('1 pessoa acima do teto')
    expect(textoAviso({ tipo: 'sobrecarga', pessoas: [{}, {}] })).toBe('2 pessoas acima do teto')
  })
})

describe('destinoAviso', () => {
  it('cada tipo', () => {
    expect(destinoAviso({ tipo: 'tarefa_recebida', tarefa })).toBe('/tarefas?tarefa=t1')
    expect(destinoAviso({ tipo: 'capacitacao_nova', capacitacao })).toBe('/capacitacoes/c1')
    expect(destinoAviso({ tipo: 'capacitacao_proxima', capacitacao })).toBe('/capacitacoes/c1')
    expect(destinoAviso({ tipo: 'sobrecarga', codigoUsuario: 'u9', nome: 'A', percentual: 1 })).toBe('/perfil/u9')
    expect(destinoAviso({ tipo: 'tarefas_atrasadas', tarefas: [tarefa] })).toBeNull()
    expect(destinoAviso({ tipo: 'sobrecarga', pessoas: [] })).toBeNull()
  })
})

describe('temAlerta', () => {
  it('atrasadas ou sobrecarga', () => {
    expect(temAlerta([{ tipo: 'tarefas_a_vencer', tarefas: [tarefa] }])).toBe(false)
    expect(temAlerta([{ tipo: 'tarefas_atrasadas', tarefas: [tarefa] }])).toBe(true)
    expect(temAlerta([{ tipo: 'sobrecarga', pessoas: [{}] }])).toBe(true)
    expect(temAlerta(undefined)).toBe(false)
  })
})
