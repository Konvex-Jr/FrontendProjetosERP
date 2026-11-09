import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adaptProject,
  adaptTask,
  adaptUser,
  readConfig,
  normalizeSenioridades,
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


test('readConfig maps server seniority values without losing the hourly rate', () => {
  const config = readConfig(senioridades)

  assert.deepEqual(config.senioridades, { junior: 'Júnior', senior: 'Sênior' })
  assert.deepEqual(config.valorHora, { junior: 45, senior: 120 })
  assert.deepEqual(config.perfis, ['diretor', 'gerente', 'membro'])
  assert.match(config.hoje, /^\d{4}-\d{2}-\d{2}$/)
})

test('normalizeSenioridades accepts snake_case API fields', () => {
  assert.deepEqual(
    normalizeSenioridades([{ codigo: 'pleno', nome: 'Pleno', valor_hora: '75' }]),
    [{ codigo: 'pleno', nome: 'Pleno', valorHora: 75 }],
  )
})

test('readConfig does not invent seniorities when the authenticated API returns an empty list', () => {
  assert.deepEqual(readConfig([], false).senioridades, {})
  assert.deepEqual(readConfig().senioridades, { junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior' })
})


test('normalizeSenioridades preserves database codes and handles an empty database list', () => {
  const rows = normalizeSenioridades([
    { codigo: 'DEV_JR', nome: 'Desenvolvedor Júnior', valor_hora: '62.50' },
    { id: 'ARQ', name: 'Arquiteto', hourlyRate: 140 },
  ])

  assert.deepEqual(rows, [
    { codigo: 'DEV_JR', nome: 'Desenvolvedor Júnior', valorHora: 62.5 },
    { codigo: 'ARQ', nome: 'Arquiteto', valorHora: 140 },
  ])
  assert.deepEqual(normalizeSenioridades([]), [])
  assert.deepEqual(readConfig([], false).senioridades, {})
})
