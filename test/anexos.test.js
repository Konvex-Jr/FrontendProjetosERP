import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACEITA, LIMITE_BYTES, adaptAnexo, anexos, conferirArquivo, extensao, tamanhoLegivel } from '../src/services/anexos.js'
import { adaptDocumento, corpoDocumento } from '../src/services/documentos.js'
import { adaptConhecimento } from '../src/services/conhecimento.js'
import { adaptIniciativa } from '../src/services/iniciativas.js'

const arquivo = (name, size, type = 'application/pdf') => {
  const blob = new Blob([new Uint8Array(size)], { type })
  return Object.assign(blob, { name })
}

test('confere tipo, vazio e limite de 20 MB antes de enviar', () => {
  assert.equal(conferirArquivo(arquivo('relatório.PDF', 10)), '')
  assert.equal(conferirArquivo(arquivo('foto.jpeg', 10)), '')
  assert.match(conferirArquivo(arquivo('pagina.html', 10)), /não aceito/)
  assert.match(conferirArquivo(arquivo('semextensao', 10)), /não aceito/)
  assert.equal(conferirArquivo(arquivo('a.pdf', 0)), 'O arquivo está vazio.')
  assert.equal(conferirArquivo({ name: 'a.pdf', size: LIMITE_BYTES + 1 }), 'O arquivo passa de 20 MB, o tamanho máximo.')
  assert.equal(conferirArquivo({ name: 'a.pdf', size: LIMITE_BYTES }), '')
  assert.equal(conferirArquivo(null), 'Escolha um arquivo.')
  assert.equal(extensao('a.tar.GZ'), 'gz')
  assert.ok(ACEITA.includes('.docx') && ACEITA.includes('.png'))
})

test('mostra o tamanho de forma legível', () => {
  assert.equal(tamanhoLegivel(500), '500 B')
  assert.equal(tamanhoLegivel(2048), '2 KB')
  assert.equal(tamanhoLegivel(1.25 * 1024 * 1024), '1,3 MB')
})

test('adapta anexo, documento de arquivo e anexos da Base e das Iniciativas', () => {
  const bruto = { codigo: 'a1', nome: 'Ata.pdf', tamanhoBytes: 2048, enviadoPor: { codigo: 'u', nome: 'Ana' }, enviadoEm: '2026-11-09T15:00:00.000Z' }
  assert.deepEqual(adaptAnexo(bruto), { id: 'a1', nome: 'Ata.pdf', tamanho: '2 KB', enviadoPor: 'Ana', data: '2026-11-09' })
  const doc = adaptDocumento({ codigo: 'd1', nome: 'Ata', arquivoUrl: null, anexo: bruto, dataEnvio: '2026-11-09' })
  assert.equal(doc.url, '')
  assert.equal(doc.anexo.id, 'a1')
  assert.equal(doc.dominio, 'Arquivo')
  assert.equal(adaptDocumento({ codigo: 'd2', nome: 'Drive', arquivoUrl: 'https://drive.google.com/x' }).anexo, null)
  assert.deepEqual(corpoDocumento({ nome: ' Ata ', url: 'x' }, true), { nome: 'Ata' })
  assert.deepEqual(adaptConhecimento({ codigo: 'k', anexos: [bruto] }).anexos, [bruto])
  assert.deepEqual(adaptIniciativa({ codigo: 'i' }).anexos, [])
})

test('envia os bytes com o nome no cabeçalho e baixa pela API com a sessão', async () => {
  const original = globalThis.fetch
  const chamadas = []
  globalThis.fetch = async (url, init) => {
    chamadas.push({ url: String(url), init })
    return { ok: true, status: 200, text: async () => '{"codigo":"a1"}' }
  }
  try {
    const f = arquivo('Relatório final.pdf', 3)
    await anexos.enviar('conhecimento', 'k1', f)
    await anexos.enviarDocumento('p1', f)
    await anexos.excluir('a1')
  } finally {
    globalThis.fetch = original
  }
  assert.match(chamadas[0].url, /\/conhecimento\/k1\/anexos$/)
  assert.equal(chamadas[0].init.method, 'POST')
  assert.equal(chamadas[0].init.headers['X-Nome-Arquivo'], 'Relat%C3%B3rio%20final.pdf')
  assert.equal(chamadas[0].init.headers['Content-Type'], 'application/octet-stream')
  assert.ok(chamadas[0].init.body instanceof Blob)
  assert.match(chamadas[1].url, /\/pastas\/p1\/documentos\/arquivo$/)
  assert.match(chamadas[2].url, /\/anexos\/a1$/)
  assert.equal(chamadas[2].init.method, 'DELETE')
})
