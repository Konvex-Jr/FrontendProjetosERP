import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adaptCheckin,
  adaptDocument,
  adaptFeedback,
  adaptProject,
  adaptTask,
  adaptTraining,
  adaptUser,
  readConfig,
  resolveSenioridade,
} from '../src/lib/apiMappers.js'

const senioridades = [
  { codigo: 'junior', nome: 'Júnior', valorHora: 45 },
  { codigo: 'senior', nome: 'Sênior', valorHora: 120 },
]

test('adaptUser supports API seniority objects and string references', () => {
  const user = adaptUser({
    codigo: 'user-1', nome: 'Ana Silva', email: 'ana@example.com', perfil: 'membro', ativo: true,
    senioridade: senioridades[0],
  })
  const legacyShape = adaptUser({
    codigo: 'user-2', nome: 'Bruno Lima', email: 'bruno@example.com', perfil: 'membro', ativo: true,
    senioridade: 'Júnior',
  })

  assert.equal(user.id, 'user-1')
  assert.equal(user.senioridade, 'junior')
  assert.deepEqual(user.senioridadeRef, senioridades[0])
  assert.equal(legacyShape.senioridade, 'junior')
  assert.equal(legacyShape.senioridadeRef, null)
  assert.equal('senha' in user, true)
  assert.equal(user.senha, undefined)
})

test('adaptProject and adaptTask normalize nested resource references and dates', () => {
  const project = adaptProject({
    codigo: 'project-1', nome: 'ERP', descricao: 'Integração',
    dataInicio: '2026-10-01T00:00:00.000Z', dataFim: '2026-10-31', status: 'em_execucao',
    membros: [{ codigo: 'user-1' }, { codigo: 'user-2' }],
  })
  const task = adaptTask({
    codigo: 'task-1', projeto: { codigo: 'project-1' }, titulo: 'Testar API',
    dataInicio: '2026-10-02', dataFim: '2026-10-03', status: 'andamento', prioridade: 'P2',
    dependeDe: { codigo: 'task-0' }, responsaveis: [{ codigo: 'user-1' }],
    checklist: [{ codigo: 'item-1', texto: 'Cobrir 422', feito: 1 }],
  })

  assert.deepEqual(project.membros, ['user-1', 'user-2'])
  assert.equal(project.inicio, '2026-10-01')
  assert.equal(task.projetoId, 'project-1')
  assert.equal(task.dependeDe, 'task-0')
  assert.deepEqual(task.responsaveis, ['user-1'])
  assert.deepEqual(task.checklist, [{ id: 'item-1', texto: 'Cobrir 422', feito: true }])
})

test('adaptTraining, adaptCheckin, adaptDocument and adaptFeedback map API relations', () => {
  const training = adaptTraining({
    codigo: 'training-1', titulo: 'Segurança', data: '2026-10-10', hora: '09:00',
    instrutor: { codigo: 'user-1', nome: 'Ana' }, inscritos: [{ codigo: 'user-2' }],
    vagas: 10, tipo: 'computacao', sala: 'Lab 1',
  })
  const checkin = adaptCheckin({
    codigo: 'checkin-1', usuario: { codigo: 'user-1' }, semana: '2026-10-05', humor: 4,
    resumo: 'Boa semana', aprendizados: 'Testes', sentimento: null,
  })
  const document = adaptDocument({
    codigo: 'doc-1', pasta: { codigo: 'folder-1' }, nome: 'api.pdf', extensao: 'PDF',
    tamanhoBytes: '2048', dataEnvio: '2026-10-09', autor: { codigo: 'user-1', nome: 'Ana' },
    arquivoUrl: 'https://example.com/api.pdf',
  })
  const feedback = adaptFeedback({
    codigo: 'feedback-1', capacitacao: { codigo: 'training-1' }, usuario: { codigo: 'user-2' },
    nota: 5, data: '2026-10-10', bom: null, melhorar: 'Mais exemplos',
  })

  assert.equal(training.instrutor, 'Ana')
  assert.equal(training.instrutorId, 'user-1')
  assert.deepEqual(training.inscritos, ['user-2'])
  assert.equal(checkin.usuarioId, 'user-1')
  assert.equal(checkin.sentimento, '')
  assert.equal(document.pastaId, 'folder-1')
  assert.equal(document.tam, 2048)
  assert.equal(document.autor, 'Ana')
  assert.equal(feedback.capId, 'training-1')
  assert.equal(feedback.bom, '')
})

test('readConfig maps server seniority values without losing the hourly rate', () => {
  const config = readConfig(senioridades)

  assert.deepEqual(config.senioridades, { junior: 'Júnior', senior: 'Sênior' })
  assert.deepEqual(config.valorHora, { junior: 45, senior: 120 })
  assert.deepEqual(config.perfis, ['diretor', 'gerente', 'membro'])
  assert.match(config.hoje, /^\d{4}-\d{2}-\d{2}$/)
})

test('resolveSenioridade resolves values by code or display name and rejects unknown values', () => {
  assert.deepEqual(resolveSenioridade({ perfil: 'membro', senioridade: 'senior' }, senioridades), senioridades[1])
  assert.deepEqual(resolveSenioridade({ perfil: 'membro', senioridade: 'Júnior' }, senioridades), senioridades[0])
  assert.equal(resolveSenioridade({ perfil: 'gerente', senioridade: 'junior' }, senioridades), null)
  assert.throws(
    () => resolveSenioridade({ perfil: 'membro', senioridade: 'especialista' }, senioridades),
    /Não foi possível identificar a senioridade/,
  )
})
