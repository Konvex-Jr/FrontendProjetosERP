/** Colunas do quadro por projeto: cálculos puros (sem tela nem chamadas). */

export const CORES = ['cinza', 'azul', 'verde', 'amarelo', 'laranja', 'vermelho', 'roxo', 'rosa']
const MIN_COLUNAS = 2
const MAX_COLUNAS = 12
const MAX_NOME = 40

/** Coluna da API (`codigo`) no formato da tela (`id`). */
export const adaptColuna = c => ({ id: c.codigo, nome: c.nome, cor: c.cor, papel: c.papel })

// Ordem dentro da coluna: prioridade (P1 primeiro) e depois prazo (mesma regra do KanbanTarefas).
const ordem = (a, b) => (a.prioridade > b.prioridade ? 1 : a.prioridade < b.prioridade ? -1 : a.fim > b.fim ? 1 : a.fim < b.fim ? -1 : 0)

/** Coluna de entrada do quadro (papel `entrada`; sem ela, a primeira); quadro vazio = null. */
export const colunaDeEntrada = colunas => colunas?.find(c => c.papel === 'entrada') || colunas?.[0] || null

/** [{ coluna, tarefas }] na ordem das colunas; tarefa sem coluna conhecida vai para a de entrada. */
export function agrupar(colunas, tarefas) {
  const entrada = colunaDeEntrada(colunas)
  const grupos = colunas.map(coluna => ({ coluna, tarefas: [] }))
  for (const t of tarefas || []) {
    const grupo = grupos.find(g => g.coluna.id === t.coluna?.id) || grupos.find(g => g.coluna === entrada)
    if (grupo) grupo.tarefas.push(t)
  }
  for (const g of grupos) g.tarefas.sort(ordem)
  return grupos
}

/** Cópia editável das colunas do projeto. */
export const novoRascunho = colunas => colunas.map(c => ({ id: c.id, nome: c.nome, cor: c.cor, papel: c.papel, nova: false }))

/** Move a linha `indice` por `delta` posições; fora dos limites devolve a mesma lista. */
export function mover(rascunho, indice, delta) {
  const destino = indice + delta
  if (indice < 0 || indice >= rascunho.length || destino < 0 || destino >= rascunho.length) return rascunho
  const copia = [...rascunho]
  const [linha] = copia.splice(indice, 1)
  copia.splice(destino, 0, linha)
  return copia
}

/**
 * A coluna `id` recebe a marca `papel` ('entrada' ou 'concluida'). Quem tinha a marca vira 'meio',
 * a não ser que `id` tivesse a outra marca: aí as duas marcas trocam de coluna.
 */
export function marcar(rascunho, id, papel) {
  const alvo = rascunho.find(c => c.id === id)
  if (!alvo || alvo.papel === papel) return rascunho
  const anterior = alvo.papel
  return rascunho.map(c => {
    if (c.id === id) return { ...c, papel }
    if (c.papel === papel) return { ...c, papel: anterior === 'meio' ? 'meio' : anterior }
    return c
  })
}

/** Colunas que existiam em `antes`, saíram do rascunho e têm tarefas: [{ coluna, quantidade }]. */
export function excluidasComTarefas(antes, rascunho, tarefas) {
  return antes
    .filter(c => !rascunho.some(r => r.id === c.id))
    .map(coluna => ({ coluna, quantidade: (tarefas || []).filter(t => t.coluna?.id === coluna.id).length }))
    .filter(x => x.quantidade > 0)
}

/** Texto do primeiro problema do rascunho ou null. */
export function erroDoRascunho(rascunho) {
  if (rascunho.length < MIN_COLUNAS) return `O quadro precisa de pelo menos ${MIN_COLUNAS} colunas.`
  if (rascunho.length > MAX_COLUNAS) return `O quadro aceita no máximo ${MAX_COLUNAS} colunas.`
  const vistos = new Set()
  for (let i = 0; i < rascunho.length; i += 1) {
    const nome = (rascunho[i].nome || '').trim()
    if (!nome) return `Dê um nome à coluna ${i + 1}.`
    if (nome.length > MAX_NOME) return `O nome "${nome}" passa de ${MAX_NOME} caracteres.`
    const chave = nome.toLowerCase()
    if (vistos.has(chave)) return `Há duas colunas chamadas "${nome}".`
    vistos.add(chave)
    if (!CORES.includes(rascunho[i].cor)) return `Escolha uma cor para a coluna "${nome}".`
  }
  if (rascunho.filter(c => c.papel === 'entrada').length !== 1) return 'O quadro precisa de uma coluna de entrada.'
  if (rascunho.filter(c => c.papel === 'concluida').length !== 1) return 'O quadro precisa de uma coluna de concluída.'
  return null
}

/** Corpo do PUT /projetos/:codigo/colunas. Coluna nova sai sem `codigo`; `destinos` é { [idExcluida]: idDestino }. */
export const corpoColunas = (rascunho, destinos = {}) => ({
  colunas: rascunho.map(c => ({
    ...(c.nova ? {} : { codigo: c.id }),
    nome: c.nome.trim(),
    cor: c.cor,
    papel: c.papel,
  })),
  destinos,
})

/** Quantas tarefas passam a concluídas e quantas são reabertas se o rascunho for gravado. */
export function efeitoNaConclusao(antes, rascunho, destinos, tarefas) {
  const concluidaAntes = antes.find(c => c.papel === 'concluida')?.id
  const concluidaDepois = rascunho.find(c => c.papel === 'concluida')?.id
  let concluem = 0
  let reabrem = 0
  for (const t of tarefas || []) {
    const origem = t.coluna?.id
    if (!origem) continue
    const fica = rascunho.some(c => c.id === origem)
    const final = fica ? origem : (destinos || {})[origem]
    const eraConcluida = origem === concluidaAntes
    const seraConcluida = final === concluidaDepois
    if (!eraConcluida && seraConcluida) concluem += 1
    if (eraConcluida && !seraConcluida) reabrem += 1
  }
  return { concluem, reabrem }
}
