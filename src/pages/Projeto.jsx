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
import { acoesTarefa, papelNasTarefas, quadroDesatualizado, tarefas } from '../services/tarefas'
import { ErroAcessoParcial, gravarProjeto } from '../lib/gravarProjeto'
import { carregarProjeto } from '../lib/carregarProjeto'
import Table from '../components/Table'
import { camposProjeto, valoresProjeto } from './Projetos'
import { SeloSigiloso, StatusProjeto } from '../components/SeloProjeto'
import { ItensDoProjeto } from './Biblioteca'

const ABAS = [
  ['tarefas', 'Tarefas'],
  ['geral', 'Visão geral'],
  ['equipe', 'Equipe'],
  ['biblioteca', 'Biblioteca'],
]

const dia = s => (s ? String(s).slice(0, 10) : '')

/** Gerente fora da lista do projeto sigiloso: só nome, status, datas, contagens e equipe com alocação. */
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
          { k: 'a', l: 'Alocação', get: x => x.alocacao, render: x => x.alocacao + '%' },
          { k: 'e', l: 'Entrada', get: x => dia(x.dataEntrada), render: x => fm(dia(x.dataEntrada)) },
          { k: 's', l: 'Saída', get: x => dia(x.dataSaida), render: x => (x.dataSaida ? fm(dia(x.dataSaida)) : 'Em andamento') },
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
  const { projeto, todos, gente, areas } = dados
  if (projeto.resumo) return <ResumoSigiloso projeto={projeto} voltar={voltar} />
  // Depois de salvar: recarrega o projeto e os dados compartilhados (tarefas, avatares, painel).
  const aoSalvar = async () => {
    await recarregar()
    refresh().catch(() => {})
  }
  const p = { id: projeto.codigo, nome: projeto.nome, membros: projeto.participacoes.filter(x => !x.dataSaida).map(x => x.usuario.codigo) }
  const papel = papelNasTarefas({ me, gestao: pode('tarefas.gerirTodas'), projeto })
  const T = dados.tarefas,
    h = hj(D)

  const add = colunaId =>
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
        ...(colunaId ? { colunaId } : {}),
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

  const kanban = () => (
    <>
      {papel.organiza && (
        <div className="mb-2">
          <button className="btn btn-g" onClick={() => setEditandoColunas(true)}>
            <Ic k="edit" />
            Editar colunas
          </button>
        </div>
      )}
      <KanbanEtapas
        D={D}
        T={T}
        colunas={projeto.colunas.map(adaptColuna)}
        papelDe={() => papel}
        acoes={acoes}
        abrir={setTk}
        adicionar={papel.participa ? add : null}
      />
    </>
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
    form(
      'Editar projeto',
      camposProjeto({ lista: gente, areas, podeGerirAcesso: projeto.podeGerirAcesso }),
      valoresProjeto(projeto, gente),
      async v => {
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
    ['Período', fm(dia(projeto.dataInicio)) + ' a ' + fm(dia(projeto.dataFim))],
    ['Prioridade', rotuloPrioridade(projeto.prioridade)],
    ['Responsável', projeto.responsavel?.nome || '—'],
    ['Líder', projeto.lider?.nome || '—'],
    ['Área', projeto.area?.nome || '—'],
    ['Equipe', <Av key="equipe" D={D} ids={p.membros} />],
    ...(projeto.sigiloso
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
          {/* Um filho só depois do título: o CSS do celular (.cab) conta com isso. */}
          <span className="d-flex flex-wrap gap-1">
            <StatusProjeto s={projeto.status} />
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
      {aba == 'tarefas' && (pt == 'kanban' ? kanban() : gantt())}
      {aba == 'geral' && geral()}
      {aba == 'biblioteca' && temBiblioteca && <ItensDoProjeto projeto={projeto} />}
      {aba == 'equipe' && <EquipeProjeto projeto={projeto} todos={todos} gente={gente} gestor={gestor} aoSalvar={aoSalvar} />}
      {editandoColunas && (
        <ColunasModal
          colunas={projeto.colunas.map(adaptColuna)}
          tarefas={T}
          aoSalvar={gravarColunas}
          aoFechar={() => setEditandoColunas(false)}
        />
      )}
      {tk && T.find(x => x.id == tk) && (
        <TaskModal
          D={D}
          papel={papel}
          me={me}
          salvar={(antes, depois) => acoes.salvar(antes, depois, 'Tarefa salva')}
          t={T.find(x => x.id == tk)}
          colunas={projeto.colunas.map(adaptColuna)}
          mover={acoes.mover}
          p={p}
          T={T}
          close={() => setTk(null)}
          del={acoes.del}
          tog={acoes.tog}
          recarregar={aoSalvar}
        />
      )}
    </>
  )
}
