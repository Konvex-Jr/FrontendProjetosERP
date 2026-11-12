import Ic from './Icon'
import { ini } from '../lib/utils'

/** Peças pequenas de interface usadas em várias telas. */

/** Avatares (iniciais) das pessoas de `ids`, com o nome no title. */
export const Av = ({ D, ids }) => (
  <span>
    {ids.map(i => {
      const u = D.u.find(x => x.id == i)
      return (
        <span key={i} className="av" title={u?.nome}>
          {ini(u?.nome || '?')}
        </span>
      )
    })}
  </span>
)

/** Nota de 1 a 5. Com `set` vira seletor (radiogroup); sem ele, só mostra. */
export const Stars = ({ n, set }) => (
  <span className="stars" role={set ? 'radiogroup' : 'img'} aria-label={'Nota ' + n + ' de 5'}>
    {[1, 2, 3, 4, 5].map(i =>
      set ? (
        <button
          type="button"
          key={i}
          role="radio"
          aria-checked={n == i}
          className={'st1' + (i <= n ? ' on' : '')}
          aria-label={i + ' de 5'}
          onClick={() => set(i)}
        >
          <Ic k="star" />
        </button>
      ) : (
        <span key={i} className={'st1' + (i <= n ? ' on' : '')}>
          <Ic k="star" />
        </span>
      ),
    )}
  </span>
)

/** Barra de progresso: `v` em %, ou `parts` = [[largura %, classe, opacidade], ...] para barra empilhada. */
export function Prog({ v, cls = '', parts }) {
  return (
    <div className="progress">
      {parts ? (
        parts.map(([w, c, o], i) => <div key={i} className={'progress-bar ' + c} style={{ width: w + '%', opacity: o }} />)
      ) : (
        <div className={'progress-bar ' + cls} style={{ width: v + '%' }} />
      )}
    </div>
  )
}

/** Título da tela, subtítulo e, à direita, os botões (`children`), que quebram linha no celular. */
export const PageBar = ({ title, sub, children }) => (
  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
    <div>
      <h1>{title}</h1>
      {sub && <p className="text-mu mb-0">{sub}</p>}
    </div>
    {children && <div className="d-flex flex-wrap align-items-center gap-2">{children}</div>}
  </div>
)

/** Botões de alternância (abas, visões): `items` = [[chave, rótulo]]; o ativo ganha a classe `on`. */
export const Seg = ({ items, value, onChange }) => (
  <div className="d-flex flex-wrap gap-2">
    {items.map(([k, l]) => (
      <button key={k} className={'btn btn-g' + (value == k ? ' on' : '')} onClick={() => onChange(k)}>
        {l}
      </button>
    ))}
  </div>
)
