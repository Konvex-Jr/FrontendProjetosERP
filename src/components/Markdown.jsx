import { blocos, trechos } from '../lib/markdown'

/** Mostra Markdown simples (ver lib/markdown.js) como elementos React, sem HTML bruto. */
function Linha({ texto }) {
  const partes = String(texto).split('\n')
  return partes.map((parte, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {trechos(parte).map((x, j) => {
        if (x.t === 'b') return <strong key={j}>{x.texto}</strong>
        if (x.t === 'i') return <em key={j}>{x.texto}</em>
        if (x.t === 'code') return <code key={j}>{x.texto}</code>
        if (x.t === 'a')
          return (
            <a key={j} href={x.url} target="_blank" rel="noopener noreferrer">
              {x.texto}
            </a>
          )
        return <span key={j}>{x.texto}</span>
      })}
    </span>
  ))
}

export default function Markdown({ texto }) {
  return (
    <div className="md">
      {blocos(texto).map((b, i) => {
        if (b.t === 'h') {
          const H = `h${b.n + 2}`
          return (
            <H key={i}>
              <Linha texto={b.texto} />
            </H>
          )
        }
        if (b.t === 'ul')
          return (
            <ul key={i}>
              {b.itens.map((x, j) => (
                <li key={j}>
                  <Linha texto={x} />
                </li>
              ))}
            </ul>
          )
        if (b.t === 'ol')
          return (
            <ol key={i}>
              {b.itens.map((x, j) => (
                <li key={j}>
                  <Linha texto={x} />
                </li>
              ))}
            </ol>
          )
        if (b.t === 'q')
          return (
            <blockquote key={i}>
              <Linha texto={b.texto} />
            </blockquote>
          )
        return (
          <p key={i}>
            <Linha texto={b.texto} />
          </p>
        )
      })}
    </div>
  )
}
