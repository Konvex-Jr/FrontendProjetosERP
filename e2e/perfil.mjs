#!/usr/bin/env node
/**
 * Foto e links do perfil, ponta a ponta, no navegador (tudo pela tela; a API só prepara, confere e desfaz).
 *
 *   a. Bia envia uma foto pela tela (PNG gerado aqui) e vê a foto no topo e no próprio perfil
 *   b. num projeto de que Bia participa, a foto aparece na equipe
 *   c. Bia preenche LinkedIn, GitHub e Google Agenda e vê os três cartões com logo
 *   d. troca de conta na mesma aba: Caio entra e o topo mostra as iniciais dele, sem a foto de Bia
 *   e. Bia volta e remove a foto: topo e perfil voltam às iniciais
 *   f. celular (375 px): cartões dos links um por linha, sem rolagem lateral
 *   g. navegador sem WebP no canvas (como Safari e iPhone): a foto sai em JPEG e o servidor converte
 *
 * Ao final devolve os links de Bia e tira a foto: pode rodar de novo.
 * Pré-requisitos como no `levantamento.mjs` (API de dev com dados fictícios, frontend no ar, Playwright):
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/perfil.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex@123'
const A = 'bia@dev.konvex'
const B = 'caio@dev.konvex'
const LINKS = {
  linkedinUrl: 'https://www.linkedin.com/in/bia-e2e/',
  githubUrl: 'https://github.com/bia-e2e',
  calendarioUrl: 'https://calendar.app.google/e2e',
}

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

// ---------- API (só preparação, conferência e limpeza) ----------
async function api(metodo, caminho, corpo, token) {
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
const entrarApi = async (email, senha) => (await api('POST', '/auth/login', { email, senha })).token

// ---------- passos ----------
let paginaAtual
const resultado = []
let falhou = false
async function passo(nome, fn) {
  if (falhou) return resultado.push(['PULADO', nome])
  try {
    await fn()
    resultado.push(['ok', nome])
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    await paginaAtual?.screenshot({ path: `${PRINTS}perfil-falha.png` }).catch(() => {})
    resultado.push(['FALHA', nome, e.message])
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
const avatarDoTopo = page => page.locator('.hd .av[title="Meu perfil"]')
const fotoNoTopo = page => avatarDoTopo(page).locator('img[src*="/fotos/"]')
async function abrirMeuPerfil(page) {
  await avatarDoTopo(page).click()
  await page.waitForSelector('.av.big', { timeout: 15000 })
}
// Espera a imagem carregar de verdade (naturalWidth > 0): `<img>` quebrado cai nas iniciais.
const fotoCarregada = async (loc, msg) => {
  await loc
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {})
  exigir(await loc.count(), msg)
  await loc.first().evaluate(img => img.complete || new Promise(r => (img.onload = r)))
  exigir(await loc.first().evaluate(img => img.naturalWidth === 256), `${msg} (a imagem não carregou em 256 px)`)
}

// PNG 600×400 gerado no próprio navegador (sem arquivo no repositório).
const gerarPng = page =>
  page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 600
    c.height = 400
    const g = c.getContext('2d')
    g.fillStyle = '#0e2340'
    g.fillRect(0, 0, 600, 400)
    g.fillStyle = '#ff6a33'
    g.beginPath()
    g.arc(300, 200, 120, 0, Math.PI * 2)
    g.fill()
    return c.toDataURL('image/png').split(',')[1]
  })

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
const tokenA = await entrarApi(A, SENHA)
const eu = await api('GET', '/auth/me', null, tokenA)
const usuarioA = eu.usuario || eu
const linksAntes = {
  linkedinUrl: usuarioA.linkedinUrl ?? null,
  githubUrl: usuarioA.githubUrl ?? null,
  calendarioUrl: usuarioA.calendarioUrl ?? null,
}
const projetoDeA = (await api('GET', '/projetos', null, tokenA)).find(
  p => p.status !== 'concluido' && (p.membros || []).some(m => (m.codigo || m.codigoUsuario || m) === usuarioA.codigo),
)
exigir(projetoDeA, `${A} não participa de nenhum projeto: rode antes npm run dados:ficticios (no backend)`)
if (usuarioA.foto) await api('DELETE', '/auth/foto', null, tokenA)

let browser
const errosConsole = []
const nova = async opcoes => {
  const ctx = await browser.newContext(opcoes)
  const page = await ctx.newPage()
  paginaAtual = page
  page.on('console', m => m.type() === 'error' && errosConsole.push(m.text()))
  page.on('pageerror', e => errosConsole.push(e.message))
  return page
}

try {
  browser = await chromium.launch()
  const page = await nova({ viewport: { width: 1366, height: 900 } })
  await entrar(page, A, SENHA)

  await passo('a. envia a foto pela tela e vê no topo e no perfil', async () => {
    exigir(!(await fotoNoTopo(page).count()), 'o topo já mostra uma foto antes do envio')
    await abrirMeuPerfil(page)
    await page.getByRole('button', { name: 'Trocar foto' }).first().click()
    const png = Buffer.from(await gerarPng(page), 'base64')
    await page.setInputFiles('.modal input[type=file]', { name: 'foto.png', mimeType: 'image/png', buffer: png })
    await page.waitForSelector('.foto-previa img')
    await page.locator('.modal input[type=range]').fill('1.5')
    await page.locator('.modal').getByRole('button', { name: 'Salvar' }).click()
    await page.waitForSelector('.modal', { state: 'detached', timeout: 15000 })
    await fotoCarregada(fotoNoTopo(page), 'o topo não mostra a foto depois do envio')
    await fotoCarregada(page.locator('.av.big img[src*="/fotos/"]'), 'o perfil não mostra a foto')
    await page.screenshot({ path: `${PRINTS}perfil-a.png` })
  })

  await passo('b. a foto aparece na equipe do projeto', async () => {
    await page.goto(`${APP}/#/projetos/${projetoDeA.codigo}`)
    await fotoCarregada(page.locator(`main .av img[alt="${usuarioA.nome}"]`), 'a equipe do projeto não mostra a foto')
  })

  await passo('c. preenche os três links e vê os cartões com logo', async () => {
    await abrirMeuPerfil(page)
    await page.getByRole('button', { name: 'Editar meus dados' }).click()
    await page.getByLabel('LinkedIn (link)').fill(LINKS.linkedinUrl)
    await page.getByLabel('GitHub (link)').fill(LINKS.githubUrl)
    await page.getByLabel('Calendário (link)').fill(LINKS.calendarioUrl)
    await page.locator('.modal').getByRole('button', { name: 'Salvar' }).click()
    await page.waitForSelector('.modal', { state: 'detached', timeout: 15000 })
    const cartoes = page.locator('.links-perfil .link-perfil')
    await cartoes.nth(2).waitFor({ timeout: 15000 })
    const rotulos = (await cartoes.locator('b').allTextContents()).map(s => s.trim())
    exigir(JSON.stringify(rotulos) === '["LinkedIn","GitHub","Google Agenda"]', `cartões: ${rotulos.join(', ')}`)
    exigir((await cartoes.locator('.logo-marca svg').count()) === 3, 'falta logo em algum cartão')
    exigir((await cartoes.first().getAttribute('href')) === LINKS.linkedinUrl, 'link do LinkedIn errado')
    exigir((await cartoes.first().getAttribute('target')) === '_blank', 'o cartão não abre em nova aba')
    exigir((await cartoes.first().getAttribute('rel')) === 'noreferrer', 'o cartão não tem rel=noreferrer')
    exigir((await cartoes.first().locator('small').textContent()) === 'linkedin.com/in/bia-e2e', 'texto do LinkedIn não foi encurtado')
    await page.screenshot({ path: `${PRINTS}perfil-c.png` })
  })

  await passo('d. troca de conta na mesma aba: Caio não vê a foto de Bia no topo', async () => {
    await sair(page)
    await entrar(page, B, SENHA)
    await page.waitForTimeout(500)
    exigir(!(await fotoNoTopo(page).count()), 'o topo de Caio mostra uma foto')
    const iniciais = (await avatarDoTopo(page).textContent()).trim()
    exigir(iniciais.startsWith('C'), `o topo de Caio mostra "${iniciais}"`)
    await abrirMeuPerfil(page)
    exigir(!(await page.locator('.av.big img').count()), 'o perfil de Caio mostra uma foto')
    exigir(!(await page.locator('.links-perfil').count()) || !(await page.getByText('bia-e2e').count()), 'Caio vê os links de Bia')
  })

  await passo('e. Bia volta e remove a foto: volta às iniciais', async () => {
    await sair(page)
    await entrar(page, A, SENHA)
    await fotoCarregada(fotoNoTopo(page), 'o topo de Bia não mostra a foto ao voltar')
    await abrirMeuPerfil(page)
    await page.getByRole('button', { name: 'Remover foto' }).click()
    await page.waitForSelector('.swal2-popup')
    await page.click('.swal2-confirm')
    await page.locator('.av.big img').waitFor({ state: 'detached', timeout: 15000 })
    await fotoNoTopo(page).waitFor({ state: 'detached', timeout: 15000 })
    exigir(!(await page.getByRole('button', { name: 'Remover foto' }).count()), '"Remover foto" segue na tela sem foto')
  })

  await passo('f. celular (375 px): um cartão por linha, sem rolagem lateral', async () => {
    const m = await nova({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true })
    await entrar(m, A, SENHA)
    await m.goto(`${APP}/#/perfil`)
    const cartoes = m.locator('.links-perfil .link-perfil')
    await cartoes.nth(2).waitFor({ timeout: 15000 })
    const caixas = await cartoes.evaluateAll(l => l.map(e => e.getBoundingClientRect().top))
    exigir(new Set(caixas).size === 3, 'os cartões não ficam um por linha')
    const sobra = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    exigir(sobra <= 0, `a página rola na horizontal (${sobra} px)`)
    await m.screenshot({ path: `${PRINTS}perfil-f.png` })
  })

  await passo('g. navegador sem WebP no canvas (Safari): envia JPEG e a foto aparece', async () => {
    const s = await nova({ viewport: { width: 1366, height: 900 } })
    // Como o WebKit: pedir WebP ao canvas devolve PNG.
    await s.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (cb, tipo, q) {
        return original.call(this, cb, tipo === 'image/webp' ? 'image/png' : tipo, q)
      }
    })
    const enviados = []
    s.on('request', r => r.url().endsWith('/auth/foto') && r.method() === 'PUT' && enviados.push(r.headers()['content-type']))
    await entrar(s, A, SENHA)
    await abrirMeuPerfil(s)
    await s.getByRole('button', { name: 'Trocar foto' }).first().click()
    const png = Buffer.from(await gerarPng(s), 'base64')
    await s.setInputFiles('.modal input[type=file]', { name: 'foto.png', mimeType: 'image/png', buffer: png })
    await s.waitForSelector('.foto-previa img')
    await s.locator('.modal').getByRole('button', { name: 'Salvar' }).click()
    await s.waitForSelector('.modal', { state: 'detached', timeout: 15000 })
    exigir(enviados[0] === 'image/jpeg', `o envio foi ${enviados[0]}, não image/jpeg`)
    await fotoCarregada(s.locator('.av.big img[src*="/fotos/"]'), 'o perfil não mostra a foto enviada em JPEG')
  })
} catch (e) {
  falhou = true
  resultado.push(['FALHA', 'preparação do navegador', e.message])
  console.log('FALHA preparação:', e.message)
} finally {
  await browser?.close().catch(() => {})
  // Limpeza: devolve os links de Bia e tira a foto, se sobrou.
  try {
    const token = await entrarApi(A, SENHA)
    await api('PUT', '/auth/perfil', linksAntes, token)
    const agora = await api('GET', '/auth/me', null, token)
    if ((agora.usuario || agora).foto) await api('DELETE', '/auth/foto', null, token)
    console.log('limpeza: links devolvidos, sem foto')
  } catch (e) {
    falhou = true
    console.log('FALHA na limpeza:', e.message)
  }
}

if (errosConsole.length) {
  console.log(`erros no console (${errosConsole.length}):`)
  for (const e of [...new Set(errosConsole)].slice(0, 5)) console.log('  ' + e)
}
console.log(falhou ? '\nFALHOU' : '\nTodos os passos ok')
process.exit(falhou ? 1 : 0)
