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
