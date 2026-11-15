import { request } from './api.js'
import { itemBibliotecaDaApi } from '../lib/apiMappers.js'
import { anexos, conferirArquivo } from './anexos.js'

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
  editar: async (codigo, dados, original) => itemBibliotecaDaApi(await send('PUT', `/biblioteca/${codigo}`, corpoEdicao(dados, original))),
  excluir: codigo => send('DELETE', `/biblioteca/${codigo}`),
}

/* ---------- Formulário da tela (pages/Biblioteca.jsx) ---------- */

export const LIMITE_TITULO = 160
export const SEM_CONTEUDO = 'Preencha um texto, um link ou escolha um arquivo.'

/** Tags separadas por vírgula → minúsculas, sem #, sem repetição. */
export const lerTags = texto => [
  ...new Set(
    String(texto || '')
      .split(',')
      .map(t => t.trim().replace(/^#+/, '').toLowerCase())
      .filter(Boolean),
  ),
]

// Esquema escrito (javascript:, ftp://...). "site.com:8080" não conta: depois dos dois-pontos vem número.
const ESQUEMA = /^[a-z][a-z0-9+.-]*:(?!\d)/i
const completarLink = url => (!url || ESQUEMA.test(url) ? url : `https://${url}`)

/** Um link por linha; sem esquema, completa https://. */
export const lerLinks = texto =>
  String(texto || '')
    .split(/\n+/)
    .map(l => completarLink(l.trim()))
    .filter(Boolean)

/** Valores do formulário: item existente vira texto; item novo começa com `inicial` (ex.: o projeto da aba). */
export const valoresBiblioteca = (item, inicial = {}) =>
  item
    ? {
        titulo: item.titulo,
        codigoProjeto: item.projeto?.codigo || '',
        sigilo: item.sigilo,
        conteudo: item.conteudo,
        links: item.links.join('\n'),
        tags: item.tags.join(', '),
        arquivos: [],
      }
    : { titulo: '', codigoProjeto: '', sigilo: 'todos', conteudo: '', links: '', tags: '', arquivos: [], ...inicial }

/** Formulário → dados de `criar`/`editar` (os arquivos vão depois, por `enviarArquivos`). */
export const dadosBiblioteca = v => ({
  titulo: (v.titulo || '').trim(),
  codigoProjeto: v.codigoProjeto || null,
  sigilo: v.sigilo || 'todos',
  conteudo: v.conteudo || '',
  links: lerLinks(v.links),
  tags: lerTags(v.tags),
})

/**
 * Mensagem do que impede salvar, ou '' se pode. A API confere de novo; aqui evita criar o item
 * e só depois descobrir o erro. `original` é o item em edição: os anexos que ele já tem contam como conteúdo.
 */
export function problemaBiblioteca(v, original) {
  const titulo = (v.titulo || '').trim()
  if (!titulo) return 'Preencha o título.'
  if (titulo.length > LIMITE_TITULO) return `O título pode ter até ${LIMITE_TITULO} caracteres.`
  // Item "projeto" com o projeto escondido para a pessoa (veio null): sem mudar, a API mantém o gravado.
  const projetoOculto = original?.sigilo === 'projeto' && !original.projeto
  if (v.sigilo === 'projeto' && !v.codigoProjeto && !projetoOculto) return 'Escolha o projeto: o sigilo "Equipe do projeto" precisa de um.'
  const links = lerLinks(v.links)
  if (links.some(l => !/^https?:\/\//i.test(l))) return 'Os links precisam começar com http:// ou https://.'
  const arquivos = v.arquivos || []
  for (const arquivo of arquivos) {
    const problema = conferirArquivo(arquivo)
    if (problema) return `${arquivo.name}: ${problema}`
  }
  const temConteudo = (v.conteudo || '').trim() || links.length || arquivos.length || original?.anexos?.length
  return temConteudo ? '' : SEM_CONTEUDO
}

/** Envia os arquivos ao item, um por vez, sem parar no primeiro erro. Devolve os que falharam. */
export async function enviarArquivos(codigo, arquivos, enviar = anexos.enviar) {
  const falhas = []
  for (const arquivo of arquivos || []) {
    try {
      await enviar('biblioteca', codigo, arquivo)
    } catch (error) {
      falhas.push({ nome: arquivo.name, erro: error.message })
    }
  }
  return falhas
}
