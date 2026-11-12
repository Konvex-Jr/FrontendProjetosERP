#!/usr/bin/env node
/**
 * Levantamento no navegador: entra com cada papel e abre todas as telas do menu,
 * no desktop (1366 px) e no celular (375 px). Falha se houver erro no console,
 * "NaN" na tela ou rolagem horizontal. Tira um print de cada tela em e2e/prints/.
 *
 * Pré-requisitos (ambiente de dev, NUNCA a produção):
 *   1. API com dados fictícios (no backend: npm run dev:docker && npm run dados:ficticios)
 *   2. Frontend no ar: VITE_API_URL=http://localhost:5001 npx vite --port 5173
 *   3. Playwright: npm i -g playwright && npx playwright install chromium
 *
 *   node e2e/levantamento.mjs            # ou: APP_URL=... API_URL=... node e2e/levantamento.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const PRINTS = new URL('./prints/', import.meta.url).pathname

const CONTAS = [
  ['diretora', process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev'],
  ['gerente', 'ines@dev.konvex', 'Konvex123'],
  ['membro', 'bia@dev.konvex', 'Konvex123'],
]
const TELAS = [
  ['desktop', { viewport: { width: 1366, height: 900 } }],
  ['celular', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }],
]

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

async function menuDe(email, senha) {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  }).then(r => r.json())
  if (!login.token) throw new Error(`Login falhou para ${email}: ${JSON.stringify(login)}`)
  const p = await fetch(`${API}/auth/permissoes`, { headers: { 'access-token': login.token } }).then(r => r.json())
  return p.menu
}

const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
const browser = await chromium.launch()
const problemas = []
let telas = 0

for (const [papel, email, senha] of CONTAS) {
  const menu = await menuDe(email, senha)
  for (const [nomeTela, opcoes] of TELAS) {
    const ctx = await browser.newContext(opcoes)
    const page = await ctx.newPage()
    const erros = []
    page.on('console', m => {
      if (m.type() === 'error') erros.push(m.text())
    })
    page.on('pageerror', e => erros.push(e.message))

    await page.goto(`${APP}/#/login`)
    await page.fill('input[type=email]', email)
    await page.fill('input[type=password]', senha)
    await page.press('input[type=password]', 'Enter')
    await page.waitForSelector('text=Sair', { state: 'attached', timeout: 15000 })

    for (const item of menu) {
      erros.length = 0
      await page.goto(`${APP}/#${item.caminho}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const { largura, total, nan } = await page.evaluate(() => ({
        largura: document.documentElement.clientWidth,
        total: document.documentElement.scrollWidth,
        nan: /\bNaN\b/.test(document.body.innerText),
      }))
      const onde = `${papel} · ${nomeTela} · ${item.rotulo}`
      if (total > largura + 1) problemas.push(`${onde}: rolagem horizontal (${total} > ${largura})`)
      if (nan) problemas.push(`${onde}: "NaN" na tela`)
      for (const e of erros) problemas.push(`${onde}: console: ${e}`)
      await page.screenshot({ path: `${PRINTS}${papel}-${nomeTela}-${item.chave}.png`, fullPage: true })
      telas++
    }
    await ctx.close()
  }
}
await browser.close()

console.log(`${telas} telas abertas. Prints em ${PRINTS}`)
if (problemas.length) {
  console.error(`${problemas.length} problema(s):\n- ${problemas.join('\n- ')}`)
  process.exit(1)
}
console.log('Nenhum problema encontrado.')
