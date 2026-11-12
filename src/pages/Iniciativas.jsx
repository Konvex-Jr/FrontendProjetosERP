import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ST, PC, chip, fd } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import Markdown from '../components/Markdown'
import Anexos from '../components/Anexos'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import { abrirCom } from '../lib/atalho'
import { conhecimento } from '../services/conhecimento'
import { tarefas } from '../services/tarefas'
import { COR_STATUS, iniciativas, opcoesDe, progressoTarefas, rotulo, valoresIniciativa } from '../services/iniciativas'

/**
 * Iniciativas de inovação (sessão 12b, RF-090 a RF-092). Todos veem todas; a gestão e a área de Inovação criam;
 * responsável, quem criou e a gestão alteram (a API diz em `podeCriar` e `podeAlterar`).
 */

// Filtros ficam na memória ao abrir a ficha e voltar (recarregar a página zera).
let ultimosFiltros = {}

const MARKDOWN = 'Aceita Markdown simples: ## título, - lista, **negrito**, *itálico* e [texto](https://...).'
const VAZIO_OPCOES = { status: [], tipos: [], frentes: [], podeCriar: false }
const useOpcoes = () => useCarregar(iniciativas.opcoes, []).dados || VAZIO_OPCOES
const opcoes = lista => [...new Map(lista.map(x => [x.id, x.nome])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
const periodo = i => (i.inicio || i.fim ? `${fd(i.inicio)} a ${fd(i.fim)}` : '—')

/** Formulário de iniciativa. Itens da Base e projetos já ligados continuam selecionáveis. */
async function abrirFormIniciativa({ D, form, op, item, aoSalvar }) {
  let base = []
  try {
    base = await conhecimento.listar()
  } catch {
    /* sem a lista, só os já ligados */
  }
  const itens = new Map(base.map(k => [k.id, k.titulo]))
  ;(item?.conhecimentos || []).forEach(k => !itens.has(k.id) && itens.set(k.id, k.nome))
  const projetos = new Map((D.p || []).map(p => [p.id, p.nome]))
  ;(item?.projetos || []).forEach(p => !projetos.has(p.id) && projetos.set(p.id, p.nome))
  const pessoas = (D.u || []).filter(u => u.ativo !== false || u.id === item?.responsavelId).map(u => [u.id, u.nome])
  const multi = mapa => [...mapa.entries()].map(([id, nome]) => ({ id, nome, perfil: '' })).sort((a, b) => a.nome.localeCompare(b.nome))

  form(
    item ? 'Editar iniciativa' : 'Nova iniciativa',
    [
      { k: 'titulo', l: 'Título' },
      { k: 'tipo', l: 'Tipo', o: opcoesDe(op.tipos) },
      { k: 'frente', l: 'Frente', o: opcoesDe(op.frentes) },
      { k: 'status', l: 'Status', o: opcoesDe(op.status) },
      { k: 'responsavel', l: 'Responsável', o: item ? pessoas : [['', 'Eu (quem está criando)'], ...pessoas] },
      { k: 'inicio', l: 'Início', t: 'date', opt: 1 },
      { k: 'fim', l: 'Fim previsto', t: 'date', opt: 1 },
      { k: 'descricao', l: 'Descrição', t: 'textarea', rows: 5, opt: 1, h: 'O problema, a hipótese e o que se quer testar. ' + MARKDOWN },
      { k: 'resultado', l: 'Resultado', t: 'textarea', rows: 3, opt: 1, h: 'O que aconteceu (preencha ao longo do caminho).' },
      {
        k: 'aprendizados',
        l: 'Aprendizados',
        t: 'textarea',
        rows: 3,
        opt: 1,
        h: 'O que a Konvex aprendeu, inclusive se a iniciativa for descartada.',
      },
      { k: 'projetos', l: 'Projetos relacionados', c: multi(projetos) },
      { k: 'conhecimentos', l: 'Itens da Base de Inteligência', c: multi(itens) },
    ],
    valoresIniciativa(item),
    async v => {
      try {
        const salvo = await iniciativas.salvar(v, item?.id)
        alerts.toastSuccess(item ? 'Iniciativa atualizada' : 'Iniciativa criada')
        await aoSalvar?.(salvo)
      } catch (error) {
        await alerts.error('Não foi possível salvar a iniciativa', error.message)
        throw error
      }
    },
    { largo: true },
  )
}

async function excluirIniciativa(item, depois) {
  const ok = await alerts.confirm({
    title: 'Excluir iniciativa?',
    text: `${item.titulo}. As tarefas e os itens da Base continuam, só sem a ligação.`,
    confirmText: 'Excluir iniciativa',
    danger: true,
  })
  if (!ok) return
  try {
    await iniciativas.excluir(item.id)
    alerts.toastSuccess('Iniciativa excluída')
    await depois()
  } catch (error) {
    alerts.error('Não foi possível excluir a iniciativa', error.message)
  }
}

/** Tarefa de Inovação já ligada à iniciativa (só para quem organiza tarefas avulsas). */
function novaTarefa({ D, form, item, aoSalvar }) {
  const hoje = new Date().toISOString().slice(0, 10)
  form(
    'Nova tarefa de Inovação',
    [
      { k: 'titulo', l: 'Título', h: `Fica ligada à iniciativa “${item.titulo}”.` },
      { k: 'prioridade', l: 'Prioridade', o: ['P1', 'P2', 'P3', 'P4'].map(x => [x, x]) },
      { k: 'responsaveis', l: 'Responsáveis', c: (D.u || []).filter(u => u.ativo !== false) },
      { k: 'inicio', l: 'Início', t: 'date' },
      { k: 'fim', l: 'Fim', t: 'date' },
    ],
    { prioridade: 'P3', inicio: hoje, fim: hoje, responsaveis: item.responsavelId ? [item.responsavelId] : [] },
    async v => {
      try {
        await tarefas.criar(null, { ...v, categoria: 'inovacao', iniciativaId: item.id })
        alerts.toastSuccess('Tarefa criada')
        await aoSalvar?.()
      } catch (error) {
        await alerts.error('Não foi possível criar a tarefa', error.message)
        throw error
      }
    },
  )
}

export default function Iniciativas() {
  const { id } = useParams()
  return id ? <Ficha id={id} /> : <Lista />
}

function Lista() {
  const { D, form, go } = useApp()
  const op = useOpcoes()
  const [f, setF] = useState(() => ({ ...ultimosFiltros }))
  const [texto, setTexto] = useState(f.busca || '')
  useEffect(() => {
    ultimosFiltros = f
  }, [f])
  useEffect(() => {
    const t = setTimeout(() => setF(o => ((o.busca || '') === texto.trim() ? o : { ...o, busca: texto.trim() })), 300)
    return () => clearTimeout(t)
  }, [texto])

  const ativos = Object.values(f).some(Boolean)
  const todas = useCarregar(() => iniciativas.listar(), [])
  const chave = JSON.stringify(f)
  const filtradas = useCarregar(() => (ativos ? iniciativas.listar(f) : Promise.resolve(null)), [chave])
  const T = todas.dados || []
  const lista = ativos ? filtradas.dados || [] : T
  const carregando = todas.carregando || (ativos && filtradas.carregando)
  const recarregar = async () => {
    await todas.recarregar()
    if (ativos) await filtradas.recarregar()
  }

  // Opções de responsável e projeto a partir do que já existe.
  const responsaveis = useMemo(() => opcoes(T.filter(i => i.responsavelId).map(i => ({ id: i.responsavelId, nome: i.responsavel }))), [T])
  const projetos = useMemo(() => opcoes(T.flatMap(i => i.projetos)), [T])

  const editar = item => abrirFormIniciativa({ D, form, op, item, aoSalvar: recarregar })
  const set = k => e => setF(o => ({ ...o, [k]: e.target.value }))
  const sel = (k, rotuloCurto, itens, fem) => (
    <select
      className="form-select w-auto"
      style={{ maxWidth: 220 }}
      aria-label={'Filtrar por ' + rotuloCurto.toLowerCase()}
      value={f[k] || ''}
      onChange={set(k)}
    >
      <option value="">
        {rotuloCurto}: {fem ? 'todas' : 'todos'}
      </option>
      {itens.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
  const limpar = () => {
    setTexto('')
    setF({})
  }

  const cols = [
    {
      k: 'titulo',
      l: 'Iniciativa',
      render: x => (
        <a
          className="kc-t"
          href={`#/iniciativas/${x.id}`}
          onClick={e => {
            e.preventDefault()
            go('iniciativas', x.id)
          }}
        >
          <b>{x.titulo}</b>
          <small className="d-block">
            {rotulo(op.frentes, x.frente)} · {rotulo(op.tipos, x.tipo)}
          </small>
        </a>
      ),
    },
    {
      k: 'status',
      l: 'Status',
      get: x => rotulo(op.status, x.status),
      render: x => <span className={chip(COR_STATUS[x.status])}>{rotulo(op.status, x.status)}</span>,
    },
    { k: 'responsavel', l: 'Responsável' },
    {
      k: 'projetos',
      l: 'Projetos',
      get: x => x.projetos.map(p => p.nome).join(', '),
      render: x => (x.projetos.length ? x.projetos.map(p => p.nome).join(', ') : '—'),
    },
    { k: 'fim', l: 'Período', render: periodo },
    {
      l: 'Ações',
      render: x => (
        <ActionMenu
          items={[
            ['open', 'Abrir', () => go('iniciativas', x.id)],
            ...(x.podeAlterar
              ? [
                  ['edit', 'Editar', () => editar(x)],
                  ['trash', 'Excluir', () => excluirIniciativa(x, recarregar), 1],
                ]
              : []),
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageBar title="Iniciativas" sub="Ideias, experimentos e produtos da frente de Inovação, abertos a todos.">
        {op.podeCriar && (
          <button className="btn btn-primary" onClick={() => editar(null)}>
            <Ic k="plus" />
            Nova iniciativa
          </button>
        )}
      </PageBar>
      <div className="fl d-flex flex-wrap gap-2 mb-2">
        <input
          className="form-control w-auto flex-grow-1"
          style={{ maxWidth: 320 }}
          placeholder="Buscar no título, descrição, resultado…"
          aria-label="Buscar iniciativas"
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        {sel('status', 'Status', opcoesDe(op.status))}
        {sel('frente', 'Frente', opcoesDe(op.frentes), true)}
        {sel('tipo', 'Tipo', opcoesDe(op.tipos))}
        {sel('responsavel', 'Responsável', responsaveis)}
        {sel('projeto', 'Projeto', projetos)}
        {ativos && (
          <button className="btn btn-g" onClick={limpar}>
            Limpar filtros
          </button>
        )}
      </div>
      {carregando && !lista.length ? (
        <div className="card card-body">
          <small>Carregando…</small>
        </div>
      ) : (
        <Table
          busca={false}
          cols={cols}
          rows={lista}
          vazio={
            ativos
              ? 'Nada encontrado. Ajuste a busca ou os filtros.'
              : op.podeCriar
                ? 'Nenhuma iniciativa ainda. Use “Nova iniciativa” para registrar uma ideia ou experimento.'
                : 'Nenhuma iniciativa ainda. Quando a área de Inovação registrar uma, ela aparece aqui.'
          }
        />
      )}
    </>
  )
}

const Secao = ({ titulo, children }) => (
  <div className="kc-s">
    <h3 className="h6 fw-bold">{titulo}</h3>
    {children}
  </div>
)

function Ficha({ id }) {
  const { D, form, go, pode } = useApp()
  const op = useOpcoes()
  const { dados: item, carregando, recarregar } = useCarregar(() => iniciativas.buscar(id), [id])
  const voltar = (
    <button className="btn btn-g" onClick={() => go('iniciativas')}>
      <Ic k="back" />
      Voltar
    </button>
  )
  if (!item)
    return (
      <PageBar title="Iniciativas" sub={carregando ? 'Carregando…' : 'Iniciativa não encontrada. Ela pode ter sido excluída.'}>
        {voltar}
      </PageBar>
    )

  const visiveis = new Set((D.p || []).map(p => p.id))
  const atribui = pode('tarefas.atribuir')
  const ocultas = item.totalTarefas - item.tarefas.length
  const verTarefas = () => {
    abrirCom('tarefas', { pessoa: '', origem: 'cat:inovacao' })
    go('tarefas')
  }
  const cols = [
    { k: 'titulo', l: 'Tarefa', render: t => <b>{t.titulo}</b> },
    {
      k: 'status',
      l: 'Situação',
      get: t => ST[t.status],
      render: t => <span className={chip(t.status === 'concluida' ? 'ok' : '')}>{ST[t.status]}</span>,
    },
    { k: 'prioridade', l: 'Prioridade', render: t => <span className={chip(PC[t.prioridade])}>{t.prioridade}</span> },
    { k: 'responsaveis', l: 'Responsáveis', get: t => t.responsaveis.join(', ') || '—' },
    { k: 'fim', l: 'Prazo', render: t => fd(t.fim) },
  ]

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="cab d-flex align-items-center gap-2">
          {voltar}
          <h1>{item.titulo}</h1>
          <span className={chip(COR_STATUS[item.status])}>{rotulo(op.status, item.status)}</span>
        </div>
        {item.podeAlterar && (
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-g" onClick={() => abrirFormIniciativa({ D, form, op, item, aoSalvar: recarregar })}>
              <Ic k="edit" />
              Editar
            </button>
            <button className="btn btn-g" onClick={() => excluirIniciativa(item, () => go('iniciativas'))}>
              <Ic k="trash" />
              Excluir
            </button>
          </div>
        )}
      </div>
      <div className="card card-body kc">
        <div className="kc-m">
          <span>
            <Ic k="perfil" />
            Responsável: {item.responsavel}
          </span>
          <span>
            <Ic k="iniciativas" />
            {rotulo(op.frentes, item.frente)} · {rotulo(op.tipos, item.tipo)}
          </span>
          <span>
            <Ic k="clock" />
            {periodo(item)}
          </span>
          {item.criadoPor && <span>Criada por {item.criadoPor}</span>}
        </div>
        <Secao titulo="Descrição">
          {item.descricao.trim() ? (
            <Markdown texto={item.descricao} />
          ) : (
            <small>Sem descrição. {item.podeAlterar && 'Use “Editar” para acrescentar.'}</small>
          )}
        </Secao>
        <Secao titulo="Projetos relacionados">
          {item.projetos.length ? (
            <div className="kc-tags">
              {item.projetos.map(p =>
                visiveis.has(p.id) ? (
                  <button key={p.id} type="button" className={chip('kc-tag')} onClick={() => go('projeto', p.id)}>
                    {p.nome}
                  </button>
                ) : (
                  <span key={p.id} className={chip('')}>
                    {p.nome}
                  </span>
                ),
              )}
            </div>
          ) : (
            <small>Nenhum projeto ligado.</small>
          )}
        </Secao>
        <Secao titulo="Itens da Base de Inteligência">
          {item.conhecimentos.length ? (
            <div className="kc-tags">
              {item.conhecimentos.map(k => (
                <button key={k.id} type="button" className={chip('kc-tag')} onClick={() => go('conhecimento', k.id)}>
                  {k.nome}
                </button>
              ))}
            </div>
          ) : (
            <small>Nenhum item ligado. {item.podeAlterar && 'Use “Editar” para ligar pesquisas e aprendizados.'}</small>
          )}
        </Secao>
        <Secao titulo={`Tarefas de Inovação · ${progressoTarefas(item)} concluídas`}>
          <div className="d-flex flex-wrap gap-2 mb-2">
            {atribui && (
              <button className="btn btn-g" onClick={() => novaTarefa({ D, form, item, aoSalvar: recarregar })}>
                <Ic k="plus" />
                Nova tarefa
              </button>
            )}
            {item.tarefas.length > 0 && (
              <button className="btn btn-g" onClick={verTarefas}>
                <Ic k="tarefas" />
                Abrir em Tarefas
              </button>
            )}
          </div>
          <Table
            busca={false}
            cols={cols}
            rows={item.tarefas}
            vazio={
              item.totalTarefas
                ? 'As tarefas desta iniciativa estão com outras pessoas.'
                : atribui
                  ? 'Nenhuma tarefa ainda. Use “Nova tarefa” para dividir o trabalho.'
                  : 'Nenhuma tarefa ligada ainda.'
            }
          />
          {ocultas > 0 && item.tarefas.length > 0 && <small className="d-block mt-1">Mais {ocultas} tarefa(s) com outras pessoas.</small>}
        </Secao>
        {(item.anexos.length > 0 || item.podeAlterar) && (
          <Secao titulo="Anexos">
            <Anexos dono="iniciativas" codigo={item.id} lista={item.anexos} podeAlterar={item.podeAlterar} aoMudar={recarregar} />
          </Secao>
        )}
        <Secao titulo="Resultado">
          {item.resultado.trim() ? <Markdown texto={item.resultado} /> : <small>Ainda sem resultado registrado.</small>}
        </Secao>
        <Secao titulo="Aprendizados">
          {item.aprendizados.trim() ? <Markdown texto={item.aprendizados} /> : <small>Ainda sem aprendizados registrados.</small>}
        </Secao>
      </div>
    </>
  )
}
