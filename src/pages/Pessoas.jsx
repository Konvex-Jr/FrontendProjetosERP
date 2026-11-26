import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { consumir } from '../lib/atalho'
import { chip, fd, iso } from '../lib/utils'
import Ic from '../components/Icon'
import Table from '../components/Table'
import ActionMenu from '../components/ActionMenu'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import Avatar from '../components/Avatar'
import { configuracoes, pessoas, rotuloStatus, STATUS_PESSOA } from '../services/pessoas'
import {
  corpoEdicaoPessoa,
  corpoNovaPessoa,
  erroCadastro,
  opcoesCurso,
  opcoesMudarStatus,
  pedeMotivoSaida,
  podeRedefinirSenha,
} from '../lib/cadastroPessoa'
import { mascararTelefone } from '../lib/pessoaContato'
import { ocupacao } from '../services/ocupacao'
import ChipOcupacao from '../components/ChipOcupacao'

const COR_STATUS = { ativo: 'ok', trainee: '', inativo: 'er' }
const SAIDA = ['inativo']

/** Chave e busca da tela; o menu (src/lib/antecipar.js) usa as mesmas para buscar antes do clique. */
export function dadosDaTela() {
  return {
    chave: 'pessoas',
    carregar: async () => {
      // Ocupação da semana atual é complemento: se falhar, a coluna mostra "—" e a tela abre igual.
      const [lista, senioridades, ocupacoes] = await Promise.all([
        pessoas.listar(),
        configuracoes.senioridades(),
        ocupacao.todas().catch(() => null),
      ])
      return { lista, senioridades, ocupacoes }
    },
  }
}

/** RF-010 a RF-016: cadastro e acompanhamento de pessoas (gestores). */
export default function Pessoas() {
  const { form, go, me, pode, refresh } = useApp()
  const [filtros] = useState(() => consumir('usuarios'))
  const enviandoLink = useRef(false)
  const tela = dadosDaTela()
  const { dados, carregando, recarregar } = useCarregar(tela.carregar, [], { chave: tela.chave })

  if (!dados)
    return (
      <>
        <PageBar title="Pessoas" sub={carregando ? '' : 'Não foi possível carregar.'} />
        {carregando && <Esqueleto />}
      </>
    )

  const { lista, senioridades, ocupacoes } = dados
  const percentuais = Object.fromEntries((ocupacoes || []).map(o => [o.codigoUsuario, o.percentual]))
  // Sessão 31a: a API diz por pessoa se quem olha pode geri-la (pessoas.gerir e cargo abaixo do seu).
  const podeMexer = p => p.podeGerir === true
  const podeConvidar = pode('pessoas.gerir')

  // Depois de salvar: recarrega esta tela e os dados compartilhados (nomes em projetos etc.).
  const executar = async (acao, sucesso) => {
    try {
      await acao()
      alerts.toastSuccess(sucesso)
      await recarregar()
      refresh().catch(() => {})
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }

  const editar = p =>
    form(
      p ? 'Editar pessoa' : 'Nova pessoa',
      [
        { k: 'nome', l: 'Nome' },
        { k: 'email', l: 'E-mail', t: 'email', ...(p ? {} : { h: 'A pessoa recebe neste e-mail um convite para criar a própria senha.' }) },
        {
          k: 'status',
          l: 'Status',
          o: STATUS_PESSOA.slice(0, 2),
          s: () => !p,
          h: 'Trainee recebe as permissões do conjunto "Trainee" (Configurações → Permissões). Só se entra como trainee no cadastro. O que cada pessoa pode vem do cargo, lançado nas Áreas do perfil.',
        },
        { k: 'codigoSenioridade', l: 'Senioridade', o: senioridades.map(s => [s.codigo, s.nome]) },
        { k: 'dataEntrada', l: 'Data de entrada na EJ', t: 'date', opt: true },
        // Fim do período de trainee: só a gestão edita, e só de quem já foi trainee (quem é trainee ainda não terminou).
        {
          k: 'fimTrainee',
          l: 'Fim do período de trainee',
          t: 'date',
          opt: true,
          max: iso(new Date()),
          s: () => Boolean(p) && p.status !== 'trainee',
          h: 'Gravado ao passar de Trainee para Ativo; corrija aqui se precisar.',
        },
        { k: 'curso', l: 'Curso', o: opcoesCurso(p) },
        {
          k: 'telefone',
          l: 'Telefone',
          campo: (v, set) => (
            <label className="form-label w-100 mb-0">
              Telefone
              <input
                className="form-control mt-1"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(00) 00000-0000"
                value={v.telefone || ''}
                onChange={e => set('telefone', mascararTelefone(e.target.value))}
              />
            </label>
          ),
        },
        { k: 'emailPessoal', l: 'E-mail pessoal', t: 'email', opt: true, maxLength: 254 },
      ],
      p
        ? {
            nome: p.nome,
            email: p.email,
            codigoSenioridade: p.senioridade?.codigo || senioridades[0]?.codigo,
            dataEntrada: p.dataEntrada?.slice(0, 10) || '',
            fimTrainee: p.fimTrainee?.slice(0, 10) || '',
            curso: p.curso || '',
            telefone: p.telefone || '',
            emailPessoal: p.emailPessoal || '',
          }
        : {
            status: 'ativo',
            codigoSenioridade: senioridades[0]?.codigo,
            dataEntrada: '',
            curso: '',
            telefone: '',
            emailPessoal: '',
          },
      async v => {
        const erro = erroCadastro(v, p)
        if (erro) {
          alerts.error(erro.titulo, erro.texto)
          return false
        }
        if (p) return executar(() => pessoas.editar(p.codigo, corpoEdicaoPessoa(v, p)), 'Pessoa atualizada')
        // A API cria a pessoa sem senha e manda o convite; se o e-mail não sair, a gestão reenvia pela lista.
        // O aviso vem depois do "Pessoa cadastrada" do executar: um toast novo substitui o anterior.
        let criada
        const resultado = await executar(async () => {
          criada = await pessoas.criar(corpoNovaPessoa(v))
        }, 'Pessoa cadastrada')
        if (criada?.conviteEnviado === false) {
          alerts.toastWarning('Convite não enviado', 'A pessoa foi cadastrada, mas o e-mail não saiu. Use "Reenviar convite".')
        }
        return resultado
      },
    )

  const mudarStatus = p =>
    form(
      `Status de ${p.nome}`,
      [
        { k: 'status', l: 'Status', o: opcoesMudarStatus(p.status) },
        {
          k: 'dataSaida',
          l: 'Data de saída',
          t: 'date',
          opt: true,
          s: v => SAIDA.includes(v.status),
          h: 'Encerra as participações em projetos abertos. A pessoa e o histórico continuam registrados.',
        },
        {
          k: 'motivoSaida',
          l: 'Motivo da saída',
          t: 'textarea',
          maxLength: 500,
          s: v => pedeMotivoSaida(p.status, v.status),
          h: 'Obrigatório. Aparece no perfil da pessoa (até 500 caracteres).',
        },
      ],
      { status: p.status, dataSaida: '', motivoSaida: '' },
      async v => {
        if (v.status === p.status) return
        if (
          SAIDA.includes(v.status) &&
          !(await alerts.confirm({
            title: `Marcar como ${rotuloStatus(v.status)}?`,
            text: `${p.nome} perde o acesso e sai dos projetos em andamento.`,
            confirmText: 'Confirmar',
            danger: true,
          }))
        )
          return false
        return executar(
          () =>
            pessoas.alterarStatus(p.codigo, v.status, v.dataSaida, pedeMotivoSaida(p.status, v.status) ? v.motivoSaida.trim() : undefined),
          'Status atualizado',
        )
      },
    )

  // Convite pendente = reenvia o convite; com senha = link de redefinição. A gestão nunca vê o link nem a senha.
  const enviarLink = async p => {
    if (enviandoLink.current) return
    enviandoLink.current = true
    try {
      const { enviado, tipo } = await pessoas.enviarLinkSenha(p.codigo)
      const oQue = tipo === 'convite' ? 'Convite' : 'Link de redefinição'
      if (enviado) alerts.toastSuccess(`${oQue} enviado`, `Enviado para ${p.email}.`)
      else alerts.toastWarning(`${oQue} não enviado`, 'O e-mail não saiu. Tente de novo em instantes; se continuar, avise a gestão.')
      await recarregar()
    } catch (error) {
      alerts.error('Não foi possível enviar o link', error.message)
    } finally {
      enviandoLink.current = false
    }
  }

  const linhas = lista.map(p => ({ ...p, id: p.codigo }))
  const colunas = [
    {
      k: 'nome',
      l: 'Nome',
      render: p => (
        <button type="button" className="btn-nome" onClick={() => go('perfil', p.codigo)}>
          <Avatar pessoa={p} className="av-lista" />
          {p.nome}
        </button>
      ),
    },
    { k: 'email', l: 'E-mail' },
    // Áreas atuais (períodos em aberto) e o cargo de cada uma, em duas colunas de texto simples (25/11),
    // uma área por linha. O filtro olha só a própria área (não as de baixo).
    {
      k: 'ar',
      l: 'Área',
      fl: 'Área',
      filter: 1,
      get: p => (p.areas || []).map(a => a.area.nome).join(', ') || '—',
      vals: p => (p.areas?.length ? p.areas.map(a => a.area.nome) : ['—']),
      render: p =>
        p.areas?.length ? (
          <span className="areas-l">
            {p.areas.map(a => (
              <span key={a.codigoPeriodo}>{a.area.nome}</span>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
    {
      k: 'cg',
      l: 'Cargo',
      get: p => (p.areas || []).map(a => a.cargo?.nome || '—').join(', ') || '—',
      render: p =>
        p.areas?.length ? (
          <span className="areas-l">
            {p.areas.map(a => (
              <span key={a.codigoPeriodo}>{a.cargo?.nome || '—'}</span>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
    { k: 'cu', l: 'Curso', filter: 1, get: p => p.curso || 'Curso não informado' },
    { k: 'sn', l: 'Senioridade', filter: 1, get: p => p.senioridade?.nome || '—' },
    { k: 'cg', l: 'Cargo', filter: 1, get: p => (p.areas || []).find(a => a.cargo)?.cargo?.nome || 'Sem cargo' },
    {
      k: 'st',
      l: 'Status',
      filter: 1,
      get: p => rotuloStatus(p.status),
      render: p => (
        <span className="selos-area">
          <span className={chip(COR_STATUS[p.status])}>{rotuloStatus(p.status)}</span>
          {p.convitePendente && <span className={chip('wa')}>Convite pendente</span>}
        </span>
      ),
    },
    {
      k: 'oc',
      l: 'Ocupação',
      get: p => percentuais[p.codigo] ?? -1,
      render: p => <ChipOcupacao percentual={percentuais[p.codigo]} />,
    },
    { k: 'en', l: 'Entrada', get: p => p.dataEntrada || '', render: p => fd(p.dataEntrada) },
    {
      l: 'Ações',
      render: p => (
        <ActionMenu
          items={[
            ['open', 'Ver perfil', () => go('perfil', p.codigo)],
            ...(podeMexer(p)
              ? [
                  ['edit', 'Editar', () => editar(p)],
                  ...(p.codigo !== me ? [['userok', 'Mudar status', () => mudarStatus(p)]] : []),
                  ...(podeRedefinirSenha(p.status) && p.codigo !== me
                    ? [['key', p.convitePendente ? 'Reenviar convite' : 'Enviar link de redefinição', () => enviarLink(p)]]
                    : []),
                ]
              : []),
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageBar title="Pessoas">
        {podeConvidar && (
          <button className="btn btn-primary" onClick={() => editar()} disabled={!senioridades.length}>
            <Ic k="plus" />
            Nova pessoa
          </button>
        )}
      </PageBar>
      {!senioridades.length && <p className="text-mu">Cadastre uma senioridade em Configurações antes de criar pessoas.</p>}
      <Table
        cols={colunas}
        rows={linhas}
        filtros={filtros}
        itens={['pessoa', 'pessoas']}
        vazio="Ninguém cadastrado ainda. Use “Nova pessoa”."
      />
    </>
  )
}
