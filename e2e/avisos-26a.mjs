#!/usr/bin/env node
/**
 * Avisos e ocupação (sessão 26a), ponta a ponta, tudo pela tela (a API só confere e limpa).
 *
 *   1. gerente (Inês) cria tarefa para a Bia pela janela "Nova tarefa"
 *   2. Sair, entrar como Bia na mesma aba: sininho com mais 1 aviso e o painel mostra a tarefa
 *   3. clicar no aviso abre a TaskModal em Tarefas e o número do sininho cai
 *   4. Sair, entrar como Caio na mesma aba: sininho sem os avisos da Bia
 *   5. diretora vê "Ocupação da semana" no Dashboard; membro (Caio) não
 *   6. celular (375 px), escuro: painel de avisos abre em tela cheia e fecha
 *
 * Pré-requisitos: dados fictícios no backend:
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/avisos-26a.mjs
 * Ao final apaga a tarefa criada (pela API).
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex@123'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const INES = ['ines@dev.konvex', SENHA]
const BIA = ['bia@dev.konvex', SENHA]
const CAIO = ['caio@dev.konvex', SENHA]
const SUFIXO = Date.now().toString(36)
const TITULO = `Revisar o contrato ${SUFIXO}`
const PROJETO = 'Site institucional (fictício)'

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

let tokenDir
async function api(metodo, caminho, corpo, token = tokenDir) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'access-token': token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  const json = texto ? JSON.parse(texto) : null
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${texto}`)
  return json
}
const entrarApi = async (email, senha) => (await api('POST', '/auth/login', { email, senha }, null)).token

let paginaAtual
let falhou = false
const passo = async (nome, fn) => {
  if (falhou) return console.log(`PULADO ${nome}`)
  try {
    await fn()
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    await paginaAtual?.screenshot({ path: `${PRINTS}avisos-26a-falha.png` }).catch(() => {})
    console.log(`FALHA  ${nome}\n       ${e.message.split('\n').slice(0, 14).join('\n       ')}`)
  }
}
const exigir = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

async function entrar(page, email, senha) {
  await page.goto(`${APP}/#/login`)
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', senha)
  await page.press('input[type=password]', 'Enter')
  await page.waitForSelector('[aria-label="Sair"]', { state: 'attached', timeout: 15000 })
}
const sair = async page => {
  await page.click('[aria-label="Sair"]')
  await page.waitForSelector('input[type=email]', { timeout: 15000 })
}
const sino = page => page.locator('.av-sino button.tg')
const naoLidos = async page => Number(/\((\d+) não lidos\)/.exec(await sino(page).getAttribute('aria-label'))?.[1])
const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const campo = (dlg, rotulo) =>
  dlg
    .locator('label')
    .filter({ hasText: new RegExp(`^${rotulo}`) })
    .locator('select, input, textarea')
    .first()

const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenDir = await entrarApi(...DIRETORA)
const tokenBia = await entrarApi(...BIA)
const antesBia = (await api('GET', '/avisos', null, tokenBia)).naoLidos

const errosConsole = []
let browser
try {
  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  paginaAtual = page
  // 401 de /auth/retomar na tela de login (sem cookie de retomada) é esperado.
  let retomar401 = 0
  page.on('response', r => r.status() === 401 && /\/auth\/retomar$/.test(r.url()) && retomar401++)
  page.on('console', m => {
    if (m.type() !== 'error') return
    if (/status of 401/.test(m.text()) && retomar401 > 0) return retomar401--
    errosConsole.push(m.text())
  })
  page.on('pageerror', e => errosConsole.push(e.message))

  await passo('1. gerente cria tarefa para a Bia pela tela', async () => {
    await entrar(page, ...INES)
    await page.locator('#menu a[aria-label="Tarefas"]').click()
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click()
    const dlg = page.getByRole('dialog', { name: 'Nova tarefa' })
    await dlg.waitFor({ timeout: 15000 })
    await campo(dlg, 'Projeto').selectOption({ label: PROJETO })
    await dlg.locator('.ms .mc').click()
    await dlg.locator('.ms .mo').filter({ hasText: 'Bia Membro' }).click()
    await dlg.getByLabel('Título da tarefa').click()
    await dlg.getByLabel('Título da tarefa').fill(TITULO)
    await campo(dlg, 'Início').fill(hoje())
    await campo(dlg, 'Fim').fill(hoje())
    await dlg.getByRole('button', { name: 'Criar tarefa' }).click()
    await page.locator('.swal2-toast').filter({ hasText: 'Tarefa criada' }).waitFor({ timeout: 15000 })
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    await sair(page)
  })

  await passo('2. Bia entra na mesma aba: sininho com +1 e painel mostra a tarefa', async () => {
    await entrar(page, ...BIA)
    await sino(page).waitFor({ timeout: 15000 })
    await page.waitForFunction(
      n => /\((\d+) não lidos\)/.exec(document.querySelector('.av-sino button.tg')?.getAttribute('aria-label') || '')?.[1] == n,
      antesBia + 1,
      { timeout: 15000 },
    )
    await sino(page).click()
    const painel = page.getByRole('dialog', { name: 'Avisos' })
    const item = painel.locator('.av-item.nao-lido').filter({ hasText: TITULO })
    await item.waitFor({ timeout: 15000 })
    await page.screenshot({ path: `${PRINTS}avisos-26a-2.png` })
  })

  await passo('3. clicar no aviso abre a tarefa e o número cai', async () => {
    const painel = page.getByRole('dialog', { name: 'Avisos' })
    await painel.locator('.av-item').filter({ hasText: TITULO }).click()
    await page.getByRole('dialog', { name: 'Detalhes da tarefa' }).waitFor({ timeout: 15000 })
    exigir(page.url().includes('/tarefas'), `URL: ${page.url()}`)
    const n = await naoLidos(page)
    exigir(n === antesBia, `não lidos depois do clique: ${n}, esperado ${antesBia}`)
    await page.screenshot({ path: `${PRINTS}avisos-26a-3.png` })
    await sair(page)
  })

  await passo('4. Caio entra na mesma aba: sem os avisos da Bia', async () => {
    await entrar(page, ...CAIO)
    await sino(page).waitFor({ timeout: 15000 })
    await page.waitForTimeout(1500)
    await sino(page).click()
    const painel = page.getByRole('dialog', { name: 'Avisos' })
    await painel.waitFor({ timeout: 10000 })
    exigir(!(await painel.getByText(TITULO).count()), 'o painel do Caio mostra a tarefa da Bia')
    await page.keyboard.press('Escape')
  })

  await passo('5. diretora vê "Ocupação da semana" no Dashboard; membro não', async () => {
    await page.goto(`${APP}/#/`)
    await page
      .getByRole('heading', { name: /Dashboard|Início/ })
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => {})
    await page.waitForTimeout(1500)
    exigir(!(await page.getByRole('heading', { name: 'Ocupação da semana' }).count()), 'membro vê Ocupação da semana')
    await sair(page)
    await entrar(page, ...DIRETORA)
    await page.getByRole('heading', { name: 'Ocupação da semana' }).waitFor({ timeout: 15000 })
    await page.screenshot({ path: `${PRINTS}avisos-26a-5.png`, fullPage: true })
    await sair(page)
  })

  await passo('6. celular 375 px escuro: painel em tela cheia', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 760 }, colorScheme: 'dark' })
    const p = await ctx2.newPage()
    paginaAtual = p
    p.on('pageerror', e => errosConsole.push(e.message))
    await entrar(p, ...INES)
    await sino(p).click()
    const painel = p.getByRole('dialog', { name: 'Avisos' })
    await painel.waitFor({ timeout: 10000 })
    const caixa = await painel.boundingBox()
    exigir(caixa.width >= 370 && caixa.height >= 750, `painel ${caixa.width}x${caixa.height}, esperado tela cheia`)
    exigir(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'rolagem horizontal')
    await p.screenshot({ path: `${PRINTS}avisos-26a-6.png` })
    await p.getByRole('button', { name: 'Fechar avisos' }).click()
    await painel.waitFor({ state: 'detached', timeout: 5000 })
    await ctx2.close()
  })
} finally {
  await browser?.close()
  try {
    for (const p of await api('GET', '/projetos')) {
      for (const t of await api('GET', `/tarefas?codigoProjeto=${p.codigo}`)) {
        if (t.titulo === TITULO) await api('DELETE', `/tarefas/${t.codigo}`)
      }
    }
  } catch (e) {
    console.log(`limpeza: ${e.message}`)
  }
}
if (errosConsole.length) {
  console.log(`Erros de console (${errosConsole.length}):\n  ${errosConsole.slice(0, 5).join('\n  ')}`)
  falhou = true
}
process.exit(falhou ? 1 : 0)
