import { useApp } from '../context/AppContext'
import { chip, fd, iso } from '../lib/utils'
import { erroDatas, rotuloArea, separarPeriodos } from '../lib/periodos'
import { configuracoes, pessoas } from '../services/pessoas'
import alerts from '../lib/alerts'
import Ic from './Icon'

const dataISO = s => (s ? s.slice(0, 10) : '')

/**
 * Seção "Áreas e cargos" do perfil (sessão 23a): períodos atuais em cima, anteriores embaixo.
 * Com `podeGerir` (vem da API), a gestão adiciona, corrige, encerra e exclui períodos.
 */
export default function AreasPessoa({ periodos, podeGerir, codigoPessoa, onMudou }) {
  const { form } = useApp()
  const { atuais, anteriores } = separarPeriodos(periodos)
  const hoje = iso(new Date())

  const gravar = async (acao, sucesso) => {
    try {
      await acao()
      alerts.toastSuccess(sucesso)
      await onMudou()
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
      return false
    }
  }

  // A janela mostra só áreas e cargos ativos, mais os que o período já tem (podem ter sido desativados).
  const abrir = async p => {
    let areas, cargos
    try {
      ;[areas, cargos] = await Promise.all([configuracoes.areas(), configuracoes.cargos()])
    } catch (error) {
      alerts.error('Não foi possível carregar as áreas', error.message)
      return
    }
    const areasOk = areas.filter(a => a.ativa || a.codigo === p?.area.codigo)
    const cargosOk = cargos.filter(c => c.ativo || c.codigo === p?.cargo?.codigo)
    if (!areasOk.length) {
      alerts.error('Nenhuma área ativa', 'Cadastre ou reative uma área em Configurações antes de lançar períodos.')
      return
    }
    form(
      p ? 'Editar período' : 'Adicionar período',
      [
        { k: 'codigoArea', l: 'Área', o: areasOk.map(a => [a.codigo, a.nome]) },
        { k: 'codigoCargo', l: 'Cargo', o: [['', 'Sem cargo'], ...cargosOk.map(c => [c.codigo, c.nome])], opt: true },
        { k: 'inicio', l: 'Início', t: 'date', max: hoje },
        { k: 'fim', l: 'Fim', t: 'date', max: hoje, opt: true, h: 'Deixe em branco se a pessoa continua na área.' },
      ],
      p
        ? {
            codigoArea: p.area.codigo,
            codigoCargo: p.cargo?.codigo || '',
            inicio: dataISO(p.inicio),
            fim: dataISO(p.fim),
          }
        : { codigoArea: areasOk[0]?.codigo || '', codigoCargo: '', inicio: '', fim: '' },
      v => {
        const erro = erroDatas(v, hoje)
        if (erro) {
          alerts.error('Confira as datas', erro)
          return false
        }
        return p
          ? gravar(() => pessoas.editarPeriodo(codigoPessoa, p.codigo, v), 'Período atualizado')
          : gravar(() => pessoas.criarPeriodo(codigoPessoa, v), 'Período adicionado')
      },
    )
  }

  const encerrar = p =>
    form(
      `Encerrar ${rotuloArea(p)}`,
      [{ k: 'fim', l: 'Saiu da área em', t: 'date', max: hoje, h: 'O dia em que a pessoa deixou a área (não pode ser no futuro).' }],
      { fim: hoje },
      v => {
        const corpo = { codigoArea: p.area.codigo, codigoCargo: p.cargo?.codigo || '', inicio: dataISO(p.inicio), fim: v.fim }
        const erro = erroDatas(corpo, hoje)
        if (erro) {
          alerts.error('Confira a data', erro)
          return false
        }
        return gravar(() => pessoas.editarPeriodo(codigoPessoa, p.codigo, corpo), 'Período encerrado')
      },
    )

  const excluir = async p => {
    const ok = await alerts.confirm({
      title: 'Excluir este período?',
      text: `${rotuloArea(p)}, desde ${fd(p.inicio)}. Use para lançamentos errados; para registrar a saída da área, prefira Encerrar.`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (ok) await gravar(() => pessoas.excluirPeriodo(codigoPessoa, p.codigo), 'Período excluído')
  }

  const linha = p => (
    <div className="ag periodo" key={p.codigo}>
      <div>
        <b>{rotuloArea(p)}</b>
        <small>
          desde {fd(p.inicio)}
          {p.fim ? ` até ${fd(p.fim)}` : ''}
        </small>
      </div>
      {!p.fim && <span className={chip('ok')}>Atual</span>}
      {podeGerir && (
        <div className="periodo-acoes">
          <button className="btn btn-g btn-sm" title="Editar" aria-label={`Editar ${rotuloArea(p)}`} onClick={() => abrir(p)}>
            <Ic k="edit" />
          </button>
          {/* Período que começou hoje não pode terminar hoje (fim > início): o caminho é excluir. */}
          {!p.fim && dataISO(p.inicio) < hoje && (
            <button className="btn btn-g btn-sm" onClick={() => encerrar(p)}>
              Encerrar
            </button>
          )}
          <button className="btn btn-g btn-sm" title="Excluir" aria-label={`Excluir ${rotuloArea(p)}`} onClick={() => excluir(p)}>
            <Ic k="trash" />
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="card card-body h-100">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <h2 className="mb-0">Áreas e cargos</h2>
        {podeGerir && (
          <button className="btn btn-g btn-sm" onClick={() => abrir(null)}>
            <Ic k="plus" />
            Adicionar período
          </button>
        )}
      </div>
      {atuais.length ? atuais.map(linha) : <small>Sem área no momento.</small>}
      {anteriores.length > 0 && (
        <>
          <h3 className="h6 mt-3 mb-1 text-mu">Anteriores</h3>
          {anteriores.map(linha)}
        </>
      )}
    </div>
  )
}
