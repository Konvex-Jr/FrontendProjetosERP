#!/usr/bin/env node
/**
 * Conta (sessão 25a), ponta a ponta, tudo pela tela (a API só lê o e-mail de dev e confere):
 *   1. diretora cadastra "Nina Nova" -> selo "Convite pendente"
 *   2. link do convite: senha fraca deixa o botão desabilitado e o medidor diz "Fraca"; Konvex@123456 -> "Forte";
 *      cai em "Complete seu perfil" e preenche e-mail pessoal, ingresso e agenda; entra
 *   3. sai; "Esqueci a senha" com o e-mail em maiúsculas -> mensagem fixa; link -> nova senha -> entra; link de novo -> "não vale mais"
 *   4. login com "Manter conectado"; fecha as páginas e abre duas juntas no mesmo contexto: as duas entram
 *   5. sai; entra como outra conta sem marcar; fecha e reabre: tela de login (não volta a Nina)
 *   6. 375 px, escuro: Criar senha e Login sem rolagem horizontal (capturas em e2e/prints)
 *
 * Pré-requisitos: dados fictícios e backend de dev com SMTP desligado (e-mails em EMAILS_DEV):
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/conta-25a.mjs
 * A pessoa criada fica inativa no fim (a API não exclui). Rodando de novo, usa um e-mail com sufixo.
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const EMAILS_DEV = process.env.EMAILS_DEV || new URL('../../BackendProjetosERP/.emails-dev/emails.jsonl', import.meta.url).pathname
const PRINTS = new URL('./prints/', import.meta.url).pathname
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const OUTRA = ['bia@dev.konvex', 'Konvex@123']
const SENHA1 = 'Konvex@123456'
const SENHA2 = 'Konvex@654321'

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
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${texto}`)
  return texto ? JSON.parse(texto) : null
}

// E-mails de dev: último para o endereço com o assunto pedido, escrito depois de `desde`.
const emails = () =>
  readFileSync(EMAILS_DEV, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l))
async function linkDoEmail(para, assuntoParte, desde) {
  for (let i = 0; i < 30; i++) {
    const m = emails()
      .filter(e => e.para.toLowerCase() === para.toLowerCase() && e.assunto.includes(assuntoParte) && new Date(e.em) >= desde)
      .pop()
    if (m) return m.texto.match(/https?:\/\/\S+#\/senha\/\S+/)[0]
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error(`e-mail "${assuntoParte}" para ${para} não chegou`)
}

let paginaAtual
let falhou = false
const resultados = []
async function passo(nome, fn) {
  if (falhou) return console.log(`PULADO ${nome}`)
  try {
    await fn()
    resultados.push(['ok', nome])
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    await paginaAtual?.screenshot({ path: `${PRINTS}conta-25a-falha.png` }).catch(() => {})
    console.log(`FALHA  ${nome}\n       ${e.message.split('\n').slice(0, 14).join('\n       ')}`)
  }
}
const exigir = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const SAIR = '[aria-label="Sair"]'
async function entrar(page, email, senha, manter = false) {
  await page.goto(`${APP}/#/login`)
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', senha)
  if (manter) await page.getByLabel('Manter conectado por 15 dias').check()
  await page.press('input[type=password]', 'Enter')
  await page.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
}
const sair = async page => {
  await page.click(SAIR)
  await page.waitForSelector('input[type=email]', { timeout: 15000 })
}
const semRolagemLateral = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
const errosConsole = []
let browser
const novaPagina = async (ctx, usar = true) => {
  const page = await ctx.newPage()
  if (usar) paginaAtual = page
  page.on('console', m => m.type() === 'error' && !/401|403|404/.test(m.text()) && errosConsole.push(m.text()))
  page.on('pageerror', e => errosConsole.push(e.message))
  return page
}

tokenDir = (await api('POST', '/auth/login', { email: DIRETORA[0], senha: DIRETORA[1] }, null)).token
const existentes = await api('GET', '/usuarios')
const SUFIXO = Date.now().toString(36)
const EMAIL = existentes.some(p => p.email.toLowerCase() === 'nina@dev.konvex') ? `nina${SUFIXO}@dev.konvex` : 'nina@dev.konvex'
const NINA_MAIUSCULA = EMAIL.replace(/^[^@]+/, m => m.toUpperCase())
const INICIO = new Date()

try {
  browser = await chromium.launch()
  const ctxDir = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const dir = await novaPagina(ctxDir)

  await passo('1. diretora cadastra Nina Nova e vê "Convite pendente"', async () => {
    await entrar(dir, ...DIRETORA)
    await dir.goto(`${APP}/#/usuarios`)
    await dir.getByRole('button', { name: 'Nova pessoa' }).click()
    const form = dir.locator('.modal.d-block form')
    await form.locator('label').filter({ hasText: /^Nome/ }).locator('input').fill('Nina Nova')
    await form
      .locator('label')
      .filter({ hasText: /^E-mail(?! pessoal)/ })
      .locator('input')
      .fill(EMAIL)
    await form
      .locator('label')
      .filter({ hasText: /^Curso/ })
      .locator('select')
      .selectOption({ label: 'Ciência da Computação' })
    await form
      .locator('label')
      .filter({ hasText: /^Telefone/ })
      .locator('input')
      .fill('11987654321')
    await form.getByRole('button', { name: 'Salvar' }).click()
    const linha = dir.locator('tr').filter({ hasText: EMAIL })
    await linha.getByText('Convite pendente').waitFor({ timeout: 15000 })
    await dir.screenshot({ path: `${PRINTS}conta-25a-1-convite-pendente.png` })
  })

  // Contexto da Nina: navegador dela.
  let ctxNina, nina
  let linkConvite
  await passo('2. convite: fraca bloqueia, forte entra', async () => {
    linkConvite = await linkDoEmail(EMAIL, 'acesso', INICIO)
    ctxNina = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    nina = await novaPagina(ctxNina)
    await nina.goto(linkConvite)
    await nina.getByRole('heading', { name: 'Crie sua senha' }).waitFor({ timeout: 15000 })
    const campos = nina.locator('input[type=password]')
    const botao = nina.getByRole('button', { name: 'Criar senha e entrar' })
    await campos.nth(0).fill('abc123')
    await campos.nth(1).fill('abc123')
    exigir(await botao.isDisabled(), 'botão habilitado com senha fraca')
    await nina.locator('.senha-texto').filter({ hasText: 'Fraca' }).waitFor({ timeout: 3000 })
    await campos.nth(0).fill(SENHA1)
    await campos.nth(1).fill(SENHA1)
    await nina.locator('.senha-texto').filter({ hasText: 'Forte' }).waitFor({ timeout: 3000 })
    exigir(await botao.isEnabled(), 'botão desabilitado com senha forte')
    await botao.click()
    // Pessoa nova tem pendências (e-mail pessoal, ingresso, agenda): cai em "Complete seu perfil" e preenche.
    await nina.getByRole('heading', { name: 'Complete seu perfil' }).waitFor({ timeout: 15000 })
    exigir(
      (await nina
        .locator('label')
        .filter({ hasText: /^Curso/ })
        .locator('select')
        .inputValue()) === 'Ciência da Computação',
      'curso do cadastro não veio preenchido',
    )
    await nina
      .locator('label')
      .filter({ hasText: /^E-mail pessoal/ })
      .locator('input')
      .fill('nina.pessoal@exemplo.com')
    await nina
      .locator('label')
      .filter({ hasText: /^Ingresso na faculdade/ })
      .locator('input')
      .fill('20251')
    await nina
      .locator('label')
      .filter({ hasText: /^Link da agenda/ })
      .locator('input')
      .fill('https://cal.com/nina')
    await nina.getByRole('button', { name: 'Salvar e continuar' }).click()
    await nina.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
    exigir(!nina.url().includes('/senha/') && !nina.url().includes('/completar-perfil'), 'continuou na tela da senha ou do perfil')
    await nina.screenshot({ path: `${PRINTS}conta-25a-2-entrou.png` })
  })

  await passo('3. esqueci a senha: mensagem fixa, nova senha, link de uso único', async () => {
    await sair(nina)
    await nina.getByRole('link', { name: 'Esqueci a senha' }).click()
    const desde = new Date()
    await nina.fill('input[type=email]', NINA_MAIUSCULA)
    await nina.getByRole('button', { name: 'Enviar link' }).click()
    await nina.getByText('Se o e-mail estiver cadastrado, você vai receber um link em instantes.').waitFor({ timeout: 15000 })
    const link = await linkDoEmail(EMAIL, 'senha', desde)
    exigir(link !== linkConvite, 'link repetido')
    await nina.goto(link)
    await nina.getByRole('heading', { name: 'Nova senha' }).waitFor({ timeout: 15000 })
    const campos = nina.locator('input[type=password]')
    await campos.nth(0).fill(SENHA2)
    await campos.nth(1).fill(SENHA2)
    await nina.getByRole('button', { name: 'Salvar e entrar' }).click()
    await nina.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
    await nina.goto(link)
    await nina.getByText('Este link não vale mais').waitFor({ timeout: 15000 })
    await nina.screenshot({ path: `${PRINTS}conta-25a-3-link-usado.png` })
  })

  await passo('4. manter conectado: duas páginas abertas juntas entram', async () => {
    await nina.goto(`${APP}/#/`)
    await nina.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
    await sair(nina)
    await entrar(nina, EMAIL, SENHA2, true)
    for (const p of ctxNina.pages()) await p.close()
    const [a, b] = await Promise.all([novaPagina(ctxNina, false), novaPagina(ctxNina, false)])
    paginaAtual = a
    await Promise.all([a.goto(`${APP}/#/`), b.goto(`${APP}/#/`)])
    await Promise.all([
      a.waitForSelector(SAIR, { state: 'attached', timeout: 15000 }),
      b.waitForSelector(SAIR, { state: 'attached', timeout: 15000 }),
    ])
    nina = a
    await b.close()
  })

  await passo('5. sem marcar, fechar e reabrir volta ao login', async () => {
    await sair(nina)
    await entrar(nina, ...OUTRA)
    for (const p of ctxNina.pages()) await p.close()
    const nova = await novaPagina(ctxNina)
    await nova.goto(`${APP}/#/`)
    await nova.waitForSelector('input[type=email]', { timeout: 15000 })
    exigir((await nova.locator(SAIR).count()) === 0, 'voltou logado sem ter marcado')
    await nova.waitForTimeout(1500)
    exigir((await nova.locator(SAIR).count()) === 0, 'entrou depois de esperar')
  })

  await passo('6. celular escuro: Criar senha e Login sem rolagem lateral', async () => {
    const m = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme: 'dark', isMobile: true, hasTouch: true })
    await m.addInitScript(() => localStorage.setItem('tema', 'dark'))
    const p = await novaPagina(m)
    // Convite novo (a Nina já tem senha): a gestão reenvia pela API só para ter um link para abrir.
    const nova = (await api('GET', '/usuarios')).find(x => x.email === EMAIL)
    const desde = new Date()
    await api('POST', `/usuarios/${nova.codigo}/link-senha`).catch(() => {})
    const link = await linkDoEmail(EMAIL, 'senha', desde).catch(() => null)
    await p.goto(`${APP}/#/login`)
    await p.waitForSelector('input[type=email]', { timeout: 15000 })
    exigir(await semRolagemLateral(p), 'Login com rolagem lateral')
    exigir((await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'tema escuro não ligou')
    await p.screenshot({ path: `${PRINTS}conta-25a-6-login-375.png` })
    if (link) {
      await p.goto(link)
      await p.locator('input[type=password]').first().waitFor({ timeout: 15000 })
      await p.locator('input[type=password]').first().fill(SENHA1)
      exigir(await semRolagemLateral(p), 'Criar senha com rolagem lateral')
      await p.screenshot({ path: `${PRINTS}conta-25a-6-criar-senha-375.png`, fullPage: true })
    } else {
      throw new Error('não consegui link de senha para a captura da tela Criar senha')
    }
  })
} finally {
  await browser?.close()
  // Nina fica inativa (a API não exclui).
  try {
    const nina = (await api('GET', '/usuarios')).find(x => x.email === EMAIL)
    if (nina) await api('PATCH', `/usuarios/${nina.codigo}/status`, { status: 'inativo', motivoSaida: 'Limpeza do e2e' })
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
