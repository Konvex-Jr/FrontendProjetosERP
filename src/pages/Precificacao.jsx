import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { brl } from '../lib/utils'
import Ic from '../components/Icon'
import Esqueleto from '../components/Esqueleto'
import { PageBar, Seg } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import { precificacao } from '../services/precificacao'
import {
  CAMPOS_REGRAS,
  COMPLEXIDADES,
  RISCOS,
  TIPOS_CLIENTE,
  calcularPreco,
  lerCampo,
  regrasDoFormulario,
  validadeAte,
} from '../lib/precificacao'

/** Chave e busca da tela; o menu (src/lib/antecipar.js) usa as mesmas para buscar antes do clique. */
export function dadosDaTela() {
  return { chave: 'precificacao', carregar: () => precificacao.regras() }
}

const horasTexto = h => `${Number(h.toFixed(1)).toLocaleString('pt-BR')} h`
const numero = (valor, maximo = 1e9) => Math.min(maximo, Math.max(0, Number(valor) || 0))

/**
 * Simulação de precificação (sessão 29): horas por senioridade × valor-hora, com as regras da diretoria
 * (GET /config/precificacao), memória de cálculo e documento preliminar pela impressão do navegador.
 * Nada é gravado; valores-hora e escolhas valem só para esta simulação.
 */
export default function Precificacao() {
  const { D, me, pode, form } = useApp()
  const tela = dadosDaTela()
  const { dados: regras, carregando, recarregar } = useCarregar(tela.carregar, [], { chave: tela.chave })

  const senioridades = useMemo(
    () => Object.entries(D?.c?.senioridades ?? {}).map(([codigo, nome]) => ({ codigo, nome })),
    [D?.c?.senioridades],
  )
  const [horas, setHoras] = useState({})
  // Só o que a pessoa mudou na simulação; o resto vem de Configurações (D.c.valorHora), mesmo se chegar depois.
  const [valoresMudados, setValoresHora] = useState({})
  const valoresHora = { ...(D?.c?.valorHora ?? {}), ...valoresMudados }
  const [escolhas, setEscolhas] = useState({
    complexidade: 'media',
    riscos: [],
    urgente: false,
    tipoCliente: 'pequena',
    mesesSuporte: 0,
    desconto: 0,
  })
  const [proposta, setProposta] = useState({ cliente: '', premissas: '' })

  if (!regras)
    return (
      <>
        <PageBar title="Simulador de Precificação" sub={carregando ? '' : 'Não foi possível carregar as regras.'} />
        {carregando && <Esqueleto />}
      </>
    )

  const margem = escolhas.margem ?? regras.margem
  const r = calcularPreco({ senioridades, horas, valoresHora, regras, escolhas: { ...escolhas, margem } })
  const escolher = (campo, valor) => setEscolhas(atual => ({ ...atual, [campo]: valor }))
  const alternarRisco = chave =>
    escolher('riscos', escolhas.riscos.includes(chave) ? escolhas.riscos.filter(k => k !== chave) : [...escolhas.riscos, chave])

  const editarRegras = () =>
    form(
      'Regras da precificação',
      CAMPOS_REGRAS.map(([k, l, min, max, step]) => ({ k, l, t: 'number', min, max, step })),
      Object.fromEntries(CAMPOS_REGRAS.map(([k]) => [k, lerCampo(regras, k)])),
      async v => {
        try {
          await precificacao.salvarRegras(regrasDoFormulario(v))
          alerts.toastSuccess('Regras salvas')
          setEscolhas(atual => ({ ...atual, margem: undefined }))
          await recarregar()
        } catch (error) {
          alerts.error('Não foi possível salvar', error.message)
          return false
        }
      },
    )

  const motivoSemDocumento = !r.horasBase
    ? 'Informe as horas de ao menos uma senioridade.'
    : r.descontoAcimaDoTeto
      ? `O desconto passa do teto de ${regras.descontoMaximo}%.`
      : r.faltaJustificativa
        ? 'Escreva a justificativa do desconto.'
        : ''

  const quem = (D?.u ?? []).find(u => u.id === me)?.nome ?? ''
  const hoje = new Date()

  return (
    <>
      <PageBar title="Simulador de Precificação">
        {pode('config.precificacao') && (
          <button className="btn btn-g" onClick={editarRegras}>
            <Ic k="edit" />
            Regras
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={() => window.print()}
          disabled={!r.podeGerarDocumento}
          title={motivoSemDocumento || undefined}
        >
          <Ic k="download" />
          Gerar PDF
        </button>
      </PageBar>

      <div className="row g-3">
        <div className="col-lg-8 d-flex flex-column gap-3">
          <div className="card card-body">
            <h2>Proposta</h2>
            <label className="form-label w-100 mb-3">
              Cliente ou projeto
              <input
                className="form-control mt-1"
                maxLength={150}
                value={proposta.cliente}
                onChange={e => setProposta(p => ({ ...p, cliente: e.target.value }))}
              />
            </label>
            <label className="form-label w-100 m-0">
              Premissas
              <textarea
                className="form-control mt-1"
                rows={3}
                maxLength={2000}
                placeholder="O que está incluído, o que fica de fora, o que o cliente entrega..."
                value={proposta.premissas}
                onChange={e => setProposta(p => ({ ...p, premissas: e.target.value }))}
              />
            </label>
          </div>

          <div className="card card-body">
            <h2>Horas por senioridade</h2>
            {senioridades.length ? (
              <div className="tw prec-horas">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      {['Senioridade', 'Horas estimadas', 'Valor-hora (R$)', `Com contingência (${regras.contingencia}%)`, 'Custo'].map(
                        t => (
                          <th key={t} className="n">
                            {t}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {senioridades.map(s => {
                      const linha = r.linhas.find(l => l.codigo === s.codigo)
                      return (
                        <tr key={s.codigo}>
                          <td>{s.nome}</td>
                          <td>
                            <input
                              className="form-control"
                              type="number"
                              min="0"
                              step="1"
                              aria-label={`Horas de ${s.nome}`}
                              value={horas[s.codigo] ?? ''}
                              placeholder="0"
                              onChange={e => setHoras(h => ({ ...h, [s.codigo]: numero(e.target.value, 10000) }))}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control"
                              type="number"
                              min="0"
                              step="1"
                              aria-label={`Valor-hora de ${s.nome}`}
                              value={valoresHora[s.codigo] ?? 0}
                              onChange={e => setValoresHora(v => ({ ...v, [s.codigo]: numero(e.target.value, 100000) }))}
                            />
                          </td>
                          <td>{linha ? horasTexto(linha.horas) : '—'}</td>
                          <td>{linha ? brl(linha.custo) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mb-0">
                <small>Nenhuma senioridade cadastrada (Configurações).</small>
              </p>
            )}
          </div>

          <div className="card card-body prec-regras">
            <h2>Regras desta proposta</h2>

            <div className="form-label">Complexidade técnica</div>
            <Seg
              items={COMPLEXIDADES.map(([k, l]) => [k, `${l} (${regras.complexidade[k]}%)`])}
              value={escolhas.complexidade}
              onChange={v => escolher('complexidade', v)}
            />

            <div className="form-label mt-3">Riscos</div>
            {RISCOS.map(([k, l]) => (
              <label key={k} className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={escolhas.riscos.includes(k)}
                  onChange={() => alternarRisco(k)}
                />
                <span className="form-check-label">
                  {l} (+{regras.risco[k]}%)
                </span>
              </label>
            ))}
            <label className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={escolhas.urgente}
                onChange={e => escolher('urgente', e.target.checked)}
              />
              <span className="form-check-label">Urgência: prazo menor que o normal (+{regras.urgencia}%)</span>
            </label>

            <div className="form-label mt-3">Tipo de cliente</div>
            <Seg
              items={TIPOS_CLIENTE.map(([k, l]) => [k, `${l} (${regras.tipoCliente[k] > 0 ? '+' : ''}${regras.tipoCliente[k]}%)`])}
              value={escolhas.tipoCliente}
              onChange={v => escolher('tipoCliente', v)}
            />

            <div className="row g-3 mt-1">
              <label className="form-label col-sm-4 m-0">
                Suporte pós-entrega (meses)
                <input
                  className="form-control mt-1"
                  type="number"
                  min="0"
                  max="24"
                  step="1"
                  value={escolhas.mesesSuporte}
                  onChange={e => escolher('mesesSuporte', Math.floor(numero(e.target.value, 24)))}
                />
                <small className="text-mu">{regras.suporteHorasMes} h por mês</small>
              </label>
              <label className="form-label col-sm-4 m-0">
                Margem (%)
                <input
                  className="form-control mt-1"
                  type="number"
                  min="0"
                  max="200"
                  step="0.5"
                  value={margem}
                  onChange={e => escolher('margem', numero(e.target.value, 200))}
                />
                <small className="text-mu">Mínima: {regras.margemMinima}%</small>
              </label>
              <label className="form-label col-sm-4 m-0">
                Desconto comercial (%)
                <input
                  className={'form-control mt-1' + (r.descontoAcimaDoTeto ? ' is-invalid' : '')}
                  type="number"
                  min="0"
                  max={regras.descontoMaximo}
                  step="0.5"
                  value={escolhas.desconto}
                  onChange={e => escolher('desconto', numero(e.target.value, 100))}
                />
                <small className={r.descontoAcimaDoTeto ? 'text-danger' : 'text-mu'}>Teto: {regras.descontoMaximo}%</small>
              </label>
            </div>
            {escolhas.desconto > 0 && (
              <label className="form-label w-100 mt-3 mb-0">
                Justificativa do desconto (obrigatória)
                <textarea
                  className={'form-control mt-1' + (r.faltaJustificativa ? ' is-invalid' : '')}
                  rows={2}
                  maxLength={500}
                  value={escolhas.justificativa ?? ''}
                  onChange={e => escolher('justificativa', e.target.value)}
                />
              </label>
            )}
          </div>
        </div>

        <div className="col-lg-4 d-flex flex-column gap-3">
          <div className="card card-body">
            <h2>Memória de cálculo</h2>
            <Memoria memoria={r.memoria} />
            {r.abaixoDaMargem && (
              <div className="prec-alerta mt-3" role="alert">
                <span>
                  Abaixo da margem mínima: o valor líquido ({brl(r.liquido)}) não cobre o custo mais {regras.margemMinima}% ({brl(r.piso)}).
                </span>
              </div>
            )}
            <div className="pv mt-3 mb-1">
              <small>Preço final da simulação</small>
              <b>{brl(r.total)}</b>
            </div>
            <small>
              {horasTexto(r.horasProjeto + r.horasSuporte)} no total · valor-hora médio de venda{' '}
              {brl(r.horasProjeto + r.horasSuporte ? r.total / (r.horasProjeto + r.horasSuporte) : 0)}
            </small>
            {motivoSemDocumento && <small className="text-mu mt-2">{motivoSemDocumento}</small>}
          </div>
        </div>
      </div>

      {r.podeGerarDocumento &&
        createPortal(
          <DocumentoPreliminar r={r} regras={regras} proposta={proposta} escolhas={escolhas} quem={quem} hoje={hoje} />,
          document.body,
        )}
    </>
  )
}

function Memoria({ memoria }) {
  return (
    <div className="prec-memoria">
      {memoria.map((m, i) => (
        <div key={i} className={'pl' + (m.total ? ' prec-total' : '')}>
          <span>{m.rotulo}</span>
          <b>{m.total ? brl(m.subtotal) : `${m.valor < 0 ? '−' : i ? '+' : ''} ${brl(Math.abs(m.valor))}`}</b>
        </div>
      ))}
    </div>
  )
}

/** Só aparece na impressão (CSS `.impressao-raiz`): o navegador oferece "Salvar como PDF". */
function DocumentoPreliminar({ r, regras, proposta, escolhas, quem, hoje }) {
  // Enquanto o documento existe, a impressão mostra só ele (classe no body; fora daqui o app imprime normal).
  useEffect(() => {
    document.body.classList.add('com-doc-impressao')
    return () => document.body.classList.remove('com-doc-impressao')
  }, [])

  return (
    <div className="impressao-raiz" aria-hidden="true">
      <div className="imp-marca-dagua">PRELIMINAR</div>
      <header className="imp-topo">
        <img src={import.meta.env.BASE_URL + 'assets/logo-cor.webp'} width={180} height={36} alt="Konvex Jr" />
        <span className="imp-selo">Documento preliminar, simulação</span>
      </header>
      <h1>Simulação de precificação</h1>
      <dl className="imp-dados">
        <dt>Cliente ou projeto</dt>
        <dd>{proposta.cliente.trim() || 'Não informado'}</dd>
        <dt>Simulado por</dt>
        <dd>{quem || '—'}</dd>
        <dt>Data</dt>
        <dd>{hoje.toLocaleDateString('pt-BR')}</dd>
        <dt>Válido até</dt>
        <dd>
          {validadeAte(hoje, regras.validadeDias)} ({regras.validadeDias} dias)
        </dd>
      </dl>

      <h2>Premissas</h2>
      <p className="imp-premissas">{proposta.premissas.trim() || 'Nenhuma premissa informada.'}</p>

      <h2>Horas por senioridade</h2>
      <table>
        <thead>
          <tr>
            <th>Senioridade</th>
            <th>Horas estimadas</th>
            <th>Com contingência ({regras.contingencia}%)</th>
            <th>Valor-hora</th>
            <th>Custo</th>
          </tr>
        </thead>
        <tbody>
          {r.linhas.map(l => (
            <tr key={l.codigo}>
              <td>{l.nome}</td>
              <td>{horasTexto(l.horasBase)}</td>
              <td>{horasTexto(l.horas)}</td>
              <td>{brl(l.valorHora)}</td>
              <td>{brl(l.custo)}</td>
            </tr>
          ))}
          {r.horasSuporte > 0 && (
            <tr>
              <td>Suporte pós-entrega</td>
              <td colSpan={4}>
                {escolhas.mesesSuporte} {escolhas.mesesSuporte === 1 ? 'mês' : 'meses'} × {regras.suporteHorasMes} h ={' '}
                {horasTexto(r.horasSuporte)}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Regras aplicadas</h2>
      <Memoria memoria={r.memoria} />
      {escolhas.desconto > 0 && <p className="imp-premissas">Justificativa do desconto: {escolhas.justificativa}</p>}

      <div className="imp-total">
        <span>Total da simulação</span>
        <b>{brl(r.total)}</b>
      </div>
      <footer className="imp-rodape">
        Simulação gerada no sistema interno da Konvex Jr. Documento preliminar, sem valor de proposta comercial; valores sujeitos a revisão.
      </footer>
    </div>
  )
}
