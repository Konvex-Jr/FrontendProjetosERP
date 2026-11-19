import { iso } from './utils.js'
import { adaptColuna } from './colunas.js'

/**
 * Conversões do formato da API (codigo, dataInicio, objetos aninhados) para o formato curto
 * guardado no contexto (`D`: id, inicio, fim, listas de códigos). As telas mais novas usam
 * o objeto da API direto (com `codigo`); estas funções servem o contexto e as tarefas.
 */

/** Texto → chave sem acento e em minúsculas ('Sênior' → 'senior'); é a chave das senioridades. */
export const slug = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')

/** Data da API ('2026-11-12T00:00:00.000Z') → '2026-11-12'. Só corta o texto, sem converter fuso. */
export const dateOnly = value => (value ? String(value).slice(0, 10) : '')

/** Aceita a referência como objeto ({ codigo, nome }) ou já como código; devolve o código. */
export function userCode(value) {
  if (!value || typeof value !== 'object') return value
  return value.codigo ?? value.id ?? null
}

export function adaptUser(user) {
  const senioridadeRef = user.senioridade && typeof user.senioridade === 'object' ? user.senioridade : null
  const senioridadeValue = senioridadeRef?.codigo || senioridadeRef?.nome || user.senioridade

  return {
    id: user.codigo,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    ativo: user.ativo,
    status: user.status,
    foto: user.foto ?? null,
    senha: undefined,
    senioridade: senioridadeValue ? slug(senioridadeValue) : undefined,
    senioridadeRef,
  }
}

export function adaptProject(project) {
  return {
    id: project.codigo,
    nome: project.nome,
    descricao: project.descricao ?? '',
    inicio: dateOnly(project.dataInicio),
    fim: dateOnly(project.dataFim),
    status: project.status,
    membros: (project.membros || []).map(userCode),
    // Contagem de todas as tarefas do projeto (para o progresso; ver prog em lib/utils.js).
    tarefas: project.tarefas,
    // Sigilo: o resumo (gerente fora da lista) só traz nome, status, datas, contagens e equipe.
    tipo: project.tipo || 'cliente',
    geralDaArea: !!project.geralDaArea,
    lideresDaArea: project.lideresDaArea || [],
    areaId: project.area?.codigo ?? null,
    areaNome: project.area?.nome ?? null,
    sigiloso: !!project.sigiloso,
    resumo: !!project.resumo,
    acesso: project.acesso || [],
    colunas: (project.colunas || []).map(adaptColuna),
    podeGerirAcesso: !!project.podeGerirAcesso,
    ...(project.resumo
      ? {
          tarefasResumo: {
            total: project.tarefas?.total || 0,
            concluidas: project.tarefas?.concluidas || 0,
            atrasadas: project.tarefas?.atrasadas || 0,
            semana: project.tarefas?.semana || 0,
          },
        }
      : {}),
  }
}

export function adaptTask(task) {
  return {
    id: task.codigo,
    projetoId: userCode(task.projeto) || undefined,
    projetoNome: task.projeto?.nome,
    criadaPor: task.criadaPor ? task.criadaPor.nomeExibicao || task.criadaPor.nome : undefined,
    titulo: task.titulo,
    descricao: task.descricao || '',
    inicio: dateOnly(task.dataInicio),
    fim: dateOnly(task.dataFim),
    status: task.status,
    prioridade: task.prioridade,
    dificuldade: task.dificuldade || '',
    conclusao: task.dataConclusao ? dateOnly(task.dataConclusao) : undefined,
    concluidaPor: task.concluidaPor ? task.concluidaPor.nomeExibicao || task.concluidaPor.nome : undefined,
    dependeDe: userCode(task.dependeDe) || undefined,
    responsaveis: (task.responsaveis || []).map(userCode),
    quantidadeAnexos: task.quantidadeAnexos ?? 0,
    coluna: task.coluna ? adaptColuna(task.coluna) : null,
    checklist: (task.checklist || []).map(item => ({
      id: item.codigo ?? item.id,
      texto: item.texto,
      feito: Boolean(item.feito),
    })),
  }
}

/**
 * Configuração do contexto (`D.c`): `hoje` (AAAA-MM-DD de quando os dados carregaram), perfis e,
 * por senioridade, nome e valor/hora (usados na Precificação). `usarPadrao` põe senioridades de
 * exemplo quando não há registros (antes do login); logado, a lista vem da API.
 */
export function readConfig(registros = [], usarPadrao = registros.length === 0) {
  const senioridades = registros.length
    ? registros
    : usarPadrao
      ? [
          { codigo: 'junior', nome: 'Júnior', valorHora: 45 },
          { codigo: 'pleno', nome: 'Pleno', valorHora: 75 },
          { codigo: 'senior', nome: 'Sênior', valorHora: 120 },
        ]
      : []

  return {
    hoje: iso(new Date()),
    perfis: ['diretor', 'gerente', 'membro'],
    senioridades: Object.fromEntries(senioridades.map(item => [slug(item.codigo || item.nome), item.nome])),
    valorHora: Object.fromEntries(senioridades.map(item => [slug(item.codigo || item.nome), Number(item.valorHora) || 0])),
  }
}

/** Lista de senioridades em { codigo, nome, valorHora }, aceite ela como lista ou como objeto. */
export function normalizeSenioridades(registros = []) {
  // A API normalmente retorna uma lista de entidades. Aceitamos também a forma
  // de configuração usada pelas telas para evitar divergências entre versões.
  const lista = Array.isArray(registros)
    ? registros
    : Object.entries(registros || {}).map(([codigo, valor]) =>
        typeof valor === 'object' && valor !== null ? { codigo: valor.codigo || codigo, ...valor } : { codigo, nome: valor, valorHora: 0 },
      )

  return lista
    .map(item => ({
      codigo: String(item?.codigo ?? item?.code ?? item?.id ?? '').trim(),
      nome: String(item?.nome ?? item?.name ?? '').trim(),
      valorHora: Number(item?.valorHora ?? item?.valor_hora ?? item?.hourlyRate ?? 0),
    }))
    .filter(item => item.codigo && item.nome)
}

/**
 * Item da Biblioteca (sessão 17). Mantém o formato da API (`codigo`), só garante os padrões.
 * `projeto` é null sem projeto e também quando a pessoa não vê o projeto ligado.
 */
export const itemBibliotecaDaApi = item => ({
  codigo: item.codigo,
  titulo: item.titulo || '',
  conteudo: item.conteudo || '',
  links: item.links || [],
  tags: item.tags || [],
  projeto: item.projeto ? { codigo: item.projeto.codigo, nome: item.projeto.nome } : null,
  sigilo: item.sigilo || 'todos',
  autor: item.autor ? { codigo: item.autor.codigo, nome: item.autor.nome } : null,
  criadoEm: item.criadoEm || '',
  atualizadoEm: item.atualizadoEm || '',
  podeAlterar: Boolean(item.podeAlterar),
  anexos: item.anexos || [],
})
