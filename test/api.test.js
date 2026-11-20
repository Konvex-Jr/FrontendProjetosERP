import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { ApiError, SEM_CONEXAO, apiUrl, mensagemDeErro, request } from '../src/services/api.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function response(status, body = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }
}

test('request sends authentication and JSON headers only when needed', async () => {
  let captured
  globalThis.fetch = async (url, options) => {
    captured = { url, options }
    return response(200, '[]')
  }

  const result = await request('/projetos', { token: 'jwt-test' })

  assert.deepEqual(result, [])
  assert.equal(captured.url, `${apiUrl}/projetos`)
  assert.equal(captured.options.method, 'GET')
  assert.equal(captured.options.headers.Accept, 'application/json')
  assert.equal(captured.options.headers['access-token'], 'jwt-test')
  assert.equal(captured.options.headers['Content-Type'], undefined)
  assert.equal(captured.options.body, undefined)
})

test('request serializes write bodies and returns parsed JSON', async () => {
  let captured
  globalThis.fetch = async (_url, options) => {
    captured = options
    return response(201, '{"codigo":"task-1"}')
  }

  const body = { titulo: 'Integrar API', codigosResponsaveis: ['user-1'] }
  const result = await request('/tarefas', { method: 'POST', token: 'jwt-test', body })

  assert.deepEqual(result, { codigo: 'task-1' })
  assert.equal(captured.headers['Content-Type'], 'application/json')
  assert.equal(captured.body, JSON.stringify(body))
})

test('request raises ApiError with the API message and HTTP status', async () => {
  globalThis.fetch = async () => response(422, '{"message":"Tarefa inválida"}')

  await assert.rejects(
    request('/tarefas', { token: 'jwt-test' }),
    error => error instanceof ApiError && error.status === 422 && error.message === 'Tarefa inválida',
  )
})

test('request keeps the API code and turns server errors into a clear sentence', async () => {
  globalThis.fetch = async () => response(400, '{"message":"Prioridade inválida.","codigo":"PRIORIDADE_TAREFA_INVALIDA"}')
  await assert.rejects(request('/tarefas', { token: 'jwt-test' }), error => error.codigo === 'PRIORIDADE_TAREFA_INVALIDA')

  globalThis.fetch = async () => response(500, '{"message":"Erro interno ao acessar o banco de dados."}')
  await assert.rejects(
    request('/projetos', { token: 'jwt-test' }),
    error => error instanceof ApiError && error.status === 500 && error.message.startsWith('O servidor teve um problema'),
  )
})

test('mensagemDeErro explains answers without a message', () => {
  assert.equal(mensagemDeErro(403, null), 'Você não tem permissão para esta ação.')
  assert.match(mensagemDeErro(404, {}), /recarregue/)
  assert.match(mensagemDeErro(429, null), /Muitas tentativas/)
  assert.equal(mensagemDeErro(400, { message: 'Título obrigatório.' }), 'Título obrigatório.')
})

test('request reports network failures in plain words', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('network down')
  }
  const aviso = console.warn
  console.warn = () => {}
  try {
    await assert.rejects(request('/auth/login'), error => error instanceof ApiError && error.status === 0 && error.message === SEM_CONEXAO)
  } finally {
    console.warn = aviso
  }
})

test('request returns null for successful empty responses', async () => {
  globalThis.fetch = async () => response(204)
  assert.equal(await request('/usuarios/123', { method: 'DELETE', token: 'jwt-test' }), null)
})

test('request sends binary files without JSON serialization', async () => {
  const originalFetch = globalThis.fetch
  const file = new Blob(['conteudo do arquivo'], { type: 'application/pdf' })
  let captured
  globalThis.fetch = async (_url, options) => {
    captured = options
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const { request } = await import('../src/services/api.js')
    const result = await request('/biblioteca/b1/anexos', {
      method: 'POST',
      token: 'token',
      body: file,
      headers: { 'X-File-Name': 'arquivo.pdf' },
    })
    assert.deepEqual(result, { ok: true })
    assert.equal(captured.body, file)
    assert.equal(captured.headers['Content-Type'], 'application/pdf')
    assert.equal(captured.headers['access-token'], 'token')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('request com auth renova o token após 401 e repete a chamada', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'vencido', refreshToken: 'refresh-1' })
  const chamadas = []
  globalThis.fetch = async (url, options) => {
    chamadas.push({ url: String(url), token: options.headers['access-token'], body: options.body })
    if (String(url).endsWith('/auth/refresh')) return response(200, '{"token":"novo","refreshToken":"refresh-2"}')
    return options.headers['access-token'] === 'novo' ? response(200, '[1]') : response(401, '{"message":"Token inválido ou expirado."}')
  }
  try {
    assert.deepEqual(await request('/projetos', { auth: true }), [1])
    assert.deepEqual(
      chamadas.map(c => [c.url.replace(apiUrl, ''), c.token]),
      [
        ['/projetos', 'vencido'],
        ['/auth/refresh', undefined],
        ['/projetos', 'novo'],
      ],
    )
    assert.equal(chamadas[1].body, JSON.stringify({ refreshToken: 'refresh-1' }))
    assert.equal(sessao.token, 'novo')
    assert.equal(sessao.refreshToken, 'refresh-2')
  } finally {
    sessao.limpar()
  }
})

test('chamadas simultâneas compartilham uma única renovação', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'vencido', refreshToken: 'refresh-1' })
  let renovacoes = 0
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/auth/refresh')) {
      renovacoes += 1
      return response(200, '{"token":"novo","refreshToken":"refresh-2"}')
    }
    return options.headers['access-token'] === 'novo' ? response(200, '{}') : response(401)
  }
  try {
    await Promise.all([request('/projetos', { auth: true }), request('/tarefas', { auth: true }), request('/usuarios', { auth: true })])
    assert.equal(renovacoes, 1)
  } finally {
    sessao.limpar()
  }
})

test('se a renovação falha, limpa a sessão e avisa o app', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'vencido', refreshToken: 'revogado' })
  let avisado = false
  sessao.onExpirada = () => {
    avisado = true
  }
  globalThis.fetch = async () => response(401, '{"message":"Sessão inválida."}')
  try {
    await assert.rejects(request('/projetos', { auth: true }), error => error instanceof ApiError && error.status === 401)
    assert.equal(avisado, true)
    assert.equal(sessao.ativa, false)
  } finally {
    sessao.onExpirada = null
    sessao.limpar()
  }
})

// Monta um JWT só com o payload que importa (o cliente não confere assinatura).
function jwtCom(exp) {
  const parte = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${parte({ alg: 'HS256' })}.${parte({ exp })}.assinatura`
}

test('tokenVencido lê o exp do token', async () => {
  const { tokenVencido } = await import('../src/services/api.js')
  const agora = Date.now()
  const seg = s => Math.floor(agora / 1000) + s
  assert.equal(tokenVencido(jwtCom(seg(-60)), agora), true)
  assert.equal(tokenVencido(jwtCom(seg(600)), agora), false)
  assert.equal(tokenVencido(jwtCom(seg(3)), agora), true)
  assert.equal(tokenVencido('abc', agora), false)
  assert.equal(tokenVencido('', agora), false)
})

test('token vencido é renovado antes da chamada', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  const vencido = jwtCom(Math.floor(Date.now() / 1000) - 60)
  sessao.salvar({ token: vencido, refreshToken: 'refresh-1' })
  const chamadas = []
  globalThis.fetch = async (url, options) => {
    chamadas.push([String(url).replace(apiUrl, ''), options.headers['access-token']])
    if (String(url).endsWith('/auth/refresh')) return response(200, '{"token":"novo","refreshToken":"refresh-2"}')
    return response(200, '[1]')
  }
  try {
    assert.deepEqual(await request('/projetos', { auth: true }), [1])
    assert.deepEqual(chamadas, [
      ['/auth/refresh', undefined],
      ['/projetos', 'novo'],
    ])
  } finally {
    sessao.limpar()
  }
})

test('renovação antecipada recusada pela API encerra a sessão', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: jwtCom(Math.floor(Date.now() / 1000) - 60), refreshToken: 'revogado' })
  let avisado = false
  sessao.onExpirada = () => {
    avisado = true
  }
  globalThis.fetch = async () => response(401, '{"message":"Sessão inválida."}')
  try {
    await assert.rejects(request('/projetos', { auth: true }), error => error instanceof ApiError && error.status === 401)
    assert.equal(sessao.ativa, false)
    assert.equal(avisado, true)
  } finally {
    sessao.onExpirada = null
    sessao.limpar()
  }
})

test('renovação antecipada sem conexão mantém a sessão', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: jwtCom(Math.floor(Date.now() / 1000) - 60), refreshToken: 'refresh-1' })
  let avisado = false
  sessao.onExpirada = () => {
    avisado = true
  }
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
  const aviso = console.warn
  console.warn = () => {}
  try {
    await assert.rejects(request('/projetos', { auth: true }), error => error instanceof ApiError && error.message === SEM_CONEXAO)
    assert.equal(sessao.ativa, true)
    assert.equal(avisado, false)
  } finally {
    console.warn = aviso
    sessao.onExpirada = null
    sessao.limpar()
  }
})

test('GETs iguais em andamento fazem uma só chamada', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'tk', refreshToken: '' })
  let chamadas = 0
  globalThis.fetch = async () => {
    chamadas += 1
    await new Promise(resolve => setTimeout(resolve, 10))
    return response(200, '[1,2]')
  }
  try {
    const [a, b] = await Promise.all([request('/projetos', { auth: true }), request('/projetos', { auth: true })])
    assert.equal(chamadas, 1)
    assert.deepEqual(a, [1, 2])
    assert.equal(a, b)
  } finally {
    sessao.limpar()
  }
})

test('GETs iguais em andamento compartilham também o erro', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'tk', refreshToken: '' })
  let chamadas = 0
  globalThis.fetch = async () => {
    chamadas += 1
    return response(500, '{}')
  }
  try {
    const resultados = await Promise.allSettled([request('/projetos', { auth: true }), request('/projetos', { auth: true })])
    assert.equal(chamadas, 1)
    assert.deepEqual(
      resultados.map(r => r.status),
      ['rejected', 'rejected'],
    )
  } finally {
    sessao.limpar()
  }
})

test('depois da resposta, um GET igual chama de novo', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'tk', refreshToken: '' })
  let chamadas = 0
  globalThis.fetch = async () => {
    chamadas += 1
    return response(200, '[]')
  }
  try {
    await request('/projetos', { auth: true })
    await request('/projetos', { auth: true })
    assert.equal(chamadas, 2)
  } finally {
    sessao.limpar()
  }
})

test('POST nunca é juntado', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'tk', refreshToken: '' })
  let chamadas = 0
  globalThis.fetch = async () => {
    chamadas += 1
    await new Promise(resolve => setTimeout(resolve, 10))
    return response(201, '{}')
  }
  try {
    await Promise.all([
      request('/tarefas', { method: 'POST', auth: true, body: {} }),
      request('/tarefas', { method: 'POST', auth: true, body: {} }),
    ])
    assert.equal(chamadas, 2)
  } finally {
    sessao.limpar()
  }
})

test('GETs iguais com tokens diferentes não são juntados', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'pessoa-a', refreshToken: '' })
  const tokens = []
  globalThis.fetch = async (_url, options) => {
    tokens.push(options.headers['access-token'])
    await new Promise(resolve => setTimeout(resolve, 10))
    return response(200, '[]')
  }
  try {
    const a = request('/projetos', { auth: true })
    sessao.salvar({ token: 'pessoa-b', refreshToken: '' })
    const b = request('/projetos', { auth: true })
    await Promise.all([a, b])
    assert.deepEqual(tokens, ['pessoa-a', 'pessoa-b'])
  } finally {
    sessao.limpar()
  }
})

// Promessa que o teste resolve quando quiser: simula uma resposta da API que demora.
function adiada() {
  let resolver
  const promessa = new Promise(r => (resolver = r))
  return { promessa, resolver }
}
const ateAgora = () => new Promise(r => setTimeout(r, 0))

test('renovação que termina depois do logout não salva a sessão e revoga o refresh novo', async () => {
  const { renovarSessao, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'velho', refreshToken: 'refresh-a1' })
  const refresh = adiada()
  const chamadas = []
  globalThis.fetch = async (url, options) => {
    const caminho = String(url).replace(apiUrl, '')
    chamadas.push([caminho, options.body])
    if (caminho === '/auth/refresh') return refresh.promessa
    return response(204)
  }
  try {
    const renovacao = renovarSessao()
    await ateAgora()
    sessao.limpar()
    refresh.resolver(response(200, '{"token":"novo-a","refreshToken":"refresh-a2"}'))
    assert.equal(await renovacao, false)
    await ateAgora()
    assert.equal(sessao.ativa, false)
    assert.equal(sessao.token, '')
    assert.deepEqual(chamadas[1], ['/auth/logout', JSON.stringify({ refreshToken: 'refresh-a2' })])
  } finally {
    sessao.limpar()
  }
})

test('renovação de A que termina depois do login de B mantém a sessão de B', async () => {
  const { renovarSessao, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'velho-a', refreshToken: 'refresh-a1' })
  const refresh = adiada()
  globalThis.fetch = async url => (String(url).endsWith('/auth/refresh') ? refresh.promessa : response(204))
  try {
    const renovacao = renovarSessao()
    await ateAgora()
    sessao.limpar()
    sessao.salvar({ token: 'token-b', refreshToken: 'refresh-b' })
    refresh.resolver(response(200, '{"token":"novo-a","refreshToken":"refresh-a2"}'))
    assert.equal(await renovacao, false)
    assert.equal(sessao.token, 'token-b')
    assert.equal(sessao.refreshToken, 'refresh-b')
  } finally {
    sessao.limpar()
  }
})

test('401 de A cuja renovação termina depois do login de B não encerra a sessão de B', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'velho-a', refreshToken: 'refresh-a1' })
  let avisado = false
  sessao.onExpirada = () => {
    avisado = true
  }
  const refresh = adiada()
  globalThis.fetch = async url => {
    const caminho = String(url).replace(apiUrl, '')
    if (caminho === '/auth/refresh') return refresh.promessa
    if (caminho === '/auth/logout') return response(204)
    return response(401, '{"message":"Token inválido ou expirado."}')
  }
  try {
    const chamada = request('/projetos', { auth: true })
    await ateAgora()
    await ateAgora()
    sessao.limpar()
    sessao.salvar({ token: 'token-b', refreshToken: 'refresh-b' })
    refresh.resolver(response(200, '{"token":"novo-a","refreshToken":"refresh-a2"}'))
    await assert.rejects(chamada, error => error instanceof ApiError && error.status === 401)
    assert.equal(sessao.token, 'token-b')
    assert.equal(sessao.refreshToken, 'refresh-b')
    assert.equal(avisado, false)
  } finally {
    sessao.onExpirada = null
    sessao.limpar()
  }
})

test('baixar renova o token vencido antes de chamar', async () => {
  const { baixar, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: jwtCom(Math.floor(Date.now() / 1000) - 60), refreshToken: 'refresh-1' })
  const chamadas = []
  globalThis.fetch = async (url, options) => {
    chamadas.push([String(url).replace(apiUrl, ''), options.headers?.['access-token']])
    if (String(url).endsWith('/auth/refresh')) return response(200, '{"token":"novo","refreshToken":"refresh-2"}')
    return { ok: true, status: 200, blob: async () => 'arquivo' }
  }
  try {
    assert.equal(await baixar('/biblioteca/b1/anexos/a1'), 'arquivo')
    assert.deepEqual(chamadas, [
      ['/auth/refresh', undefined],
      ['/biblioteca/b1/anexos/a1', 'novo'],
    ])
  } finally {
    sessao.limpar()
  }
})

test('renovação antecipada e 401 de outra chamada ao mesmo tempo fazem uma só renovação', async () => {
  const { request, sessao } = await import('../src/services/api.js')
  const agoraReal = Date.now
  sessao.salvar({ token: jwtCom(Math.floor(agoraReal() / 1000) + 600), refreshToken: 'refresh-1' })
  const primeira = adiada()
  const refresh = adiada()
  let renovacoes = 0
  globalThis.fetch = async (url, options) => {
    const caminho = String(url).replace(apiUrl, '')
    if (caminho === '/auth/refresh') {
      renovacoes += 1
      return refresh.promessa
    }
    if (options.headers['access-token'] === 'novo') return response(200, '[1]')
    return primeira.promessa
  }
  try {
    // /projetos sai com o token ainda válido e fica esperando a resposta.
    const a = request('/projetos', { auth: true })
    await ateAgora()
    // O tempo passa: o token vence e /tarefas renova antes de chamar.
    Date.now = () => agoraReal() + 3_600_000
    const b = request('/tarefas', { auth: true })
    await ateAgora()
    // Agora /projetos recebe 401 com a renovação antecipada ainda em andamento.
    primeira.resolver(response(401, '{"message":"Token inválido ou expirado."}'))
    await ateAgora()
    refresh.resolver(response(200, '{"token":"novo","refreshToken":"refresh-2"}'))
    assert.deepEqual(await Promise.all([a, b]), [[1], [1]])
    assert.equal(renovacoes, 1)
  } finally {
    Date.now = agoraReal
    sessao.limpar()
  }
})

// Resposta com corpo em fluxo (ReadableStream), como o fetch do navegador.
function respostaEmPedacos(pedacos, cabecalhos = {}) {
  const corpo = new ReadableStream({
    start(controller) {
      for (const p of pedacos) controller.enqueue(new Uint8Array(p))
      controller.close()
    },
  })
  return { ok: true, status: 200, headers: new Headers(cabecalhos), body: corpo, blob: async () => assert.fail('lê em pedaços') }
}

test('baixar com aoProgresso lê em pedaços e avisa (recebidos, total) até (total, total)', async () => {
  const { baixar } = await import('../src/services/api.js')
  globalThis.fetch = async () => respostaEmPedacos([3, 4, 5], { 'content-length': '12', 'content-type': 'application/pdf' })
  const vistos = []
  const blob = await baixar('/anexos/a1', { aoProgresso: (recebidos, total) => vistos.push([recebidos, total]) })
  assert.equal(blob.size, 12)
  assert.equal(blob.type, 'application/pdf')
  assert.deepEqual(vistos, [
    [0, 12],
    [3, 12],
    [7, 12],
    [12, 12],
  ])
})

test('baixar com aoProgresso sem Content-Length avisa total null', async () => {
  const { baixar } = await import('../src/services/api.js')
  globalThis.fetch = async () => respostaEmPedacos([2, 2])
  const vistos = []
  await baixar('/anexos/a1', { aoProgresso: (recebidos, total) => vistos.push([recebidos, total]) })
  assert.deepEqual(vistos, [
    [0, null],
    [2, null],
    [4, null],
  ])
})

test('baixar que para no meio vira ApiError com mensagem para a pessoa', async () => {
  const { baixar } = await import('../src/services/api.js')
  const corpo = new ReadableStream({
    pull(controller) {
      controller.error(new TypeError('network error'))
    },
  })
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: new Headers({ 'content-length': '10' }), body: corpo })
  await assert.rejects(
    baixar('/anexos/a1', { aoProgresso: () => {} }),
    e => e instanceof ApiError && e.status === 0 && /parou no meio/.test(e.message),
  )
})

// "Manter conectado" (sessão 25a): o cookie de lembrete só vai nas rotas de sessão.
function comLocks(fn) {
  const nomes = []
  const antes = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { locks: { request: (nome, cb) => (nomes.push(nome), cb()) } },
  })
  const restaurar = () => (antes ? Object.defineProperty(globalThis, 'navigator', antes) : delete globalThis.navigator)
  return Promise.resolve(fn(nomes)).finally(restaurar)
}

test('/auth/login vai com credentials include e /tarefas não', async () => {
  const vistos = {}
  globalThis.fetch = async (url, options) => {
    vistos[url.replace(apiUrl, '')] = options.credentials
    return response(200, '{}')
  }
  await request('/auth/login', { method: 'POST', body: { email: 'a@b', senha: 'x', manterConectado: true } })
  await request('/auth/logout', { method: 'POST', body: {} })
  await request('/auth/link-senha/abc', { method: 'POST', body: { senha: 'x', confirmacao: 'x' } })
  await request('/auth/link-senha/consulta')
  await request('/tarefas', { token: 'jwt' })
  assert.equal(vistos['/auth/login'], 'include')
  assert.equal(vistos['/auth/logout'], 'include')
  assert.equal(vistos['/tarefas'], undefined)
  // Só o POST do link troca o cookie; a consulta (GET) não precisa dele.
  assert.equal(vistos['/auth/link-senha/consulta'], undefined)
  assert.equal(vistos['/auth/link-senha/abc'], 'include')
})

test('POST do link de senha vai com credentials include', async () => {
  let credenciais
  globalThis.fetch = async (_url, options) => {
    credenciais = options.credentials
    return response(200, '{}')
  }
  await request('/auth/link-senha/abc', { method: 'POST', body: { senha: 'x', confirmacao: 'x' } })
  assert.equal(credenciais, 'include')
})

test('retomarSessao salva a sessão quando a API responde 200, dentro da trava konvex-sessao', async () => {
  const { retomarSessao, sessao } = await import('../src/services/api.js')
  sessao.limpar()
  let chamada
  globalThis.fetch = async (url, options) => {
    chamada = { url, options }
    return response(200, '{"token":"tk-r","refreshToken":"rf-r","usuario":{"codigo":"u1","nome":"Ana"}}')
  }
  try {
    await comLocks(async nomes => {
      assert.equal(await retomarSessao(), true)
      assert.deepEqual(nomes, ['konvex-sessao'])
    })
    assert.equal(chamada.url, `${apiUrl}/auth/retomar`)
    assert.equal(chamada.options.method, 'POST')
    assert.equal(chamada.options.credentials, 'include')
    assert.equal(sessao.token, 'tk-r')
    assert.equal(sessao.refreshToken, 'rf-r')
  } finally {
    sessao.limpar()
  }
})

test('retomarSessao devolve false em 401 sem limpar a sessão que houver', async () => {
  const { retomarSessao, sessao } = await import('../src/services/api.js')
  sessao.limpar()
  globalThis.fetch = async () => {
    // Outra entrada desta aba salvou sessão enquanto o retomar ia à API.
    sessao.salvar({ token: 'outra', refreshToken: 'rf-outra' })
    return response(401, '{"message":"Sessão expirada."}')
  }
  try {
    assert.equal(await retomarSessao(), false)
    assert.equal(sessao.token, 'outra')
    assert.equal(sessao.refreshToken, 'rf-outra')
  } finally {
    sessao.limpar()
  }
})

test('retomarSessao sem conexão devolve false', async () => {
  const { retomarSessao, sessao } = await import('../src/services/api.js')
  sessao.limpar()
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch')
  }
  const aviso = console.warn
  console.warn = () => {}
  try {
    assert.equal(await retomarSessao(), false)
    assert.equal(sessao.ativa, false)
  } finally {
    console.warn = aviso
  }
})

test('comTravaDeSessao usa navigator.locks e, sem ele, mantém a ordem das chamadas', async () => {
  const { comTravaDeSessao } = await import('../src/services/api.js')
  await comLocks(async nomes => {
    assert.equal(await comTravaDeSessao(async () => 7), 7)
    assert.deepEqual(nomes, ['konvex-sessao'])
  })
  const ordem = []
  let soltar
  const primeira = comTravaDeSessao(() => new Promise(r => (soltar = r)).then(() => ordem.push('logout')))
  const segunda = comTravaDeSessao(async () => ordem.push('login'))
  await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(ordem, [])
  soltar()
  await Promise.all([primeira, segunda])
  assert.deepEqual(ordem, ['logout', 'login'])
})

test('logout de refresh token sem dono não leva o cookie de lembrete', async () => {
  const { request: req, sessao } = await import('../src/services/api.js')
  sessao.salvar({ token: 'vencido', refreshToken: 'refresh-1' })
  const logouts = []
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      // Outra pessoa entra nesta aba enquanto a renovação vai à API.
      sessao.salvar({ token: 'b', refreshToken: 'refresh-b' })
      return response(200, '{"token":"novo","refreshToken":"refresh-2"}')
    }
    if (url.endsWith('/auth/logout')) logouts.push(options.credentials)
    return response(401, '{"message":"Token inválido ou expirado."}')
  }
  try {
    await req('/tarefas', { auth: true }).catch(() => {})
    await new Promise(r => setTimeout(r, 0))
    assert.deepEqual(logouts, ['omit'])
  } finally {
    sessao.limpar()
  }
})
