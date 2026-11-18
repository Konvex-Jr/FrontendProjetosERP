import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blobDeFotoValido, fotoUrl, quadradoDeRecorte, validarArquivoFoto } from '../src/lib/foto.js'

const UUID = '3f2b8c1e-5a4d-4e6f-9a1b-0c2d3e4f5a6b.webp'

test('fotoUrl monta o endereço público da foto', () => {
  assert.equal(fotoUrl(UUID, 'http://a'), `http://a/fotos/${UUID}`)
})

test('fotoUrl devolve null sem foto ou com nome fora do formato', () => {
  assert.equal(fotoUrl(null), null)
  assert.equal(fotoUrl(undefined), null)
  assert.equal(fotoUrl('../x', 'http://a'), null)
  assert.equal(fotoUrl('x.webp', 'http://a'), null)
})

test('quadradoDeRecorte centraliza com zoom 1', () => {
  assert.deepEqual(quadradoDeRecorte({ largura: 400, altura: 200, zoom: 1, x: 0.5, y: 0.5 }), { sx: 100, sy: 0, lado: 200 })
})

test('quadradoDeRecorte: zoom diminui o lado', () => {
  assert.deepEqual(quadradoDeRecorte({ largura: 400, altura: 200, zoom: 2, x: 0, y: 0 }), { sx: 0, sy: 0, lado: 100 })
})

test('quadradoDeRecorte fica dentro da imagem no canto inferior direito', () => {
  assert.deepEqual(quadradoDeRecorte({ largura: 400, altura: 200, zoom: 2, x: 1, y: 1 }), { sx: 300, sy: 100, lado: 100 })
})

test('quadradoDeRecorte limita zoom menor que 1 e x/y fora de 0..1', () => {
  assert.deepEqual(quadradoDeRecorte({ largura: 400, altura: 200, zoom: 0.5, x: 9, y: -3 }), { sx: 200, sy: 0, lado: 200 })
})

test('validarArquivoFoto confere tipo e tamanho', () => {
  assert.equal(validarArquivoFoto({ type: 'image/gif', size: 10 }), 'Escolha uma imagem JPEG, PNG ou WebP.')
  assert.equal(validarArquivoFoto({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }), 'A imagem pode ter até 5 MB.')
  assert.equal(validarArquivoFoto({ type: 'image/png', size: 5 * 1024 * 1024 }), null)
  assert.equal(validarArquivoFoto({ type: 'image/jpeg', size: 100 }), null)
  assert.equal(validarArquivoFoto({ type: 'image/webp', size: 100 }), null)
  assert.equal(validarArquivoFoto(null), 'Escolha uma imagem JPEG, PNG ou WebP.')
})

test('blobDeFotoValido aceita WebP e JPEG, recusa PNG e nada', () => {
  assert.equal(blobDeFotoValido({ type: 'image/webp' }), true)
  assert.equal(blobDeFotoValido({ type: 'image/jpeg' }), true)
  assert.equal(blobDeFotoValido({ type: 'image/png' }), false)
  assert.equal(blobDeFotoValido(null), false)
})
