import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { DAY, PC, ST, chip, d, fm, hj, iso, nm } from '../lib/utils'
import { consumir } from '../lib/atalho'
import { fimDaSemana } from '../lib/indicadores'
import Ic from '../components/Icon'
import Table from '../components/Table'
import TaskModal from '../components/TaskModal'
import KanbanTarefas, { semanas } from '../components/KanbanTarefas'
import { PageBar, Seg } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { adaptTask } from '../lib/apiMappers'
import { adaptColuna } from '../lib/colunas'
import SeloEtapa from '../components/SeloEtapa'
import { STATUS_ATIVOS, projetos } from '../services/projetos'
import { gruposDeProjetos } from '../lib/projetosInternos'
import { apoioTarefa } from '../services/ocupacao'
import { comCarga, opcoesDificuldade, segundaDaSemana } from '../lib/ocupacao'
import { acoesTarefa, avisarOcupacao, origemTarefa, papelNaTarefa, quadroDesatualizado, tarefas } from '../services/tarefas'

const VISOES = [
  ['kanban', 'Kanban'],
  ['lista', 'Lista'],
]
const PRAZOS = [
  ['', 'Prazo: todos'],
  ['atrasadas', 'Atrasadas'],
  ['semana', 'Vencem esta semana'],
]

/** Filtro de prazo (só na tela): atrasadas = abertas com prazo antes de hoje; semana = abertas que vencem de hoje até domingo. */
export function noPrazo(t, prazo, hoje) {
  if (!prazo) return true
  if (t.status == 'concluida') return false
  const fim = d(t.fim)
  if (prazo == 'atrasadas') return fim < hoje
  return fim >= hoje && fim <= fimDaSemana(hoje)
}
const equipeAtual = projeto => (projeto?.participacoes || []).filter(x => !x.dataSaida).map(x => x.usuario.codigo)

/** Filtro de "origem" do painel → parâmetros do GET /tarefas. */
export function filtroApi({ pessoa, origem, status }) {
  const f = { status }
  if (pessoa) f.codigoResponsavel = pessoa
  if (origem?.startsWith('proj:')) f.codigoProjeto = origem.slice(5)
  return f
}

/**
 * Chave e busca do painel. A tela e o menu (src/lib/antecipar.js) usam as mesmas, para o dado
 * buscado antes do clique ser o que a tela mostra. Sem `filtro`, vale o padrão com que a tela
 * abre ("Minhas tarefas", sem origem nem situação). `contexto` = { me } do useApp().
 */
export function dadosDaTela({ me }, filtro = { pessoa: me, origem: '', status: '' }) {
  return {
    chave: `tarefas:${filtro.pessoa}:${filtro.origem}:${filtro.status}:${me}`,
    carregar: async () => {
      const [lista, todos] = await Promise.all([tarefas.listar(filtroApi(filtro)), projetos.listar()])
      return { tarefas: lista.map(adaptTask), projetos: todos }
    },
  }
}

/**
 * Painel global de Tarefas (sessão 8c): tarefas de todos os projetos num lugar só.
 * Padrão "Minhas tarefas"; a gestão filtra por pessoa, projeto e situação.
 */
export default function Tarefas() {
  const { D, form, me, pode, refresh } = useApp()
  const gestao = pode('tarefas.gerirTodas')
  const [filtro, setFiltro] = useState(() => ({ pessoa: me, origem: '', status: '', prazo: '', ...consumir('tarefas') }))
  const [visao, setVisao] = useState('kanban'),
    [tk, setTk] = useState(null)
  const set = (k, v) => setFiltro(f => ({ ...f, [k]: v }))

  const tela = dadosDaTela({ me }, filtro)
  const { dados, carregando, recarregar } = useCarregar(tela.carregar, [filtro.pessoa, filtro.origem, filtro.status, me], {
    chave: tela.chave,
  })

  const porCodigo = useMemo(() => new Map((dados?.projetos || []).map(p => [p.codigo, p])), [dados])
  const T = (dados?.tarefas || []).filter(t => noPrazo(t, filtro.prazo, hj(D)))
  const papelDe = t => papelNaTarefa({ me, gestao, projeto: porCodigo.get(t.projetoId) })

  const salvarTarefa = async (chamada, ok) => {
    try {
      const resposta = await chamada()
      if (ok) alerts.toastSuccess(ok)
      avisarOcupacao(resposta)
      await recarregar()
      refresh().catch(() => {})
    } catch (error) {
      // Coluna apagada ou quadro mudado por outra pessoa: mostra o aviso da API e recarrega a lista.
      if (quadroDesatualizado(error)) await recarregar().catch(() => {})
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }
  const acoes = acoesTarefa(salvarTarefa)

  // Onde a pessoa pode criar: gestão em qualquer projeto ativo; os demais onde participam (equipe atual ou liderança da área).
  const ativos = (dados?.projetos || []).filter(p => STATUS_ATIVOS.includes(p.status))
  const meus = gestao ? ativos : ativos.filter(p => papelNaTarefa({ me, gestao, projeto: p }).participa)
  const gruposCriar = gruposDeProjetos(meus).map(g => ({ rotulo: g.rotulo, opcoes: g.projetos.map(p => ['proj:' + p.codigo, p.nome]) }))
  const tipos = gruposCriar.flatMap(g => g.opcoes)
  const organizaEm = tipo => {
    if (!tipo) return false
    const p = porCodigo.get(tipo.slice(5))
    return gestao || p?.lider?.codigo === me || (p?.lideresDaArea || []).includes(me)
  }
  const genteDe = tipo => (tipo?.startsWith('proj:') ? D.u.filter(u => equipeAtual(porCodigo.get(tipo.slice(5))).includes(u.id)) : [])

  const { m } = semanas(D)
  const nova = async i => {
    const { horas, carga } = await apoioTarefa(segundaDaSemana(D.c.hoje))
    const inicial = tipos.find(([k]) => k === filtro.origem)?.[0] || tipos[0]?.[0]
    return form(
      'Nova tarefa',
      [
        {
          k: 'tipo',
          l: 'Projeto',
          grupos: gruposCriar,
          h: 'Você cria tarefas nos projetos de que participa.',
        },
        { k: 'titulo', l: 'Título' },
        { k: 'prioridade', l: 'Prioridade', o: ['P1', 'P2', 'P3', 'P4'].map(x => [x, x]) },
        { k: 'responsaveis', l: 'Responsáveis', c: v => comCarga(genteDe(v.tipo), carga), s: v => organizaEm(v.tipo) },
        { k: 'dificuldade', l: 'Dificuldade', o: opcoesDificuldade(horas), opt: true },
        { k: 'inicio', l: 'Início', t: 'date' },
        { k: 'fim', l: 'Fim', t: 'date' },
      ],
      {
        tipo: inicial,
        prioridade: 'P3',
        responsaveis: filtro.pessoa && filtro.pessoa !== me && gestao ? [filtro.pessoa] : [],
        ...(typeof i == 'number' && i < 3 ? { inicio: D.c.hoje, fim: iso(m + (7 * i + 4) * DAY) } : {}),
      },
      o => {
        const projeto = o.tipo?.startsWith('proj:') ? o.tipo.slice(5) : null
        const dados = { ...o, responsaveis: organizaEm(o.tipo) ? o.responsaveis : [me] }
        return salvarTarefa(() => tarefas.criar(projeto, dados), 'Tarefa criada')
      },
    )
  }
  const podeCriar = tipos.length > 0

  const pessoas = [
    ['', 'Pessoa: todas'],
    [me, 'Minhas tarefas'],
    ...D.u.filter(u => u.id !== me && u.ativo !== false).map(u => [u.id, u.nome]),
  ]
  const gruposOrigem = gruposDeProjetos(dados?.projetos || []).map(g => ({
    rotulo: g.rotulo,
    opcoes: g.projetos.map(p => ['proj:' + p.codigo, p.nome]),
  }))
  const sel = (rotulo, k, opcoes, grupos) => (
    <select
      className="form-select w-auto"
      style={{ maxWidth: 260 }}
      aria-label={rotulo}
      value={filtro[k]}
      onChange={e => set(k, e.target.value)}
    >
      {opcoes.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
      {(grupos || []).map(g => (
        <optgroup key={g.rotulo} label={g.rotulo}>
          {g.opcoes.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )

  const colunas = [
    {
      k: 'titulo',
      l: 'Tarefa',
      render: t => (
        <button className="btn btn-link p-0 text-start" onClick={() => setTk(t.id)}>
          {t.titulo}
        </button>
      ),
    },
    { k: 'origem', l: 'Projeto', fl: 'Projeto', get: origemTarefa, filter: true },
    { k: 'resp', l: 'Responsáveis', get: t => nm(D, t.responsaveis) },
    { k: 'fim', l: 'Prazo', render: t => fm(t.fim) },
    { k: 'prioridade', l: 'Prioridade', filter: true, render: t => <span className={chip(PC[t.prioridade])}>{t.prioridade}</span> },
    {
      k: 'etapa',
      l: 'Etapa',
      get: t => t.coluna?.nome || '',
      render: t => <SeloEtapa coluna={t.coluna} />,
    },
    { k: 'situacao', l: 'Situação', get: t => ST[t.status], filter: true },
  ]

  const aberta = tk && T.find(x => x.id == tk)
  const projetoAberto = aberta ? porCodigo.get(aberta.projetoId) : null
  return (
    <>
      <PageBar title="Tarefas" sub={carregando && !dados ? '' : `${T.length} ${T.length == 1 ? 'tarefa' : 'tarefas'}`}>
        <Seg items={VISOES} value={visao} onChange={setVisao} />
        {podeCriar && (
          <button className="btn btn-primary" onClick={() => nova()}>
            <Ic k="plus" />
            Nova tarefa
          </button>
        )}
      </PageBar>
      <div className="fl d-flex flex-wrap gap-2 mb-3">
        {gestao ? (
          sel('Pessoa', 'pessoa', pessoas)
        ) : (
          <Seg
            items={[
              [me, 'Minhas tarefas'],
              ['', 'Tudo o que vejo'],
            ]}
            value={filtro.pessoa}
            onChange={v => set('pessoa', v)}
          />
        )}
        {sel('Projeto', 'origem', [['', 'Projeto: todos']], gruposOrigem)}
        {sel('Situação', 'status', [['', 'Situação: todas'], ...Object.entries(ST)])}
        {sel('Prazo', 'prazo', PRAZOS)}
      </div>
      {!carregando && !T.length && (
        <div className="card card-body mb-3">
          <small>
            {filtro.status || filtro.origem || filtro.prazo || filtro.pessoa != me
              ? 'Nenhuma tarefa com estes filtros. Mude os filtros acima.'
              : 'Você não tem tarefas.' +
                (podeCriar ? ' Use “Nova tarefa” para criar uma.' : ' Quando alguém atribuir uma a você, ela aparece aqui.')}
          </small>
        </div>
      )}
      {carregando && !dados ? (
        <Esqueleto />
      ) : visao == 'kanban' ? (
        <KanbanTarefas D={D} T={T} papelDe={papelDe} acoes={acoes} abrir={setTk} adicionar={podeCriar ? nova : null} origem />
      ) : (
        <div className="card card-body">
          <Table cols={colunas} rows={T} vazio="Nenhuma tarefa para mostrar." />
        </div>
      )}
      {aberta && (
        <TaskModal
          D={D}
          papel={papelDe(aberta)}
          me={me}
          t={aberta}
          T={T}
          colunas={projetoAberto?.colunas?.map(adaptColuna)}
          mover={acoes.mover}
          p={projetoAberto ? { id: projetoAberto.codigo, nome: projetoAberto.nome, membros: equipeAtual(projetoAberto) } : null}
          salvar={(antes, depois) => acoes.salvar(antes, depois, 'Tarefa salva')}
          close={() => setTk(null)}
          del={acoes.del}
          tog={acoes.tog}
          recarregar={async () => {
            await recarregar()
            refresh().catch(() => {})
          }}
        />
      )}
    </>
  )
}
