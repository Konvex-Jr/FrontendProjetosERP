import { useRef, useState } from 'react'
import { DAY, chip, d, hj, iso } from '../lib/utils'
import CartaoTarefa from './CartaoTarefa'
import Ic from './Icon'

export const COLUNAS = ['Essa semana', 'Semana que vem', 'Daqui a duas semanas', 'Concluído']

/** Segunda-feira da semana de hoje e a coluna de cada tarefa (por prazo; concluídas na última). */
export function semanas(D) {
  const h = hj(D),
    m = +h - ((h.getDay() + 6) % 7) * DAY
  // Atrasadas caem em "Essa semana"; prazos depois de duas semanas, em "Daqui a duas semanas".
  const col = t => (t.status == 'concluida' ? 3 : Math.min(2, Math.max(0, Math.floor((+d(t.fim) - m) / (7 * DAY)))))
  return { h, m, col }
}

// Ordem dentro da coluna: prioridade (P1 primeiro) e depois prazo.
const ordem = (a, b) => (a.prioridade > b.prioridade ? 1 : a.prioridade < b.prioridade ? -1 : a.fim > b.fim ? 1 : -1)

/**
 * Kanban de tarefas por semana, usado no projeto e no painel global (sessão 8c).
 * `papelDe(t)` diz o que a pessoa pode em cada tarefa; `acoes` vem de `acoesTarefa`.
 * `origem`: mostra no cartão o projeto ou a categoria (painel global).
 */
export default function KanbanTarefas({ D, T, papelDe, acoes, abrir, adicionar, origem = false }) {
  const [ov, setOv] = useState(null),
    dg = useRef(null)
  const { m, col } = semanas(D)

  const drop = (x, i) => {
    const papel = papelDe(x)
    const was = x.status == 'concluida'
    // Quem não organiza só conclui/reabre (sem mudar prazo); quem organiza também move entre semanas.
    if (!papel.organiza) {
      if (!papel.podeStatus(x)) return
      if ((i == 3 && !was) || (i < 3 && was)) acoes.tog(x)
      return
    }
    // Soltar numa semana muda o prazo para a sexta dessa semana (e puxa o início, se ele ficaria depois do prazo).
    let o
    if (i == 3) o = was ? x : { ...x, status: 'concluida' }
    else {
      if (!was && col(x) == i) return
      const mon = m + 7 * i * DAY,
        fim = iso(mon + 4 * DAY)
      o = { ...x, status: was ? 'andamento' : x.status, conclusao: undefined, fim }
      if (x.inicio > fim) o.inicio = iso(mon)
    }
    if (o !== x) acoes.salvar(x, o)
  }

  return (
    <div className="kb">
      {COLUNAS.map((c, i) => {
        const l = T.filter(t => col(t) == i).sort(ordem)
        return (
          <div
            className={'col-k' + (ov === i ? ' over' : '')}
            key={c}
            onDragOver={e => {
              e.preventDefault()
              setOv(i)
            }}
            onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setOv(null)}
            onDrop={e => {
              e.preventDefault()
              setOv(null)
              dg.current && drop(dg.current, i)
              dg.current = null
            }}
          >
            <h3>
              {c}
              <span className={chip()}>{l.length}</span>
            </h3>
            {l.map(t => (
              <CartaoTarefa
                key={t.id}
                D={D}
                t={t}
                papel={papelDe(t)}
                acoes={acoes}
                abrir={abrir}
                origem={origem}
                etapa
                aoArrastar={x => (dg.current = x)}
                aoSoltar={() => {
                  dg.current = null
                  setOv(null)
                }}
              />
            ))}
            {i < 3 && adicionar && (
              <button className="btn btn-ghost addc" onClick={() => adicionar(i)}>
                <Ic k="plus" />
                Adicionar tarefa
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
