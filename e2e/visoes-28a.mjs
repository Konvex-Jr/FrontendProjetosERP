/**
 * Sessão 28a: visões Campinho e Alocação em Projetos (só gestão) e ocupação no "Adicionar à equipe".
 * Tudo pela tela. Uso: APP_URL=http://localhost:5173 API_URL=http://localhost:5002 node e2e/visoes-28a.mjs
 * (Playwright fora do projeto: rodar de uma pasta com node_modules/playwright, ver CLAUDE.md.)
 */
import { chromium } from 'playwright'

const APP = process.env.APP_URL || 'http://localhost:5173'
const SAIDA = process.env.SAIDA || '/tmp'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const BIA = ['bia@dev.konvex', 'Konvex@123']

const falhas = []
const exigir = (ok, msg) => {
  if (!ok) falhas.push(msg)
  console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg)
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
  await page.click('.swal2-confirm') // confirma a saída (27c)
  await page.waitForSelector('input[type=email]', { timeout: 15000 })
}
const abrirProjetos = async page => {
  await page.goto(`${APP}/#/projetos`)
  await page.waitForSelector('.pj, .linha-cartao, .card', { timeout: 15000 })
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const erros = []
page.on('console', m => m.type() === 'error' && !/401|retomar/.test(m.text()) && erros.push(m.text()))
page.on('pageerror', e => erros.push(String(e)))

try {
  // 1. Diretora: Campinho
  await entrar(page, ...DIRETORA)
  await abrirProjetos(page)
  await page.getByRole('button', { name: 'Campinho', exact: true }).click()
  await page.waitForSelector('.campo', { timeout: 10000 })
  const campos = await page.locator('.campo').count()
  const botoes = await page.locator('.botao').count()
  exigir(campos > 0 && botoes > 0, `campinho com ${campos} campos e ${botoes} botões`)
  exigir((await page.locator('.botao-c').count()) > 0, 'campinho mostra a braçadeira do líder')
  await page.screenshot({ path: `${SAIDA}/28a-campinho.png`, fullPage: true })

  // 2. Alocação
  await page.getByRole('button', { name: 'Alocação', exact: true }).click()
  await page.waitForSelector('text=Ocupação na semana', { timeout: 10000 })
  const linhas = await page.locator('tbody tr').count()
  exigir(linhas > 3, `alocação com ${linhas} pessoas`)
  exigir((await page.locator('tbody .badge').filter({ hasText: '%' }).count()) > 0, 'alocação mostra percentuais')
  await page.screenshot({ path: `${SAIDA}/28a-alocacao.png`, fullPage: true })
  await page.getByLabel(/Só quem passa de 100%/).check()
  const acima = await page.locator('tbody tr').count()
  exigir(acima <= linhas, `filtro acima de 100%: ${acima} linha(s)`)

  // 3. Adicionar à equipe com a ocupação
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.locator('.pj').first().click()
  await page
    .getByRole('tab', { name: /Equipe/ })
    .or(page.getByRole('button', { name: /^Equipe/ }))
    .first()
    .click()
  await page.getByRole('button', { name: /Adicionar pessoa/ }).click()
  const opcoes = await page.locator('.modal.d-block select option').allTextContents()
  exigir(
    opcoes.some(o => /· \d+%/.test(o)),
    `"Adicionar à equipe" com ocupação: ${opcoes.slice(0, 3).join(' | ')}`,
  )
  await page.locator('.modal.d-block').getByRole('button', { name: 'Cancelar' }).click()

  // 4. Celular, tema escuro
  await page.setViewportSize({ width: 375, height: 800 })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await abrirProjetos(page)
  await page.getByRole('button', { name: 'Campinho', exact: true }).click()
  await page.waitForSelector('.campo', { timeout: 10000 })
  const largura = await page.evaluate(() => document.documentElement.scrollWidth)
  exigir(largura <= 375, `sem rolagem lateral no celular (${largura}px)`)
  await page.screenshot({ path: `${SAIDA}/28a-campinho-375-escuro.png`, fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await sair(page)

  // 5. Membro: sem as visões da gestão
  await entrar(page, ...BIA)
  await abrirProjetos(page)
  exigir((await page.getByRole('button', { name: 'Campinho', exact: true }).count()) === 0, 'membro não vê Campinho')
  exigir((await page.getByRole('button', { name: 'Alocação', exact: true }).count()) === 0, 'membro não vê Alocação')
} catch (e) {
  falhas.push(String(e))
  console.log('ERRO', e)
  await page.screenshot({ path: `${SAIDA}/28a-erro.png`, fullPage: true }).catch(() => {})
}
exigir(!erros.length, `sem erro no console ${erros.join(' | ')}`)
await browser.close()
process.exit(falhas.length ? 1 : 0)
