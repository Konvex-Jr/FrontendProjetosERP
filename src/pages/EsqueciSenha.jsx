import { useState } from 'react'
import { Link } from 'react-router-dom'
import CascaConta from '../components/CascaConta'
import { conta } from '../services/conta'

/** Pede o link para criar uma senha nova. A resposta é sempre a mesma, exista ou não o e-mail. */
export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resposta, setResposta] = useState('')
  const [erro, setErro] = useState('')

  const enviar = async event => {
    event.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      const dados = await conta.esqueciSenha(email)
      setResposta(dados.message)
    } catch (error) {
      setErro(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <CascaConta>
      <form className="lgv-form" onSubmit={enviar}>
        <div>
          <h2>Esqueci a senha</h2>
          <small>Informe seu e-mail da Konvex e enviaremos um link para criar uma senha nova.</small>
        </div>
        {resposta ? (
          <small role="status">{resposta}</small>
        ) : (
          <>
            <label>
              E-mail
              <input
                className="form-control"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="nome@konvexjr.com.br"
              />
            </label>
            {erro && (
              <small className="senha-aviso" role="alert">
                {erro}
              </small>
            )}
            <button className="btn btn-dk w-100" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar link'}
            </button>
          </>
        )}
        <Link className="btn btn-g w-100" to="/login">
          Voltar ao login
        </Link>
      </form>
    </CascaConta>
  )
}
