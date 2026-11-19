import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { fm, prog } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import { Av, PageBar, Prog } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { SeloSigiloso, SeloTipo, StatusProjeto } from '../components/SeloProjeto'
import { ErroAcessoParcial, acessoComLogin, gravarProjeto } from '../lib/gravarProjeto'
import { consumir } from '../lib/atalho'
import { FILTRO_TIPO, TIPOS_PROJETO, areasDosProjetos, comArea, erroDoFormularioProjeto, filtrarProjetos } from '../lib/projetosInternos'
import { GRUPOS_PROJETO } from '../lib/indicadores'
import { configuracoes, pessoas } from '../services/pessoas'
import { PRIORIDADE_PROJETO, STATUS_PROJETO, projetos, rotuloStatusProjeto } from '../services/projetos'

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
    { k: 'tipo', l: 'Tipo', o: TIPOS_PROJETO, h: 'Interno é da Konvex e fica numa área; cliente é para quem a Konvex trabalha.' },
    { k: 'referencia', l: 'Referência', opt: true, h: 'Código curto do projeto, ex.: PRJ-2026-01.' },
    { k: 'clienteNome', l: 'Cliente', opt: true, s: v => v.tipo !== 'interno' },
    { k: 'descricao', l: 'Descrição', t: 'textarea' },
    { k: 'objetivo', l: 'Objetivo', t: 'textarea', opt: true },
    { k: 'dataInicio', l: 'Início', t: 'date' },
    { k: 'dataFim', l: 'Fim', t: 'date' },
    { k: 'status', l: 'Status', o: STATUS_PROJETO, s: () => !novo },
    { k: 'prioridade', l: 'Prioridade', o: PRIORIDADE_PROJETO },
    { k: 'codigoResponsavel', l: 'Responsável', o: opcoes(lista, u => u.naEj), opt: true },
    {
      k: 'codigoArea',
      l: 'Área',
      o: opcoes(areas, a => a.ativa),
      opt: true,
      h: 'Obrigatória no projeto interno.',
    },
    { k: 'visibilidade', l: 'Visibilidade', o: VISIBILIDADE, s: () => gereAcesso },
    {
      k: 'acesso',
      l: 'Quem mais pode ver o projeto',
      // Só pessoas com login (ativas): a API recusa as outras com ACESSO_PESSOA_SEM_LOGIN.
      c: lista.filter(u => u.ativo).map(u => ({ id: u.codigo, nome: u.nome, perfil: u.perfil })),
      s: v => gereAcesso && v.visibilidade === 'sigiloso',
      h: 'Diretores, quem criou e a equipe já veem o projeto.',
    },
  ]
}

/** `pessoas`: a mesma lista do seletor de acesso (só os códigos com login entram no formulário). */
export function valoresProjeto(p, pessoas = []) {
  if (!p) return { tipo: 'cliente', prioridade: 'media', codigoResponsavel: '', codigoArea: '', visibilidade: 'normal', acesso: [] }
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
    codigoResponsavel: p.responsavel?.codigo || '',
    codigoArea: p.area?.codigo || '',
    visibilidade: p.sigiloso ? 'sigiloso' : 'normal',
    acesso: acessoComLogin(p.acesso, pessoas),
  }
}

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
    [grupo, setGrupo] = useState(() => consumir('projetos') || ''),
    [tipo, setTipo] = useState(''),
    [areaId, setAreaId] = useState('')
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
      if (error instanceof ErroAcessoParcial) {
        // O projeto já foi salvo: recarrega para a tela mostrar o que o servidor tem e fecha o formulário.
        await recarregar()
        refresh().catch(() => {})
        alerts.error('Salvo pela metade', 'Projeto salvo, mas a lista de acesso não: ' + error.message)
        return undefined
      }
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }

  const editar = p =>
    form(
      p ? 'Editar projeto' : 'Novo projeto',
      camposProjeto({ lista: gente, areas, novo: !p, podeGerirAcesso: p?.podeGerirAcesso }),
      valoresProjeto(p, gente),
      async v => {
        const aviso = erroDoFormularioProjeto(v)
        if (aviso) {
          alerts.error('Não foi possível salvar', aviso)
          return false
        }
        const r = await executar(
          () => gravarProjeto(p, v.tipo === 'interno' ? { ...v, clienteNome: '' } : v),
          p ? 'Projeto atualizado' : 'Projeto criado',
        )
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
  const linhas = filtrarProjetos(lista, { tipo, areaId })
    .filter(p => !grupo || GRUPOS_PROJETO[grupo].status.includes(p.status))
    .map(p => ({ ...p, id: p.codigo }))
  const filtrando = grupo || tipo || areaId
  const vazio = filtrando
    ? 'Nenhum projeto com estes filtros. Escolha “Todos” nos filtros.'
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
                    <SeloTipo p={p} />
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
