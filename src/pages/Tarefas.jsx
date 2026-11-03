import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { DAY, PC, ST, chip, fm, iso, nm } from '../lib/utils'
import Ic from '../components/Icon'
import Table from '../components/Table'
import TaskModal from '../components/TaskModal'
import KanbanTarefas, { semanas } from '../components/KanbanTarefas'
import { PageBar, Seg } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import { adaptTask } from '../lib/apiMappers'
import { STATUS_ATIVOS, projetos } from '../services/projetos'
import { CATEGORIAS, acoesTarefa, origemTarefa, papelNaTarefa, tarefas } from '../services/tarefas'

const VISOES = [['kanban', 'Kanban'], ['lista', 'Lista']]
const equipeAtual = projeto => (projeto?.participacoes || []).filter(x => !x.dataSaida).map(x => x.usuario.codigo)

/** Filtro de "origem" do painel → parâmetros do GET /tarefas. */
export function filtroApi({ pessoa, origem, status }) {
  const f = { status }
  if (pessoa) f.codigoResponsavel = pessoa
  if (origem === 'avulsas') f.categoria = 'avulsas'
  else if (origem?.startsWith('cat:')) f.categoria = origem.slice(4)
  else if (origem?.startsWith('proj:')) f.codigoProjeto = origem.slice(5)
  return f
}

/**
 * Painel global de Tarefas (sessão 8c): tarefas de projetos e avulsas num lugar só.
 * Padrão "Minhas tarefas"; a gestão filtra por pessoa, origem (projeto ou categoria) e situação.
 */
export default function Tarefas() {
  const { D, form, me, pode, refresh } = useApp()
  const gestao = pode('tarefas.gerirTodas'), atribui = pode('tarefas.atribuir')
  const [filtro, setFiltro] = useState({ pessoa: me, origem: '', status: '' })
  const [visao, setVisao] = useState('kanban'), [tk, setTk] = useState(null)
  const set = (k, v) => setFiltro(f => ({ ...f, [k]: v }))

  const { dados, carregando, recarregar } = useCarregar(async () => {
    const [lista, todos] = await Promise.all([tarefas.listar(filtroApi(filtro)), projetos.listar()])
    return { tarefas: lista.map(adaptTask), projetos: todos }
  }, [filtro.pessoa, filtro.origem, filtro.status, me])

  const porCodigo = useMemo(() => new Map((dados?.projetos || []).map(p => [p.codigo, p])), [dados])
  const T = dados?.tarefas || []
  const papelDe = t => papelNaTarefa({ me, gestao, atribui, projeto: porCodigo.get(t.projetoId), tarefa: t })

  const salvarTarefa = async (chamada, ok) => {
    try {
      await chamada()
      if (ok) alerts.toastSuccess(ok)
      await recarregar()
      refresh().catch(() => {})
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }
  const acoes = acoesTarefa(salvarTarefa)

  // Onde a pessoa pode criar: gestão em qualquer categoria ou projeto ativo; membro só nos projetos da sua equipe atual.
  const ativos = (dados?.projetos || []).filter(p => STATUS_ATIVOS.includes(p.status))
  const meus = gestao ? ativos : ativos.filter(p => equipeAtual(p).includes(me))
  const tipos = [
    ...(atribui ? CATEGORIAS.map(([k, l]) => ['cat:' + k, l + ' (tarefa avulsa)']) : []),
    ...meus.map(p => ['proj:' + p.codigo, 'Projeto: ' + p.nome]),
  ]
  const organizaEm = tipo => {
    if (!tipo) return false
    if (tipo.startsWith('cat:')) return atribui
    const p = porCodigo.get(tipo.slice(5))
    return gestao || p?.lider?.codigo === me
  }
  const genteDe = tipo => tipo?.startsWith('proj:')
    ? D.u.filter(u => equipeAtual(porCodigo.get(tipo.slice(5))).includes(u.id))
    : D.u.filter(u => u.ativo !== false)

  const { m } = semanas(D)
  const nova = i => {
    const inicial = tipos.find(([k]) => k === filtro.origem)?.[0] || tipos[0]?.[0]
    return form('Nova tarefa', [
      { k: 'tipo', l: 'Tipo', o: tipos, h: atribui ? 'Tarefa avulsa (Inovação, Capacitação ou Execução) ou de um projeto.' : 'Você cria tarefas nos projetos de que participa.' },
      { k: 'titulo', l: 'Título' },
      { k: 'prioridade', l: 'Prioridade', o: ['P1', 'P2', 'P3', 'P4'].map(x => [x, x]) },
      { k: 'responsaveis', l: 'Responsáveis', c: v => genteDe(v.tipo), s: v => organizaEm(v.tipo) },
      { k: 'inicio', l: 'Início', t: 'date' },
      { k: 'fim', l: 'Fim', t: 'date' },
    ], {
      tipo: inicial, prioridade: 'P3', responsaveis: filtro.pessoa && filtro.pessoa !== me && atribui ? [filtro.pessoa] : [],
      ...(typeof i == 'number' && i < 3 ? { inicio: D.c.hoje, fim: iso(m + (7 * i + 4) * DAY) } : {}),
    }, o => {
      const projeto = o.tipo?.startsWith('proj:') ? o.tipo.slice(5) : null
      const dados = { ...o, categoria: projeto ? undefined : o.tipo?.slice(4), responsaveis: organizaEm(o.tipo) ? o.responsaveis : [me] }
      return salvarTarefa(() => tarefas.criar(projeto, dados), 'Tarefa criada')
    })
  }
  const podeCriar = tipos.length > 0

  const pessoas = [['', 'Todas as pessoas'], [me, 'Minhas tarefas'], ...D.u.filter(u => u.id !== me && u.ativo !== false).map(u => [u.id, u.nome])]
  const origens = [
    ['', 'Projetos e avulsas'], ['avulsas', 'Só avulsas'],
    ...CATEGORIAS.map(([k, l]) => ['cat:' + k, l]),
    ...(dados?.projetos || []).map(p => ['proj:' + p.codigo, 'Projeto: ' + p.nome]),
  ]
  const sel = (rotulo, k, opcoes) => (
    <select className="form-select w-auto" style={{ maxWidth: 260 }} aria-label={rotulo} value={filtro[k]} onChange={e => set(k, e.target.value)}>
      {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )

  const colunas = [
    { k: 'titulo', l: 'Tarefa', render: t => <button className="btn btn-link p-0 text-start" onClick={() => setTk(t.id)}>{t.titulo}</button> },
    { k: 'origem', l: 'Projeto / categoria', get: origemTarefa, filter: true },
    { k: 'resp', l: 'Responsáveis', get: t => nm(D, t.responsaveis) },
    { k: 'fim', l: 'Prazo', render: t => fm(t.fim) },
    { k: 'prioridade', l: 'Prioridade', filter: true, render: t => <span className={chip(PC[t.prioridade])}>{t.prioridade}</span> },
    { k: 'situacao', l: 'Situação', get: t => ST[t.status], filter: true },
  ]

  const aberta = tk && T.find(x => x.id == tk)
  const projetoAberto = aberta && !aberta.avulsa ? porCodigo.get(aberta.projetoId) : null
  return (
    <>
      <PageBar title="Tarefas" sub={carregando && !dados ? 'Carregando…' : `${T.length} ${T.length == 1 ? 'tarefa' : 'tarefas'}`}>
        <Seg items={VISOES} value={visao} onChange={setVisao} />
        {podeCriar && <button className="btn btn-primary" onClick={() => nova()}><Ic k="plus" />Nova tarefa</button>}
      </PageBar>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {gestao ? sel('Pessoa', 'pessoa', pessoas) : <Seg items={[[me, 'Minhas tarefas'], ['', 'Tudo o que vejo']]} value={filtro.pessoa} onChange={v => set('pessoa', v)} />}
        {sel('Projeto ou categoria', 'origem', origens)}
        {sel('Situação', 'status', [['', 'Todas as situações'], ...Object.entries(ST)])}
      </div>
      {visao == 'kanban'
        ? <KanbanTarefas D={D} T={T} papelDe={papelDe} acoes={acoes} abrir={setTk} adicionar={podeCriar ? nova : null} origem />
        : <div className="card card-body"><Table cols={colunas} rows={T} /></div>}
      {aberta && (
        <TaskModal D={D} papel={papelDe(aberta)} me={me} t={aberta} T={T}
          p={projetoAberto ? { id: projetoAberto.codigo, nome: projetoAberto.nome, membros: equipeAtual(projetoAberto) } : null}
          salvar={(antes, depois) => acoes.salvar(antes, depois, 'Tarefa salva')}
          close={() => setTk(null)} del={acoes.del} tog={acoes.tog} />
      )}
    </>
  )
}
