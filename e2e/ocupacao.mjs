#!/usr/bin/env node
/**
 * Ocupação semanal (sessão 24a), ponta a ponta, tudo pela tela (a API só prepara, confere e limpa).
 *
 *   1. diretora cria uma tarefa de duas semanas para o Caio, classifica como Difícil nos detalhes (já acima de 100%) e vê o aviso
 *   2. diretora abre o perfil do Caio: % acima de 100% com a tarefa listada; "Próxima semana" mostra metade das horas
 *   3. Caio, na mesma aba, vê no próprio perfil a ocupação e a tarefa nova
 *   4. Caio abre o perfil da Bia: tarefa do projeto sigiloso aparece como "Outras tarefas", sem título nem projeto
 *   5. Pessoas mostra a coluna Ocupação; Configurações: diretora muda Média para 5 h e a % da Bia sobe
 *   6. celular (375 px), tema escuro: perfil com a ocupação cabe na tela
 *
 * (O passo 1 classifica a tarefa já na janela "Nova tarefa" da tela do projeto.)
 * Pré-requisitos: dados fictícios (Caio acima de 100% na semana atual; projeto "Proposta confidencial (fictício)"):
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/ocupacao.mjs
 * Ao final devolve as horas padrão (Média 4 h) e apaga o que criou.
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
const TITULO = `Redesenhar o portal ${SUFIXO}`
const TITULO_SIGILOSO = `Revisar a proposta ${SUFIXO}`
const PROJETO = 'Site institucional (fictício)'
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
    await paginaAtual?.screenshot({ path: `${PRINTS}ocupacao-falha.png` }).catch(() => {})
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
const iso = d => d.toISOString().slice(0, 10)
const somar = (isoDia, n) => iso(new Date(new Date(`${isoDia}T00:00:00Z`).getTime() + n * 864e5))
const segunda = isoDia => somar(isoDia, -((new Date(`${isoDia}T00:00:00Z`).getUTCDay() + 6) % 7))
const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const SEGUNDA = segunda(hojeLocal())
const INICIO = SEGUNDA
const FIM = somar(SEGUNDA, 11) // sexta da semana seguinte

const janela = page => page.locator('.modal.d-block form')
const campo = (page, rotulo) =>
  janela(page)
    .locator('label')
    .filter({ hasText: new RegExp(`^${rotulo}`) })
    .locator('select, input, textarea')
const cartaoOcupacao = page => page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Ocupação da semana' }) })
const resumoOcupacao = async page => {
  const cartao = cartaoOcupacao(page)
  const resumo = cartao.locator('b').filter({ hasText: /%/ }).first()
  await resumo.waitFor({ timeout: 15000 })
  const texto = (await resumo.innerText()).replace(/\s+/g, ' ')
  const m = texto.match(/(\d+)% · ([\d,]+) h de ([\d,]+) h/)
  exigir(m, `resumo da ocupação fora do formato: "${texto}"`)
  return { percentual: Number(m[1]), horas: Number(m[2].replace(',', '.')), teto: Number(m[3].replace(',', '.')) }
}
const abrirPerfil = async (page, codigo) => {
  await page.goto(`${APP}/#/perfil/${codigo}`)
  await page.getByRole('heading', { name: 'Ocupação da semana' }).waitFor({ timeout: 15000 })
}

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenDir = await entrarApi(...DIRETORA)
const criadas = []
let horasOriginais

const pessoas = await api('GET', '/usuarios')
const caio = pessoas.find(p => p.email === 'caio@dev.konvex')
const bia = pessoas.find(p => p.email === 'bia@dev.konvex')
const projetos = await api('GET', '/projetos')
const sigiloso = projetos.find(p => p.nome === SIGILOSO)
const projetoSite = projetos.find(p => p.nome === PROJETO)
if (!caio || !bia || !sigiloso) throw new Error('Rode antes: npm run dados:ficticios (no backend)')
horasOriginais = await api('GET', '/config/horas-dificuldade')
const antesCaio = (await api('GET', `/ocupacao/${caio.codigo}`)).percentual
if (antesCaio <= 100) throw new Error(`Caio deveria estar acima de 100% nos dados fictícios (está em ${antesCaio}%)`)

// Preparação: Bia ganha uma tarefa no projeto sigiloso (Caio, de fora, não pode ver o título).
const tarefaSigilosa = await api('POST', '/tarefas', {
  codigoProjeto: sigiloso.codigo,
  titulo: TITULO_SIGILOSO,
  dataInicio: SEGUNDA,
  dataFim: somar(SEGUNDA, 4),
  prioridade: 'P2',
  dificuldade: 'facil',
  codigosResponsaveis: [bia.codigo],
})
criadas.push(tarefaSigilosa.codigo)

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

let percentualBiaAntes
try {
  browser = await chromium.launch()
  const page = await nova({ viewport: { width: 1280, height: 900 } })

  await passo('1. diretora cria, no projeto, tarefa Difícil de duas semanas para o Caio e vê o aviso de ocupação', async () => {
    await entrar(page, ...DIRETORA)
    // Nova tarefa nos dois lugares abre (Tarefas e Projeto); a criação que vale é a do projeto, já com Dificuldade.
    await page.goto(`${APP}/#/tarefas`)
    await page.getByRole('heading', { name: 'Tarefas' }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click()
    await janela(page).waitFor({ timeout: 15000 })
    exigir(await campo(page, 'Dificuldade').count(), 'Nova tarefa (Tarefas) sem o campo Dificuldade')
    await janela(page).getByRole('button', { name: 'Cancelar' }).click()
    await janela(page).waitFor({ state: 'detached', timeout: 15000 })
    await page.goto(`${APP}/#/projetos/${projetoSite.codigo}`)
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click()
    await janela(page).waitFor({ timeout: 15000 })
    await campo(page, 'Título').fill(TITULO)
    await campo(page, 'Início').fill(INICIO)
    await campo(page, 'Fim').fill(FIM)
    const opcoes = await campo(page, 'Dificuldade').locator('option').allInnerTexts()
    exigir(opcoes.includes('Sem classificação') && opcoes.includes('Difícil (8 h)'), `opções de dificuldade: ${opcoes.join(' | ')}`)
    await campo(page, 'Dificuldade').selectOption({ label: 'Difícil (8 h)' })
    await janela(page).locator('.ms .mc').click()
    exigir(
      await janela(page)
        .locator('.ms .mo')
        .filter({ hasText: /Caio Membro · \d+%/ })
        .count(),
      'responsável sem a % na opção',
    )
    await janela(page).locator('.ms .mo').filter({ hasText: 'Caio Membro' }).click()
    await janela(page).getByRole('button', { name: 'Salvar' }).click()
    const aviso = page.locator('.swal2-popup').filter({ hasText: 'Ocupação acima do teto' })
    await aviso.waitFor({ timeout: 15000 })
    const textoAviso = await aviso.innerText()
    exigir(/Caio Membro fica com \d+% na semana de/.test(textoAviso), `texto do aviso: ${textoAviso}`)
    await janela(page).waitFor({ state: 'detached', timeout: 15000 })
    const t = (await api('GET', `/tarefas?codigoProjeto=${projetoSite.codigo}`)).find(x => x.titulo === TITULO)
    exigir(t && t.dificuldade === 'dificil', `API: dificuldade = ${t?.dificuldade}`)
    criadas.push(t.codigo)
    await page.screenshot({ path: `${PRINTS}ocupacao-1.png` })
  })

  await passo('2. perfil do Caio: acima de 100%, tarefa listada; semana seguinte mostra metade das horas', async () => {
    await abrirPerfil(page, caio.codigo)
    const atual = await resumoOcupacao(page)
    exigir(atual.percentual > 100, `% da semana atual = ${atual.percentual}`)
    exigir(await cartaoOcupacao(page).getByText('Acima de 100%').count(), 'faltou o selo "Acima de 100%"')
    const linha = cartaoOcupacao(page).locator('.d-flex').filter({ hasText: TITULO })
    exigir(await linha.count(), 'a tarefa nova não está na lista da semana atual')
    exigir(/4 h/.test(await linha.first().innerText()), `horas da tarefa na semana atual: ${await linha.first().innerText()}`)
    await page.screenshot({ path: `${PRINTS}ocupacao-2a.png` })
    await page.getByRole('button', { name: 'Próxima semana' }).click()
    await page.waitForFunction(t => [...document.querySelectorAll('.card .d-flex')].some(e => e.textContent.includes(t)), TITULO, {
      timeout: 15000,
    })
    const prox = cartaoOcupacao(page).locator('.d-flex').filter({ hasText: TITULO })
    const textoProx = (await prox.first().innerText()).replace(/\s+/g, ' ')
    exigir(/4 h$/.test(textoProx), `semana seguinte: "${textoProx}" (esperava 4 h, metade das 8 h)`)
    const resumoProx = await resumoOcupacao(page)
    exigir(resumoProx.horas < atual.horas, `semana seguinte tem ${resumoProx.horas} h, a atual ${atual.horas} h`)
    await page.screenshot({ path: `${PRINTS}ocupacao-2b.png` })
    await page.getByRole('button', { name: 'Esta semana' }).click()
    await resumoOcupacao(page)
    await sair(page)
  })

  await passo('3. Caio, na mesma aba, vê a própria ocupação e a tarefa nova', async () => {
    await entrar(page, 'caio@dev.konvex', SENHA)
    await page.goto(`${APP}/#/perfil`)
    await page.getByRole('heading', { name: 'Ocupação da semana' }).waitFor({ timeout: 15000 })
    const r = await resumoOcupacao(page)
    exigir(r.percentual > 100, `% do próprio perfil = ${r.percentual}`)
    exigir(await cartaoOcupacao(page).getByText(TITULO).count(), 'a tarefa nova não aparece no perfil do Caio')
  })

  await passo('4. Caio abre o perfil da Bia: tarefa sigilosa aparece como "Outras tarefas", sem título', async () => {
    await abrirPerfil(page, bia.codigo)
    await resumoOcupacao(page)
    const cartao = cartaoOcupacao(page)
    exigir(await cartao.getByText('Outras tarefas').count(), 'faltou a linha "Outras tarefas"')
    exigir(!(await page.getByText(TITULO_SIGILOSO).count()), 'o título da tarefa sigilosa vazou no perfil')
    exigir(!(await page.getByText(SIGILOSO).count()), 'o nome do projeto sigiloso vazou no perfil')
    await page.screenshot({ path: `${PRINTS}ocupacao-4.png` })
    await sair(page)
  })

  await passo('5. Pessoas mostra a Ocupação; Configurações: Média para 5 h e a % da Bia sobe', async () => {
    await entrar(page, ...DIRETORA)
    await page.getByRole('heading', { name: 'Olá, Diretora.' }).waitFor({ timeout: 15000 })
    await page.goto(`${APP}/#/usuarios`)
    await page.getByRole('heading', { name: 'Pessoas' }).first().waitFor({ timeout: 15000 })
    const linhaBia = page.locator('tr').filter({ hasText: 'Bia Membro' })
    await linhaBia.waitFor({ timeout: 15000 })
    exigir(await page.locator('th').filter({ hasText: 'Ocupação' }).count(), 'Pessoas sem a coluna Ocupação')
    exigir(/\d+%/.test(await linhaBia.innerText()), 'a linha da Bia não mostra a %')
    await abrirPerfil(page, bia.codigo)
    percentualBiaAntes = await resumoOcupacao(page)
    await page.goto(`${APP}/#/configuracoes`)
    await page.getByRole('button', { name: 'Dificuldade' }).click()
    exigir(await page.getByText('4 h', { exact: true }).count(), 'a lista não mostra "4 h" para Média')
    await page.getByRole('button', { name: 'Editar horas' }).click()
    await campo(page, 'Média').fill('5')
    await janela(page).getByRole('button', { name: 'Salvar' }).click()
    await janela(page).waitFor({ state: 'detached', timeout: 15000 })
    await page.getByText('5 h', { exact: true }).first().waitFor({ timeout: 15000 })
    await abrirPerfil(page, bia.codigo)
    // A tela pode mostrar primeiro a memória da aba e atualizar logo depois: espera a %, sem se prender à 1ª leitura.
    let depois = await resumoOcupacao(page)
    for (let i = 0; i < 20 && depois.percentual === percentualBiaAntes.percentual; i++) {
      await page.waitForTimeout(250)
      depois = await resumoOcupacao(page)
    }
    exigir(
      depois.percentual > percentualBiaAntes.percentual,
      `% da Bia não mudou: ${percentualBiaAntes.percentual}% -> ${depois.percentual}%`,
    )
    await page.screenshot({ path: `${PRINTS}ocupacao-5.png` })
    // O cache por aba não pode esconder o novo valor: recarrega a página e confere de novo.
    await page.reload()
    await page.getByRole('heading', { name: 'Ocupação da semana' }).waitFor({ timeout: 15000 })
    exigir((await resumoOcupacao(page)).percentual === depois.percentual, 'após recarregar a % da Bia mudou')
    await sair(page)
  })

  await passo('6. celular (375 px), escuro: perfil com a ocupação cabe na tela', async () => {
    const m = await nova({ viewport: { width: 375, height: 800 }, colorScheme: 'dark', isMobile: true, hasTouch: true })
    await m.addInitScript(() => localStorage.setItem('tema', 'dark'))
    await entrar(m, 'caio@dev.konvex', SENHA)
    await abrirPerfil(m, caio.codigo)
    await resumoOcupacao(m)
    const medidas = await m.evaluate(() => ({
      paginaRola: document.documentElement.scrollWidth > window.innerWidth + 1,
      escuro: document.documentElement.dataset.theme === 'dark',
    }))
    const caixa = await cartaoOcupacao(m).boundingBox()
    exigir(!medidas.paginaRola, 'a página rola na horizontal')
    exigir(medidas.escuro, 'tema escuro não ligou')
    exigir(caixa.x >= 0 && caixa.x + caixa.width <= 376, `o cartão passa da tela (x=${caixa.x}, largura=${caixa.width})`)
    await m.screenshot({ path: `${PRINTS}ocupacao-6.png` })
  })
} catch (e) {
  falhou = true
  console.log('FALHA preparação:', e.message)
} finally {
  await browser?.close().catch(() => {})
  // Limpeza: horas padrão de volta e tarefas criadas apagadas.
  try {
    await api('PUT', '/config/horas-dificuldade', horasOriginais)
    for (const c of criadas) await api('DELETE', `/tarefas/${c}`).catch(() => {})
    const horas = await api('GET', '/config/horas-dificuldade')
    const sobrou =
      JSON.stringify(horas) !== JSON.stringify(horasOriginais) ||
      (await api('GET', `/tarefas?codigoProjeto=${sigiloso.codigo}`)).some(x => x.titulo === TITULO_SIGILOSO) ||
      (await api('GET', `/tarefas?codigoProjeto=${projetos.find(p => p.nome === PROJETO).codigo}`)).some(x => x.titulo === TITULO)
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
