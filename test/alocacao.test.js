import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colunasDoCampinho, contaNaAlocacao, equipeAtual, linhasAlocacao, projetosPorPessoa, rotuloComCarga } from '../src/lib/alocacao.js'

const part = (codigo, nome, funcao, dataSaida = null) => ({ usuario: { codigo, nome, foto: null }, funcao, dataSaida })

const completo = {
  codigo: 'p1',
  nome: 'Site',
  status: 'em_execucao',
  lider: { codigo: 'a' },
  participacoes: [
    part('a', 'Ana', 'Gerente'),
    part('b', 'Bia', 'dev'),
    part('c', 'Caio', 'Dev'),
    part('d', 'Davi', ''),
    part('e', 'Eva', 'Dev', '2026-01-01'),
  ],
}
const cartao = {
  codigo: 'p2',
  nome: 'App',
  status: 'atencao',
  cartao: true,
  lider: { codigo: 'b', nome: 'Bia' },
  membros: [{ codigo: 'b', nome: 'Bia' }],
}
const geral = {
  codigo: 'g',
  nome: 'Inovação geral',
  status: 'em_execucao',
  geralDaArea: true,
  lideresDaArea: ['a'],
  participacoes: [part('a', 'Ana', null)],
}
const concluido = { codigo: 'p3', nome: 'Velho', status: 'concluido', participacoes: [part('a', 'Ana', null)] }

test('contaNaAlocacao: só ativo e não geral', () => {
  assert.equal(contaNaAlocacao(completo), true)
  assert.equal(contaNaAlocacao(geral), false)
  assert.equal(contaNaAlocacao(concluido), false)
})

test('equipeAtual: sem quem saiu; cartão sem função', () => {
  assert.deepEqual(
    equipeAtual(completo).map(m => [m.codigo, m.funcao]),
    [
      ['a', 'Gerente'],
      ['b', 'dev'],
      ['c', 'Dev'],
      ['d', null],
    ],
  )
  assert.deepEqual(equipeAtual(cartao), [{ codigo: 'b', nome: 'Bia', foto: null, funcao: null }])
})

test('projetosPorPessoa: ativos, sem geral, com líder marcado e ordem de nome', () => {
  const m = projetosPorPessoa([completo, cartao, geral, concluido])
  assert.deepEqual(m.a, [{ codigo: 'p1', nome: 'Site', lider: true }])
  assert.deepEqual(m.b, [
    { codigo: 'p2', nome: 'App', lider: true },
    { codigo: 'p1', nome: 'Site', lider: false },
  ])
  assert.equal(m.e, undefined)
})

test('linhasAlocacao: só na EJ, maior % primeiro, sem % no fim', () => {
  const pessoas = [
    { codigo: 'a', nome: 'Ana', naEj: true },
    { codigo: 'b', nome: 'Bia', naEj: true, status: 'trainee' },
    { codigo: 'c', nome: 'Caio', naEj: true },
    { codigo: 'z', nome: 'Zé', naEj: false },
  ]
  const ocup = [
    { codigoUsuario: 'a', percentual: 40 },
    { codigoUsuario: 'b', percentual: 120 },
  ]
  const linhas = linhasAlocacao(pessoas, ocup, [completo, cartao])
  assert.deepEqual(
    linhas.map(l => [l.codigo, l.percentual, l.projetos.length, l.trainee]),
    [
      ['b', 120, 2, true],
      ['a', 40, 1, false],
      ['c', null, 1, false],
    ],
  )
  assert.equal(linhasAlocacao(pessoas, null, [])[0].percentual, null)
})

test('rotuloComCarga', () => {
  assert.equal(rotuloComCarga('Ana', 79.6), 'Ana · 80%')
  assert.equal(rotuloComCarga('Ana', 100.4), 'Ana · 100%')
  assert.equal(rotuloComCarga('Ana', 120), 'Ana · 120% (acima do teto)')
  assert.equal(rotuloComCarga('Ana', null), 'Ana')
})

test('colunasDoCampinho: líder, funções sem caixa, sem função por último', () => {
  const cols = colunasDoCampinho(completo)
  assert.deepEqual(
    cols.map(c => [c.rotulo, c.pecas.map(p => p.codigo)]),
    [
      ['Líder', ['a']],
      ['dev', ['b', 'c']],
      ['Sem função', ['d']],
    ],
  )
  assert.equal(cols[0].pecas[0].capitao, true)
})

test('colunasDoCampinho: geral usa líderes da área; cartão vai todo para sem função', () => {
  assert.deepEqual(colunasDoCampinho(geral)[0].rotulo, 'Líder')
  assert.deepEqual(
    colunasDoCampinho({
      ...cartao,
      membros: [
        { codigo: 'b', nome: 'Bia' },
        { codigo: 'x', nome: 'Xu' },
      ],
    }).map(c => c.rotulo),
    ['Líder', 'Sem função'],
  )
  assert.deepEqual(colunasDoCampinho({ codigo: 'v', participacoes: [] }), [])
})
