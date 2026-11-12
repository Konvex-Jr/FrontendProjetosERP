import { request } from './api.js'
import { normalizarLink } from './documentos.js'

/**
 * Base de Inteligência (sessão 12a). Todos leem e cadastram; a API devolve `podeAlterar`
 * em cada item (autor ou gestão), então a tela não repete a regra.
 * As categorias vêm da API (GET /conhecimento/categorias), lugar único da lista.
 */
const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, auth: true, body })

export const adaptConhecimento = c => ({
  id: c.codigo,
  titulo: c.titulo,
  categoria: c.categoria,
  resumo: c.resumo || '',
  conteudo: c.conteudo || '',
  fonte: c.fonte || '',
  links: c.links || [],
  tags: c.tags || [],
  data: String(c.data || '').slice(0, 10),
  autorId: c.autor?.codigo || '',
  autor: c.autor?.nome || '—',
  projetos: (c.projetos || []).map(p => ({ id: p.codigo, nome: p.nome })),
  // Iniciativas que usam o item (sessão 12b; a ligação é feita na iniciativa).
  iniciativas: (c.iniciativas || []).map(i => ({ id: i.codigo, nome: i.nome })),
  podeAlterar: Boolean(c.podeAlterar),
  atualizadoEm: c.atualizadoEm || '',
  // Arquivos anexados (sessão 12c), no formato da API; o componente Anexos adapta.
  anexos: c.anexos || [],
})

export const rotuloCategoria = (categorias, valor) => (categorias || []).find(c => c.valor === valor)?.rotulo || valor

/** Filtros da tela → query string da API (só os preenchidos). */
export function consulta(f = {}) {
  const q = new URLSearchParams()
  const mapa = {
    busca: f.busca?.trim(),
    categoria: f.categoria,
    tag: f.tag,
    codigoAutor: f.autor,
    codigoProjeto: f.projeto,
    de: f.de,
    ate: f.ate,
  }
  Object.entries(mapa).forEach(([k, v]) => v && q.set(k, v))
  const texto = q.toString()
  return texto ? `?${texto}` : ''
}

/** Períodos do filtro (rótulos curtos). Devolve a data inicial em aaaa-mm-dd; a final é hoje. */
export const PERIODOS = [
  ['30d', 'Últimos 30 dias'],
  ['6m', 'Últimos 6 meses'],
  ['12m', 'Último ano'],
  ['ano', 'Este ano'],
]
export function inicioDoPeriodo(periodo, hoje = new Date()) {
  const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()))
  if (periodo === '30d') d.setUTCDate(d.getUTCDate() - 30)
  else if (periodo === '6m') d.setUTCMonth(d.getUTCMonth() - 6)
  else if (periodo === '12m') d.setUTCFullYear(d.getUTCFullYear() - 1)
  else if (periodo === 'ano') d.setUTCMonth(0, 1)
  else return ''
  return d.toISOString().slice(0, 10)
}

/** Texto do formulário ("a, #b, a") → lista sem repetição. */
export const lerTags = texto => [
  ...new Set(
    String(texto || '')
      .split(',')
      .map(t => t.trim().replace(/^#+/, '').toLowerCase())
      .filter(Boolean),
  ),
]
/** Um link por linha; completa https:// como nos documentos. */
export const lerLinks = texto =>
  String(texto || '')
    .split(/\n+/)
    .map(normalizarLink)
    .filter(Boolean)

export const valoresConhecimento = (item, inicial = {}) =>
  item
    ? {
        titulo: item.titulo,
        categoria: item.categoria,
        resumo: item.resumo,
        conteudo: item.conteudo,
        fonte: item.fonte,
        links: item.links.join('\n'),
        tags: item.tags.join(', '),
        data: item.data,
        projetos: item.projetos.map(p => p.id),
      }
    : { categoria: 'pesquisa', data: new Date().toISOString().slice(0, 10), projetos: [], ...inicial }

export const corpoConhecimento = v => ({
  titulo: (v.titulo || '').trim(),
  categoria: v.categoria,
  resumo: (v.resumo || '').trim(),
  conteudo: v.conteudo || '',
  fonte: (v.fonte || '').trim() || null,
  links: lerLinks(v.links),
  tags: lerTags(v.tags),
  data: v.data || null,
  codigosProjetos: v.projetos || [],
})

export const conhecimento = {
  categorias: () => get('/conhecimento/categorias'),
  listar: async filtros => (await get(`/conhecimento${consulta(filtros)}`)).map(adaptConhecimento),
  buscar: async codigo => adaptConhecimento(await get(`/conhecimento/${codigo}`)),
  salvar: (v, codigo) =>
    codigo ? send('PUT', `/conhecimento/${codigo}`, corpoConhecimento(v)) : send('POST', '/conhecimento', corpoConhecimento(v)),
  excluir: codigo => send('DELETE', `/conhecimento/${codigo}`),
}
