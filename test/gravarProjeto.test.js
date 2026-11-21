import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import * as modulo from '../src/lib/gravarProjeto.js'
import { sessao } from '../src/services/api.js'

const { gravarProjeto } = modulo
const original = globalThis.fetch
let chamadas

// `falhas`: { 'PUT /projetos/p1': [status, corpo] }; o resto dá 200 com {}.
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

const projeto = (extra = {}) => ({ codigo: 'p1', sigiloso: true, ...extra })
const form = (extra = {}) => ({ nome: 'X', visibilidade: 'sigiloso', ...extra })

beforeEach(() => sessao.salvar({ token: 'tk', refreshToken: 'rt' }))
afterEach(() => {
  globalThis.fetch = original
})

test('edição: só o PUT, com a Visibilidade e sem lista de acesso', async () => {
  simular()
  await gravarProjeto(form({ acesso: ['a', 'b'] }), projeto())
  assert.deepEqual(rotas(), ['PUT /projetos/p1'])
  assert.deepEqual(chamadas[0].body, { nome: 'X', sigiloso: true })
})

test('Sigiloso para Normal: só o PUT, com sigiloso falso', async () => {
  simular()
  await gravarProjeto(form({ visibilidade: 'normal' }), projeto())
  assert.deepEqual(rotas(), ['PUT /projetos/p1'])
  assert.equal(chamadas[0].body.sigiloso, false)
})

test('criação: só o POST, sem lista de acesso', async () => {
  simular()
  await gravarProjeto(form({ acesso: ['a'] }), null)
  assert.deepEqual(rotas(), ['POST /projetos'])
  assert.deepEqual(chamadas[0].body, { nome: 'X', sigiloso: true })
})

test('nunca chama /acesso', async () => {
  simular()
  await gravarProjeto(form({ acesso: ['a', 'b'] }), projeto({ sigiloso: false }))
  assert.equal(
    rotas().some(r => r.endsWith('/acesso')),
    false,
  )
})

test('400 de quem ficaria fora do sigiloso sobe como veio', async () => {
  simular({ 'PUT /projetos/p1': [400, { message: 'Ficaria sem acesso', codigo: 'SIGILOSO_SEM_VOCE' }] })
  await assert.rejects(gravarProjeto(form(), projeto({ sigiloso: false })), e => e.message === 'Ficaria sem acesso')
})

test('a lista de acesso saiu do módulo', () => {
  assert.equal('ErroAcessoParcial' in modulo, false)
  assert.equal('acessoComLogin' in modulo, false)
})
