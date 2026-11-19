import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { chip } from '../lib/utils'
import Ic from '../components/Icon'
import Table from '../components/Table'
import { PageBar, Seg } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { configuracoes } from '../services/pessoas'
import { DIFICULDADES, formatarHoras } from '../lib/ocupacao'

const ABAS = [
  ['areas', 'Áreas'],
  ['cargos', 'Cargos'],
  ['senioridades', 'Senioridades'],
  ['dificuldade', 'Dificuldade'],
]
const LIDERA = [
  ['false', 'Não'],
  ['true', 'Sim'],
]
const SIM_NAO = [
  ['true', 'Ativo'],
  ['false', 'Inativo'],
]

/** Chave e busca da tela; o menu (src/lib/antecipar.js) usa as mesmas para buscar antes do clique. */
export function dadosDaTela() {
  return {
    chave: 'configuracoes',
    carregar: async () => {
      const [areas, cargos, senioridades, horas] = await Promise.all([
        configuracoes.areas(),
        configuracoes.cargos(),
        configuracoes.senioridades(),
        configuracoes.horasDificuldade(),
      ])
      return { areas, cargos, senioridades, horas }
    },
  }
}

/** ADR-007: listas configuráveis (áreas, cargos, senioridades). Só diretores editam. */
export default function Configuracoes() {
  const { form, refresh } = useApp()
  const [aba, setAba] = useState('areas')
  const tela = dadosDaTela()
  const { dados, carregando, recarregar } = useCarregar(tela.carregar, [], { chave: tela.chave })

  if (!dados)
    return (
      <>
        <PageBar title="Configurações" sub={carregando ? '' : 'Não foi possível carregar.'} />
        {carregando && <Esqueleto />}
      </>
    )

  const { areas, cargos, senioridades, horas } = dados
  const nomeArea = codigo => areas.find(a => a.codigo === codigo)?.nome || '—'

  const salvar = async (acao, sucesso) => {
    try {
      await acao()
      alerts.toastSuccess(sucesso)
      await recarregar()
      if (aba === 'senioridades') refresh().catch(() => {})
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }

  const editarArea = a =>
    form(
      a ? 'Editar área' : 'Nova área',
      [
        { k: 'nome', l: 'Nome' },
        {
          k: 'codigoAreaPai',
          l: 'Área superior',
          o: [['', 'Nenhuma'], ...areas.filter(x => x.codigo !== a?.codigo).map(x => [x.codigo, x.nome])],
          opt: true,
        },
        { k: 'ativa', l: 'Situação', o: SIM_NAO, h: 'Áreas inativas somem das opções, mas o histórico das pessoas continua.' },
      ],
      { nome: a?.nome || '', codigoAreaPai: a?.codigoAreaPai || '', ativa: String(a?.ativa ?? true) },
      v =>
        salvar(
          () => configuracoes.salvarArea(a?.codigo, { nome: v.nome, codigoAreaPai: v.codigoAreaPai || null, ativa: v.ativa === 'true' }),
          'Área salva',
        ),
    )

  const editarCargo = c =>
    form(
      c ? 'Editar cargo' : 'Novo cargo',
      [
        { k: 'nome', l: 'Nome' },
        { k: 'ativo', l: 'Situação', o: SIM_NAO },
        {
          k: 'lideraArea',
          l: 'Lidera a área',
          o: LIDERA,
          h: 'Para gerentes e diretores de área: quem tem este cargo numa área lidera a área e as que estão abaixo dela.',
        },
        {
          k: 'tetoSemanalHoras',
          l: 'Teto semanal (h)',
          t: 'number',
          min: 1,
          max: 40,
          step: 1,
          h: 'Horas por semana que o cargo comporta, de 1 a 40. Base da ocupação das pessoas.',
        },
      ],
      {
        nome: c?.nome || '',
        ativo: String(c?.ativo ?? true),
        lideraArea: String(c?.lideraArea ?? false),
        tetoSemanalHoras: c?.tetoSemanalHoras ?? 10,
      },
      v =>
        salvar(
          () =>
            configuracoes.salvarCargo(c?.codigo, {
              nome: v.nome,
              ativo: v.ativo === 'true',
              lideraArea: v.lideraArea === 'true',
              tetoSemanalHoras: Number(v.tetoSemanalHoras),
            }),
          'Cargo salvo',
        ),
    )

  const editarHoras = () =>
    form(
      'Horas por dificuldade',
      DIFICULDADES.map(([k, l]) => ({ k, l: `${l} (h)`, t: 'number', min: 0.5, max: 40, step: 0.5 })),
      Object.fromEntries(DIFICULDADES.map(([k]) => [k, horas[k]])),
      v => {
        const novas = Object.fromEntries(DIFICULDADES.map(([k]) => [k, Number(v[k])]))
        return salvar(() => configuracoes.salvarHorasDificuldade(novas), 'Horas salvas')
      },
    )

  const editarSenioridade = s =>
    form(
      s ? 'Editar senioridade' : 'Nova senioridade',
      [
        { k: 'nome', l: 'Nome' },
        { k: 'ordem', l: 'Ordem na escada', t: 'number', h: '1 para o nível inicial; números maiores para níveis acima.' },
      ],
      { nome: s?.nome || '', ordem: s?.ordem ?? senioridades.length + 1 },
      v => salvar(() => configuracoes.salvarSenioridade(s?.codigo, { nome: v.nome, ordem: Number(v.ordem) }), 'Senioridade salva'),
    )

  const situacao = ativo => <span className={chip(ativo ? 'ok' : 'er')}>{ativo ? 'Ativo' : 'Inativo'}</span>
  const editarBotao = fn => (
    <button className="btn btn-g btn-sm" onClick={fn}>
      <Ic k="edit" />
      Editar
    </button>
  )

  const telas = {
    areas: {
      novo: () => editarArea(),
      linhas: areas,
      colunas: [
        { k: 'nome', l: 'Nome' },
        { k: 'sup', l: 'Área superior', get: a => (a.codigoAreaPai ? nomeArea(a.codigoAreaPai) : '—') },
        { k: 'st', l: 'Situação', filter: 1, get: a => (a.ativa ? 'Ativo' : 'Inativo'), render: a => situacao(a.ativa) },
        { l: 'Ações', render: a => editarBotao(() => editarArea(a)) },
      ],
    },
    cargos: {
      novo: () => editarCargo(),
      linhas: cargos,
      colunas: [
        { k: 'nome', l: 'Nome' },
        { k: 'li', l: 'Lidera a área', filter: 1, get: c => (c.lideraArea ? 'Sim' : 'Não') },
        { k: 'teto', l: 'Teto semanal', get: c => (c.tetoSemanalHoras == null ? '—' : formatarHoras(c.tetoSemanalHoras)) },
        { k: 'st', l: 'Situação', filter: 1, get: c => (c.ativo ? 'Ativo' : 'Inativo'), render: c => situacao(c.ativo) },
        { l: 'Ações', render: c => editarBotao(() => editarCargo(c)) },
      ],
    },
    senioridades: {
      novo: () => editarSenioridade(),
      linhas: [...senioridades].sort((a, b) => a.ordem - b.ordem),
      colunas: [
        { k: 'ordem', l: 'Ordem' },
        { k: 'nome', l: 'Nome' },
        { l: 'Ações', render: s => editarBotao(() => editarSenioridade(s)) },
      ],
    },
  }
  telas.dificuldade = {
    novo: editarHoras,
    rotulo: 'Editar horas',
    linhas: DIFICULDADES.map(([k, l]) => ({ codigo: k, nome: l, horas: horas[k] })),
    colunas: [
      { k: 'nome', l: 'Dificuldade' },
      { k: 'horas', l: 'Horas estimadas', get: r => formatarHoras(r.horas) },
    ],
  }
  const atual = telas[aba]

  return (
    <>
      <PageBar
        title="Configurações"
        sub="Listas do cadastro de pessoas, horas por dificuldade das tarefas e teto semanal de cada cargo. Valor-hora das senioridades fica para quando as taxas forem definidas."
      >
        <button className="btn btn-primary" onClick={atual.novo}>
          <Ic k={aba === 'dificuldade' ? 'edit' : 'plus'} />
          {atual.rotulo || 'Novo item'}
        </button>
      </PageBar>
      <div className="mb-3">
        <Seg items={ABAS} value={aba} onChange={setAba} />
      </div>
      <Table
        key={aba}
        cols={atual.colunas}
        rows={atual.linhas.map(x => ({ ...x, id: x.codigo }))}
        vazio="Nenhum item nesta lista. Use “Novo item”."
      />
    </>
  )
}
