#!/usr/bin/env node
/**
 * Pessoas (sessão 25b), ponta a ponta, tudo pela tela (a API e o banco só preparam, conferem e limpam):
 *   1. diretora cria "Tito" (trainee): sem curso o aviso "Curso obrigatório"; com curso e telefone digitado
 *      11987654321 o campo mostra (11) 98765-4321; salva
 *   2. Bia (membro), em "Editar meus dados": e-mail pessoal; o perfil mostra e o botão copiar põe no clipboard
 *   3. Caio, com curso e telefone antigos fora da regra (forçado no banco), cai em "Complete seu perfil" (curso
 *      antigo no select), corrige os dois e entra; depois edita só "Sobre você" e salva
 *   4. diretora muda Tito para Ativo: o cartão de períodos mostra "Trainee" da entrada até hoje
 *   5. bug da equipe: no projeto, filtra a Função e adiciona Tito sem função: o nome aparece
 *   6. diretora muda Tito para Inativo: sem motivo não deixa; com motivo, o perfil mostra o motivo
 *   7. Inês (gerente) marca "Robô" como sigiloso na tela do projeto, confirma, a ficha recarrega sem erro;
 *      a diretora desmarca pela tela; tela Projetos abre com "Ativos"
 *   8. troca de conta na mesma aba (Bia -> Caio -> Meu perfil) sem dados da anterior; 375 px, escuro
 *
 * Pré-requisitos: dados fictícios no backend de dev, banco na porta 5434:
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/pessoas-25b.mjs
 * Tito fica inativo no fim (a API não exclui); cada rodada usa um e-mail novo. O banco de dev é restaurado
 * (curso e telefone do Caio, restrição do curso, e-mail pessoal da Bia, "Robô" normal).
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const DB_CONTAINER = process.env.DB_CONTAINER || 'konvex-dev-db-1'
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex@123'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const INES = ['ines@dev.konvex', SENHA]
const BIA = ['bia@dev.konvex', SENHA]
const CAIO = ['caio@dev.konvex', SENHA]
const SUFIXO = Date.now().toString(36)
const NOME_TITO = `Tito ${SUFIXO}`
const EMAIL_TITO = `tito${SUFIXO}@dev.konvex`
const EMAIL_PESSOAL = `bia.pessoal${SUFIXO}@exemplo.com`
const MOTIVO = `Saiu para um intercâmbio ${SUFIXO}`
const BIO = `Gosto de café e de testes ${SUFIXO}`
const SITE = 'Site institucional (fictício)'

const iso = d => d.toISOString().slice(0, 10)
const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const HOJE = hojeLocal()
const ENTRADA = iso(new Date(Date.now() - 20 * 864e5))
const fdBr = isoDia => `${isoDia.slice(8, 10)}/${isoDia.slice(5, 7)}/${isoDia.slice(0, 4)}`

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

// ---------- API e banco (preparar, conferir, limpar) ----------
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
const login = async ([email, senha]) => (await api('POST', '/auth/login', { email, senha }, null)).token
const sql = comando =>
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d konvex_dev -v ON_ERROR_STOP=1 -c "${comando}"`).toString()

let paginaAtual
let falhou = false
const PRINT_FALHA = `${PRINTS}pessoas-25b-falha.png`
async function passo(nome, fn) {
  if (falhou) return console.log(`PULADO ${nome}`)
  try {
    await fn()
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    await paginaAtual?.screenshot({ path: PRINT_FALHA }).catch(() => {})
    console.log(`FALHA  ${nome}\n       ${e.message.split('\n').slice(0, 14).join('\n       ')}`)
  }
}
const exigir = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const SAIR = '[aria-label="Sair"]'
async function entrar(page, [email, senha]) {
  await page.goto(`${APP}/#/login`)
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', senha)
  await page.press('input[type=password]', 'Enter')
  await page.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
}
const sair = async page => {
  await page.click(SAIR)
  await page.click('.swal2-confirm') // confirma a saída (27c)
  await page.waitForSelector('input[type=email]', { timeout: 15000 })
}
const formulario = page => page.locator('.modal.d-block form')
const campo = (page, rotulo) =>
  formulario(page)
    .locator('label')
    .filter({ hasText: new RegExp(`^${rotulo}`) })
    .locator('select, input, textarea')
    .first()
const alerta = page => page.locator('.swal2-popup:not(.swal2-toast)')
const toast = (page, texto) => page.locator('.swal2-toast').filter({ hasText: texto })
const semRolagemLateral = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
const linhaDe = (page, texto) => page.locator('tr').filter({ hasText: texto })
async function abrirAcao(page, linha, rotulo) {
  await page.waitForLoadState('networkidle')
  await linha.locator('button[aria-label="Ações"]').click()
  await page.getByRole('menuitem', { name: rotulo, exact: true }).click()
}
async function confirmar(page, texto) {
  await alerta(page).filter({ hasText: texto }).waitFor({ timeout: 5000 })
  await page.locator('.swal2-confirm').click()
}
async function irParaPessoas(page, busca) {
  await page.goto(`${APP}/#/usuarios`)
  await page.getByRole('heading', { name: 'Pessoas', exact: true }).waitFor({ timeout: 15000 })
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Buscar"]').length === 1)
  await page.getByLabel('Buscar', { exact: true }).fill(busca)
  await linhaDe(page, busca).waitFor({ timeout: 15000 })
}

const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
const errosConsole = []
let browser
const novaPagina = async ctx => {
  const page = await ctx.newPage()
  paginaAtual = page
  page.on('console', m => m.type() === 'error' && !/401|403|404/.test(m.text()) && errosConsole.push(m.text()))
  page.on('pageerror', e => errosConsole.push(e.message))
  return page
}

tokenDir = await login(DIRETORA)
const pessoas = await api('GET', '/usuarios')
const caio = pessoas.find(p => p.email === CAIO[0])
const antesBiaEmail = pessoas.find(p => p.email === BIA[0]).emailPessoal || ''
const antesCaio = { curso: caio.curso, telefone: caio.telefone, bio: caio.bio || '' }
const robo = (await api('GET', '/projetos')).find(p => p.nome === 'Robô')
const site = (await api('GET', '/projetos')).find(p => p.nome === SITE)
exigir(robo && site, 'faltam os projetos "Robô" e/ou "Site institucional" nos dados fictícios')
let tito

try {
  browser = await chromium.launch()
  const ctxDir = await browser.newContext({ viewport: { width: 1700, height: 900 } })
  const dir = await novaPagina(ctxDir)
  await entrar(dir, DIRETORA)

  await passo('1. diretora cria o trainee Tito: curso obrigatório e máscara do telefone', async () => {
    await dir.goto(`${APP}/#/usuarios`)
    await dir.getByRole('button', { name: 'Nova pessoa' }).click()
    await campo(dir, 'Nome').fill(NOME_TITO)
    await campo(dir, 'E-mail').fill(EMAIL_TITO)
    await campo(dir, 'Status').selectOption({ label: 'Trainee' })
    await campo(dir, 'Data de entrada na EJ').fill(ENTRADA)
    await formulario(dir).getByRole('button', { name: 'Salvar' }).click()
    await alerta(dir).filter({ hasText: 'Curso obrigatório' }).waitFor({ timeout: 5000 })
    await dir.locator('.swal2-confirm').click()
    await alerta(dir).waitFor({ state: 'detached', timeout: 5000 })
    const opcoes = await campo(dir, 'Curso').locator('option').allInnerTexts()
    for (const c of ['Ciência da Computação', 'Engenharia Mecânica', 'Engenharia Elétrica'])
      exigir(opcoes.includes(c), `curso "${c}" fora do select: ${opcoes}`)
    await campo(dir, 'Curso').selectOption({ label: 'Engenharia Elétrica' })
    await campo(dir, 'Telefone').fill('11987654321')
    exigir((await campo(dir, 'Telefone').inputValue()) === '(11) 98765-4321', 'a máscara não formatou o telefone')
    await dir.screenshot({ path: `${PRINTS}pessoas-25b-1-nova-pessoa.png` })
    await formulario(dir).getByRole('button', { name: 'Salvar' }).click()
    await linhaDe(dir, EMAIL_TITO).waitFor({ timeout: 15000 })
    tito = (await api('GET', '/usuarios')).find(p => p.email === EMAIL_TITO)
    exigir(tito.telefone === '(11) 98765-4321' && tito.curso === 'Engenharia Elétrica' && tito.status === 'trainee', 'Tito gravado errado')
  })

  // Bia: contexto próprio, com permissão de clipboard; fica logada para o passo 8 (troca de conta na mesma aba).
  const ctxBia = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const biaPag = await novaPagina(ctxBia)
  await passo('2. Bia grava o e-mail pessoal, vê no perfil e copia', async () => {
    await entrar(biaPag, BIA)
    await biaPag.goto(`${APP}/#/perfil`)
    await biaPag.getByRole('button', { name: 'Editar meus dados' }).click()
    await campo(biaPag, 'E-mail pessoal').fill(EMAIL_PESSOAL)
    await formulario(biaPag).getByRole('button', { name: 'Salvar' }).click()
    await toast(biaPag, 'Dados atualizados').waitFor({ timeout: 15000 })
    await biaPag.getByText(EMAIL_PESSOAL).waitFor({ timeout: 10000 })
    await biaPag.locator('button[aria-label="Copiar e-mail pessoal"]').click()
    await toast(biaPag, 'Copiado').waitFor({ timeout: 5000 })
    const clip = await biaPag.evaluate(() => navigator.clipboard.readText())
    exigir(clip === EMAIL_PESSOAL, `clipboard = "${clip}"`)
    await biaPag.screenshot({ path: `${PRINTS}pessoas-25b-2-perfil-bia.png` })
  })

  await passo('3. Caio com curso e telefone antigos edita só "Sobre você"', async () => {
    // Forçado no banco: a restrição de curso da migração 022 impede o dado antigo, então sai e volta no fim.
    sql('ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_curso_valido')
    sql(`UPDATE usuarios SET curso = 'Sistemas de Informação', telefone = '9100 2002' WHERE email = '${CAIO[0]}'`)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const p = await novaPagina(ctx)
    await p.goto(`${APP}/#/login`)
    await p.fill('input[type=email]', CAIO[0])
    await p.fill('input[type=password]', CAIO[1])
    await p.press('input[type=password]', 'Enter')
    // Curso e telefone fora da regra contam como pendência: a tela de completar aparece com o curso antigo.
    await p.getByRole('heading', { name: 'Complete seu perfil' }).waitFor({ timeout: 15000 })
    const completar = rotulo => p.locator('label').filter({ hasText: new RegExp(`^${rotulo}`) })
    exigir((await completar('Curso').locator('select').inputValue()) === 'Sistemas de Informação', 'o curso antigo sumiu do select')
    await completar('Curso').locator('select').selectOption({ label: antesCaio.curso })
    await completar('Telefone').locator('input').fill(antesCaio.telefone.replace(/\D/g, ''))
    await p.getByRole('button', { name: 'Salvar e continuar' }).click()
    await p.waitForSelector(SAIR, { state: 'attached', timeout: 15000 })
    await p.goto(`${APP}/#/perfil`)
    await p.getByRole('button', { name: 'Editar meus dados' }).click()
    await campo(p, 'Sobre você').fill(BIO)
    await formulario(p).getByRole('button', { name: 'Salvar' }).click()
    await toast(p, 'Dados atualizados').waitFor({ timeout: 15000 })
    exigir(!(await alerta(p).count()), 'apareceu aviso ao salvar')
    await p.getByText(BIO).waitFor({ timeout: 10000 })
    const depois = (await api('GET', '/usuarios')).find(x => x.email === CAIO[0])
    exigir(depois.curso === antesCaio.curso && depois.telefone === antesCaio.telefone, 'curso/telefone não ficaram corrigidos')
    await ctx.close()
  })

  await passo('4. Tito vira Ativo: cartão de períodos mostra "Trainee" até hoje', async () => {
    await irParaPessoas(dir, EMAIL_TITO)
    await abrirAcao(dir, linhaDe(dir, EMAIL_TITO), 'Mudar status')
    await campo(dir, 'Status').selectOption({ label: 'Ativo' })
    await formulario(dir).getByRole('button', { name: 'Salvar' }).click()
    await toast(dir, 'Status atualizado').waitFor({ timeout: 15000 })
    const t = (await api('GET', '/usuarios')).find(p => p.email === EMAIL_TITO)
    exigir(t.status === 'ativo' && String(t.fimTrainee).slice(0, 10) === HOJE, `fimTrainee = ${t.fimTrainee} (hoje ${HOJE})`)
    await linhaDe(dir, EMAIL_TITO).getByRole('button', { name: 'Ações' }).click()
    await dir.getByRole('menuitem', { name: 'Ver perfil', exact: true }).click()
    const linha = dir.locator('.periodo').filter({ hasText: 'Trainee' })
    await linha.waitFor({ timeout: 15000 })
    const texto = (await linha.innerText()).replace(/\s+/g, ' ')
    exigir(texto.includes(`${fdBr(ENTRADA)} a ${fdBr(HOJE)}`), `linha do trainee: "${texto}"`)
    await dir.screenshot({ path: `${PRINTS}pessoas-25b-4-trainee.png` })
  })

  await passo('5. equipe: filtro da Função ativo e pessoa adicionada sem função aparece', async () => {
    await dir.goto(`${APP}/#/projetos/${site.codigo}`)
    await dir.getByRole('button', { name: 'Equipe', exact: true }).click()
    const filtro = dir.getByLabel('Filtrar Função')
    await filtro.waitFor({ timeout: 15000 })
    const valores = (await filtro.locator('option').allInnerTexts()).filter(o => !/: todos$/.test(o))
    exigir(valores.length, 'a equipe do projeto não tem nenhuma função para filtrar')
    await filtro.selectOption({ label: valores[0] })
    await dir.getByRole('button', { name: 'Adicionar pessoa' }).click()
    await campo(dir, 'Pessoa').selectOption({ label: NOME_TITO })
    await formulario(dir).getByRole('button', { name: 'Salvar' }).click()
    await toast(dir, 'Pessoa adicionada').waitFor({ timeout: 15000 })
    await dir.locator('tr').filter({ hasText: NOME_TITO }).waitFor({ timeout: 5000 })
    exigir((await filtro.inputValue()) === '', 'o filtro continuou ligado')
    await dir.screenshot({ path: `${PRINTS}pessoas-25b-5-equipe.png` })
  })

  await passo('6. Tito vira Inativo: sem motivo não deixa; com motivo o perfil mostra', async () => {
    await irParaPessoas(dir, EMAIL_TITO)
    await abrirAcao(dir, linhaDe(dir, EMAIL_TITO), 'Mudar status')
    await campo(dir, 'Status').selectOption({ label: 'Inativo' })
    await campo(dir, 'Motivo da saída').waitFor({ timeout: 3000 })
    await formulario(dir).getByRole('button', { name: 'Salvar' }).click()
    await dir.waitForTimeout(600)
    exigir(await formulario(dir).count(), 'a janela fechou sem o motivo')
    exigir(!(await alerta(dir).count()), 'pediu confirmação sem o motivo')
    exigir((await api('GET', '/usuarios')).find(p => p.email === EMAIL_TITO).status === 'ativo', 'Tito virou inativo sem motivo')
    await campo(dir, 'Motivo da saída').fill(MOTIVO)
    await formulario(dir).getByRole('button', { name: 'Salvar' }).click()
    await confirmar(dir, 'Marcar como Inativo?')
    await toast(dir, 'Status atualizado').waitFor({ timeout: 15000 })
    await linhaDe(dir, EMAIL_TITO).getByRole('button', { name: 'Ações' }).click()
    await dir.getByRole('menuitem', { name: 'Ver perfil', exact: true }).click()
    await dir.getByText(MOTIVO).waitFor({ timeout: 15000 })
    await dir.screenshot({ path: `${PRINTS}pessoas-25b-6-inativo.png` })
  })

  await passo('7. Inês marca Robô como sigiloso na tela do projeto; diretora desmarca; Projetos abre em Ativos', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const p = await novaPagina(ctx)
    await entrar(p, INES)
    await p.goto(`${APP}/#/projetos/${robo.codigo}`)
    await p.getByRole('button', { name: 'Visão geral', exact: true }).click()
    await p.getByRole('button', { name: 'Editar projeto' }).click()
    await campo(p, 'Visibilidade').selectOption('sigiloso')
    await formulario(p).getByRole('button', { name: 'Salvar' }).click()
    await confirmar(p, 'Marcar como sigiloso?')
    await toast(p, 'Projeto atualizado').waitFor({ timeout: 15000 })
    await p.waitForTimeout(800)
    exigir(!(await alerta(p).count()), 'apareceu erro depois de marcar sigiloso')
    exigir((await api('GET', '/projetos')).find(x => x.codigo === robo.codigo).sigiloso === true, 'Robô não ficou sigiloso')
    await p.getByText(/Robô/).first().waitFor({ timeout: 10000 })
    await p.screenshot({ path: `${PRINTS}pessoas-25b-7-sigiloso-ines.png` })
    await p.goto(`${APP}/#/projetos`)
    const grupo = p.getByLabel('Grupo de projetos')
    await grupo.waitFor({ timeout: 15000 })
    exigir(
      (await grupo.evaluate(s => s.options[s.selectedIndex].textContent.trim())) === 'Ativos',
      'o filtro de Projetos não abriu em Ativos',
    )
    await ctx.close()
    // A diretora desfaz pela tela.
    await dir.goto(`${APP}/#/projetos/${robo.codigo}`)
    await dir.getByRole('button', { name: 'Visão geral', exact: true }).click()
    await dir.getByRole('button', { name: 'Editar projeto' }).click()
    await campo(dir, 'Visibilidade').selectOption('normal')
    await formulario(dir).getByRole('button', { name: 'Salvar' }).click()
    await toast(dir, 'Projeto atualizado').waitFor({ timeout: 15000 })
    exigir((await api('GET', '/projetos')).find(x => x.codigo === robo.codigo).sigiloso === false, 'Robô continuou sigiloso')
  })

  await passo('8. troca de conta na mesma aba e celular escuro', async () => {
    await biaPag.goto(`${APP}/#/perfil`)
    await biaPag.getByText(EMAIL_PESSOAL).waitFor({ timeout: 10000 })
    await sair(biaPag)
    await entrar(biaPag, CAIO)
    await biaPag.goto(`${APP}/#/perfil`)
    await biaPag.getByRole('button', { name: 'Editar meus dados' }).waitFor({ timeout: 15000 })
    await biaPag.waitForTimeout(500)
    const corpo = await biaPag.locator('body').innerText()
    exigir(!corpo.includes(EMAIL_PESSOAL), 'o e-mail pessoal da Bia apareceu no perfil do Caio')
    exigir(!corpo.includes(MOTIVO), 'o motivo da saída do Tito apareceu no perfil do Caio')
    exigir(corpo.includes(BIO), 'o perfil do Caio não mostra a bio dele')
    await biaPag.screenshot({ path: `${PRINTS}pessoas-25b-8-troca.png` })

    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      colorScheme: 'dark',
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    const cel = await novaPagina(ctx)
    await entrar(cel, DIRETORA)
    await irParaPessoas(cel, EMAIL_TITO)
    exigir(await semRolagemLateral(cel), 'Pessoas com rolagem lateral no celular')
    await cel.screenshot({ path: `${PRINTS}pessoas-25b-8-pessoas-celular.png` })
    await abrirAcao(cel, linhaDe(cel, EMAIL_TITO), 'Editar')
    exigir(await semRolagemLateral(cel), 'janela Editar pessoa com rolagem lateral no celular')
    await cel.screenshot({ path: `${PRINTS}pessoas-25b-8-editar-celular.png` })
    await cel.keyboard.press('Escape')
    await cel.goto(`${APP}/#/perfil`)
    await cel.getByRole('button', { name: 'Editar meus dados' }).waitFor({ timeout: 15000 })
    exigir(await semRolagemLateral(cel), 'Meu perfil com rolagem lateral no celular')
    await cel.screenshot({ path: `${PRINTS}pessoas-25b-8-perfil-celular.png` })
    await ctx.close()
  })

  exigir(!errosConsole.length, `erros no console:\n${errosConsole.join('\n')}`)
} catch (e) {
  falhou = true
  console.log(`FALHA  ${e.message}`)
} finally {
  // Restaura o banco de dev, qualquer que seja o resultado.
  try {
    sql(
      `UPDATE usuarios SET curso = '${antesCaio.curso}', telefone = '${antesCaio.telefone}', bio = ${antesCaio.bio ? `'${antesCaio.bio.replace(/'/g, "''")}'` : 'NULL'} WHERE email = '${CAIO[0]}'`,
    )
    sql(
      "ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_curso_valido; ALTER TABLE usuarios ADD CONSTRAINT usuarios_curso_valido CHECK (curso IS NULL OR curso IN ('Ciência da Computação', 'Engenharia Mecânica', 'Engenharia Elétrica'))",
    )
    sql(`UPDATE usuarios SET email_pessoal = '${antesBiaEmail.replace(/'/g, "''")}' WHERE email = '${BIA[0]}'`)
    sql(`UPDATE projetos SET sigiloso = false WHERE nome = 'Robô'`)
  } catch (e) {
    console.log(`AVISO  não restaurei o banco de dev: ${e.message}`)
  }
  await browser?.close()
}
process.exit(falhou ? 1 : 0)
