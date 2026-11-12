import { request } from './api.js'

/**
 * Chamadas diretas dos módulos Pessoas e Configurações.
 * Substituem o caminho antigo (up('u') + persistCollection) para estas telas.
 */
const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, auth: true, body })

/** Campos vazios do formulário viram null, para a API limpar o valor. */
const vazioComoNull = dados => Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, v === '' ? null : v]))

export const STATUS_PESSOA = [
  ['ativo', 'Ativo'],
  ['trainee', 'Trainee'],
  ['alumni', 'Alumni'],
  ['inativo', 'Inativo'],
]
export const rotuloStatus = s => STATUS_PESSOA.find(([k]) => k === s)?.[1] || s || '—'

export const pessoas = {
  listar: () => get('/usuarios'),
  perfil: codigo => get(`/usuarios/${codigo}/perfil`),
  criar: dados => send('POST', '/usuarios', vazioComoNull(dados)),
  editar: (codigo, dados) => send('PUT', `/usuarios/${codigo}`, vazioComoNull(dados)),
  alterarStatus: (codigo, status, dataSaida) =>
    send('PATCH', `/usuarios/${codigo}/status`, { status, ...(dataSaida ? { dataSaida } : {}) }),
  redefinirSenha: (codigo, novaSenha) => send('PUT', `/usuarios/${codigo}/senha`, { novaSenha }),
}

/** Tecnologias da pessoa (habilidades do tipo "tecnologia"), em ordem alfabética. */
export const tecnologiasDe = u =>
  (u?.habilidades || [])
    .filter(h => h.tipo === 'tecnologia')
    .map(h => h.nome)
    .sort((a, b) => a.localeCompare(b))

/** Junta um nome novo à lista sem repetir (sem diferenciar maiúsculas); usa a grafia de `sugestoes` se já existir. */
export function juntarTecnologia(lista, nome, sugestoes = []) {
  const limpo = String(nome || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!limpo || limpo.length > 60) return lista
  const igual = x => x.toLowerCase() === limpo.toLowerCase()
  if (lista.some(igual)) return lista
  return [...lista, sugestoes.find(igual) || limpo]
}

export const tecnologias = {
  sugestoes: async () => (await get('/habilidades?tipo=tecnologia')).map(h => h.nome),
  salvarMinhas: nomes => send('PUT', '/auth/perfil', { tecnologias: nomes }),
}

export const minhaConta = {
  editarPerfil: dados => send('PUT', '/auth/perfil', vazioComoNull(dados)),
  trocarSenha: (senhaAtual, novaSenha) => send('PUT', '/auth/senha', { senhaAtual, novaSenha }),
}

export const configuracoes = {
  areas: () => get('/areas'),
  cargos: () => get('/cargos'),
  senioridades: () => get('/senioridades'),
  salvarArea: (codigo, dados) => send(codigo ? 'PUT' : 'POST', codigo ? `/areas/${codigo}` : '/areas', dados),
  salvarCargo: (codigo, dados) => send(codigo ? 'PUT' : 'POST', codigo ? `/cargos/${codigo}` : '/cargos', dados),
  salvarSenioridade: (codigo, dados) => send(codigo ? 'PUT' : 'POST', codigo ? `/senioridades/${codigo}` : '/senioridades', dados),
}
