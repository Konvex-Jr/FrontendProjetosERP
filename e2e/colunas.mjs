#!/usr/bin/env node
/**
 * Fluxo das colunas do quadro, ponta a ponta, no navegador (tudo pela tela; a API só prepara,
 * confere e desfaz). Usa o projeto "Site institucional (fictício)" dos dados fictícios.
 *
 *   a. líder cria "Homologação", renomeia, sobe uma posição, muda a cor, salva e vê no quadro
 *   b. move uma tarefa para ela pelo menu "Mover para…"
 *   c. exclui a coluna escolhendo o destino; a tarefa aparece no destino
 *   d. troca a coluna concluída (confirma) e o progresso do projeto muda; desfaz
 *   e. membro responsável move a própria tarefa e não vê "Editar colunas"
 *   f. troca de conta na mesma aba: sem botão, sem dados do projeto do líder; sigiloso em resumo sem etapas
 *   g. celular (375 px): o quadro rola na horizontal e "Mover para…" funciona
 *
 * Ao final devolve o projeto como estava (colunas e tarefas) e apaga a tarefa criada: pode rodar de novo.
 * Pré-requisitos como no `levantamento.mjs` (API de dev com dados fictícios, frontend no ar, Playwright):
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/colunas.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex@123'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const TITULO = `E2E colunas ${Date.now()}`

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
const resultado = []
let falhou = false
async function passo(nome, fn) {
  if (falhou) return resultado.push(['PULADO', nome])
  try {
    await fn()
    resultado.push(['ok', nome])
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    await paginaAtual?.screenshot({ path: `${PRINTS}colunas-falha.png` }).catch(() => {})
    resultado.push(['FALHA', nome, e.message])
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
async function abrirProjeto(page, codigo) {
  await page.goto(`${APP}/#/projetos/${codigo}`)
  const k = page.getByRole('button', { name: 'Kanban', exact: true })
  if (await k.count()) await k.click()
  await page.waitForSelector('.kb-et', { timeout: 15000 })
}
const nomesDasColunas = page =>
  page
    .locator('.kb-et .col-k h3 .kc-nome')
    .allTextContents()
    .then(l => l.map(s => s.trim()))
const coluna = (page, nome) => page.locator('.kb-et .col-k').filter({ has: page.locator('h3 .kc-nome', { hasText: nome }) })
const cartao = (page, nome) => coluna(page, nome).locator('.tk').filter({ hasText: TITULO })
const linhaDaColuna = (page, nome) => page.locator('.cl-linha').filter({ has: page.locator(`[aria-label="Cor da coluna ${nome}"]`) })
const abrirEditor = async page => {
  await page.getByRole('button', { name: 'Editar colunas' }).click()
  await page.waitForSelector('.cl-dialog')
}
const salvarEditor = async (page, confirma = false) => {
  await page.click('.cl-dialog button[type=submit]')
  if (confirma) {
    await page.waitForSelector('.swal2-popup')
    await page.click('.swal2-confirm')
  }
  await page.waitForSelector('.cl-dialog', { state: 'detached', timeout: 15000 })
}
async function moverPeloMenu(page, de, para) {
  const c = cartao(page, de)
  // Traz o cartão para a vista e espera a rolagem assentar: o menu fecha ao rolar (no celular o quadro rola de lado).
  await c.scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await c.locator('.cm.t button[aria-label="Ações"]').click()
  await page.locator('.pop [aria-label="Mover para…"]').click()
  await page.locator('.mv [role=menuitem]', { hasText: para }).click()
  await cartao(page, para).waitFor({ timeout: 15000 })
}
// Lê o progresso no cartão do projeto na lista. A tela pode mostrar primeiro a memória da aba:
// espera até o valor bater com o da API (ou 8 s) e devolve o que a tela mostra.
const progressoNaTela = async (page, nome, esperado) => {
  await page.goto(`${APP}/#/projetos`)
  const card = page.locator('.pj', { hasText: nome }).first()
  await card.waitFor({ timeout: 15000 })
  const ler = async () => {
    const m = (await card.textContent()).match(/(\d+)% ·/)
    exigir(m, 'progresso não aparece no cartão do projeto')
    return Number(m[1])
  }
  const fim = Date.now() + 8000
  let v = await ler()
  while (esperado !== undefined && v !== esperado && Date.now() < fim) {
    await page.waitForTimeout(300)
    v = await ler()
  }
  return v
}
const progressoDaApi = async codigo => {
  const t = (await api('GET', '/projetos')).find(p => p.codigo === codigo).tarefas
  return Math.round((t.concluidas / t.total) * 100)
}

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenDir = await entrarApi(...DIRETORA)

const projetos = await api('GET', '/projetos')
const site = projetos.find(p => p.nome.startsWith('Site institucional'))
const sigiloso = projetos.find(p => p.nome.startsWith('Proposta confidencial'))
if (!site || !sigiloso) throw new Error('Rode antes: npm run dados:ficticios (no backend)')
const nomeSite = site.nome
const pessoas = await api('GET', '/usuarios')
const caio = pessoas.find(p => p.email === 'caio@dev.konvex')
// Quem vê o sigiloso só em resumo: gerente que não está na lista de acesso (Inês está; Gil não).
const GERENTE_RESUMO = 'gil@dev.konvex'
exigir(
  pessoas.some(p => p.email === GERENTE_RESUMO),
  `falta ${GERENTE_RESUMO} (gerente fora da lista do sigiloso)`,
)

// Retrato para devolver o projeto como estava.
const antes = await api('GET', `/projetos/${site.codigo}`)
const colunasAntes = antes.colunas.map(c => ({ codigo: c.codigo, nome: c.nome, cor: c.cor, papel: c.papel }))
const tarefasAntes = (await api('GET', `/tarefas?codigoProjeto=${site.codigo}`)).map(t => [t.codigo, t.coluna.codigo])
const entradaAntes = colunasAntes.find(c => c.papel === 'entrada').codigo

let tarefaCriada
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
  tarefaCriada = await api('POST', '/tarefas', {
    codigoProjeto: site.codigo,
    titulo: TITULO,
    dataInicio: new Date().toISOString().slice(0, 10),
    dataFim: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10),
    prioridade: 'P2',
    codigosResponsaveis: [caio.codigo],
  })
  browser = await chromium.launch()
  const page = await nova({ viewport: { width: 1366, height: 900 } })
  await entrar(page, 'bia@dev.konvex', SENHA)
  await abrirProjeto(page, site.codigo)

  await passo('a. líder cria "Homol", salva, reabre e renomeia para "Homologação", sobe e muda a cor', async () => {
    await abrirEditor(page)
    await page.getByRole('button', { name: 'Nova coluna' }).click()
    await page
      .locator('.cl-dialog input[aria-label^="Nome da coluna"]')
      .nth(colunasAntes.length - 1)
      .fill('Homol')
    await salvarEditor(page)
    await coluna(page, 'Homol').waitFor({ timeout: 15000 })
    const criada = (await api('GET', `/projetos/${site.codigo}`)).colunas.find(c => c.nome === 'Homol')
    exigir(criada, 'API não tem a coluna "Homol" salva')
    // Renomear uma coluna já gravada: reabre o editor e muda o nome dela.
    await abrirEditor(page)
    await page
      .locator('.cl-dialog input[aria-label^="Nome da coluna"]')
      .nth(colunasAntes.length - 1)
      .fill('Homologação')
    await page.getByRole('button', { name: 'Subir coluna Homologação' }).click()
    await page.getByRole('button', { name: 'Rosa, cor da coluna Homologação' }).click()
    exigir(
      (await page.getByRole('button', { name: 'Rosa, cor da coluna Homologação' }).getAttribute('aria-pressed')) === 'true',
      'cor rosa não ficou marcada',
    )
    await salvarEditor(page)
    await coluna(page, 'Homologação').waitFor({ timeout: 15000 })
    // Recarrega a página: o que vale é o que o servidor guardou.
    await page.reload()
    await page.waitForSelector('.kb-et', { timeout: 15000 })
    await coluna(page, 'Homologação').waitFor({ timeout: 15000 })
    exigir(
      (await nomesDasColunas(page)).every(n => n !== 'Homol'),
      'nome antigo "Homol" continua no quadro',
    )
    const nomes = await nomesDasColunas(page)
    const i = nomes.findIndex(n => n.includes('Homologação'))
    exigir(i === nomes.length - 3, `Homologação deveria estar antes da penúltima; ordem: ${nomes.join(' | ')}`)
    exigir((await coluna(page, 'Homologação').getAttribute('class')).includes('kc-rosa'), 'coluna sem a cor rosa')
    const servidor = (await api('GET', `/projetos/${site.codigo}`)).colunas.find(c => c.nome === 'Homologação')
    exigir(servidor && servidor.cor === 'rosa', 'API não tem a coluna rosa')
    exigir(servidor.codigo === criada.codigo, 'o renome criou outra coluna em vez de renomear a mesma')
    exigir(!(await api('GET', `/projetos/${site.codigo}`)).colunas.some(c => c.nome === 'Homol'), 'API ainda tem "Homol"')
    await page.screenshot({ path: `${PRINTS}colunas-a.png` })
  })

  await passo('b. move a tarefa para Homologação pelo menu', async () => {
    await moverPeloMenu(page, 'A fazer', 'Homologação')
    const t = (await api('GET', `/tarefas?codigoProjeto=${site.codigo}`)).find(x => x.codigo === tarefaCriada.codigo)
    exigir(t.coluna.nome === 'Homologação', `API diz coluna ${t.coluna.nome}`)
  })

  await passo('c. exclui Homologação escolhendo o destino; a tarefa vai para lá', async () => {
    await abrirEditor(page)
    await page.getByRole('button', { name: 'Excluir coluna Homologação' }).click()
    const linha = page.locator('.cl-excluida')
    exigir((await linha.textContent()).includes('Mover 1 tarefa para'), 'faltou a linha "Mover 1 tarefa para"')
    exigir(await page.locator('.cl-dialog button[type=submit]').isDisabled(), 'Salvar deveria estar desabilitado sem destino')
    await linha.locator('select').selectOption({ label: 'Fazendo' })
    await salvarEditor(page)
    await cartao(page, 'Fazendo').waitFor({ timeout: 15000 })
    exigir((await coluna(page, 'Homologação').count()) === 0, 'Homologação continua no quadro')
  })

  await passo('d. troca a concluída, confirma, o progresso muda; desfaz', async () => {
    const antesPct = await progressoNaTela(page, nomeSite, await progressoDaApi(site.codigo))
    await abrirProjeto(page, site.codigo)
    await abrirEditor(page)
    await linhaDaColuna(page, 'Revisando').getByLabel('concluída').check()
    await salvarEditor(page, true)
    const apiDepois = await progressoDaApi(site.codigo)
    const depoisPct = await progressoNaTela(page, nomeSite, apiDepois)
    exigir(apiDepois !== antesPct, `progresso na API não mudou (${antesPct}% -> ${apiDepois}%)`)
    exigir(depoisPct === apiDepois, `tela ${depoisPct}% x API ${apiDepois}%`)
    await abrirProjeto(page, site.codigo)
    await abrirEditor(page)
    await linhaDaColuna(page, 'Concluído').getByLabel('concluída').check()
    await salvarEditor(page, true)
    const volta = await progressoNaTela(page, nomeSite, antesPct)
    exigir(volta === antesPct, `progresso não voltou (${antesPct}% -> ${volta}%)`)
    console.log(`       progresso (tela Projetos): ${antesPct}% -> ${depoisPct}% -> ${volta}%`)
  })

  await passo('f. líder sai e Davi (outro projeto) entra na mesma aba: sem dados do projeto do líder', async () => {
    // Bia ainda logada: abre o quadro com o botão, passa o mouse no menu e no cartão (enche a memória e a antecipação).
    await abrirProjeto(page, site.codigo)
    await page.getByRole('button', { name: 'Editar colunas' }).waitFor({ timeout: 15000 })
    await page.locator('.cm.t button[aria-label="Ações"]').first().hover()
    for (const rotulo of ['Projetos', 'Tarefas'])
      await page
        .locator('aside, nav')
        .getByText(rotulo, { exact: true })
        .first()
        .hover()
        .catch(() => {})
    await page.waitForTimeout(700)
    await sair(page)
    await entrar(page, 'davi@dev.konvex', SENHA) // membro de outro projeto (só do sigiloso)
    await page.goto(`${APP}/#/projetos`)
    await page.getByText('Proposta confidencial').first().waitFor({ timeout: 15000 })
    await page.waitForLoadState('networkidle')
    let texto = await page.locator('body').innerText()
    exigir(!texto.includes('Site institucional'), 'Projetos mostra o projeto do líder')
    exigir(!texto.includes(TITULO), 'Projetos mostra tarefa do líder')
    exigir(texto.includes('Proposta confidencial'), 'Projetos não mostra o projeto do próprio Davi')
    exigir(!(await page.getByRole('button', { name: 'Editar colunas' }).count()), 'botão "Editar colunas" na lista')
    await page.goto(`${APP}/#/projetos/${site.codigo}`)
    // A API responde 403 e a tela tem que avisar (o aviso cobre a tela): exige, lê e fecha.
    const aviso = page.locator('.swal2-popup:not(.swal2-toast)')
    await aviso.waitFor({ timeout: 10000 })
    const msg = (await aviso.locator('.swal2-html-container').innerText()).trim()
    exigir(/só pode ver os projetos de que participa/.test(msg), `aviso inesperado: "${msg}"`)
    console.log(`       URL direta do projeto alheio: aviso "${msg}"`)
    await page.click('.swal2-confirm')
    texto = await page.locator('body').innerText()
    for (const x of [TITULO, 'Site institucional', 'Em teste', 'Revisando', 'Fazendo', 'A fazer'])
      exigir(!texto.includes(x), `URL direta do projeto mostra "${x}"`)
    exigir(!(await page.getByRole('button', { name: 'Editar colunas' }).count()), 'botão "Editar colunas" no projeto alheio')
    await page.goto(`${APP}/#/tarefas`)
    await page.waitForLoadState('networkidle')
    texto = await page.locator('body').innerText()
    for (const x of [TITULO, 'Site institucional', 'Em teste', 'Revisando'])
      exigir(!texto.includes(x), `Tarefas mostra "${x}" do projeto do líder`)
    exigir(!(await page.getByRole('button', { name: 'Editar colunas' }).count()), 'botão "Editar colunas" em Tarefas')
  })

  await passo('e. membro responsável move a própria tarefa e não vê "Editar colunas"', async () => {
    await sair(page) // Davi sai; Caio entra na mesma aba
    await entrar(page, 'caio@dev.konvex', SENHA)
    await abrirProjeto(page, site.codigo)
    exigir((await page.getByRole('button', { name: 'Editar colunas' }).count()) === 0, 'membro vê "Editar colunas"')
    await moverPeloMenu(page, 'Fazendo', 'Em teste')
    const t = (await api('GET', `/tarefas?codigoProjeto=${site.codigo}`)).find(x => x.codigo === tarefaCriada.codigo)
    exigir(t.coluna.nome === 'Em teste', `API diz coluna ${t.coluna.nome}`)
  })

  await passo('f2. sigiloso visto em resumo não mostra colunas nem etapas', async () => {
    await sair(page)
    await entrar(page, GERENTE_RESUMO, SENHA)
    await page.goto(`${APP}/#/projetos/${sigiloso.codigo}`)
    await page.getByText('você vê só o resumo').waitFor({ timeout: 15000 })
    exigir(!(await page.locator('.kb, .kb-et, .col-k').count()), 'resumo mostra quadro')
    exigir(!(await page.getByRole('button', { name: 'Editar colunas' }).count()), 'resumo mostra "Editar colunas"')
    const texto = await page.locator('body').innerText()
    for (const etapa of ['A fazer', 'Fazendo', 'Em teste', 'Revisando', 'Montar a proposta'])
      exigir(!texto.includes(etapa), `resumo mostra "${etapa}"`)
    await page.screenshot({ path: `${PRINTS}colunas-f2.png` })
  })

  await passo('g. 375 px: quadro rola na horizontal e "Mover para…" funciona', async () => {
    const m = await nova({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
    await entrar(m, 'bia@dev.konvex', SENHA)
    await abrirProjeto(m, site.codigo)
    const medidas = await m.evaluate(() => {
      const kb = document.querySelector('.kb-et')
      const antes = kb.scrollLeft
      kb.scrollLeft = 200
      return {
        rola: kb.scrollWidth > kb.clientWidth,
        moveu: kb.scrollLeft > antes,
        paginaRola: document.documentElement.scrollWidth > window.innerWidth + 1,
      }
    })
    exigir(medidas.rola, 'quadro não tem rolagem horizontal')
    exigir(medidas.moveu, 'quadro não rolou')
    exigir(!medidas.paginaRola, 'a página inteira rola na horizontal')
    await m.evaluate(() => (document.querySelector('.kb-et').scrollLeft = 0))
    await moverPeloMenu(m, 'Em teste', 'Revisando')
    const t = (await api('GET', `/tarefas?codigoProjeto=${site.codigo}`)).find(x => x.codigo === tarefaCriada.codigo)
    exigir(t.coluna.nome === 'Revisando', `API diz coluna ${t.coluna.nome}`)
    await m.screenshot({ path: `${PRINTS}colunas-g.png` })
  })
} catch (e) {
  falhou = true
  resultado.push(['FALHA', 'preparação do navegador', e.message])
  console.log('FALHA preparação:', e.message)
} finally {
  await browser?.close().catch(() => {})
  // Limpeza: apaga a tarefa criada, devolve as colunas e as tarefas ao que eram.
  try {
    if (tarefaCriada) await api('DELETE', `/tarefas/${tarefaCriada.codigo}`)
    const atual = await api('GET', `/projetos/${site.codigo}`)
    const extras = atual.colunas.filter(c => !colunasAntes.some(x => x.codigo === c.codigo))
    await api('PUT', `/projetos/${site.codigo}/colunas`, {
      colunas: colunasAntes,
      destinos: Object.fromEntries(extras.map(c => [c.codigo, entradaAntes])),
    })
    for (const [codigo, col] of tarefasAntes) {
      const t = (await api('GET', `/tarefas?codigoProjeto=${site.codigo}`)).find(x => x.codigo === codigo)
      if (t && t.coluna.codigo !== col) await api('PATCH', `/tarefas/${codigo}/coluna`, { codigoColuna: col })
    }
    const fim = await api('GET', `/projetos/${site.codigo}`)
    const igual =
      JSON.stringify(fim.colunas.map(c => [c.codigo, c.nome, c.cor, c.papel])) ===
      JSON.stringify(colunasAntes.map(c => [c.codigo, c.nome, c.cor, c.papel]))
    const tarefasFim = (await api('GET', `/tarefas?codigoProjeto=${site.codigo}`)).map(t => [t.codigo, t.coluna.codigo])
    const tarefasIguais = JSON.stringify(tarefasFim.sort()) === JSON.stringify([...tarefasAntes].sort())
    console.log(`limpeza: colunas ${igual ? 'iguais' : 'DIFERENTES'}, tarefas ${tarefasIguais ? 'iguais' : 'DIFERENTES'}`)
    if (!igual || !tarefasIguais) falhou = true
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
