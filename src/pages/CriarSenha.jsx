import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import CampoNovaSenha from '../components/CampoNovaSenha'
import CascaConta from '../components/CascaConta'
import { forcaSenha } from '../lib/senha'
import { conta } from '../services/conta'
import alerts from '../lib/alerts'

/**
 * Tela do link de senha (/senha/:token, fora do Layout): convite ("Crie sua senha") ou redefinição ("Nova senha").
 * Salvou, a pessoa já entra. Quem estava logado na aba sai antes de a sessão nova entrar.
 */
export default function CriarSenha() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { me, entrarComSessao, encerrarSessao, loading } = useApp()
  const [link, setLink] = useState(null)
  const [erroLink, setErroLink] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    conta
      .consultarLink(token)
      .then(dados => ativo && setLink(dados))
      .catch(error => ativo && setErroLink(error.message))
    return () => {
      ativo = false
    }
  }, [token])

  const pode = forcaSenha(senha) !== 'fraca' && senha === confirmacao && !enviando && !loading

  const enviar = async event => {
    event.preventDefault()
    if (!pode) return
    setEnviando(true)
    let sessao
    try {
      sessao = await conta.criarSenha(token, senha, confirmacao)
    } catch (error) {
      alerts.error('Não foi possível salvar a senha', error.message)
      setEnviando(false)
      return
    }
    // O link só derruba a sessão que já estava na aba depois de dar certo.
    if (me) encerrarSessao()
    try {
      await entrarComSessao(sessao)
    } catch {
      /* O contexto apresenta o alerta de erro. */
      setEnviando(false)
    }
  }

  if (erroLink) {
    return (
      <CascaConta>
        <div className="lgv-form">
          <div>
            <h2>Link indisponível</h2>
            <small role="alert">{erroLink}</small>
          </div>
          <button type="button" className="btn btn-dk w-100" onClick={() => navigate('/esqueci-senha')}>
            Pedir novo link
          </button>
          <Link className="btn btn-g w-100" to="/login">
            Voltar ao login
          </Link>
        </div>
      </CascaConta>
    )
  }

  if (!link) {
    return (
      <CascaConta>
        <div className="lgv-form">
          <small role="status">Conferindo o link…</small>
        </div>
      </CascaConta>
    )
  }

  const convite = link.tipo === 'convite'
  return (
    <CascaConta>
      <form className="lgv-form" onSubmit={enviar}>
        <div>
          <h2>{convite ? 'Crie sua senha' : 'Nova senha'}</h2>
          <small>
            {convite ? `Olá, ${link.primeiroNome}. Crie sua senha para entrar no sistema da Konvex.` : 'Escolha a nova senha da sua conta.'}
          </small>
        </div>
        <CampoNovaSenha valor={senha} confirmacao={confirmacao} onValor={setSenha} onConfirmacao={setConfirmacao} />
        <button className="btn btn-dk w-100" disabled={!pode}>
          {enviando ? 'Salvando…' : convite ? 'Criar senha e entrar' : 'Salvar e entrar'}
        </button>
      </form>
    </CascaConta>
  )
}
