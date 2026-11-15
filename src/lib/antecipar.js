import { memoria } from './memoria.js'

// Um mesmo item do menu só antecipa os dados uma vez nesse intervalo: passar o mouse
// várias vezes seguidas não pode virar uma rajada de chamadas à API.
const INTERVALO = 10_000
const ultimaVez = new Map()

// Baixa no tempo ocioso do navegador, para não disputar com a tela que está abrindo.
const agendarPadrao = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn) : setTimeout(fn, 0))

/**
 * Agenda o download do arquivo de cada tela do menu (`.precarregar()` de carregarPagina).
 * Quando a pessoa clicar, a tela já está no navegador. Falhas são ignoradas: a tela tenta de
 * novo ao abrir, e aí vale a guarda de versão nova do carregarPagina.
 */
export function precarregarPaginas(caminhos, paginas, agendar = agendarPadrao) {
  for (const caminho of caminhos) {
    const pagina = paginas[caminho]
    if (typeof pagina?.precarregar !== 'function') continue
    agendar(() => {
      try {
        Promise.resolve(pagina.precarregar()).catch(() => {})
      } catch {
        /* falha ao baixar: a tela tenta de novo quando abrir */
      }
    })
  }
}

/**
 * Busca os dados de uma tela de lista antes do clique (mouse em cima, foco ou toque no item
 * do menu), gravando na memória com a mesma chave e a mesma função da tela (`dadosDaTela`).
 * A tela abre com o dado pronto. Usa o módulo da página baixado pelo `.precarregar()`, para
 * não trazer as páginas para o pacote de entrada.
 * `contexto` = { me, mb, pode, nav } do useApp(). Só age em caminho do menu da pessoa logada.
 * `opcoes.paginas` = caminho → componente (src/paginas.js); `opcoes.agora` serve aos testes.
 */
export async function anteciparDados(caminho, contexto, { paginas, agora = Date.now } = {}) {
  const { me, nav = [] } = contexto || {}
  if (!me || !nav.some(([, , c]) => c === caminho)) return
  const pagina = paginas?.[caminho]
  if (typeof pagina?.precarregar !== 'function') return

  const item = `${me}:${caminho}`
  const instante = agora()
  if (instante - (ultimaVez.get(item) ?? -Infinity) < INTERVALO) return
  ultimaVez.set(item, instante)

  try {
    const modulo = await pagina.precarregar()
    if (typeof modulo?.dadosDaTela !== 'function') return
    const { chave, carregar } = modulo.dadosDaTela(contexto)
    await memoria.buscar(chave, carregar)
  } catch {
    // Antecipar é só um atalho: se falhar, a tela busca de novo ao abrir e mostra o erro lá.
  }
}

/** Zera o intervalo entre antecipações (usado nos testes). */
export function esquecerAntecipacoes() {
  ultimaVez.clear()
}
