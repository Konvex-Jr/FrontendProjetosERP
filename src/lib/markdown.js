/**
 * Markdown simples da Base de Inteligência (decisão de 03/11/2026).
 * Só o básico: títulos (#, ##, ###), listas (- ou 1.), citação (>), parágrafos e, no texto,
 * **negrito**, *itálico*, `código` e [link](https://...). Nada de HTML: o resultado vira
 * elementos React (componente Markdown), então não há risco de script no conteúdo.
 */

/** Divide o texto em blocos: { t: 'h', n, texto } | { t: 'ul'|'ol', itens } | { t: 'q'|'p', texto }. */
export function blocos(fonte) {
  const linhas = String(fonte || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const saida = []
  let atual = null
  const fechar = () => {
    if (atual) saida.push(atual)
    atual = null
  }
  for (const bruta of linhas) {
    const linha = bruta.trimEnd()
    let m
    if (!linha.trim()) {
      fechar()
      continue
    }
    if ((m = linha.match(/^(#{1,3})\s+(.*)$/))) {
      fechar()
      saida.push({ t: 'h', n: m[1].length, texto: m[2] })
      continue
    }
    if ((m = linha.match(/^\s*[-*]\s+(.*)$/))) {
      if (atual?.t !== 'ul') {
        fechar()
        atual = { t: 'ul', itens: [] }
      }
      atual.itens.push(m[1])
      continue
    }
    if ((m = linha.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (atual?.t !== 'ol') {
        fechar()
        atual = { t: 'ol', itens: [] }
      }
      atual.itens.push(m[1])
      continue
    }
    if ((m = linha.match(/^>\s?(.*)$/))) {
      if (atual?.t !== 'q') {
        fechar()
        atual = { t: 'q', texto: m[1] }
      } else atual.texto += '\n' + m[1]
      continue
    }
    if (atual?.t === 'p') atual.texto += '\n' + linha
    else {
      fechar()
      atual = { t: 'p', texto: linha }
    }
  }
  fechar()
  return saida
}

const LINK_SEGURO = /^https?:\/\//i

/** Divide uma linha em trechos: { t: 'txt'|'b'|'i'|'code', texto } | { t: 'a', texto, url }. */
export function trechos(texto) {
  const padrao = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)/g
  const saida = []
  let fim = 0,
    m
  const txt = t => t && saida.push({ t: 'txt', texto: t })
  while ((m = padrao.exec(texto))) {
    txt(texto.slice(fim, m.index))
    if (m[1]) saida.push({ t: 'b', texto: m[2] })
    else if (m[3]) saida.push({ t: 'code', texto: m[4] })
    else if (m[5]) saida.push(LINK_SEGURO.test(m[7]) ? { t: 'a', texto: m[6], url: m[7] } : { t: 'txt', texto: m[0] })
    else if (m[8]) saida.push({ t: 'i', texto: m[9] })
    else saida.push({ t: 'i', texto: m[11] })
    fim = padrao.lastIndex
  }
  txt(texto.slice(fim))
  return saida
}
