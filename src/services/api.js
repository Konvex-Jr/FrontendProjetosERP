/**
 * Cliente HTTP único do frontend: todo módulo em src/services chama `request` (ou `baixar`),
 * nunca o fetch direto. Aqui ficam a sessão, a renovação do token e as mensagens de erro,
 * para que todas as telas se comportem igual.
 */
// Endereço da API definido no build (VITE_API_URL; na produção, `/api` no mesmo domínio).
// Sem ele, usa o backend local. A barra final sai porque os caminhos já começam com `/`.
const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5001').replace(/\/$/, '')

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

export const SEM_CONEXAO = 'Sem conexão com o servidor. Confira a internet e tente de novo.'

/**
 * Mensagem que a pessoa vê quando a API recusa a chamada (um lugar só).
 * Regras de negócio (400/403/404/422) já vêm em português da API; erros do servidor
 * e respostas sem mensagem viram uma frase que diz o que fazer.
 */
export function mensagemDeErro(status, data) {
  if (status >= 500) return 'O servidor teve um problema. Tente de novo em instantes; se continuar, avise a gestão.'
  if (data?.message) return data.message
  if (status === 403) return 'Você não tem permissão para esta ação.'
  if (status === 404) return 'Não encontrado. Pode ter sido excluído; recarregue a página.'
  if (status === 413) return 'O conteúdo enviado é grande demais.'
  if (status === 429) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  return `Não foi possível concluir (erro ${status}). Tente de novo.`
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
// e some ao fechar, então uma aba aberta do zero pede login de novo.
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

async function chamar(path, init) {
  try {
    return await fetch(`${API_URL}${path}`, init)
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
      try {
        const response = await chamar('/auth/refresh', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: sessao.refreshToken }),
        })
        const data = await lerCorpo(response)
        if (!response.ok || !data?.token) return false
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

function expirar() {
  sessao.limpar()
  if (typeof sessao.onExpirada === 'function') sessao.onExpirada()
}

/**
 * fetch autenticado: envia o token da sessão e, se a API responder 401,
 * renova uma vez e repete. Devolve o Response.
 */
async function fetchAutenticado(path, { headers = {}, ...init } = {}) {
  const enviar = () => chamar(path, { ...init, headers: { ...headers, ...(sessao.token ? { 'access-token': sessao.token } : {}) } })
  let response = await enviar()
  if (response.status === 401 && sessao.refreshToken) {
    if (await renovarSessao()) response = await enviar()
    else expirar()
  } else if (response.status === 401) {
    expirar()
  }
  return response
}

/**
 * Chamada JSON à API. Com `auth: true` usa a sessão (e renova o token sozinho).
 * `token` explícito continua aceito para chamadas avulsas, sem renovação.
 */
export async function request(path, { method = 'GET', body, token, auth = false, headers = {} } = {}) {
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

/**
 * Baixa um arquivo da API (sessão 12c) com a sessão do usuário. Devolve o Blob;
 * erro vira ApiError com a mesma mensagem das outras chamadas.
 */
export async function baixar(path) {
  const response = await fetchAutenticado(path, { method: 'GET' })
  if (!response.ok) {
    const data = await lerCorpo(response)
    throw new ApiError(mensagemDeErro(response.status, data), response.status, data?.codigo || '')
  }
  return response.blob()
}
