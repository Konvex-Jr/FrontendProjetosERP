#!/usr/bin/env node
/**
 * Desempenho da tela de login no Lighthouse 12 (perfil de celular, o padrão do Lighthouse).
 * Serve o dist/ com gzip e os mesmos cabeçalhos de cache do nginx.conf, roda o Lighthouse
 * via npx e falha se alguma nota ficar abaixo do mínimo.
 *
 * Pré-requisitos: "npm run build" e um Chrome/Chromium instalado
 * (se o Lighthouse não achar, aponte com CHROME_PATH=/caminho/do/chrome).
 *
 *   npm run build && npm run desempenho
 *   APP_URL=https://... npm run desempenho     # mede outro endereço em vez do dist/ local
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { tmpdir } from 'node:os'
import { gzipSync } from 'node:zlib'

const MINIMOS = { performance: 90, accessibility: 100, 'best-practices': 100 }
const NOMES = { performance: 'Desempenho', accessibility: 'Acessibilidade', 'best-practices': 'Boas práticas' }
const DIST = new URL('../dist/', import.meta.url).pathname

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
}
const COMPRIMIR = new Set(['.html', '.js', '.css', '.webmanifest', '.txt', '.svg'])

// Mesmas regras do nginx.conf.
function cache(caminho) {
  if (/^\/assets\/.+-[A-Za-z0-9_-]{8}\.(js|css|woff2)$/.test(caminho)) return 'public, max-age=31536000, immutable'
  if (/\.(webp|png|ico|webmanifest)$/.test(caminho)) return 'public, max-age=604800'
  return 'no-cache'
}

function servir() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist/index.html não existe. Rode "npm run build" antes.')
    process.exit(1)
  }
  const servidor = createServer((req, res) => {
    let caminho = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (caminho.endsWith('/')) caminho += 'index.html'
    const arquivo = join(DIST, caminho)
    if (!arquivo.startsWith(DIST) || !existsSync(arquivo)) {
      res.writeHead(404).end()
      return
    }
    const ext = extname(arquivo)
    let corpo = readFileSync(arquivo)
    const cabecalhos = { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': cache(caminho) }
    if (COMPRIMIR.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      corpo = gzipSync(corpo)
      cabecalhos['Content-Encoding'] = 'gzip'
      cabecalhos.Vary = 'Accept-Encoding'
    }
    res.writeHead(200, cabecalhos).end(corpo)
  })
  return new Promise(ok => servidor.listen(0, '127.0.0.1', () => ok(servidor)))
}

const servidor = process.env.APP_URL ? null : await servir()
const base = process.env.APP_URL?.replace(/\/$/, '') || `http://127.0.0.1:${servidor.address().port}`
const url = `${base}/#/login`
const saida = join(mkdtempSync(join(tmpdir(), 'lighthouse-')), 'relatorio.json')

console.log(`Lighthouse 12 em ${url}\n`)
// spawn assíncrono: um execFileSync travaria o event loop e o servidor acima não responderia.
const codigo = await new Promise(ok =>
  spawn(
    'npx',
    [
      '-y',
      'lighthouse@12',
      url,
      `--only-categories=${Object.keys(MINIMOS).join(',')}`,
      '--output=json',
      `--output-path=${saida}`,
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox',
    ],
    { stdio: 'inherit' },
  ).on('close', ok),
)
servidor?.close()
if (codigo !== 0) {
  console.error(`O Lighthouse terminou com código ${codigo}.`)
  process.exit(1)
}

const { categories } = JSON.parse(readFileSync(saida, 'utf8'))
let abaixo = false
for (const [id, minimo] of Object.entries(MINIMOS)) {
  const nota = Math.round((categories[id]?.score ?? 0) * 100)
  if (nota < minimo) abaixo = true
  console.log(`${nota >= minimo ? 'ok   ' : 'ABAIXO'}  ${NOMES[id].padEnd(15)} ${String(nota).padStart(3)}  (mínimo ${minimo})`)
}
console.log(`\nRelatório completo: ${saida}`)
if (abaixo) process.exit(1)
