import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { sessao } from '../src/services/api.js'
import { carregarInicio } from '../src/services/inicio.js'

const originalFetch = globalThis.fetch

// Respostas de cada rota, pelo caminho (sem o endereço da API).
const RESPOSTAS = {
  '/auth/me': { codigo: 'u1', nome: 'Ana' },
  '/usuarios': [{ codigo: 'u1', nome: 'Ana', perfil: 'ADMIN' }],
  '/projetos': [{ codigo: 'p1', nome: 'ERP', membros: [{ codigo: 'u1' }] }],
  '/tarefas': [{ codigo: 't1', titulo: 'Login', projeto: { codigo: 'p1', nome: 'ERP' }, responsaveis: ['u1'] }],
  '/capacitacoes': [{ codigo: 'k1', titulo: 'Git', data: '2026-11-20T00:00:00Z' }],
  '/senioridades': [{ codigo: 's1', nome: 'Júnior' }],
  '/auth/permissoes': { permissoes: ['projetos.editar'], menu: [{ chave: 'inicio', rotulo: 'Início', caminho: '/' }] },
}

const resposta = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) })
const caminho = url => new URL(url).pathname

beforeEach(() => {
  // Token sem formato JWT: não conta como vencido, então nada de renovação antecipada.
  sessao.salvar({ token: 'tok', refreshToken: '' })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  sessao.limpar()
})

test('as 7 chamadas saem antes de qualquer resposta', async () => {
  const chamadas = []
  const liberar = []
  // Só responde depois de receber as 7: se alguma esperasse outra terminar, o teste travaria.
  globalThis.fetch = url =>
    new Promise(resolve => {
      chamadas.push(caminho(url))
      liberar.push(() => resolve(resposta(200, RESPOSTAS[caminho(url)])))
      if (chamadas.length === 7) liberar.forEach(fn => fn())
    })

  await carregarInicio()

  assert.deepEqual([...chamadas].sort(), Object.keys(RESPOSTAS).sort())
})

test('devolve eu, dados adaptados e acesso', async () => {
  globalThis.fetch = async url => resposta(200, RESPOSTAS[caminho(url)])

  const { eu, dados, acesso } = await carregarInicio()

  assert.equal(eu.codigo, 'u1')
  assert.equal(dados.u[0].id, 'u1')
  assert.deepEqual(dados.p[0].membros, ['u1'])
  assert.equal(dados.t[0].projetoId, 'p1')
  assert.equal(dados.k[0].id, 'k1')
  assert.equal(dados.k[0].data, '2026-11-20')
  assert.deepEqual(dados.senioridades, RESPOSTAS['/senioridades'])
  assert.deepEqual(acesso, RESPOSTAS['/auth/permissoes'])
})

test('401 em /auth/me rejeita com status 401', async () => {
  globalThis.fetch = async url =>
    caminho(url) === '/auth/me' ? resposta(401, { message: 'Sessão inválida' }) : resposta(200, RESPOSTAS[caminho(url)])

  await assert.rejects(carregarInicio(), error => error.status === 401)
})

test('sessão recusada avisa onExpirada uma vez só, mesmo com as 7 chamadas juntas', async () => {
  let avisos = 0
  sessao.onExpirada = () => {
    avisos += 1
  }
  globalThis.fetch = async () => resposta(401, { message: 'Sessão inválida' })

  try {
    await assert.rejects(carregarInicio(), error => error.status === 401)
    assert.equal(avisos, 1)
  } finally {
    sessao.onExpirada = null
  }
})
