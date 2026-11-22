import { useApp } from '../context/AppContext'
import { chip, fd } from '../lib/utils'
import Ic from './Icon'
import Table from './Table'
import ActionMenu from './ActionMenu'
import alerts from '../lib/alerts'
import { equipe, projetos } from '../services/projetos'
import { ocupacao } from '../services/ocupacao'
import useCarregar from '../lib/useCarregar'
import ChipOcupacao from './ChipOcupacao'
import { rotuloStatus } from '../services/pessoas'
import { rotuloComCarga } from '../lib/alocacao'

/**
 * Aba Equipe (RF-022, PR-06): função, responsabilidades, ocupação da semana e histórico.
 */
export default function EquipeProjeto({ projeto, gente, gestor, aoSalvar }) {
  const { form, go } = useApp()
  // Ocupação da semana atual; se a chamada falhar, a coluna mostra "—" e o resto da aba segue.
  const { dados: ocupacoes } = useCarregar(() => ocupacao.todas().catch(() => null), [], {
    chave: 'ocupacao:todas',
  })
  const percentuais = Object.fromEntries((ocupacoes || []).map(o => [o.codigoUsuario, o.percentual]))
  const ativas = projeto.participacoes.filter(p => !p.dataSaida).map(p => ({ ...p, id: p.codigo }))
  const encerradas = projeto.participacoes.filter(p => p.dataSaida).map(p => ({ ...p, id: p.codigo }))

  const salvar = async (acao, sucesso) => {
    try {
      await acao()
      alerts.toastSuccess(sucesso)
      await aoSalvar()
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }

  const camposComuns = [
    { k: 'funcao', l: 'Função no projeto', opt: true, h: 'Ex.: Gerente de projeto, Desenvolvedor, Consultor.' },
    { k: 'responsabilidades', l: 'Responsabilidades', t: 'textarea', opt: true },
  ]

  const adicionar = () => {
    const dentro = new Set(ativas.map(p => p.usuario.codigo))
    const opcoes = gente
      .filter(u => u.naEj && !dentro.has(u.codigo))
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(u => [u.codigo, rotuloComCarga(`${u.nome}${u.status === 'trainee' ? ' · Trainee' : ''}`, percentuais[u.codigo])])
    if (!opcoes.length) return alerts.info('Ninguém disponível', 'Todas as pessoas Ativas e Trainees já estão na equipe.')
    form(
      'Adicionar à equipe',
      [
        { k: 'codigoUsuario', l: 'Pessoa', o: opcoes, h: 'Ao lado do nome, a ocupação da semana atual.' },
        ...camposComuns,
        { k: 'dataEntrada', l: 'Entrada no projeto', t: 'date', opt: true, h: 'Vazio = hoje.' },
      ],
      { codigoUsuario: opcoes[0][0], dataEntrada: '' },
      v => salvar(() => equipe.adicionar(projeto.codigo, v), 'Pessoa adicionada'),
    )
  }

  const editar = p =>
    form(
      `Editar participação de ${p.usuario.nome}`,
      camposComuns,
      { funcao: p.funcao || '', responsabilidades: p.responsabilidades || '' },
      v => salvar(() => equipe.editar(projeto.codigo, p.codigo, v), 'Participação atualizada'),
    )

  const encerrar = p =>
    form(
      `Tirar ${p.usuario.nome} da equipe`,
      [
        {
          k: 'dataSaida',
          l: 'Saída do projeto',
          t: 'date',
          opt: true,
          h: 'Vazio = hoje. A participação continua no histórico do projeto.',
        },
      ],
      { dataSaida: '' },
      v => salvar(() => equipe.encerrar(projeto.codigo, p.codigo, v.dataSaida), 'Participação encerrada'),
    )

  // Líder (sessão 8b): organiza as tarefas do projeto. Só a gestão escolhe.
  const codigoLider = projeto.lider?.codigo
  const ehLider = p => p.usuario.codigo === codigoLider
  const definirLider = p =>
    salvar(
      () => projetos.definirLider(projeto.codigo, ehLider(p) ? null : p.usuario.codigo),
      ehLider(p) ? 'Projeto ficou sem líder' : `${p.usuario.nome} agora é líder`,
    )

  const pessoa = p => (
    <button className="btn btn-link p-0 text-start" onClick={() => go('perfil', p.usuario.codigo)}>
      {p.usuario.nome}
      {p.usuario.status && p.usuario.status !== 'ativo' ? <small className="ms-1">({rotuloStatus(p.usuario.status)})</small> : null}
      {!p.dataSaida && ehLider(p) && (
        <span className={chip('ok') + ' ms-1'} title="Organiza as tarefas do projeto">
          Líder
        </span>
      )}
    </button>
  )

  const colsAtivas = [
    { k: 'nome', l: 'Pessoa', get: p => p.usuario.nome, render: pessoa },
    { k: 'funcao', l: 'Função', filter: 1, get: p => p.funcao || '—' },
    { k: 'resp', l: 'Responsabilidades', get: p => p.responsabilidades || '—', render: p => <small>{p.responsabilidades || '—'}</small> },
    {
      k: 'ocupacao',
      l: 'Ocupação na semana',
      get: p => percentuais[p.usuario.codigo] ?? -1,
      render: p => <ChipOcupacao percentual={percentuais[p.usuario.codigo]} />,
    },
    { k: 'entrada', l: 'Entrada', get: p => String(p.dataEntrada), render: p => fd(p.dataEntrada) },
    ...(gestor
      ? [
          {
            l: 'Ações',
            render: p => (
              <ActionMenu
                items={[
                  ['edit', 'Editar', () => editar(p)],
                  ['star', ehLider(p) ? 'Tirar liderança' : 'Tornar líder', () => definirLider(p)],
                  ['undo', 'Tirar da equipe', () => encerrar(p), 1],
                ]}
              />
            ),
          },
        ]
      : []),
  ]
  const colsHistorico = [
    { k: 'nome', l: 'Pessoa', get: p => p.usuario.nome, render: pessoa },
    { k: 'funcao', l: 'Função', get: p => p.funcao || '—' },
    { k: 'periodo', l: 'Período', get: p => String(p.dataEntrada), render: p => fd(p.dataEntrada) + ' a ' + fd(p.dataSaida) },
  ]

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <small>
          {ativas.length} {ativas.length === 1 ? 'pessoa' : 'pessoas'} na equipe.
          {gestor && !codigoLider && ativas.length > 0 && ' Sem líder: use o menu de ações para escolher quem organiza as tarefas.'}
        </small>
        {gestor && (
          <button className="btn btn-primary" onClick={adicionar}>
            <Ic k="plus" />
            Adicionar pessoa
          </button>
        )}
      </div>
      <Table
        cols={colsAtivas}
        rows={ativas}
        reiniciarAoIncluir
        vazio={gestor ? 'Ninguém na equipe ainda. Use “Adicionar pessoa”.' : 'Ninguém na equipe atual.'}
      />
      {encerradas.length > 0 && (
        <>
          <h3 className="h6 fw-bold mt-4">Histórico da equipe</h3>
          <Table cols={colsHistorico} rows={encerradas} />
        </>
      )}
    </>
  )
}
