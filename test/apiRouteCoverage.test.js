import assert from 'node:assert/strict'
import { test } from 'node:test'
import { request } from '../src/services/api.js'

const routeContracts = [
  ['POST', '/auth/login'],
  ['POST', '/auth/refresh'],
  ['POST', '/auth/logout'],
  ['POST', '/auth/retomar'],
  ['GET', '/auth/me'],
  ['GET', '/auth/permissoes'],
  ['GET', '/usuarios'],
  ['GET', '/senioridades'],
  ['POST', '/usuarios'],
  ['PUT', '/usuarios/user-1'],
  ['DELETE', '/usuarios/user-1'],
  ['GET', '/projetos'],
  ['POST', '/projetos'],
  ['PUT', '/projetos/project-1'],
  ['PATCH', '/projetos/project-1/status'],
  ['DELETE', '/projetos/project-1'],
  ['GET', '/tarefas'],
  ['POST', '/tarefas'],
  ['PUT', '/tarefas/task-1'],
  ['PATCH', '/tarefas/task-1/status'],
  ['PATCH', '/tarefas/task-1/coluna'],
  ['DELETE', '/tarefas/task-1'],
  ['GET', '/capacitacoes/opcoes'],
  ['GET', '/capacitacoes'],
  ['POST', '/capacitacoes'],
  ['GET', '/capacitacoes/c-1'],
  ['PUT', '/capacitacoes/c-1'],
  ['DELETE', '/capacitacoes/c-1'],
  ['POST', '/capacitacoes/c-1/inscricoes'],
  ['DELETE', '/capacitacoes/c-1/inscricoes/user-1'],
  ['PUT', '/capacitacoes/c-1/presencas'],
  ['PUT', '/capacitacoes/c-1/avaliacao'],
  ['GET', '/capacitacoes/c-1/avaliacoes'],
  ['POST', '/capacitacoes/c-1/anexos'],
  ['GET', '/usuarios/user-1/perfil'],
  ['GET', '/usuarios/user-1/periodos'],
  ['POST', '/usuarios/user-1/periodos'],
  ['PUT', '/usuarios/user-1/periodos/p-1'],
  ['DELETE', '/usuarios/user-1/periodos/p-1'],
  ['PATCH', '/usuarios/user-1/status'],
  ['POST', '/usuarios/user-1/link-senha'],
  ['PUT', '/auth/perfil'],
  ['PUT', '/auth/senha'],
  ['GET', '/areas'],
  ['POST', '/areas'],
  ['PUT', '/areas/area-1'],
  ['GET', '/cargos'],
  ['POST', '/cargos'],
  ['PUT', '/cargos/cargo-1'],
  ['POST', '/senioridades'],
  ['PUT', '/senioridades/sen-1'],
  ['GET', '/projetos/project-1'],
  ['POST', '/projetos/project-1/membros'],
  ['PUT', '/projetos/project-1/membros/part-1'],
  ['POST', '/projetos/project-1/membros/part-1/encerrar'],
  ['PUT', '/projetos/project-1/lider'],
  ['PUT', '/projetos/project-1/colunas'],
  ['GET', '/tarefas/task-1/comentarios'],
  ['POST', '/tarefas/task-1/comentarios'],
  ['DELETE', '/tarefas/task-1/comentarios/com-1'],
  ['GET', '/biblioteca'],
  ['POST', '/biblioteca'],
  ['GET', '/biblioteca/b-1'],
  ['PUT', '/biblioteca/b-1'],
  ['DELETE', '/biblioteca/b-1'],
  ['POST', '/biblioteca/b-1/anexos'],
  ['GET', '/tarefas/task-1/anexos'],
  ['POST', '/tarefas/task-1/anexos'],
  ['GET', '/anexos/regras'],
  ['GET', '/anexos/a-1'],
  ['DELETE', '/anexos/a-1'],
]

test(`cliente HTTP cobre todos os ${routeContracts.length} contratos de rota do backend`, async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options.method })
    return { ok: true, status: 200, text: async () => 'null' }
  }

  try {
    for (const [method, path] of routeContracts) {
      await request(path, { method, token: 'test-token', ...(method === 'GET' ? {} : { body: {} }) })
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, routeContracts.length)
  for (let index = 0; index < routeContracts.length; index += 1) {
    const [method, path] = routeContracts[index]
    assert.ok(calls[index].url.endsWith(path), `Rota não chamada corretamente: ${method} ${path}`)
    assert.equal(calls[index].method, method)
  }
})
