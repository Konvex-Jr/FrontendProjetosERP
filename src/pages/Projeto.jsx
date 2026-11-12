import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { DAY, d, fm, iso, nm } from '../lib/utils'
import Ic from '../components/Icon'
import TaskModal from '../components/TaskModal'
import KanbanTarefas, { semanas } from '../components/KanbanTarefas'
import EquipeProjeto from '../components/EquipeProjeto'
import { Av, PageBar, Seg } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import { configuracoes, pessoas } from '../services/pessoas'
import { projetos, rotuloPrioridade } from '../services/projetos'
import { acoesTarefa, papelNasTarefas, tarefas } from '../services/tarefas'
import { adaptTask } from '../lib/apiMappers'
import { StatusProjeto, camposProjeto, valoresProjeto } from './Projetos'
import { ItensDoProjeto } from './Conhecimento'

const ABAS = [
  ['tarefas', 'Tarefas'],
  ['geral', 'Visão geral'],
  ['equipe', 'Equipe'],
  ['base', 'Base'],
]

export default function Projeto() {
  const { D, form, go, me, pode, refresh } = useApp(),
    { id } = useParams(),
    pid = id
  const [pt, setPt] = useState('kanban'),
    [tk, setTk] = useState(null)
  const [aba, setAba] = useState('tarefas')
  const gestor = pode('projetos.editar')
  const { dados, carregando, recarregar } = useCarregar(async () => {
    const [projeto, todos, gente, areas, lista] = await Promise.all([
      projetos.buscar(pid),
      projetos.listar(),
      gestor ? pessoas.listar() : [],
      gestor ? configuracoes.areas() : [],
      tarefas.listar({ codigoProjeto: pid }),
    ])
    return { projeto, todos, gente, areas, tarefas: lista.map(adaptTask) }
  }, [pid, gestor])
  const voltar = (
    <button className="btn btn-g" onClick={() => go('projetos')}>
      <Ic k="back" />
      Voltar
    </button>
  )
  if (!dados)
    return (
      <PageBar title="Projeto" sub={carregando ? 'Carregando…' : 'Projeto não encontrado.'}>
        {voltar}
      </PageBar>
    )
  const { projeto, todos, gente, areas } = dados
  // Depois de salvar: recarrega o projeto e os dados compartilhados (tarefas, avatares, painel).
  const aoSalvar = async () => {
    await recarregar()
    refresh().catch(() => {})
  }
  const p = { id: projeto.codigo, nome: projeto.nome, membros: projeto.participacoes.filter(x => !x.dataSaida).map(x => x.usuario.codigo) }
  const papel = papelNasTarefas({ me, gestao: pode('tarefas.gerirTodas'), projeto })
  const T = dados.tarefas,
    { h, m } = semanas(D)

  const add = i =>
    form(
      'Nova tarefa',
      [
        { k: 'titulo', l: 'Título' },
        { k: 'prioridade', l: 'Prioridade', o: ['P1', 'P2', 'P3', 'P4'].map(x => [x, x]) },
        ...(papel.organiza ? [{ k: 'responsaveis', l: 'Responsáveis', c: D.u.filter(u => p.membros.includes(u.id)) }] : []),
        { k: 'inicio', l: 'Início', t: 'date' },
        { k: 'fim', l: 'Fim', t: 'date' },
      ],
      {
        prioridade: 'P3',
        responsaveis: papel.organiza ? [] : [me],
        ...(typeof i == 'number' && i < 3 ? { inicio: D.c.hoje, fim: iso(m + (7 * i + 4) * DAY) } : {}),
      },
      o => salvarTarefa(() => tarefas.criar(pid, o), 'Tarefa criada'),
    )
  // Toda alteração de tarefa vai direto para a API; depois recarrega a tela e o painel.
  const salvarTarefa = async (chamada, ok) => {
    try {
      await chamada()
      if (ok) alerts.toastSuccess(ok)
      await aoSalvar()
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }
  const acoes = acoesTarefa(salvarTarefa)

  const a = Math.min(...T.map(t => +d(t.inicio))),
    z = Math.max(...T.map(t => +d(t.fim))) + DAY,
    L = z - a,
    pc = x => ((x - a) / L) * 100,
    hp = pc(+h)

  const kanban = () => (
    <KanbanTarefas D={D} T={T} papelDe={() => papel} acoes={acoes} abrir={setTk} adicionar={papel.participa ? add : null} />
  )

  const gantt = () =>
    !T.length ? (
      <div className="card card-body">Nenhuma tarefa ainda. Use “Nova tarefa”.</div>
    ) : (
      <div className="card gt">
        {T.map(t => {
          const dep = T.find(x => x.id == t.dependeDe),
            x1 = dep && pc(+d(dep.fim) + DAY),
            x2 = dep && pc(+d(t.inicio))
          return (
            <div className="gr" key={t.id}>
              <div className="gl">
                {t.titulo}
                <br />
                <small style={{ fontWeight: 400 }}>{nm(D, t.responsaveis)}</small>
                {dep && (
                  <small className="gdl" title={'Depende de ' + dep.titulo}>
                    <Ic k="link" />
                    depende de {dep.titulo}
                  </small>
                )}
              </div>
              <div className="gc">
                {hp >= 0 && hp <= 100 && <i className="hj" style={{ left: hp + '%' }} />}
                {dep && (
                  <>
                    <i className="gdp" style={{ left: x1 + '%' }} />
                    <i
                      className={'gdd' + (x2 < x1 ? ' bad' : '')}
                      style={{ left: Math.min(x1, x2) + '%', width: Math.abs(x2 - x1) + '%' }}
                    />
                  </>
                )}
                <div
                  className={'gb ' + (t.status == 'concluida' ? 'c' : t.status == 'pendente' ? 'p' : '')}
                  title={fm(t.inicio) + ' a ' + fm(t.fim)}
                  style={{ left: pc(+d(t.inicio)) + '%', width: ((+d(t.fim) + DAY - +d(t.inicio)) / L) * 100 + '%' }}
                />
              </div>
            </div>
          )
        })}
        <small className="mt-2">
          Vermelho: hoje · Verde: concluída · Azul: em andamento · Âmbar: pendente · Linha tracejada: dependência entre tarefas
        </small>
      </div>
    )

  const editarProjeto = () =>
    form('Editar projeto', camposProjeto({ lista: gente, areas }), valoresProjeto(projeto), async v => {
      try {
        await projetos.editar(projeto.codigo, v)
        alerts.toastSuccess('Projeto atualizado')
        await aoSalvar()
      } catch (error) {
        alerts.error('Não foi possível salvar', error.message)
        return false
      }
    })

  const dia = s => (s ? String(s).slice(0, 10) : '')
  const info = [
    ['Status', <StatusProjeto key="status" s={projeto.status} />],
    ['Referência', projeto.referencia || '—'],
    ['Cliente', projeto.clienteNome || '—'],
    ['Período', fm(dia(projeto.dataInicio)) + ' a ' + fm(dia(projeto.dataFim))],
    ['Prioridade', rotuloPrioridade(projeto.prioridade)],
    ['Responsável', projeto.responsavel?.nome || '—'],
    ['Líder', projeto.lider?.nome || '—'],
    ['Área', projeto.area?.nome || '—'],
    ['Equipe', <Av key="equipe" D={D} ids={p.membros} />],
  ]
  const geral = () => (
    <div className="card card-body">
      <div className="row g-3">
        {info.map(([l, v]) => (
          <div className="col-sm-6 col-lg-3" key={l}>
            <small className="d-block">{l}</small>
            <div className="fw-semibold">{v}</div>
          </div>
        ))}
      </div>
      <h3 className="h6 fw-bold mt-4">Descrição</h3>
      <p className="m-0" style={{ whiteSpace: 'pre-wrap' }}>
        {projeto.descricao}
      </p>
      {projeto.objetivo && (
        <>
          <h3 className="h6 fw-bold mt-3">Objetivo</h3>
          <p className="m-0" style={{ whiteSpace: 'pre-wrap' }}>
            {projeto.objetivo}
          </p>
        </>
      )}
      {gestor && (
        <div className="mt-3">
          <button className="btn btn-g" onClick={editarProjeto}>
            <Ic k="edit" />
            Editar projeto
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="cab d-flex align-items-center gap-2">
          {voltar}
          <h1>{projeto.nome}</h1>
          <StatusProjeto s={projeto.status} />
        </div>
        {aba == 'tarefas' && (
          <div className="d-flex flex-wrap gap-2">
            <button className={'btn btn-g' + (pt == 'kanban' ? ' on' : '')} onClick={() => setPt('kanban')}>
              Kanban
            </button>
            <button className={'btn btn-g' + (pt == 'gantt' ? ' on' : '')} onClick={() => setPt('gantt')}>
              Cronograma
            </button>
            {papel.participa && (
              <button className="btn btn-primary" onClick={() => add()}>
                <Ic k="plus" />
                Nova tarefa
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mb-3">
        <Seg items={ABAS} value={aba} onChange={setAba} />
      </div>
      {aba == 'tarefas' && (pt == 'kanban' ? kanban() : gantt())}
      {aba == 'geral' && geral()}
      {aba == 'base' && <ItensDoProjeto projeto={projeto} />}
      {aba == 'equipe' && <EquipeProjeto projeto={projeto} todos={todos} gente={gente} gestor={gestor} aoSalvar={aoSalvar} />}
      {tk && T.find(x => x.id == tk) && (
        <TaskModal
          D={D}
          papel={papel}
          me={me}
          salvar={(antes, depois) => acoes.salvar(antes, depois, 'Tarefa salva')}
          t={T.find(x => x.id == tk)}
          p={p}
          T={T}
          close={() => setTk(null)}
          del={acoes.del}
          tog={acoes.tog}
        />
      )}
    </>
  )
}
