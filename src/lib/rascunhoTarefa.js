/**
 * Rascunho da janela da tarefa (sessão 24b): o que a pessoa mudou e ainda não salvou.
 * Base do aviso "Descartar alterações?" ao fechar.
 */

import { colunaDeEntrada } from './colunas.js'

// Vazio é vazio: campo apagado (null, undefined, '' ou lista vazia) não conta como alteração.
const vazio = v => v == null || v === '' || (Array.isArray(v) && v.length === 0)

// A marcação do checklist grava na hora (PATCH), fora do rascunho: o `feito` não entra na comparação.
const semFeito = checklist => (checklist || []).map(({ feito: _feito, ...item }) => item)

const valor = (t, chave) => {
  const v = chave === 'checklist' ? semFeito(t.checklist) : t[chave]
  return vazio(v) ? undefined : JSON.stringify(v)
}

/**
 * O rascunho difere do original? Compara campo a campo (como `soMudouStatus`), sem o `feito` dos itens.
 * Em criação, `original` é o rascunho inicial e qualquer anexo escolhido (`anexosEscolhidos`) conta.
 */
export function mudouRascunho(original, rascunho, anexosEscolhidos = []) {
  if (anexosEscolhidos.length > 0) return true
  const chaves = new Set([...Object.keys(original || {}), ...Object.keys(rascunho || {})])
  for (const chave of chaves) if (valor(original || {}, chave) !== valor(rascunho || {}, chave)) return true
  return false
}

/**
 * Data de conclusão do rascunho ao trocar a Situação: concluir mostra hoje (a API grava a data real);
 * tarefa que já estava concluída e volta a concluída mantém a data dela; outra situação limpa.
 */
export const conclusaoDoStatus = (status, original, hoje) =>
  status === 'concluida' ? (original?.status === 'concluida' ? original.conclusao : hoje) : undefined

// Participante cria e fica como responsável (a API faz igual); quem organiza escolhe, só gente da equipe atual.
const responsaveisNoProjeto = (responsaveis, { organiza, membros, me }) =>
  organiza ? (responsaveis || []).filter(id => (membros || []).includes(id)) : [me]

/**
 * Rascunho de uma tarefa nova (modo criação da janela): campos vazios, prioridade P3 e a coluna clicada
 * (`colunaId`) ou a de entrada. `responsaveis` e as datas são os padrões da tela que abriu.
 */
export function rascunhoNovo({ projetoId, organiza, membros, me, colunas, responsaveis = [], colunaId, inicio = '', fim = '' }) {
  return {
    projetoId,
    titulo: '',
    descricao: '',
    prioridade: 'P3',
    dificuldade: '',
    inicio,
    fim,
    responsaveis: responsaveisNoProjeto(responsaveis, { organiza, membros, me }),
    checklist: [],
    coluna: (colunas || []).find(c => c.id === colunaId) || colunaDeEntrada(colunas),
  }
}

/**
 * Troca o projeto do rascunho de criação: refaz os responsáveis pela regra do novo projeto,
 * tira dos itens quem deixou de ser responsável e volta para a coluna de entrada do novo quadro.
 */
export function noProjeto(rascunho, { projetoId, organiza, membros, me, colunas }) {
  const responsaveis = responsaveisNoProjeto(rascunho.responsaveis, { organiza, membros, me })
  return {
    ...rascunho,
    projetoId,
    responsaveis,
    checklist: (rascunho.checklist || []).map(i =>
      i.responsavel && !responsaveis.includes(i.responsavel) ? { ...i, responsavel: undefined } : i,
    ),
    coluna: colunaDeEntrada(colunas),
  }
}
