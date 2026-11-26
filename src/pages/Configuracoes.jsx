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
import { DIFICULDADES, formatarHoras, horasPorDia } from '../lib/ocupacao'
import { abasConfiguracoes } from '../lib/permissoes'
import GradePermissoes from '../components/GradePermissoes'

const LIDERA = [
  ['false', 'Não'],
  ['true', 'Sim'],
]
const SIM_NAO = [
  ['true', 'Ativo'],
  ['false', 'Inativo'],
]

/**
 * Chave e busca da tela; o menu (src/lib/antecipar.js) usa as mesmas para buscar antes do clique.
 * A grade de permissões (31a) só é pedida por quem tem `permissoes.gerir`.
 */
export function dadosDaTela(contexto) {
  const veGrade = Boolean(contexto?.pode?.('permissoes.gerir'))
  return {
    chave: `configuracoes:${veGrade ? 'grade' : 'sem-grade'}`,
    carregar: async () => {
      const [areas, cargos, senioridades, horas, grade, classes] = await Promise.all([
        configuracoes.areas(),
        configuracoes.cargos(),
        configuracoes.senioridades(),
        configuracoes.horasDificuldade(),
        veGrade ? configuracoes.permissoes() : null,
        configuracoes.classes(),
      ])
      return { areas, cargos, senioridades, horas, grade, classes }
    },
  }
}

/** ADR-007: listas configuráveis (áreas, cargos, senioridades) e, desde a 31a, a grade de permissões. Cada aba pela sua permissão. */
export default function Configuracoes() {
  const { form, refresh, pode } = useApp()
  const abas = abasConfiguracoes(pode)
  const [escolhida, setAba] = useState(null)
  const aba = abas.some(([k]) => k === escolhida) ? escolhida : abas[0]?.[0]
  const tela = dadosDaTela({ pode })
  const { dados, carregando, recarregar } = useCarregar(tela.carregar, [], { chave: tela.chave })

  if (!dados)
    return (
      <>
        <PageBar title="Configurações" sub={carregando ? '' : 'Não foi possível carregar.'} />
        {carregando && <Esqueleto />}
      </>
    )

  const { areas, cargos, senioridades, horas, grade, classes = [] } = dados
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
        { k: 'temGeral', l: 'Projeto geral', o: LIDERA, h: 'Escolher Não exclui o projeto geral da área (só se ele não tiver tarefas).' },
      ],
      {
        nome: a?.nome || '',
        codigoAreaPai: a?.codigoAreaPai || '',
        ativa: String(a?.ativa ?? true),
        temGeral: String(a?.temGeral ?? true),
      },
      v =>
        salvar(
          () =>
            configuracoes.salvarArea(a?.codigo, {
              nome: v.nome,
              codigoAreaPai: v.codigoAreaPai || null,
              ativa: v.ativa === 'true',
              temGeral: v.temGeral === 'true',
            }),
          'Área salva',
        ),
    )

  const editarCargo = c =>
    form(
      c ? 'Editar cargo' : 'Novo cargo',
      [
        { k: 'nome', l: 'Nome' },
        {
          k: 'posicao',
          l: 'Posição',
          t: 'number',
          min: 1,
          step: 1,
          h: '1 = presidente (um só). Menor = mais alto: diretores 2, gerentes 3, os demais 4. Você só usa posições abaixo da sua.',
        },
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
        posicao: c?.posicao ?? 4,
        ativo: String(c?.ativo ?? true),
        lideraArea: String(c?.lideraArea ?? false),
        tetoSemanalHoras: c?.tetoSemanalHoras ?? 10,
      },
      v =>
        salvar(
          () =>
            configuracoes.salvarCargo(c?.codigo, {
              nome: v.nome,
              posicao: Number(v.posicao),
              ativo: v.ativo === 'true',
              lideraArea: v.lideraArea === 'true',
              tetoSemanalHoras: Number(v.tetoSemanalHoras),
            }),
          'Cargo salvo',
        ),
    )

  const editarHoras = () =>
    form(
      'Dificuldade (% do dia)',
      DIFICULDADES.map(([k, l]) => ({ k, l: `${l} (% do dia)`, t: 'number', min: 5, max: 100, step: 5 })),
      Object.fromEntries(DIFICULDADES.map(([k]) => [k, horas[k]])),
      v => {
        const novas = Object.fromEntries(DIFICULDADES.map(([k]) => [k, Number(v[k])]))
        return salvar(() => configuracoes.salvarHorasDificuldade(novas), 'Dificuldade salva')
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

  const editarClasse = c =>
    form(
      c ? 'Editar classe de projeto' : 'Nova classe de projeto',
      [
        { k: 'nome', l: 'Nome', maxLength: 80, h: 'Ex.: Landing page, CRM, SaaS. Todo projeto novo escolhe uma.' },
        { k: 'ordem', l: 'Ordem na lista', t: 'number', min: 0, max: 100, step: 1 },
      ],
      { nome: c?.nome || '', ordem: c?.ordem ?? classes.length + 1 },
      v => salvar(() => configuracoes.salvarClasse(c?.codigo, { nome: v.nome, ordem: Number(v.ordem) }), 'Classe salva'),
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
        { k: 'ge', l: 'Projeto geral', filter: 1, get: a => (a.temGeral === false ? 'Não' : 'Sim') },
        { k: 'st', l: 'Situação', filter: 1, get: a => (a.ativa ? 'Ativo' : 'Inativo'), render: a => situacao(a.ativa) },
        { l: 'Ações', render: a => editarBotao(() => editarArea(a)) },
      ],
    },
    cargos: {
      novo: () => editarCargo(),
      linhas: [...cargos].sort((a, b) => (a.posicao ?? 99) - (b.posicao ?? 99) || a.nome.localeCompare(b.nome)),
      colunas: [
        { k: 'posicao', l: 'Posição' },
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
  telas.classes = {
    novo: () => editarClasse(),
    linhas: [...classes].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
    colunas: [
      { k: 'ordem', l: 'Ordem' },
      { k: 'nome', l: 'Nome' },
      { l: 'Ações', render: c => editarBotao(() => editarClasse(c)) },
    ],
  }
  telas.dificuldade = {
    novo: editarHoras,
    rotulo: 'Editar dificuldade',
    linhas: DIFICULDADES.map(([k, l]) => ({ codigo: k, nome: l, percentual: horas[k] })),
    colunas: [
      { k: 'nome', l: 'Dificuldade' },
      { k: 'percentual', l: 'Parte do dia', get: r => `${r.percentual}%` },
      { k: 'dia10', l: 'Por dia (teto 10 h)', get: r => formatarHoras(horasPorDia(r.percentual, 10)) },
      { k: 'dia20', l: 'Por dia (teto 20 h)', get: r => formatarHoras(horasPorDia(r.percentual, 20)) },
    ],
  }
  const salvarGrade = async (chave, permissoes) => {
    try {
      await configuracoes.salvarPermissoes(chave, permissoes)
      alerts.toastSuccess('Permissões salvas')
      await recarregar()
      // A grade pode mudar o que a própria pessoa vê (menu): recarrega o acesso.
      refresh().catch(() => {})
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
    }
  }

  if (!aba) return <PageBar title="Configurações" sub="Você não tem nenhuma configuração para alterar." />
  const atual = telas[aba]

  return (
    <>
      <PageBar title="Configurações">
        {atual && (
          <button className="btn btn-primary" onClick={atual.novo}>
            <Ic k={aba === 'dificuldade' ? 'edit' : 'plus'} />
            {atual.rotulo || 'Novo item'}
          </button>
        )}
      </PageBar>
      <div className="mb-3">
        <Seg items={abas} value={aba} onChange={setAba} />
      </div>
      {aba === 'permissoes' ? (
        grade ? (
          <GradePermissoes
            key={grade.colunas.map(c => `${c.chave}:${[...c.permissoes].sort().join(',')}`).join('|')}
            dados={grade}
            aoSalvar={salvarGrade}
          />
        ) : (
          <Esqueleto />
        )
      ) : (
        <Table
          key={aba}
          cols={atual.colunas}
          rows={atual.linhas.map(x => ({ ...x, id: x.codigo }))}
          vazio="Nenhum item nesta lista. Use “Novo item”."
        />
      )}
    </>
  )
}
