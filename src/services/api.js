/**
 * Cliente HTTP único do frontend: todo módulo em src/services chama `request` (ou `baixar`),
 * nunca o fetch direto. Aqui ficam a sessão, a renovação do token e as mensagens de erro,
 * para que todas as telas se comportem igual.
 */
// Endereço da API definido no build (VITE_API_URL; na produção, `/api` no mesmo domínio).
// Sem ele, usa o backend local. A barra final sai porque os caminhos já começam com `/`.
export const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5001').replace(/\/$/, '')

/**
 * Erro de qualquer chamada. `message` já vem pronta para a pessoa ler (as telas mostram
 * `error.message`); `status` 0 = sem conexão; `codigo` vem da API quando ela o envia.
 */
export class ApiError extends Error {
  constructor(message, status = 0, codigo = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
  }
}

export const SEM_CONEXAO = 'Sem conexão com o sistema. Confira sua internet e tente de novo.'

/**
 * Mensagem que a pessoa vê quando a API recusa a chamada (um lugar só).
 * Regras de negócio (400/403/404/422) já vêm em português da API; erros do servidor
 * e respostas sem mensagem viram uma frase que diz o que fazer.
 */
export function mensagemDeErro(status, data) {
  if (status >= 500) return 'Algo deu errado do nosso lado. Tente de novo daqui a pouco; se continuar, avise a Inovação.'
  if (data?.message) return data.message
  if (status === 403) return 'Essa ação não está liberada para o seu papel na Konvex.'
  if (status === 404) return 'Não achamos isso. Pode ter sido excluído; recarregue a página.'
  if (status === 413) return 'O arquivo ou o texto é grande demais para enviar.'
  if (status === 429) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  return `Não deu para concluir (erro ${status}). Tente de novo.`
}

/**
 * Sessão guardada no sessionStorage: token de acesso (15 min) e refresh token (7 dias).
 * Quando a API responde 401, o cliente renova o token uma vez e repete a chamada.
 * Se a renovação falhar, a sessão é limpa e onExpirada é chamado.
 */
const ACCESS_KEY = 'konvex_access_token'
const REFRESH_KEY = 'konvex_refresh_token'
const storage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage)
const ler = key => {
  try {
    return storage()?.getItem(key) || ''
  } catch {
    return ''
  }
}
const gravar = (key, value) => {
  try {
    value ? storage()?.setItem(key, value) : storage()?.removeItem(key)
  } catch {
    /* sem storage */
  }
}

// Cópia em memória da sessão. O sessionStorage só serve para sobreviver ao F5: ele é por aba
// e some ao fechar, então uma aba aberta do zero pede login de novo, a menos que a pessoa tenha
// marcado "manter conectado" (ver retomarSessao).
let memoria = { token: ler(ACCESS_KEY), refreshToken: ler(REFRESH_KEY) }
// Promessa da renovação em andamento (ver renovarSessao); null quando não há nenhuma.
let renovando = null

export const sessao = {
  get token() {
    return memoria.token
  },
  get refreshToken() {
    return memoria.refreshToken
  },
  get ativa() {
    return Boolean(memoria.token || memoria.refreshToken)
  },
  salvar({ token, refreshToken }) {
    // Se a resposta não trouxer refresh token novo, mantém o atual.
    memoria = { token: token || '', refreshToken: refreshToken || memoria.refreshToken }
    gravar(ACCESS_KEY, memoria.token)
    gravar(REFRESH_KEY, memoria.refreshToken)
  },
  limpar() {
    memoria = { token: '', refreshToken: '' }
    gravar(ACCESS_KEY, '')
    gravar(REFRESH_KEY, '')
  },
  /** Definido pelo app: o que fazer quando a sessão não pode mais ser renovada. */
  onExpirada: null,
}

// Rotas que leem ou trocam o cookie de lembrete do "manter conectado" (HttpOnly, só em /auth).
// Só elas vão com `credentials: 'include'`; quem já define `credentials` (ex.: 'omit') decide sozinho.
const ROTAS_COM_COOKIE = ['/auth/login', '/auth/retomar', '/auth/logout']
function levaCookie(path, method = 'GET') {
  if (ROTAS_COM_COOKIE.includes(path)) return true
  return method.toUpperCase() === 'POST' && path.startsWith('/auth/link-senha/')
}

async function chamar(path, init) {
  const comCookie = !init.credentials && levaCookie(path, init.method) ? { ...init, credentials: 'include' } : init
  try {
    return await fetch(`${API_URL}${path}`, comCookie)
  } catch {
    // Detalhe técnico só no console; a pessoa vê uma frase simples.
    console.warn(`API inacessível em ${API_URL} (confira o backend e VITE_API_URL).`)
    throw new ApiError(SEM_CONEXAO)
  }
}

// Lê como texto antes do JSON: corpo vazio (204) vira null e erro em texto puro
// (ex.: página de erro do proxy) vira { message }, sem quebrar no JSON.parse.
async function lerCorpo(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

/** Renova o token de acesso. Chamadas simultâneas compartilham a mesma renovação. */
export function renovarSessao() {
  if (!sessao.refreshToken) return Promise.resolve(false)
  // Várias chamadas podem receber 401 juntas: todas esperam a mesma renovação, para não gastar o refresh token duas vezes.
  if (!renovando) {
    renovando = (async () => {
      // Refresh token desta renovação: se a sessão mudar enquanto a API responde, a resposta é de outra sessão.
      const usado = sessao.refreshToken
      try {
        const response = await chamar('/auth/refresh', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: usado }),
        })
        const data = await lerCorpo(response)
        if (!response.ok || !data?.token) return false
        if (sessao.refreshToken !== usado) {
          // A pessoa saiu (ou outra entrou) durante a renovação. Salvar aqui religaria a sessão
          // antiga nesta aba (o F5 entraria de novo como ela) ou trocaria a sessão de quem entrou.
          // A API já trocou o refresh token: o novo fica sem dono e é revogado, sem esperar.
          // Sem o cookie: o lembrete do navegador pode ser de quem entrou agora e não pode ser revogado.
          if (data.refreshToken) {
            chamar('/auth/logout', {
              method: 'POST',
              credentials: 'omit',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: data.refreshToken }),
            }).catch(() => {})
          }
          return false
        }
        sessao.salvar({ token: data.token, refreshToken: data.refreshToken })
        return true
      } catch {
        return false
      }
    })().finally(() => {
      renovando = null
    })
  }
  return renovando
}

// Fila desta aba para quando o navegador não tem `navigator.locks`: mantém ao menos a ordem local
// (ex.: o logout de quem saiu chega à API antes do login de quem entra).
let filaSemLocks = Promise.resolve()

/**
 * Login, retomar e logout passam um de cada vez entre todas as abas (trava 'konvex-sessao'):
 * o cookie de lembrete é um só no navegador, e um login numa aba durante o retomar de outra
 * faria a API ver o lembrete antigo reusado e derrubar a sessão nova.
 */
export function comTravaDeSessao(fn) {
  const locks = globalThis.navigator?.locks
  if (locks?.request) return locks.request('konvex-sessao', () => fn())
  const vez = filaSemLocks.then(() => fn())
  filaSemLocks = vez.catch(() => {})
  return vez
}

/**
 * Aba aberta sem sessão: troca o cookie de lembrete ("manter conectado") por uma sessão nova.
 * Devolve true se a aba tem sessão ao fim (salva agora ou já existente ao pegar a trava); false
 * sem cookie válido (401) ou sem conexão. Uma sessão salva por outra entrada desta aba nunca é trocada.
 */
export function retomarSessao() {
  return comTravaDeSessao(async () => {
    if (sessao.ativa) return true
    try {
      const response = await chamar('/auth/retomar', { method: 'POST', headers: { Accept: 'application/json' } })
      const data = await lerCorpo(response)
      if (!response.ok || !data?.token || sessao.ativa) return false
      sessao.salvar({ token: data.token, refreshToken: data.refreshToken })
      return true
    } catch {
      return false
    }
  })
}

/**
 * Diz se o token de acesso já venceu (ou vence em até 5 s), lendo o `exp` do payload JWT.
 * Só serve para antecipar a renovação: quem confere a assinatura é a API. Token ilegível,
 * sem `exp` ou vazio conta como não vencido, e a chamada segue o fluxo normal de 401.
 */
export function tokenVencido(token, agora = Date.now()) {
  try {
    const payload = JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 <= agora + 5000
  } catch {
    return false
  }
}

// Várias chamadas paralelas (ex.: as do início do app) podem receber 401 juntas: só a primeira,
// que de fato encerra a sessão, avisa o app; as outras achariam a sessão já limpa e repetiriam
// o alerta e a ida ao login.
function expirar() {
  const estavaAtiva = sessao.ativa
  sessao.limpar()
  if (estavaAtiva && typeof sessao.onExpirada === 'function') sessao.onExpirada()
}

/**
 * fetch autenticado: envia o token da sessão e, se a API responder 401,
 * renova uma vez e repete. Devolve o Response.
 */
async function fetchAutenticado(path, { headers = {}, ...init } = {}) {
  const enviar = () => chamar(path, { ...init, headers: { ...headers, ...(sessao.token ? { 'access-token': sessao.token } : {}) } })
  // Token já vencido: tenta renovar antes de chamar, em vez de gastar uma ida à API só para receber 401.
  // Se falhar, segue para a chamada normal: sem internet vira "sem conexão" e a sessão é mantida;
  // refresh recusado vira 401 da API e o fluxo abaixo encerra a sessão.
  if (sessao.refreshToken && tokenVencido(sessao.token)) await renovarSessao()
  let response = await enviar()
  if (response.status === 401 && sessao.refreshToken) {
    const usado = sessao.refreshToken
    if (await renovarSessao()) response = await enviar()
    // Só encerra se a sessão ainda for a que tentou renovar: se a pessoa saiu ou outra entrou
    // nesse meio-tempo, limpar aqui derrubaria a sessão de quem está na aba agora.
    else if (sessao.refreshToken === usado) expirar()
  } else if (response.status === 401) {
    expirar()
  }
  return response
}

/**
 * Chamada JSON à API. Com `auth: true` usa a sessão (e renova o token sozinho).
 * `token` explícito continua aceito para chamadas avulsas, sem renovação.
 */
// GETs autenticados em andamento, por `path|token`: telas que pedem o mesmo dado ao mesmo tempo
// (ex.: vários componentes montando juntos) fazem uma só chamada. A entrada sai ao terminar,
// com sucesso ou erro, então nada fica guardado entre uma chamada e outra.
const getsEmAndamento = new Map()

export function request(path, opcoes = {}) {
  const { method = 'GET', token, auth = false } = opcoes
  if (method !== 'GET' || !auth || token) return executar(path, opcoes)
  // A chave usa o token do momento da chamada, antes de qualquer renovação antecipada.
  const chave = `${path}|${sessao.token}`
  let promessa = getsEmAndamento.get(chave)
  if (!promessa) {
    promessa = executar(path, opcoes).finally(() => getsEmAndamento.delete(chave))
    getsEmAndamento.set(chave, promessa)
  }
  return promessa
}

async function executar(path, { method = 'GET', body, token, auth = false, headers = {} } = {}) {
  const init = {
    method,
    headers: {
      Accept: 'application/json',
      // FormData: o navegador monta o Content-Type (com o boundary). Blob (anexo): vai o tipo do próprio arquivo.
      ...(body !== undefined && !(body instanceof FormData) && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
      ...(body instanceof Blob && body.type ? { 'Content-Type': body.type } : {}),
      ...(token ? { 'access-token': token } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: body instanceof FormData || body instanceof Blob ? body : JSON.stringify(body) } : {}),
  }

  const response = auth && !token ? await fetchAutenticado(path, init) : await chamar(path, init)
  const data = await lerCorpo(response)

  if (!response.ok) {
    throw new ApiError(mensagemDeErro(response.status, data), response.status, data?.codigo || '')
  }

  return data
}

export const apiUrl = API_URL

export const DOWNLOAD_INTERROMPIDO = 'O download parou no meio. Confira a internet e tente de novo.'

/** `Content-Length` como número, ou null quando falta (ex.: resposta comprimida). */
function tamanhoDaResposta(response) {
  const n = Number(response.headers?.get?.('content-length'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Baixa um arquivo da API (sessão 12c) com a sessão do usuário. Devolve o Blob;
 * erro vira ApiError com a mesma mensagem das outras chamadas.
 * Com `aoProgresso(recebidos, total)` lê o corpo em pedaços e avisa a cada um
 * (total null sem `Content-Length`). Queda no meio vira ApiError com status 0.
 */
export async function baixar(path, { aoProgresso } = {}) {
  const response = await fetchAutenticado(path, { method: 'GET' })
  if (!response.ok) {
    const data = await lerCorpo(response)
    throw new ApiError(mensagemDeErro(response.status, data), response.status, data?.codigo || '')
  }
  try {
    if (!aoProgresso || !response.body?.getReader) return await response.blob()
    const total = tamanhoDaResposta(response)
    const leitor = response.body.getReader()
    const pedacos = []
    let recebidos = 0
    aoProgresso(0, total)
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      pedacos.push(value)
      recebidos += value.byteLength
      aoProgresso(recebidos, total)
    }
    return new Blob(pedacos, { type: response.headers?.get?.('content-type') || '' })
  } catch (erro) {
    if (erro instanceof ApiError) throw erro
    throw new ApiError(DOWNLOAD_INTERROMPIDO)
  }
}
