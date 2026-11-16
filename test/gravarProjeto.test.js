import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { ErroAcessoParcial, gravarProjeto } from '../src/lib/gravarProjeto.js'
import { sessao } from '../src/services/api.js'

const original = globalThis.fetch
let chamadas

// `falhas`: { 'PUT /projetos/p1/acesso': [status, corpo] }; o resto dá 200 com {}.
const simular = (falhas = {}) => {
  chamadas = []
  globalThis.fetch = async (url, init) => {
    const caminho = String(url).replace(/^https?:\/\/[^/]+/, '')
    chamadas.push({ rota: `${init.method} ${caminho}`, body: init.body ? JSON.parse(init.body) : undefined })
    const [status, corpo] = falhas[`${init.method} ${caminho}`] || [200, {}]
    return { ok: status < 400, status, text: async () => JSON.stringify(corpo) }
  }
}
const rotas = () => chamadas.map(c => c.rota)

const projeto = (extra = {}) => ({ codigo: 'p1', sigiloso: true, acesso: ['a'], podeGerirAcesso: true, ...extra })
const form = (extra = {}) => ({ nome: 'X', visibilidade: 'sigiloso', acesso: ['a'], ...extra })

beforeEach(() => sessao.salvar({ token: 'tk', refreshToken: 'rt' }))
afterEach(() => {
  globalThis.fetch = original
})

test('sem podeGerirAcesso: só o PUT, sem sigiloso nem acesso no corpo', async () => {
  simular()
  await gravarProjeto(projeto({ podeGerirAcesso: false }), form({ acesso: ['a', 'b'] }))
  assert.deepEqual(rotas(), ['PUT /projetos/p1'])
  assert.deepEqual(chamadas[0].body, { nome: 'X' })
})

test('lista igual (outra ordem): não chama definirAcesso', async () => {
  simular()
  await gravarProjeto(projeto({ acesso: ['a', 'b'] }), form({ acesso: ['b', 'a'] }))
  assert.deepEqual(rotas(), ['PUT /projetos/p1'])
})

test('Sigiloso para Normal: não chama definirAcesso', async () => {
  simular()
  await gravarProjeto(projeto(), form({ visibilidade: 'normal', acesso: ['a', 'b'] }))
  assert.deepEqual(rotas(), ['PUT /projetos/p1'])
  assert.equal(chamadas[0].body.sigiloso, false)
})

test('lista mudada: PUT e depois definirAcesso com a lista nova', async () => {
  simular()
  await gravarProjeto(projeto(), form({ acesso: ['a', 'b'] }))
  assert.deepEqual(rotas(), ['PUT /projetos/p1', 'PUT /projetos/p1/acesso'])
  assert.deepEqual(chamadas[0].body, { nome: 'X', sigiloso: true })
  assert.deepEqual(chamadas[1].body, { codigos: ['a', 'b'] })
})

test('criação manda sigiloso e acesso no POST', async () => {
  simular()
  await gravarProjeto(null, form({ acesso: ['a'] }))
  assert.deepEqual(rotas(), ['POST /projetos'])
  assert.deepEqual(chamadas[0].body, { nome: 'X', sigiloso: true, acesso: ['a'] })
})

test('definirAcesso falha depois do PUT: ErroAcessoParcial com a mensagem da API', async () => {
  simular({ 'PUT /projetos/p1/acesso': [400, { message: 'Pessoa sem login' }] })
  await assert.rejects(
    gravarProjeto(projeto({ sigiloso: false, acesso: [] }), form({ acesso: ['x'] })),
    e => e instanceof ErroAcessoParcial && e.message === 'Pessoa sem login',
  )
  assert.deepEqual(rotas(), ['PUT /projetos/p1', 'PUT /projetos/p1/acesso'])
})

test('falha do PUT sobe como erro comum', async () => {
  simular({ 'PUT /projetos/p1': [403, { message: 'Sem permissão' }] })
  await assert.rejects(gravarProjeto(projeto(), form()), e => !(e instanceof ErroAcessoParcial) && e.message === 'Sem permissão')
})
