import { useApp } from '../context/AppContext'
import { chip, nid } from '../lib/utils'
import Ic from '../components/Icon'
import Table from '../components/Table'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'

const PERFIS_PADRAO = ['diretor', 'gerente', 'membro']

const SENIORIDADES_PADRAO = {
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
}

export default function Usuarios() {
  const { D, up, form } = useApp()

  const perfis = D?.c?.perfis ?? PERFIS_PADRAO
  const senioridades = D?.c?.senioridades ?? SENIORIDADES_PADRAO
  const usuarios = D?.u ?? []

  const editar = usuario =>
    form(
      usuario ? 'Editar usuário' : 'Novo usuário',
      [
        { k: 'nome', l: 'Nome' },
        { k: 'email', l: 'E-mail', t: 'email' },
        {
          k: 'senha',
          l: 'Senha inicial',
          t: 'password',
          s: () => !usuario,
        },
        {
          k: 'perfil',
          l: 'Perfil',
          o: perfis.map(perfil => [perfil, perfil]),
        },
        {
          k: 'senioridade',
          l: 'Senioridade',
          o: Object.entries(senioridades),
          s: valores => valores.perfil === 'membro',
        },
      ],
      usuario || {
        perfil: 'membro',
        senioridade: 'junior',
      },
      valores => {
        const dados = {
          ...valores,
          senioridade:
            valores.perfil === 'membro'
              ? valores.senioridade || 'junior'
              : undefined,
        }

        up('u', atuais =>
          usuario
            ? atuais.map(item =>
              item.id === usuario.id
                ? { ...item, ...dados }
                : item
            )
            : [
              ...atuais,
              {
                id: nid(atuais),
                ativo: true,
                ...dados,
              },
            ]
        )
      }
    )

  const alterarStatus = async (usuario, alteracoes) => {
    if (alteracoes.ativo === false && usuario.ativo) {
      const confirmado = await alerts.confirm({
        title: 'Inativar usuário?',
        text: `${usuario.nome} perderá o acesso ao sistema.`,
        confirmText: 'Inativar',
        danger: true,
      })

      if (!confirmado) return
    }

    if (alteracoes.ativo === true && !usuario.ativo) {
      await alerts.info(
        'Reativação indisponível',
        'A API atual não disponibiliza uma rota para reativar usuários inativos.'
      )
      return
    }

    const alteracoesFinais =
      alteracoes.perfil === 'membro' && !usuario.senioridade
        ? { ...alteracoes, senioridade: 'junior' }
        : alteracoes

    up('u', atuais =>
      atuais.map(item =>
        item.id === usuario.id
          ? { ...item, ...alteracoesFinais }
          : item
      )
    )
  }

  const colunas = [
    {
      k: 'nome',
      l: 'Nome',
    },
    {
      k: 'email',
      l: 'E-mail',
    },
    {
      k: 'perfil',
      l: 'Perfil',
      filter: 1,
      render: usuario => (
        <select
          className="form-select form-select-sm auto"
          aria-label={`Perfil de ${usuario.nome}`}
          value={usuario.perfil}
          onChange={evento =>
            alterarStatus(usuario, {
              perfil: evento.target.value,
            })
          }
        >
          {perfis.map(perfil => (
            <option key={perfil} value={perfil}>
              {perfil}
            </option>
          ))}
        </select>
      ),
    },
    {
      k: 'sn',
      l: 'Senioridade',
      filter: 1,
      get: usuario =>
        usuario.perfil === 'membro'
          ? senioridades[usuario.senioridade] || '—'
          : '—',
      render: usuario =>
        usuario.perfil === 'membro' ? (
          <select
            className="form-select form-select-sm auto"
            aria-label={`Senioridade de ${usuario.nome}`}
            value={usuario.senioridade || 'junior'}
            onChange={evento =>
              alterarStatus(usuario, {
                senioridade: evento.target.value,
              })
            }
          >
            {Object.entries(senioridades).map(([chave, nome]) => (
              <option key={chave} value={chave}>
                {nome}
              </option>
            ))}
          </select>
        ) : (
          <small>—</small>
        ),
    },
    {
      k: 'st',
      l: 'Status',
      filter: 1,
      get: usuario => (usuario.ativo ? 'Ativo' : 'Inativo'),
      render: usuario => (
        <span className={chip(usuario.ativo ? 'ok' : 'er')}>
          {usuario.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      l: 'Ações',
      render: usuario => (
        <div className="d-flex gap-2">
          <button
            className="btn btn-g btn-sm"
            onClick={() => editar(usuario)}
          >
            Editar
          </button>

          {usuario.ativo && (
            <button
              className="btn btn-g btn-sm"
              onClick={() =>
                alterarStatus(usuario, { ativo: false })
              }
            >
              Inativar
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageBar title="Usuários">
        <button
          className="btn btn-primary"
          onClick={() => editar()}
        >
          <Ic k="plus" />
          Novo usuário
        </button>
      </PageBar>

      <Table cols={colunas} rows={usuarios} />
    </>
  )
}