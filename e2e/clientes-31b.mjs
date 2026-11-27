#!/usr/bin/env node
/**
 * Clientes, classe, contrato e cartão (sessão 31b), ponta a ponta pela tela (a API só confere e limpa).
 *
 *   1. presidente cria pela tela o projeto "Loja Aurora (e2e)" (classe CRM, área Projetos, Bia na equipe)
 *      com dois clientes; a Visão geral mostra o telefone e o e-mail
 *   2. troca de conta na mesma aba (presidente -> Gabi, gerente de projetos, sem clientes.ver): abre o projeto
 *      (área dela), vê nome e empresa dos clientes, nenhum telefone; o formulário de edição não tem Clientes
 *   3. troca para Caio (fora da equipe): cartão com classe e %, sem o texto antigo e sem clientes
 *   4. presidente cria na Biblioteca o "Contrato Loja Aurora (e2e)" com sigilo "Só diretoria";
 *      Gabi não vê o item nem a opção "Só diretoria"
 *   5. presidente: Configurações → Classes de projeto lista as classes e cria/renomeia "ERP (e2e)"
 *   6. celular (375 px), tema escuro: formulário com clientes sem rolagem lateral
 *
 * Pré-requisitos: dados fictícios (npm run dados:ficticios no backend) e Playwright à parte:
 *   NODE_PATH=<pasta>/node_modules API_URL=http://localhost:5002 APP_URL=http://localhost:4173 node e2e/clientes-31b.mjs
 * Ao final apaga o projeto e o item criados (pela API).
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex@123'
const PRESIDENTE = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const GABI = ['gabi@dev.konvex', SENHA]
const CAIO = ['caio@dev.konvex', SENHA]
const PROJETO = 'Loja Aurora (e2e)'
const CONTRATO = 'Contrato Loja Aurora (e2e)'
const CLASSE = 'ERP (e2e)'
const HOJE = new Date().toISOString().slice(0, 10)
const FIM = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

let tokenPres
async function api(metodo, caminho, corpo, token = tokenPres) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'access-token': token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${texto}`)
  return texto ? JSON.parse(texto) : null
}

let paginaAtual
let falhou = false
const passo = async (nome, fn) => {
  if (falhou) return console.log(`PULADO ${nome}`)
  try {
    await fn()
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    await paginaAtual?.screenshot({ path: `${PRINTS}clientes-31b-falha.png` }).catch(() => {})
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
async function trocar(page, [email, senha]) {
  await page.click('[aria-label="Sair"]')
  await page.click('.swal2-confirm')
  await page.waitForSelector('input[type=email]', { timeout: 15000 })
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', senha)
  await page.press('input[type=password]', 'Enter')
  await page.waitForSelector('[aria-label="Sair"]', { state: 'attached', timeout: 15000 })
}
const janela = page => page.locator('.modal.d-block form')
const campo = (dlg, rotulo) =>
  dlg
    .locator('label')
    .filter({ hasText: new RegExp(`^${rotulo}`) })
    .locator('select, input, textarea')
    .first()
async function abrirProjetos(page) {
  await page.locator('#menu a[aria-label="Projetos"]').click()
  await page.getByRole('heading', { name: 'Projetos' }).first().waitFor({ timeout: 15000 })
  await page.getByLabel('Grupo de projetos').selectOption('')
}
async function abrirVisaoGeral(page) {
  await abrirProjetos(page)
  await page
    .locator('.card.pj')
    .filter({ has: page.getByRole('heading', { name: PROJETO, exact: true }) })
    .click()
  await page.getByRole('heading', { name: PROJETO }).first().waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
}

async function limpar() {
  const projetos = await api('GET', '/projetos?busca=aurora')
  for (const p of projetos.filter(x => x.nome === PROJETO)) await api('DELETE', `/projetos/${p.codigo}`).catch(() => {})
  const itens = await api('GET', '/biblioteca')
  for (const i of itens.filter(x => x.titulo === CONTRATO)) await api('DELETE', `/biblioteca/${i.codigo}`).catch(() => {})
}

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenPres = (await api('POST', '/auth/login', { email: PRESIDENTE[0], senha: PRESIDENTE[1] }, null)).token
await limpar()
const bia = (await api('GET', '/usuarios')).find(u => u.email === 'bia@dev.konvex')
if (!bia) throw new Error('Rode antes: npm run dados:ficticios (no backend)')

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = (paginaAtual = await ctx.newPage())

  await passo('1. presidente cria o projeto com classe e dois clientes; Visão geral mostra os contatos', async () => {
    await entrar(page, ...PRESIDENTE)
    await abrirProjetos(page)
    await page.getByRole('button', { name: 'Novo projeto' }).click()
    const dlg = janela(page)
    await campo(dlg, 'Nome').fill(PROJETO)
    await campo(dlg, 'Classe').selectOption({ label: 'CRM' })
    await campo(dlg, 'Descrição').fill('Projeto do e2e da 31b.')
    await campo(dlg, 'Início').fill(HOJE)
    await campo(dlg, 'Fim').fill(FIM)
    await campo(dlg, 'Área').selectOption({ label: 'Projetos' })
    await campo(dlg, 'Líder').selectOption({ label: bia.nome })
    await dlg.getByRole('button', { name: 'Adicionar cliente' }).click()
    await dlg.getByLabel('Nome do cliente 1').fill('Ana Souza')
    await dlg.getByLabel('Empresa do cliente 1').fill('Padaria Sol')
    await dlg.getByLabel('Telefone do cliente 1').fill('34999991111')
    await dlg.getByLabel('E-mail do cliente 1').fill('ana@padariasol.com')
    await dlg.getByRole('button', { name: 'Adicionar cliente' }).click()
    await dlg.getByLabel('Nome do cliente 2').fill('Bruno Lima')
    await dlg.getByRole('button', { name: 'Salvar' }).click()
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    await page.getByRole('heading', { name: PROJETO }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
    const geral = page.locator('main')
    await geral.getByText('(34) 99999-1111').waitFor({ timeout: 15000 })
    exigir(await geral.getByText('ana@padariasol.com').count(), 'Visão geral sem o e-mail do cliente')
    exigir(await geral.getByText('Bruno Lima').count(), 'Visão geral sem o segundo cliente')
    exigir(await geral.getByText('CRM', { exact: true }).count(), 'Visão geral sem a classe')
    const criado = (await api('GET', '/projetos?busca=aurora')).find(p => p.nome === PROJETO)
    exigir(criado?.classe?.codigo === 'crm' && criado.clientes.length === 2, `API: ${JSON.stringify(criado?.clientes)}`)
    await page.screenshot({ path: `${PRINTS}clientes-31b-1.png` })
  })

  await passo('2. Gabi (sem clientes.ver), mesma aba: nome e empresa, sem telefone; edição sem Clientes', async () => {
    await trocar(page, GABI)
    await abrirVisaoGeral(page)
    const geral = page.locator('main')
    await geral.getByText('Ana Souza').waitFor({ timeout: 15000 })
    exigir(await geral.getByText('Padaria Sol').count(), 'Gabi não vê a empresa')
    exigir(!(await geral.getByText('99999').count()), 'Gabi vê o telefone do cliente')
    exigir(!(await geral.getByText('padariasol.com').count()), 'Gabi vê o e-mail do cliente')
    await page
      .getByRole('button', { name: /Editar/ })
      .first()
      .click()
    await janela(page).waitFor({ timeout: 15000 })
    exigir(!(await janela(page).getByRole('button', { name: 'Adicionar cliente' }).count()), 'Gabi vê o campo Clientes')
    await janela(page).getByRole('button', { name: 'Salvar' }).click()
    await janela(page).waitFor({ state: 'detached', timeout: 15000 })
    const depois = (await api('GET', '/projetos?busca=aurora')).find(p => p.nome === PROJETO)
    exigir(depois.clientes.length === 2, 'salvar como Gabi apagou os clientes')
  })

  await passo('3. Caio (fora da equipe): cartão com classe e %, sem o texto antigo nem clientes', async () => {
    await trocar(page, CAIO)
    await abrirProjetos(page)
    const c = page.locator('.pj-cartao').filter({ has: page.getByRole('heading', { name: PROJETO, exact: true }) })
    await c.waitFor({ timeout: 15000 })
    const texto = await c.innerText()
    exigir(/CRM/.test(texto), `cartão sem a classe: ${texto}`)
    exigir(/0%/.test(texto), `cartão sem o %: ${texto}`)
    exigir(!/Os detalhes/.test(texto), `cartão com o texto antigo: ${texto}`)
    exigir(!/Ana Souza|Padaria/.test(texto), `cartão mostra cliente: ${texto}`)
  })

  await passo('4. contrato "Só diretoria": presidente cria; Gabi não vê o item nem a opção', async () => {
    await trocar(page, PRESIDENTE)
    await page.locator('#menu a[aria-label="Biblioteca"]').click()
    await page.getByRole('heading', { name: 'Biblioteca' }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: /Novo item/ }).click()
    const dlg = janela(page)
    await campo(dlg, 'Título').fill(CONTRATO)
    await campo(dlg, 'Quem vê').selectOption({ label: 'Só diretoria' })
    await campo(dlg, 'Texto').fill('Contrato assinado (e2e).')
    await dlg.getByRole('button', { name: 'Salvar' }).click()
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    const item = (await api('GET', '/biblioteca')).find(i => i.titulo === CONTRATO)
    exigir(item?.sigilo === 'diretoria', `API: sigilo ${item?.sigilo}`)
    await trocar(page, GABI)
    await page.locator('#menu a[aria-label="Biblioteca"]').click()
    await page.getByRole('heading', { name: 'Biblioteca' }).first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(800)
    exigir(!(await page.getByText(CONTRATO).count()), 'Gabi vê o contrato')
    await page.getByRole('button', { name: /Novo item/ }).click()
    const opcoes = await campo(janela(page), 'Quem vê').locator('option').allInnerTexts()
    exigir(!opcoes.includes('Só diretoria'), `Gabi tem a opção Só diretoria: ${opcoes}`)
    await janela(page).getByRole('button', { name: 'Cancelar' }).click()
  })

  await passo('5. presidente: Configurações → Classes de projeto cria ou renomeia "ERP (e2e)"', async () => {
    await trocar(page, PRESIDENTE)
    await page.click('[aria-label="Configurações"]')
    await page.getByRole('button', { name: 'Classes de projeto', exact: true }).click()
    await page.getByRole('cell', { name: 'Landing page', exact: true }).waitFor({ timeout: 15000 })
    const existe = await page.getByRole('cell', { name: CLASSE, exact: true }).count()
    if (existe) {
      await page
        .getByRole('row')
        .filter({ hasText: CLASSE })
        .getByRole('button', { name: /Editar/ })
        .click()
    } else {
      await page.getByRole('button', { name: /Novo item/ }).click()
    }
    await campo(janela(page), 'Nome').fill(CLASSE)
    await janela(page).getByRole('button', { name: 'Salvar' }).click()
    await page.getByText('Classe salva').first().waitFor({ timeout: 15000 })
    exigir(
      (await api('GET', '/classes-projeto')).some(c => c.nome === CLASSE),
      'API sem a classe nova',
    )
  })

  await passo('6. celular (375 px), escuro: formulário com clientes sem rolagem lateral', async () => {
    const cel = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme: 'dark' })
    const p2 = (paginaAtual = await cel.newPage())
    await entrar(p2, ...PRESIDENTE)
    await abrirVisaoGeral(p2)
    await p2
      .getByRole('button', { name: /Editar/ })
      .first()
      .click()
    await janela(p2).getByLabel('Nome do cliente 1').waitFor({ timeout: 15000 })
    const larg = await p2.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    exigir(larg[0] <= larg[1], `rolagem lateral: ${larg}`)
    await p2.waitForTimeout(600)
    await p2.screenshot({ path: `${PRINTS}clientes-31b-375.png` })
    await cel.close()
  })
} finally {
  await browser.close()
  await limpar().catch(e => console.log('limpeza:', e.message))
}
process.exit(falhou ? 1 : 0)
