#!/usr/bin/env node
/**
 * Áreas e cargos por período (sessão 23a), ponta a ponta, tudo pela tela (a API só prepara, confere e desfaz).
 *
 *   a. diretora marca "Lidera a área" no cargo Assessor (Configurações › Cargos)
 *   b. gerente (Inês) abre o perfil da Bia, adiciona Inovação · Gerente com início no ano passado
 *      e encerra o período atual em Execução
 *   c. data no futuro: o campo recusa e a janela continua aberta
 *   d. a lista de Pessoas mostra o selo "Inovação · Gerente" da Bia, e o filtro por área acha ela
 *   e. troca de conta na mesma aba: Bia vê as próprias áreas sem os botões da gestão
 *   f. celular (375 px), tema escuro: a seção cabe na tela, sem rolagem lateral
 *
 * Ao final devolve tudo como estava: pode rodar de novo.
 * Pré-requisitos como no `levantamento.mjs` (API de dev com dados fictícios, frontend no ar, Playwright):
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/areas.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex123'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']

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

// ---------- passos ----------
let paginaAtual
let falhou = false
async function passo(nome, fn) {
  if (falhou) return console.log(`PULADO ${nome}`)
  try {
    await fn()
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    await paginaAtual?.screenshot({ path: `${PRINTS}areas-falha.png` }).catch(() => {})
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
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
const HOJE = iso(new Date())
const AMANHA = iso(new Date(Date.now() + 864e5))
const ANO_PASSADO = `${new Date().getFullYear() - 1}-03-01`

const secao = page => page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Áreas e cargos' }) })
const linhaPeriodo = (page, rotulo) => secao(page).locator('.ag.periodo').filter({ hasText: rotulo })
const janela = page => page.locator('.modal.d-block form')
// Campo da janela pelo começo do rótulo (as dicas abaixo do campo também citam "área").
const campo = (page, rotulo) =>
  janela(page)
    .locator('label')
    .filter({ hasText: new RegExp(`^${rotulo}`) })
    .locator('select, input')
const salvarJanela = async page => {
  await janela(page).getByRole('button', { name: 'Salvar' }).click()
  await janela(page).waitFor({ state: 'detached', timeout: 15000 })
}
async function abrirPerfil(page, codigo) {
  await page.goto(`${APP}/#/perfil/${codigo}`)
  await secao(page).waitFor({ timeout: 15000 })
}

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenDir = await entrarApi(...DIRETORA)

const pessoas = await api('GET', '/usuarios')
const bia = pessoas.find(p => p.email === 'bia@dev.konvex')
const areas = await api('GET', '/areas')
const inovacao = areas.find(a => a.nome === 'Inovação')
const cargos = await api('GET', '/cargos')
const assessor = cargos.find(c => c.nome === 'Assessor')
const gerente = cargos.find(c => c.nome === 'Gerente')
if (!bia || !inovacao || !assessor || !gerente) throw new Error('Rode antes: npm run dados:ficticios (no backend)')

// Retrato para devolver como estava.
const periodosAntes = await api('GET', `/usuarios/${bia.codigo}/periodos`)
const execucaoAntes = periodosAntes.find(p => !p.fim && p.area.nome === 'Execução')
if (!execucaoAntes || periodosAntes.some(p => p.area.codigo === inovacao.codigo))
  throw new Error('Bia precisa estar só em Execução, sem Inovação (dados fictícios); limpe os períodos de teste antes')
const assessorAntes = { nome: assessor.nome, ativo: assessor.ativo, lideraArea: assessor.lideraArea }

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
  const page = await nova({ viewport: { width: 1280, height: 900 } })

  await passo('a. diretora marca "Lidera a área" no cargo Assessor', async () => {
    await entrar(page, ...DIRETORA)
    await page.goto(`${APP}/#/configuracoes`)
    await page.getByRole('button', { name: 'Cargos', exact: true }).click()
    const linha = page.locator('tr').filter({ has: page.getByText('Assessor', { exact: true }) })
    await linha.getByRole('button', { name: 'Editar' }).click()
    await campo(page, 'Lidera a área').selectOption('true')
    await salvarJanela(page)
    await linha.getByText('Sim', { exact: true }).waitFor({ timeout: 15000 })
    const depois = (await api('GET', '/cargos')).find(c => c.codigo === assessor.codigo)
    exigir(depois.lideraArea === true, 'API não gravou lideraArea')
    await page.screenshot({ path: `${PRINTS}areas-a.png` })
    await sair(page)
  })

  await passo('b. gerente adiciona Inovação · Gerente (ano passado) e encerra Execução no perfil da Bia', async () => {
    await entrar(page, 'ines@dev.konvex', SENHA)
    await abrirPerfil(page, bia.codigo)
    await secao(page).getByRole('button', { name: 'Adicionar período' }).click()
    await campo(page, 'Área').selectOption({ label: 'Inovação' })
    await campo(page, 'Cargo').selectOption({ label: 'Gerente' })
    await campo(page, 'Início').fill(ANO_PASSADO)
    await salvarJanela(page)
    await linhaPeriodo(page, 'Inovação · Gerente').waitFor({ timeout: 15000 })

    await linhaPeriodo(page, 'Execução').getByRole('button', { name: 'Encerrar' }).click()
    exigir((await campo(page, 'Saiu da área em').inputValue()) === HOJE, 'data padrão do encerrar não é hoje')
    await salvarJanela(page)
    await linhaPeriodo(page, 'Execução').filter({ hasText: 'até' }).waitFor({ timeout: 15000 })
    exigir(
      !(await linhaPeriodo(page, 'Execução').getByRole('button', { name: 'Encerrar' }).count()),
      'período encerrado ainda mostra "Encerrar"',
    )
    const api1 = await api('GET', `/usuarios/${bia.codigo}/periodos`)
    exigir(api1.find(p => p.codigo === execucaoAntes.codigo).fim?.slice(0, 10) === HOJE, 'API: Execução não foi encerrada hoje')
    exigir(
      api1.some(p => p.area.codigo === inovacao.codigo && !p.fim && p.cargo?.codigo === gerente.codigo),
      'API: falta Inovação',
    )
    const cabecalho = await page.locator('.card').first().innerText()
    exigir(cabecalho.includes('Inovação · Gerente'), 'cabeçalho do perfil não mostra a área atual')
    await page.screenshot({ path: `${PRINTS}areas-b.png`, fullPage: true })
  })

  await passo('c. data no futuro: o campo recusa e a janela continua aberta', async () => {
    await secao(page).getByRole('button', { name: 'Adicionar período' }).click()
    await campo(page, 'Área').selectOption({ label: 'Projetos' })
    const inicio = campo(page, 'Início')
    await inicio.fill(AMANHA)
    exigir((await inicio.getAttribute('max')) === HOJE, `max do início = ${await inicio.getAttribute('max')}`)
    await janela(page).getByRole('button', { name: 'Salvar' }).click()
    await page.waitForTimeout(500)
    exigir(await janela(page).isVisible(), 'a janela fechou com data no futuro')
    exigir(await inicio.evaluate(el => el.validity.rangeOverflow), 'o campo não acusou a data no futuro')
    await janela(page).getByRole('button', { name: 'Cancelar' }).click()
    const api2 = await api('GET', `/usuarios/${bia.codigo}/periodos`)
    exigir(!api2.some(p => p.area.nome === 'Projetos'), 'gravou o período com data no futuro')
  })

  await passo('d. Pessoas mostra o selo e o filtro por área acha a Bia', async () => {
    await page.goto(`${APP}/#/usuarios`)
    const linha = page.locator('tr').filter({ hasText: 'bia@dev.konvex' })
    await linha.locator('.selos-area').getByText('Inovação · Gerente').waitFor({ timeout: 15000 })
    exigir(!(await linha.innerText()).includes('Execução'), 'a lista ainda mostra Execução (encerrada)')
    await page.getByLabel('Filtrar Áreas').selectOption('Inovação')
    const nomes = await page.locator('tbody tr').allInnerTexts()
    exigir(
      nomes.some(t => t.includes('bia@dev.konvex')),
      'filtro Inovação não acha a Bia',
    )
    exigir(
      nomes.every(t => t.includes('Inovação')),
      'filtro Inovação trouxe gente de outra área',
    )
    await page.screenshot({ path: `${PRINTS}areas-d.png` })
  })

  await passo('e. troca de conta na mesma aba: Bia vê as áreas sem botões', async () => {
    await abrirPerfil(page, bia.codigo) // enche a memória da aba com o perfil visto pela gestão
    await sair(page)
    await entrar(page, 'bia@dev.konvex', SENHA)
    await page.goto(`${APP}/#/perfil`)
    await linhaPeriodo(page, 'Inovação · Gerente').waitFor({ timeout: 15000 })
    await page.waitForLoadState('networkidle')
    exigir(!(await secao(page).getByRole('button', { name: 'Adicionar período' }).count()), 'Bia vê "Adicionar período"')
    exigir(!(await secao(page).getByRole('button', { name: 'Encerrar' }).count()), 'Bia vê "Encerrar"')
    exigir(!(await secao(page).locator('.periodo-acoes').count()), 'Bia vê as ações dos períodos')
  })

  await passo('f. celular (375 px), escuro: a seção cabe sem rolagem lateral', async () => {
    const m = await nova({ viewport: { width: 375, height: 800 }, colorScheme: 'dark', isMobile: true, hasTouch: true })
    await m.addInitScript(() => localStorage.setItem('tema', 'dark'))
    await entrar(m, 'ines@dev.konvex', SENHA)
    await abrirPerfil(m, bia.codigo)
    await linhaPeriodo(m, 'Inovação · Gerente').waitFor({ timeout: 15000 })
    const medidas = await m.evaluate(() => ({
      paginaRola: document.documentElement.scrollWidth > window.innerWidth + 1,
      escuro: document.documentElement.dataset.theme === 'dark',
    }))
    exigir(!medidas.paginaRola, 'a página rola na horizontal')
    exigir(medidas.escuro, 'tema escuro não ligou')
    await secao(m).scrollIntoViewIfNeeded()
    await secao(m).screenshot({ path: `${PRINTS}areas-f.png` })
  })
} catch (e) {
  falhou = true
  console.log('FALHA preparação:', e.message)
} finally {
  await browser?.close().catch(() => {})
  // Limpeza: tira os períodos criados, reabre Execução e devolve o cargo Assessor.
  try {
    for (const p of await api('GET', `/usuarios/${bia.codigo}/periodos`))
      if (!periodosAntes.some(x => x.codigo === p.codigo)) await api('DELETE', `/usuarios/${bia.codigo}/periodos/${p.codigo}`)
    await api('PUT', `/usuarios/${bia.codigo}/periodos/${execucaoAntes.codigo}`, {
      codigoArea: execucaoAntes.area.codigo,
      codigoCargo: execucaoAntes.cargo?.codigo ?? null,
      inicio: execucaoAntes.inicio.slice(0, 10),
      fim: null,
    })
    await api('PUT', `/cargos/${assessor.codigo}`, assessorAntes)
    const fim = await api('GET', `/usuarios/${bia.codigo}/periodos`)
    const igual =
      JSON.stringify(fim.map(p => [p.codigo, p.fim])) === JSON.stringify(periodosAntes.map(p => [p.codigo, p.fim])) &&
      (await api('GET', '/cargos')).find(c => c.codigo === assessor.codigo).lideraArea === assessorAntes.lideraArea
    console.log(`limpeza: ${igual ? 'tudo como antes' : 'DIFERENTE do início'}`)
    if (!igual) falhou = true
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
