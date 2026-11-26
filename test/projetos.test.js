import assert from 'node:assert/strict'
import { test } from 'node:test'
import { corpoParticipacao, corpoProjeto, equipe, projetos, rotuloStatusProjeto } from '../src/services/projetos.js'
import { sessao } from '../src/services/api.js'

const capturar = async fn => {
  const original = globalThis.fetch
  const chamadas = []
  globalThis.fetch = async (url, init) => {
    chamadas.push({
      url: String(url).replace(/^https?:\/\/[^/]+/, ''),
      method: init.method,
      body: init.body ? JSON.parse(init.body) : undefined,
      token: init.headers['access-token'],
    })
    return { ok: true, status: 200, text: async () => '{}' }
  }
  try {
    await fn()
  } finally {
    globalThis.fetch = original
  }
  return chamadas
}

test('projetos e equipe chamam as rotas certas com a sessão', async () => {
  sessao.salvar({ token: 'tk', refreshToken: 'rt' })
  const chamadas = await capturar(async () => {
    await projetos.listar({ codigoUsuario: 'u1', busca: '' })
    await projetos.listar()
    await projetos.editar('p1', { nome: 'Site', codigoArea: '', progresso: '' })
    await projetos.alterarStatus('p1', 'atencao')
    await equipe.adicionar('p1', { codigoUsuario: 'u1', funcao: '', dataEntrada: '' })
    await equipe.editar('p1', 'pa1', { funcao: 'Dev', responsabilidades: '' })
    await equipe.encerrar('p1', 'pa1', '')
  })
  sessao.limpar()

  assert.deepEqual(
    chamadas.map(c => [c.method, c.url]),
    [
      ['GET', '/projetos?codigoUsuario=u1'],
      ['GET', '/projetos'],
      ['PUT', '/projetos/p1'],
      ['PATCH', '/projetos/p1/status'],
      ['POST', '/projetos/p1/membros'],
      ['PUT', '/projetos/p1/membros/pa1'],
      ['POST', '/projetos/p1/membros/pa1/encerrar'],
    ],
  )
  assert.ok(chamadas.every(c => c.token === 'tk'))
  // Projeto não manda mais codigosMembros; equipe vai pela aba Equipe.
  assert.deepEqual(chamadas[2].body, { nome: 'Site', codigoArea: null })
  assert.deepEqual(chamadas[3].body, { status: 'atencao' })
  assert.deepEqual(chamadas[4].body, { codigoUsuario: 'u1', funcao: null, dataEntrada: null })
  assert.deepEqual(chamadas[5].body, { funcao: 'Dev', responsabilidades: null })
  assert.deepEqual(chamadas[6].body, {})
})

test('corpos e rótulos', () => {
  assert.deepEqual(corpoProjeto({ progresso: '25', objetivo: '' }), { progresso: 25, objetivo: null })
  assert.deepEqual(corpoParticipacao({ funcao: '' }), { funcao: null })
  assert.equal(rotuloStatusProjeto('em_execucao'), 'Em andamento')
  assert.equal(rotuloStatusProjeto(undefined), '—')
})

test('corpoProjeto não manda lista de acesso', () => {
  assert.deepEqual(corpoProjeto({ nome: 'A', acesso: ['u1'] }), { nome: 'A' })
  assert.equal('acesso' in corpoProjeto({ nome: 'A', acesso: null }), false)
})

test('projetos.definirAcesso saiu', () => {
  assert.equal('definirAcesso' in projetos, false)
})

test('corpoProjeto (31a): sem sigilo; Visibilidade antiga e sigiloso não vão no corpo', () => {
  assert.deepEqual(corpoProjeto({ nome: 'A', visibilidade: 'sigiloso', sigiloso: true, acesso: ['u1'] }), { nome: 'A' })
  assert.deepEqual(corpoProjeto({ nome: 'A' }), { nome: 'A' })
})

test('gravarColunas manda PUT com o corpo das colunas', async () => {
  const corpo = { colunas: [{ codigo: 'c1', nome: 'A', cor: 'cinza', papel: 'entrada' }], destinos: {} }
  const chamadas = await capturar(() => projetos.gravarColunas('p1', corpo))
  assert.equal(chamadas[0].url, '/projetos/p1/colunas')
  assert.equal(chamadas[0].method, 'PUT')
  assert.deepEqual(chamadas[0].body, corpo)
})
