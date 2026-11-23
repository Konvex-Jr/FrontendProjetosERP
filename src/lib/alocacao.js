/**
 * Visões da gestão em Projetos (sessão 28a): "Alocação" (por pessoa) e "Campinho" (por projeto).
 * Funções puras sobre o JSON cru de `projetos.listar()`: projeto completo traz `participacoes`;
 * cartão traz `membros` (equipe atual, sem função) e `lider`.
 * Os projetos gerais das áreas ficam de fora: todo mundo da área está neles, e contá-los
 * faria todos parecerem "em vários projetos".
 */
import { GRUPOS_PROJETO } from './indicadores.js'

const ATIVOS = GRUPOS_PROJETO.ativos.status

/** Projeto que entra nas visões: ativo e não geral da área. */
export const contaNaAlocacao = p => ATIVOS.includes(p.status) && !p.geralDaArea

/** Equipe atual: [{ codigo, nome, foto, funcao }]. No cartão a função não vem (null). */
export function equipeAtual(p) {
  if (p.cartao) return (p.membros || []).map(m => ({ codigo: m.codigo, nome: m.nome, foto: m.foto || null, funcao: null }))
  return (p.participacoes || [])
    .filter(x => !x.dataSaida)
    .map(x => ({ codigo: x.usuario.codigo, nome: x.usuario.nome, foto: x.usuario.foto || null, funcao: (x.funcao || '').trim() || null }))
}

/** { codigo: [{ codigo, nome, lider }] } com os projetos ativos de cada pessoa, em ordem de nome. */
export function projetosPorPessoa(lista) {
  const mapa = {}
  for (const p of lista.filter(contaNaAlocacao)) {
    for (const m of equipeAtual(p)) {
      ;(mapa[m.codigo] ||= []).push({ codigo: p.codigo, nome: p.nome, lider: p.lider?.codigo === m.codigo })
    }
  }
  for (const k of Object.keys(mapa)) mapa[k].sort((a, b) => a.nome.localeCompare(b.nome))
  return mapa
}

/**
 * Linhas da visão Alocação: pessoas na EJ com o percentual da semana (null se não veio) e os projetos.
 * Ordem: maior percentual primeiro; sem percentual no fim; empate pelo nome.
 */
export function linhasAlocacao(pessoas, ocupacoes, lista) {
  const pct = Object.fromEntries((ocupacoes || []).map(o => [o.codigoUsuario, o.percentual]))
  const proj = projetosPorPessoa(lista)
  return pessoas
    .filter(u => u.naEj)
    .map(u => ({
      id: u.codigo,
      codigo: u.codigo,
      nome: u.nome,
      foto: u.foto || null,
      trainee: u.status === 'trainee',
      percentual: pct[u.codigo] ?? null,
      projetos: proj[u.codigo] || [],
    }))
    .sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1) || a.nome.localeCompare(b.nome))
}

/** Rótulo da pessoa no "Adicionar à equipe": "Ana · 80%", "Ana · 120% (acima do teto)"; sem % fica o nome. */
export function rotuloComCarga(nome, percentual) {
  if (percentual == null) return nome
  const p = Math.round(percentual)
  return `${nome} · ${p}%${p > 100 ? ' (acima do teto)' : ''}`
}

/**
 * Colunas do campinho, da defesa ao ataque: líder primeiro (capitão), depois uma coluna por função
 * (sem diferenciar maiúsculas, em ordem alfabética) e "Sem função" por último. Coluna vazia não aparece.
 * Cada peça: { codigo, nome, foto, funcao, capitao }.
 */
export function colunasDoCampinho(p) {
  const equipe = equipeAtual(p)
  const capitaes = new Set(p.lider?.codigo ? [p.lider.codigo] : p.lideresDaArea || [])
  const colunas = []
  const lideres = equipe.filter(m => capitaes.has(m.codigo)).map(m => ({ ...m, capitao: true }))
  if (lideres.length) colunas.push({ rotulo: 'Líder', pecas: lideres })
  const porFuncao = new Map()
  const semFuncao = []
  for (const m of equipe.filter(m => !capitaes.has(m.codigo))) {
    if (!m.funcao) {
      semFuncao.push({ ...m, capitao: false })
      continue
    }
    const chave = m.funcao.toLocaleLowerCase('pt-BR')
    if (!porFuncao.has(chave)) porFuncao.set(chave, { rotulo: m.funcao, pecas: [] })
    porFuncao.get(chave).pecas.push({ ...m, capitao: false })
  }
  colunas.push(...[...porFuncao.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo)))
  if (semFuncao.length) colunas.push({ rotulo: 'Sem função', pecas: semFuncao })
  for (const c of colunas) c.pecas.sort((a, b) => a.nome.localeCompare(b.nome))
  return colunas
}
