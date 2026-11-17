import { useRef, useState } from 'react'
import { agrupar } from '../lib/colunas'
import CartaoTarefa from './CartaoTarefa'
import Ic from './Icon'
import SeloEtapa from './SeloEtapa'
import { chip } from '../lib/utils'

/**
 * Quadro do projeto: uma coluna por etapa (`colunas` já no formato da tela, ver `adaptColuna`).
 * Soltar o cartão em outra coluna move a tarefa; o prazo não muda.
 * `adicionar(colunaId)` liga o "+" do cabeçalho (ou null).
 */
export default function KanbanEtapas({ D, T, colunas, papelDe, acoes, abrir, adicionar }) {
  const [ov, setOv] = useState(null),
    dg = useRef(null)
  const grupos = agrupar(colunas, T)

  const soltar = (t, coluna) => {
    const papel = papelDe(t)
    if (!(papel.organiza || papel.podeStatus(t))) return
    // Tarefa sem coluna conhecida conta como da coluna de entrada (mesma regra do `agrupar`).
    const atual = grupos.find(g => g.tarefas.includes(t))?.coluna.id
    if (atual === coluna.id) return
    acoes.mover(t, coluna.id)
  }

  return (
    <div className="kb kb-et">
      {grupos.map(({ coluna, tarefas }) => (
        <div
          className={'col-k kc-' + coluna.cor + (ov === coluna.id ? ' over' : '')}
          key={coluna.id}
          onDragOver={e => {
            e.preventDefault()
            setOv(coluna.id)
          }}
          onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setOv(null)}
          onDrop={e => {
            e.preventDefault()
            setOv(null)
            dg.current && soltar(dg.current, coluna)
            dg.current = null
          }}
        >
          <h3>
            <span className="kc-nome">
              <SeloEtapa coluna={coluna} />
              {coluna.papel == 'entrada' && (
                <span className="kc-sinal" title="Coluna de entrada: tarefas novas caem aqui">
                  <Ic k="entrada" />
                </span>
              )}
              {coluna.papel == 'concluida' && (
                <span className="kc-sinal" title="Coluna concluída: conta no progresso">
                  <Ic k="check" />
                </span>
              )}
            </span>
            <span className="d-inline-flex align-items-center gap-1">
              <span className={chip()}>{tarefas.length}</span>
              {adicionar && (
                <button
                  className="dots"
                  aria-label={'Adicionar tarefa em ' + coluna.nome}
                  title="Adicionar tarefa"
                  onClick={() => adicionar(coluna.id)}
                >
                  <Ic k="plus" />
                </button>
              )}
            </span>
          </h3>
          {tarefas.map(t => (
            <CartaoTarefa
              key={t.id}
              D={D}
              t={t}
              papel={papelDe(t)}
              acoes={acoes}
              abrir={abrir}
              colunas={colunas}
              aoArrastar={x => (dg.current = x)}
              aoSoltar={() => {
                dg.current = null
                setOv(null)
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
