import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { memoria } from '../src/lib/memoria.js'

beforeEach(() => {
  memoria.limpar()
  memoria.definirPessoa('ana')
})

afterEach(() => {
  memoria.limpar()
})

function erroComStatus(status) {
  return Object.assign(new Error(`erro ${status}`), { status })
}

test('guarda e devolve por chave', async () => {
  const valor = { id: 1 }
  const resultado = await memoria.buscar('projetos', async () => valor)

  assert.equal(resultado, valor)
  assert.equal(memoria.obter('projetos'), valor)
  assert.equal(memoria.obter('outra'), undefined)
})

test('definirPessoa com outro código apaga tudo', async () => {
  await memoria.buscar('projetos', async () => [1])
  memoria.definirPessoa('bia')

  assert.equal(memoria.obter('projetos'), undefined)
})

test('definirPessoa com o mesmo código mantém', async () => {
  await memoria.buscar('projetos', async () => [1])
  memoria.definirPessoa('ana')

  assert.deepEqual(memoria.obter('projetos'), [1])
})

test('limpar apaga tudo', async () => {
  await memoria.buscar('projetos', async () => [1])
  await memoria.buscar('tarefas', async () => [2])
  memoria.limpar()

  assert.equal(memoria.obter('projetos'), undefined)
  assert.equal(memoria.obter('tarefas'), undefined)
})

for (const status of [401, 403, 404]) {
  test(`${status} apaga a chave e repassa o erro`, async () => {
    await memoria.buscar('projetos', async () => [1])
    await memoria.buscar('outra', async () => [2])
    const erro = erroComStatus(status)

    await assert.rejects(
      memoria.buscar('projetos', async () => {
        throw erro
      }),
      e => e === erro,
    )
    assert.equal(memoria.obter('projetos'), undefined)
    assert.deepEqual(memoria.obter('outra'), [2])
  })
}

test('erro de rede (status 0) e 500 mantêm o dado guardado', async () => {
  await memoria.buscar('projetos', async () => [1])

  for (const status of [0, 500]) {
    await assert.rejects(
      memoria.buscar('projetos', async () => {
        throw erroComStatus(status)
      }),
    )
    assert.deepEqual(memoria.obter('projetos'), [1])
  }
})

test('resposta que chega depois da troca de pessoa não é gravada', async () => {
  let resolver
  const pendente = memoria.buscar('projetos', () => new Promise(r => (resolver = r)))
  memoria.definirPessoa('outra')
  resolver([1])
  await pendente

  assert.equal(memoria.obter('projetos'), undefined)
})

test('resposta que chega depois de limpar não é gravada', async () => {
  let resolver
  const pendente = memoria.buscar('projetos', () => new Promise(r => (resolver = r)))
  memoria.limpar()
  resolver([1])
  await pendente

  assert.equal(memoria.obter('projetos'), undefined)
})

test('erro 404 de pessoa anterior não apaga dado da pessoa nova', async () => {
  let rejeitar
  const pendente = memoria.buscar('projetos', () => new Promise((_, r) => (rejeitar = r)))
  memoria.definirPessoa('bia')
  await memoria.buscar('projetos', async () => ['da bia'])
  rejeitar(erroComStatus(404))
  await assert.rejects(pendente)

  assert.deepEqual(memoria.obter('projetos'), ['da bia'])
})

test('buscas simultâneas da mesma chave chamam carregar uma vez', async () => {
  let chamadas = 0
  let resolver
  const carregar = () => {
    chamadas += 1
    return new Promise(r => (resolver = r))
  }
  const a = memoria.buscar('projetos', carregar)
  const b = memoria.buscar('projetos', carregar)
  resolver([1])

  assert.equal(await a, await b)
  assert.equal(chamadas, 1)

  await memoria.buscar('projetos', async () => [2])
  assert.deepEqual(memoria.obter('projetos'), [2])
})

test('busca depois de limpar ou trocar de pessoa começa chamada nova', async () => {
  let chamadas = 0
  const resolvers = []
  const carregar = () => {
    chamadas += 1
    return new Promise(r => resolvers.push(r))
  }
  const antiga = memoria.buscar('projetos', carregar)
  memoria.limpar()
  const nova = memoria.buscar('projetos', carregar)
  memoria.definirPessoa('bia')
  const outra = memoria.buscar('projetos', carregar)

  assert.equal(chamadas, 3)
  resolvers[0]('antiga')
  resolvers[1]('nova')
  resolvers[2]('da bia')
  await Promise.all([antiga, nova, outra])

  assert.equal(memoria.obter('projetos'), 'da bia')
})

test('ouvir avisa ao gravar e ao apagar', async () => {
  const avisos = []
  const parar = memoria.ouvir('projetos', valor => avisos.push(valor))
  const outros = []
  memoria.ouvir('tarefas', valor => outros.push(valor))

  await memoria.buscar('projetos', async () => [1])
  await assert.rejects(
    memoria.buscar('projetos', async () => {
      throw erroComStatus(404)
    }),
  )
  assert.deepEqual(avisos, [[1], undefined])
  assert.deepEqual(outros, [])

  parar()
  await memoria.buscar('projetos', async () => [2])
  assert.equal(avisos.length, 2)
})

test('limpar e troca de pessoa avisam quem tinha dado', async () => {
  await memoria.buscar('projetos', async () => [1])
  const avisos = []
  const vazios = []
  memoria.ouvir('projetos', valor => avisos.push(valor))
  memoria.ouvir('tarefas', valor => vazios.push(valor))

  memoria.definirPessoa('ana')
  assert.deepEqual(avisos, [])

  memoria.definirPessoa('bia')
  assert.deepEqual(avisos, [undefined])

  await memoria.buscar('projetos', async () => [3])
  memoria.limpar()
  assert.deepEqual(avisos, [undefined, [3], undefined])
  assert.deepEqual(vazios, [])
})

test('não usa localStorage nem sessionStorage', async () => {
  const original = {
    local: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    session: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
  }
  const falha = () => {
    throw new Error('acesso proibido ao storage')
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: falha })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: falha })

  try {
    await memoria.buscar('projetos', async () => [1])
    assert.deepEqual(memoria.obter('projetos'), [1])
    memoria.definirPessoa('bia')
    memoria.limpar()
  } finally {
    for (const [nome, d] of [
      ['localStorage', original.local],
      ['sessionStorage', original.session],
    ]) {
      if (d) Object.defineProperty(globalThis, nome, d)
      else delete globalThis[nome]
    }
  }
})
