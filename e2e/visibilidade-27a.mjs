#!/usr/bin/env node
/**
 * Visibilidade de projetos (sessão 27a), ponta a ponta, tudo pela tela (a API só confere e limpa).
 *
 *   1. membro (Bia) vê em Projetos o "Robô" (de outra equipe) como cartão, sem progresso, e o clique não abre
 *   2. trainee (Davi) idem com o "Site institucional (fictício)"
 *   3. gerente (Inês) vê o sigiloso alheio como cartão com selo; abrir #/projetos/<codigo> mostra o aviso, sem as abas
 *   4. gerente cria sigiloso sem se pôr na equipe: mensagem do 400 e janela aberta; põe-se na equipe: cria
 *   5. diretora vê todos completos (nenhum cartão)
 *   6. troca de conta na mesma aba (diretora -> Inês, as duas da gestão) sem recarregar: o sigiloso completo da
 *      diretora aparece à Inês só como cartão
 *   7. troca de conta na mesma aba (diretora -> Bia) sem recarregar: o "Robô" completo da diretora não aparece à Bia
 *   8. celular (375 px), tema escuro: lista de cartões (grade e linhas) sem rolagem lateral
 *
 * Pré-requisitos: dados fictícios no backend (Robô sem a Bia e o Davi; sigiloso sem a Inês):
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/visibilidade-27a.mjs
 * Ao final apaga o projeto criado (pela API).
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
const DAVI = ['davi@dev.konvex', SENHA]
const SUFIXO = Date.now().toString(36)
const NOVO_SIGILOSO = `Sigiloso e2e ${SUFIXO}`
const ROBO = 'Robô'
const SITE = 'Site institucional (fictício)'
const SIGILOSO = 'Proposta confidencial (fictício)'

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
    await paginaAtual?.screenshot({ path: `${PRINTS}visibilidade-27a-falha.png` }).catch(() => {})
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
const FIM = iso(new Date(Date.now() + 30 * 864e5))

const janela = page => page.locator('.modal.d-block form')
// Campo da janela pelo começo do rótulo (as dicas abaixo do campo também citam outros nomes).
const campo = (dlg, rotulo) =>
  dlg
    .locator('label')
    .filter({ hasText: new RegExp(`^${rotulo}`) })
    .locator('select, input, textarea')
    .first()
const cartaoDe = (page, nome) => page.locator('.pj-cartao').filter({ has: page.getByRole('heading', { name: nome, exact: true }) })
const completoDe = (page, nome) => page.locator('.card.pj').filter({ has: page.getByRole('heading', { name: nome, exact: true }) })

/** Abre Projetos pelo menu (sem recarregar a página) com "Situação: todos". */
async function abrirProjetos(page) {
  await page.locator('#menu a[aria-label="Projetos"]').click()
  await page.getByRole('heading', { name: 'Projetos' }).first().waitFor({ timeout: 15000 })
  await page.getByLabel('Grupo de projetos').selectOption('')
}

/** O projeto aparece só como cartão: sem progresso, sem período e o clique não abre a ficha. */
async function conferirCartao(page, nome) {
  const c = cartaoDe(page, nome)
  await c.waitFor({ timeout: 15000 })
  exigir(!(await completoDe(page, nome).count()), `"${nome}" aparece completo`)
  const texto = await c.innerText()
  exigir(!/%/.test(texto), `cartão de "${nome}" mostra progresso: ${texto}`)
  exigir(!/\d{2}\/\d{2}\/\d{4}/.test(texto), `cartão de "${nome}" mostra datas: ${texto}`)
  exigir(!(await c.locator('.progress').count()), `cartão de "${nome}" tem barra de progresso`)
  exigir(/Líder/.test(texto), `cartão de "${nome}" sem o líder`)
  const antes = page.url()
  await c.getByRole('heading', { name: nome, exact: true }).click()
  await page.waitForTimeout(600)
  exigir(page.url() === antes, `o clique no cartão abriu ${page.url()}`)
}

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenDir = await entrarApi(...DIRETORA)
const todos = await api('GET', '/projetos')
const sigiloso = todos.find(p => p.nome === SIGILOSO)
const robo = todos.find(p => p.nome === ROBO)
if (!sigiloso?.sigiloso || !robo) throw new Error('Rode antes: npm run dados:ficticios (no backend)')
// Pré-condições dos dados fictícios, conferidas pela API de cada pessoa.
const tokenInes = await entrarApi(...INES)
const daInes = await api('GET', '/projetos', null, tokenInes)
if (!daInes.find(p => p.codigo === sigiloso.codigo)?.cartao) throw new Error('A Inês deveria ver o sigiloso só pelo cartão')
const daBia = await api('GET', '/projetos', null, await entrarApi(...BIA))
if (!daBia.find(p => p.codigo === robo.codigo)?.cartao) throw new Error('A Bia deveria ver o Robô só pelo cartão')

const errosConsole = []
let browser
try {
  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  paginaAtual = page
  // 401 de /auth/retomar na tela de login (sem cookie de retomada) e o 400 do passo 4 (esperado) não contam.
  let esperados = 0
  page.on('response', r => {
    if (r.status() === 401 && /\/auth\/retomar$/.test(r.url())) esperados++
    if (r.status() === 400 && /\/projetos$/.test(r.url()) && r.request().method() === 'POST') esperados++
  })
  page.on('console', m => {
    if (m.type() !== 'error') return
    if (/status of (401|400)/.test(m.text()) && esperados > 0) return esperados--
    errosConsole.push(m.text())
  })
  page.on('pageerror', e => errosConsole.push(e.message))

  await passo('1. membro vê o projeto alheio como cartão, sem progresso, e o clique não abre', async () => {
    await entrar(page, ...BIA)
    await abrirProjetos(page)
    await conferirCartao(page, ROBO)
    // O geral da área não tem líder próprio: o cartão não mostra a linha "Líder".
    const geral = cartaoDe(page, 'Inovação geral')
    await geral.waitFor({ timeout: 10000 })
    exigir(!/Líder/.test(await geral.innerText()), 'o cartão do geral da área mostra "Líder"')
    // Na vista em linhas, o cartão também não mostra período nem progresso.
    await page.getByRole('button', { name: 'Linhas' }).click()
    const linha = page.locator('tr.linha-cartao').filter({ hasText: ROBO })
    await linha.waitFor({ timeout: 10000 })
    const texto = await linha.innerText()
    exigir(!/%|\d{2}\/\d{2}\/\d{4}/.test(texto), `linha do cartão com progresso ou datas: ${texto}`)
    await page.getByRole('button', { name: 'Grid' }).click()
    await page.screenshot({ path: `${PRINTS}visibilidade-27a-1.png`, fullPage: true })
    await sair(page)
  })

  await passo('2. trainee vê o projeto alheio como cartão e o clique não abre', async () => {
    await entrar(page, ...DAVI)
    await abrirProjetos(page)
    await conferirCartao(page, SITE)
    await sair(page)
  })

  await passo('3. gerente vê o sigiloso alheio como cartão com selo; a ficha pela URL mostra o aviso', async () => {
    await entrar(page, ...INES)
    await abrirProjetos(page)
    await conferirCartao(page, SIGILOSO)
    exigir(await cartaoDe(page, SIGILOSO).getByText('Sigiloso', { exact: true }).count(), 'cartão do sigiloso sem o selo')
    await page.goto(`${APP}/#/projetos/${sigiloso.codigo}`)
    await page.getByRole('heading', { name: SIGILOSO }).waitFor({ timeout: 15000 })
    const aviso = page.locator('.aviso-cartao')
    await aviso.waitFor({ timeout: 10000 })
    exigir(/equipe e dos diretores/.test(await aviso.innerText()), `aviso: ${await aviso.innerText()}`)
    for (const aba of ['Visão geral', 'Equipe', 'Tarefas'])
      exigir(!(await page.locator('main').getByRole('button', { name: aba, exact: true }).count()), `a ficha do cartão mostra a aba ${aba}`)
    exigir(!(await page.getByText(/não encontrado/i).count()), 'a ficha do cartão parece tela de erro')
    await page.screenshot({ path: `${PRINTS}visibilidade-27a-3.png` })
  })

  await passo('4. gerente cria sigiloso: sem se pôr na equipe = mensagem e janela aberta; na equipe = cria', async () => {
    await abrirProjetos(page)
    await page.getByRole('button', { name: 'Novo projeto' }).click()
    const dlg = janela(page)
    await campo(dlg, 'Nome').fill(NOVO_SIGILOSO)
    await campo(dlg, 'Tipo').selectOption('cliente')
    await campo(dlg, 'Descrição').fill('Projeto sigiloso criado pelo e2e.')
    await campo(dlg, 'Início').fill(HOJE)
    await campo(dlg, 'Fim').fill(FIM)
    await campo(dlg, 'Visibilidade').selectOption('sigiloso')
    exigir(await dlg.getByText('Só a equipe e os diretores verão os detalhes e as tarefas.').count(), 'sem a dica da Visibilidade')
    await dlg.getByRole('button', { name: 'Salvar' }).click()
    const erro = page.locator('.swal2-popup').filter({ hasText: 'Você ficaria sem acesso ao projeto sigiloso' })
    await erro.waitFor({ timeout: 15000 })
    await page.screenshot({ path: `${PRINTS}visibilidade-27a-4a.png` })
    await page.locator('.swal2-confirm').click()
    await erro.waitFor({ state: 'detached', timeout: 10000 })
    exigir(await dlg.isVisible(), 'a janela fechou depois do 400')
    // Põe-se na equipe inicial e salva de novo.
    await dlg.locator('.ms .mc').click()
    await dlg.locator('.ms .mo').filter({ hasText: 'Inês Gerente' }).click()
    // Fecha a lista de pessoas (clique fora) antes de salvar.
    await dlg.getByRole('heading', { name: 'Novo projeto' }).click()
    await dlg.getByRole('button', { name: 'Salvar' }).click()
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    await page.getByRole('heading', { name: NOVO_SIGILOSO }).waitFor({ timeout: 15000 })
    exigir(!(await page.locator('.aviso-cartao').count()), 'o projeto criado abriu como cartão')
    const criado = (await api('GET', '/projetos')).find(p => p.nome === NOVO_SIGILOSO)
    exigir(criado?.sigiloso, 'API: projeto não ficou sigiloso')
    const equipe = (criado.participacoes || []).map(x => x.usuario?.email)
    exigir(equipe.includes('ines@dev.konvex'), `API: equipe do sigiloso sem a Inês: ${equipe}`)
    await sair(page)
  })

  await passo('5. diretora vê todos completos', async () => {
    await entrar(page, ...DIRETORA)
    await abrirProjetos(page)
    await completoDe(page, SIGILOSO).waitFor({ timeout: 15000 })
    await completoDe(page, ROBO).waitFor({ timeout: 15000 })
    exigir(!(await page.locator('.pj-cartao').count()), 'a diretora vê cartões')
    await completoDe(page, ROBO).getByRole('heading', { name: ROBO, exact: true }).click()
    await page.getByRole('button', { name: 'Visão geral', exact: true }).waitFor({ timeout: 15000 })
    await page.goto(`${APP}/#/projetos`)
    await page.getByRole('heading', { name: 'Projetos' }).first().waitFor({ timeout: 15000 })
  })

  await passo('6. troca de conta na mesma aba entre gestores: a gerente não recebe o sigiloso completo da diretora', async () => {
    // A diretora acabou de ver a lista (com o sigiloso completo) nesta aba; a Inês tem a mesma chave da tela (gestor).
    await completoDe(page, SIGILOSO).waitFor({ timeout: 15000 })
    await sair(page)
    await entrar(page, ...INES)
    await abrirProjetos(page)
    await conferirCartao(page, SIGILOSO)
    await page.goto(`${APP}/#/projetos/${sigiloso.codigo}`)
    await page.locator('.aviso-cartao').waitFor({ timeout: 15000 })
    exigir(
      !(await page.locator('main').getByRole('button', { name: 'Visão geral', exact: true }).count()),
      'a ficha do sigiloso abriu completa para a Inês',
    )
    // Volta à diretora (lista completa na memória da aba) para o passo seguinte.
    await sair(page)
    await entrar(page, ...DIRETORA)
    await abrirProjetos(page)
    await completoDe(page, ROBO).waitFor({ timeout: 15000 })
  })

  await passo('7. troca de conta na mesma aba: o membro não recebe o projeto completo da diretora', async () => {
    // Sem recarregar: a lista e a ficha do Robô da diretora estão na memória da aba.
    await sair(page)
    await entrar(page, ...BIA)
    await abrirProjetos(page)
    await conferirCartao(page, ROBO)
    exigir(!(await page.getByRole('button', { name: 'Novo projeto' }).count()), 'o membro vê "Novo projeto"')
    await page.goto(`${APP}/#/projetos/${robo.codigo}`)
    await page.locator('.aviso-cartao').waitFor({ timeout: 15000 })
    exigir(
      !(await page.locator('main').getByRole('button', { name: 'Visão geral', exact: true }).count()),
      'a ficha do Robô abriu completa para a Bia',
    )
    await sair(page)
  })

  await passo('8. celular 375 px escuro: cartões sem rolagem lateral', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
    const p = await ctx2.newPage()
    paginaAtual = p
    p.on('pageerror', e => errosConsole.push(e.message))
    await p.addInitScript(() => localStorage.setItem('tema', 'dark'))
    await entrar(p, ...BIA)
    await p.goto(`${APP}/#/projetos`)
    await p.getByRole('heading', { name: 'Projetos' }).first().waitFor({ timeout: 15000 })
    await p.getByLabel('Grupo de projetos').selectOption('')
    await cartaoDe(p, ROBO).waitFor({ timeout: 15000 })
    exigir((await p.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', 'tema não ficou escuro')
    exigir(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'rolagem horizontal na grade')
    await p.screenshot({ path: `${PRINTS}visibilidade-27a-7.png`, fullPage: true })
    await p.getByRole('button', { name: 'Linhas' }).click()
    await p.locator('tr.linha-cartao').first().waitFor({ timeout: 10000 })
    exigir(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'rolagem horizontal nas linhas')
    await p.screenshot({ path: `${PRINTS}visibilidade-27a-7-linhas.png`, fullPage: true })
    await ctx2.close()
  })
} finally {
  await browser?.close()
  try {
    for (const p of await api('GET', '/projetos')) if (p.nome === NOVO_SIGILOSO) await api('DELETE', `/projetos/${p.codigo}`)
  } catch (e) {
    console.log(`limpeza: ${e.message}`)
  }
}
if (errosConsole.length) {
  console.log(`Erros de console (${errosConsole.length}):\n  ${errosConsole.slice(0, 5).join('\n  ')}`)
  falhou = true
}
process.exit(falhou ? 1 : 0)
