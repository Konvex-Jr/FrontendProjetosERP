import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adaptProject, adaptTask, adaptUser, readConfig, normalizeSenioridades } from '../src/lib/apiMappers.js'

const senioridades = [
  { codigo: 'junior', nome: 'Júnior', valorHora: 45 },
  { codigo: 'senior', nome: 'Sênior', valorHora: 120 },
]

test('adaptUser supports API seniority objects and string references', () => {
  const user = adaptUser({
    codigo: 'user-1',
    nome: 'Ana Silva',
    email: 'ana@example.com',
    perfil: 'membro',
    ativo: true,
    senioridade: senioridades[0],
  })
  const legacyShape = adaptUser({
    codigo: 'user-2',
    nome: 'Bruno Lima',
    email: 'bruno@example.com',
    perfil: 'membro',
    ativo: true,
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
    codigo: 'project-1',
    nome: 'ERP',
    descricao: 'Integração',
    dataInicio: '2026-10-01T00:00:00.000Z',
    dataFim: '2026-10-31',
    status: 'em_execucao',
    membros: [{ codigo: 'user-1' }, { codigo: 'user-2' }],
  })
  const task = adaptTask({
    codigo: 'task-1',
    projeto: { codigo: 'project-1' },
    iniciativa: { codigo: 'ini-1', nome: 'Antiga' },
    titulo: 'Testar API',
    dataInicio: '2026-10-02',
    dataFim: '2026-10-03',
    status: 'andamento',
    prioridade: 'P2',
    dependeDe: { codigo: 'task-0' },
    responsaveis: [{ codigo: 'user-1' }],
    checklist: [{ codigo: 'item-1', texto: 'Cobrir 422', feito: 1 }],
  })

  assert.deepEqual(project.membros, ['user-1', 'user-2'])
  assert.equal(project.inicio, '2026-10-01')
  assert.equal(task.projetoId, 'project-1')
  assert.equal('iniciativaId' in task || 'iniciativaNome' in task, false)
  assert.equal(task.dependeDe, 'task-0')
  assert.deepEqual(task.responsaveis, ['user-1'])
  assert.deepEqual(task.checklist, [{ id: 'item-1', texto: 'Cobrir 422', feito: true, responsavel: undefined }])
  assert.equal(task.quantidadeAnexos, 0)
  assert.equal(adaptTask({ codigo: 't', quantidadeAnexos: 3 }).quantidadeAnexos, 3)
})

test('readConfig maps server seniority values without losing the hourly rate', () => {
  const config = readConfig(senioridades)

  assert.deepEqual(config.senioridades, { junior: 'Júnior', senior: 'Sênior' })
  assert.deepEqual(config.valorHora, { junior: 45, senior: 120 })
  assert.deepEqual(config.perfis, ['diretor', 'gerente', 'membro'])
  assert.match(config.hoje, /^\d{4}-\d{2}-\d{2}$/)
})

test('normalizeSenioridades accepts snake_case API fields', () => {
  assert.deepEqual(normalizeSenioridades([{ codigo: 'pleno', nome: 'Pleno', valor_hora: '75' }]), [
    { codigo: 'pleno', nome: 'Pleno', valorHora: 75 },
  ])
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

test('adaptProject do projeto completo: cartao falso, líder e contagem mantidos', () => {
  const p = adaptProject({
    codigo: 'p1',
    nome: 'X',
    sigiloso: true,
    lider: { codigo: 'u1', nome: 'Ana' },
    tarefas: { total: 3, concluidas: 1, atrasadas: 1, semana: 0 },
  })
  assert.equal(p.sigiloso, true)
  assert.equal(p.cartao, false)
  assert.equal(p.liderId, 'u1')
  assert.equal(p.liderNome, 'Ana')
  assert.deepEqual(p.tarefas, { total: 3, concluidas: 1, atrasadas: 1, semana: 0 })
  assert.equal('podeGerirAcesso' in p, false)
  assert.equal('acesso' in p, false)
  assert.equal('resumo' in p, false)
  assert.equal('tarefasResumo' in p, false)
  const normal = adaptProject({ codigo: 'p2', nome: 'Y' })
  assert.deepEqual([normal.sigiloso, normal.cartao, normal.liderId, normal.liderNome], [false, false, null, null])
})

test('adaptProject do cartão: só os campos da lista fechada, sem equipe nem tarefas', () => {
  const p = adaptProject({
    codigo: 'p9',
    nome: 'Sigiloso',
    tipo: 'interno',
    area: { codigo: 'a1', nome: 'Marketing' },
    status: 'em_execucao',
    lider: { codigo: 'u1', nome: 'Ana' },
    sigiloso: true,
    geralDaArea: false,
    cartao: true,
  })
  assert.equal(p.cartao, true)
  assert.equal(p.id, 'p9')
  assert.equal(p.nome, 'Sigiloso')
  assert.equal(p.tipo, 'interno')
  assert.equal(p.areaId, 'a1')
  assert.equal(p.areaNome, 'Marketing')
  assert.equal(p.status, 'em_execucao')
  assert.equal(p.sigiloso, true)
  assert.equal(p.geralDaArea, false)
  assert.equal(p.liderId, 'u1')
  assert.equal(p.liderNome, 'Ana')
  assert.deepEqual(p.membros, [])
  assert.equal('tarefas' in p, false)
  assert.equal('tarefasResumo' in p, false)
  const semLider = adaptProject({ codigo: 'p8', nome: 'C', tipo: 'cliente', area: null, lider: null, cartao: true })
  assert.deepEqual([semLider.areaId, semLider.areaNome, semLider.liderId, semLider.liderNome], [null, null, null, null])
})

test('adaptTask traz a coluna (ou null) e adaptProject as colunas', () => {
  const col = { codigo: 'c1', nome: 'A fazer', cor: 'cinza', papel: 'entrada' }
  assert.deepEqual(adaptTask({ codigo: 't', projeto: { codigo: 'p' }, coluna: col }).coluna, {
    id: 'c1',
    nome: 'A fazer',
    cor: 'cinza',
    papel: 'entrada',
  })
  assert.equal(adaptTask({ codigo: 't', coluna: null }).coluna, null)
  assert.equal(adaptTask({ codigo: 't' }).coluna, null)
  assert.deepEqual(adaptProject({ codigo: 'p', nome: 'X', colunas: [col] }).colunas, [
    { id: 'c1', nome: 'A fazer', cor: 'cinza', papel: 'entrada' },
  ])
  assert.deepEqual(adaptProject({ codigo: 'p', nome: 'X', resumo: true }).colunas, [])
})

test('adaptProject traz tipo, área e líderes da área; adaptTask sem avulsa/categoria (23b)', () => {
  const p = adaptProject({
    codigo: 4,
    nome: 'Geral',
    tipo: 'interno',
    geralDaArea: true,
    lideresDaArea: [7],
    area: { codigo: 10, nome: 'Inovação' },
  })
  assert.equal(p.tipo, 'interno')
  assert.equal(p.geralDaArea, true)
  assert.deepEqual(p.lideresDaArea, [7])
  assert.equal(p.areaId, 10)
  assert.equal(p.areaNome, 'Inovação')
  assert.equal(adaptProject({ codigo: 1, nome: 'X' }).tipo, 'cliente')
  const t = adaptTask({ codigo: 1, titulo: 'T', projeto: { codigo: 4, nome: 'Geral' } })
  assert.equal('avulsa' in t, false)
  assert.equal('categoria' in t, false)
})
