import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { fm, prog } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import { Av, PageBar, Prog } from '../components/Ui'
import { Alocacao, Campinho } from '../components/VisoesGestao'
import Avatar from '../components/Avatar'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { SeloSigiloso, SeloTipo, StatusProjeto } from '../components/SeloProjeto'
import { gravarProjeto } from '../lib/gravarProjeto'
import { consumir } from '../lib/atalho'
import {
  FILTRO_TIPO,
  TIPOS_PROJETO,
  areasDosProjetos,
  comArea,
  erroDoFormularioProjeto,
  filtrarProjetos,
  semEquipeEscondida,
  textoDoCartao,
} from '../lib/projetosInternos'
import { GRUPOS_PROJETO } from '../lib/indicadores'
import { configuracoes, pessoas } from '../services/pessoas'
import { PRIORIDADE_PROJETO, STATUS_PROJETO, projetos, rotuloStatusProjeto } from '../services/projetos'

const dia = s => (s ? String(s).slice(0, 10) : '')
const membrosAtivos = p => (p.participacoes || []).filter(x => !x.dataSaida).map(x => x.usuario.codigo)

const VISIBILIDADE = [
  ['normal', 'Normal'],
  ['sigiloso', 'Sigiloso'],
]

/**
 * Na edição, marcar o projeto como sigiloso pode esconder os detalhes de quem não é da equipe: pede confirmação.
 * Resolve false se a pessoa desistir.
 */
export async function confirmarSigilo(p, v) {
  if (!p || p.sigiloso || v.visibilidade !== 'sigiloso') return true
  return alerts.confirm({
    title: 'Marcar como sigiloso?',
    text: 'Só a equipe e os diretores verão os detalhes e as tarefas.',
    confirmText: 'Marcar como sigiloso',
  })
}

/** Campos do formulário do projeto, usados aqui e na Visão geral do projeto. */
export function camposProjeto({ lista, areas, novo }) {
  const opcoes = (itens, ok) => [['', '—'], ...itens.filter(ok).map(i => [i.codigo, i.nome])]
  return [
    { k: 'nome', l: 'Nome' },
    { k: 'tipo', l: 'Tipo', o: TIPOS_PROJETO, h: 'Interno é da Konvex e fica numa área; cliente é para quem a Konvex trabalha.' },
    { k: 'referencia', l: 'Referência', opt: true, h: 'Código curto do projeto, ex.: PRJ-2026-01.' },
    { k: 'clienteNome', l: 'Cliente', opt: true, s: v => v.tipo !== 'interno' },
    { k: 'descricao', l: 'Descrição', t: 'textarea' },
    { k: 'objetivo', l: 'Objetivo', t: 'textarea', opt: true },
    { k: 'dataInicio', l: 'Início', t: 'date' },
    { k: 'dataFim', l: 'Fim', t: 'date' },
    { k: 'status', l: 'Status', o: STATUS_PROJETO, s: () => !novo },
    { k: 'prioridade', l: 'Prioridade', o: PRIORIDADE_PROJETO },
    // Líder na criação (sessão 27b): pessoa da EJ, menos trainee; entra na equipe junto. Depois, troca pela Equipe.
    {
      k: 'codigoLider',
      l: 'Líder',
      o: opcoes(lista, u => u.naEj && u.status !== 'trainee'),
      s: () => novo,
      h: 'Entra na equipe junto. Depois, a troca é pela aba Equipe.',
    },
    {
      k: 'codigoArea',
      l: 'Área',
      o: opcoes(areas, a => a.ativa),
      opt: true,
      h: 'Obrigatória no projeto interno.',
    },
    { k: 'visibilidade', l: 'Visibilidade', o: VISIBILIDADE, h: 'Só a equipe e os diretores verão os detalhes e as tarefas.' },
    {
      k: 'codigosMembros',
      l: 'Equipe inicial',
      c: (lista || []).filter(u => u.naEj).map(u => ({ id: u.codigo, nome: u.nome })),
      s: v => novo && v.visibilidade === 'sigiloso',
      opt: true,
      h: 'Quem não é diretor precisa se colocar na equipe para continuar vendo o projeto sigiloso.',
    },
  ]
}

export function valoresProjeto(p) {
  if (!p) return { tipo: 'cliente', prioridade: 'media', codigoLider: '', codigoArea: '', visibilidade: 'normal' }
  return {
    nome: p.nome,
    tipo: p.tipo || 'cliente',
    referencia: p.referencia || '',
    clienteNome: p.clienteNome || '',
    descricao: p.descricao,
    objetivo: p.objetivo || '',
    dataInicio: dia(p.dataInicio),
    dataFim: dia(p.dataFim),
    status: p.status,
    prioridade: p.prioridade || 'media',
    codigoArea: p.area?.codigo || '',
    visibilidade: p.sigiloso ? 'sigiloso' : 'normal',
  }
}

/**
 * Chave e busca da lista de projetos. A tela e o menu (src/lib/antecipar.js) usam as mesmas,
 * para o dado buscado antes do clique ser o que a tela mostra. `contexto` = { me, mb, pode } do useApp().
 */
export function dadosDaTela({ pode }) {
  const gestor = pode('projetos.editar')
  return {
    // Todos veem todos os projetos (sessão 27a): os de fora vêm como cartão. Filtrar pela pessoa esconderia os cartões.
    chave: `projetos:todos:${gestor}`,
    carregar: async () => {
      const [lista, gente, areas] = await Promise.all([
        projetos.listar(),
        gestor ? pessoas.listar() : [],
        gestor ? configuracoes.areas() : [],
      ])
      return { lista, gente, areas }
    },
  }
}

/** Equipe atual no cartão (sessão 27b): foto ou iniciais, nome no title e no leitor de tela. */
export function EquipeDoCartao({ membros }) {
  if (!membros?.length) return <span className="text-mu">Sem equipe</span>
  return (
    <span className="d-inline-flex flex-wrap gap-1">
      {membros.map(m => (
        <Avatar key={m.codigo} pessoa={m} title={m.nome} aria-label={m.nome} role="img" />
      ))}
    </span>
  )
}

/**
 * Projeto que a pessoa vê só pelo cartão (sessão 27a): nome, tipo, área do interno, status, líder e selo do
 * sigiloso. Sem clique, sem progresso e sem datas.
 */
function CartaoNaLista({ p }) {
  return (
    <div className="card card-body h-100 pj-cartao" aria-label={'Projeto ' + p.nome + ' (só o cartão)'}>
      <span className="d-flex flex-wrap gap-1">
        <StatusProjeto s={p.status} />
        <SeloTipo p={p} />
        {p.sigiloso && <SeloSigiloso />}
      </span>
      <h2 className="mt-3">{p.nome}</h2>
      <dl className="pj-cartao-dados">
        {p.tipo === 'interno' && p.areaNome && (
          <>
            <dt>Área</dt>
            <dd>{p.areaNome}</dd>
          </>
        )}
        {/* O geral da área não tem líder próprio (quem lidera é o líder da área), como na ficha completa. */}
        {!p.geralDaArea && (
          <>
            <dt>Líder</dt>
            <dd>{p.lider?.nome || 'Sem líder'}</dd>
          </>
        )}
        <dt>Equipe</dt>
        <dd>
          <EquipeDoCartao membros={p.membros} />
        </dd>
      </dl>
      <small className="text-mu mt-auto">{textoDoCartao(p)}</small>
    </div>
  )
}

/** RF-020 e RF-021: lista de projetos. Equipe e tarefas ficam dentro de cada projeto. */
export default function Projetos() {
  const { D, form, go, pode, refresh } = useApp()
  const [pv, setPv] = useState('grid'),
    [grupo, setGrupo] = useState(() => consumir('projetos') || 'ativos'),
    [tipo, setTipo] = useState(''),
    [areaId, setAreaId] = useState('')
  const gestor = pode('projetos.editar')
  const tela = dadosDaTela({ pode })
  const { dados, carregando, recarregar } = useCarregar(tela.carregar, [gestor], { chave: tela.chave })

  if (!dados)
    return (
      <>
        <PageBar title="Projetos" sub={carregando ? '' : 'Não foi possível carregar.'} />
        {carregando && <Esqueleto />}
      </>
    )
  const { gente, areas } = dados
  const lista = dados.lista.map(comArea)

  const executar = async (acao, sucesso) => {
    try {
      const r = await acao()
      alerts.toastSuccess(sucesso)
      await recarregar()
      refresh().catch(() => {})
      return r
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }

  const editar = p =>
    form(p ? 'Editar projeto' : 'Novo projeto', camposProjeto({ lista: gente, areas, novo: !p }), valoresProjeto(p), async v => {
      const aviso = erroDoFormularioProjeto(v)
      if (aviso) {
        alerts.error('Não foi possível salvar', aviso)
        return false
      }
      if (!(await confirmarSigilo(p, v))) return false
      const dados = semEquipeEscondida(v)
      const r = await executar(
        () => gravarProjeto(dados.tipo === 'interno' ? { ...dados, clienteNome: '' } : dados, p),
        p ? 'Projeto atualizado' : 'Projeto criado',
      )
      if (r && !p) go('projeto', r.codigo)
      return r === false ? false : undefined
    })
  const mudarStatus = p =>
    form(
      'Mudar status',
      [{ k: 'status', l: 'Status', o: STATUS_PROJETO, h: 'Concluído e Arquivado não contam na ocupação das pessoas.' }],
      { status: p.status },
      v => executar(() => projetos.alterarStatus(p.codigo, v.status), 'Status atualizado').then(r => (r === false ? false : undefined)),
    )
  const excluir = async p => {
    const ok = await alerts.confirm({
      title: 'Excluir projeto?',
      text: 'Remove o projeto e as tarefas dele. Para guardar o histórico, prefira o status Arquivado.',
      confirmText: 'Excluir projeto',
      danger: true,
    })
    if (ok) await executar(() => projetos.excluir(p.codigo), 'Projeto excluído')
  }

  const Ac = ({ p }) =>
    p.cartao ? null : (
      <ActionMenu
        items={[
          ['open', 'Abrir', () => go('projeto', p.codigo)],
          ...(gestor && !p.geralDaArea
            ? [
                ['edit', 'Editar', () => editar(p)],
                ['check', 'Mudar status', () => mudarStatus(p)],
              ]
            : []),
          ...(pode('projetos.excluir') && !p.geralDaArea ? [['trash', 'Excluir', () => excluir(p), 1]] : []),
        ]}
      />
    )
  const pg = p => prog(D, { id: p.codigo, tarefas: p.tarefas })
  // O geral da área não tem fim (a data de 31/12/2099 é só técnica): mostra só o início.
  const periodo = p => (p.geralDaArea ? 'Desde ' + fm(dia(p.dataInicio)) : fm(dia(p.dataInicio)) + ' a ' + fm(dia(p.dataFim)))
  // Cartão (projeto de outra equipe): sem período e progresso, que a API nem manda; equipe atual com nome e foto (27b).
  const cols = [
    {
      k: 'nome',
      l: 'Projeto',
      render: p => (
        <>
          {p.nome} <SeloTipo p={p} />
          {p.sigiloso && (
            <>
              {' '}
              <SeloSigiloso />
            </>
          )}
          {p.tipo === 'interno' && p.areaNome && <small className="d-block text-mu">{p.areaNome}</small>}
        </>
      ),
    },
    { k: 'st', l: 'Status', filter: 1, get: p => rotuloStatusProjeto(p.status), render: p => <StatusProjeto s={p.status} /> },
    { k: 'lider', l: 'Líder', filter: 1, get: p => p.lider?.nome || '—' },
    { k: 'fim', l: 'Período', get: p => (p.cartao ? '' : dia(p.dataFim)), render: p => (p.cartao ? '—' : periodo(p)) },
    { k: 'pr', l: 'Progresso', get: p => (p.cartao ? -1 : pg(p)), render: p => (p.cartao ? '—' : pg(p) + '%') },
    { l: 'Equipe', render: p => (p.cartao ? <EquipeDoCartao membros={p.membros} /> : <Av D={D} ids={membrosAtivos(p)} />) },
    { l: 'Ações', render: p => <Ac p={p} /> },
  ]
  const linhas = filtrarProjetos(lista, { tipo, areaId })
    .filter(p => !grupo || GRUPOS_PROJETO[grupo].status.includes(p.status))
    .map(p => ({ ...p, id: p.codigo }))
  const filtrando = grupo || tipo || areaId
  const vazio = filtrando
    ? 'Nenhum projeto com estes filtros. Escolha “Todos” nos filtros.'
    : gestor
      ? 'Nenhum projeto cadastrado. Use “Novo projeto”.'
      : 'Nenhum projeto cadastrado ainda.'
  const filtroGrupo = (
    <div className="fl d-flex flex-wrap gap-2 mb-3">
      <select
        className="form-select w-auto"
        style={{ maxWidth: 260 }}
        aria-label="Grupo de projetos"
        value={grupo}
        onChange={e => setGrupo(e.target.value)}
      >
        <option value="">Situação: todos</option>
        {Object.entries(GRUPOS_PROJETO).map(([k, g]) => (
          <option key={k} value={k}>
            {g.rotulo}
          </option>
        ))}
      </select>
      <select className="form-select w-auto" aria-label="Tipo de projeto" value={tipo} onChange={e => setTipo(e.target.value)}>
        {FILTRO_TIPO.map(([k, l]) => (
          <option key={k} value={k}>
            {k ? l : 'Tipo: todos'}
          </option>
        ))}
      </select>
      <select className="form-select w-auto" aria-label="Área do projeto" value={areaId} onChange={e => setAreaId(e.target.value)}>
        <option value="">Área: todas</option>
        {areasDosProjetos(lista).map(([k, nome]) => (
          <option key={k} value={k}>
            {nome}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <>
      <PageBar title="Projetos">
        <button className={'btn btn-g' + (pv == 'grid' ? ' on' : '')} onClick={() => setPv('grid')}>
          Grid
        </button>
        <button className={'btn btn-g' + (pv == 'lista' ? ' on' : '')} onClick={() => setPv('lista')}>
          Linhas
        </button>
        {/* Visões só da gestão (sessão 28a): por pessoa (Alocação) e por projeto (Campinho). */}
        {gestor && (
          <>
            <button className={'btn btn-g' + (pv == 'campinho' ? ' on' : '')} onClick={() => setPv('campinho')}>
              Campinho
            </button>
            <button className={'btn btn-g' + (pv == 'alocacao' ? ' on' : '')} onClick={() => setPv('alocacao')}>
              Alocação
            </button>
          </>
        )}
        {gestor && (
          <button className="btn btn-primary" onClick={() => editar()}>
            <Ic k="plus" />
            Novo projeto
          </button>
        )}
      </PageBar>
      {pv != 'alocacao' && filtroGrupo}
      {gestor && pv == 'alocacao' ? (
        <Alocacao lista={lista} gente={gente} />
      ) : gestor && pv == 'campinho' ? (
        <Campinho projetos={linhas} lista={lista} />
      ) : pv == 'grid' ? (
        <div className="row g-3">
          {!linhas.length && (
            <div className="col-12">
              <div className="card card-body">{vazio}</div>
            </div>
          )}
          {linhas.map(p => (
            <div className="col-md-6 col-xl-4" key={p.id}>
              {p.cartao ? (
                <CartaoNaLista p={p} />
              ) : (
                <div className="card card-body pj h-100 hoverable" onClick={() => go('projeto', p.codigo)}>
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <span className="d-flex flex-wrap gap-1">
                      <StatusProjeto s={p.status} />
                      <SeloTipo p={p} />
                      {p.sigiloso && <SeloSigiloso />}
                    </span>
                    <Av D={D} ids={membrosAtivos(p)} />
                  </div>
                  <h2 className="mt-3">{p.nome}</h2>
                  <p className="text-mu m-0">{p.descricao}</p>
                  <Prog v={pg(p)} />
                  <small>
                    {pg(p)}% · {periodo(p)}
                    {p.clienteNome ? ' · ' + p.clienteNome : ''}
                  </small>
                  <span className="cm" onClick={e => e.stopPropagation()}>
                    <Ac p={p} />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Table
          cols={cols}
          rows={linhas}
          vazio={vazio}
          itens={['projeto', 'projetos']}
          porPagina={20}
          linhaCls={p => (p.cartao ? 'linha-cartao' : undefined)}
        />
      )}
    </>
  )
}
