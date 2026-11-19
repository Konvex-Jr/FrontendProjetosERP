#!/usr/bin/env node
/**
 * Ajustes de tarefas (sessão 24b), ponta a ponta, tudo pela tela (a API só confere e limpa).
 *
 *   1. diretora, em Tarefas: Nova tarefa no Site com Bia e Caio, item da Bia e etapa "Em teste"; troca para
 *      "Inovação geral" na janela: Bia sai dos responsáveis e do item, etapa volta para "A fazer"; cria a tarefa
 *   2. Caio (membro), com filtro que esconderia a tarefa, cria tarefa completa: descrição, item já marcado,
 *      item com responsável e 2 anexos (um com nome longo demais, que a API recusa): aviso
 *      "Alguns anexos não foram enviados" e a tarefa criada abre; sem alteração, fecha direto
 *   3. Caio muda a prioridade da própria tarefa e a nova prioridade aparece ao reabrir
 *   4. aviso ao fechar: com alteração pede "Descartar alterações?" (X e Esc); marcar item e fechar não pergunta;
 *      ao reabrir o item segue marcado
 *   5. filtro "Atrasadas" no quadro do projeto
 *   6. Caio conclui pela etapa, corrige "Concluída em" para uma data passada e a data aparece ao reabrir
 *   7. filtros de Tarefas voltam ao sair e voltar à tela; Sair e entrar como Bia na mesma aba: filtros no padrão
 *   8. Configurações → Áreas: campo "Projeto geral"; desligar na Inovação (geral com 1 tarefa) mostra a mensagem;
 *      desligar em Projetos (geral vazio) tira o geral da lista; religar traz um geral novo
 *   9. celular (375 px), escuro: janela de criação com item e responsável cabe na tela
 *
 * Pré-requisitos: dados fictícios no backend (Site institucional com Bia líder e Caio na equipe):
 *   API_URL=http://localhost:5002 APP_URL=http://localhost:5173 node e2e/tarefas-24b.mjs
 * Ao final apaga as tarefas criadas (pela API).
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:5001').replace(/\/$/, '')
const PRINTS = new URL('./prints/', import.meta.url).pathname
const SENHA = 'Konvex123'
const DIRETORA = [process.env.ADMIN_EMAIL || 'dev@konvexjr.com.br', process.env.ADMIN_PASSWORD || 'konvex-dev']
const CAIO = ['caio@dev.konvex', SENHA]
const BIA = ['bia@dev.konvex', SENHA]
const SUFIXO = Date.now().toString(36)
const TITULO_GERAL = `Pesquisar ferramentas ${SUFIXO}`
const TITULO = `Montar a página de contato ${SUFIXO}`
const ITEM_A = 'Rascunhar o texto'
const ITEM_B = 'Revisar com a líder'
const PROJETO = 'Site institucional (fictício)'
const ANEXO_OK = `briefing-${SUFIXO}.txt`
const ANEXO_RUIM = `${'nome-longo-'.repeat(28)}${SUFIXO}.txt` // passa de 255 caracteres: a API recusa (400)

function carregarPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return require(`${global}/playwright`)
  }
}

// ---------- API (só conferência e limpeza) ----------
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
const resultados = []
async function passo(nome, fn) {
  if (falhou) {
    resultados.push(['PULADO', nome])
    return console.log(`PULADO ${nome}`)
  }
  try {
    await fn()
    resultados.push(['ok', nome])
    console.log(`ok     ${nome}`)
  } catch (e) {
    falhou = true
    resultados.push(['FALHA', nome])
    await paginaAtual?.screenshot({ path: `${PRINTS}tarefas-24b-falha.png` }).catch(() => {})
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
const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const br = isoDia => `${isoDia.slice(8)}/${isoDia.slice(5, 7)}` // como o fm da tela (dd/mm)
const HOJE = hojeLocal()
const INICIO = somar(HOJE, -10)
const FIM = somar(HOJE, -3) // já passou: a tarefa nasce atrasada
const CONCLUIDA_EM = somar(HOJE, -8)

// Janelas e campos.
const nova = page => page.getByRole('dialog', { name: 'Nova tarefa' })
const detalhes = page => page.getByRole('dialog', { name: 'Detalhes da tarefa' })
const campo = (dlg, rotulo) =>
  dlg
    .locator('label')
    .filter({ hasText: new RegExp(`^${rotulo}`) })
    .locator('select, input, textarea')
    .first()
const formulario = page => page.locator('.modal.d-block form')
const campoForm = (page, rotulo) =>
  formulario(page)
    .locator('label')
    .filter({ hasText: new RegExp(`^${rotulo}`) })
    .locator('select, input, textarea')
const alerta = page => page.locator('.swal2-popup:not(.swal2-toast)')
const toast = (page, texto) => page.locator('.swal2-toast').filter({ hasText: texto })
const menu = (page, rotulo) => page.locator(`#menu a[aria-label="${rotulo}"]`).click()
const opcaoSelecionada = sel => sel.evaluate(s => s.options[s.selectedIndex]?.textContent.trim())
const responsaveisNaJanela = async dlg => (await dlg.locator('.ms .mc').innerText()).replace(/×/g, '').replace(/\s+/g, ' ').trim()
const fechadaSemPergunta = async (page, dlg) => {
  await dlg.waitFor({ state: 'detached', timeout: 5000 })
  exigir(!(await alerta(page).count()), 'apareceu uma pergunta ao fechar sem alteração')
}
// Seguro para a pergunta "Descartar alterações?" (o SweetAlert anima e pode demorar um instante).
const esperarPergunta = async page => {
  const a = alerta(page)
  await a.waitFor({ timeout: 10000 })
  const titulo = (await a.locator('.swal2-title').innerText()).trim()
  return { a, titulo }
}
const fecharAlerta = async (page, botao = '.swal2-confirm') => {
  await alerta(page).locator(botao).click()
  await alerta(page).waitFor({ state: 'detached', timeout: 10000 })
}
const abrirNoTarefas = async (page, titulo) => {
  const cartao = page.locator('.tk').filter({ hasText: titulo })
  await cartao.first().waitFor({ timeout: 15000 })
  await cartao.first().click()
  await detalhes(page).waitFor({ timeout: 15000 })
  return detalhes(page)
}
const irTarefas = async page => {
  await menu(page, 'Tarefas')
  await page.getByRole('heading', { name: 'Tarefas' }).first().waitFor({ timeout: 15000 })
}
const estadoFiltros = async page => ({
  minhas: await page.getByRole('button', { name: 'Minhas tarefas', exact: true }).evaluate(b => b.classList.contains('on')),
  tudo: await page.getByRole('button', { name: 'Tudo o que vejo', exact: true }).evaluate(b => b.classList.contains('on')),
  projeto: await opcaoSelecionada(page.getByLabel('Projeto', { exact: true })),
  situacao: await opcaoSelecionada(page.getByLabel('Situação', { exact: true })),
  prazo: await opcaoSelecionada(page.getByLabel('Prazo', { exact: true })),
  kanban: await page.getByRole('button', { name: 'Kanban', exact: true }).evaluate(b => b.classList.contains('on')),
  lista: await page.getByRole('button', { name: 'Lista', exact: true }).evaluate(b => b.classList.contains('on')),
})

// ---------- principal ----------
const { chromium } = carregarPlaywright()
mkdirSync(PRINTS, { recursive: true })
tokenDir = await entrarApi(...DIRETORA)
const tarefasCriadas = async () => {
  const todas = []
  for (const p of await api('GET', '/projetos')) todas.push(...(await api('GET', `/tarefas?codigoProjeto=${p.codigo}`)))
  return todas.filter(t => t.titulo.endsWith(SUFIXO))
}
const projetos = await api('GET', '/projetos')
const site = projetos.find(p => p.nome === PROJETO)
const inovacaoGeral = projetos.find(p => p.nome === 'Inovação geral')
if (!site || !inovacaoGeral) throw new Error('Rode antes: npm run dados:ficticios (no backend)')
const areasAntes = await api('GET', '/areas')
const areaProjetos = areasAntes.find(a => a.nome === 'Projetos')
const areaInovacao = areasAntes.find(a => a.nome === 'Inovação')
if (!areaProjetos?.temGeral || !areaInovacao?.temGeral) throw new Error('As áreas Projetos e Inovação deveriam ter projeto geral ligado')

let browser
const errosConsole = []
const esperados = { 400: 0, 409: 0 }
const abrirAba = async opcoes => {
  const ctx = await browser.newContext(opcoes)
  const page = await ctx.newPage()
  paginaAtual = page
  // Erros esperados (anexo recusado no passo 2: 400; área com geral com tarefa no passo 8: 409) não contam.
  page.on('response', r => {
    if (r.status() === 400 && /\/tarefas\/[^/]+\/anexos$/.test(r.url())) esperados[400]++
    if (r.status() === 409 && /\/areas\/[^/]+$/.test(r.url())) esperados[409]++
  })
  page.on('console', m => {
    if (m.type() !== 'error') return
    const st = /status of (400|409)/.exec(m.text())?.[1]
    if (st && esperados[st] > 0) return esperados[st]--
    errosConsole.push(m.text())
  })
  page.on('pageerror', e => errosConsole.push(e.message))
  return page
}

try {
  browser = await chromium.launch()
  const page = await abrirAba({ viewport: { width: 1280, height: 900 } })

  await passo('1. diretora troca o projeto na janela de criação: responsáveis, item e etapa se refazem; cria no geral', async () => {
    await entrar(page, ...DIRETORA)
    await irTarefas(page)
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click()
    const dlg = nova(page)
    await dlg.waitFor({ timeout: 15000 })
    await campo(dlg, 'Projeto').selectOption({ label: PROJETO })
    await dlg.locator('.ms .mc').click()
    await dlg.locator('.ms .mo').filter({ hasText: 'Bia Membro' }).click()
    await dlg.locator('.ms .mo').filter({ hasText: 'Caio Membro' }).click()
    await dlg.getByLabel('Título da tarefa').click() // fecha a lista de pessoas
    let resp = await responsaveisNaJanela(dlg)
    exigir(resp.includes('Bia Membro') && resp.includes('Caio Membro'), `responsáveis no Site: "${resp}"`)
    await dlg.getByLabel('Novo item do checklist').fill('Levantar opções')
    await dlg.getByRole('button', { name: 'Adicionar', exact: true }).click()
    await dlg.getByLabel('Responsável pelo item Levantar opções').selectOption({ label: 'Bia Membro' })
    await campo(dlg, 'Etapa').selectOption({ label: 'Em teste' })
    // Troca para o geral da Inovação (equipe: Inês e Caio; sem a etapa "Em teste").
    await campo(dlg, 'Projeto').selectOption({ label: 'Inovação geral' })
    resp = await responsaveisNaJanela(dlg)
    exigir(!resp.includes('Bia Membro'), `Bia continuou responsável depois da troca: "${resp}"`)
    exigir(resp.includes('Caio Membro'), `Caio saiu dos responsáveis: "${resp}"`)
    const respItem = await opcaoSelecionada(dlg.getByLabel('Responsável pelo item Levantar opções'))
    exigir(respItem === 'Ninguém', `responsável do item depois da troca: ${respItem}`)
    const etapa = await opcaoSelecionada(campo(dlg, 'Etapa'))
    exigir(etapa === 'A fazer', `etapa depois da troca: ${etapa}`)
    const etapas = await campo(dlg, 'Etapa').locator('option').allInnerTexts()
    exigir(!etapas.includes('Em teste'), `etapas do geral ainda mostram "Em teste": ${etapas.join(' | ')}`)
    await dlg.getByLabel('Título da tarefa').fill(TITULO_GERAL)
    await campo(dlg, 'Início').fill(HOJE)
    await campo(dlg, 'Fim').fill(somar(HOJE, 7))
    await page.screenshot({ path: `${PRINTS}tarefas-24b-1.png` })
    await dlg.getByRole('button', { name: 'Criar tarefa' }).click()
    await toast(page, 'Tarefa criada').waitFor({ timeout: 15000 })
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    const t = (await api('GET', `/tarefas?codigoProjeto=${inovacaoGeral.codigo}`)).find(x => x.titulo === TITULO_GERAL)
    exigir(t, 'a tarefa não foi criada no geral da Inovação')
    const nomes = (t.responsaveis || []).map(r => r.nome)
    exigir(nomes.length === 1 && nomes[0] === 'Caio Membro', `API: responsáveis = ${nomes.join(', ')}`)
    exigir(t.checklist?.length === 1 && !t.checklist[0].responsavel, `API: item = ${JSON.stringify(t.checklist)}`)
    await sair(page)
  })

  await passo('2. Caio cria tarefa completa (item marcado, item com responsável, anexo recusado): aviso e a tarefa abre', async () => {
    await entrar(page, ...CAIO)
    await irTarefas(page)
    // Filtro que esconderia a tarefa nova (ela nasce em "A fazer").
    await page.getByLabel('Situação', { exact: true }).selectOption({ label: 'Concluída' })
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click()
    const dlg = nova(page)
    await dlg.waitFor({ timeout: 15000 })
    await campo(dlg, 'Projeto').selectOption({ label: PROJETO })
    // O nome ganha a % da ocupação quando ela carrega ("Caio Membro · 133%").
    const doMembro = await responsaveisNaJanela(dlg)
    exigir(/^Caio Membro( · \d+%)?$/.test(doMembro), `responsáveis do membro: "${doMembro}"`)
    await dlg.getByLabel('Título da tarefa').fill(TITULO)
    await dlg.getByLabel('Descrição').fill('Formulário com nome, e-mail e mensagem.')
    for (const item of [ITEM_A, ITEM_B]) {
      await dlg.getByLabel('Novo item do checklist').fill(item)
      await dlg.getByLabel('Novo item do checklist').press('Enter')
    }
    await dlg.getByLabel(`Marcar ${ITEM_A}`).check()
    await dlg.getByLabel(`Responsável pelo item ${ITEM_B}`).selectOption({ label: 'Caio Membro' })
    await campo(dlg, 'Início').fill(INICIO)
    await campo(dlg, 'Fim').fill(FIM)
    await dlg.locator('input[type=file]').setInputFiles([
      { name: ANEXO_OK, mimeType: 'text/plain', buffer: Buffer.from('Briefing da página de contato.\n') },
      { name: ANEXO_RUIM, mimeType: 'text/plain', buffer: Buffer.from('nome longo demais\n') },
    ])
    exigir(await dlg.getByText(ANEXO_OK).count(), 'o anexo escolhido não aparece na janela')
    await page.screenshot({ path: `${PRINTS}tarefas-24b-2a.png` })
    await dlg.getByRole('button', { name: 'Criar tarefa' }).click()
    const { a, titulo } = await esperarPergunta(page)
    exigir(titulo === 'Alguns anexos não foram enviados', `aviso: "${titulo}"`)
    const textoAviso = await a.locator('.swal2-html-container').innerText()
    exigir(textoAviso.includes(SUFIXO + '.txt'), `o aviso não cita o arquivo recusado: ${textoAviso.slice(0, 200)}`)
    exigir(!textoAviso.includes(ANEXO_OK), 'o aviso cita o arquivo que subiu')
    await fecharAlerta(page)
    // A tarefa criada abre mesmo com o filtro que a esconderia.
    const aberta = detalhes(page)
    await aberta.waitFor({ timeout: 15000 })
    exigir((await aberta.getByLabel('Título da tarefa').inputValue()) === TITULO, 'abriu outra tarefa')
    exigir((await aberta.getByLabel('Descrição').inputValue()).startsWith('Formulário'), 'descrição não gravada')
    exigir(await aberta.getByLabel(`Marcar ${ITEM_A}`).isChecked(), `"${ITEM_A}" não nasceu marcado`)
    exigir(!(await aberta.getByLabel(`Marcar ${ITEM_B}`).isChecked()), `"${ITEM_B}" nasceu marcado`)
    const respB = await opcaoSelecionada(aberta.getByLabel(`Responsável pelo item ${ITEM_B}`))
    exigir(respB === 'Caio Membro', `responsável de "${ITEM_B}": ${respB}`)
    await aberta.getByText(ANEXO_OK).first().waitFor({ timeout: 15000 })
    exigir(
      !(await aberta
        .getByText(SUFIXO + '.txt')
        .filter({ hasNotText: 'briefing' })
        .count()),
      'o anexo recusado aparece na lista',
    )
    exigir(
      (await opcaoSelecionada(page.getByLabel('Situação', { exact: true }))) === 'Situação: todas',
      'o filtro de situação não foi limpo',
    )
    await page.screenshot({ path: `${PRINTS}tarefas-24b-2b.png` })
    // Sem alteração: fecha direto.
    await aberta.getByRole('button', { name: 'Fechar', exact: true }).first().click()
    await fechadaSemPergunta(page, aberta)
  })

  await passo('3. Caio (criador, membro) muda a prioridade da própria tarefa', async () => {
    let dlg = await abrirNoTarefas(page, TITULO)
    exigir(!(await campo(dlg, 'Prioridade').isDisabled()), 'Prioridade travada para o criador')
    await campo(dlg, 'Prioridade').selectOption('P1')
    await dlg.getByRole('button', { name: 'Salvar alterações' }).click()
    await toast(page, 'Tarefa salva').waitFor({ timeout: 15000 })
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    dlg = await abrirNoTarefas(page, TITULO)
    exigir((await campo(dlg, 'Prioridade').inputValue()) === 'P1', 'a prioridade não ficou P1 ao reabrir')
    await dlg.getByRole('button', { name: 'Fechar', exact: true }).first().click()
    await fechadaSemPergunta(page, dlg)
  })

  await passo('4. aviso ao fechar com alteração (X e Esc); marcar item e fechar sem aviso; item segue marcado', async () => {
    let dlg = await abrirNoTarefas(page, TITULO)
    await dlg.getByLabel('Título da tarefa').fill(TITULO + ' (rascunho)')
    await dlg.getByRole('button', { name: 'Fechar', exact: true }).first().click()
    let pergunta = await esperarPergunta(page)
    exigir(pergunta.titulo === 'Descartar alterações?', `pergunta: "${pergunta.titulo}"`)
    await fecharAlerta(page, '.swal2-cancel')
    exigir(await dlg.isVisible(), 'a janela fechou depois de "Cancelar"')
    exigir((await dlg.getByLabel('Título da tarefa').inputValue()).endsWith('(rascunho)'), 'o rascunho se perdeu')
    await page.keyboard.press('Escape')
    pergunta = await esperarPergunta(page)
    exigir(pergunta.titulo === 'Descartar alterações?', `pergunta no Esc: "${pergunta.titulo}"`)
    await alerta(page).getByRole('button', { name: 'Descartar' }).click()
    await dlg.waitFor({ state: 'detached', timeout: 10000 })
    dlg = await abrirNoTarefas(page, TITULO)
    exigir((await dlg.getByLabel('Título da tarefa').inputValue()) === TITULO, 'o título descartado foi gravado')
    // Marcar grava na hora e não conta como alteração.
    await dlg.getByLabel(`Marcar ${ITEM_B}`).check()
    // Confere na API (só conferência) que a marcação já foi gravada.
    let gravado = false
    for (let i = 0; i < 30 && !gravado; i++) {
      const t = (await api('GET', `/tarefas?codigoProjeto=${site.codigo}`)).find(x => x.titulo === TITULO)
      gravado = t?.checklist?.find(x => x.texto === ITEM_B)?.feito === true
      if (!gravado) await page.waitForTimeout(300)
    }
    exigir(gravado, `API: "${ITEM_B}" não ficou marcado`)
    await dlg.getByRole('button', { name: 'Fechar', exact: true }).first().click()
    await fechadaSemPergunta(page, dlg)
    dlg = await abrirNoTarefas(page, TITULO)
    exigir(await dlg.getByLabel(`Marcar ${ITEM_B}`).isChecked(), `"${ITEM_B}" desmarcou ao reabrir`)
    exigir(await dlg.getByLabel(`Marcar ${ITEM_A}`).isChecked(), `"${ITEM_A}" desmarcou ao reabrir`)
    await dlg.getByRole('button', { name: 'Fechar', exact: true }).first().click()
    await fechadaSemPergunta(page, dlg)
  })

  await passo('5. filtro "Atrasadas" no quadro do projeto', async () => {
    await menu(page, 'Projetos')
    await page.getByText(PROJETO).first().click()
    await page.getByRole('heading', { name: PROJETO }).waitFor({ timeout: 15000 })
    const cartoes = page.locator('.tk')
    await cartoes.filter({ hasText: TITULO }).first().waitFor({ timeout: 15000 })
    const total = await cartoes.count()
    await page.getByLabel('Prazo', { exact: true }).selectOption({ label: 'Atrasadas' })
    await cartoes.filter({ hasText: TITULO }).first().waitFor({ timeout: 5000 })
    const atrasadas = await cartoes.count()
    exigir(atrasadas < total, `"Atrasadas" não escondeu nada (${atrasadas} de ${total})`)
    await page.screenshot({ path: `${PRINTS}tarefas-24b-5.png` })
    await page.getByLabel('Prazo', { exact: true }).selectOption({ label: 'Vencem esta semana' })
    await page.waitForTimeout(300)
    exigir(!(await cartoes.filter({ hasText: TITULO }).count()), 'a tarefa atrasada aparece em "Vencem esta semana"')
    await page.getByLabel('Prazo', { exact: true }).selectOption({ label: 'Prazo: todos' })
    await cartoes.filter({ hasText: TITULO }).first().waitFor({ timeout: 5000 })
  })

  await passo('6. Caio conclui pela etapa, corrige "Concluída em" para data passada e ela aparece ao reabrir', async () => {
    const abrir = async () => {
      await page.locator('.tk').filter({ hasText: TITULO }).first().click()
      await detalhes(page).waitFor({ timeout: 15000 })
      return detalhes(page)
    }
    let dlg = await abrir()
    await campo(dlg, 'Etapa').selectOption({ label: 'Concluído' })
    await dlg.getByRole('button', { name: 'Salvar alterações' }).click()
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    dlg = await abrir()
    const data = campo(dlg, 'Concluída em')
    await data.waitFor({ timeout: 10000 })
    exigir((await data.inputValue()) === HOJE, `"Concluída em" ao concluir: ${await data.inputValue()} (esperava ${HOJE})`)
    await data.fill(CONCLUIDA_EM)
    await dlg.getByRole('button', { name: 'Salvar alterações' }).click()
    await toast(page, 'Tarefa salva').waitFor({ timeout: 15000 })
    await dlg.waitFor({ state: 'detached', timeout: 15000 })
    dlg = await abrir()
    exigir(
      (await campo(dlg, 'Concluída em').inputValue()) === CONCLUIDA_EM,
      `"Concluída em" ao reabrir: ${await campo(dlg, 'Concluída em').inputValue()}`,
    )
    const sub = await dlg.locator('small').first().innerText()
    exigir(sub.includes(`concluída em ${br(CONCLUIDA_EM)}`), `subtítulo: "${sub}"`)
    await page.screenshot({ path: `${PRINTS}tarefas-24b-6.png` })
    await dlg.getByRole('button', { name: 'Fechar', exact: true }).first().click()
    await fechadaSemPergunta(page, dlg)
    const t = (await api('GET', `/tarefas?codigoProjeto=${site.codigo}`)).find(x => x.titulo === TITULO)
    exigir(String(t?.dataConclusao || '').startsWith(CONCLUIDA_EM), `API: dataConclusao = ${t?.dataConclusao}`)
  })

  await passo('7. filtros de Tarefas voltam ao voltar à tela; Sair e entrar como Bia na mesma aba: padrão', async () => {
    await irTarefas(page)
    await page.getByRole('button', { name: 'Tudo o que vejo', exact: true }).click()
    await page.getByLabel('Projeto', { exact: true }).selectOption({ label: PROJETO })
    await page.getByLabel('Prazo', { exact: true }).selectOption({ label: 'Atrasadas' })
    await page.getByRole('button', { name: 'Lista', exact: true }).click()
    const esperado = {
      minhas: false,
      tudo: true,
      projeto: PROJETO,
      situacao: 'Situação: todas',
      prazo: 'Atrasadas',
      kanban: false,
      lista: true,
    }
    await menu(page, 'Projetos')
    await page.getByRole('heading', { name: 'Projetos' }).first().waitFor({ timeout: 15000 })
    await irTarefas(page)
    const voltou = await estadoFiltros(page)
    exigir(JSON.stringify(voltou) === JSON.stringify(esperado), `filtros ao voltar: ${JSON.stringify(voltou)}`)
    await sair(page)
    const padrao = {
      minhas: true,
      tudo: false,
      projeto: 'Projeto: todos',
      situacao: 'Situação: todas',
      prazo: 'Prazo: todos',
      kanban: true,
      lista: false,
    }
    await entrar(page, ...BIA)
    await irTarefas(page)
    const daBia = await estadoFiltros(page)
    exigir(JSON.stringify(daBia) === JSON.stringify(padrao), `filtros da Bia: ${JSON.stringify(daBia)}`)
    await sair(page)
    // Caio de novo: o fim da sessão também apagou os filtros dele.
    await entrar(page, ...CAIO)
    await irTarefas(page)
    const deNovo = await estadoFiltros(page)
    exigir(JSON.stringify(deNovo) === JSON.stringify(padrao), `filtros do Caio depois de sair: ${JSON.stringify(deNovo)}`)
    await sair(page)
  })

  await passo('8. Configurações → Áreas: "Projeto geral"; geral com tarefa não desliga; geral vazio desliga e religa', async () => {
    await entrar(page, ...DIRETORA)
    await page.goto(`${APP}/#/configuracoes`)
    await page.getByRole('button', { name: 'Áreas', exact: true }).click()
    exigir(await page.locator('th').filter({ hasText: 'Projeto geral' }).count(), 'tabela de áreas sem a coluna "Projeto geral"')
    // Linha pela 1ª célula (o nome "Projetos" também aparece em "Área superior" das outras).
    const linhaArea = nome => page.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^${nome}$`) }) })
    const editar = async nome => {
      await linhaArea(nome).getByRole('button', { name: 'Editar' }).click()
      await formulario(page).waitFor({ timeout: 10000 })
    }
    // Inovação: o geral tem a tarefa do passo 1.
    await editar('Inovação')
    exigir((await opcaoSelecionada(campoForm(page, 'Projeto geral'))) === 'Sim', 'Projeto geral da Inovação não está "Sim"')
    await campoForm(page, 'Projeto geral').selectOption({ label: 'Não' })
    await formulario(page).getByRole('button', { name: 'Salvar' }).click()
    const { a, titulo } = await esperarPergunta(page)
    const msg = await a.locator('.swal2-html-container').innerText()
    exigir(titulo === 'Não foi possível salvar', `título do erro: "${titulo}"`)
    exigir(msg.includes('O projeto geral desta área tem 1 tarefa.'), `mensagem: "${msg}"`)
    await page.screenshot({ path: `${PRINTS}tarefas-24b-8a.png` })
    await fecharAlerta(page)
    if (await formulario(page).count()) await formulario(page).getByRole('button', { name: 'Cancelar' }).click()
    await formulario(page).waitFor({ state: 'detached', timeout: 10000 })
    exigir((await api('GET', '/areas')).find(x => x.nome === 'Inovação').temGeral, 'API: Inovação ficou sem geral')
    // Projetos: geral vazio. Desliga, some da lista de projetos; religa, volta.
    await editar('Projetos')
    await campoForm(page, 'Projeto geral').selectOption({ label: 'Não' })
    await formulario(page).getByRole('button', { name: 'Salvar' }).click()
    await toast(page, 'Área salva').waitFor({ timeout: 15000 })
    const linha = linhaArea('Projetos')
    exigir((await linha.innerText()).includes('Não'), `linha da área Projetos: ${await linha.innerText()}`)
    await menu(page, 'Projetos')
    await page.getByRole('heading', { name: 'Projetos' }).first().waitFor({ timeout: 15000 })
    await page.getByText(PROJETO).first().waitFor({ timeout: 15000 })
    exigir(!(await page.getByText('Projetos geral', { exact: true }).count()), '"Projetos geral" segue na lista de projetos')
    exigir(await page.getByText('Inovação geral', { exact: true }).count(), '"Inovação geral" sumiu da lista')
    await page.screenshot({ path: `${PRINTS}tarefas-24b-8b.png` })
    await menu(page, 'Configurações')
    await page.getByRole('button', { name: 'Áreas', exact: true }).click()
    await editar('Projetos')
    await campoForm(page, 'Projeto geral').selectOption({ label: 'Sim' })
    await formulario(page).getByRole('button', { name: 'Salvar' }).click()
    await toast(page, 'Área salva').waitFor({ timeout: 15000 })
    await menu(page, 'Projetos')
    await page.getByText('Projetos geral', { exact: true }).first().waitFor({ timeout: 15000 })
    await sair(page)
  })

  await passo('9. celular (375 px), escuro: janela de criação com item e responsável cabe na tela', async () => {
    const m = await abrirAba({ viewport: { width: 375, height: 800 }, colorScheme: 'dark', isMobile: true, hasTouch: true })
    await m.addInitScript(() => localStorage.setItem('tema', 'dark'))
    await entrar(m, ...CAIO)
    await m.goto(`${APP}/#/tarefas`)
    await m.getByRole('heading', { name: 'Tarefas' }).first().waitFor({ timeout: 15000 })
    await m.getByRole('button', { name: 'Nova tarefa' }).first().click()
    const dlg = nova(m)
    await dlg.waitFor({ timeout: 15000 })
    await campo(dlg, 'Projeto').selectOption({ label: PROJETO })
    await dlg.getByLabel('Título da tarefa').fill('Tarefa no celular com um título bem comprido para quebrar a linha')
    await dlg.getByLabel('Novo item do checklist').fill('Item com um texto comprido para ver a quebra no celular')
    await dlg.getByRole('button', { name: 'Adicionar', exact: true }).click()
    const seletor = dlg.getByLabel('Responsável pelo item Item com um texto comprido para ver a quebra no celular')
    await seletor.selectOption({ label: 'Caio Membro' })
    const medidas = await m.evaluate(() => ({
      paginaRola: document.documentElement.scrollWidth > window.innerWidth + 1,
      escuro: document.documentElement.dataset.theme === 'dark',
    }))
    exigir(!medidas.paginaRola, 'a página rola na horizontal')
    exigir(medidas.escuro, 'tema escuro não ligou')
    const caixaJanela = await dlg.locator('.modal-content').boundingBox()
    exigir(
      caixaJanela.x >= 0 && caixaJanela.x + caixaJanela.width <= 376,
      `a janela passa da tela (x=${caixaJanela.x}, w=${caixaJanela.width})`,
    )
    const item = dlg.locator('.ck-item').first()
    const caixaItem = await item.boundingBox()
    exigir(
      caixaItem.x >= caixaJanela.x && caixaItem.x + caixaItem.width <= caixaJanela.x + caixaJanela.width + 1,
      `o item do checklist passa da janela (x=${caixaItem.x}, w=${caixaItem.width})`,
    )
    for (const el of [seletor, item.getByLabel('Remover item'), dlg.locator('.av-item').first()]) {
      const c = await el.boundingBox()
      exigir(c && c.x >= 0 && c.x + c.width <= 376, `um controle do item passa da tela (x=${c?.x}, w=${c?.width})`)
    }
    await item.scrollIntoViewIfNeeded()
    await m
      .locator('.swal2-toast')
      .waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => {}) // "Login realizado"
    await m.screenshot({ path: `${PRINTS}tarefas-24b-9a.png` })
    await dlg.locator('input[type=file]').waitFor({ state: 'attached' })
    await dlg.getByRole('button', { name: 'Criar tarefa' }).scrollIntoViewIfNeeded()
    await m.screenshot({ path: `${PRINTS}tarefas-24b-9b.png` })
    // Com alteração: fechar pergunta; descarta.
    await dlg.getByRole('button', { name: 'Cancelar' }).click()
    const { titulo } = await esperarPergunta(m)
    exigir(titulo === 'Descartar alterações?', `pergunta: "${titulo}"`)
    await alerta(m).getByRole('button', { name: 'Descartar' }).click()
    await dlg.waitFor({ state: 'detached', timeout: 10000 })
  })
} catch (e) {
  falhou = true
  console.log('FALHA preparação:', e.message)
} finally {
  await browser?.close().catch(() => {})
  // Limpeza: tarefas criadas apagadas; área Projetos com o geral ligado.
  try {
    for (const t of await tarefasCriadas()) await api('DELETE', `/tarefas/${t.codigo}`).catch(() => {})
    const proj = (await api('GET', '/areas')).find(a => a.nome === 'Projetos')
    if (proj && !proj.temGeral)
      await api('PUT', `/areas/${proj.codigo}`, {
        nome: proj.nome,
        codigoAreaPai: proj.codigoAreaPai,
        ativa: proj.ativa,
        temGeral: true,
      }).catch(e => console.log('aviso: não religou o geral de Projetos:', e.message))
    const sobrou = (await tarefasCriadas()).length > 0
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
const ok = resultados.filter(([s]) => s === 'ok').length
console.log(`\n${ok}/${resultados.length} passos ok`)
console.log(falhou ? 'FALHOU' : 'Todos os passos ok')
process.exit(falhou ? 1 : 0)
