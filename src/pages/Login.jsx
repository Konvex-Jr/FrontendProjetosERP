import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const BASE = import.meta.env.BASE_URL + 'assets/'

export default function Login() {
  const { me, entrar, loading } = useApp()
  const [em, setEm] = useState(''), [sn, setSn] = useState('')
  if (me) return <Navigate to="/" replace />

  const send = async event => {
    event.preventDefault()
    try { await entrar(em, sn) } catch { /* O contexto apresenta o alerta de erro. */ }
  }

  return (
    <div className="lgv">
      <section className="lgv-hx">
        <img className="lgv-logo" src={BASE + 'logo-branca.webp'} width={192} height={28} alt="Konvex Jr" />
        <div className="lgv-tx">
          <span className="lgv-pill">Sistema interno · Konvex Jr</span>
          <h1>A Konvex em <em>movimento</em>.</h1>
          <p>Projetos, tarefas, pessoas e capacitações num só lugar.</p>
        </div>
        <div className="lgv-glass" aria-hidden="true">
          <small>Acesso</small>
          <b>Membros da Konvex Jr</b>
          <span>Entre com o e-mail da empresa.</span>
        </div>
      </section>
      <main className="lgv-mold">
        <form onSubmit={send}>
          <img className="lgo cla" src={BASE + 'logo.webp'} width={192} height={28} alt="Konvex Jr" />
          <img className="lgo esc" src={BASE + 'logo-branca.webp'} width={192} height={28} alt="Konvex Jr" />
          <div>
            <h2>Bem-vindo de volta</h2>
            <small>Entre com sua conta da Konvex.</small>
          </div>
          <label>E-mail
            <input className="form-control" type="email" required autoComplete="username" value={em} onChange={event => setEm(event.target.value)} placeholder="nome@konvexjr.com.br" />
          </label>
          <label>Senha
            <input className="form-control" type="password" required autoComplete="current-password" value={sn} onChange={event => setSn(event.target.value)} />
          </label>
          <button className="btn btn-dk w-100" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
          <span className="lgv-foot">Problemas para entrar? Fale com a Inovação.</span>
        </form>
      </main>
    </div>
  )
}
