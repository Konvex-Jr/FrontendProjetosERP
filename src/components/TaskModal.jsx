import { useEffect, useRef, useState } from 'react'
import Ic from './Icon'
import Anexos from './Anexos'
import Multi from './Multi'
import { Prog } from './Ui'
import SeloEtapa from './SeloEtapa'
import Avatar from './Avatar'
import ZonaEnvio from './ZonaEnvio'
import { ST, chip, fm } from '../lib/utils'
import { tarefas } from '../services/tarefas'
import { configuracoes } from '../services/pessoas'
import { ocupacao } from '../services/ocupacao'
import { cargaPorPessoa, comCarga, opcoesDificuldade, segundaDaSemana } from '../lib/ocupacao'
import alerts from '../lib/alerts'
import { conclusaoDoStatus, mudouRascunho, noProjeto } from '../lib/rascunhoTarefa'
import { colunaDeEntrada } from '../lib/colunas'
import { conferirArquivo, resumoFalhas, tamanhoLegivel } from '../services/anexos'

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

/** Anexos da tarefa: carrega a lista ao abrir; depois de mudar, recarrega a seção e a tela (clipe do Kanban). */
function AnexosTarefa({ t, papel, aoMudar }) {
  const [lista, setLista] = useState(null)
  const carregar = () =>
    tarefas
      .anexos(t.id)
      .then(setLista)
      .catch(error => {
        setLista([])
        alerts.error('Não foi possível carregar os anexos', error.message)
      })
  useEffect(() => {
    carregar()
  }, [t.id])
  if (lista !== null && !lista.length && !papel.participa) return null
  return (
    <div className="mt-4">
      <h4 className="h6 fw-bold">
        <Ic k="clip" />
        Anexos{lista?.length > 0 && <span className={chip()}>{lista.length}</span>}
      </h4>
      <Anexos
        dono="tarefas"
        codigo={t.id}
        lista={lista}
        podeAlterar={papel.participa}
        aoMudar={async () => {
          await carregar()
          await aoMudar?.()
        }}
      />
    </div>
  )
}

const comFeito = (lista, id, feito) => (lista || []).map(i => (i.id === id ? { ...i, feito } : i))

/**
 * Detalhes de uma tarefa (sempre de um projeto). Edita uma cópia (`draft`) e só envia ao salvar:
 * `salvar(antes, depois)` escolhe PATCH (só status, etapa ou data de conclusão) ou PUT (ver services/tarefas).
 * `original` é a tarefa como estava ao abrir (base do salvar e do aviso "Descartar alterações?" ao fechar);
 * a marcação do checklist grava na hora e entra nos dois, para não contar como alteração.
 * `papel` vem de papelNaTarefa/papelNasTarefas: sem `podeEditar(t)` (gestão, líder ou criador na equipe) os campos
 * ficam travados; Responsáveis só para quem organiza; Situação/Etapa só com `podeStatus(t)`.
 * `colunas` = etapas do projeto da tarefa (sem elas vale a Situação);
 * `mover(t, codigoColuna)` grava a etapa na hora para quem só conclui/reabre.
 * `T` = tarefas carregadas na tela (para as dependências); `p` = projeto no formato do contexto.
 * `recarregar` atualiza a tela por trás (anexos e marcação do checklist).
 *
 * Modo criação (`modo="criar"`, sessão 24b): `t` é o rascunho inicial (rascunhoNovo, sem `id`). Tudo fica na tela
 * até "Criar tarefa", que chama `criar(rascunho, arquivos)` (se devolver false, a janela continua aberta).
 * Os anexos escolhidos ficam numa lista com remover. Sem comentários, dependência, "Excluir" e "Concluída em".
 * Em Tarefas, `projetos` = grupos do select ({ rotulo, opcoes: [[codigo, nome]] }) e `projetoDe(codigo)` devolve
 * `{ p, papel, colunas }` do projeto escolhido; no Projeto valem `p`, `papel` e `colunas` fixos.
 */
export default function TaskModal({
  D,
  salvar,
  t,
  p: projetoFixo,
  T,
  close,
  del,
  tog,
  papel: papelFixo,
  recarregar,
  colunas: colunasFixas,
  mover,
  me,
  modo = 'editar',
  criar,
  projetos,
  projetoDe,
}) {
  const criando = modo === 'criar'
  const [inicial, setOriginal] = useState(() => ({ ...t })),
    [rascunho, setDraft] = useState(() => ({ ...t })),
    [nv, setNv] = useState(''),
    [marcando, setMarcando] = useState({}),
    [editando, setEditando] = useState(null),
    [arquivos, setArquivos] = useState([]),
    [salvando, setSalvando] = useState(false)
  // Na criação em Tarefas, equipe, papel e etapas são os do projeto escolhido na janela.
  const { p, papel, colunas } =
    criando && projetoDe ? projetoDe(rascunho.projetoId) : { p: projetoFixo, papel: papelFixo, colunas: colunasFixas }
  const etapas = colunas?.length ? colunas : null
  // Coluna apagada enquanto a janela estava aberta: a recarga traz as colunas novas e o rascunho volta à etapa da tarefa.
  const colunaSumiu = etapas && rascunho.coluna && !etapas.some(c => c.id === rascunho.coluna.id)
  const colunaDeVolta = criando ? colunaDeEntrada(etapas) : t.coluna
  // O original acompanha (senão a troca de coluna contaria como alteração e o "Salvar data" viraria PUT).
  const draft = colunaSumiu ? { ...rascunho, coluna: colunaDeVolta } : rascunho
  const original = colunaSumiu ? { ...inicial, coluna: colunaDeVolta } : inicial
  // Na criação, quem abriu a janela preenche tudo e marca os itens no rascunho (a API aplica a regra dos responsáveis).
  const podeEditar = criando || papel.podeEditar(t),
    podeStatus = criando || papel.podeStatus(t),
    podeMarcar = criando || papel.podeMarcar(t)
  // Horas por dificuldade e % da semana do prazo; se falhar, a tela segue sem o complemento.
  const [horas, setHoras] = useState(null),
    [carga, setCarga] = useState({})
  useEffect(() => {
    let vivo = true
    configuracoes
      .horasDificuldade()
      .then(h => vivo && setHoras(h))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])
  const semana = draft.fim ? segundaDaSemana(draft.fim) : undefined
  useEffect(() => {
    let vivo = true
    ocupacao
      .todas(semana)
      .then(l => vivo && setCarga(cargaPorPessoa(l)))
      .catch(() => vivo && setCarga({}))
    return () => {
      vivo = false
    }
  }, [semana])
  const cl = draft.checklist || [],
    dn = cl.filter(x => x.feito).length
  const patch = o => setDraft(current => ({ ...current, ...o })),
    setCl = f => setDraft(current => ({ ...current, checklist: f(current.checklist || []) }))
  // Ao mudar a Situação, a data de conclusão do rascunho é só para a tela; a API grava a data real (hoje).
  const st = value => patch({ status: value, conclusao: conclusaoDoStatus(value, original, D.c.hoje) })
  const campoEtapa = (valor, aoMudar) => (
    <L l="Etapa">
      <select className="form-select mt-1" value={valor || ''} onChange={e => aoMudar(e.target.value)}>
        {etapas.map(c => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </L>
  )
  // Na criação, qualquer campo preenchido ou anexo escolhido conta como alteração.
  const mudou = mudouRascunho(original, draft, criando ? arquivos : [])

  // Fechar (X, Esc, clique fora, Cancelar/Fechar): com alteração não salva, pede confirmação antes.
  // `fechando` evita uma segunda pergunta (ex.: Esc de novo com a confirmação aberta).
  const fechando = useRef(false)
  const fechar = async () => {
    if (fechando.current || salvando) return
    if (!mudou) return close()
    fechando.current = true
    try {
      if (await alerts.confirm({ title: 'Descartar alterações?', confirmText: 'Descartar', danger: true })) close()
    } finally {
      fechando.current = false
    }
  }
  // O Esc escuta a janela uma vez só; a ref aponta para o `fechar` da última renderização.
  const fecharAtual = useRef(fechar)
  useEffect(() => {
    fecharAtual.current = fechar
  })
  useEffect(() => {
    const k = e => e.key == 'Escape' && fecharAtual.current()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  const save = async () => {
    if (criando) {
      setSalvando(true)
      try {
        if ((await criar({ ...draft, colunaId: draft.coluna?.id }, arquivos)) !== false) close()
      } finally {
        setSalvando(false)
      }
      return
    }
    if (!mudou) return close()
    if ((await salvar(original, draft)) !== false) close()
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
  // Dependência só entre tarefas do mesmo projeto (o painel global mistura projetos); a tarefa nova ainda não tem.
  const doProjeto = criando ? [] : T.filter(c => c.projetoId == t.projetoId)
  const opts = doProjeto.filter(c => c.id != t.id && !chain(c.id).includes(t.id)),
    deps = doProjeto.filter(x => x.dependeDe == t.id)
  // Responsáveis: equipe atual do projeto.
  const gente = comCarga(
    D.u.filter(u => (p?.membros || []).includes(u.id)),
    carga,
  )
  const origem = 'em ' + (p?.nome || t.projetoNome || 'projeto')
  // Criação em Tarefas: trocar o projeto refaz responsáveis e etapa pela regra do novo projeto.
  const trocarProjeto = codigo => {
    const novo = projetoDe(codigo)
    setDraft(current =>
      noProjeto(current, {
        projetoId: codigo,
        organiza: novo.papel.organiza,
        membros: novo.p?.membros,
        me,
        colunas: novo.colunas,
      }),
    )
  }
  // Anexos da criação: ficam na tela até criar; o que não passa na conferência (tipo ou tamanho) nem entra na lista.
  const escolherArquivos = lista => {
    const ruins = lista.map(a => ({ nome: a.name, erro: conferirArquivo(a) })).filter(f => f.erro)
    if (ruins.length) alerts.error('Alguns arquivos não foram aceitos', resumoFalhas(ruins))
    setArquivos(atual => [...atual, ...lista.filter(a => !conferirArquivo(a))])
  }

  // Checklist. Responsável do item: um dos responsáveis da tarefa no rascunho (quem saiu deles aparece como "Ninguém").
  const pessoa = id => D.u.find(u => u.id == id)
  const responsaveis = (draft.responsaveis || []).map(pessoa).filter(Boolean)
  const responsavelDoItem = x => ((draft.responsaveis || []).includes(x.responsavel) ? x.responsavel : undefined)
  const mudarResponsaveis = z =>
    setDraft(current => ({
      ...current,
      responsaveis: z,
      checklist: (current.checklist || []).map(i => (i.responsavel && !z.includes(i.responsavel) ? { ...i, responsavel: undefined } : i)),
    }))
  const addI = () => {
    const v = nv.trim()
    if (!v) return
    setCl(a => [...a, { id: crypto.randomUUID(), texto: v, feito: false }])
    setNv('')
  }
  // Item já gravado na tarefa (item novo só pode ser marcado depois de salvar).
  const salvo = id => (original.checklist || []).some(i => i.id === id)
  // Marcar grava na hora (PATCH) e entra no rascunho e no original; se falhar, desfaz.
  const marcar = async x => {
    if (!t.id) return setCl(a => a.map(y => (y.id == x.id ? { ...y, feito: !y.feito } : y)))
    const feito = !x.feito
    const aplicar = v => {
      setDraft(current => ({ ...current, checklist: comFeito(current.checklist, x.id, v) }))
      setOriginal(current => ({ ...current, checklist: comFeito(current.checklist, x.id, v) }))
    }
    aplicar(feito)
    setMarcando(m => ({ ...m, [x.id]: true }))
    try {
      await tarefas.marcarItem(t.id, x.id, feito)
      Promise.resolve(recarregar?.()).catch(() => {})
    } catch (error) {
      aplicar(!feito)
      alerts.error('Não foi possível marcar o item', error.message)
    } finally {
      setMarcando(({ [x.id]: _feito, ...resto }) => resto)
    }
  }
  // Texto do item: clicar edita no lugar; Enter ou sair do campo confirma, Esc desfaz.
  // A ref guarda o que está sendo editado para o Esc não ser confirmado pelo blur que vem depois.
  const editandoAtual = useRef(null)
  const editarTexto = v => {
    editandoAtual.current = v
    setEditando(v)
  }
  const confirmarTexto = () => {
    const e = editandoAtual.current
    editarTexto(null)
    const v = e?.texto.trim()
    if (v) setCl(a => a.map(y => (y.id == e.id ? { ...y, texto: v } : y)))
  }

  // Data de conclusão: tarefa concluída que segue concluída no rascunho (se a etapa sai da concluída, some).
  const etapaReabre = draft.coluna && draft.coluna.id !== original.coluna?.id && draft.coluna.papel !== 'concluida'
  const mostraConclusao = t.status == 'concluida' && draft.status == 'concluida' && !etapaReabre
  const mudouConclusao = (draft.conclusao || '') !== (original.conclusao || '')

  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={fechar}>
        <div
          className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg"
          role="dialog"
          aria-label={criando ? 'Nova tarefa' : 'Detalhes da tarefa'}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-body">
              {/* Gestão, líder e quem criou (na equipe) editam; os demais veem a tarefa sem poder alterar. */}
              <div className="d-flex align-items-start gap-2">
                <fieldset className="flex-grow-1" disabled={!podeEditar} style={{ minWidth: 0 }}>
                  <textarea
                    ref={crescer}
                    rows={1}
                    className="tt0 form-control"
                    aria-label="Título da tarefa"
                    placeholder={criando ? 'Título da tarefa' : undefined}
                    autoFocus={criando}
                    value={draft.titulo}
                    onChange={e => {
                      patch({ titulo: e.target.value.replace(/\n/g, ' ') })
                      crescer(e.target)
                    }}
                    onKeyDown={e => e.key == 'Enter' && e.preventDefault()}
                  />
                </fieldset>
                <button className="dots" aria-label="Fechar" title="Fechar" onClick={fechar}>
                  <Ic k="x" />
                </button>
              </div>
              <small>
                {criando ? (projetos ? 'Nova tarefa' : 'Nova tarefa ' + origem) : origem}
                {t.criadaPor ? ` · criada por ${t.criadaPor}` : ''}
                {t.status == 'concluida' && t.conclusao
                  ? ` · concluída em ${fm(t.conclusao)}${t.concluidaPor ? ' por ' + t.concluidaPor : ''}`
                  : ''}
              </small>
              <div className="row g-4 mt-1 tcols">
                <div className="col-md-8">
                  <fieldset disabled={!podeEditar}>
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
                  </fieldset>
                  {(podeEditar || cl.length > 0) && (
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
                  {/* Fora do fieldset: quem só conclui também marca os itens (gravam na hora). */}
                  {cl.map(x => {
                    const resp = responsavelDoItem(x),
                      dono = resp && pessoa(resp)
                    return (
                      <div className="ck-item" key={x.id}>
                        <div className="ck-txt">
                          <input
                            type="checkbox"
                            className="form-check-input m-0"
                            aria-label={'Marcar ' + x.texto}
                            title={t.id && !salvo(x.id) ? 'Salve a tarefa para marcar este item' : undefined}
                            checked={x.feito}
                            disabled={!podeMarcar || marcando[x.id] || (t.id && !salvo(x.id))}
                            onChange={() => marcar(x)}
                          />
                          {editando?.id === x.id ? (
                            <input
                              className="form-control form-control-sm"
                              aria-label="Texto do item"
                              autoFocus
                              value={editando.texto}
                              onChange={e => editarTexto({ id: x.id, texto: e.target.value })}
                              onBlur={confirmarTexto}
                              onKeyDown={e => {
                                if (e.key == 'Enter') {
                                  e.preventDefault()
                                  confirmarTexto()
                                } else if (e.key == 'Escape') {
                                  // Esc só desfaz o texto; não fecha a janela.
                                  e.stopPropagation()
                                  editarTexto(null)
                                }
                              }}
                            />
                          ) : podeEditar ? (
                            <button
                              type="button"
                              className={'ck-editar ' + (x.feito ? 'dn' : '')}
                              title="Editar item"
                              onClick={() => editarTexto({ id: x.id, texto: x.texto })}
                            >
                              {x.texto}
                            </button>
                          ) : (
                            <span className={x.feito ? 'dn' : ''}>{x.texto}</span>
                          )}
                        </div>
                        <div className="ck-meta">
                          {podeEditar && (
                            <select
                              className="form-select form-select-sm ck-resp"
                              aria-label={'Responsável pelo item ' + x.texto}
                              value={resp || ''}
                              onChange={e =>
                                setCl(a => a.map(y => (y.id == x.id ? { ...y, responsavel: e.target.value || undefined } : y)))
                              }
                            >
                              <option value="">Ninguém</option>
                              {responsaveis.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.nome}
                                </option>
                              ))}
                            </select>
                          )}
                          {dono && <Avatar pessoa={dono} className="av-item" title={dono.nome} />}
                          {podeEditar && (
                            <button className="dots" aria-label="Remover item" onClick={() => setCl(a => a.filter(y => y.id != x.id))}>
                              <Ic k="x" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {podeEditar && (
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
                  {criando && projetos && (
                    <L l="Projeto">
                      <select className="form-select mt-1" value={draft.projetoId || ''} onChange={e => trocarProjeto(e.target.value)}>
                        {projetos.map(g => (
                          <optgroup key={g.rotulo} label={g.rotulo}>
                            {g.opcoes.map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <small className="d-block mt-1">Você cria tarefas nos projetos de que participa.</small>
                    </L>
                  )}
                  {etapas ? (
                    podeEditar && podeStatus ? (
                      campoEtapa(draft.coluna?.id, id => patch({ coluna: etapas.find(c => c.id === id) }))
                    ) : podeStatus && mover ? (
                      // Quem só conclui/reabre troca a etapa da própria tarefa na hora.
                      campoEtapa(t.coluna?.id, id => mover(t, id))
                    ) : (
                      <div className="mb-3">
                        <div className="form-label">Etapa</div>
                        <SeloEtapa coluna={t.coluna} />
                      </div>
                    )
                  ) : criando ? null : (
                    <L l="Situação">
                      <select
                        className="form-select mt-1"
                        value={draft.status}
                        disabled={!(podeEditar && podeStatus)}
                        onChange={e => st(e.target.value)}
                      >
                        {Object.entries(ST).map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </L>
                  )}
                  {/* Fora do fieldset: quem só conclui também corrige a data. */}
                  {mostraConclusao && (
                    <L l="Concluída em">
                      <input
                        className="form-control mt-1"
                        type="date"
                        value={draft.conclusao || ''}
                        min={draft.inicio || undefined}
                        max={D.c.hoje}
                        disabled={!podeMarcar}
                        onChange={e => patch({ conclusao: e.target.value })}
                      />
                    </L>
                  )}
                  <fieldset disabled={!podeEditar}>
                    <L l="Prioridade">
                      <select className="form-select mt-1" value={draft.prioridade} onChange={e => patch({ prioridade: e.target.value })}>
                        {['P1', 'P2', 'P3', 'P4'].map(x => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </L>
                    <L l="Dificuldade">
                      <select
                        className="form-select mt-1"
                        value={draft.dificuldade || ''}
                        onChange={e => patch({ dificuldade: e.target.value })}
                      >
                        {opcoesDificuldade(horas).map(([v, r]) => (
                          <option key={v} value={v}>
                            {r}
                          </option>
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
                    {/* Responsáveis: só gestão e líder (quem criou edita o resto, mas não troca as pessoas). */}
                    <fieldset className="mb-3" disabled={!papel.organiza}>
                      <div className="form-label">Responsáveis</div>
                      <Multi opts={gente} value={draft.responsaveis || []} onChange={mudarResponsaveis} />
                      {criando && <small className="d-block mt-1">A % ao lado do nome é a ocupação desta semana.</small>}
                    </fieldset>
                    {!criando && (
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
                  </fieldset>
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
              {t.id && <AnexosTarefa t={t} papel={papel} aoMudar={recarregar} />}
              {criando && (
                <div className="mt-4">
                  <h4 className="h6 fw-bold">
                    <Ic k="clip" />
                    Anexos{arquivos.length > 0 && <span className={chip()}>{arquivos.length}</span>}
                  </h4>
                  {arquivos.map((a, i) => (
                    <div className="d-flex align-items-center justify-content-between gap-2 py-1 border-bottom" key={i + a.name}>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        {a.name} <small>· {tamanhoLegivel(a.size)}</small>
                      </span>
                      <button
                        className="dots"
                        aria-label={'Remover ' + a.name}
                        title="Remover"
                        disabled={salvando}
                        onClick={() => setArquivos(l => l.filter((_, j) => j !== i))}
                      >
                        <Ic k="x" />
                      </button>
                    </div>
                  ))}
                  <div className="mt-2">
                    <ZonaEnvio aoEscolher={escolherArquivos} ocupado={salvando ? { atual: 1, total: 1 } : undefined} />
                  </div>
                  <small className="d-block mt-1">Os arquivos sobem quando a tarefa for criada.</small>
                </div>
              )}
              {!criando && <Comentarios t={t} papel={papel} />}
              {criando ? (
                <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                  <button className="btn btn-g" disabled={salvando} onClick={fechar}>
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={salvando || !draft.titulo?.trim() || !draft.inicio || !draft.fim || !draft.projetoId}
                    title={!draft.titulo?.trim() || !draft.inicio || !draft.fim ? 'Preencha título, início e fim' : undefined}
                    onClick={save}
                  >
                    {salvando ? 'Criando…' : 'Criar tarefa'}
                  </button>
                </div>
              ) : podeEditar ? (
                <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                  <button className="btn btn-g" onClick={remove}>
                    <Ic k="trash" />
                    Excluir tarefa
                  </button>
                  <button className="btn btn-g" onClick={fechar}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={save}>
                    Salvar alterações
                  </button>
                </div>
              ) : (
                <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                  <button className="btn btn-g" onClick={fechar}>
                    Fechar
                  </button>
                  {/* Quem só conclui e corrigiu a data de conclusão: grava só a data (PATCH). */}
                  {mostraConclusao && podeMarcar && mudouConclusao && (
                    <button className="btn btn-primary" disabled={!draft.conclusao} onClick={save}>
                      Salvar data
                    </button>
                  )}
                  {podeStatus && (
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
