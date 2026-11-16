import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { chip, fm, prog } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import { Av, PageBar, Prog } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { consumir } from '../lib/atalho'
import { GRUPOS_PROJETO } from '../lib/indicadores'
import { configuracoes, pessoas } from '../services/pessoas'
import { COR_STATUS_PROJETO, PRIORIDADE_PROJETO, STATUS_PROJETO, mesmaLista, projetos, rotuloStatusProjeto } from '../services/projetos'

const dia = s => (s ? String(s).slice(0, 10) : '')
const membrosAtivos = p => (p.participacoes || []).filter(x => !x.dataSaida).map(x => x.usuario.codigo)

const VISIBILIDADE = [
  ['normal', 'Normal'],
  ['sigiloso', 'Sigiloso'],
]

/** Campos do formulário do projeto, usados aqui e na Visão geral do projeto. */
export function camposProjeto({ lista, areas, novo, podeGerirAcesso }) {
  const opcoes = (itens, ok) => [['', '—'], ...itens.filter(ok).map(i => [i.codigo, i.nome])]
  // Visibilidade e lista de acesso: na criação sempre; na edição só quem gere o acesso (senão a API recusa com 403).
  const gereAcesso = novo || podeGerirAcesso
  return [
    { k: 'nome', l: 'Nome' },
    { k: 'referencia', l: 'Referência', opt: true, h: 'Código curto do projeto, ex.: PRJ-2026-01.' },
    { k: 'clienteNome', l: 'Cliente', opt: true },
    { k: 'descricao', l: 'Descrição', t: 'textarea' },
    { k: 'objetivo', l: 'Objetivo', t: 'textarea', opt: true },
    { k: 'dataInicio', l: 'Início', t: 'date' },
    { k: 'dataFim', l: 'Fim', t: 'date' },
    { k: 'status', l: 'Status', o: STATUS_PROJETO, s: () => !novo },
    { k: 'prioridade', l: 'Prioridade', o: PRIORIDADE_PROJETO },
    { k: 'codigoResponsavel', l: 'Responsável', o: opcoes(lista, u => u.naEj), opt: true },
    { k: 'codigoArea', l: 'Área', o: opcoes(areas, a => a.ativa), opt: true },
    { k: 'visibilidade', l: 'Visibilidade', o: VISIBILIDADE, s: () => gereAcesso },
    {
      k: 'acesso',
      l: 'Quem mais pode ver o projeto',
      // Só pessoas com login (ativas): a API recusa as outras com ACESSO_PESSOA_SEM_LOGIN.
      c: lista.filter(u => u.ativo).map(u => ({ id: u.codigo, nome: u.nome, perfil: u.perfil })),
      s: v => gereAcesso && v.visibilidade === 'sigiloso',
      h: 'Diretores e a equipe já veem o projeto.',
    },
  ]
}

export function valoresProjeto(p) {
  if (!p) return { prioridade: 'media', codigoResponsavel: '', codigoArea: '', visibilidade: 'normal', acesso: [] }
  return {
    nome: p.nome,
    referencia: p.referencia || '',
    clienteNome: p.clienteNome || '',
    descricao: p.descricao,
    objetivo: p.objetivo || '',
    dataInicio: dia(p.dataInicio),
    dataFim: dia(p.dataFim),
    status: p.status,
    prioridade: p.prioridade || 'media',
    codigoResponsavel: p.responsavel?.codigo || '',
    codigoArea: p.area?.codigo || '',
    visibilidade: p.sigiloso ? 'sigiloso' : 'normal',
    acesso: p.acesso || [],
  }
}

/**
 * Grava o formulário: cria, ou edita. O PUT ignora a lista de acesso, então, na edição, quem gere o acesso
 * (diretor e criador) manda a lista à parte, e só se ela mudou.
 */
export async function gravarProjeto(p, v) {
  if (!p) return projetos.criar(v)
  const r = await projetos.editar(p.codigo, v)
  if (p.podeGerirAcesso && v.visibilidade === 'sigiloso' && Array.isArray(v.acesso) && !mesmaLista(v.acesso, p.acesso)) {
    await projetos.definirAcesso(p.codigo, v.acesso)
  }
  return r
}

/** Selo dos projetos sigilosos. */
export const SeloSigiloso = () => (
  <span className={chip() + ' selo-sigilo'} title="Projeto sigiloso">
    <Ic k="lock" />
    Sigiloso
  </span>
)

export const StatusProjeto = ({ s }) => <span className={chip(COR_STATUS_PROJETO[s])}>{rotuloStatusProjeto(s)}</span>

/**
 * Chave e busca da lista de projetos. A tela e o menu (src/lib/antecipar.js) usam as mesmas,
 * para o dado buscado antes do clique ser o que a tela mostra. `contexto` = { me, mb, pode } do useApp().
 */
export function dadosDaTela({ me, mb, pode }) {
  const gestor = pode('projetos.editar')
  return {
    chave: `projetos:${mb}:${gestor}`,
    carregar: async () => {
      const [lista, gente, areas] = await Promise.all([
        projetos.listar(mb ? { codigoUsuario: me } : {}),
        gestor ? pessoas.listar() : [],
        gestor ? configuracoes.areas() : [],
      ])
      return { lista, gente, areas }
    },
  }
}

/** RF-020 e RF-021: lista de projetos. Equipe e tarefas ficam dentro de cada projeto. */
export default function Projetos() {
  const { D, me, mb, form, go, pode, refresh } = useApp()
  const [pv, setPv] = useState('grid'),
    [grupo, setGrupo] = useState(() => consumir('projetos') || '')
  const gestor = pode('projetos.editar')
  const tela = dadosDaTela({ me, mb, pode })
  const { dados, carregando, recarregar } = useCarregar(tela.carregar, [mb, me, gestor], { chave: tela.chave })

  if (!dados)
    return (
      <>
        <PageBar title="Projetos" sub={carregando ? '' : 'Não foi possível carregar.'} />
        {carregando && <Esqueleto />}
      </>
    )
  const { lista, gente, areas } = dados

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
    form(
      p ? 'Editar projeto' : 'Novo projeto',
      camposProjeto({ lista: gente, areas, novo: !p, podeGerirAcesso: p?.podeGerirAcesso }),
      valoresProjeto(p),
      async v => {
        const r = await executar(() => gravarProjeto(p, v), p ? 'Projeto atualizado' : 'Projeto criado')
        if (r && !p) go('projeto', r.codigo)
        return r === false ? false : undefined
      },
    )
  const mudarStatus = p =>
    form(
      'Mudar status',
      [{ k: 'status', l: 'Status', o: STATUS_PROJETO, h: 'Em andamento, Atenção e Bloqueado contam na alocação das pessoas.' }],
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
    p.resumo ? null : (
      <ActionMenu
        items={[
          ['open', 'Abrir', () => go('projeto', p.codigo)],
          ...(gestor
            ? [
                ['edit', 'Editar', () => editar(p)],
                ['check', 'Mudar status', () => mudarStatus(p)],
              ]
            : []),
          ...(pode('projetos.excluir') ? [['trash', 'Excluir', () => excluir(p), 1]] : []),
        ]}
      />
    )
  const pg = p => prog(D, { id: p.codigo, tarefas: p.tarefas })
  const periodo = p => fm(dia(p.dataInicio)) + ' a ' + fm(dia(p.dataFim))
  const cols = [
    {
      k: 'nome',
      l: 'Projeto',
      render: p => (
        <>
          {p.nome}
          {p.sigiloso && (
            <>
              {' '}
              <SeloSigiloso />
            </>
          )}
        </>
      ),
    },
    { k: 'st', l: 'Status', filter: 1, get: p => rotuloStatusProjeto(p.status), render: p => <StatusProjeto s={p.status} /> },
    { k: 'resp', l: 'Responsável', filter: 1, get: p => p.responsavel?.nome || '—' },
    { k: 'fim', l: 'Período', get: p => dia(p.dataFim), render: periodo },
    { k: 'pr', l: 'Progresso', get: pg, render: p => pg(p) + '%' },
    { l: 'Equipe', render: p => <Av D={D} ids={membrosAtivos(p)} /> },
    { l: 'Ações', render: p => <Ac p={p} /> },
  ]
  const linhas = lista.filter(p => !grupo || GRUPOS_PROJETO[grupo].status.includes(p.status)).map(p => ({ ...p, id: p.codigo }))
  const vazio = grupo
    ? 'Nenhum projeto neste grupo. Escolha “Todos” no filtro.'
    : gestor
      ? 'Nenhum projeto cadastrado. Use “Novo projeto”.'
      : 'Você ainda não participa de nenhum projeto. Quando a gestão incluir você numa equipe, ele aparece aqui.'
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
    </div>
  )

  return (
    <>
      <PageBar title="Projetos" sub={mb ? 'Projetos de que você participa ou participou.' : undefined}>
        <button className={'btn btn-g' + (pv == 'grid' ? ' on' : '')} onClick={() => setPv('grid')}>
          Grid
        </button>
        <button className={'btn btn-g' + (pv == 'lista' ? ' on' : '')} onClick={() => setPv('lista')}>
          Linhas
        </button>
        {gestor && (
          <button className="btn btn-primary" onClick={() => editar()}>
            <Ic k="plus" />
            Novo projeto
          </button>
        )}
      </PageBar>
      {filtroGrupo}
      {pv == 'grid' ? (
        <div className="row g-3">
          {!linhas.length && (
            <div className="col-12">
              <div className="card card-body">{vazio}</div>
            </div>
          )}
          {linhas.map(p => (
            <div className="col-md-6 col-xl-4" key={p.id}>
              <div
                className={'card card-body pj h-100' + (p.resumo ? ' resumo-sigilo' : ' hoverable')}
                onClick={p.resumo ? undefined : () => go('projeto', p.codigo)}
              >
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <span className="d-flex flex-wrap gap-1">
                    <StatusProjeto s={p.status} />
                    {p.sigiloso && <SeloSigiloso />}
                  </span>
                  <Av D={D} ids={membrosAtivos(p)} />
                </div>
                <h2 className="mt-3">{p.nome}</h2>
                <p className="text-mu m-0">{p.resumo ? 'Projeto sigiloso: só o resumo.' : p.descricao}</p>
                <Prog v={pg(p)} />
                <small>
                  {pg(p)}% · {periodo(p)}
                  {p.clienteNome ? ' · ' + p.clienteNome : ''}
                </small>
                {!p.resumo && (
                  <span className="cm" onClick={e => e.stopPropagation()}>
                    <Ac p={p} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Table cols={cols} rows={linhas} vazio={vazio} linhaCls={p => (p.resumo ? 'resumo-sigilo' : undefined)} />
      )}
    </>
  )
}
