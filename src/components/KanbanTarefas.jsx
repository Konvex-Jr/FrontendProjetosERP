import { useRef, useState } from 'react'
import { DAY, PC, chip, d, fm, hj, iso } from '../lib/utils'
import { origemTarefa } from '../services/tarefas'
import Ic from './Icon'
import ActionMenu from './ActionMenu'
import alerts from '../lib/alerts'
import { Av } from './Ui'

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
  const { h, m, col } = semanas(D)

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
            {l.map(t => {
              const papel = papelDe(t)
              const lt = t.status != 'concluida' && d(t.fim) < h,
                dn = t.status == 'concluida'
              return (
                <div
                  key={t.id}
                  draggable={papel.organiza || papel.podeStatus(t)}
                  className="tk"
                  onClick={() => abrir(t.id)}
                  // A tarefa arrastada fica na ref `dg`: o dataTransfer só leva texto.
                  onDragStart={e => {
                    dg.current = t
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', String(t.id))
                  }}
                  onDragEnd={() => {
                    dg.current = null
                    setOv(null)
                  }}
                >
                  <span className={chip(PC[t.prioridade])}>{t.prioridade}</span>
                  {origem && (
                    <span
                      className={chip(t.avulsa ? 'p3 ms-1 kb-or' : 'ms-1 kb-or')}
                      title={(t.avulsa ? 'Tarefa avulsa: ' : 'Projeto: ') + origemTarefa(t)}
                    >
                      {origemTarefa(t)}
                    </span>
                  )}
                  <b>{t.titulo}</b>
                  <div className="tkf">
                    <span className="bds">
                      <span className={'bd ' + (dn ? 'ok' : lt ? 'er' : '')} title={dn ? 'Concluída' : lt ? 'Atrasada' : 'Prazo'}>
                        <Ic k="clock" />
                        {fm(dn && t.conclusao ? t.conclusao : t.fim)}
                      </span>
                      {(t.checklist || []).length > 0 && (
                        <span className={'bd ' + (t.checklist.every(x => x.feito) ? 'ok' : '')}>
                          <Ic k="check" />
                          {t.checklist.filter(x => x.feito).length}/{t.checklist.length}
                        </span>
                      )}
                      {t.dependeDe && (
                        <span className="bd" title="Depende de outra tarefa">
                          <Ic k="link" />
                        </span>
                      )}
                      {t.descricao && (
                        <span className="bd" title="Tem descrição">
                          <Ic k="list" />
                        </span>
                      )}
                    </span>
                    <Av D={D} ids={t.responsaveis} />
                  </div>
                  {papel.podeStatus(t) && (
                    <span className="cm t">
                      <ActionMenu
                        items={[
                          [dn ? 'undo' : 'check', dn ? 'Reabrir' : 'Concluir', () => acoes.tog(t)],
                          ...(papel.organiza
                            ? [
                                [
                                  'trash',
                                  'Excluir',
                                  async () => {
                                    if (
                                      await alerts.confirm({
                                        title: 'Excluir tarefa?',
                                        text: t.titulo,
                                        confirmText: 'Excluir tarefa',
                                        danger: true,
                                      })
                                    )
                                      acoes.del(t.id)
                                  },
                                  1,
                                ],
                              ]
                            : []),
                        ]}
                      />
                    </span>
                  )}
                </div>
              )
            })}
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
