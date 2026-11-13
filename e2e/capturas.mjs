#!/usr/bin/env node
/**
 * Capturas de tela do README, sempre com dados fictícios (nunca a produção).
 * Gera docs/capturas/*.png: login, painel, tarefas, capacitações no tema escuro
 * e tarefas no celular. Os avisos (SweetAlert2) ficam escondidos nas fotos.
 *
 * Pré-requisitos: os mesmos do levantamento (e2e/levantamento.mjs):
 *   1. API com dados fictícios (no backend: npm run dev:docker && npm run dados:ficticios)
 *   2. Frontend no ar: VITE_API_URL=http://localhost:5001 npx vite --port 5173
 *   3. Playwright instalado (npm i -g playwright && npx playwright install chromium)
 *
 *   npm run capturas            # ou: APP_URL=... npm run capturas
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const SAIDA = new URL('../docs/capturas/', import.meta.url).pathname
const BIA = ['bia@dev.konvex', 'Konvex123'] // membro líder: tem tarefas e projeto
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const DESKTOP = { viewport: { width: 1366, height: 820 } }
const CELULAR = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

const { chromium } = carregarPlaywright()
mkdirSync(SAIDA, { recursive: true })
const browser = await chromium.launch()

async function sessao(opcoes, tema, conta) {
  const ctx = await browser.newContext({ ...opcoes, colorScheme: tema })
  // O Layout lê o tema salvo; assim a foto já abre no tema certo.
  await ctx.addInitScript(t => localStorage.setItem('tema', t), tema)
  const page = await ctx.newPage()
  if (conta) {
    await page.goto(`${APP}/#/login`)
    await page.fill('input[type=email]', conta[0])
    await page.fill('input[type=password]', conta[1])
    await page.press('input[type=password]', 'Enter')
    await page.waitForSelector('text=Sair', { state: 'attached', timeout: 15000 })
  }
  return { ctx, page }
}

async function foto(page, rota, nome) {
  await page.goto(`${APP}/#${rota}`)
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: '.swal2-container{display:none!important}' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SAIDA}${nome}.png` })
}

let s = await sessao(DESKTOP, 'light')
await foto(s.page, '/login', 'login')
await s.ctx.close()

s = await sessao(DESKTOP, 'light', BIA)
await foto(s.page, '/', 'painel')
await foto(s.page, '/tarefas', 'tarefas')
await s.ctx.close()

s = await sessao(DESKTOP, 'dark', DIRETORA)
await foto(s.page, '/capacitacoes', 'capacitacoes-escuro')
await s.ctx.close()

s = await sessao(CELULAR, 'light', BIA)
await foto(s.page, '/tarefas', 'celular-tarefas')
await s.ctx.close()

await browser.close()
console.log(`Capturas em ${SAIDA}`)
