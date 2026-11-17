import { chip } from '../lib/utils'

/** Chip com o ponto da cor e o nome da etapa (coluna do quadro do projeto). */
export default function SeloEtapa({ coluna }) {
  if (!coluna) return null
  return (
    <span className={chip('selo-etapa kc-' + coluna.cor)} title={'Etapa: ' + coluna.nome}>
      <i className="kc-ponto" aria-hidden="true" />
      {coluna.nome}
    </span>
  )
}
