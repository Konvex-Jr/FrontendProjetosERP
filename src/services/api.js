const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/$/, '')

const segment = value => encodeURIComponent(String(value))

/** Contrato centralizado dos endpoints registrados no backend. */
export const API_ROUTES = Object.freeze({
  login: '/auth/login',
  register: '/auth/register',
  users: '/usuarios',
  user: codigo => `/usuarios/${segment(codigo)}`,
  projects: '/projetos',
  project: codigo => `/projetos/${segment(codigo)}`,
  projectStatus: codigo => `/projetos/${segment(codigo)}/status`,
  tasks: '/tarefas',
  task: codigo => `/tarefas/${segment(codigo)}`,
  taskStatus: codigo => `/tarefas/${segment(codigo)}/status`,
  trainings: '/capacitacoes',
  trainingEnrollments: codigo => `/capacitacoes/${segment(codigo)}/inscricoes`,
  trainingEnrollment: (codigo, codigoUsuario) => `/capacitacoes/${segment(codigo)}/inscricoes/${segment(codigoUsuario)}`,
  trainingFeedbacks: codigo => `/capacitacoes/${segment(codigo)}/feedbacks`,
  feedbacks: '/feedbacks',
  checkins: '/checkins',
  folders: '/pastas',
  folder: codigo => `/pastas/${segment(codigo)}`,
  folderDocuments: codigoPasta => `/pastas/${segment(codigoPasta)}/documentos`,
  document: codigo => `/documentos/${segment(codigo)}`,
})

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function request(path, { method = 'GET', body, token, headers = {}, signal } = {}) {
  const endpoint = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`
  let response

  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'access-token': token } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError(`Não foi possível conectar à API em ${API_URL}. Verifique se o backend está em execução e se VITE_API_URL está correto.`)
  }

  const responseText = await response.text()
  let data = null
  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { message: responseText }
    }
  }

  if (!response.ok) {
    const messages = {
      401: 'Sua sessão expirou ou o token é inválido. Entre novamente.',
      403: 'A API exige autenticação para esta operação.',
      404: 'A rota ou o recurso solicitado não foi encontrado.',
    }
    throw new ApiError(data?.message || messages[response.status] || `A API retornou HTTP ${response.status}.`, response.status)
  }

  return data
}

export const apiUrl = API_URL
