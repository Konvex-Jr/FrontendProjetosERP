#!/usr/bin/env node
/**
 * Medição do carregamento com latência simulada (sessão 18). A VPS fica em Boston e cada ida e
 * volta leva de 130 a 230 ms; aqui o Chromium soma 150 ms a cada requisição (CDP
 * Network.emulateNetworkConditions), sem limite de banda, para medir o que a pessoa sente.
 *
 * Cenários (cada um 5 vezes; imprime mediana, mínimo e máximo em ms):
 *   (a) F5 até o primeiro conteúdo do Dashboard visível (o "Olá, ..." do topo).
 *   (b) O mesmo F5, mas com o token de acesso vencido e o refresh token válido.
 *   (c) Dashboard → Tarefas → Projetos → Tarefas pelo menu: tempo do último clique até a lista (Kanban)
 *       visível, e se "Carregando" (texto) ou esqueleto ([aria-busy="true"]) apareceu nessa volta.
 * Sai com código 1 se o texto "Carregando" aparecer na volta a Tarefas (tela já vista).
 *
 * Pré-requisitos (ambiente de dev, NUNCA a produção):
 *   1. API com dados fictícios (no backend: npm run dev:docker && npm run dados:ficticios)
 *   2. dist/ servido numa origem liberada no CORS da API (ex.: 4173, a do "vite preview"):
 *      VITE_API_URL=http://localhost:5002 npm run build && npx vite preview --port 4173
 *   3. Playwright fora do projeto (npm i playwright numa pasta à parte; NODE_PATH=<pasta>/node_modules)
 *
 *   APP_URL=http://localhost:4173 API_URL=http://localhost:5002 npm run carregamento
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const APP = (process.env.APP_URL || 'http://localhost:4173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const EMAIL = process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br'
const SENHA = process.env.ADMIN_PASSWORD || 'konvex-dev'
const LATENCIA = Number(process.env.LATENCIA_MS || 150)
const VEZES = Number(process.env.VEZES || 5)
const LIMITE = 30000

// Seletores que existem igual antes e depois da sessão 18.
const DASHBOARD = 'section.hero h1'
// Tarefas abre no Kanban; a lista também vale, caso o padrão mude.
const TAREFAS = '.kb, table.tc'
const PROJETOS = '.pj, table.tc'

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

/**
 * Roda dentro da página: verdadeiro quando o seletor está visível e não há indicador de
 * carregamento na tela (texto "Carregando" visível ou elemento com aria-busy). O texto dentro de
 * .visually-hidden (rótulo do esqueleto para leitor de tela) não conta como texto visível; o
 * esqueleto já conta pelo aria-busy.
 */
function instalarSondas() {
  const visivel = el => {
    if (!el || el.closest('.visually-hidden')) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const textoCarregando = () => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) if (w.currentNode.nodeValue.includes('Carregando') && visivel(w.currentNode.parentElement)) return true
    return false
  }
  const ocupado = () => document.querySelector('[aria-busy="true"]') !== null
  window.__pronto = sel => {
    const el = [...document.querySelectorAll(sel)].find(visivel)
    return Boolean(el) && !textoCarregando() && !ocupado()
  }
  // Vigia a tela de um instante em diante: a cada quadro e a cada mudança no DOM.
  window.__vigiar = () => {
    const v = { carregando: false, esqueleto: false }
    const olhar = () => {
      if (textoCarregando()) v.carregando = true
      if (ocupado()) v.esqueleto = true
    }
    const mo = new MutationObserver(olhar)
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true })
    let ativo = true
    const quadro = () => {
      olhar()
      if (ativo) requestAnimationFrame(quadro)
    }
    requestAnimationFrame(quadro)
    window.__parar = () => {
      ativo = false
      mo.disconnect()
      return v
    }
  }
}

/** Espera o seletor pronto e devolve o performance.now() da página nesse quadro. */
async function quandoPronto(page, sel) {
  const h = await page.waitForFunction(s => window.__pronto?.(s) && performance.now(), sel, {
    polling: 'raf',
    timeout: LIMITE,
  })
  return h.jsonValue()
}

async function f5(page) {
  await page.reload({ waitUntil: 'commit' })
  const fim = await quandoPronto(page, DASHBOARD)
  const html = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.responseEnd ?? 0)
  return { total: fim, html }
}

/** Mesmo token, com o prazo (exp) no passado: o formato é de JWT; a assinatura não importa. */
async function vencerToken(page) {
  await page.evaluate(() => {
    const t = sessionStorage.getItem('konvex_access_token')
    const [cab, corpo, ass] = t.split('.')
    const b64 = s => s.replace(/-/g, '+').replace(/_/g, '/')
    const dados = JSON.parse(atob(b64(corpo)))
    dados.exp = Math.floor(Date.now() / 1000) - 60
    const novo = btoa(JSON.stringify(dados)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    sessionStorage.setItem('konvex_access_token', [cab, novo, ass].join('.'))
  })
}

async function irPeloMenu(page, rotulo) {
  await page.click(`#menu a[aria-label="${rotulo}"]`)
}

async function navegar(page) {
  await page.goto(`${APP}/#/`)
  await page.reload({ waitUntil: 'commit' })
  await quandoPronto(page, DASHBOARD)
  await irPeloMenu(page, 'Tarefas')
  await quandoPronto(page, TAREFAS)
  await irPeloMenu(page, 'Projetos')
  await quandoPronto(page, PROJETOS)
  // O instante do clique é gravado na própria página, no momento do evento.
  await page.evaluate(() => {
    window.__clique = null
    document.addEventListener('click', () => (window.__clique ??= performance.now()), { capture: true, once: true })
    window.__vigiar()
  })
  await irPeloMenu(page, 'Tarefas')
  const fim = await quandoPronto(page, TAREFAS)
  const { clique, vigia } = await page.evaluate(() => ({ clique: window.__clique, vigia: window.__parar() }))
  return { total: fim - clique, ...vigia }
}

const mediana = v => {
  const o = [...v].sort((a, b) => a - b)
  return o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2
}
const ms = n => String(Math.round(n)).padStart(6)
const linha = (nome, v) => `${nome.padEnd(42)} ${ms(mediana(v))} ${ms(Math.min(...v))} ${ms(Math.max(...v))}`

const { chromium } = carregarPlaywright()
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
const page = await ctx.newPage()
const erros = []
page.on('pageerror', e => erros.push(e.message))
await page.addInitScript(instalarSondas)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: LATENCIA,
  downloadThroughput: -1,
  uploadThroughput: -1,
})

console.log(`Carregamento em ${APP} (API ${API}), latência simulada de ${LATENCIA} ms, ${VEZES} vezes por cenário\n`)
await page.goto(`${APP}/#/login`)
await page.fill('input[type=email]', EMAIL)
await page.fill('input[type=password]', SENHA)
await page.press('input[type=password]', 'Enter')
await page.waitForSelector('text=Sair', { state: 'attached', timeout: LIMITE })

const a = [],
  aHtml = [],
  b = [],
  c = [],
  vistas = []
for (let i = 0; i < VEZES; i++) {
  const r = await f5(page)
  a.push(r.total)
  aHtml.push(r.html)
}
for (let i = 0; i < VEZES; i++) {
  await vencerToken(page)
  b.push((await f5(page)).total)
}
for (let i = 0; i < VEZES; i++) {
  const r = await navegar(page)
  c.push(r.total)
  vistas.push(r)
}
await browser.close()

const carregando = vistas.filter(v => v.carregando).length
const esqueleto = vistas.filter(v => v.esqueleto).length
console.log(`${'Cenário'.padEnd(42)} ${'med.'.padStart(6)} ${'mín.'.padStart(6)} ${'máx.'.padStart(6)}`)
console.log(linha('(a) F5 até o Dashboard', a))
console.log(linha('    só o HTML (responseEnd)', aHtml))
console.log(linha('(b) F5 com token vencido', b))
console.log(linha('(c) volta a Tarefas até a lista', c))
console.log(`\n(c) "Carregando" na volta a Tarefas: ${carregando} de ${VEZES}; esqueleto: ${esqueleto} de ${VEZES}`)
if (erros.length) console.log(`Erros na página: ${[...new Set(erros)].join(' | ')}`)
if (carregando) {
  console.log('\nFALHOU: "Carregando" apareceu numa tela já vista.')
  process.exit(1)
}
