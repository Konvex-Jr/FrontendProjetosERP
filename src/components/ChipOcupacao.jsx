import { chip } from '../lib/utils'
import { faixaOcupacao } from '../lib/ocupacao'

const CLASSE_FAIXA = { ok: '', atencao: 'wa', perigo: 'er' }

/** Percentual da semana com a cor da faixa; "—" quando a ocupação não carregou. */
export default function ChipOcupacao({ percentual }) {
  if (percentual == null) return '—'
  return <span className={chip(CLASSE_FAIXA[faixaOcupacao(percentual)])}>{Math.round(percentual)}%</span>
}
