#!/usr/bin/env node
/**
 * Permissões por cargo (sessão 31a), ponta a ponta, tudo pela tela (a API só confere e desfaz).
 *
 *   1. presidente (conta de dev) abre Configurações → Permissões: a coluna "Presidente" é só leitura;
 *      desliga "Ver Relatórios" do "Gerente de projetos", confirma e salva
 *   2. troca de conta na mesma aba (presidente -> Gabi, gerente de projetos) sem recarregar: menu sem Relatórios,
 *      sem a engrenagem de Configurações
 *   3. Gabi em Projetos: "Site institucional (fictício)" (área Projetos) completo; "Robô" (Inovação) só cartão
 *   4. troca de conta (Gabi -> Inês, gerente de inovação): "Robô" completo; "Site institucional" só cartão
 *   5. presidente religa "Ver Relatórios" do "Gerente de projetos"; Gabi entra na mesma aba e vê Relatórios
 *   6. trainee (Davi): menu sem Biblioteca
 *   7. celular (375 px), tema escuro: a grade vira seletor de cargo e lista, sem rolagem lateral
 *
 * Pré-requisitos: dados fictícios no backend (npm run dados:ficticios) e o Playwright instalado à parte:
 *   NODE_PATH=<pasta>/node_modules API_URL=http://localhost:5002 APP_URL=http://localhost:4173 node e2e/permissoes-31a.mjs
 * Ao final devolve "Ver Relatórios" ao "Gerente de projetos" pela API, se algum passo falhar no meio.
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
const INES = ['ines@dev.konvex', SENHA]
const DAVI = ['davi@dev.konvex', SENHA]
const SITE = 'Site institucional (fictício)'
const ROBO = 'Robô'
const CARGO = 'Gerente de projetos'
const RELATORIOS = 'estrategia.ver'

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
  const json = texto ? JSON.parse(texto) : null
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${texto}`)
  return json
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
    await paginaAtual?.screenshot({ path: `${PRINTS}permissoes-31a-falha.png` }).catch(() => {})
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
  await page.click('.swal2-confirm')
  await page.waitForSelector('input[type=email]', { timeout: 15000 })
}
/** Troca de conta na mesma aba: sai e entra pelo formulário, sem recarregar a página. */
async function trocar(page, [email, senha]) {
  await sair(page)
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', senha)
  await page.press('input[type=password]', 'Enter')
  await page.waitForSelector('[aria-label="Sair"]', { state: 'attached', timeout: 15000 })
}
const menu = async page => page.locator('#menu a[aria-label]').evaluateAll(as => as.map(a => a.getAttribute('aria-label')))

async function abrirPermissoes(page) {
  await page.click('[aria-label="Configurações"]')
  await page.getByRole('heading', { name: 'Configurações' }).first().waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Permissões', exact: true }).click()
  await page.locator('.grade-perm').waitFor({ timeout: 15000 })
}
const caixa = (page, rotulo, cargo) => page.getByRole('checkbox', { name: `${rotulo}: ${cargo}`, exact: true }).first()
const colunaDe = (page, cargo) =>
  page.locator('.grade-perm-tabela thead th').evaluateAll((ths, nome) => ths.findIndex(th => th.textContent.startsWith(nome)), cargo)

async function salvarColuna(page, cargo) {
  const i = await colunaDe(page, cargo)
  exigir(i > 0, `coluna "${cargo}" não encontrada`)
  const botao = page.locator('.grade-perm-tabela tbody tr').last().locator('td').nth(i).getByRole('button', { name: 'Salvar' })
  await botao.click()
}

const cartaoDe = (page, nome) => page.locator('.pj-cartao').filter({ has: page.getByRole('heading', { name: nome, exact: true }) })
const completoDe = (page, nome) => page.locator('.card.pj').filter({ has: page.getByRole('heading', { name: nome, exact: true }) })
/** O projeto aparece só como cartão: sem progresso, sem datas, com líder e equipe, e o clique não abre a ficha (27a/27b). */
async function conferirCartao(page, nome) {
  const c = cartaoDe(page, nome)
  await c.waitFor({ timeout: 15000 })
  exigir(!(await completoDe(page, nome).count()), `"${nome}" aparece completo`)
  const texto = await c.innerText()
  exigir(!/%/.test(texto), `cartão de "${nome}" mostra progresso: ${texto}`)
  exigir(!/\d{2}\/\d{2}\/\d{4}/.test(texto), `cartão de "${nome}" mostra datas: ${texto}`)
  exigir(/Líder/.test(texto) && /Equipe/.test(texto), `cartão de "${nome}" sem líder ou equipe: ${texto}`)
  const antes = page.url()
  await c.getByRole('heading', { name: nome, exact: true }).click()
  await page.waitForTimeout(600)
  exigir(page.url() === antes, `o clique no cartão abriu ${page.url()}`)
}
async function abrirProjetos(page) {
  await page.locator('#menu a[aria-label="Projetos"]').click()
  await page.getByRole('heading', { name: 'Projetos' }).first().waitFor({ timeout: 15000 })
  await page.getByLabel('Grupo de projetos').selectOption('')
}

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenPres = (await api('POST', '/auth/login', { email: PRESIDENTE[0], senha: PRESIDENTE[1] }, null)).token
const grade = await api('GET', '/permissoes')
const gerenteProjetos = grade.colunas.find(c => c.nome === CARGO)
if (!gerenteProjetos || !grade.colunas.some(c => c.nome === 'Presidente')) {
  throw new Error('Rode antes: npm run dados:ficticios (no backend), com o cargo "Gerente de projetos" e o presidente')
}
const permissoesOriginais = gerenteProjetos.permissoes
if (!permissoesOriginais.includes(RELATORIOS)) throw new Error(`"${CARGO}" já está sem Relatórios: rode os dados fictícios de novo`)

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = (paginaAtual = await ctx.newPage())

  await passo('1. presidente: coluna Presidente só leitura; tira "Ver Relatórios" do Gerente de projetos', async () => {
    await entrar(page, ...PRESIDENTE)
    await abrirPermissoes(page)
    exigir(await caixa(page, 'Ver Relatórios', 'Presidente').isDisabled(), 'a coluna do presidente deveria ser só leitura')
    const c = caixa(page, 'Ver Relatórios', CARGO)
    exigir(await c.isChecked(), 'Relatórios deveria estar ligado no Gerente de projetos')
    await c.uncheck()
    await salvarColuna(page, CARGO)
    await page.click('.swal2-confirm') // confirma tirar a permissão
    await page.getByText('Permissões salvas').first().waitFor({ timeout: 15000 })
    const depois = (await api('GET', '/permissoes')).colunas.find(x => x.nome === CARGO)
    exigir(!depois.permissoes.includes(RELATORIOS), 'a API ainda tem Relatórios no Gerente de projetos')
  })

  await passo('2. troca para Gabi na mesma aba: menu sem Relatórios e sem Configurações', async () => {
    await trocar(page, GABI)
    const itens = await menu(page)
    exigir(!itens.includes('Relatórios'), `Gabi ainda vê Relatórios: ${itens}`)
    exigir(!(await page.locator('[aria-label="Configurações"]').count()), 'Gabi vê a engrenagem de Configurações')
  })

  await passo('3. Gabi: Site (área Projetos) completo; Robô (Inovação) só cartão', async () => {
    await abrirProjetos(page)
    await completoDe(page, SITE).waitFor({ timeout: 15000 })
    await conferirCartao(page, ROBO)
  })

  await passo('4. troca para Inês: Robô completo; Site só cartão', async () => {
    await trocar(page, INES)
    await abrirProjetos(page)
    await completoDe(page, ROBO).waitFor({ timeout: 15000 })
    await conferirCartao(page, SITE)
  })

  await passo('5. presidente religa Relatórios; Gabi entra na mesma aba e vê Relatórios', async () => {
    await trocar(page, PRESIDENTE)
    await abrirPermissoes(page)
    await caixa(page, 'Ver Relatórios', CARGO).check()
    await salvarColuna(page, CARGO)
    await page.getByText('Permissões salvas').first().waitFor({ timeout: 15000 })
    await trocar(page, GABI)
    const itens = await menu(page)
    exigir(itens.includes('Relatórios'), `Gabi não vê Relatórios depois de religar: ${itens}`)
  })

  await passo('6. trainee (Davi): menu sem Biblioteca', async () => {
    await trocar(page, DAVI)
    const itens = await menu(page)
    exigir(!itens.includes('Biblioteca'), `o trainee vê a Biblioteca: ${itens}`)
    exigir(itens.includes('Tarefas'), `o trainee deveria ver Tarefas: ${itens}`)
  })
  await ctx.close()

  const cel = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'dark' })
  const p2 = (paginaAtual = await cel.newPage())
  await passo('7. celular (375 px), escuro: grade vira seletor de cargo e lista, sem rolagem lateral', async () => {
    await entrar(p2, ...PRESIDENTE)
    await p2.click('[aria-label="Configurações"]')
    await p2.getByRole('button', { name: 'Permissões', exact: true }).click()
    await p2.locator('#grade-perm-coluna').waitFor({ timeout: 15000 })
    exigir(!(await p2.locator('.grade-perm-tabela').isVisible()), 'a tabela da grade aparece no celular')
    await p2.selectOption('#grade-perm-coluna', { label: CARGO })
    exigir(
      await p2
        .getByRole('checkbox', { name: `Ver Relatórios: ${CARGO}` })
        .last()
        .isVisible(),
      'lista do cargo não aparece',
    )
    const largura = await p2.evaluate(() => document.documentElement.scrollWidth)
    exigir(largura <= 375, `rolagem lateral: ${largura}px`)
    await p2.screenshot({ path: `${PRINTS}permissoes-31a-celular.png`, fullPage: false })
  })
  await cel.close()
} finally {
  // Desfaz pela API se algum passo parou com Relatórios desligado.
  const atual = (await api('GET', '/permissoes')).colunas.find(c => c.nome === CARGO)
  if (!atual.permissoes.includes(RELATORIOS)) await api('PUT', `/permissoes/${atual.chave}`, { permissoes: permissoesOriginais })
  await browser.close()
}
if (falhou) process.exit(1)
console.log('Tudo certo.')
