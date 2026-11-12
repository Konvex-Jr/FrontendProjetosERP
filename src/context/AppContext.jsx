import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { path } from '../lib/utils'
import { request, sessao } from '../services/api'
import alerts from '../lib/alerts'
import { adaptProject, adaptTask, adaptUser, readConfig } from '../lib/apiMappers'
import { capacitacoes } from '../services/capacitacoes'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)
// Dados sem login: u pessoas, p projetos, t tarefas, k capacitações.
const VAZIO = { u: [], p: [], t: [], k: [] }
const SEM_ACESSO = { permissoes: [], menu: [] }

/**
 * Estado global do app logado. `useApp()` dá acesso a:
 * - `D`: dados compartilhados (u, p, t, k, c) já recortados para quem vê; `DF`: os mesmos, sem recorte;
 * - `me` (código da pessoa logada), `mb` (true quando não é gestão), `pode(permissao)` e `nav` (menu);
 * - `form(titulo, campos, inicial, salvar)`: abre o FormModal global (formato em components/FormModal.jsx);
 * - `go(tela, id)`: navega pela chave da tela (ver `path` em lib/utils);
 * - `entrar`, `sair`, `refresh` (recarrega D depois de salvar) e `recarregarCapacitacoes`.
 * Telas com dados próprios carregam com useCarregar; D serve aos avatares, ao Dashboard e à Visão Estratégica.
 */
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

  // Dados compartilhados por várias telas, carregados juntos no login e a cada refresh.
  const loadApiData = async () => {
    const [users, projects, tasks, trainings, senioridades] = await Promise.all([
      request('/usuarios', { auth: true }),
      request('/projetos', { auth: true }),
      request('/tarefas', { auth: true }),
      capacitacoes.listar(),
      request('/senioridades', { auth: true }),
    ])
    return {
      u: users.map(adaptUser),
      p: projects.map(adaptProject),
      t: tasks.map(adaptTask),
      // Capacitações já adaptadas (services/capacitacoes.js); usadas no Dashboard e na Visão Estratégica.
      k: trainings,
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

    // Abrir ou recarregar a página com sessão salva: confere a pessoa (/auth/me) e carrega tudo antes de mostrar as telas.
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
        // 401 = sessão vencida: só cai no login, sem alerta.
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
  // Sem permissão de gestor, a pessoa vê só os próprios projetos e tarefas.
  const mb = !!DF && !!me && !pode('projetos.editar')
  const D = useMemo(() => {
    if (!DF) return null
    return mb
      ? {
          ...DF,
          priv: true,
          p: DF.p.filter(project => project.membros.includes(me)),
          t: DF.t.filter(task => (task.responsaveis || []).includes(me)),
        }
      : DF
  }, [DF, me, mb])
  const nav = acesso.menu.map(item => [item.chave, item.rotulo, item.caminho])

  const limparEstado = () => {
    setMe(null)
    setMd(null)
    setAcesso(SEM_ACESSO)
    setD(current => (current ? { ...current, ...VAZIO } : current))
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
    return () => {
      sessao.onExpirada = null
    }
  }, [])

  // A tela de Capacitações chama depois de inscrever, cancelar ou editar, para o Dashboard ficar em dia.
  const recarregarCapacitacoes = async () => {
    const k = await capacitacoes.listar()
    setD(current => (current ? { ...current, k } : current))
  }

  // O FormModal é desenhado pelo Layout a partir de `md`; `opcoes` passa extras como `largo`.
  const form = (title, fields, initial, save, opcoes = {}) => setMd({ t: title, fs: fields, init: initial, save, ...opcoes })
  const go = (name, pid) => {
    navigate(path(name, pid))
    window.scrollTo(0, 0)
  }

  // Nada aparece antes de saber se há sessão: evita mostrar o login por um instante a quem já está logado.
  if (!sessionReady || !DF) return <main className="container py-5">Carregando…</main>

  return (
    <Ctx.Provider value={{ D, DF, form, go, me, mb, nav, entrar, sair, md, setMd, loading, refresh, pode, recarregarCapacitacoes }}>
      {children}
    </Ctx.Provider>
  )
}
