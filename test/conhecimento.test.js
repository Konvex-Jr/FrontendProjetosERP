import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adaptConhecimento,
  consulta,
  corpoConhecimento,
  inicioDoPeriodo,
  lerLinks,
  lerTags,
  rotuloCategoria,
  valoresConhecimento,
} from '../src/services/conhecimento.js'
import { blocos, trechos } from '../src/lib/markdown.js'

const api = {
  codigo: 'k1',
  titulo: 'Pesquisa',
  categoria: 'pesquisa',
  resumo: 'R',
  conteudo: '## A',
  fonte: null,
  links: ['https://a.com'],
  tags: ['mercado'],
  data: '2026-10-20T00:00:00.000Z',
  autor: { codigo: 'u1', nome: 'Ana' },
  projetos: [{ codigo: 'p1', nome: 'Site' }],
  podeAlterar: true,
}

test('adaptConhecimento traz autor, projetos, data curta e podeAlterar', () => {
  const k = adaptConhecimento(api)
  assert.equal(k.id, 'k1')
  assert.equal(k.data, '2026-10-20')
  assert.equal(k.autor, 'Ana')
  assert.equal(k.fonte, '')
  assert.deepEqual(k.projetos, [{ id: 'p1', nome: 'Site' }])
  assert.equal(k.podeAlterar, true)
  assert.equal(adaptConhecimento({ codigo: 'x', titulo: 'T' }).autor, '—')
})

test('consulta manda só os filtros preenchidos, com os nomes da API', () => {
  assert.equal(consulta({}), '')
  assert.equal(
    consulta({ busca: '  ifood ', categoria: 'case', tag: '', autor: 'u1', projeto: 'p1', de: '2026-01-01' }),
    '?busca=ifood&categoria=case&codigoAutor=u1&codigoProjeto=p1&de=2026-01-01',
  )
})

test('inicioDoPeriodo calcula a data inicial do filtro', () => {
  const hoje = new Date(2026, 10, 3)
  assert.equal(inicioDoPeriodo('30d', hoje), '2026-10-04')
  assert.equal(inicioDoPeriodo('6m', hoje), '2026-05-03')
  assert.equal(inicioDoPeriodo('12m', hoje), '2025-11-03')
  assert.equal(inicioDoPeriodo('ano', hoje), '2026-01-01')
  assert.equal(inicioDoPeriodo('', hoje), '')
})

test('formulário: tags sem repetição e links um por linha com https', () => {
  assert.deepEqual(lerTags('Mercado, #delivery, mercado,, '), ['mercado', 'delivery'])
  assert.deepEqual(lerLinks('drive.google.com/x\n\nhttps://a.com'), ['https://drive.google.com/x', 'https://a.com'])
  const corpo = corpoConhecimento({ titulo: ' T ', categoria: 'case', resumo: ' R ', tags: 'a', links: '', fonte: ' ', projetos: ['p1'] })
  assert.deepEqual(corpo, {
    titulo: 'T',
    categoria: 'case',
    resumo: 'R',
    conteudo: '',
    fonte: null,
    links: [],
    tags: ['a'],
    data: null,
    codigosProjetos: ['p1'],
  })
  const v = valoresConhecimento(adaptConhecimento(api))
  assert.equal(v.links, 'https://a.com')
  assert.deepEqual(v.projetos, ['p1'])
  assert.deepEqual(valoresConhecimento(null, { projetos: ['p9'] }).projetos, ['p9'])
  assert.equal(rotuloCategoria([{ valor: 'case', rotulo: 'Case' }], 'case'), 'Case')
  assert.equal(rotuloCategoria([], 'novo'), 'novo')
})

test('markdown: títulos, listas, citação e parágrafos', () => {
  const b = blocos('# Título\n\nlinha 1\nlinha 2\n- a\n- b\n1. um\n2. dois\n> citação')
  assert.deepEqual(
    b.map(x => x.t),
    ['h', 'p', 'ul', 'ol', 'q'],
  )
  assert.equal(b[1].texto, 'linha 1\nlinha 2')
  assert.deepEqual(b[2].itens, ['a', 'b'])
  assert.deepEqual(blocos(''), [])
})

test('markdown: negrito, itálico, código e só links http(s)', () => {
  assert.deepEqual(trechos('a **b** *c* `d` [e](https://x.com)'), [
    { t: 'txt', texto: 'a ' },
    { t: 'b', texto: 'b' },
    { t: 'txt', texto: ' ' },
    { t: 'i', texto: 'c' },
    { t: 'txt', texto: ' ' },
    { t: 'code', texto: 'd' },
    { t: 'txt', texto: ' ' },
    { t: 'a', texto: 'e', url: 'https://x.com' },
  ])
  assert.deepEqual(
    trechos('[x](javascript:alert(1))').map(x => x.t),
    ['txt', 'txt'],
  )
  assert.deepEqual(trechos('2 * 3 * 4'), [{ t: 'txt', texto: '2 * 3 * 4' }])
})

test('adaptConhecimento traz as iniciativas que usam o item (12b)', () => {
  assert.deepEqual(adaptConhecimento({ ...api, iniciativas: [{ codigo: 'i1', nome: 'Chatbot' }] }).iniciativas, [
    { id: 'i1', nome: 'Chatbot' },
  ])
  assert.deepEqual(adaptConhecimento(api).iniciativas, [])
})
