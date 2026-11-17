import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adaptColuna,
  agrupar,
  corpoColunas,
  efeitoNaConclusao,
  erroDoRascunho,
  excluidasComTarefas,
  marcar,
  mover,
  novoRascunho,
} from '../src/lib/colunas.js'

const cols = [
  { id: 'a', nome: 'A fazer', cor: 'cinza', papel: 'entrada' },
  { id: 'b', nome: 'Fazendo', cor: 'azul', papel: 'meio' },
  { id: 'c', nome: 'Revisando', cor: 'amarelo', papel: 'meio' },
  { id: 'd', nome: 'Concluído', cor: 'verde', papel: 'concluida' },
]
const t = (id, colunaId, prioridade = 'P2', fim = '2026-11-10') => ({
  id,
  prioridade,
  fim,
  coluna: colunaId ? cols.find(c => c.id === colunaId) || { id: colunaId } : null,
})
const papeis = l => l.map(c => c.papel).join()

test('adaptColuna troca codigo por id', () => {
  assert.deepEqual(adaptColuna({ codigo: 'x', nome: 'N', cor: 'rosa', papel: 'meio' }), { id: 'x', nome: 'N', cor: 'rosa', papel: 'meio' })
})

test('agrupar segue a ordem das colunas, manda órfã para a entrada e ordena dentro', () => {
  const g = agrupar(cols, [
    t('1', 'b', 'P3', '2026-11-01'),
    t('2', 'b', 'P1', '2026-11-20'),
    t('3', 'b', 'P1', '2026-11-05'),
    t('4', 'zzz'),
    t('5', null),
    t('6', 'd'),
  ])
  assert.deepEqual(
    g.map(x => x.coluna.id),
    ['a', 'b', 'c', 'd'],
  )
  assert.deepEqual(
    g[1].tarefas.map(x => x.id),
    ['3', '2', '1'],
  )
  assert.deepEqual(g[0].tarefas.map(x => x.id).sort(), ['4', '5'])
  assert.deepEqual(
    g[3].tarefas.map(x => x.id),
    ['6'],
  )
})

test('mover troca de lugar e respeita os limites', () => {
  const r = novoRascunho(cols)
  assert.deepEqual(
    mover(r, 1, 1).map(c => c.id),
    ['a', 'c', 'b', 'd'],
  )
  assert.deepEqual(
    mover(r, 1, -1).map(c => c.id),
    ['b', 'a', 'c', 'd'],
  )
  assert.equal(mover(r, 0, -1), r)
  assert.equal(mover(r, 3, 1), r)
  assert.equal(r[0].nova, false)
})

test('marcar mantém uma entrada e uma concluída', () => {
  const r = novoRascunho(cols)
  assert.equal(papeis(marcar(r, 'b', 'entrada')), 'meio,entrada,meio,concluida')
  assert.equal(papeis(marcar(r, 'c', 'concluida')), 'entrada,meio,concluida,meio')
  // a entrada recebe a marca de concluída: as marcas trocam
  assert.equal(papeis(marcar(r, 'a', 'concluida')), 'concluida,meio,meio,entrada')
  assert.equal(papeis(marcar(r, 'd', 'entrada')), 'concluida,meio,meio,entrada')
  assert.deepEqual(marcar(r, 'a', 'entrada'), r)
})

test('erroDoRascunho aponta o primeiro problema', () => {
  const r = novoRascunho(cols)
  assert.equal(erroDoRascunho(r), null)
  assert.equal(erroDoRascunho(r.map((c, i) => (i === 1 ? { ...c, nome: '  ' } : c))), 'Dê um nome à coluna 2.')
  const longo = 'x'.repeat(41)
  assert.equal(erroDoRascunho(r.map((c, i) => (i === 1 ? { ...c, nome: longo } : c))), `O nome "${longo}" passa de 40 caracteres.`)
  assert.equal(erroDoRascunho(r.map((c, i) => (i === 1 ? { ...c, nome: 'a fazer' } : c))), 'Há duas colunas chamadas "a fazer".')
  assert.equal(erroDoRascunho(r.slice(0, 1)), 'O quadro precisa de pelo menos 2 colunas.')
  const treze = Array.from({ length: 13 }, (_, i) => ({ id: 'n' + i, nome: 'C' + i, cor: 'cinza', papel: 'meio', nova: true }))
  assert.equal(erroDoRascunho(treze), 'O quadro aceita no máximo 12 colunas.')
})

test('excluidasComTarefas conta só colunas removidas que têm tarefas', () => {
  const tarefas = [t('1', 'b'), t('2', 'b'), t('3', 'a')]
  const r = novoRascunho(cols).filter(c => c.id !== 'b' && c.id !== 'c')
  assert.deepEqual(excluidasComTarefas(cols, r, tarefas), [{ coluna: cols[1], quantidade: 2 }])
})

test('corpoColunas envia nova sem codigo, mantém a ordem e os destinos', () => {
  const r = [...novoRascunho(cols), { id: 'tmp1', nome: ' Teste ', cor: 'rosa', papel: 'meio', nova: true }]
  const corpo = corpoColunas(r, { b: 'a' })
  assert.deepEqual(
    corpo.colunas.map(c => c.codigo),
    ['a', 'b', 'c', 'd', undefined],
  )
  assert.equal('codigo' in corpo.colunas[4], false)
  assert.equal(corpo.colunas[4].nome, 'Teste')
  assert.deepEqual(corpo.destinos, { b: 'a' })
})

test('efeitoNaConclusao conta quem conclui e quem reabre', () => {
  const tarefas = [t('1', 'b'), t('2', 'c'), t('3', 'd'), t('4', 'd')]
  const base = novoRascunho(cols)
  assert.deepEqual(efeitoNaConclusao(cols, base, {}, tarefas), { concluem: 0, reabrem: 0 })
  // Revisando vira a concluída: a de Revisando concluem, as 2 de Concluído reabrem
  assert.deepEqual(efeitoNaConclusao(cols, marcar(base, 'c', 'concluida'), {}, tarefas), { concluem: 1, reabrem: 2 })
  // excluir Fazendo com destino na concluída
  const semB = base.filter(c => c.id !== 'b')
  assert.deepEqual(efeitoNaConclusao(cols, semB, { b: 'd' }, tarefas), { concluem: 1, reabrem: 0 })
})
