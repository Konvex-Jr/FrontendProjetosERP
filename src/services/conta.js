import { request } from './api.js'

/** Chamadas de conta sem sessão (sem token): link de senha e "esqueci a senha". */
export const conta = {
  /** `{ tipo: 'convite' | 'redefinir', primeiroNome }`; link inválido = erro 400 `LINK_SENHA_INVALIDO`. */
  consultarLink: token => request(`/auth/link-senha/${encodeURIComponent(token)}`),
  /** Mesma resposta do login (token, refreshToken, usuario). */
  criarSenha: (token, senha, confirmacao) =>
    request(`/auth/link-senha/${encodeURIComponent(token)}`, { method: 'POST', body: { senha, confirmacao } }),
  /** Sempre devolve `{ message }`, exista ou não o e-mail. */
  esqueciSenha: email => request('/auth/esqueci-senha', { method: 'POST', body: { email: email.trim().toLowerCase() } }),
}
