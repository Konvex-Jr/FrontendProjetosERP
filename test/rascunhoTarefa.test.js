import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conclusaoDoStatus, mudouRascunho, noProjeto, rascunhoNovo } from '../src/lib/rascunhoTarefa.js'

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

const colunas = [
  { id: 'c1', nome: 'A fazer', papel: 'entrada' },
  { id: 'c2', nome: 'Feito', papel: 'concluida' },
]

test('rascunhoNovo: participante fica como responsável, na coluna de entrada', () => {
  const r = rascunhoNovo({ projetoId: 'p1', organiza: false, membros: ['u1', 'u2'], me: 'u1', colunas, responsaveis: ['u2'] })
  assert.deepEqual(r.responsaveis, ['u1'])
  assert.equal(r.coluna, colunas[0])
  assert.equal(r.projetoId, 'p1')
  assert.equal(r.prioridade, 'P3')
  assert.deepEqual(r.checklist, [])
  assert.equal(r.inicio, '')
})

test('rascunhoNovo: quem organiza começa só com responsáveis da equipe, na coluna clicada', () => {
  const r = rascunhoNovo({
    projetoId: 'p1',
    organiza: true,
    membros: ['u2'],
    me: 'u1',
    colunas,
    responsaveis: ['u2', 'u9'],
    colunaId: 'c2',
    inicio: '2026-11-19',
    fim: '2026-11-20',
  })
  assert.deepEqual(r.responsaveis, ['u2'])
  assert.equal(r.coluna, colunas[1])
  assert.equal(r.fim, '2026-11-20')
})

test('rascunhoNovo: nada preenchido não conta como alteração', () => {
  const r = rascunhoNovo({ projetoId: 'p1', organiza: false, membros: ['u1'], me: 'u1', colunas })
  assert.equal(mudouRascunho(r, { ...r }), false)
  assert.equal(mudouRascunho(r, { ...r, descricao: 'x' }), true)
  assert.equal(mudouRascunho(r, { ...r }, [{ name: 'a.pdf' }]), true)
})

test('noProjeto: troca o projeto, refaz responsáveis, itens e coluna', () => {
  const outras = [{ id: 'd1', nome: 'Entrada', papel: 'entrada' }]
  const r = {
    ...rascunhoNovo({ projetoId: 'p1', organiza: true, membros: ['u2', 'u3'], me: 'u1', colunas, responsaveis: ['u2', 'u3'] }),
    titulo: 'Mantém',
    checklist: [
      { id: 'i1', texto: 'a', feito: false, responsavel: 'u2' },
      { id: 'i2', texto: 'b', feito: true, responsavel: 'u3' },
    ],
  }
  const organiza = noProjeto(r, { projetoId: 'p2', organiza: true, membros: ['u3'], me: 'u1', colunas: outras })
  assert.equal(organiza.projetoId, 'p2')
  assert.equal(organiza.titulo, 'Mantém')
  assert.deepEqual(organiza.responsaveis, ['u3'])
  assert.deepEqual(
    organiza.checklist.map(i => i.responsavel),
    [undefined, 'u3'],
  )
  assert.equal(organiza.coluna, outras[0])
  const participa = noProjeto(r, { projetoId: 'p2', organiza: false, membros: ['u1'], me: 'u1', colunas: outras })
  assert.deepEqual(participa.responsaveis, ['u1'])
  assert.deepEqual(
    participa.checklist.map(i => i.responsavel),
    [undefined, undefined],
  )
})
