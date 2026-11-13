import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { TIPO, chip, fd, iso } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Markdown from '../components/Markdown'
import Anexos from '../components/Anexos'
import { PageBar, Prog, Seg, Stars } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import { DIAS_SEMANA, mesDe, mudarMes, nomeDoMes, semanasDoMes } from '../lib/calendario'
import { SITUACAO, capacitacoes, horas, valoresCapacitacao } from '../services/capacitacoes'

/**
 * Capacitações (sessão 13, RF-070 a RF-073). Todos veem; a gestão cria, edita, exclui, marca presença
 * e anexa material; cada pessoa se inscreve e cancela até o início; só quem compareceu avalia.
 * A API diz o que cada pessoa pode fazer em cada capacitação (`pode*`).
 */

// Filtros e visão ficam na memória ao abrir a ficha e voltar.
let ultimos = { tipo: '', quando: 'proximas', minhas: '', visao: 'lista', mes: '' }

const MARKDOWN = 'Aceita Markdown simples: ## título, - lista, **negrito** e [texto](https://...).'
const quando = c => `${fd(c.data)} às ${c.hora} · ${horas(c.duracao)}`
const Situacao = ({ c }) => <span className={chip(SITUACAO[c.situacao]?.[1])}>{SITUACAO[c.situacao]?.[0]}</span>

function abrirForm({ D, form, item, aoSalvar }) {
  const pessoas = (D.u || [])
    .filter(u => u.ativo !== false || u.id === item?.instrutorId)
    .map(u => [u.id, u.nome])
    .sort((a, b) => a[1].localeCompare(b[1]))
  form(
    item ? 'Editar capacitação' : 'Nova capacitação',
    [
      { k: 'titulo', l: 'Título' },
      { k: 'codigoInstrutor', l: 'Quem ministra', o: [['', 'Escolha…'], ...pessoas] },
      { k: 'data', l: 'Data', t: 'date' },
      { k: 'hora', l: 'Início', t: 'time' },
      { k: 'duracaoHoras', l: 'Duração (horas)', h: 'Ex.: 1, 1,5 ou 2. Conta nas horas de quem comparecer.' },
      { k: 'tipo', l: 'Tipo', o: Object.entries(TIPO) },
      { k: 'sala', l: 'Sala ou local', h: 'Ex.: Lab 2, Sala da Konvex ou link do Meet.' },
      { k: 'vagas', l: 'Vagas', t: 'number' },
      { k: 'descricao', l: 'Descrição (opcional)', t: 'textarea', rows: 5, opt: 1, h: MARKDOWN },
    ],
    valoresCapacitacao(item),
    async v => {
      try {
        const salva = await capacitacoes.salvar(item?.id, v)
        alerts.toastSuccess(item ? 'Capacitação atualizada' : 'Capacitação criada', salva.titulo)
        await aoSalvar(salva)
      } catch (error) {
        await alerts.error('Não foi possível salvar', error.message)
        return false
      }
    },
    { largo: true },
  )
}

/** Inscrever, cancelar e excluir ficam aqui para a lista e a ficha usarem igual. */
function useAcoes(aoMudar) {
  const { me, recarregarCapacitacoes } = useApp()
  const depois = async () => {
    await aoMudar?.()
    recarregarCapacitacoes().catch(() => {})
  }
  const tentar = async (fn, ok, titulo) => {
    try {
      await fn()
      alerts.toastSuccess(ok, titulo)
      await depois()
    } catch (error) {
      await alerts.error('Não foi possível concluir', error.message)
    }
  }
  return {
    inscrever: c => tentar(() => capacitacoes.inscrever(c.id), 'Inscrição feita', c.titulo),
    cancelar: async (c, pessoa) => {
      const outra = pessoa && pessoa.id !== me
      const ok = await alerts.confirm({
        title: outra ? `Tirar ${pessoa.nome} da capacitação?` : 'Cancelar inscrição?',
        text: c.titulo,
        confirmText: outra ? 'Tirar inscrição' : 'Cancelar inscrição',
        cancelText: 'Manter',
        danger: true,
      })
      if (ok) await tentar(() => capacitacoes.cancelar(c.id, pessoa?.id || me), 'Inscrição cancelada', c.titulo)
    },
    excluir: async (c, depoisDeExcluir) => {
      const ok = await alerts.confirm({
        title: 'Excluir capacitação?',
        text: `${c.titulo}. Inscrições, avaliações e material também saem.`,
        confirmText: 'Excluir',
        danger: true,
      })
      if (!ok) return
      try {
        await capacitacoes.excluir(c.id)
        alerts.toastSuccess('Capacitação excluída', c.titulo)
        recarregarCapacitacoes().catch(() => {})
        depoisDeExcluir?.()
      } catch (error) {
        await alerts.error('Não foi possível excluir', error.message)
      }
    },
  }
}

function Cartao({ c, abrir, acoes }) {
  const itens = [
    ['open', 'Ver detalhes', () => abrir(c.id)],
    ...(c.podeInscrever ? [['check', 'Inscrever-se', () => acoes.inscrever(c)]] : []),
    ...(c.podeCancelar ? [['x', 'Cancelar inscrição', () => acoes.cancelar(c), 1]] : []),
  ]
  const dia = new Date(c.data + 'T00:00')
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .replace(/[.,]/g, '')
  return (
    <div className={'cc' + (c.inscrito ? ' me' : '') + (c.situacao === 'realizada' ? ' past' : '')} onClick={() => abrir(c.id)}>
      <div className="ct">
        <h3>{c.titulo}</h3>
        {c.inscrito && <span className={chip('ok')}>Inscrito</span>}
        <span className={chip('tp-' + c.tipo)}>{TIPO[c.tipo]}</span>
      </div>
      <div className="cmeta">
        <span>
          <Ic k="capacitacoes" />
          {dia}
        </span>
        <span>
          <Ic k="clock" />
          {c.hora} · {horas(c.duracao)}
        </span>
        <span>
          <Ic k="pin" />
          {c.sala}
        </span>
      </div>
      <small>Com {c.instrutor}</small>
      <div className="cf2">
        <small>
          {c.situacao === 'realizada' ? (
            c.avaliacoes ? (
              <>
                Nota {String(c.media).replace('.', ',')} ({c.avaliacoes})
              </>
            ) : (
              'Sem avaliações ainda'
            )
          ) : (
            <>
              {c.totalInscritos} de {c.vagas} {c.vagas === 1 ? 'vaga' : 'vagas'}
              {c.situacao === 'lotada' ? ' · esgotada' : ''}
            </>
          )}
        </small>
        <span onClick={e => e.stopPropagation()}>
          <ActionMenu items={itens} />
        </span>
      </div>
    </div>
  )
}

function Calendario({ lista, mes, setMes, abrir }) {
  const semanas = semanasDoMes(mes, lista)
  const doMes = lista.filter(c => mesDe(c.data) === mes)
  const hoje = iso(new Date())
  return (
    <div className="card card-body">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <button className="btn btn-g" aria-label="Mês anterior" onClick={() => setMes(mudarMes(mes, -1))}>
          <Ic k="back" />
        </button>
        <h2 className="m-0 text-center">{nomeDoMes(mes)}</h2>
        <button className="btn btn-g cal-prox" aria-label="Próximo mês" onClick={() => setMes(mudarMes(mes, 1))}>
          <Ic k="back" />
        </button>
      </div>
      <div className="cal" role="grid" aria-label={nomeDoMes(mes)}>
        {DIAS_SEMANA.map(d => (
          <div key={d} className="cal-h">
            {d}
          </div>
        ))}
        {semanas.flat().map(d => (
          <div key={d.data} className={'cal-d' + (d.doMes ? '' : ' fora') + (d.data === hoje ? ' hoje' : '')}>
            <span className="cal-n">{d.dia}</span>
            {d.eventos.map(c => (
              <button
                key={c.id}
                type="button"
                className={'cal-e tp-' + c.tipo + (c.inscrito ? ' me' : '')}
                title={`${c.hora} ${c.titulo}`}
                onClick={() => abrir(c.id)}
              >
                <b>{c.hora}</b> {c.titulo}
              </button>
            ))}
          </div>
        ))}
      </div>
      {/* No celular a grade vira agenda (responsive.css). */}
      <div className="cal-ag">
        {doMes.length ? (
          doMes.map(c => (
            <div className="ag" key={c.id} onClick={() => abrir(c.id)}>
              <span className={chip()}>{fd(c.data).slice(0, 5)}</span>
              <div>
                <b>{c.titulo}</b>
                <small>
                  {c.hora} · {c.sala}
                </small>
              </div>
              {c.inscrito && <span className={chip('ok')}>Inscrito</span>}
            </div>
          ))
        ) : (
          <small>Nenhuma capacitação neste mês.</small>
        )}
      </div>
    </div>
  )
}

function Lista() {
  const { D, form, go } = useApp()
  const op = useCarregar(capacitacoes.opcoes, []).dados || { podeGerir: false }
  const { dados, carregando, recarregar } = useCarregar(capacitacoes.listar, [])
  const [f, setF] = useState(ultimos)
  const set = (k, v) => setF(o => (ultimos = { ...o, [k]: v }))
  const acoes = useAcoes(recarregar)
  const abrir = id => go('capacitacoes', id)
  const todas = dados || []
  const lista = todas.filter(c => (!f.tipo || c.tipo === f.tipo) && (!f.minhas || c.inscrito))
  // Mês local: toISOString (UTC) abriria o mês seguinte no último dia do mês, depois das 21h.
  const mes = f.mes || mesDe(iso(new Date()))
  const proximas = lista.filter(c => c.situacao !== 'realizada')
  const realizadas = lista.filter(c => c.situacao === 'realizada').reverse()
  const secao = (titulo, itens) =>
    itens.length > 0 && (
      <>
        <div className="sec">
          <h2>{titulo}</h2>
          <span className={chip()}>{itens.length}</span>
        </div>
        <div className="row g-3 mb-2">
          {itens.map(c => (
            <div key={c.id} className="col-md-6 col-xl-4">
              <Cartao c={c} abrir={abrir} acoes={acoes} />
            </div>
          ))}
        </div>
      </>
    )
  const vazio = !todas.length
    ? 'Nenhuma capacitação cadastrada ainda. ' +
      (op.podeGerir ? 'Use “Nova capacitação”.' : 'Quando a gestão marcar uma, ela aparece aqui.')
    : 'Nada encontrado. Ajuste os filtros.'
  const mostrar = f.quando === 'proximas' ? [proximas, []] : f.quando === 'realizadas' ? [[], realizadas] : [proximas, realizadas]
  return (
    <>
      <PageBar title="Capacitações" sub="Inscreva-se, veja o calendário e avalie as capacitações de que participou.">
        {op.podeGerir && (
          <button className="btn btn-primary" onClick={() => abrirForm({ D, form, aoSalvar: c => abrir(c.id) })}>
            <Ic k="plus" />
            Nova capacitação
          </button>
        )}
      </PageBar>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <Seg
          items={[
            ['lista', 'Lista'],
            ['calendario', 'Calendário'],
          ]}
          value={f.visao}
          onChange={v => set('visao', v)}
        />
        <div className="fl d-flex flex-wrap gap-2">
          <select className="form-select w-auto" aria-label="Tipo" value={f.tipo} onChange={e => set('tipo', e.target.value)}>
            <option value="">Tipo: todos</option>
            {Object.entries(TIPO).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          {f.visao === 'lista' && (
            <select className="form-select w-auto" aria-label="Quando" value={f.quando} onChange={e => set('quando', e.target.value)}>
              <option value="proximas">Próximas</option>
              <option value="realizadas">Já realizadas</option>
              <option value="todas">Quando: todas</option>
            </select>
          )}
          <select className="form-select w-auto" aria-label="Inscrição" value={f.minhas} onChange={e => set('minhas', e.target.value)}>
            <option value="">Inscrição: todas</option>
            <option value="1">Só as minhas</option>
          </select>
        </div>
      </div>
      {carregando && !dados ? (
        <small>Carregando…</small>
      ) : f.visao === 'calendario' ? (
        <Calendario lista={lista} mes={mes} setMes={m => set('mes', m)} abrir={abrir} />
      ) : mostrar[0].length + mostrar[1].length ? (
        <>
          {secao('Próximas', mostrar[0])}
          {secao('Já realizadas', mostrar[1])}
        </>
      ) : (
        <div className="card card-body">
          <small>
            {f.quando === 'proximas' && todas.length && !f.tipo && !f.minhas
              ? 'Nenhuma capacitação marcada daqui para a frente. Veja “Já realizadas” ou o calendário.'
              : vazio}
          </small>
        </div>
      )}
    </>
  )
}

const Secao = ({ titulo, children }) => (
  <div className="kc-s">
    <h3 className="h6 fw-bold">{titulo}</h3>
    {children}
  </div>
)

function Presenca({ c, aoMudar }) {
  const [marcados, setMarcados] = useState(() => new Set(c.inscritos.filter(i => i.presente).map(i => i.id)))
  const [salvando, setSalvando] = useState(false)
  const alternar = id =>
    setMarcados(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const salvar = async () => {
    setSalvando(true)
    try {
      await capacitacoes.marcarPresencas(c.id, [...marcados])
      alerts.toastSuccess('Presença salva', `${marcados.size} de ${c.inscritos.length} compareceram`)
      await aoMudar()
    } catch (error) {
      await alerts.error('Não foi possível salvar a presença', error.message)
    } finally {
      setSalvando(false)
    }
  }
  return (
    <>
      <small className="d-block mb-2">
        Marque quem compareceu. Só quem estiver marcado pode avaliar, e as horas entram no perfil da pessoa.
      </small>
      <div className="cap-pr">
        {c.inscritos.map(i => (
          <label key={i.id} className="form-check m-0">
            <input type="checkbox" className="form-check-input" checked={marcados.has(i.id)} onChange={() => alternar(i.id)} />
            <span className="form-check-label ms-1">{i.nome}</span>
          </label>
        ))}
      </div>
      <button className="btn btn-primary mt-2" disabled={salvando} onClick={salvar}>
        <Ic k="check" />
        {salvando ? 'Salvando…' : 'Salvar presença'}
      </button>
    </>
  )
}

function Inscritos({ c, aoMudar, acoes }) {
  const { D, form } = useApp()
  const inscrever = () => {
    const ja = new Set(c.inscritos.map(i => i.id))
    const opcoes = (D.u || [])
      .filter(u => u.status === 'ativo' && !ja.has(u.id))
      .map(u => [u.id, u.nome])
      .sort((a, b) => a[1].localeCompare(b[1]))
    if (!opcoes.length) return alerts.error('Ninguém para inscrever', 'Todas as pessoas ativas já estão inscritas.')
    form('Inscrever pessoa', [{ k: 'pessoa', l: 'Pessoa', o: opcoes }], { pessoa: opcoes[0][0] }, async v => {
      try {
        await capacitacoes.inscrever(c.id, v.pessoa)
        alerts.toastSuccess('Pessoa inscrita')
        await aoMudar()
      } catch (error) {
        await alerts.error('Não foi possível inscrever', error.message)
        return false
      }
    })
  }
  const comecou = c.situacao === 'realizada'
  return (
    <>
      {c.podeGerir && comecou && c.inscritos.length > 0 ? (
        <Presenca key={c.inscritos.map(i => i.id + i.presente).join()} c={c} aoMudar={aoMudar} />
      ) : c.inscritos.length ? (
        <div className="kc-tags">
          {c.inscritos.map(i => (
            <span key={i.id} className={chip(i.presente === true ? 'ok' : '')}>
              {i.nome}
              {i.presente === true ? ' · presente' : i.presente === false ? ' · faltou' : ''}
              {c.podeGerir && (
                <button type="button" className="dots ms-1" aria-label={`Tirar ${i.nome}`} onClick={() => acoes.cancelar(c, i)}>
                  <Ic k="x" />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <small className="d-block">Ninguém inscrito ainda.</small>
      )}
      {c.podeGerir && (
        <button className="btn btn-g mt-2" onClick={inscrever}>
          <Ic k="plus" />
          Inscrever pessoa
        </button>
      )}
    </>
  )
}

function Avaliar({ c, aoMudar }) {
  const inicial = c.minhaAvaliacao || { nota: 0, bom: '', melhorar: '' }
  const [v, setV] = useState({ nota: inicial.nota, bom: inicial.bom || '', melhorar: inicial.melhorar || '' })
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  const enviar = async e => {
    e.preventDefault()
    try {
      await capacitacoes.avaliar(c.id, v)
      alerts.toastSuccess('Avaliação salva', 'Obrigado!')
      await aoMudar()
    } catch (error) {
      await alerts.error('Não foi possível salvar a avaliação', error.message)
    }
  }
  return (
    <form onSubmit={enviar} style={{ maxWidth: 520 }}>
      <div className="form-label">Sua nota</div>
      <Stars n={v.nota} set={n => set('nota', n)} />
      <label className="form-label w-100 mt-3 mb-2">
        O que funcionou bem?
        <textarea className="form-control mt-1" rows={2} value={v.bom} onChange={e => set('bom', e.target.value)} />
      </label>
      <label className="form-label w-100 mb-2">
        O que pode melhorar?
        <textarea className="form-control mt-1" rows={2} value={v.melhorar} onChange={e => set('melhorar', e.target.value)} />
      </label>
      <small className="d-block mb-2">
        A gestão vê sua avaliação com seu nome; quem ministrou lê sem o nome. Os demais veem só a média.
      </small>
      <button className="btn btn-primary" disabled={!v.nota}>
        {c.minhaAvaliacao ? 'Atualizar avaliação' : 'Enviar avaliação'}
      </button>
    </form>
  )
}

function Avaliacoes({ c }) {
  const { dados } = useCarregar(() => capacitacoes.avaliacoes(c.id), [c.id, c.avaliacoes, c.media])
  if (!dados) return <small>Carregando…</small>
  if (!dados.length) return <small>Nenhuma avaliação ainda.</small>
  return dados.map((a, i) => (
    <div className="fbk" key={a.usuario?.codigo || i}>
      <div className="d-flex justify-content-between gap-2">
        <b>{a.usuario?.nome || 'Participante'}</b>
        <Stars n={a.nota} />
      </div>
      {a.bom && (
        <p className="mt-2 mb-0">
          <small>O que funcionou</small>
          <br />
          {a.bom}
        </p>
      )}
      {a.melhorar && (
        <p className="mt-2 mb-0">
          <small>O que melhorar</small>
          <br />
          {a.melhorar}
        </p>
      )}
    </div>
  ))
}

function Ficha({ id }) {
  const { D, form, go } = useApp()
  const { dados: c, carregando, recarregar } = useCarregar(() => capacitacoes.buscar(id), [id])
  const acoes = useAcoes(recarregar)
  const voltar = (
    <button className="btn btn-g" onClick={() => go('capacitacoes')}>
      <Ic k="back" />
      Voltar
    </button>
  )
  if (!c)
    return (
      <PageBar title="Capacitações" sub={carregando ? 'Carregando…' : 'Capacitação não encontrada. Ela pode ter sido excluída.'}>
        {voltar}
      </PageBar>
    )
  const comecou = c.situacao === 'realizada'
  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="cab d-flex align-items-center gap-2">
          {voltar}
          <h1>{c.titulo}</h1>
          <Situacao c={c} />
        </div>
        <div className="d-flex flex-wrap gap-2">
          {c.podeInscrever && (
            <button className="btn btn-primary" onClick={() => acoes.inscrever(c)}>
              <Ic k="check" />
              Inscrever-se
            </button>
          )}
          {c.podeCancelar && (
            <button className="btn btn-g" onClick={() => acoes.cancelar(c)}>
              <Ic k="x" />
              Cancelar inscrição
            </button>
          )}
          {c.podeGerir && (
            <>
              <button className="btn btn-g" onClick={() => abrirForm({ D, form, item: c, aoSalvar: recarregar })}>
                <Ic k="edit" />
                Editar
              </button>
              <button className="btn btn-g" onClick={() => acoes.excluir(c, () => go('capacitacoes'))}>
                <Ic k="trash" />
                Excluir
              </button>
            </>
          )}
        </div>
      </div>
      <div className="card card-body kc">
        <div className="kc-m">
          <span>
            <Ic k="clock" />
            {quando(c)}
          </span>
          <span>
            <Ic k="pin" />
            {c.sala}
          </span>
          <span>
            <Ic k="perfil" />
            Com {c.instrutor}
          </span>
          <span className={chip('tp-' + c.tipo)}>{TIPO[c.tipo]}</span>
          {c.inscrito && (
            <span className={chip('ok')}>
              {c.presente === true ? 'Você compareceu' : c.presente === false ? 'Faltou' : 'Você está inscrito'}
            </span>
          )}
        </div>
        <div style={{ maxWidth: 420 }}>
          <Prog v={c.vagas ? (c.totalInscritos / c.vagas) * 100 : 0} />
          <small>
            {c.totalInscritos} de {c.vagas} vagas ocupadas
          </small>
        </div>
        <Secao titulo="Descrição">
          {c.descricao.trim() ? (
            <Markdown texto={c.descricao} />
          ) : (
            <small>Sem descrição.{c.podeGerir && ' Use “Editar” para acrescentar o conteúdo e o que levar.'}</small>
          )}
        </Secao>
        {(c.anexos.length > 0 || c.podeGerir) && (
          <Secao titulo="Material">
            <Anexos dono="capacitacoes" codigo={c.id} lista={c.anexos} podeAlterar={c.podeGerir} aoMudar={recarregar} />
          </Secao>
        )}
        {c.verInscritos && (
          <Secao titulo={`Inscritos (${c.totalInscritos})`}>
            <Inscritos c={c} aoMudar={recarregar} acoes={acoes} />
          </Secao>
        )}
        <Secao titulo="Avaliação">
          <div className="d-flex align-items-center gap-2 mb-2">
            {c.avaliacoes ? (
              <>
                <Stars n={Math.round(c.media)} />
                <b>{String(c.media).replace('.', ',')}</b>
                <small>
                  ({c.avaliacoes} {c.avaliacoes === 1 ? 'avaliação' : 'avaliações'})
                </small>
              </>
            ) : (
              <small>{comecou ? 'Nenhuma avaliação ainda.' : 'A avaliação abre depois da capacitação, para quem comparecer.'}</small>
            )}
          </div>
          {c.podeAvaliar && <Avaliar key={c.minhaAvaliacao?.nota ?? 0} c={c} aoMudar={recarregar} />}
          {comecou && c.inscrito && !c.podeAvaliar && (
            <small className="d-block">
              {c.presente === false
                ? 'A gestão não marcou sua presença; por isso a avaliação não está disponível.'
                : 'Assim que a gestão marcar a presença, você poderá avaliar.'}
            </small>
          )}
        </Secao>
        {c.podeVerAvaliacoes && comecou && (
          <Secao titulo={c.podeGerir ? 'Avaliações individuais' : 'Avaliações individuais (sem nome)'}>
            <Avaliacoes c={c} />
          </Secao>
        )}
      </div>
    </>
  )
}

/** /capacitacoes mostra a lista (ou o calendário); /capacitacoes/:id, a ficha. */
export default function Capacitacoes() {
  const { id } = useParams()
  return id ? <Ficha id={id} /> : <Lista />
}
