import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { carregarProjeto } from '../src/lib/carregarProjeto.js'
import { memoria } from '../src/lib/memoria.js'
import { sessao } from '../src/services/api.js'

const original = globalThis.fetch
let chamadas

// `respostas`: { '/projetos/p1': [status, corpo] }; o que não está na lista dá 200 com [].
const simular = respostas => {
  chamadas = []
  globalThis.fetch = async url => {
    const caminho = String(url).replace(/^https?:\/\/[^/]+/, '')
    chamadas.push(caminho)
    const [status, corpo] = respostas[caminho.split('?')[0]] || [200, []]
    return { ok: status < 400, status, text: async () => JSON.stringify(corpo) }
  }
}

beforeEach(() => {
  sessao.salvar({ token: 'tk', refreshToken: 'rt' })
  memoria.limpar()
  memoria.definirPessoa('ana')
})
afterEach(() => {
  globalThis.fetch = original
  memoria.limpar()
})

test('projeto completo traz as tarefas adaptadas', async () => {
  simular({
    '/projetos/p1': [200, { codigo: 'p1', nome: 'A', participacoes: [] }],
    '/tarefas': [200, [{ codigo: 't1', titulo: 'x' }]],
  })
  const d = await carregarProjeto('p1', false)
  assert.equal(d.projeto.codigo, 'p1')
  assert.deepEqual(
    d.tarefas.map(t => t.id),
    ['t1'],
  )
})

test('resumo de sigiloso não usa as tarefas, mesmo se a busca delas for recusada', async () => {
  simular({
    '/projetos/p1': [200, { codigo: 'p1', nome: 'S', sigiloso: true, resumo: true, participacoes: [] }],
    '/tarefas': [403, { mensagem: 'sem acesso' }],
  })
  const d = await carregarProjeto('p1', false)
  assert.equal(d.projeto.resumo, true)
  assert.deepEqual(d.tarefas, [])
})

test('404 do projeto na atualização apaga projeto e tarefas da memória da aba', async () => {
  simular({
    '/projetos/p1': [200, { codigo: 'p1', nome: 'A', participacoes: [] }],
    '/tarefas': [200, [{ codigo: 't1', titulo: 'x' }]],
  })
  await memoria.buscar('projeto:p1:false', () => carregarProjeto('p1', false))
  assert.equal(memoria.obter('projeto:p1:false').tarefas.length, 1)

  simular({ '/projetos/p1': [404, { mensagem: 'Projeto não encontrado' }], '/tarefas': [404, { mensagem: 'x' }] })
  await assert.rejects(
    memoria.buscar('projeto:p1:false', () => carregarProjeto('p1', false)),
    e => e.status === 404,
  )
  assert.equal(memoria.obter('projeto:p1:false'), undefined)
})
