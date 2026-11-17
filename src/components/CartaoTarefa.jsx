import { useState } from 'react'
import { chip, d, fm, hj, PC } from '../lib/utils'
import { origemTarefa } from '../services/tarefas'
import Clipe from './Clipe'
import SeloEtapa from './SeloEtapa'
import Ic from './Icon'
import ActionMenu from './ActionMenu'
import alerts from '../lib/alerts'
import { Av } from './Ui'

/**
 * Cartão de tarefa dos quadros (por semana e por etapa).
 * `papel` diz o que a pessoa pode nesta tarefa; `acoes` vem de `acoesTarefa`.
 * `origem`: mostra o projeto ou a categoria. `etapa`: mostra o selo da etapa (só tarefa de projeto). `colunas`: liga o item "Mover para…" (quadro por etapa).
 * `aoArrastar(t)` e `aoSoltar()` avisam o quadro do início e do fim do arrasto.
 */
export default function CartaoTarefa({ D, t, papel, acoes, abrir, origem = false, etapa = false, colunas, aoArrastar, aoSoltar }) {
  const [movendo, setMovendo] = useState(false)
  const lt = t.status != 'concluida' && d(t.fim) < hj(D),
    dn = t.status == 'concluida'
  const destinos = (colunas || []).filter(c => c.id !== t.coluna?.id)
  return (
    <div
      draggable={papel.organiza || papel.podeStatus(t)}
      className="tk"
      onClick={() => abrir(t.id)}
      // A tarefa arrastada fica no quadro (ref): o dataTransfer só leva texto.
      onDragStart={e => {
        aoArrastar(t)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(t.id))
      }}
      onDragEnd={aoSoltar}
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
      {etapa && !t.avulsa && (
        <span className="ms-1">
          <SeloEtapa coluna={t.coluna} />
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
          <Clipe n={t.quantidadeAnexos} />
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
              ...(destinos.length ? [['move', 'Mover para…', () => setMovendo(true)]] : []),
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
      {movendo && (
        <div
          className="mv"
          role="menu"
          aria-label="Mover para"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.key == 'Escape' && setMovendo(false)}
        >
          <div className="mv-t">
            Mover para
            <button className="dots" aria-label="Fechar" onClick={() => setMovendo(false)}>
              <Ic k="x" />
            </button>
          </div>
          {destinos.map(c => (
            <button
              key={c.id}
              role="menuitem"
              className={'mv-i kc-' + c.cor}
              autoFocus={c === destinos[0]}
              onClick={() => {
                setMovendo(false)
                acoes.mover(t, c.id)
              }}
            >
              <i className="kc-ponto" aria-hidden="true" />
              {c.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
