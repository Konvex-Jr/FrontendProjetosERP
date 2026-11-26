import { useEffect, useRef, useState } from 'react'
import { comparar, haLinhaNova, paginar } from '../lib/tabela'

/**
 * Tabela configurável (ADR-007). `vazio`: texto quando não há linhas (diga o que fazer em seguida).
 * `filtros`: valores iniciais dos selects, por chave da coluna (ex.: vindo de um atalho do Dashboard).
 * `busca={false}`: esconde a busca e os filtros internos (quando a tela filtra pela API, como a Base).
 *
 * Cada coluna de `cols`:
 * - `k`: chave. Sem `k`, a coluna não ordena nem entra na busca (ex.: Equipe, Ações);
 * - `l`: rótulo do cabeçalho. No celular vira o rótulo do campo no cartão; a coluna 'Ações' vai para o canto superior direito do cartão;
 * - `get(linha)`: valor usado na busca, na ordenação e no filtro (padrão: linha[k]). Use para texto, não para JSX;
 * - `render(linha)`: o que aparece na célula (padrão: o valor);
 * - `filter`: cria um select com os valores distintos da coluna; `fl`: rótulo desse select;
 * - `vals(linha)`: lista de valores da linha para o filtro, quando ela tem vários (ex.: as áreas de uma pessoa).
 * `reiniciarAoIncluir`: quando aparece linha com `id` novo, limpa a busca e os filtros (lista em que o usuário acaba de adicionar alguém);
 * `linhaCls(linha)`: classe extra da linha (ex.: esmaecer). A primeira coluna é o título do cartão no celular. Cada linha precisa de `id` (key do React).
 * `itens`: [singular, plural] da contagem do rodapé (padrão: resultado/resultados).
 * `porPagina`: liga a paginação só nas listas que crescem (Tarefas, Projetos, Biblioteca); ela só aparece quando a lista passa disso (25/11).
 */
export default function Table({
  cols,
  rows,
  vazio,
  filtros,
  busca = true,
  linhaCls,
  reiniciarAoIncluir = false,
  itens = ['resultado', 'resultados'],
  porPagina = Infinity,
}) {
  const [q, setQ] = useState(''),
    [s, setS] = useState({ k: null, dir: 1 }),
    [f, setF] = useState(filtros || {}),
    [pg, setPg] = useState(1)
  // Com `reiniciarAoIncluir`, linha nova limpa busca e filtros: senão quem foi adicionado "some" se não casar com o que está filtrado.
  const vistos = useRef(null)
  useEffect(() => {
    if (!reiniciarAoIncluir) return
    if (vistos.current && haLinhaNova(vistos.current, rows)) {
      setQ('')
      setF(filtros || {})
      setPg(1)
    }
    vistos.current = new Set(rows.map(r => r.id))
  }, [rows, reiniciarAoIncluir, filtros])
  const val = (r, c) => (c.get ? c.get(r) : r[c.k])
  let R = rows.filter(
    r =>
      cols.every(c => !f[c.k] || (c.vals ? c.vals(r).includes(f[c.k]) : String(val(r, c)) == f[c.k])) &&
      (!q || cols.some(c => c.k && String(val(r, c)).toLowerCase().includes(q.toLowerCase()))),
  )
  if (s.k) {
    const c = cols.find(c => c.k == s.k)
    R = [...R].sort((a, b) => {
      const x = val(a, c),
        y = val(b, c)
      return comparar(x, y) * s.dir
    })
  }
  const pagina = paginar(R, pg, porPagina)
  // Mudou a busca, um filtro ou a ordem: volta para a primeira página.
  const sort = c => c.k && (setS(o => ({ k: c.k, dir: o.k == c.k ? -o.dir : 1 })), setPg(1))
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
            onChange={e => (setQ(e.target.value), setPg(1))}
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
                onChange={e => (setF({ ...f, [c.k]: e.target.value }), setPg(1))}
              >
                <option value="">{c.fl || c.l}: todos</option>
                {[...new Set(rows.flatMap(r => (c.vals ? c.vals(r) : [String(val(r, c))])))].sort().map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ))}
        </div>
      )}
      <div className="tbx">
        <div className="tw">
          <table className="table table-hover align-middle tc">
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th
                    key={i}
                    className={c.k ? (s.k == c.k ? 'on' : '') : 'n'}
                    onClick={() => sort(c)}
                    aria-sort={s.k == c.k ? (s.dir > 0 ? 'ascending' : 'descending') : undefined}
                  >
                    {c.l}
                    {c.k && (
                      <span className={'ord' + (s.k == c.k ? ' on' : '')} aria-hidden="true">
                        {s.k == c.k ? (s.dir > 0 ? '▲' : '▼') : '▲▼'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* data-l e as classes permitem virar cartão no celular (ver .tc em components.css). */}
              {pagina.itens.map(r => (
                <tr key={r.id} className={linhaCls ? linhaCls(r) : undefined}>
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
        {R.length > 0 && (
          <div className="tw-rod">
            <span>
              {pagina.paginas > 1 ? `${pagina.inicio + 1}–${pagina.inicio + pagina.itens.length} de ` : ''}
              {R.length} {R.length == 1 ? itens[0] : itens[1]}
            </span>
            {pagina.paginas > 1 && (
              <nav className="tw-pag" aria-label="Páginas">
                <button type="button" className="btn btn-g btn-sm" disabled={pagina.pagina == 1} onClick={() => setPg(pagina.pagina - 1)}>
                  Anterior
                </button>
                {Array.from({ length: pagina.paginas }, (_, i) => i + 1).map(n => (
                  <button
                    type="button"
                    key={n}
                    className={'btn btn-g btn-sm' + (n == pagina.pagina ? ' on' : '')}
                    aria-current={n == pagina.pagina ? 'page' : undefined}
                    onClick={() => setPg(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-g btn-sm"
                  disabled={pagina.pagina == pagina.paginas}
                  onClick={() => setPg(pagina.pagina + 1)}
                >
                  Próxima
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
