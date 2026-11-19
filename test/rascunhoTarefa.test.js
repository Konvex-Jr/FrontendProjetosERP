import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conclusaoDoStatus, mudouRascunho } from '../src/lib/rascunhoTarefa.js'

const tarefa = {
  id: 't1',
  titulo: 'Relatório',
  descricao: null,
  prioridade: 'P3',
  inicio: '2026-11-10',
  fim: '2026-11-20',
  responsaveis: ['u1'],
  coluna: { id: 'c1', nome: 'A fazer' },
  checklist: [
    { id: 'i1', texto: 'Rascunho', feito: false, responsavel: 'u1' },
    { id: 'i2', texto: 'Revisão', feito: true, responsavel: undefined },
  ],
}

test('mudouRascunho: nada mudou', () => {
  assert.equal(mudouRascunho(tarefa, { ...tarefa }), false)
})

test('mudouRascunho: título mudado', () => {
  assert.equal(mudouRascunho(tarefa, { ...tarefa, titulo: 'Relatório final' }), true)
})

test('mudouRascunho: só o feito de item existente não conta', () => {
  const rascunho = { ...tarefa, checklist: tarefa.checklist.map(i => ({ ...i, feito: !i.feito })) }
  assert.equal(mudouRascunho(tarefa, rascunho), false)
})

test('mudouRascunho: item novo, texto ou responsável do item contam', () => {
  const novo = { ...tarefa, checklist: [...tarefa.checklist, { id: 'i3', texto: 'Enviar', feito: false }] }
  assert.equal(mudouRascunho(tarefa, novo), true)
  const texto = { ...tarefa, checklist: tarefa.checklist.map(i => (i.id === 'i1' ? { ...i, texto: 'Esboço' } : i)) }
  assert.equal(mudouRascunho(tarefa, texto), true)
  const resp = { ...tarefa, checklist: tarefa.checklist.map(i => (i.id === 'i1' ? { ...i, responsavel: undefined } : i)) }
  assert.equal(mudouRascunho(tarefa, resp), true)
})

test('mudouRascunho: etapa e data de conclusão contam', () => {
  assert.equal(mudouRascunho(tarefa, { ...tarefa, coluna: { id: 'c2', nome: 'Fazendo' } }), true)
  const concluida = { ...tarefa, status: 'concluida', conclusao: '2026-11-18' }
  assert.equal(mudouRascunho(concluida, { ...concluida, conclusao: '2026-11-17' }), true)
})

test('mudouRascunho: campo apagado volta a vazio sem contar como alteração', () => {
  assert.equal(mudouRascunho(tarefa, { ...tarefa, descricao: '' }), false)
  assert.equal(mudouRascunho({ ...tarefa, dependeDe: undefined }, { ...tarefa }), false)
})

test('mudouRascunho: anexo escolhido na criação conta', () => {
  const inicial = { titulo: '', prioridade: 'P3', responsaveis: [], checklist: [] }
  assert.equal(mudouRascunho(inicial, { ...inicial }), false)
  assert.equal(mudouRascunho(inicial, { ...inicial }, [{ name: 'ata.pdf' }]), true)
  assert.equal(mudouRascunho(inicial, { ...inicial, titulo: 'Nova' }), true)
})

test('conclusaoDoStatus: concluir hoje; voltar a concluir uma concluída mantém a data dela', () => {
  assert.equal(conclusaoDoStatus('concluida', { status: 'andamento' }, '2026-11-19'), '2026-11-19')
  assert.equal(conclusaoDoStatus('andamento', { status: 'concluida', conclusao: '2026-11-10' }, '2026-11-19'), undefined)
  assert.equal(conclusaoDoStatus('concluida', { status: 'concluida', conclusao: '2026-11-10' }, '2026-11-19'), '2026-11-10')
})
