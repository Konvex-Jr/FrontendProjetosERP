import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { consumir } from '../lib/atalho'
import { chip, fd } from '../lib/utils'
import Ic from '../components/Icon'
import Table from '../components/Table'
import ActionMenu from '../components/ActionMenu'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { configuracoes, pessoas, rotuloStatus, STATUS_PESSOA, tecnologiasDe } from '../services/pessoas'
import { corpoNovaPessoa, opcoesMudarStatus, podeRedefinirSenha } from '../lib/cadastroPessoa'

const COR_STATUS = { ativo: 'ok', trainee: '', alumni: 'wa', inativo: 'er' }
const PERFIS = [
  ['membro', 'Membro'],
  ['gerente', 'Gerente'],
  ['diretor', 'Diretor'],
]
const SAIDA = ['alumni', 'inativo']

/** Chave e busca da tela; o menu (src/lib/antecipar.js) usa as mesmas para buscar antes do clique. */
export function dadosDaTela() {
  return {
    chave: 'pessoas',
    carregar: async () => {
      const [lista, areas, cargos, senioridades] = await Promise.all([
        pessoas.listar(),
        configuracoes.areas(),
        configuracoes.cargos(),
        configuracoes.senioridades(),
      ])
      return { lista, areas, cargos, senioridades }
    },
  }
}

/** RF-010 a RF-016: cadastro e acompanhamento de pessoas (gestores). */
export default function Pessoas() {
  const { form, go, me, pode, refresh } = useApp()
  const [filtros] = useState(() => consumir('usuarios'))
  const tela = dadosDaTela()
  const { dados, carregando, recarregar } = useCarregar(tela.carregar, [], { chave: tela.chave })

  if (!dados)
    return (
      <>
        <PageBar title="Pessoas" sub={carregando ? '' : 'Não foi possível carregar.'} />
        {carregando && <Esqueleto />}
      </>
    )

  const { lista, areas, cargos, senioridades } = dados
  const gereDiretores = pode('pessoas.gerirDiretores')
  const perfis = gereDiretores ? PERFIS : PERFIS.filter(([k]) => k !== 'diretor')
  const opcoes = (itens, ativo) => [['', '—'], ...itens.filter(ativo).map(i => [i.codigo, i.nome])]
  const podeMexer = p => gereDiretores || p.perfil !== 'diretor'

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
        { k: 'email', l: 'E-mail', t: 'email' },
        {
          k: 'status',
          l: 'Status',
          o: STATUS_PESSOA.slice(0, 2),
          s: () => !p,
          h: 'Trainee entra no sistema com acesso de membro e não lidera projetos. Só se entra como trainee no cadastro.',
        },
        {
          k: 'senha',
          l: 'Senha inicial',
          t: 'password',
          s: () => !p,
          h: 'Mínimo de 8 caracteres. A pessoa pode trocar depois em Meu perfil.',
        },
        // Trainee é sempre membro: o campo some e o corpo vai com perfil membro (lib/cadastroPessoa.js).
        { k: 'perfil', l: 'Perfil de acesso', o: perfis, s: v => (p ? p.status : v.status) !== 'trainee' },
        { k: 'codigoSenioridade', l: 'Senioridade', o: senioridades.map(s => [s.codigo, s.nome]) },
        { k: 'codigoArea', l: 'Área', o: opcoes(areas, a => a.ativa || a.codigo === p?.area?.codigo), opt: true },
        { k: 'codigoCargo', l: 'Cargo', o: opcoes(cargos, c => c.ativo || c.codigo === p?.cargo?.codigo), opt: true },
        { k: 'dataEntrada', l: 'Data de entrada na EJ', t: 'date', opt: true },
      ],
      p
        ? {
            nome: p.nome,
            email: p.email,
            perfil: p.perfil,
            codigoSenioridade: p.senioridade?.codigo || senioridades[0]?.codigo,
            codigoArea: p.area?.codigo || '',
            codigoCargo: p.cargo?.codigo || '',
            dataEntrada: p.dataEntrada?.slice(0, 10) || '',
          }
        : {
            status: 'ativo',
            perfil: 'membro',
            codigoSenioridade: senioridades[0]?.codigo,
            codigoArea: '',
            codigoCargo: '',
            dataEntrada: '',
          },
      v => {
        if (p) {
          const { senha: _senha, status: _status, dataEntrada, ...resto } = v
          return executar(() => pessoas.editar(p.codigo, { ...resto, ...(dataEntrada ? { dataEntrada } : {}) }), 'Pessoa atualizada')
        }
        // Ativo e trainee entram no sistema com a senha que a gestão digitou.
        return executar(() => pessoas.criar(corpoNovaPessoa(v)), 'Pessoa cadastrada')
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
      ],
      { status: p.status, dataSaida: '' },
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
        return executar(() => pessoas.alterarStatus(p.codigo, v.status, v.dataSaida), 'Status atualizado')
      },
    )

  const redefinirSenha = p =>
    form(
      `Nova senha de ${p.nome}`,
      [{ k: 'novaSenha', l: 'Nova senha', t: 'password', h: 'Mínimo de 8 caracteres. Passe para a pessoa por um canal seguro.' }],
      {},
      v => executar(() => pessoas.redefinirSenha(p.codigo, v.novaSenha), 'Senha redefinida'),
    )

  const linhas = lista.map(p => ({ ...p, id: p.codigo }))
  const colunas = [
    {
      k: 'nome',
      l: 'Nome',
      render: p => (
        <a role="button" className="fw-semibold" onClick={() => go('perfil', p.codigo)}>
          {p.nome}
        </a>
      ),
    },
    { k: 'email', l: 'E-mail' },
    { k: 'ar', l: 'Área', filter: 1, get: p => p.area?.nome || '—' },
    { k: 'cg', l: 'Cargo', filter: 1, get: p => p.cargo?.nome || '—' },
    { k: 'sn', l: 'Senioridade', filter: 1, get: p => p.senioridade?.nome || '—' },
    { k: 'pf', l: 'Perfil', filter: 1, get: p => PERFIS.find(([k]) => k === p.perfil)?.[1] || p.perfil },
    {
      k: 'st',
      l: 'Status',
      filter: 1,
      get: p => rotuloStatus(p.status),
      render: p => <span className={chip(COR_STATUS[p.status])}>{rotuloStatus(p.status)}</span>,
    },
    // Tecnologias entram na busca: digitar "React" acha quem domina (sessão 13).
    { k: 'tec', l: 'Tecnologias', get: p => tecnologiasDe(p).join(', ') || '—' },
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
                  ...(podeRedefinirSenha(p.status) && p.codigo !== me ? [['key', 'Redefinir senha', () => redefinirSenha(p)]] : []),
                ]
              : []),
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageBar title="Pessoas" sub="Quem está e quem já passou pela Konvex. Sair da EJ preserva o histórico.">
        <button className="btn btn-primary" onClick={() => editar()} disabled={!senioridades.length}>
          <Ic k="plus" />
          Nova pessoa
        </button>
      </PageBar>
      {!senioridades.length && <p className="text-mu">Cadastre uma senioridade em Configurações antes de criar pessoas.</p>}
      <Table cols={colunas} rows={linhas} filtros={filtros} vazio="Ninguém cadastrado ainda. Use “Nova pessoa”." />
    </>
  )
}
