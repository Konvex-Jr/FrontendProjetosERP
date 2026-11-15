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

/** Tipos que o navegador mostra sem baixar. O tipo do Blob vem daqui (pela extensão), nunca da resposta. */
export const VISUALIZAVEIS = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}
export const podeVer = nome => Object.hasOwn(VISUALIZAVEIS, extensao(nome))

/** O que fazer ao clicar em abrir: PDF no celular não abre bem em janela nova, então baixa. */
export const acaoAoAbrir = (nome, celular) => (!podeVer(nome) || (celular && extensao(nome) === 'pdf') ? 'baixar' : 'janela')

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
  ext: extensao(a.nome),
  tamanho: tamanhoLegivel(a.tamanhoBytes),
  enviadoPor: a.enviadoPor?.nome || '—',
  data: String(a.enviadoEm || '').slice(0, 10),
  podeExcluir: a.podeExcluir,
})

const enviarBytes = (path, arquivo) =>
  request(path, {
    method: 'POST',
    auth: true,
    body: arquivo,
    headers: { 'Content-Type': 'application/octet-stream', 'X-Nome-Arquivo': encodeURIComponent(arquivo.name) },
  })

export const anexos = {
  /** `dono`: 'biblioteca' ou 'tarefas'. */
  enviar: (dono, codigo, arquivo) => enviarBytes(`/${dono}/${codigo}/anexos`, arquivo),
  excluir: codigo => request(`/anexos/${codigo}`, { method: 'DELETE', auth: true }),
  /** Baixa pela API e devolve um endereço local para abrir em janela; o chamador revoga com `URL.revokeObjectURL`. */
  async abrir(anexo) {
    if (!podeVer(anexo.nome)) throw new Error('Este tipo de arquivo não abre aqui. Baixe para ver.')
    const tipo = VISUALIZAVEIS[extensao(anexo.nome)]
    const blob = await baixar(`/anexos/${anexo.id}`)
    return { url: URL.createObjectURL(new Blob([blob], { type: tipo })), tipo }
  },
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

/**
 * Envia os arquivos ao dono, um por vez, sem parar no primeiro erro; o que falha na conferência nem chama a API.
 * `aoAvancar(atual, total)` é chamado antes de cada arquivo (para a tela mostrar "Enviando 2 de 5…").
 */
export async function enviarVarios(dono, codigo, arquivos, enviar = anexos.enviar, aoAvancar) {
  const lista = [...(arquivos || [])]
  const falhas = []
  let enviados = 0
  for (const [i, arquivo] of lista.entries()) {
    aoAvancar?.(i + 1, lista.length)
    const problema = conferirArquivo(arquivo)
    if (problema) {
      falhas.push({ nome: arquivo?.name || '', erro: problema })
      continue
    }
    try {
      await enviar(dono, codigo, arquivo)
      enviados++
    } catch (error) {
      falhas.push({ nome: arquivo.name, erro: error.message })
    }
  }
  return { enviados, falhas }
}

/** Texto do envio em andamento: `{ atual: 2, total: 5 }` → "Enviando 2 de 5…"; um arquivo só → "Enviando…". */
export const textoProgresso = ocupado => {
  if (!ocupado) return ''
  return ocupado.total > 1 ? `Enviando ${ocupado.atual} de ${ocupado.total}…` : 'Enviando…'
}

/** Aviso de sucesso com a quantidade: "1 arquivo enviado", "3 arquivos enviados". */
export const avisoEnviados = n => (n === 1 ? '1 arquivo enviado' : `${n} arquivos enviados`)

/** Lista do alerta de falhas: uma linha por arquivo, "nome: motivo". */
export const resumoFalhas = falhas => falhas.map(f => `${f.nome}: ${f.erro}`).join('\n')
