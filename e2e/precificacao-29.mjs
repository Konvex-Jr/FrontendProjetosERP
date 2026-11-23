/**
 * Sessão 29: simulação de precificação com as regras da diretoria e documento preliminar (impressão).
 * Tudo pela tela; o PDF sai do `page.pdf()`, que usa o CSS de impressão como o "Salvar como PDF".
 * Uso: API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/precificacao-29.mjs
 * (Playwright fora do projeto: rodar de uma pasta com node_modules/playwright, ver CLAUDE.md.)
 */
import { chromium } from 'playwright'

const APP = process.env.APP_URL || 'http://localhost:5173'
const SAIDA = process.env.SAIDA || '/tmp'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const INES = ['ines@dev.konvex', 'Konvex@123']
const CAIO = ['caio@dev.konvex', 'Konvex@123']

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
  await page.click('.swal2-confirm')
  await page.waitForSelector('input[type=email]', { timeout: 15000 })
}
const abrir = async page => {
  await page.getByText('Simular precificação', { exact: true }).first().click()
  await page.waitForSelector('#root .prec-memoria', { timeout: 15000 })
}
const preco = async page => (await page.locator('.pv b').textContent()).trim()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const erros = []
page.on('console', m => m.type() === 'error' && !/401|retomar/.test(m.text()) && erros.push(m.text()))

// 1. Diretora muda a urgência nas regras.
await entrar(page, ...DIRETORA)
await abrir(page)
await page.getByRole('button', { name: 'Regras' }).click()
await page.getByLabel('Urgência (%)').fill('25')
await page.getByRole('button', { name: 'Salvar' }).click()
await page.waitForSelector('.konvex-toast', { timeout: 10000 })
const urgencia25 = page.getByText('Urgência: prazo menor que o normal (+25%)')
exigir(
  await urgencia25.waitFor({ timeout: 10000 }).then(
    () => true,
    () => false,
  ),
  '1. diretora grava a urgência (25%)',
)

// 2. Simulação: horas, valor-hora, urgência; PDF só com justificativa do desconto.
const pdf = page.getByRole('button', { name: 'Gerar PDF' })
exigir(await pdf.isDisabled(), '2a. sem horas, sem PDF')
const horas = page.locator('input[aria-label^="Horas de"]').first()
const valor = page.locator('input[aria-label^="Valor-hora de"]').first()
await horas.fill('40')
await valor.fill('50')
const semUrgencia = await preco(page)
await page.getByText('Urgência: prazo menor que o normal (+25%)').click()
exigir((await preco(page)) !== semUrgencia, '2b. urgência muda o preço')
exigir(await page.locator('#root .prec-memoria').getByText('Urgência (+25%)').isVisible(), '2c. memória mostra a urgência')
await page.getByLabel('Desconto comercial (%)').fill('5')
exigir(await pdf.isDisabled(), '2d. desconto sem justificativa barra o PDF')
await page.getByLabel('Justificativa do desconto (obrigatória)').fill('Cliente parceiro há 3 anos')
await page.getByLabel('Cliente ou projeto').fill('Loja do Bairro')
await page.getByLabel('Premissas').fill('Site institucional com 5 páginas.\nHospedagem por conta do cliente.')
exigir(await pdf.isEnabled(), '2e. com justificativa, PDF liberado')
await page.getByLabel('Desconto comercial (%)').fill('40')
exigir(await pdf.isDisabled(), '2f. desconto acima do teto barra o PDF')
await page.getByLabel('Desconto comercial (%)').fill('5')
await page.pdf({ path: `${SAIDA}/precificacao-29.pdf`, format: 'A4' })
await page.emulateMedia({ media: 'print' })
const doc = page.locator('.impressao-raiz')
exigir(await doc.getByText('Documento preliminar, simulação').isVisible(), '2g. impressão mostra o selo')
exigir(await doc.getByText('Loja do Bairro').isVisible(), '2h. impressão mostra o cliente')
exigir(await doc.getByText(/Válido até/).isVisible(), '2i. impressão mostra a validade')
exigir(!(await page.locator('.prec-regras').isVisible()), '2j. tela some na impressão')
await page.screenshot({ path: `${SAIDA}/precificacao-29-impressao.png`, fullPage: true })
await page.emulateMedia({ media: 'screen' })

// 3. Alerta de margem mínima.
await page.getByLabel('Margem (%)').fill('0')
await page.getByRole('button', { name: /ONG ou EJ parceira/ }).click()
exigir(await page.locator('.prec-alerta').isVisible(), '3. margem 0 mostra o alerta')
await page.screenshot({ path: `${SAIDA}/precificacao-29.png`, fullPage: true })

// 4. Gerente (mesma aba) simula, vê a regra nova e não edita.
await sair(page)
await entrar(page, ...INES)
await abrir(page)
exigir(!(await page.getByRole('button', { name: 'Regras' }).count()), '4a. gerente sem botão Regras')
exigir(await page.getByText('Urgência: prazo menor que o normal (+25%)').isVisible(), '4b. gerente vê a urgência gravada')
exigir(
  (await page.locator('input[aria-label^="Horas de"]').first().inputValue()) === '',
  '4c. simulação da diretora não vaza para a gerente',
)

// 5. Membro não tem a tela.
await sair(page)
await entrar(page, ...CAIO)
exigir(!(await page.getByText('Simular precificação', { exact: true }).count()), '5. membro sem precificação no menu')

// 6. Celular, escuro.
await sair(page)
await page.setViewportSize({ width: 375, height: 812 })
await page.emulateMedia({ colorScheme: 'dark' })
await entrar(page, ...DIRETORA)
await page.goto(`${APP}/#/precificacao`)
await page.waitForSelector('.prec-memoria', { timeout: 15000 })
const largura = await page.evaluate(() => document.documentElement.scrollWidth)
exigir(largura <= 375, `6. 375 px sem rolagem lateral (${largura})`)
await page.screenshot({ path: `${SAIDA}/precificacao-29-375.png`, fullPage: true })

// Volta a urgência ao padrão.
await page.getByRole('button', { name: 'Regras' }).click()
await page.getByLabel('Urgência (%)').fill('20')
await page.getByRole('button', { name: 'Salvar' }).click()
await page.waitForSelector('.konvex-toast', { timeout: 10000 })

exigir(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''))
await browser.close()
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\ntudo ok')
process.exit(falhas.length ? 1 : 0)
