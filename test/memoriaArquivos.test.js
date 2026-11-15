import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import { memoria } from '../src/lib/memoria.js'
import { LIMITE_BYTES, VALIDADE_MS, memoriaArquivos } from '../src/lib/memoriaArquivos.js'

const MB = 1024 * 1024
const blob = (bytes = 3) => new Blob([new Uint8Array(bytes)])
const erroComStatus = status => Object.assign(new Error(`erro ${status}`), { status })

// Promessa que o teste resolve quando quiser (simula a resposta lenta da API).
function adiada() {
  let resolver, rejeitar
  const promessa = new Promise((res, rej) => {
    resolver = res
    rejeitar = rej
  })
  return { promessa, resolver, rejeitar }
}

beforeEach(() => {
  memoria.limpar()
  memoria.definirPessoa('ana')
  memoriaArquivos.limpar()
})

afterEach(() => {
  mock.timers.reset()
  memoriaArquivos.limpar()
  memoria.definirPessoa(null)
})

test('valores da regra: 50 MB no total e 10 minutos por arquivo', () => {
  assert.equal(LIMITE_BYTES, 50 * 1024 * 1024)
  assert.equal(VALIDADE_MS, 10 * 60 * 1000)
})

test('guarda o Blob para obter depois', async () => {
  const arquivo = blob()
  assert.equal(await memoriaArquivos.buscar('a1', async () => arquivo), arquivo)
  assert.equal(memoriaArquivos.obter('a1'), arquivo)
  assert.equal(memoriaArquivos.obter('outro'), undefined)
})

test('segunda busca da mesma chave em andamento não chama carregar de novo', async () => {
  const resposta = adiada()
  let chamadas = 0
  const carregar = () => (chamadas++, resposta.promessa)
  const a = memoriaArquivos.buscar('a1', carregar)
  const b = memoriaArquivos.buscar('a1', carregar)
  const arquivo = blob()
  resposta.resolver(arquivo)
  assert.equal(await a, arquivo)
  assert.equal(await b, arquivo)
  assert.equal(chamadas, 1)
})

test('quem entra numa busca em andamento recebe o progresso, inclusive o último já visto', async () => {
  const resposta = adiada()
  let avisar
  const vistosA = []
  const vistosB = []
  const a = memoriaArquivos.buscar(
    'a1',
    aoProgresso => {
      avisar = aoProgresso
      return resposta.promessa
    },
    { aoProgresso: (r, t) => vistosA.push([r, t]) },
  )
  avisar(10, 100)
  const b = memoriaArquivos.buscar('a1', () => assert.fail('não busca de novo'), { aoProgresso: (r, t) => vistosB.push([r, t]) })
  avisar(100, 100)
  resposta.resolver(blob())
  await Promise.all([a, b])
  assert.deepEqual(vistosA, [
    [10, 100],
    [100, 100],
  ])
  assert.deepEqual(vistosB, [
    [10, 100],
    [100, 100],
  ])
})

test('depois de 10 minutos obter devolve undefined', async () => {
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 })
  await memoriaArquivos.buscar('a1', async () => blob())
  mock.timers.tick(VALIDADE_MS - 1)
  assert.ok(memoriaArquivos.obter('a1'))
  mock.timers.tick(2)
  assert.equal(memoriaArquivos.obter('a1'), undefined)
  assert.equal(memoriaArquivos.tamanhoTotal(), 0)
})

test('três arquivos de 20 MB: o usado há mais tempo sai e o total fica em até 50 MB', async () => {
  await memoriaArquivos.buscar('a1', async () => blob(20 * MB))
  await memoriaArquivos.buscar('a2', async () => blob(20 * MB))
  // a1 é usado de novo: quem sai é a2.
  assert.ok(memoriaArquivos.obter('a1'))
  await memoriaArquivos.buscar('a3', async () => blob(20 * MB))
  assert.ok(memoriaArquivos.obter('a1'))
  assert.equal(memoriaArquivos.obter('a2'), undefined)
  assert.ok(memoriaArquivos.obter('a3'))
  assert.ok(memoriaArquivos.tamanhoTotal() <= LIMITE_BYTES)
  assert.equal(memoriaArquivos.tamanhoTotal(), 40 * MB)
})

test('arquivo maior que o limite inteiro não é guardado', async () => {
  const grande = { size: LIMITE_BYTES + 1 }
  assert.equal(await memoriaArquivos.buscar('a1', async () => grande), grande)
  assert.equal(memoriaArquivos.obter('a1'), undefined)
})

test('outra pessoa não vê o arquivo guardado por A', async () => {
  await memoriaArquivos.buscar('a1', async () => blob())
  memoria.definirPessoa('bia')
  assert.equal(memoriaArquivos.obter('a1'), undefined)
  // A volta: o arquivo já foi descartado, não reaparece.
  memoria.definirPessoa('ana')
  assert.equal(memoriaArquivos.obter('a1'), undefined)
})

test('busca de A que termina depois da troca de pessoa não grava nem é reaproveitada por B', async () => {
  const deA = adiada()
  const buscaA = memoriaArquivos.buscar('a1', () => deA.promessa)
  memoria.definirPessoa('bia')
  let chamadasB = 0
  const arquivoB = blob(5)
  const buscaB = memoriaArquivos.buscar('a1', async () => (chamadasB++, arquivoB))
  deA.resolver(blob(7))
  await buscaA
  assert.equal(await buscaB, arquivoB)
  assert.equal(chamadasB, 1)
  assert.equal(memoriaArquivos.obter('a1'), arquivoB)
})

test('limpar (ao sair) apaga tudo e a busca em andamento não grava depois', async () => {
  await memoriaArquivos.buscar('a1', async () => blob())
  const lenta = adiada()
  const busca = memoriaArquivos.buscar('a2', () => lenta.promessa)
  memoriaArquivos.limpar()
  lenta.resolver(blob())
  await busca
  assert.equal(memoriaArquivos.obter('a1'), undefined)
  assert.equal(memoriaArquivos.obter('a2'), undefined)
  assert.equal(memoriaArquivos.tamanhoTotal(), 0)
})

test('sem ninguém logado nada é guardado', async () => {
  memoria.definirPessoa(null)
  await memoriaArquivos.buscar('a1', async () => blob())
  assert.equal(memoriaArquivos.obter('a1'), undefined)
})

for (const status of [401, 403, 404]) {
  test(`erro ${status} apaga a chave e repassa o erro`, async () => {
    await memoriaArquivos.buscar('a1', async () => blob())
    await memoriaArquivos.buscar('a2', async () => blob())
    const erro = erroComStatus(status)
    await assert.rejects(
      memoriaArquivos.buscar('a1', async () => Promise.reject(erro)),
      e => e === erro,
    )
    assert.equal(memoriaArquivos.obter('a1'), undefined)
    assert.ok(memoriaArquivos.obter('a2'))
  })
}

test('erro sem status de acesso (rede) mantém o que estava guardado', async () => {
  await memoriaArquivos.buscar('a1', async () => blob())
  await assert.rejects(memoriaArquivos.buscar('a1', async () => Promise.reject(erroComStatus(0))))
  assert.ok(memoriaArquivos.obter('a1'))
})

test('apagar tira o arquivo e descarta a busca em andamento', async () => {
  await memoriaArquivos.buscar('a1', async () => blob())
  memoriaArquivos.apagar('a1')
  assert.equal(memoriaArquivos.obter('a1'), undefined)
  const lenta = adiada()
  const busca = memoriaArquivos.buscar('a2', () => lenta.promessa)
  memoriaArquivos.apagar('a2')
  lenta.resolver(blob())
  await busca
  assert.equal(memoriaArquivos.obter('a2'), undefined)
})
