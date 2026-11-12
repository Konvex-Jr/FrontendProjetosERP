import { useEffect, useState } from 'react'
import Ic from './Icon'
import Multi from './Multi'
import { Prog } from './Ui'
import { ST, chip, fm } from '../lib/utils'
import { CATEGORIAS, rotuloCategoria, tarefas } from '../services/tarefas'
import alerts from '../lib/alerts'

const L = ({ l, children }) => (
  <label className="form-label w-100 mb-3">
    {l}
    {children}
  </label>
)

/** Comentários da tarefa (sessão 8b): equipe comenta; autor, líder e gestão apagam. */
function Comentarios({ t, papel }) {
  const [lista, setLista] = useState(null),
    [texto, setTexto] = useState(''),
    [enviando, setEnviando] = useState(false)
  const carregar = () =>
    tarefas
      .comentarios(t.id)
      .then(setLista)
      .catch(error => {
        setLista([])
        alerts.error('Não foi possível carregar os comentários', error.message)
      })
  useEffect(() => {
    carregar()
  }, [t.id])
  const enviar = async () => {
    const v = texto.trim()
    if (!v || enviando) return
    setEnviando(true)
    try {
      await tarefas.comentar(t.id, v)
      setTexto('')
      await carregar()
    } catch (error) {
      alerts.error('Não foi possível comentar', error.message)
    } finally {
      setEnviando(false)
    }
  }
  const apagar = async c => {
    if (!(await alerts.confirm({ title: 'Apagar comentário?', confirmText: 'Apagar', danger: true }))) return
    try {
      await tarefas.apagarComentario(t.id, c.codigo)
      await carregar()
    } catch (error) {
      alerts.error('Não foi possível apagar', error.message)
    }
  }
  const quando = v => {
    const x = new Date(v)
    return x.toLocaleDateString('pt-BR') + ' ' + x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return (
    <div className="mt-4 tcols">
      <h4>
        <Ic k="msg" />
        Comentários{lista?.length > 0 && <span className={chip()}>{lista.length}</span>}
      </h4>
      {lista === null && <small>Carregando…</small>}
      {lista?.length === 0 && <small className="d-block mb-2">Nenhum comentário ainda.</small>}
      {lista?.map(c => (
        <div key={c.codigo} className="d-flex justify-content-between gap-2 py-2 border-bottom">
          <div style={{ minWidth: 0 }}>
            <small className="d-block">
              <b>{c.autor.nomeExibicao || c.autor.nome}</b> · {quando(c.criadoEm)}
            </small>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.texto}</div>
          </div>
          {papel.podeApagarComentario(c) && (
            <button className="dots" aria-label="Apagar comentário" title="Apagar" onClick={() => apagar(c)}>
              <Ic k="trash" />
            </button>
          )}
        </div>
      ))}
      {papel.participa && (
        <div className="d-flex gap-2 mt-2">
          <textarea
            className="form-control"
            rows={2}
            placeholder="Escreva um comentário…"
            aria-label="Novo comentário"
            value={texto}
            onChange={e => setTexto(e.target.value)}
          />
          <button className="btn btn-g align-self-end" disabled={!texto.trim() || enviando} onClick={enviar}>
            Comentar
          </button>
        </div>
      )}
    </div>
  )
}

/** Título em textarea que cresce com o texto (no celular, títulos longos não ficam cortados). */
const crescer = el => {
  if (el) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 2 + 'px'
  }
}

/**
 * Detalhes de uma tarefa (de projeto ou avulsa). Edita uma cópia (`draft`) e só envia ao salvar:
 * `salvar(antes, depois)` escolhe PATCH (só status) ou PUT (ver services/tarefas).
 * `papel` vem de papelNaTarefa/papelNasTarefas: sem `organiza`, os campos ficam travados.
 * `T` = tarefas carregadas na tela (para as dependências); `p` = projeto no formato do contexto.
 */
export default function TaskModal({ D, salvar, t, p, T, close, del, tog, papel, iniciativas }) {
  const [draft, setDraft] = useState({ ...t }),
    [nv, setNv] = useState('')
  const cl = draft.checklist || [],
    dn = cl.filter(x => x.feito).length
  const patch = o => setDraft(current => ({ ...current, ...o })),
    setCl = f => patch({ checklist: f(cl) })
  // A data de conclusão aqui é só para a tela; ela não vai no corpo, a API grava a data real.
  const st = value => patch({ status: value, conclusao: value == 'concluida' ? D.c.hoje : undefined })
  const save = async () => {
    if ((await salvar(t, draft)) !== false) close()
  }
  const remove = async () => {
    const confirmed = await alerts.confirm({
      title: 'Excluir tarefa?',
      text: 'Esta ação não poderá ser desfeita.',
      confirmText: 'Excluir tarefa',
      danger: true,
    })
    if (confirmed) {
      del(t.id)
      close()
    }
  }
  // Cadeia de dependências a partir de `id`; serve para não oferecer uma opção que criaria ciclo (A depende de B, B de A).
  const chain = id => {
    const o = []
    let x = T.find(y => y.id == id)
    while (x && !o.includes(x.id)) {
      o.push(x.id)
      x = T.find(y => y.id == x.dependeDe)
    }
    return o
  }
  // Dependência só entre tarefas do mesmo projeto (o painel global mistura projetos e avulsas).
  const doProjeto = t.avulsa ? [] : T.filter(c => c.projetoId == t.projetoId)
  const opts = doProjeto.filter(c => c.id != t.id && !chain(c.id).includes(t.id)),
    deps = doProjeto.filter(x => x.dependeDe == t.id)
  // Avulsa: qualquer pessoa ativa; de projeto: equipe atual.
  const gente = t.avulsa
    ? D.u.filter(u => u.ativo !== false || (t.responsaveis || []).includes(u.id))
    : D.u.filter(u => (p?.membros || []).includes(u.id))
  const origem = t.avulsa
    ? 'Tarefa avulsa · ' + rotuloCategoria(t.categoria) + (t.iniciativaNome ? ' · Iniciativa: ' + t.iniciativaNome : '')
    : 'em ' + (p?.nome || t.projetoNome || 'projeto')
  // Tarefa de Inovação pode ser ligada a uma iniciativa (sessão 12b); a iniciativa atual continua na lista.
  const opsIniciativa = [...(iniciativas || [])]
  if (t.iniciativaId && !opsIniciativa.some(o => o[0] === t.iniciativaId)) opsIniciativa.push([t.iniciativaId, t.iniciativaNome])
  const addI = () => {
    const v = nv.trim()
    if (!v) return
    setCl(a => [...a, { id: crypto.randomUUID(), texto: v, feito: false }])
    setNv('')
  }
  useEffect(() => {
    const k = e => e.key == 'Escape' && close()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])
  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={close}>
        <div
          className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg"
          role="dialog"
          aria-label="Detalhes da tarefa"
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-body">
              {/* Só líder e gestão editam; os demais veem a tarefa sem poder alterar. */}
              <fieldset disabled={!papel.organiza}>
                <textarea
                  ref={crescer}
                  rows={1}
                  className="tt0 form-control"
                  aria-label="Título da tarefa"
                  value={draft.titulo}
                  onChange={e => {
                    patch({ titulo: e.target.value.replace(/\n/g, ' ') })
                    crescer(e.target)
                  }}
                  onKeyDown={e => e.key == 'Enter' && e.preventDefault()}
                />
                <small>
                  {origem}
                  {t.criadaPor ? ` · criada por ${t.criadaPor}` : ''}
                  {t.status == 'concluida' && t.conclusao
                    ? ` · concluída em ${fm(t.conclusao)}${t.concluidaPor ? ' por ' + t.concluidaPor : ''}`
                    : ''}
                </small>
                <div className="row g-4 mt-1 tcols">
                  <div className="col-md-8">
                    <h4>
                      <Ic k="list" />
                      Descrição
                    </h4>
                    <textarea
                      className="form-control"
                      rows={4}
                      aria-label="Descrição"
                      placeholder="Adicione uma descrição mais detalhada…"
                      value={draft.descricao || ''}
                      onChange={e => patch({ descricao: e.target.value })}
                    />
                    {(papel.organiza || cl.length > 0) && (
                      <h4>
                        <Ic k="check" />
                        Checklist
                        {cl.length > 0 && (
                          <span className={chip()}>
                            {dn}/{cl.length}
                          </span>
                        )}
                      </h4>
                    )}
                    {cl.length > 0 && <Prog v={(dn / cl.length) * 100} cls={dn == cl.length ? 'ok' : ''} />}
                    {cl.map(x => (
                      <div className="d-flex align-items-center justify-content-between gap-1" key={x.id}>
                        <label className="form-check flex-grow-1 py-1 m-0">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={x.feito}
                            onChange={() => setCl(a => a.map(y => (y.id == x.id ? { ...y, feito: !y.feito } : y)))}
                          />
                          <span className={'form-check-label ms-1 ' + (x.feito ? 'dn' : '')}>{x.texto}</span>
                        </label>
                        {papel.organiza && (
                          <button className="dots" aria-label="Remover item" onClick={() => setCl(a => a.filter(y => y.id != x.id))}>
                            <Ic k="x" />
                          </button>
                        )}
                      </div>
                    ))}
                    {papel.organiza && (
                      <div className="d-flex gap-2 mt-2">
                        <input
                          className="form-control"
                          placeholder="Adicionar item"
                          aria-label="Novo item do checklist"
                          value={nv}
                          onChange={e => setNv(e.target.value)}
                          onKeyDown={e => e.key == 'Enter' && addI()}
                        />
                        <button className="btn btn-g" onClick={addI}>
                          Adicionar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    {t.avulsa && (
                      <L l="Categoria">
                        <select className="form-select mt-1" value={draft.categoria} onChange={e => patch({ categoria: e.target.value })}>
                          {CATEGORIAS.map(([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </L>
                    )}
                    {t.avulsa && draft.categoria == 'inovacao' && iniciativas && (
                      <L l="Iniciativa">
                        <select
                          className="form-select mt-1"
                          value={draft.iniciativaId || ''}
                          onChange={e => patch({ iniciativaId: e.target.value || undefined })}
                        >
                          {opsIniciativa.map(([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </L>
                    )}
                    <L l="Situação">
                      <select className="form-select mt-1" value={draft.status} onChange={e => st(e.target.value)}>
                        {Object.entries(ST).map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </L>
                    <L l="Prioridade">
                      <select className="form-select mt-1" value={draft.prioridade} onChange={e => patch({ prioridade: e.target.value })}>
                        {['P1', 'P2', 'P3', 'P4'].map(x => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </L>
                    <L l="Início">
                      <input
                        className="form-control mt-1"
                        type="date"
                        value={draft.inicio}
                        onChange={e => patch({ inicio: e.target.value })}
                      />
                    </L>
                    <L l="Fim">
                      <input className="form-control mt-1" type="date" value={draft.fim} onChange={e => patch({ fim: e.target.value })} />
                    </L>
                    <div className="mb-3">
                      <div className="form-label">Responsáveis</div>
                      <Multi opts={gente} value={draft.responsaveis || []} onChange={z => patch({ responsaveis: z })} />
                    </div>
                    {!t.avulsa && (
                      <L l="Depende de">
                        <select
                          className="form-select mt-1"
                          value={draft.dependeDe || ''}
                          onChange={e => patch({ dependeDe: e.target.value || undefined })}
                        >
                          <option value="">Nenhuma</option>
                          {opts.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.titulo}
                            </option>
                          ))}
                        </select>
                      </L>
                    )}
                    {deps.length > 0 && (
                      <div>
                        <div className="form-label">Tarefas que dependem desta</div>
                        {deps.map(x => (
                          <span key={x.id} className={chip('d-block mt-1 text-wrap')}>
                            {x.titulo}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>
              <Comentarios t={t} papel={papel} />
              {papel.organiza ? (
                <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                  <button className="btn btn-g" onClick={remove}>
                    <Ic k="trash" />
                    Excluir tarefa
                  </button>
                  <button className="btn btn-g" onClick={close}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={save}>
                    Salvar alterações
                  </button>
                </div>
              ) : (
                <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                  <button className="btn btn-g" onClick={close}>
                    Fechar
                  </button>
                  {papel.podeStatus(t) && (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        tog(t)
                        close()
                      }}
                    >
                      <Ic k={t.status == 'concluida' ? 'undo' : 'check'} />
                      {t.status == 'concluida' ? 'Reabrir' : 'Concluir'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
