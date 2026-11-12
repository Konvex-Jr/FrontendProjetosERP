import { request } from './api.js'
import { adaptAnexo } from './anexos.js'

/**
 * Chamadas diretas do módulo Documentos (sessão 9).
 * Substituem o caminho antigo (up('g') / up('d') + persistCollection).
 * A API só devolve as pastas que a pessoa pode ler (sigilo); pasta proibida responde 404.
 */
const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, auth: true, body })

/** Níveis de sigilo (decisão de 03/11/2026); mesma lista da API. */
export const SIGILOS = [
  ['todos', 'Todos'],
  ['gestao', 'Só gestão'],
  ['projeto', 'Equipe de um projeto'],
]
export const rotuloSigilo = pasta =>
  pasta.sigilo === 'projeto' ? `Equipe: ${pasta.projetoNome || 'projeto'}` : SIGILOS.find(([k]) => k === pasta.sigilo)?.[1] || 'Todos'

export const adaptPasta = p => ({
  id: p.codigo,
  nome: p.nome,
  sigilo: p.sigilo || 'todos',
  projetoId: p.projeto?.codigo || '',
  projetoNome: p.projeto?.nome || '',
})

/** Documento é um link (Drive etc.) ou, desde a sessão 12c, um arquivo guardado no sistema (`anexo`). */
export const adaptDocumento = d => ({
  id: d.codigo,
  pastaId: d.pasta?.codigo || '',
  nome: d.nome,
  url: d.arquivoUrl || '',
  anexo: d.anexo ? adaptAnexo(d.anexo) : null,
  // No filtro "Onde está", todos os arquivos ficam juntos em "Arquivo"; o tamanho aparece na célula.
  dominio: d.anexo ? 'Arquivo' : dominio(d.arquivoUrl),
  data: String(d.dataEnvio || '').slice(0, 10),
  autor: d.autor?.nomeExibicao || d.autor?.nome || '—',
})

export function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Aceita "drive.google.com/..." e completa com https://. */
export const normalizarLink = url => {
  const texto = String(url || '').trim()
  return !texto || /^https?:\/\//i.test(texto) ? texto : `https://${texto}`
}

export const corpoPasta = v => ({
  nome: (v.nome || '').trim(),
  sigilo: v.sigilo || 'todos',
  codigoProjeto: v.sigilo === 'projeto' ? v.projetoId || null : null,
})

/** Documento de arquivo só muda o nome (o link não se aplica). */
export const corpoDocumento = (v, ehArquivo = false) =>
  ehArquivo ? { nome: (v.nome || '').trim() } : { nome: (v.nome || '').trim(), arquivoUrl: normalizarLink(v.url) }

export async function listarPastasComContagem() {
  const pastas = (await get('/pastas')).map(adaptPasta)
  const docs = await Promise.all(pastas.map(p => get(`/pastas/${p.id}/documentos`)))
  return pastas.map((p, i) => ({ ...p, total: docs[i].length }))
}
export const listarDocumentos = async codigoPasta => (await get(`/pastas/${codigoPasta}/documentos`)).map(adaptDocumento)
export const salvarPasta = (v, codigo) =>
  codigo ? send('PUT', `/pastas/${codigo}`, corpoPasta(v)) : send('POST', '/pastas', corpoPasta(v))
export const excluirPasta = codigo => send('DELETE', `/pastas/${codigo}`)
export const salvarDocumento = (codigoPasta, v, codigo, ehArquivo = false) =>
  codigo
    ? send('PUT', `/documentos/${codigo}`, corpoDocumento(v, ehArquivo))
    : send('POST', `/pastas/${codigoPasta}/documentos`, corpoDocumento(v))
export const excluirDocumento = codigo => send('DELETE', `/documentos/${codigo}`)
