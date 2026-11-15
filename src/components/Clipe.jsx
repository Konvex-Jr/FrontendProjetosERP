import Ic from './Icon'
import { rotuloArquivos } from '../lib/utils'

/** Clipe com a quantidade de arquivos (lista da Biblioteca, cartão do Kanban). Sem arquivo, não mostra nada. */
export default function Clipe({ n }) {
  if (!(n > 0)) return null
  return (
    <span className="bd" role="img" title={rotuloArquivos(n)} aria-label={rotuloArquivos(n)}>
      <Ic k="clip" />
      {n}
    </span>
  )
}
