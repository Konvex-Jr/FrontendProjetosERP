import { hj } from '../lib/utils'
import { abrirCom } from '../lib/atalho'
import { indicadores } from '../lib/indicadores'

/** Os sete indicadores da Konvex (RF-110), só para a gestão. Cada número abre a lista correspondente. */
export default function Indicadores({ D, go }) {
  const abrir = ([tela, filtro]) => {
    if (filtro) abrirCom(tela, filtro)
    go(tela)
  }
  return (
    <section className="card card-body mb-3" aria-label="Indicadores da Konvex">
      <h2>Indicadores da Konvex</h2>
      <div className="kpi">
        {indicadores(D, hj(D)).map(i => (
          <button
            key={i.chave}
            type="button"
            className={'kpi-i' + (i.alerta && i.numero ? ' al' : '')}
            title={i.dica}
            onClick={() => abrir(i.destino)}
          >
            <b>{i.numero}</b>
            <span>{i.rotulo}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
