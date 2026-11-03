import { iso } from './utils.js'

export const slug = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')

export const dateOnly = value => value ? String(value).slice(0, 10) : ''

export function userCode(value) {
  if (!value || typeof value !== 'object') return value
  return value.codigo ?? value.id ?? null
}

export function adaptUser(user) {
  const senioridadeRef = user.senioridade && typeof user.senioridade === 'object'
    ? user.senioridade
    : null
  const senioridadeValue = senioridadeRef?.codigo || senioridadeRef?.nome || user.senioridade

  return {
    id: user.codigo,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    ativo: user.ativo,
    status: user.status,
    senha: undefined,
    senioridade: senioridadeValue ? slug(senioridadeValue) : undefined,
    senioridadeRef,
  }
}

export function adaptProject(project) {
  return {
    id: project.codigo,
    nome: project.nome,
    descricao: project.descricao,
    inicio: dateOnly(project.dataInicio),
    fim: dateOnly(project.dataFim),
    status: project.status,
    membros: (project.membros || []).map(userCode),
  }
}

export function adaptTask(task) {
  return {
    id: task.codigo,
    projetoId: userCode(task.projeto) || undefined,
    projetoNome: task.projeto?.nome,
    avulsa: !task.projeto,
    categoria: task.categoria || undefined,
    criadaPor: task.criadaPor ? (task.criadaPor.nomeExibicao || task.criadaPor.nome) : undefined,
    titulo: task.titulo,
    descricao: task.descricao || '',
    inicio: dateOnly(task.dataInicio),
    fim: dateOnly(task.dataFim),
    status: task.status,
    prioridade: task.prioridade,
    conclusao: task.dataConclusao ? dateOnly(task.dataConclusao) : undefined,
    concluidaPor: task.concluidaPor ? (task.concluidaPor.nomeExibicao || task.concluidaPor.nome) : undefined,
    dependeDe: userCode(task.dependeDe) || undefined,
    responsaveis: (task.responsaveis || []).map(userCode),
    checklist: (task.checklist || []).map(item => ({
      id: item.codigo ?? item.id,
      texto: item.texto,
      feito: Boolean(item.feito),
    })),
  }
}

export function adaptTraining(training) {
  return {
    id: training.codigo,
    titulo: training.titulo,
    data: dateOnly(training.data),
    hora: training.hora,
    instrutor: training.instrutor?.nome || training.instrutor || '—',
    instrutorId: userCode(training.instrutor),
    vagas: training.vagas,
    tipo: training.tipo,
    sala: training.sala,
    inscritos: (training.inscritos || []).map(userCode),
  }
}

export function adaptFeedback(feedback) {
  return {
    id: feedback.codigo,
    capId: userCode(feedback.capacitacao),
    usuarioId: userCode(feedback.usuario),
    nota: feedback.nota,
    data: dateOnly(feedback.data),
    bom: feedback.bom || '',
    melhorar: feedback.melhorar || '',
  }
}

export function readConfig(registros = [], usarPadrao = registros.length === 0) {
  const senioridades = registros.length
    ? registros
    : (usarPadrao ? [
        { codigo: 'junior', nome: 'Júnior', valorHora: 45 },
        { codigo: 'pleno', nome: 'Pleno', valorHora: 75 },
        { codigo: 'senior', nome: 'Sênior', valorHora: 120 },
      ] : [])

  return {
    hoje: iso(new Date()),
    perfis: ['diretor', 'gerente', 'membro'],
    senioridades: Object.fromEntries(senioridades.map(item => [slug(item.codigo || item.nome), item.nome])),
    valorHora: Object.fromEntries(senioridades.map(item => [slug(item.codigo || item.nome), Number(item.valorHora) || 0])),
  }
}

export function normalizeSenioridades(registros = []) {
  // A API normalmente retorna uma lista de entidades. Aceitamos também a forma
  // de configuração usada pelas telas para evitar divergências entre versões.
  const lista = Array.isArray(registros)
    ? registros
    : Object.entries(registros || {}).map(([codigo, valor]) =>
      typeof valor === 'object' && valor !== null
        ? { codigo: valor.codigo || codigo, ...valor }
        : { codigo, nome: valor, valorHora: 0 }
    )

  return lista
    .map(item => ({
      codigo: String(item?.codigo ?? item?.code ?? item?.id ?? '').trim(),
      nome: String(item?.nome ?? item?.name ?? '').trim(),
      valorHora: Number(item?.valorHora ?? item?.valor_hora ?? item?.hourlyRate ?? 0),
    }))
    .filter(item => item.codigo && item.nome)
}
