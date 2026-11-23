#!/usr/bin/env node
/**
 * Perfil obrigatório (sessão 25b), ponta a ponta, tudo pela tela (o banco só prepara e restaura):
 *   1. Paula (pendente) entra e cai em "Complete seu perfil"; abrir /projetos pela URL volta para lá
 *   2. ingresso digitado 20251 vira 2025/1; salvar sem agenda não deixa (aviso) e segue na tela
 *   3. preenche tudo e salva: vai ao início; F5 segue no sistema
 *   4. sai e entra como pessoa completa (Bia): direto ao início, sem a tela de completar
 *   5. 375 px, escuro: a tela de completar sem rolagem lateral
 *
 * Pré-requisitos: dados fictícios no backend de dev, banco na porta 5434:
 *   APP_URL=http://localhost:5173 node e2e/perfil-obrigatorio.mjs
 * No início e no fim a Paula volta a ficar pendente (limpa os 5 campos obrigatórios direto no banco de dev).
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const DB_CONTAINER = process.env.DB_CONTAINER || 'konvex-dev-db-1'
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex@123'
const PAULA = ['paula@dev.konvex', SENHA]
const BIA = ['bia@dev.konvex', SENHA]

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

const sql = comando =>
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d konvex_dev -v ON_ERROR_STOP=1 -c "${comando}"`).toString()
const deixarPaulaPendente = () =>
  sql(
    "UPDATE usuarios SET curso=NULL, telefone=NULL, email_pessoal=NULL, ingresso=NULL, calendario_url=NULL WHERE email='paula@dev.konvex'",
  )

let paginaAtual
let falhou = false
async function passo(nome, fn) {
  if (falhou) return console.log(`PULADO ${nome}`)
  try {
    await fn()
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    await paginaAtual?.screenshot({ path: `${PRINTS}perfil-obrigatorio-falha.png` }).catch(() => {})
    console.log(`FALHA  ${nome}\n       ${e.message.split('\n').slice(0, 14).join('\n       ')}`)
  }
}
const exigir = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const SAIR = '[aria-label="Sair"]'
const TITULO = 'Complete seu perfil'
const campo = (page, rotulo) => page.locator('label').filter({ hasText: new RegExp(`^${rotulo}`) })
const semRolagemLateral = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
async function login(page, [email, senha]) {
  await page.goto(`${APP}/#/login`)
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', senha)
  await page.press('input[type=password]', 'Enter')
}

const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
const errosConsole = []
let browser
try {
  deixarPaulaPendente()
  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  paginaAtual = page
  page.on('console', m => m.type() === 'error' && !/401|403|404/.test(m.text()) && errosConsole.push(m.text()))
  page.on('pageerror', e => errosConsole.push(e.message))
  const titulo = page.getByRole('heading', { name: TITULO })

  await passo('1. Paula pendente cai em "Complete seu perfil" e a URL de outra tela volta', async () => {
    await login(page, PAULA)
    await titulo.waitFor({ timeout: 15000 })
    exigir(page.url().includes('/completar-perfil'), `url inesperada ${page.url()}`)
    await page.goto(`${APP}/#/projetos`)
    await titulo.waitFor({ timeout: 15000 })
    exigir(page.url().includes('/completar-perfil'), `não voltou: ${page.url()}`)
    exigir((await page.locator(SAIR).count()) === 0, 'menu apareceu na tela de completar')
    await page.screenshot({ path: `${PRINTS}perfil-obrigatorio-1-completar.png` })
  })

  await passo('2. ingresso 20251 vira 2025/1; sem agenda não deixa', async () => {
    await campo(page, 'Curso').locator('select').selectOption({ label: 'Engenharia Mecânica' })
    await campo(page, 'Telefone').locator('input').fill('11987654321')
    exigir((await campo(page, 'Telefone').locator('input').inputValue()) === '(11) 98765-4321', 'máscara do telefone')
    await campo(page, 'E-mail pessoal').locator('input').fill('paula@gmail.com')
    await campo(page, 'Ingresso na faculdade').locator('input').fill('20251')
    exigir((await campo(page, 'Ingresso na faculdade').locator('input').inputValue()) === '2025/1', 'máscara do ingresso')
    await page.getByRole('button', { name: 'Salvar e continuar' }).click()
    await page.getByText('Link da agenda inválido').waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Entendi' }).click()
    exigir(page.url().includes('/completar-perfil'), 'saiu da tela sem agenda')
  })

  await passo('3. preenche tudo, vai ao início e F5 segue no sistema', async () => {
    await campo(page, 'Link da agenda').locator('input').fill('https://cal.com/paula')
    await page.getByRole('button', { name: 'Salvar e continuar' }).click()
    await page.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
    exigir(!page.url().includes('/completar-perfil'), 'continuou na tela de completar')
    await page.reload()
    await page.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
    exigir(!page.url().includes('/completar-perfil'), 'F5 voltou para completar')
    const linha = sql("SELECT ingresso || '|' || curso FROM usuarios WHERE email='paula@dev.konvex'")
    exigir(linha.includes('2025/1|Engenharia Mecânica'), `banco: ${linha}`)
  })

  await passo('4. sai e entra como pessoa completa: direto ao início', async () => {
    await page.click(SAIR)
    await page.click('.swal2-confirm') // confirma a saída (27c)
    await page.waitForSelector('input[type=email]', { timeout: 15000 })
    await login(page, BIA)
    await page.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
    exigir(!page.url().includes('/completar-perfil'), 'Bia caiu na tela de completar')
    exigir((await titulo.count()) === 0, 'título de completar apareceu para a Bia')
  })

  await passo('5. celular escuro: tela de completar sem rolagem lateral', async () => {
    deixarPaulaPendente()
    const m = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme: 'dark', isMobile: true, hasTouch: true })
    await m.addInitScript(() => localStorage.setItem('tema', 'dark'))
    const p = await m.newPage()
    paginaAtual = p
    await login(p, PAULA)
    await p.getByRole('heading', { name: TITULO }).waitFor({ timeout: 15000 })
    exigir((await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'tema escuro não ligou')
    exigir(await semRolagemLateral(p), 'rolagem lateral')
    await p.screenshot({ path: `${PRINTS}perfil-obrigatorio-5-375.png`, fullPage: true })
  })
} finally {
  await browser?.close()
  try {
    deixarPaulaPendente()
  } catch (e) {
    console.log('FALHA na limpeza:', e.message)
  }
}

if (errosConsole.length) {
  console.log(`erros no console (${errosConsole.length}):`)
  for (const e of [...new Set(errosConsole)].slice(0, 5)) console.log('  ' + e)
}
console.log(falhou ? '\nFALHOU' : '\nTodos os passos ok')
process.exit(falhou ? 1 : 0)
