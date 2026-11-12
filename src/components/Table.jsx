import { useState } from 'react'

/**
 * Tabela configurável (ADR-007). `vazio`: texto quando não há linhas (diga o que fazer em seguida).
 * `filtros`: valores iniciais dos selects, por chave da coluna (ex.: vindo de um atalho do Dashboard).
 * `busca={false}`: esconde a busca e os filtros internos (quando a tela filtra pela API, como a Base).
 */
export default function Table({ cols, rows, vazio, filtros, busca = true }) {
  const [q, setQ] = useState(''),
    [s, setS] = useState({ k: null, dir: 1 }),
    [f, setF] = useState(filtros || {})
  const val = (r, c) => (c.get ? c.get(r) : r[c.k])
  let R = rows.filter(
    r =>
      cols.every(c => !f[c.k] || String(val(r, c)) == f[c.k]) &&
      (!q || cols.some(c => c.k && String(val(r, c)).toLowerCase().includes(q.toLowerCase()))),
  )
  if (s.k) {
    const c = cols.find(c => c.k == s.k)
    R = [...R].sort((a, b) => {
      const x = val(a, c),
        y = val(b, c)
      return (x > y ? 1 : x < y ? -1 : 0) * s.dir
    })
  }
  const sort = c => c.k && setS(o => ({ k: c.k, dir: o.k == c.k ? -o.dir : 1 }))
  return (
    <div>
      {busca && (
        <div className="fl d-flex flex-wrap gap-2 mb-2">
          <input
            className="form-control w-auto flex-grow-1"
            style={{ maxWidth: 260 }}
            placeholder="Buscar…"
            aria-label="Buscar"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {cols
            .filter(c => c.filter)
            .map(c => (
              <select
                key={c.k}
                className="form-select w-auto"
                style={{ maxWidth: 260 }}
                aria-label={'Filtrar ' + c.l}
                value={f[c.k] || ''}
                onChange={e => setF({ ...f, [c.k]: e.target.value })}
              >
                <option value="">{c.fl || c.l}: todos</option>
                {[...new Set(rows.map(r => String(val(r, c))))].sort().map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ))}
        </div>
      )}
      <div className="tw">
        <table className="table table-hover align-middle tc">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th
                  key={i}
                  className={c.k ? '' : 'n'}
                  onClick={() => sort(c)}
                  aria-sort={s.k == c.k ? (s.dir > 0 ? 'ascending' : 'descending') : undefined}
                >
                  {c.l}
                  {s.k == c.k && c.k ? (s.dir > 0 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* data-l e as classes permitem virar cartão no celular (ver .tc em components.css). */}
            {R.map(r => (
              <tr key={r.id}>
                {cols.map((c, i) => (
                  <td key={i} data-l={c.l} className={c.l === 'Ações' ? 'tc-a' : i === 0 ? 'tc-t' : ''}>
                    {c.render ? c.render(r) : val(r, c)}
                  </td>
                ))}
              </tr>
            ))}
            {!R.length && (
              <tr className="tc-v">
                <td colSpan={cols.length}>
                  <small>{rows.length ? 'Nada encontrado. Ajuste a busca ou os filtros.' : vazio || 'Nada cadastrado ainda.'}</small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
