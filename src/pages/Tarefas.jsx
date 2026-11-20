import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { DAY, PC, ST, chip, fm, hj, iso, nm } from '../lib/utils'
import { consumir } from '../lib/atalho'
import { guardarFiltros, lerFiltros } from '../lib/filtrosTarefas'
import { PRAZOS, noPrazo } from '../lib/prazo'
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
import { rascunhoNovo } from '../lib/rascunhoTarefa'
import { acoesTarefa, avisarOcupacao, criarDaJanela, origemTarefa, papelNaTarefa, quadroDesatualizado, tarefas } from '../services/tarefas'

const VISOES = [
  ['kanban', 'Kanban'],
  ['lista', 'Lista'],
]
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
  const { D, me, pode, refresh } = useApp()
  const gestao = pode('tarefas.gerirTodas')
  // Padrão ← filtros guardados na aba ← atalho de outra tela (o atalho vence).
  const [filtro, setFiltro] = useState(() => ({
    pessoa: me,
    origem: '',
    status: '',
    prazo: '',
    ...lerFiltros(me)?.filtro,
    ...consumir('tarefas'),
  }))
  const [visao, setVisao] = useState(() => lerFiltros(me)?.visao || 'kanban'),
    [tk, setTk] = useState(null),
    [criando, setCriando] = useState(null)
  const set = (k, v) => setFiltro(f => ({ ...f, [k]: v }))
  useEffect(() => guardarFiltros(me, { filtro, visao }), [me, filtro, visao])

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
  const gruposCriar = gruposDeProjetos(meus).map(g => ({ rotulo: g.rotulo, opcoes: g.projetos.map(p => [p.codigo, p.nome]) }))
  const codigosCriar = gruposCriar.flatMap(g => g.opcoes.map(([codigo]) => codigo))
  // Equipe, papel e etapas do projeto escolhido na janela de criação.
  const projetoDe = codigo => {
    const projeto = porCodigo.get(codigo)
    return {
      p: projeto ? { id: projeto.codigo, nome: projeto.nome, membros: equipeAtual(projeto) } : null,
      papel: papelNaTarefa({ me, gestao, projeto }),
      colunas: projeto?.colunas?.map(adaptColuna),
    }
  }

  // Nova tarefa: projeto do filtro (se a pessoa cria nele) ou o primeiro; `i` = semana clicada no quadro (padrão das datas).
  const { m } = semanas(D)
  const nova = i => {
    const codigo = codigosCriar.find(c => 'proj:' + c === filtro.origem) || codigosCriar[0]
    const { p, papel, colunas } = projetoDe(codigo)
    setCriando(
      rascunhoNovo({
        projetoId: codigo,
        organiza: papel.organiza,
        membros: p?.membros,
        me,
        colunas,
        responsaveis: filtro.pessoa && filtro.pessoa !== me && gestao ? [filtro.pessoa] : [],
        ...(typeof i == 'number' && i < 3 ? { inicio: D.c.hoje, fim: iso(m + (7 * i + 4) * DAY) } : {}),
      }),
    )
  }
  const podeCriar = codigosCriar.length > 0

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
      {criando && (
        <TaskModal
          D={D}
          modo="criar"
          me={me}
          t={criando}
          T={T}
          projetos={gruposCriar}
          projetoDe={projetoDe}
          criar={(rascunho, arquivos) =>
            criarDaJanela(rascunho, arquivos, {
              aoCriar: async () => {
                await recarregar()
                refresh().catch(() => {})
              },
              // A tarefa criada pode estar fora dos filtros: limpa para a janela achá-la.
              abrir: codigo => {
                setFiltro(f => ({ ...f, pessoa: '', origem: '', status: '', prazo: '' }))
                setTk(codigo)
              },
            })
          }
          close={() => setCriando(null)}
        />
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
