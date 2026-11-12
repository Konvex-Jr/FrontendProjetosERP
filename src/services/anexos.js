import { baixar, request } from './api.js'

/**
 * Anexos (sessão 12c, decisões de 09/11/2026): até 20 MB, documentos e imagens.
 * A API confere de novo; aqui a conferência só evita esperar o envio para saber do erro.
 * O arquivo vai como bytes no corpo, com o nome no cabeçalho X-Nome-Arquivo.
 */
export const LIMITE_BYTES = 20 * 1024 * 1024
export const EXTENSOES = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'csv',
  'txt',
  'md',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'zip',
]
export const ACEITA = EXTENSOES.map(e => `.${e}`).join(',')
export const DICA = 'Até 20 MB. PDF, Word, Excel, PowerPoint, OpenDocument, CSV, TXT, imagens ou ZIP.'

export const extensao = nome => (/\.([A-Za-z0-9]{1,5})$/.exec(String(nome || '').trim())?.[1] || '').toLowerCase()

/** Mensagem do problema com o arquivo, ou '' se ele pode ser enviado. */
export function conferirArquivo(arquivo) {
  if (!arquivo) return 'Escolha um arquivo.'
  if (!EXTENSOES.includes(extensao(arquivo.name))) return `Tipo de arquivo não aceito. ${DICA}`
  if (!arquivo.size) return 'O arquivo está vazio.'
  if (arquivo.size > LIMITE_BYTES) return 'O arquivo passa de 20 MB, o tamanho máximo.'
  return ''
}

/** 1234567 → "1,2 MB". */
export function tamanhoLegivel(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

export const adaptAnexo = a => ({
  id: a.codigo,
  nome: a.nome,
  tamanho: tamanhoLegivel(a.tamanhoBytes),
  enviadoPor: a.enviadoPor?.nome || '—',
  data: String(a.enviadoEm || '').slice(0, 10),
})

const enviarBytes = (path, arquivo) =>
  request(path, {
    method: 'POST',
    auth: true,
    body: arquivo,
    headers: { 'Content-Type': 'application/octet-stream', 'X-Nome-Arquivo': encodeURIComponent(arquivo.name) },
  })

export const anexos = {
  /** `dono`: 'conhecimento' ou 'iniciativas'. */
  enviar: (dono, codigo, arquivo) => enviarBytes(`/${dono}/${codigo}/anexos`, arquivo),
  /** Documento do tipo arquivo numa pasta (gestão). */
  enviarDocumento: (codigoPasta, arquivo) => enviarBytes(`/pastas/${codigoPasta}/documentos/arquivo`, arquivo),
  excluir: codigo => request(`/anexos/${codigo}`, { method: 'DELETE', auth: true }),
  /** Baixa pela API (o token vai no cabeçalho) e entrega ao navegador com o nome original. */
  async baixar(anexo) {
    const blob = await baixar(`/anexos/${anexo.id}`)
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: anexo.nome })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  },
}
