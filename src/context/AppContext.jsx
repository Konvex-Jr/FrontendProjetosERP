import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { iso, path } from '../lib/utils'
import { comTravaDeSessao, request, retomarSessao, sessao } from '../services/api'
import alerts from '../lib/alerts'
import { readConfig } from '../lib/apiMappers'
import { capacitacoes } from '../services/capacitacoes'
import { carregarAcesso, carregarDadosGlobais, carregarInicio } from '../services/inicio'
import { apagarMemorias, definirPessoa } from '../lib/memoriasDaAba'
import { memoria } from '../lib/memoria'
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
 * - `entrar(email, senha, manterConectado)`, `entrarComSessao(resposta)`, `encerrarSessao`, `sair`, `refresh` (recarrega D depois de salvar) e `recarregarCapacitacoes`.
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
  // Dados obrigatórios do perfil que faltam (GET /auth/me, login, PUT /auth/perfil); com itens, só a tela de completar abre.
  const [pendencias, setPendencias] = useState([])

  const refresh = async config => {
    const dona = memoria.pessoa()
    const apiData = await carregarDadosGlobais()
    // Saiu e outra pessoa entrou enquanto a resposta vinha: os dados são da pessoa anterior, descarta.
    if (memoria.pessoa() !== dona) return null
    const resolvedConfig = config || readConfig(apiData.senioridades, false)
    const next = { ...apiData, c: resolvedConfig }
    setD(next)
    return next
  }

  useEffect(() => {
    let active = true

    // Abrir ou recarregar a página com sessão salva: confere a pessoa (/auth/me), os dados e o menu
    // numa rodada só (services/inicio.js), antes de mostrar as telas. Aba sem sessão tenta antes
    // retomar a sessão lembrada pelo cookie ("manter conectado"); sem cookie válido, vai ao login.
    const initialize = async () => {
      const defaultConfig = readConfig()
      if (!sessao.ativa && !(await retomarSessao())) {
        if (!active) return
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
        setPendencias(eu.pendenciasPerfil || [])
        setMe(eu.codigo)
        setD({ ...data, c: readConfig(data.senioridades, false) })
      } catch (error) {
        console.error('Erro ao carregar dados da API:', error)
        sessao.limpar()
        apagarMemorias()
        setMe(null)
        setPendencias([])
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
  // [chave, rótulo, caminho, grupo]. Item sem grupo (Configurações) não entra na lista do menu: vira a engrenagem do topo.
  const nav = acesso.menu.map(item => [item.chave, item.rotulo, item.caminho, item.grupo])

  // Fim de sessão (sair, sessão expirada, login que falhou): apaga também a memória de dados,
  // para nada de uma pessoa aparecer para a próxima que entrar nesta aba.
  const limparEstado = () => {
    apagarMemorias()
    setMe(null)
    setPendencias([])
    setMd(null)
    setAcesso(SEM_ACESSO)
    setD(current => (current ? { ...current, ...VAZIO } : current))
  }

  // Fluxo único de entrada (login e Criar senha): `obter` devolve a resposta no formato do login.
  const executarEntrada = async obter => {
    setLoading(true)
    try {
      const result = await obter()
      if (!result?.token || !result?.usuario?.codigo) throw new Error('A API não retornou uma sessão válida.')
      sessao.salvar({ token: result.token, refreshToken: result.refreshToken })
      // Troca a dona da memória antes de buscar dados: outra conta nesta aba apaga o que havia.
      definirPessoa(result.usuario.codigo)
      const [data, permissoes] = await Promise.all([carregarDadosGlobais(), carregarAcesso()])
      setD({ ...data, c: readConfig(data.senioridades, false) })
      setAcesso(permissoes)
      setPendencias(result.usuario.pendenciasPerfil || [])
      setMe(result.usuario.codigo)
      navigate('/')
      window.scrollTo(0, 0)
      alerts.toastSuccess(`Boas-vindas, ${result.usuario.nome.split(' ')[0]}!`)
    } catch (error) {
      sessao.limpar()
      limparEstado()
      alerts.error('Não foi possível entrar', error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const entrar = (email, senha, manterConectado = false) =>
    executarEntrada(() =>
      // Na mesma trava do retomar e do logout: o cookie de lembrete é um só para todas as abas.
      comTravaDeSessao(() =>
        request('/auth/login', {
          method: 'POST',
          body: { email: email.trim().toLowerCase(), senha, manterConectado: Boolean(manterConectado) },
        }),
      ),
    )

  // Sessão que já veio pronta da API (Criar senha): mesma resposta do login.
  const entrarComSessao = result => executarEntrada(async () => result)

  // Encerra a sessão desta aba sem navegar (usado por `sair` e pela Criar senha).
  const encerrarSessao = () => {
    const refreshToken = sessao.refreshToken
    sessao.limpar()
    // Encerra o refresh token e o lembrete do cookie no backend; vai mesmo sem refresh token na aba,
    // para apagar o cookie do "manter conectado". Se falhar, os dois expiram sozinhos. Pela trava,
    // um login logo depois (troca de conta) só sai quando este logout terminar.
    comTravaDeSessao(() => request('/auth/logout', { method: 'POST', body: refreshToken ? { refreshToken } : {} })).catch(() => {})
    limparEstado()
  }

  const sair = () => {
    encerrarSessao()
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
  // O esqueleto do layout ocupa o lugar enquanto confere a sessão salva ou tenta retomar a lembrada.
  if (!sessionReady || !DF) return <EsqueletoApp />

  return (
    <Ctx.Provider
      value={{
        D,
        DF,
        form,
        go,
        me,
        mb,
        nav,
        entrar,
        entrarComSessao,
        encerrarSessao,
        sair,
        md,
        setMd,
        loading,
        refresh,
        pode,
        pendencias,
        setPendencias,
        recarregarCapacitacoes,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
