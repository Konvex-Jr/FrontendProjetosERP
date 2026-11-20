import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { DAY, d, fm, hj, nm } from '../lib/utils'
import Ic from '../components/Icon'
import TaskModal from '../components/TaskModal'
import KanbanEtapas from '../components/KanbanEtapas'
import ColunasModal from '../components/ColunasModal'
import { adaptColuna } from '../lib/colunas'
import EquipeProjeto from '../components/EquipeProjeto'
import { Av, PageBar, Seg } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { projetos, rotuloPrioridade } from '../services/projetos'
import { acoesTarefa, avisarOcupacao, criarDaJanela, papelNasTarefas, quadroDesatualizado } from '../services/tarefas'
import { rascunhoNovo } from '../lib/rascunhoTarefa'
import { PRAZOS, noPrazo } from '../lib/prazo'
import { ErroAcessoParcial, gravarProjeto } from '../lib/gravarProjeto'
import { carregarProjeto } from '../lib/carregarProjeto'
import Table from '../components/Table'
import { camposProjeto, confirmarSigilo, valoresProjeto } from './Projetos'
import { SeloSigiloso, SeloTipo, StatusProjeto } from '../components/SeloProjeto'
import { ItensDoProjeto } from './Biblioteca'
import { TEXTO_EQUIPE_GERAL } from '../lib/projetosInternos'
import { ocupacao } from '../services/ocupacao'
import ChipOcupacao from '../components/ChipOcupacao'

const ABAS = [
  ['tarefas', 'Tarefas'],
  ['geral', 'Visão geral'],
  ['equipe', 'Equipe'],
  ['biblioteca', 'Biblioteca'],
]

const dia = s => (s ? String(s).slice(0, 10) : '')

/** Gerente fora da lista do projeto sigiloso: só nome, status, datas, contagens e equipe. */
function ResumoSigiloso({ projeto, voltar }) {
  const t = projeto.tarefas || {}
  const pessoas = projeto.participacoes.map(x => ({ ...x, id: x.codigo ?? x.usuario.codigo + dia(x.dataEntrada) }))
  const dados = [
    ['Status', <StatusProjeto key="status" s={projeto.status} />],
    ['Período', fm(dia(projeto.dataInicio)) + ' a ' + fm(dia(projeto.dataFim))],
    ['Tarefas', `${t.concluidas || 0} de ${t.total || 0} concluídas`],
    ['Atrasadas', t.atrasadas || 0],
    ['Na semana', t.semana || 0],
  ]
  return (
    <>
      <div className="cab d-flex flex-wrap align-items-center gap-2 mb-3">
        {voltar}
        <h1>{projeto.nome}</h1>
        <SeloSigiloso />
      </div>
      <p className="text-mu">Projeto sigiloso: você vê só o resumo.</p>
      <div className="card card-body mb-3">
        <div className="row g-3">
          {dados.map(([l, v]) => (
            <div className="col-6 col-lg-3" key={l}>
              <small className="d-block">{l}</small>
              <div className="fw-semibold">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <h2 className="h6 fw-bold">Equipe</h2>
      <Table
        busca={false}
        rows={pessoas}
        vazio="Ninguém na equipe."
        cols={[
          { k: 'p', l: 'Pessoa', get: x => x.usuario.nome },
          { k: 'e', l: 'Entrada', get: x => dia(x.dataEntrada), render: x => fm(dia(x.dataEntrada)) },
          { k: 's', l: 'Saída', get: x => dia(x.dataSaida), render: x => (x.dataSaida ? fm(dia(x.dataSaida)) : 'Em andamento') },
        ]}
      />
    </>
  )
}

/**
 * Projeto geral da área: a equipe vem dos períodos na área, sem editar aqui. A ocupação da semana é a
 * mesma da aba Equipe dos outros projetos (total da pessoa, que todo logado vê); se a chamada falhar, "—".
 */
function EquipeCalculada({ projeto }) {
  const { dados: ocupacoes } = useCarregar(() => ocupacao.todas().catch(() => null), [], { chave: 'ocupacao:todas' })
  const percentuais = Object.fromEntries((ocupacoes || []).map(o => [o.codigoUsuario, o.percentual]))
  const pessoas = projeto.participacoes.filter(x => !x.dataSaida).map(x => ({ ...x, id: x.codigo ?? x.usuario.codigo }))
  return (
    <>
      <p className="text-mu">{TEXTO_EQUIPE_GERAL}</p>
      <Table
        busca={false}
        rows={pessoas}
        vazio="Ninguém na área agora."
        cols={[
          { k: 'p', l: 'Pessoa', get: x => x.usuario.nome },
          {
            k: 'ocupacao',
            l: 'Ocupação na semana',
            get: x => percentuais[x.usuario.codigo] ?? -1,
            render: x => <ChipOcupacao percentual={percentuais[x.usuario.codigo]} />,
          },
        ]}
      />
    </>
  )
}

/**
 * Página de um projeto (/projetos/:id), com as abas Tarefas (kanban ou Gantt), Visão geral, Equipe e Biblioteca.
 * Nas tarefas, gestão e líder organizam; quem está na equipe atual cria e conclui as suas (papelNasTarefas).
 */
export default function Projeto() {
  const { D, form, go, me, nav, pode, refresh } = useApp(),
    { id } = useParams(),
    pid = id
  const [pt, setPt] = useState('kanban'),
    [tk, setTk] = useState(null),
    [criando, setCriando] = useState(null),
    [prazo, setPrazo] = useState(''),
    [editandoColunas, setEditandoColunas] = useState(false)
  const [aba, setAba] = useState('tarefas')
  // Quem não tem Biblioteca no menu (trainee) levaria 403 da API: a aba nem aparece (mesma regra do Perfil).
  const temBiblioteca = nav.some(([chave]) => chave === 'biblioteca')
  const abas = temBiblioteca ? ABAS : ABAS.filter(([k]) => k !== 'biblioteca')
  const gestor = pode('projetos.editar')
  const { dados, carregando, recarregar } = useCarregar(() => carregarProjeto(pid, gestor), [pid, gestor], {
    chave: `projeto:${pid}:${gestor}`,
  })
  const voltar = (
    <button className="btn btn-g" onClick={() => go('projetos')}>
      <Ic k="back" />
      Voltar
    </button>
  )
  if (!dados)
    return (
      <>
        <PageBar title="Projeto" sub={carregando ? '' : 'Projeto não encontrado.'}>
          {voltar}
        </PageBar>
        {carregando && <Esqueleto />}
      </>
    )
  const { projeto, gente, areas } = dados
  if (projeto.resumo) return <ResumoSigiloso projeto={projeto} voltar={voltar} />
  // Depois de salvar: recarrega o projeto e os dados compartilhados (tarefas, avatares, painel).
  const aoSalvar = async () => {
    await recarregar()
    refresh().catch(() => {})
  }
  const p = { id: projeto.codigo, nome: projeto.nome, membros: projeto.participacoes.filter(x => !x.dataSaida).map(x => x.usuario.codigo) }
  const ehGeral = Boolean(projeto.geralDaArea)
  const papel = papelNasTarefas({ me, gestao: pode('tarefas.gerirTodas'), projeto })
  // `todas` vai para a janela da tarefa (dependências); quadro e cronograma mostram só as do filtro de prazo.
  const todas = dados.tarefas,
    h = hj(D),
    T = todas.filter(t => noPrazo(t, prazo, h))
  const colunas = projeto.colunas.map(adaptColuna)

  // Nova tarefa (botão ou "+" de uma coluna): janela da tarefa em modo criação, na coluna clicada.
  const add = colunaId => setCriando(rascunhoNovo({ projetoId: pid, organiza: papel.organiza, membros: p.membros, me, colunas, colunaId }))
  // Toda alteração de tarefa vai direto para a API; depois recarrega a tela e o painel.
  const salvarTarefa = async (chamada, ok) => {
    try {
      const resposta = await chamada()
      if (ok) alerts.toastSuccess(ok)
      avisarOcupacao(resposta)
      await aoSalvar()
    } catch (error) {
      // Coluna apagada ou quadro mudado por outra pessoa: mostra o aviso da API e recarrega o quadro.
      if (quadroDesatualizado(error)) await aoSalvar().catch(() => {})
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }
  const acoes = acoesTarefa(salvarTarefa)

  // Escala do Gantt: do primeiro início ao último fim (+1 dia); `pc` converte data em %, `hp` é a posição de hoje.
  const a = Math.min(...T.map(t => +d(t.inicio))),
    z = Math.max(...T.map(t => +d(t.fim))) + DAY,
    L = z - a,
    pc = x => ((x - a) / L) * 100,
    hp = pc(+h)

  // Grava as colunas e recarrega. A gravação que deu certo continua certa mesmo se a recarga falhar;
  // no 409 o erro devolvido é o do 409 (a janela recomeça do quadro recarregado).
  const gravarColunas = async corpo => {
    try {
      await projetos.gravarColunas(pid, corpo)
    } catch (e) {
      if (e.status === 409) await aoSalvar().catch(() => {})
      throw e
    }
    await aoSalvar().catch(() => {})
  }

  // Filtro de prazo (só na tela) acima do quadro e do cronograma; "Editar colunas" ao lado, no quadro.
  const barraTarefas = () => (
    <div className="fl d-flex flex-wrap gap-2 mb-2">
      <select className="form-select w-auto" aria-label="Prazo" value={prazo} onChange={e => setPrazo(e.target.value)}>
        {PRAZOS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {pt == 'kanban' && papel.organiza && (
        <button className="btn btn-g" onClick={() => setEditandoColunas(true)}>
          <Ic k="edit" />
          Editar colunas
        </button>
      )}
    </div>
  )

  const kanban = () => (
    <>
      <KanbanEtapas
        D={D}
        T={T}
        colunas={colunas}
        papelDe={() => papel}
        acoes={acoes}
        abrir={setTk}
        adicionar={papel.participa ? add : null}
      />
    </>
  )

  const gantt = () =>
    !T.length ? (
      <div className="card card-body">{prazo ? 'Nenhuma tarefa com este prazo.' : 'Nenhuma tarefa ainda. Use “Nova tarefa”.'}</div>
    ) : (
      <div className="card gt">
        {T.map(t => {
          const dep = todas.find(x => x.id == t.dependeDe),
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
    form(
      'Editar projeto',
      camposProjeto({ lista: gente, areas, podeGerirAcesso: projeto.podeGerirAcesso }),
      valoresProjeto(projeto, gente),
      async v => {
        if (!(await confirmarSigilo(projeto, v))) return false
        try {
          await gravarProjeto(projeto, v)
          alerts.toastSuccess('Projeto atualizado')
          await aoSalvar()
        } catch (error) {
          if (error instanceof ErroAcessoParcial) {
            // O projeto já foi salvo: recarrega e fecha o formulário, para a tela mostrar o que o servidor tem.
            await aoSalvar()
            alerts.error('Salvo pela metade', 'Projeto salvo, mas a lista de acesso não: ' + error.message)
            return undefined
          }
          alerts.error('Não foi possível salvar', error.message)
          return false
        }
      },
    )

  const info = [
    ['Status', <StatusProjeto key="status" s={projeto.status} />],
    ['Referência', projeto.referencia || '—'],
    ['Cliente', projeto.clienteNome || '—'],
    ['Tipo', <SeloTipo key="tipo" p={projeto} />],
    ...(ehGeral ? [] : [['Período', fm(dia(projeto.dataInicio)) + ' a ' + fm(dia(projeto.dataFim))]]),
    ['Prioridade', rotuloPrioridade(projeto.prioridade)],
    ['Responsável', projeto.responsavel?.nome || '—'],
    ...(ehGeral ? [] : [['Líder', projeto.lider?.nome || '—']]),
    ['Área', projeto.area?.nome || '—'],
    ['Equipe', <Av key="equipe" D={D} ids={p.membros} />],
    ...(projeto.sigiloso && !ehGeral
      ? [
          ['Visibilidade', <SeloSigiloso key="sigilo" />],
          ['Quem mais vê', projeto.acesso.length ? projeto.acesso.map(c => nm(D, [c])).join(', ') : 'Só diretores, quem criou e a equipe'],
        ]
      : []),
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
      {gestor && !ehGeral && (
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
          {/* Um filho só depois do título: o CSS do celular (.cab) conta com isso. */}
          <span className="d-flex flex-wrap gap-1">
            <StatusProjeto s={projeto.status} />
            <SeloTipo p={projeto} />
            {projeto.sigiloso && <SeloSigiloso />}
          </span>
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
        <Seg items={abas} value={aba} onChange={setAba} />
      </div>
      {aba == 'tarefas' && barraTarefas()}
      {aba == 'tarefas' && (pt == 'kanban' ? kanban() : gantt())}
      {aba == 'geral' && geral()}
      {aba == 'biblioteca' && temBiblioteca && <ItensDoProjeto projeto={projeto} />}
      {aba == 'equipe' && ehGeral && <EquipeCalculada projeto={projeto} />}
      {aba == 'equipe' && !ehGeral && <EquipeProjeto projeto={projeto} gente={gente} gestor={gestor} aoSalvar={aoSalvar} />}
      {editandoColunas && (
        <ColunasModal colunas={colunas} tarefas={todas} aoSalvar={gravarColunas} aoFechar={() => setEditandoColunas(false)} />
      )}
      {criando && (
        <TaskModal
          D={D}
          modo="criar"
          papel={papel}
          me={me}
          t={criando}
          colunas={colunas}
          p={p}
          T={todas}
          criar={(rascunho, arquivos) => criarDaJanela(rascunho, arquivos, { aoCriar: aoSalvar, abrir: setTk })}
          close={() => setCriando(null)}
        />
      )}
      {tk && todas.find(x => x.id == tk) && (
        <TaskModal
          D={D}
          papel={papel}
          me={me}
          salvar={(antes, depois) => acoes.salvar(antes, depois, 'Tarefa salva')}
          t={todas.find(x => x.id == tk)}
          colunas={colunas}
          mover={acoes.mover}
          p={p}
          T={todas}
          close={() => setTk(null)}
          del={acoes.del}
          tog={acoes.tog}
          recarregar={aoSalvar}
        />
      )}
    </>
  )
}
