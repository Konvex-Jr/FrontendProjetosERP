import { useApp } from '../context/AppContext'
import useCarregar from '../lib/useCarregar'
import { faixaOcupacao, resumoOcupacao } from '../lib/ocupacao'
import { ocupacao } from '../services/ocupacao'
import Esqueleto from './Esqueleto'

const COR = { ok: 'bg-success', atencao: 'bg-warning', perigo: 'bg-danger' }

function Linha({ p }) {
  const v = Math.round(p.percentual)
  return (
    <li className="ocup-linha">
      <a href={`#/perfil/${p.codigoUsuario}`}>{p.nome}</a>
      <div className="progress" role="img" aria-label={`${p.nome}: ${v}%`}>
        <div className={`progress-bar ${COR[faixaOcupacao(p.percentual)]}`} style={{ width: `${Math.min(v, 100)}%` }} />
      </div>
      <b>{v}%</b>
    </li>
  )
}

/** Cartão da gestão: quem está mais carregado e quem está livre na semana atual. */
export default function OcupacaoSemana() {
  const { me } = useApp()
  const { dados } = useCarregar(() => ocupacao.todas(), [me], { chave: `ocupacao-semana:${me}` })
  if (!dados) {
    return (
      <section className="card card-body mb-3" aria-label="Ocupação da semana">
        <h2>Ocupação da semana</h2>
        <Esqueleto linhas={3} />
      </section>
    )
  }
  const { acima, mais, livres } = resumoOcupacao(dados)
  return (
    <section className="card card-body mb-3" aria-label="Ocupação da semana">
      <h2>Ocupação da semana</h2>
      {acima > 0 && <p className="text-danger mb-2">{acima === 1 ? '1 pessoa acima de 100%' : `${acima} pessoas acima de 100%`}</p>}
      {!dados.length ? (
        <small>Nenhuma pessoa com horas previstas na semana.</small>
      ) : (
        <div className="row g-3">
          <div className="col-md-6">
            <h3 className="h6">Mais ocupados</h3>
            <ul className="ocup-lista">
              {mais.map(p => (
                <Linha key={p.codigoUsuario} p={p} />
              ))}
            </ul>
          </div>
          <div className="col-md-6">
            <h3 className="h6">Livres</h3>
            {livres.length ? (
              <ul className="ocup-lista">
                {livres.map(p => (
                  <Linha key={p.codigoUsuario} p={p} />
                ))}
              </ul>
            ) : (
              <small>Ninguém abaixo de 50%.</small>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
