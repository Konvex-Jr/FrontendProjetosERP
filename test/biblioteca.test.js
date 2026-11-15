import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SIGILOS,
  biblioteca,
  consulta,
  corpoCriacao,
  corpoEdicao,
  sigilosPermitidos,
} from '../src/services/biblioteca.js'
import { itemBibliotecaDaApi } from '../src/lib/apiMappers.js'

const api = {
  codigo: 'b1',
  titulo: 'Ata',
  conteudo: '## A',
  links: ['https://a.com'],
  tags: ['mercado'],
  projeto: { codigo: 'p1', nome: 'Site' },
  sigilo: 'projeto',
  autor: { codigo: 'u1', nome: 'Ana' },
  criadoEm: '2026-11-01T10:00:00.000Z',
  atualizadoEm: '2026-11-02T10:00:00.000Z',
  podeAlterar: true,
  anexos: [{ codigo: 'a1' }],
}

function comFetch(resposta, fn) {
  const original = globalThis.fetch
  const chamadas = []
  globalThis.fetch = async (url, options) => {
    chamadas.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : undefined })
    return { ok: true, status: 200, text: async () => JSON.stringify(resposta) }
  }
  return fn(chamadas).finally(() => {
    globalThis.fetch = original
  })
}

test('consulta monta a query só com filtros preenchidos', () => {
  assert.equal(consulta(), '')
  assert.equal(consulta({ q: '  ', tag: '', projeto: undefined }), '')
  assert.equal(consulta({ q: ' ata ', tag: 'x', projeto: 'p1', sigilo: 'gestao', autor: 'u1' }), '?q=ata&tag=x&projeto=p1&sigilo=gestao&autor=u1')
  assert.equal(consulta({ sigilo: 'todos' }), '?sigilo=todos')
})

test('itemBibliotecaDaApi mapeia e tolera projeto/autor nulos', () => {
  const i = itemBibliotecaDaApi(api)
  assert.equal(i.codigo, 'b1')
  assert.deepEqual(i.projeto, { codigo: 'p1', nome: 'Site' })
  assert.equal(i.autor.nome, 'Ana')
  assert.equal(i.podeAlterar, true)
  assert.equal(i.anexos.length, 1)
  const vazio = itemBibliotecaDaApi({ codigo: 'x', titulo: 'T', projeto: null, autor: null })
  assert.equal(vazio.projeto, null)
  assert.equal(vazio.autor, null)
  assert.deepEqual(vazio.links, [])
  assert.deepEqual(vazio.tags, [])
  assert.deepEqual(vazio.anexos, [])
  assert.equal(vazio.conteudo, '')
  assert.equal(vazio.sigilo, 'todos')
  assert.equal(vazio.podeAlterar, false)
})

test('criar envia codigoProjeto null quando sem projeto', () => {
  assert.deepEqual(corpoCriacao({ titulo: ' T ' }), { titulo: 'T', conteudo: '', links: [], tags: [], sigilo: 'todos', codigoProjeto: null })
  assert.equal(corpoCriacao({ titulo: 'T', codigoProjeto: '' }).codigoProjeto, null)
  assert.equal(corpoCriacao({ titulo: 'T', codigoProjeto: 'p1', sigilo: 'projeto' }).codigoProjeto, 'p1')
})

test('editar: projeto inalterado omite a chave, removido manda null, trocado manda o novo', () => {
  const original = itemBibliotecaDaApi(api)
  const base = { titulo: 'Ata 2', sigilo: 'projeto' }
  assert.equal('codigoProjeto' in corpoEdicao({ ...base, codigoProjeto: 'p1' }, original), false)
  assert.equal('codigoProjeto' in corpoEdicao(base, original), false)
  assert.equal(corpoEdicao({ ...base, codigoProjeto: null }, original).codigoProjeto, null)
  assert.equal(corpoEdicao({ ...base, codigoProjeto: '' }, original).codigoProjeto, null)
  assert.equal(corpoEdicao({ ...base, codigoProjeto: 'p2' }, original).codigoProjeto, 'p2')
  // projeto oculto (null) e inalterado: não manda nada
  const oculto = itemBibliotecaDaApi({ ...api, projeto: null })
  assert.equal('codigoProjeto' in corpoEdicao({ ...base, codigoProjeto: null }, oculto), false)
  assert.equal(corpoEdicao({ ...base, codigoProjeto: 'p2' }, oculto).codigoProjeto, 'p2')
})

test('sigilosPermitidos: membro não vê gestao', () => {
  assert.deepEqual(SIGILOS.map(s => s.valor), ['todos', 'gestao', 'projeto'])
  assert.equal(SIGILOS[1].rotulo, 'Só gestão')
  assert.equal(sigilosPermitidos(false).some(s => s.valor === 'gestao'), false)
  assert.deepEqual(sigilosPermitidos(false).map(s => s.valor), ['todos', 'projeto'])
  assert.equal(sigilosPermitidos(true).length, 3)
})

test('biblioteca chama as rotas e devolve itens mapeados', async () => {
  await comFetch([api], async chamadas => {
    const lista = await biblioteca.listar({ q: 'a' })
    assert.ok(chamadas[0].url.endsWith('/biblioteca?q=a'))
    assert.equal(lista[0].codigo, 'b1')
  })
  await comFetch(api, async chamadas => {
    assert.equal((await biblioteca.obter('b1')).titulo, 'Ata')
    assert.ok(chamadas[0].url.endsWith('/biblioteca/b1'))
    await biblioteca.criar({ titulo: 'T' })
    assert.equal(chamadas[1].method, 'POST')
    assert.equal(chamadas[1].body.codigoProjeto, null)
    await biblioteca.editar('b1', { titulo: 'N', codigoProjeto: 'p1' }, itemBibliotecaDaApi(api))
    assert.equal(chamadas[2].method, 'PUT')
    assert.ok(chamadas[2].url.endsWith('/biblioteca/b1'))
    assert.equal('codigoProjeto' in chamadas[2].body, false)
  })
  await comFetch(null, async chamadas => {
    await biblioteca.excluir('b1')
    assert.equal(chamadas[0].method, 'DELETE')
  })
})
