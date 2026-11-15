import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { memoria } from '../src/lib/memoria.js'
import { memoriaArquivos } from '../src/lib/memoriaArquivos.js'
import { apagarMemorias, definirPessoa } from '../src/lib/memoriasDaAba.js'

// Guarda um dado e um arquivo da pessoa atual, para conferir o que sobra depois.
async function guardarDeAna() {
  await memoria.buscar('projetos', async () => [1])
  await memoriaArquivos.buscar('a1', async () => new Blob(['pdf']))
}

beforeEach(async () => {
  apagarMemorias()
  definirPessoa('ana')
  await guardarDeAna()
})

afterEach(() => {
  apagarMemorias()
})

test('trocar de pessoa apaga os dados e os arquivos na hora', () => {
  definirPessoa('bia')
  assert.equal(memoria.pessoa(), 'bia')
  assert.equal(memoria.obter('projetos'), undefined)
  assert.equal(memoriaArquivos.tamanhoTotal(), 0)
  // Mesmo que Ana volte, nada dela reaparece.
  definirPessoa('ana')
  assert.equal(memoriaArquivos.obter('a1'), undefined)
})

test('definir a mesma pessoa mantém os dados e os arquivos', () => {
  definirPessoa('ana')
  assert.deepEqual(memoria.obter('projetos'), [1])
  assert.ok(memoriaArquivos.obter('a1'))
})

test('sair apaga os dados e os arquivos e deixa a aba sem pessoa', () => {
  apagarMemorias()
  assert.equal(memoria.pessoa(), null)
  assert.equal(memoria.obter('projetos'), undefined)
  assert.equal(memoriaArquivos.tamanhoTotal(), 0)
})

test('trocar de pessoa ou sair libera as vagas de antecipação de anexos', async () => {
  const { anexos } = await import('../src/services/anexos.js')
  const original = globalThis.fetch
  const chamadas = []
  // Respostas que nunca chegam: as duas vagas ficam ocupadas pela pessoa anterior.
  globalThis.fetch = url => (chamadas.push(String(url).replace(/^.*\/anexos\//, '')), new Promise(() => {}))
  const esperar = () => new Promise(r => setTimeout(r, 0))
  try {
    anexos.antecipar({ id: 'x1', nome: 'a.pdf', bytes: 10 })
    anexos.antecipar({ id: 'x2', nome: 'b.pdf', bytes: 10 })
    await esperar()
    definirPessoa('bia')
    anexos.antecipar({ id: 'x3', nome: 'c.pdf', bytes: 10 })
    await esperar()
    assert.deepEqual(chamadas, ['x1', 'x2', 'x3'])
    anexos.antecipar({ id: 'x4', nome: 'd.pdf', bytes: 10 })
    apagarMemorias()
    definirPessoa('caio')
    anexos.antecipar({ id: 'x5', nome: 'e.pdf', bytes: 10 })
    anexos.antecipar({ id: 'x6', nome: 'f.pdf', bytes: 10 })
    await esperar()
    assert.deepEqual(chamadas, ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'])
  } finally {
    globalThis.fetch = original
  }
})
