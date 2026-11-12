#!/usr/bin/env node
/**
 * Orçamento de tamanho do build: falha se o que o navegador baixa para abrir o app
 * passar dos limites (medidos em gzip, como o nginx entrega).
 *
 *   npm run build && npm run orcamento
 */
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const DIST = new URL('../dist/', import.meta.url).pathname
const KB = 1024
const LIMITES = { html: 2 * KB, js: 85 * KB, css: 50 * KB }

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html não existe. Rode "npm run build" antes.')
  process.exit(1)
}

const gzip = arquivo => gzipSync(readFileSync(join(DIST, arquivo)), { level: 9 }).length
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const achar = regex => [...html.matchAll(regex)].map(m => m[1].replace(/^\.?\//, ''))

const js = achar(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)
const css = achar(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)
if (!js.length) {
  console.error('Não achei o JS de entrada no dist/index.html.')
  process.exit(1)
}

const medidas = [
  ['HTML (index.html)', gzip('index.html'), LIMITES.html],
  ['JS de entrada', js.reduce((t, a) => t + gzip(a), 0), LIMITES.js],
  ['CSS', css.reduce((t, a) => t + gzip(a), 0), LIMITES.css],
]

let estourou = false
for (const [nome, tamanho, limite] of medidas) {
  const ok = tamanho <= limite
  if (!ok) estourou = true
  console.log(`${ok ? 'ok   ' : 'ACIMA'}  ${nome.padEnd(18)} ${(tamanho / KB).toFixed(1).padStart(6)} KB gzip  (limite ${limite / KB} KB)`)
}
if (estourou) {
  console.error('\nO build passou do orçamento. Veja se algo pesado entrou no pacote de entrada (use lazy() ou import() sob demanda).')
  process.exit(1)
}
