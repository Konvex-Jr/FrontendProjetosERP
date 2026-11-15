import { request } from './api.js'
import { itemBibliotecaDaApi } from '../lib/apiMappers.js'

/**
 * Biblioteca (sessão 17): substitui pastas/documentos, Base de Inteligência e iniciativas.
 * Item que a pessoa não pode ver responde 404; a API devolve `podeAlterar` em cada item.
 */
const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, auth: true, body })

export const SIGILOS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'gestao', rotulo: 'Só gestão' },
  { valor: 'projeto', rotulo: 'Equipe do projeto' },
]

/** Membro não usa `gestao`; gestor usa todos. */
export const sigilosPermitidos = gestor => (gestor ? SIGILOS : SIGILOS.filter(s => s.valor !== 'gestao'))

/** Filtros da tela → query string da API (só os preenchidos). */
export function consulta(f = {}) {
  const q = new URLSearchParams()
  const mapa = { q: f.q?.trim(), tag: f.tag, projeto: f.projeto, sigilo: f.sigilo, autor: f.autor }
  Object.entries(mapa).forEach(([k, v]) => v && q.set(k, v))
  const texto = q.toString()
  return texto ? `?${texto}` : ''
}

const codigoOuNull = valor => (typeof valor === 'string' ? valor.trim() : valor) || null

/** Corpo do POST: sem projeto vai `codigoProjeto: null`. */
export const corpoCriacao = d => ({
  titulo: (d.titulo || '').trim(),
  conteudo: d.conteudo || '',
  links: d.links || [],
  tags: d.tags || [],
  sigilo: d.sigilo || 'todos',
  codigoProjeto: codigoOuNull(d.codigoProjeto),
})

/**
 * Corpo do PUT (parcial na API). `codigoProjeto` só vai quando mudou em relação a `original`
 * (null remove o projeto); assim um item cujo projeto está oculto para a pessoa não é desligado
 * por engano. Sem `original`, vai o que veio em `dados`.
 */
export function corpoEdicao(d, original) {
  const corpo = {}
  if (d.titulo !== undefined) corpo.titulo = String(d.titulo).trim()
  if (d.conteudo !== undefined) corpo.conteudo = d.conteudo
  if (d.links !== undefined) corpo.links = d.links
  if (d.tags !== undefined) corpo.tags = d.tags
  if (d.sigilo !== undefined) corpo.sigilo = d.sigilo
  if (d.codigoProjeto !== undefined) {
    const novo = codigoOuNull(d.codigoProjeto)
    if (!original || novo !== (original.projeto?.codigo ?? null)) corpo.codigoProjeto = novo
  }
  return corpo
}

export const biblioteca = {
  listar: async filtros => (await get(`/biblioteca${consulta(filtros)}`)).map(itemBibliotecaDaApi),
  obter: async codigo => itemBibliotecaDaApi(await get(`/biblioteca/${codigo}`)),
  criar: async dados => itemBibliotecaDaApi(await send('POST', '/biblioteca', corpoCriacao(dados))),
  editar: async (codigo, dados, original) =>
    itemBibliotecaDaApi(await send('PUT', `/biblioteca/${codigo}`, corpoEdicao(dados, original))),
  excluir: codigo => send('DELETE', `/biblioteca/${codigo}`),
}
