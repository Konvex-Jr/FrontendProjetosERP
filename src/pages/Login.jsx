import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const BASE = import.meta.env.BASE_URL + 'assets/'

/**
 * Tela de login (fora do Layout). `entrar` do contexto chama a API, guarda a sessão e mostra o erro;
 * quem já está logado vai direto ao Dashboard.
 */
export default function Login() {
  const { me, entrar, loading } = useApp()
  const [em, setEm] = useState(''),
    [sn, setSn] = useState('')
  if (me) return <Navigate to="/" replace />

  const send = async event => {
    event.preventDefault()
    try {
      await entrar(em, sn)
    } catch {
      /* O contexto apresenta o alerta de erro. */
    }
  }

  return (
    <div className="lgv">
      <section className="lgv-hx">
        <img className="lgv-logo" src={BASE + 'logo-branca.webp'} width={192} height={28} alt="Konvex Jr" />
        <div className="lgv-tx">
          <span className="lgv-pill">Sistema interno</span>
          <h1>
            A Konvex em <em>movimento</em>.
          </h1>
          <p>Projetos, tarefas, pessoas e capacitações num só lugar.</p>
        </div>
        <div className="lgv-glass" aria-hidden="true">
          <small>Acesso</small>
          <b>Só para membros</b>
          <span>Use o e-mail e a senha da empresa</span>
        </div>
      </section>
      <main className="lgv-mold">
        <form onSubmit={send}>
          <div>
            <h2>Bem-vindo de volta</h2>
            <small>Entre com seu e-mail e senha.</small>
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
            <input
              className="form-control"
              type="password"
              required
              autoComplete="current-password"
              value={sn}
              onChange={event => setSn(event.target.value)}
            />
          </label>
          <button className="btn btn-dk w-100" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          <span className="lgv-foot">Problemas para entrar? Fale com a Inovação.</span>
        </form>
      </main>
    </div>
  )
}
