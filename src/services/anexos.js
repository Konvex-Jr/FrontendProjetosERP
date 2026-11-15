import { baixar, request } from './api.js'
import { memoriaArquivos } from '../lib/memoriaArquivos.js'

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
  bytes: Number(a.tamanhoBytes) || 0,
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

/** Até este tamanho o PDF ou a imagem começa a baixar antes do clique (mouse, foco ou toque no nome). */
export const LIMITE_ANTECIPAR = 5 * 1024 * 1024
/** Antecipações ao mesmo tempo; as que passarem disso são ignoradas (não esperam numa fila). */
export const MAXIMO_ANTECIPANDO = 2
// Anexos sendo antecipados agora (códigos).
const antecipando = new Set()

/** Acima deste tamanho a tela mostra o progresso do download (barra na janela, estado no botão). */
export const MOSTRAR_PROGRESSO = 1024 * 1024

/**
 * O que mostrar do progresso `{ recebidos, total }` de um anexo de `bytes` (tamanho da lista):
 * null para arquivo de até 1 MB; `pct` null quando a resposta não diz o tamanho ("Baixando…"),
 * inclusive quando nem a resposta nem a lista dizem.
 */
export function progressoVisivel(progresso, bytes) {
  if (!progresso) return null
  const { recebidos, total } = progresso
  // Tamanho conhecido (pela resposta ou pela lista) e pequeno: sem progresso. Sem nenhum dos dois, "Baixando…".
  const tamanho = total || bytes
  if (tamanho && tamanho <= MOSTRAR_PROGRESSO) return null
  if (!total) return { pct: null, texto: 'Baixando…' }
  const pct = Math.min(100, Math.floor((recebidos / total) * 100))
  return { pct, texto: `Baixando… ${pct}%` }
}

/**
 * O arquivo do anexo: o guardado na aba (memoriaArquivos) ou buscado na API. Só PDF e imagem são
 * guardados; o resto (Word, planilhas...) vai direto, para não tirar da memória o que abre na janela.
 * `aoProgresso(recebidos, total)` acompanha a busca, mesmo se ela já tiver começado por antecipação.
 */
function arquivoDo(anexo, aoProgresso) {
  const path = `/anexos/${anexo.id}`
  if (!podeVer(anexo.nome)) return baixar(path, { aoProgresso })
  const guardado = memoriaArquivos.obter(anexo.id)
  if (guardado) return Promise.resolve(guardado)
  return memoriaArquivos.buscar(anexo.id, avisar => baixar(path, { aoProgresso: avisar }), { aoProgresso })
}

export const anexos = {
  /** `dono`: 'biblioteca' ou 'tarefas'. */
  enviar: (dono, codigo, arquivo) => enviarBytes(`/${dono}/${codigo}/anexos`, arquivo),
  /** Exclui na API e tira o arquivo da memória da aba (mesmo se a API recusar: na dúvida, busca de novo). */
  async excluir(codigo) {
    try {
      return await request(`/anexos/${codigo}`, { method: 'DELETE', auth: true })
    } finally {
      memoriaArquivos.apagar(codigo)
    }
  },
  /**
   * Começa a baixar PDF ou imagem de até 5 MB antes do clique, no máximo 2 por vez (passar o mouse
   * por uma lista longa não dispara vários downloads). Erro é ignorado (o clique tenta de novo).
   */
  async antecipar(anexo) {
    if (!podeVer(anexo.nome) || !(anexo.bytes > 0 && anexo.bytes <= LIMITE_ANTECIPAR)) return
    if (antecipando.has(anexo.id) || antecipando.size >= MAXIMO_ANTECIPANDO || memoriaArquivos.obter(anexo.id)) return
    antecipando.add(anexo.id)
    try {
      await arquivoDo(anexo)
    } catch {
      /* antecipação é só um ganho; quem clicar vê o erro */
    } finally {
      antecipando.delete(anexo.id)
    }
  },
  /** Arquivo guardado ou baixado pela API; devolve um endereço local para abrir em janela e o chamador revoga com `URL.revokeObjectURL`. */
  async abrir(anexo, { aoProgresso } = {}) {
    if (!podeVer(anexo.nome)) throw new Error('Este tipo de arquivo não abre aqui. Baixe para ver.')
    const tipo = VISUALIZAVEIS[extensao(anexo.nome)]
    const blob = await arquivoDo(anexo, aoProgresso)
    return { url: URL.createObjectURL(new Blob([blob], { type: tipo })), tipo }
  },
  /** Arquivo guardado ou baixado pela API (o token vai no cabeçalho), entregue ao navegador com o nome original. */
  async baixar(anexo, { aoProgresso } = {}) {
    const blob = await arquivoDo(anexo, aoProgresso)
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: anexo.nome })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  },
}

/** Quanto o mouse ou o foco precisa ficar no nome antes de antecipar: passar de relance não baixa nada. */
export const ESPERA_ANTECIPAR_MS = 120

/**
 * Agenda antecipações de uma lista de anexos. `agendar` (mouse, foco) espera 120 ms e `cancelar`
 * (saiu, perdeu o foco) desiste; `agora` (toque) começa na hora; `cancelarTodos` ao desmontar.
 */
export function criarAntecipador(antecipar = anexo => anexos.antecipar(anexo)) {
  const agendados = new Map()
  const cancelar = anexo => {
    clearTimeout(agendados.get(anexo.id))
    agendados.delete(anexo.id)
  }
  return {
    agendar(anexo) {
      cancelar(anexo)
      agendados.set(
        anexo.id,
        setTimeout(() => {
          agendados.delete(anexo.id)
          antecipar(anexo)
        }, ESPERA_ANTECIPAR_MS),
      )
    },
    cancelar,
    agora(anexo) {
      cancelar(anexo)
      antecipar(anexo)
    },
    cancelarTodos() {
      for (const id of agendados.values()) clearTimeout(id)
      agendados.clear()
    },
  }
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
