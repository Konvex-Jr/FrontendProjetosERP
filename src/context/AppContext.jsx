import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BLOQ, NAV, path, iso } from '../lib/utils'
import { request } from '../services/api'
import alerts from '../lib/alerts'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)
const TOKEN_KEY = 'konvex_access_token'
const USER_KEY = 'konvex_user_code'

const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_')
const dateOnly = value => value ? String(value).slice(0, 10) : ''
const userCode = value => typeof value === 'object' && value ? value.codigo : value

function adaptUser(user) {
  const senioridadeRef = user.senioridade || null
  return {
    id: user.codigo,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    ativo: user.ativo,
    senha: undefined,
    senioridade: senioridadeRef ? slug(senioridadeRef.nome).replace('junior', 'junior').replace('senior', 'senior') : undefined,
    senioridadeRef,
  }
}

function adaptProject(project) {
  return {
    id: project.codigo,
    nome: project.nome,
    descricao: project.descricao,
    inicio: dateOnly(project.dataInicio),
    fim: dateOnly(project.dataFim),
    status: project.status,
    membros: (project.membros || []).map(userCode),
  }
}

function adaptTask(task) {
  return {
    id: task.codigo,
    projetoId: userCode(task.projeto),
    titulo: task.titulo,
    descricao: task.descricao || '',
    inicio: dateOnly(task.dataInicio),
    fim: dateOnly(task.dataFim),
    status: task.status,
    prioridade: task.prioridade,
    conclusao: task.dataConclusao ? dateOnly(task.dataConclusao) : undefined,
    dependeDe: userCode(task.dependeDe) || undefined,
    responsaveis: (task.responsaveis || []).map(userCode),
    checklist: task.checklist || [],
  }
}

function adaptTraining(training) {
  return {
    id: training.codigo,
    titulo: training.titulo,
    data: dateOnly(training.data),
    hora: training.hora,
    instrutor: training.instrutor?.nome || training.instrutor || '—',
    instrutorId: userCode(training.instrutor),
    vagas: training.vagas,
    tipo: training.tipo,
    sala: training.sala,
    inscritos: (training.inscritos || []).map(userCode),
  }
}

function adaptCheckin(checkin) {
  return {
    id: checkin.codigo,
    usuarioId: userCode(checkin.usuario),
    semana: dateOnly(checkin.semana),
    humor: checkin.humor,
    resumo: checkin.resumo,
    aprendizados: checkin.aprendizados,
    sentimento: checkin.sentimento || '',
  }
}

function adaptDocument(document) {
  return {
    id: document.codigo,
    pastaId: userCode(document.pasta),
    nome: document.nome,
    ext: document.extensao || '—',
    tam: Number(document.tamanhoBytes || 0),
    data: dateOnly(document.dataEnvio),
    autor: document.autor?.nome || '—',
    autorId: userCode(document.autor),
    url: document.arquivoUrl,
  }
}

function adaptFeedback(feedback) {
  return {
    id: feedback.codigo,
    capId: userCode(feedback.capacitacao),
    usuarioId: userCode(feedback.usuario),
    nota: feedback.nota,
    data: dateOnly(feedback.data),
    bom: feedback.bom || '',
    melhorar: feedback.melhorar || '',
  }
}

const dateTime = value => new Date(`${value}T12:00:00`).toISOString()

export function AppProvider({ children }) {
  const navigate = useNavigate()
  const [DF, setD] = useState(null)
  const [me, setMe] = useState(null)
  const [md, setMd] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const dataRef = useRef(null)
  const tokenRef = useRef(sessionStorage.getItem(TOKEN_KEY) || '')

  const readConfig = async () => ({
    hoje: iso(new Date()),
    perfis: ['diretor', 'gerente', 'membro'],
    senioridades: {
      junior: 'Júnior',
      pleno: 'Pleno',
      senior: 'Sênior',
    },
  })
  const loadApiData = async token => {
    const [users, projects, tasks, trainings, checkins, feedbacks, folders] = await Promise.all([
      request('/usuarios', { token }),
      request('/projetos', { token }),
      request('/tarefas', { token }),
      request('/capacitacoes', { token }),
      request('/checkins', { token }),
      request('/feedbacks', { token }),
      request('/pastas', { token }),
    ])
    const documentsByFolder = await Promise.all(folders.map(folder => request(`/pastas/${folder.codigo}/documentos`, { token })))
    const documents = documentsByFolder.flat().map(adaptDocument)
    return {
      u: users.map(adaptUser),
      p: projects.map(adaptProject),
      t: tasks.map(adaptTask),
      k: trainings.map(adaptTraining),
      i: checkins.map(adaptCheckin),
      f: feedbacks.map(adaptFeedback),
      g: folders.map(folder => ({ id: folder.codigo, nome: folder.nome })),
      d: documents,
    }
  }

  const refresh = async (token = tokenRef.current, config = DF?.c || await readConfig()) => {
    const apiData = await loadApiData(token)
    const next = { c: config, ...apiData }
    dataRef.current = next
    setD(next)
    return next
  }

  useEffect(() => {
    let active = true

      ; (async () => {
        try {
          console.log('[INIT] Iniciando AppContext')

          console.log('[INIT] Lendo configuração')
          const config = await readConfig()
          console.log('[INIT] Configuração carregada:', config)

          if (!active) return

          console.log('[INIT] Lendo sessão')
          const token = sessionStorage.getItem(TOKEN_KEY)
          const userCodeStored = sessionStorage.getItem(USER_KEY)

          console.log('[INIT] Token presente:', Boolean(token))
          console.log('[INIT] Código do usuário:', userCodeStored)

          if (token && userCodeStored) {
            tokenRef.current = token

            try {
              console.log('[INIT] Carregando dados da API')

              const data = await loadApiData(token)

              console.log('[INIT] Dados carregados:', {
                usuarios: data.u.length,
                projetos: data.p.length,
                tarefas: data.t.length,
                capacitacoes: data.k.length,
                checkins: data.i.length,
                feedbacks: data.f.length,
                pastas: data.g.length,
                documentos: data.d.length,
              })

              if (!active) return

              const user = data.u.find(
                item => item.id === userCodeStored && item.ativo
              )

              console.log('[INIT] Usuário encontrado:', Boolean(user))

              if (user) {
                setMe(user)
                setD({ ...data, c: config })
              } else {
                sessionStorage.removeItem(TOKEN_KEY)
                sessionStorage.removeItem(USER_KEY)
                tokenRef.current = ''
                setD({
                  c: config,
                  u: [],
                  p: [],
                  t: [],
                  k: [],
                  i: [],
                  f: [],
                  g: [],
                  d: [],
                })
              }
            } catch (error) {
              console.error('[INIT] Erro ao carregar dados da API:', error)

              sessionStorage.removeItem(TOKEN_KEY)
              sessionStorage.removeItem(USER_KEY)
              tokenRef.current = ''

              setD({
                c: config,
                u: [],
                p: [],
                t: [],
                k: [],
                i: [],
                f: [],
                g: [],
                d: [],
              })

              if (error.status !== 401) {
                alerts.error('Falha ao conectar com a API', error.message)
              }
            }
          } else {
            console.log('[INIT] Nenhuma sessão encontrada')

            setD({
              c: config,
              u: [],
              p: [],
              t: [],
              k: [],
              i: [],
              f: [],
              g: [],
              d: [],
            })
          }
        } catch (error) {
          console.error('[INIT] Falha na inicialização:', error)
          console.error('[INIT] Stack:', error?.stack)

          alerts.error('Falha ao iniciar o frontend', error.message)
        } finally {
          if (active) {
            console.log('[INIT] Inicialização finalizada')
            setSessionReady(true)
          }
        }
      })()

    return () => {
      active = false
    }
  }, [])
  const mb = !!DF && !!me && DF.u.find(user => user.id === me)?.perfil === 'membro'
  const D = useMemo(() => {
    if (!DF) return null
    return mb
      ? { ...DF, priv: true, p: DF.p.filter(project => project.membros.includes(me)), t: DF.t.filter(task => (task.responsaveis || []).includes(me)), i: DF.i.filter(item => item.usuarioId === me), f: DF.f.filter(item => item.usuarioId === me) }
      : DF
  }, [DF, me, mb])
  const nav = NAV.filter(([key]) => !mb || !BLOQ.includes(key))

  const entrar = async (email, senha) => {
    setLoading(true)
    try {
      const result = await request('/auth/login', { method: 'POST', body: { email: email.trim().toLowerCase(), senha } })
      if (!result?.token) throw new Error('A API não retornou um token de autenticação.')
      const users = await request('/usuarios', { token: result.token })
      const user = users.map(adaptUser).find(item => item.email.toLowerCase() === email.trim().toLowerCase() && item.ativo)
      if (!user) throw new Error('O login foi aceito, mas não foi possível identificar um usuário ativo com esse e-mail.')
      tokenRef.current = result.token
      sessionStorage.setItem(TOKEN_KEY, result.token)
      sessionStorage.setItem(USER_KEY, user.id)
      const config = DF?.c || await readConfig()
      const data = await loadApiData(result.token)
      const next = { c: config, ...data }
      dataRef.current = next
      setD(next)
      setMe(user.id)
      navigate('/')
      window.scrollTo(0, 0)
      alerts.toastSuccess('Login realizado', `Bem-vindo(a), ${user.nome.split(' ')[0]}.`)
    } catch (error) {
      alerts.error('Não foi possível entrar', error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const sair = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    tokenRef.current = ''
    setMe(null)
    setD(current => current ? { ...current, u: [], p: [], t: [], k: [], i: [], f: [] } : current)
    navigate('/login')
    window.scrollTo(0, 0)
  }

  const persistCollection = async (key, before, after) => {
    const token = tokenRef.current
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
    const oldById = new Map(before.map(item => [String(item.id), item]))
    const newById = new Map(after.map(item => [String(item.id), item]))
    const created = after.filter(item => !oldById.has(String(item.id)))
    const deleted = before.filter(item => !newById.has(String(item.id)))
    const updated = after.filter(item => oldById.has(String(item.id)) && JSON.stringify(item) !== JSON.stringify(oldById.get(String(item.id))))

    if (key === 'p') {
      for (const item of deleted) await request(`/projetos/${item.id}`, { method: 'DELETE', token })
      for (const item of created) await request('/projetos', { method: 'POST', token, body: { nome: item.nome, descricao: item.descricao, dataInicio: dateTime(item.inicio), dataFim: dateTime(item.fim), codigosMembros: item.membros || [] } })
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        const statusOnly = item.status !== old.status && ['nome', 'descricao', 'inicio', 'fim', 'membros'].every(field => JSON.stringify(item[field]) === JSON.stringify(old[field]))
        if (statusOnly) await request(`/projetos/${item.id}/status`, { method: 'PATCH', token })
        else await request(`/projetos/${item.id}`, { method: 'PUT', token, body: { nome: item.nome, descricao: item.descricao, dataInicio: dateTime(item.inicio), dataFim: dateTime(item.fim), codigosMembros: item.membros || [] } })
      }
    } else if (key === 't') {
      for (const item of deleted) await request(`/tarefas/${item.id}`, { method: 'DELETE', token })
      for (const item of created) await request('/tarefas', { method: 'POST', token, body: { codigoProjeto: item.projetoId, titulo: item.titulo, dataInicio: dateTime(item.inicio), dataFim: dateTime(item.fim), prioridade: item.prioridade, descricao: item.descricao || null, codigosResponsaveis: item.responsaveis || [] } })
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        const comparable = item => ({ ...item, status: undefined, conclusao: undefined, checklist: undefined })
        if (item.status !== old.status && JSON.stringify(comparable(item)) === JSON.stringify(comparable(old))) {
          await request(`/tarefas/${item.id}/status`, { method: 'PATCH', token, body: { status: item.status } })
        } else {
          await request(`/tarefas/${item.id}`, { method: 'PUT', token, body: { titulo: item.titulo, dataInicio: dateTime(item.inicio), dataFim: dateTime(item.fim), status: item.status, prioridade: item.prioridade, descricao: item.descricao || null, codigosResponsaveis: item.responsaveis || [], codigoDependencia: item.dependeDe || null } })
        }
      }
    } else if (key === 'k') {
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        const wasIn = (old.inscritos || []).some(code => String(code) === String(me))
        const isIn = (item.inscritos || []).some(code => String(code) === String(me))
        if (wasIn !== isIn) {
          await request(`/capacitacoes/${item.id}/inscricoes${isIn ? '' : `/${me}`}`, { method: isIn ? 'POST' : 'DELETE', token, ...(isIn ? { body: { codigoUsuario: me } } : {}) })
        }
      }
    } else if (key === 'i') {
      for (const item of [...created, ...updated]) {
        const existed = oldById.has(String(item.id)) || before.some(old => String(old.usuarioId) === String(item.usuarioId) && old.semana === item.semana)
        await request('/checkins', { method: existed ? 'PUT' : 'POST', token, body: { codigoUsuario: item.usuarioId, semana: item.semana, resumo: item.resumo, aprendizados: item.aprendizados, humor: Number(item.humor), sentimento: item.sentimento || null } })
      }
    } else if (key === 'f') {
      for (const item of created) await request(`/capacitacoes/${item.capId}/feedbacks`, { method: 'POST', token, body: { codigoUsuario: item.usuarioId, nota: Number(item.nota), bom: item.bom || null, melhorar: item.melhorar || null, data: dateTime(item.data) } })
    } else if (key === 'g') {
      for (const item of deleted) await request(`/pastas/${item.id}`, { method: 'DELETE', token })
      for (const item of created) await request('/pastas', { method: 'POST', token, body: { nome: item.nome } })
      for (const item of updated) await request(`/pastas/${item.id}`, { method: 'PUT', token, body: { nome: item.nome } })
    } else if (key === 'd') {
      for (const item of deleted) await request(`/documentos/${item.id}`, { method: 'DELETE', token })
      for (const item of created) await request(`/pastas/${item.pastaId}/documentos`, { method: 'POST', token, body: { nome: item.nome, tamanhoBytes: Number(item.tam || 0), dataEnvio: dateTime(item.data || DF.c.hoje), codigoAutor: item.autorId || me, arquivoUrl: item.url, extensao: item.ext && item.ext !== '—' ? item.ext : null } })
      for (const item of updated) await request(`/documentos/${item.id}`, { method: 'PUT', token, body: { nome: item.nome } })
    } else if (key === 'u') {
      for (const item of deleted) await request(`/usuarios/${item.id}`, { method: 'DELETE', token })
      for (const item of created) {
        const senioridade = resolveSenioridade(item, before)
        await request('/auth/register', { method: 'POST', body: { nome: item.nome, email: item.email, senha: item.senha, perfil: item.perfil, senioridade } })
      }
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        if (old.ativo && !item.ativo) {
          await request(`/usuarios/${item.id}`, { method: 'DELETE', token })
          continue
        }
        const senioridade = item.perfil === 'membro' ? resolveSenioridade(item, before) : null
        await request(`/usuarios/${item.id}`, { method: 'PUT', token, body: { nome: item.nome, email: item.email, perfil: item.perfil, senioridade } })
      }
    }
    const config = DF?.c
    const refreshed = await loadApiData(token)
    const localTasks = key === 't' ? after : (DF?.t || [])
    refreshed.t = refreshed.t.map(task => { const localTask = localTasks.find(item => String(item.id) === String(task.id)); return localTask?.checklist ? { ...task, checklist: localTask.checklist } : task })
    const next = { c: config, ...refreshed }
    dataRef.current = next
    setD(next)
  }

  const up = (key, fn) => {
    const before = DF?.[key] || []
    const after = fn(before)
    setD(current => ({ ...current, [key]: after }))
    persistCollection(key, before, after).catch(async error => {
      alerts.error('Não foi possível salvar', error.message)
      try { await refresh() } catch { sair() }
    })
  }

  const form = (title, fields, initial, save) => setMd({ t: title, fs: fields, init: initial, save })
  const go = (name, pid) => { navigate(path(name, pid)); window.scrollTo(0, 0) }

  if (!sessionReady || !DF) return <main className="container py-5">Carregando…</main>

  return <Ctx.Provider value={{ D, DF, up, form, go, me, mb, nav, entrar, sair, md, setMd, loading, refresh, token: tokenRef.current }}>{children}</Ctx.Provider>
}

function resolveSenioridade(user, users) {
  if (user.perfil !== 'membro') return null
  if (user.senioridadeRef?.codigo && slug(user.senioridadeRef.nome) === slug(user.senioridade)) return user.senioridadeRef
  const matching = users.find(item => item.senioridadeRef && slug(item.senioridadeRef.nome) === slug(user.senioridade))
  if (matching?.senioridadeRef) return matching.senioridadeRef
  throw new Error('Não foi possível identificar o código da senioridade selecionada. Verifique se há usuários com essa senioridade cadastrada na API.')
}
