import { forcaSenha, regrasSenha } from '../lib/senha'

const ROTULO = { fraca: 'Fraca', media: 'Média', forte: 'Forte' }
const SEGMENTOS = { fraca: 1, media: 2, forte: 3 }

/**
 * Senha nova + confirmação, com medidor de força e a lista das regras marcada ao digitar.
 * Controlado pela tela (valor/confirmacao); a tela decide quando liberar o botão com `forcaSenha`.
 */
export default function CampoNovaSenha({ valor, confirmacao, onValor, onConfirmacao }) {
  const forca = forcaSenha(valor)
  const diferente = confirmacao !== '' && confirmacao !== valor
  return (
    <>
      <label>
        Nova senha
        <input
          className="form-control"
          type="password"
          required
          autoComplete="new-password"
          value={valor}
          onChange={event => onValor(event.target.value)}
        />
      </label>
      <div className={`senha-forca senha-${forca}`}>
        <div className="senha-barra" aria-hidden="true">
          {[1, 2, 3].map(n => (
            <span key={n} className={n <= SEGMENTOS[forca] && valor ? 'on' : ''} />
          ))}
        </div>
        <span className="senha-texto" aria-live="polite">
          {valor ? ROTULO[forca] : 'Escolha uma senha'}
        </span>
      </div>
      <ul className="senha-regras">
        {regrasSenha(valor).map(regra => (
          <li key={regra.chave} className={regra.ok ? 'ok' : ''}>
            <span aria-hidden="true">{regra.ok ? '✓' : '○'}</span> {regra.rotulo}
            <span className="visually-hidden">{regra.ok ? ' (cumprida)' : ' (falta)'}</span>
          </li>
        ))}
      </ul>
      <label>
        Confirme a senha
        <input
          className="form-control"
          type="password"
          required
          autoComplete="new-password"
          value={confirmacao}
          onChange={event => onConfirmacao(event.target.value)}
        />
      </label>
      {diferente && (
        <small className="senha-aviso" role="alert">
          As senhas não conferem
        </small>
      )}
    </>
  )
}
