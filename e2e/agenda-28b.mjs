/**
 * Sessão 28b: Agenda (reuniões, prazos, capacitações) e chamada da capacitação por quem ministra.
 * Tudo pela tela; a API só prepara uma capacitação passada ministrada pelo Caio (membro).
 * Uso: API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/agenda-28b.mjs
 * (Playwright fora do projeto: rodar de uma pasta com node_modules/playwright, ver CLAUDE.md.)
 */
import { chromium } from 'playwright'

const APP = process.env.APP_URL || 'http://localhost:5173'
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const SAIDA = process.env.SAIDA || '/tmp'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const BIA = ['bia@dev.konvex', 'Konvex@123']
const CAIO = ['caio@dev.konvex', 'Konvex@123']
const TITULO = `Reunião e2e ${Date.now() % 100000}`

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
const abrirAgenda = async page => {
  await page.getByText('Agenda', { exact: true }).first().click()
  await page.waitForSelector('.cal-d', { timeout: 15000 })
}
// Dia local daqui a 2 dias (AAAA-MM-DD): fica no mês atual ou na grade dele.
const daqui = n => {
  const d = new Date(Date.now() + n * 864e5)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function api(metodo, caminho, corpo, token) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'access-token': token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${texto}`)
  return texto ? JSON.parse(texto) : null
}
const entrarApi = async (email, senha) => (await api('POST', '/auth/login', { email, senha })).token

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const erros = []
page.on('console', m => m.type() === 'error' && !/401|retomar/.test(m.text()) && erros.push(m.text()))
page.on('pageerror', e => erros.push(String(e)))

try {
  // 1. Bia: Agenda no menu, com capacitações
  await entrar(page, ...BIA)
  await abrirAgenda(page)
  exigir((await page.locator('.cal-d .ag-capacitacao').count()) > 0, 'agenda da Bia mostra capacitações')

  // 2. Bia cria reunião com Caio
  await page.getByRole('button', { name: 'Nova reunião' }).click()
  const modal = page.locator('.modal-content')
  await modal.getByLabel('Título').fill(TITULO)
  await modal.getByLabel('Data').fill(daqui(2))
  await modal.getByLabel('Início').fill('15:00')
  await modal.getByLabel('Duração (minutos)').fill('45')
  await modal.getByLabel('Local ou link').fill('https://meet.google.com/abc-defg-hij')
  await modal.locator('.mc input').click()
  await modal.locator('.mc input').fill('Caio')
  await modal.locator('.mo', { hasText: 'Caio' }).first().click()
  await modal.getByRole('button', { name: 'Salvar' }).click()
  await page.waitForSelector(`.modal-title:has-text("${TITULO}")`, { timeout: 10000 })
  const href = await page.getByRole('link', { name: 'Criar no Google Agenda' }).getAttribute('href')
  const url = new URL(href)
  exigir(url.host === 'calendar.google.com', 'botão abre o Google Agenda')
  exigir(/caio@dev\.konvex/.test(url.searchParams.get('add') || ''), 'Caio vai como convidado no Google')
  exigir(/T150000\/\d{8}T154500$/.test(url.searchParams.get('dates') || ''), 'horário 15:00 a 15:45 no link')
  exigir(await page.getByRole('button', { name: 'Editar' }).isVisible(), 'quem criou pode editar')
  await page.screenshot({ path: `${SAIDA}/28b-reuniao.png` })
  await page.getByLabel('Fechar').click()
  exigir((await page.locator('.cal-d .ag-reuniao', { hasText: TITULO }).count()) === 1, 'reunião aparece na grade da Bia')
  await sair(page)

  // 3. Caio vê e não edita (troca de conta na mesma aba)
  await entrar(page, ...CAIO)
  await abrirAgenda(page)
  const naGrade = page.locator('.cal-d .ag-reuniao', { hasText: TITULO })
  exigir((await naGrade.count()) === 1, 'reunião aparece na agenda do Caio')
  await naGrade.first().click()
  await page.waitForSelector(`.modal-title:has-text("${TITULO}")`, { timeout: 10000 })
  exigir((await page.getByRole('button', { name: 'Editar' }).count()) === 0, 'participante não edita')
  await page.getByLabel('Fechar').click()
  await sair(page)

  // 4. Diretora vê a agenda da Bia
  await entrar(page, ...DIRETORA)
  await abrirAgenda(page)
  exigir((await page.locator('.cal-d .ag-reuniao', { hasText: TITULO }).count()) === 0, 'diretora não vê a reunião na própria agenda')
  await page.getByLabel('Agenda de').selectOption({ label: 'Bia Membro' })
  await page.waitForSelector(`.cal-d .ag-reuniao:has-text("${TITULO}")`, { timeout: 10000 })
  exigir(true, 'diretora vê a reunião na agenda da Bia')
  await page.screenshot({ path: `${SAIDA}/28b-agenda-gestao.png`, fullPage: true })
  await sair(page)

  // 5. Caio (membro) ministra uma capacitação de ontem e faz a chamada pela tela
  const tokenDir = await entrarApi(...DIRETORA)
  const pessoas = await api('GET', '/usuarios', null, tokenDir)
  const codigo = email => pessoas.find(p => p.email === email).codigo
  const cap = await api(
    'POST',
    '/capacitacoes',
    {
      titulo: `Chamada e2e ${Date.now() % 100000}`,
      data: daqui(-1),
      hora: '19:00',
      duracaoHoras: 1,
      codigoInstrutor: codigo(CAIO[0]),
      vagas: 5,
      tipo: 'computacao',
      sala: 'Lab 1',
    },
    tokenDir,
  )
  for (const e of [BIA[0], 'davi@dev.konvex'])
    await api('POST', `/capacitacoes/${cap.codigo}/inscricoes`, { codigoUsuario: codigo(e) }, tokenDir)
  await entrar(page, ...CAIO)
  await page.goto(`${APP}/#/capacitacoes/${cap.codigo}`)
  await page.waitForSelector('.chamada', { timeout: 10000 })
  const linhas = page.locator('.chamada-l')
  exigir((await linhas.count()) === 2, 'chamada lista os 2 inscritos para quem ministra')
  exigir((await page.locator('.chamada .av').count()) === 2, 'chamada mostra foto ou iniciais')
  await linhas.filter({ hasText: 'Bia' }).click()
  exigir((await linhas.filter({ hasText: 'Bia' }).getAttribute('aria-pressed')) === 'true', 'tocar marca presente')
  await page.getByRole('button', { name: 'Salvar chamada' }).click()
  await page.waitForSelector('text=Chamada salva', { timeout: 10000 })
  await page.waitForTimeout(500)
  exigir(await page.locator('.chamada-l.sim', { hasText: 'Bia' }).isVisible(), 'presença da Bia gravada')
  exigir(!(await page.locator('.chamada-l.sim', { hasText: 'Davi' }).count()), 'Davi ficou ausente')
  await page.screenshot({ path: `${SAIDA}/28b-chamada.png`, fullPage: true })
  await sair(page)
  await api('DELETE', `/capacitacoes/${cap.codigo}`, null, tokenDir)

  // 6. Celular 375 px, escuro: agenda vira lista e não rola de lado
  const m = await browser.newPage({ viewport: { width: 375, height: 812 } })
  await m.addInitScript(() => localStorage.setItem('tema', 'dark'))
  await entrar(m, ...BIA)
  await m.goto(`${APP}/#/agenda`)
  await m.waitForSelector('.cal-ag', { timeout: 15000 })
  exigir(await m.locator('.cal-ag .ag', { hasText: TITULO }).isVisible(), 'no celular a reunião aparece na lista')
  const largura = await m.evaluate(() => document.documentElement.scrollWidth)
  exigir(largura <= 375, `sem rolagem lateral (${largura}px)`)
  await m.screenshot({ path: `${SAIDA}/28b-celular.png`, fullPage: true })
} catch (e) {
  falhas.push(String(e))
  console.log('FALHA', e)
  await page.screenshot({ path: `${SAIDA}/28b-erro.png`, fullPage: true }).catch(() => {})
}
exigir(!erros.length, `sem erros no console${erros.length ? ': ' + erros.join(' | ') : ''}`)
await browser.close()
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo')
process.exit(falhas.length ? 1 : 0)
