#!/usr/bin/env node
/**
 * Projetos internos e geral da área (sessão 23b), ponta a ponta, tudo pela tela (a API só prepara, confere e limpa).
 *
 *   1. diretora cria o projeto interno "Robô e2e" em Inovação: o selo "Interno" aparece
 *   2. Inês (líder de Inovação), na mesma aba, cria tarefa no "Inovação geral" para o Caio e muda a etapa
 *   3. Caio abre Tarefas, vê a tarefa, comenta e conclui
 *   4. Bia (fora de Inovação) não vê a tarefa e vê o geral só como cartão (sessão 27a)
 *   5. Inês abre o próprio perfil: os períodos não têm botões
 *   6. celular (375 px), tema escuro: o filtro de projetos com grupos cabe na tela
 *   7. Lia (papel membro, cargo que lidera Execução), na mesma aba: cria tarefa no geral de Execução para a Bia,
 *      muda a etapa e abre "Editar colunas" (salva sem mudar)
 *
 * Pré-requisitos como no `areas.mjs` (dados fictícios com Robô, Inês e Caio em Inovação, Bia fora):
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/projetos-internos.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex@123'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const SUFIXO = Date.now().toString(36)
const NOME_PROJETO = `Robô e2e ${SUFIXO}`
const TITULO = `Montar braço ${SUFIXO}`
const GERAL = 'Inovação geral'
const GERAL_EXECUCAO = 'Execução geral'
const TITULO_LIA = `Montar bancada ${SUFIXO}`

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
    await paginaAtual?.screenshot({ path: `${PRINTS}projetos-internos-falha.png` }).catch(() => {})
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
  await page.click('.swal2-confirm') // confirma a saída (27c)
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
const detalhes = page => page.getByRole('dialog', { name: 'Detalhes da tarefa' })
const abrirTarefas = async page => {
  await page.goto(`${APP}/#/tarefas`)
  await page.getByRole('heading', { name: 'Tarefas' }).first().waitFor({ timeout: 15000 })
}

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenDir = await entrarApi(...DIRETORA)

const pessoas = await api('GET', '/usuarios')
const caio = pessoas.find(p => p.email === 'caio@dev.konvex')
const areas = await api('GET', '/areas')
const inovacao = areas.find(a => a.nome === 'Inovação')
if (!caio || !inovacao) throw new Error('Rode antes: npm run dados:ficticios (no backend)')
const gerais = (await api('GET', '/projetos?tipo=interno')).filter(p => p.geralDaArea && p.area?.codigo === inovacao.codigo)
if (gerais.length !== 1) throw new Error(`Esperava 1 projeto geral em Inovação, achei ${gerais.length}`)
const [geral] = gerais
for (const [email, esperado] of [
  ['ines@dev.konvex', true],
  ['caio@dev.konvex', true],
  ['bia@dev.konvex', false],
]) {
  const p = pessoas.find(x => x.email === email)
  const emInovacao = (await api('GET', `/usuarios/${p.codigo}/periodos`)).some(x => !x.fim && x.area.codigo === inovacao.codigo)
  if (emInovacao !== esperado) throw new Error(`${email}: período em Inovação deveria ser ${esperado} (dados fictícios)`)
}

const bia = pessoas.find(p => p.email === 'bia@dev.konvex')
const lia = pessoas.find(p => p.email === 'lia@dev.konvex')
const execucao = areas.find(a => a.nome === 'Execução')
if (!lia || !bia || !execucao) throw new Error('Rode antes: npm run dados:ficticios (no backend): falta a Lia')
const geraisExecucao = (await api('GET', '/projetos?tipo=interno')).filter(p => p.geralDaArea && p.area?.codigo === execucao.codigo)
if (geraisExecucao.length !== 1) throw new Error(`Esperava 1 projeto geral em Execução, achei ${geraisExecucao.length}`)
const [geralExecucao] = geraisExecucao

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

  await passo('1. diretora cria o projeto interno em Inovação e vê o selo "Interno"', async () => {
    await entrar(page, ...DIRETORA)
    await page.goto(`${APP}/#/projetos`)
    await page.getByRole('button', { name: 'Novo projeto' }).click()
    await campo(janela(page), 'Nome').fill(NOME_PROJETO)
    await campo(janela(page), 'Tipo').selectOption('interno')
    await campo(janela(page), 'Descrição').fill('Projeto interno criado pelo e2e.')
    await campo(janela(page), 'Início').fill(HOJE)
    await campo(janela(page), 'Fim').fill(FIM)
    await campo(janela(page), 'Área').selectOption({ label: 'Inovação' })
    // Sessão 31b: classe obrigatória no projeto novo.
    await campo(janela(page), 'Classe').selectOption({ label: 'Outro' })
    await janela(page).getByRole('button', { name: 'Salvar' }).click()
    await janela(page).waitFor({ state: 'detached', timeout: 15000 })
    // Depois de salvar a tela abre o projeto novo; volta para a lista para ver o cartão.
    await page.getByRole('heading', { name: NOME_PROJETO }).waitFor({ timeout: 15000 })
    exigir(await page.getByText('Interno', { exact: true }).count(), 'a página do projeto não mostra o selo "Interno"')
    await page.goto(`${APP}/#/projetos`)
    const cartao = page.locator('.card.pj').filter({ has: page.getByRole('heading', { name: NOME_PROJETO }) })
    await cartao.waitFor({ timeout: 15000 })
    exigir(await cartao.getByText('Interno', { exact: true }).count(), 'cartão sem o selo "Interno"')
    const criado = (await api('GET', '/projetos?tipo=interno')).find(p => p.nome === NOME_PROJETO)
    exigir(criado && criado.tipo === 'interno' && criado.area?.codigo === inovacao.codigo, 'API: projeto não ficou interno em Inovação')
    const g = page.locator('.card.pj').filter({ has: page.getByRole('heading', { name: GERAL }) })
    exigir(await g.getByText('Geral da área', { exact: true }).count(), 'o geral de Inovação não mostra o selo "Geral da área"')
    await page.screenshot({ path: `${PRINTS}projetos-internos-1.png` })
    await sair(page)
  })

  await passo('2. gerente (líder de Inovação) cria tarefa no geral para o Caio e muda a etapa', async () => {
    await entrar(page, 'ines@dev.konvex', SENHA)
    await abrirTarefas(page)
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click()
    const dlg = page.getByRole('dialog', { name: 'Nova tarefa' })
    await dlg.waitFor({ timeout: 15000 })
    const opcoesProjeto = await campo(dlg, 'Projeto').locator('option').allInnerTexts()
    exigir(opcoesProjeto.includes(GERAL), 'o geral de Inovação não aparece em "Nova tarefa"')
    await campo(dlg, 'Projeto').selectOption({ label: GERAL })
    await dlg.getByLabel('Título da tarefa').fill(TITULO)
    await campo(dlg, 'Início').fill(HOJE)
    await campo(dlg, 'Fim').fill(FIM)
    await dlg.locator('.ms .mc').click()
    await dlg.locator('.ms .mo').filter({ hasText: 'Caio Membro' }).click()
    await dlg.getByLabel('Título da tarefa').click()
    await dlg.getByRole('button', { name: 'Criar tarefa' }).click()
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    // A gestão abre em "Minhas tarefas"; a tarefa é do Caio.
    await page.getByLabel('Pessoa', { exact: true }).selectOption('')
    await page.getByText(TITULO).first().click()
    await detalhes(page).waitFor()
    await detalhes(page)
      .locator('label')
      .filter({ hasText: /^Etapa/ })
      .locator('select')
      .selectOption({ label: 'Fazendo' })
    await detalhes(page).getByRole('button', { name: 'Salvar alterações' }).click()
    await detalhes(page).waitFor({ state: 'detached', timeout: 15000 })
    const t = (await api('GET', `/tarefas?codigoProjeto=${geral.codigo}`)).find(x => x.titulo === TITULO)
    exigir(t, 'API: tarefa não foi criada no geral')
    exigir(t.coluna?.nome === 'Fazendo', `API: etapa = ${t.coluna?.nome}`)
    exigir(t.responsaveis.includes(caio.codigo) || t.responsaveis.some(r => r.codigo === caio.codigo), 'API: Caio não é responsável')
    await page.screenshot({ path: `${PRINTS}projetos-internos-2.png` })
    await sair(page)
  })

  await passo('3. Caio vê a tarefa, comenta e conclui', async () => {
    await entrar(page, 'caio@dev.konvex', SENHA)
    await abrirTarefas(page)
    await page.getByText(TITULO).first().click()
    await detalhes(page).waitFor()
    await detalhes(page).getByLabel('Novo comentário').fill('Peças chegaram.')
    await detalhes(page).getByRole('button', { name: 'Comentar' }).click()
    await detalhes(page).getByText('Peças chegaram.').waitFor({ timeout: 15000 })
    await detalhes(page).getByRole('button', { name: 'Concluir' }).click()
    await detalhes(page).waitFor({ state: 'detached', timeout: 15000 })
    await page.waitForTimeout(500)
    const t = (await api('GET', `/tarefas?codigoProjeto=${geral.codigo}`)).find(x => x.titulo === TITULO)
    exigir(t.status === 'concluida', `API: status = ${t.status}`)
    const comentarios = await api('GET', `/tarefas/${t.codigo}/comentarios`)
    exigir(
      comentarios.some(c => c.texto === 'Peças chegaram.'),
      'API: comentário não gravado',
    )
    await sair(page)
  })

  await passo('4. Bia (fora de Inovação) não vê a tarefa e vê o geral só como cartão', async () => {
    await entrar(page, 'bia@dev.konvex', SENHA)
    await abrirTarefas(page)
    await page.getByRole('button', { name: 'Tudo o que vejo' }).click()
    await page.waitForLoadState('networkidle')
    exigir(!(await page.getByText(TITULO).count()), 'Bia vê a tarefa de Inovação em Tarefas')
    const filtro = await page.getByLabel('Projeto', { exact: true }).locator('option').allInnerTexts()
    exigir(!filtro.includes(GERAL), 'o filtro de projetos da Bia lista o geral de Inovação')
    await page.goto(`${APP}/#/projetos`)
    // Espera a lista carregar (o geral da própria área aparece) antes de conferir que o de Inovação não aparece.
    await page.getByText('Execução geral').first().waitFor({ timeout: 15000 })
    // Desde a 27a, todo logado vê todos os projetos: o geral de Inovação aparece à Bia só como cartão (sem abrir).
    exigir(
      await page
        .locator('.pj-cartao')
        .filter({ has: page.getByRole('heading', { name: GERAL }) })
        .count(),
      'Bia não vê o cartão do geral de Inovação em Projetos',
    )
    exigir(
      !(await page
        .locator('.card.pj')
        .filter({ has: page.getByRole('heading', { name: GERAL }) })
        .count()),
      'Bia vê o geral de Inovação completo em Projetos',
    )
    await sair(page)
  })

  await passo('5. Inês abre o próprio perfil: períodos sem botões', async () => {
    await entrar(page, 'ines@dev.konvex', SENHA)
    await page.goto(`${APP}/#/perfil`)
    const secao = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Áreas e cargos' }) })
    await secao.locator('.ag.periodo').filter({ hasText: 'Inovação · Gerente' }).waitFor({ timeout: 15000 })
    await page.waitForLoadState('networkidle')
    exigir(!(await secao.getByRole('button', { name: 'Adicionar período' }).count()), 'Inês vê "Adicionar período"')
    exigir(!(await secao.getByRole('button', { name: 'Encerrar' }).count()), 'Inês vê "Encerrar"')
    exigir(!(await secao.locator('.periodo-acoes').count()), 'Inês vê as ações dos períodos')
    await sair(page)
  })

  await passo('6. celular (375 px), escuro: o filtro de projetos com grupos cabe na tela', async () => {
    const m = await nova({ viewport: { width: 375, height: 800 }, colorScheme: 'dark', isMobile: true, hasTouch: true })
    await m.addInitScript(() => localStorage.setItem('tema', 'dark'))
    await entrar(m, 'ines@dev.konvex', SENHA)
    await abrirTarefas(m)
    const seletor = m.getByLabel('Projeto', { exact: true })
    await seletor.waitFor()
    await seletor.locator('optgroup').first().waitFor({ state: 'attached', timeout: 15000 })
    const grupos = await seletor.locator('optgroup').evaluateAll(gs => gs.map(g => g.label))
    exigir(grupos.includes('Inovação') && grupos.includes('Clientes'), `grupos do filtro: ${grupos.join(', ')}`)
    const medidas = await m.evaluate(() => ({
      paginaRola: document.documentElement.scrollWidth > window.innerWidth + 1,
      escuro: document.documentElement.dataset.theme === 'dark',
    }))
    const caixa = await seletor.boundingBox()
    exigir(!medidas.paginaRola, 'a página rola na horizontal')
    exigir(medidas.escuro, 'tema escuro não ligou')
    exigir(caixa.x >= 0 && caixa.x + caixa.width <= 376, `o filtro passa da tela (x=${caixa.x}, largura=${caixa.width})`)
    await m.screenshot({ path: `${PRINTS}projetos-internos-6.png` })
  })

  await passo('7. Lia (membro que lidera Execução) cria tarefa no geral para a Bia, muda a etapa e abre as colunas', async () => {
    // Mesma aba do passo anterior: a conta troca sem recarregar a página.
    await entrar(page, 'lia@dev.konvex', SENHA)
    await abrirTarefas(page)
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click()
    const dlg = page.getByRole('dialog', { name: 'Nova tarefa' })
    await dlg.waitFor({ timeout: 15000 })
    const opcoesProjeto = await campo(dlg, 'Projeto').locator('option').allInnerTexts()
    exigir(opcoesProjeto.includes(GERAL_EXECUCAO), 'o geral de Execução não aparece em "Nova tarefa" para a Lia')
    await campo(dlg, 'Projeto').selectOption({ label: GERAL_EXECUCAO })
    await dlg.getByLabel('Título da tarefa').fill(TITULO_LIA)
    await campo(dlg, 'Início').fill(HOJE)
    await campo(dlg, 'Fim').fill(FIM)
    await dlg.locator('.ms .mc').click()
    await dlg.locator('.ms .mo').filter({ hasText: 'Bia Membro' }).click()
    await dlg.getByLabel('Título da tarefa').click()
    await dlg.getByRole('button', { name: 'Criar tarefa' }).click()
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    await page.getByRole('button', { name: 'Tudo o que vejo' }).click()
    await page.getByText(TITULO_LIA).first().click()
    await detalhes(page).waitFor()
    await detalhes(page)
      .locator('label')
      .filter({ hasText: /^Etapa/ })
      .locator('select')
      .selectOption({ label: 'Fazendo' })
    await detalhes(page).getByRole('button', { name: 'Salvar alterações' }).click()
    await detalhes(page).waitFor({ state: 'detached', timeout: 15000 })
    const t = (await api('GET', `/tarefas?codigoProjeto=${geralExecucao.codigo}`)).find(x => x.titulo === TITULO_LIA)
    exigir(t, 'API: tarefa não foi criada no geral de Execução')
    exigir(t.coluna?.nome === 'Fazendo', `API: etapa = ${t.coluna?.nome}`)
    exigir(t.responsaveis.includes(bia.codigo) || t.responsaveis.some(r => r.codigo === bia.codigo), 'API: Bia não é responsável')
    await page.goto(`${APP}/#/projetos/${geralExecucao.codigo}`)
    await page.getByRole('button', { name: 'Editar colunas' }).click()
    await page.waitForSelector('.cl-dialog', { timeout: 15000 })
    await page.click('.cl-dialog button[type=submit]')
    await page.waitForSelector('.cl-dialog', { state: 'detached', timeout: 15000 })
    await page.screenshot({ path: `${PRINTS}projetos-internos-7.png` })
  })
} catch (e) {
  falhou = true
  console.log('FALHA preparação:', e.message)
} finally {
  await browser?.close().catch(() => {})
  // Limpeza: apaga o projeto interno e a tarefa criados (a tarefa sai junto com o projeto ou pela API).
  try {
    for (const t of (await api('GET', `/tarefas?codigoProjeto=${geral.codigo}`)).filter(x => x.titulo === TITULO))
      await api('DELETE', `/tarefas/${t.codigo}`)
    for (const t of (await api('GET', `/tarefas?codigoProjeto=${geralExecucao.codigo}`)).filter(x => x.titulo === TITULO_LIA))
      await api('DELETE', `/tarefas/${t.codigo}`)
    for (const p of (await api('GET', '/projetos?tipo=interno')).filter(x => x.nome === NOME_PROJETO))
      await api('DELETE', `/projetos/${p.codigo}`)
    const sobrou =
      (await api('GET', `/tarefas?codigoProjeto=${geral.codigo}`)).some(x => x.titulo === TITULO) ||
      (await api('GET', `/tarefas?codigoProjeto=${geralExecucao.codigo}`)).some(x => x.titulo === TITULO_LIA) ||
      (await api('GET', '/projetos?tipo=interno')).some(x => x.nome === NOME_PROJETO)
    console.log(`limpeza: ${sobrou ? 'SOBROU dado do teste' : 'tudo como antes'}`)
    if (sobrou) falhou = true
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
