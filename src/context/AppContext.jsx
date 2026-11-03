import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { path } from '../lib/utils'
import { request, sessao } from '../services/api'
import alerts from '../lib/alerts'
import {
  adaptFeedback,
  adaptProject,
  adaptTask,
  adaptTraining,
  adaptUser,
  readConfig,
} from '../lib/apiMappers'


const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)
const VAZIO = { u: [], p: [], t: [], k: [], f: [] }
const SEM_ACESSO = { permissoes: [], menu: [] }

const dateTime = value => new Date(`${value}T12:00:00`).toISOString()

export function AppProvider({ children }) {
  const navigate = useNavigate()
  const [DF, setD] = useState(null)
  const [me, setMe] = useState(null)
  const [md, setMd] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [acesso, setAcesso] = useState(SEM_ACESSO)

  const loadAcesso = async () => {
    const result = await request('/auth/permissoes', { auth: true })
    return { permissoes: result?.permissoes || [], menu: result?.menu || [] }
  }

  const loadApiData = async () => {
    const [users, projects, tasks, trainings, feedbacks, senioridades] = await Promise.all([
      request('/usuarios', { auth: true }),
      request('/projetos', { auth: true }),
      request('/tarefas', { auth: true }),
      request('/capacitacoes', { auth: true }),
      request('/feedbacks', { auth: true }),
      request('/senioridades', { auth: true }),
    ])
    return {
      u: users.map(adaptUser),
      p: projects.map(adaptProject),
      t: tasks.map(adaptTask),
      k: trainings.map(adaptTraining),
      f: feedbacks.map(adaptFeedback),
      senioridades,
    }
  }

  const refresh = async config => {
    const apiData = await loadApiData()
    const resolvedConfig = config || readConfig(apiData.senioridades, false)
    const next = { ...apiData, c: resolvedConfig }
    setD(next)
    return next
  }

  useEffect(() => {
    let active = true

    const initialize = async () => {
      const defaultConfig = readConfig()
      if (!sessao.ativa) {
        sessao.limpar()
        setD({ c: defaultConfig, ...VAZIO })
        return
      }

      try {
        const eu = await request('/auth/me', { auth: true })
        const [data, permissoes] = await Promise.all([loadApiData(), loadAcesso()])
        if (!active) return
        setAcesso(permissoes)
        setMe(eu.codigo)
        setD({ ...data, c: readConfig(data.senioridades, false) })
      } catch (error) {
        console.error('Erro ao carregar dados da API:', error)
        sessao.limpar()
        setMe(null)
        setAcesso(SEM_ACESSO)
        setD({ c: defaultConfig, ...VAZIO })
        if (error.status !== 401) alerts.error('Falha ao conectar com a API', error.message)
      }
    }

    initialize()
      .catch(error => {
        console.error('Falha na inicialização do frontend:', error)
        alerts.error('Falha ao iniciar o frontend', error.message)
      })
      .finally(() => {
        if (active) setSessionReady(true)
      })

    return () => {
      active = false
    }
  }, [])
  // Ações liberadas pelo backend (GET /auth/permissoes); a API continua checando cada uma.
  const pode = permissao => acesso.permissoes.includes(permissao)
  // Sem permissão de gestor, a pessoa vê só os próprios projetos, tarefas e feedbacks.
  const mb = !!DF && !!me && !pode('projetos.editar')
  const D = useMemo(() => {
    if (!DF) return null
    return mb
      ? { ...DF, priv: true, p: DF.p.filter(project => project.membros.includes(me)), t: DF.t.filter(task => (task.responsaveis || []).includes(me)), f: DF.f.filter(item => item.usuarioId === me) }
      : DF
  }, [DF, me, mb])
  const nav = acesso.menu.map(item => [item.chave, item.rotulo, item.caminho])

  const limparEstado = () => {
    setMe(null)
    setMd(null)
    setAcesso(SEM_ACESSO)
    setD(current => current ? { ...current, ...VAZIO } : current)
  }

  const entrar = async (email, senha) => {
    setLoading(true)
    try {
      const result = await request('/auth/login', { method: 'POST', body: { email: email.trim().toLowerCase(), senha } })
      if (!result?.token || !result?.usuario?.codigo) throw new Error('A API não retornou uma sessão válida.')
      sessao.salvar({ token: result.token, refreshToken: result.refreshToken })
      const [data, permissoes] = await Promise.all([loadApiData(), loadAcesso()])
      setD({ ...data, c: readConfig(data.senioridades, false) })
      setAcesso(permissoes)
      setMe(result.usuario.codigo)
      navigate('/')
      window.scrollTo(0, 0)
      alerts.toastSuccess('Login realizado', `Bem-vindo(a), ${result.usuario.nome.split(' ')[0]}.`)
    } catch (error) {
      sessao.limpar()
      limparEstado()
      alerts.error('Não foi possível entrar', error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const sair = () => {
    const refreshToken = sessao.refreshToken
    sessao.limpar()
    // Encerra o refresh token no backend; se falhar, ele expira sozinho.
    if (refreshToken) request('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {})
    limparEstado()
    navigate('/login')
    window.scrollTo(0, 0)
  }

  // Quando a renovação automática falha (refresh vencido ou revogado), volta para o login.
  useEffect(() => {
    sessao.onExpirada = () => {
      limparEstado()
      navigate('/login')
      alerts.error('Sessão expirada', 'Entre novamente para continuar.')
    }
    return () => { sessao.onExpirada = null }
  }, [])

  const persistCollection = async (key, before, after) => {
    if (!sessao.ativa) throw new Error('Sua sessão expirou. Entre novamente.')
    const oldById = new Map(before.map(item => [String(item.id), item]))
    const newById = new Map(after.map(item => [String(item.id), item]))
    const created = after.filter(item => !oldById.has(String(item.id)))
    const deleted = before.filter(item => !newById.has(String(item.id)))
    const updated = after.filter(item => oldById.has(String(item.id)) && JSON.stringify(item) !== JSON.stringify(oldById.get(String(item.id))))

    // Projetos, Equipe, Tarefas e Documentos usam src/services/<modulo>.js (chamadas diretas).
    if (key === 'k') {
      for (const item of created) await request('/capacitacoes', { method: 'POST', auth: true, body: { titulo: item.titulo, data: item.data, hora: item.hora, codigoInstrutor: item.instrutorId || me, vagas: Number(item.vagas), tipo: item.tipo, sala: item.sala } })
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        const wasIn = (old.inscritos || []).some(code => String(code) === String(me))
        const isIn = (item.inscritos || []).some(code => String(code) === String(me))
        if (wasIn !== isIn) {
          await request(`/capacitacoes/${item.id}/inscricoes${isIn ? '' : `/${me}`}`, { method: isIn ? 'POST' : 'DELETE', auth: true, ...(isIn ? { body: { codigoUsuario: me } } : {}) })
        }
      }
    } else if (key === 'f') {
      for (const item of created) await request(`/capacitacoes/${item.capId}/feedbacks`, { method: 'POST', auth: true, body: { codigoUsuario: item.usuarioId, nota: Number(item.nota), bom: item.bom || null, melhorar: item.melhorar || null, data: dateTime(item.data) } })
    }
    const refreshed = await loadApiData()
    const next = { ...refreshed, c: readConfig(refreshed.senioridades, false) }
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

  return <Ctx.Provider value={{ D, DF, up, form, go, me, mb, nav, entrar, sair, md, setMd, loading, refresh, pode }}>{children}</Ctx.Provider>
}
