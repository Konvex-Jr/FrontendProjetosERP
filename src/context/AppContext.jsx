import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { iso, path } from '../lib/utils'
import { request, sessao } from '../services/api'
import alerts from '../lib/alerts'
import { readConfig } from '../lib/apiMappers'
import { capacitacoes } from '../services/capacitacoes'
import { carregarAcesso, carregarDadosGlobais, carregarInicio } from '../services/inicio'
import { apagarMemorias, definirPessoa } from '../lib/memoriasDaAba'
import { EsqueletoApp } from '../components/Esqueleto'

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

  const refresh = async config => {
    const apiData = await carregarDadosGlobais()
    const resolvedConfig = config || readConfig(apiData.senioridades, false)
    const next = { ...apiData, c: resolvedConfig }
    setD(next)
    return next
  }

  useEffect(() => {
    let active = true

    // Abrir ou recarregar a página com sessão salva: confere a pessoa (/auth/me), os dados e o menu
    // numa rodada só (services/inicio.js), antes de mostrar as telas.
    const initialize = async () => {
      const defaultConfig = readConfig()
      if (!sessao.ativa) {
        sessao.limpar()
        setD({ c: defaultConfig, ...VAZIO })
        return
      }

      try {
        const { eu, dados: data, acesso: permissoes } = await carregarInicio()
        if (!active) return
        // A memória de dados passa a ser desta pessoa antes de qualquer tela montar e ler dela.
        definirPessoa(eu.codigo)
        setAcesso(permissoes)
        setMe(eu.codigo)
        setD({ ...data, c: readConfig(data.senioridades, false) })
      } catch (error) {
        console.error('Erro ao carregar dados da API:', error)
        sessao.limpar()
        apagarMemorias()
        setMe(null)
        setAcesso(SEM_ACESSO)
        setD({ c: defaultConfig, ...VAZIO })
        // 401 = sessão vencida: quem avisa é o onExpirada ("Sessão expirada"), se havia sessão; outro alerta aqui o repetiria.
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
  // "Hoje" (D.c.hoje) acompanha o relógio: uma aba aberta de um dia para o outro não fica mostrando
  // os atrasos do dia anterior. Confere a cada minuto e quando a aba volta ao foco.
  useEffect(() => {
    const conferirDia = () =>
      setD(atual => (atual?.c && atual.c.hoje !== iso(new Date()) ? { ...atual, c: { ...atual.c, hoje: iso(new Date()) } } : atual))
    const timer = setInterval(conferirDia, 60_000)
    window.addEventListener('focus', conferirDia)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', conferirDia)
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

  // Fim de sessão (sair, sessão expirada, login que falhou): apaga também a memória de dados,
  // para nada de uma pessoa aparecer para a próxima que entrar nesta aba.
  const limparEstado = () => {
    apagarMemorias()
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
      // Troca a dona da memória antes de buscar dados: outra conta nesta aba apaga o que havia.
      definirPessoa(result.usuario.codigo)
      const [data, permissoes] = await Promise.all([carregarDadosGlobais(), carregarAcesso()])
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

  // A tela de Capacitações chama ao abrir a lista e depois de inscrever, cancelar, editar ou excluir,
  // para a lista e o Dashboard ficarem em dia.
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
  // Com sessão salva, o esqueleto do layout ocupa o lugar; sem sessão a resposta é imediata e vai ao login.
  if (!sessionReady || !DF) return sessao.ativa ? <EsqueletoApp /> : null

  return (
    <Ctx.Provider value={{ D, DF, form, go, me, mb, nav, entrar, sair, md, setMd, loading, refresh, pode, recarregarCapacitacoes }}>
      {children}
    </Ctx.Provider>
  )
}
