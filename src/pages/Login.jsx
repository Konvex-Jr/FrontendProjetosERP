import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import CascaConta from '../components/CascaConta'

/**
 * Tela de login (fora do Layout). `entrar` do contexto chama a API, guarda a sessão e mostra o erro;
 * quem já está logado vai direto ao Dashboard.
 */
export default function Login() {
  const { me, entrar, loading } = useApp()
  const [em, setEm] = useState(''),
    [sn, setSn] = useState(''),
    [manter, setManter] = useState(false),
    [verSenha, setVerSenha] = useState(false)
  if (me) return <Navigate to="/" replace />

  const send = async event => {
    event.preventDefault()
    try {
      await entrar(em, sn, manter)
    } catch {
      /* O contexto apresenta o alerta de erro. */
    }
  }

  return (
    <CascaConta>
      <form onSubmit={send}>
        <div>
          <h2>Que bom te ver!</h2>
          <small>Entre com seu e-mail da Konvex e sua senha.</small>
        </div>
        <label>
          E-mail
          <input
            className="form-control"
            type="email"
            required
            autoComplete="username"
            value={em}
            onChange={event => setEm(event.target.value)}
            placeholder="nome@konvexjr.com.br"
          />
        </label>
        <label>
          Senha
          <span className="campo-senha">
            <input
              className="form-control"
              type={verSenha ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={sn}
              onChange={event => setSn(event.target.value)}
            />
            <button
              type="button"
              className="campo-senha-ver"
              aria-label={verSenha ? 'Esconder a senha' : 'Mostrar a senha'}
              aria-pressed={verSenha}
              onClick={() => setVerSenha(v => !v)}
            >
              {verSenha ? 'Esconder' : 'Mostrar'}
            </button>
          </span>
        </label>
        <div className="lgv-opcoes">
          <label className="lgv-manter">
            <input type="checkbox" checked={manter} onChange={event => setManter(event.target.checked)} />
            Manter conectado
          </label>
          <Link className="link-texto" to="/esqueci-senha">
            Esqueci a senha
          </Link>
        </div>
        <button className="btn btn-dk w-100" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        <span className="lgv-foot">Problemas para entrar? Fale com a Inovação.</span>
      </form>
    </CascaConta>
  )
}
