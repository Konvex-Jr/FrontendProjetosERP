import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { chip, fd, iso } from '../lib/utils'
import Ic from '../components/Icon'
import Avatar from '../components/Avatar'
import Markdown from '../components/Markdown'
import Esqueleto from '../components/Esqueleto'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import { DIAS_SEMANA, mesDe, mudarMes, nomeDoMes, semanasDoMes } from '../lib/calendario'
import { classeItem, corpoReuniao, linkGoogleAgenda, periodoDaGrade, rotuloItem, textoDuracao, valoresReuniao } from '../lib/agenda'
import { agenda } from '../services/agenda'

/**
 * Agenda (sessão 28b): reuniões, prazos das tarefas da pessoa e todas as capacitações, num
 * calendário do mês (no celular, lista). Qualquer pessoa cria reuniões; a gestão vê a agenda de
 * outra pessoa. O botão "Criar no Google Agenda" abre o Google com o evento e os convidados.
 */

// Mês e pessoa ficam na memória ao sair e voltar; valem só para quem escolheu (`me`): trocar de conta na aba zera.
let ultimos = { me: '', mes: '', pessoa: '' }

function camposReuniao(D, me) {
  const pessoas = (D.u || [])
    .filter(u => (u.status === 'ativo' || u.status === 'trainee') && u.id !== me)
    .map(u => ({ id: u.id, nome: u.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
  return [
    { k: 'titulo', l: 'Título', maxLength: 200 },
    { k: 'data', l: 'Data', t: 'date' },
    { k: 'hora', l: 'Início', t: 'time' },
    { k: 'duracaoMinutos', l: 'Duração (minutos)', t: 'number', min: 5, max: 720, step: 5 },
    { k: 'local', l: 'Local ou link', opt: true, maxLength: 300 },
    { k: 'participantes', l: 'Participantes', c: pessoas, h: 'Você entra automaticamente.' },
    { k: 'descricao', l: 'Pauta', t: 'textarea', opt: true, maxLength: 5000 },
  ]
}

function Reuniao({ r, fechar, editar, excluir }) {
  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={fechar}>
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">{r.titulo}</h2>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={fechar} />
            </div>
            <div className="modal-body">
              <p className="mb-2">
                <b>{fd(r.data)}</b>, {r.hora} · {textoDuracao(r.duracaoMinutos)}
              </p>
              {r.local && (
                <p className="mb-2 text-break">
                  {/^https?:\/\//i.test(r.local) ? (
                    <a className="link-texto" href={r.local} target="_blank" rel="noopener noreferrer">
                      {r.local}
                    </a>
                  ) : (
                    r.local
                  )}
                </p>
              )}
              <small className="d-block mb-2">Criada por {r.criadoPor?.nome || '—'}</small>
              <div className="form-label">Participantes ({r.participantes.length})</div>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {r.participantes.map(p => (
                  <span key={p.codigo} className="d-inline-flex align-items-center gap-1">
                    <Avatar pessoa={p} /> {p.nome}
                  </span>
                ))}
              </div>
              {r.descricao?.trim() && (
                <>
                  <div className="form-label">Pauta</div>
                  <Markdown texto={r.descricao} />
                </>
              )}
            </div>
            <div className="modal-footer flex-wrap gap-2">
              <a className="btn btn-g" href={linkGoogleAgenda(r)} target="_blank" rel="noopener noreferrer">
                <Ic k="open" />
                Criar no Google Agenda
              </a>
              {r.podeAlterar && (
                <>
                  <button className="btn btn-g" onClick={excluir}>
                    <Ic k="trash" />
                    Excluir
                  </button>
                  <button className="btn btn-primary" onClick={editar}>
                    <Ic k="edit" />
                    Editar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Agenda() {
  const { D, me, pode, form } = useApp()
  const navigate = useNavigate()
  const gestao = pode('projetos.verTodos')
  const [f, setF] = useState(() => (ultimos.me === me ? ultimos : { me, mes: '', pessoa: '' }))
  const set = (k, v) => setF(o => (ultimos = { ...o, me, [k]: v }))
  const [aberta, setAberta] = useState(null)
  // Mês local: toISOString (UTC) abriria o mês seguinte no último dia do mês, depois das 21h.
  const mes = f.mes || mesDe(iso(new Date()))
  const pessoa = gestao && f.pessoa && f.pessoa !== me ? f.pessoa : ''
  const { de, ate } = periodoDaGrade(mes)
  const { dados, carregando, recarregar } = useCarregar(() => agenda.periodo(de, ate, pessoa || undefined), [de, ate, pessoa], {
    chave: `agenda:${de}:${ate}:${pessoa}`,
  })
  const itens = dados?.itens || []
  const semanas = semanasDoMes(mes, itens)
  const doMes = itens.filter(i => mesDe(i.data) === mes)
  const hoje = iso(new Date())

  const salvar = (r, dia) =>
    form(
      r ? 'Editar reunião' : 'Nova reunião',
      camposReuniao(D, me),
      valoresReuniao(r, dia),
      async v => {
        try {
          const salva = r ? await agenda.editar(r.codigo, corpoReuniao(v)) : await agenda.criar(corpoReuniao(v))
          alerts.toastSuccess(r ? 'Reunião salva' : 'Reunião criada', 'Use “Criar no Google Agenda” para mandar os convites.')
          setAberta(salva)
          await recarregar()
        } catch (error) {
          await alerts.error('Não foi possível salvar a reunião', error.message)
          return false
        }
      },
      { largo: true },
    )

  const abrirItem = async i => {
    if (i.tipo === 'capacitacao') return navigate(`/capacitacoes/${i.codigo}`)
    if (i.tipo === 'prazo') {
      if (!i.codigo) return alerts.error('Tarefa de projeto restrito', 'Você não vê os detalhes deste projeto.')
      return navigate(`/tarefas?tarefa=${i.codigo}`)
    }
    try {
      setAberta(await agenda.reuniao(i.codigo))
    } catch (error) {
      await alerts.error('Não foi possível abrir a reunião', error.message)
    }
  }

  const excluir = async r => {
    const ok = await alerts.confirm({
      title: 'Excluir a reunião?',
      text: `“${r.titulo}” sai da agenda de todos os participantes.`,
      confirmText: 'Excluir reunião',
      danger: true,
    })
    if (!ok) return
    try {
      await agenda.excluir(r.codigo)
      alerts.toastSuccess('Reunião excluída')
      setAberta(null)
      await recarregar()
    } catch (error) {
      await alerts.error('Não foi possível excluir', error.message)
    }
  }

  const pessoas = (D.u || []).filter(u => u.status === 'ativo' || u.status === 'trainee').sort((a, b) => a.nome.localeCompare(b.nome))

  const botao = i => (
    <button
      key={i.tipo + (i.codigo || i.data + i.projeto?.codigo)}
      type="button"
      className={'cal-e ' + classeItem(i)}
      title={rotuloItem(i)}
      onClick={() => abrirItem(i)}
    >
      {rotuloItem(i)}
    </button>
  )

  return (
    <>
      <PageBar title="Agenda" sub="Reuniões, prazos das suas tarefas e capacitações num só calendário.">
        <button className="btn btn-primary" onClick={() => salvar(null, '')}>
          <Ic k="plus" />
          Nova reunião
        </button>
      </PageBar>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="ag-legenda" aria-label="Legenda">
          <span className="cal-e ag-reuniao">Reunião</span>
          <span className="cal-e ag-prazo">Prazo</span>
          <span className="cal-e ag-prazo atrasada">Atrasada</span>
          <span className="cal-e ag-capacitacao">Capacitação</span>
        </div>
        {gestao && (
          <label className="d-flex align-items-center gap-2 m-0">
            <span className="text-nowrap">Agenda de</span>
            <select className="form-select" value={pessoa || me} onChange={e => set('pessoa', e.target.value)}>
              {pessoas.map(u => (
                <option key={u.id} value={u.id}>
                  {u.id === me ? `${u.nome} (você)` : u.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="card card-body">
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <button className="btn btn-g" aria-label="Mês anterior" onClick={() => set('mes', mudarMes(mes, -1))}>
            <Ic k="back" />
          </button>
          <h2 className="m-0 text-center">{nomeDoMes(mes)}</h2>
          <button className="btn btn-g cal-prox" aria-label="Próximo mês" onClick={() => set('mes', mudarMes(mes, 1))}>
            <Ic k="back" />
          </button>
        </div>
        {carregando && !dados ? (
          <Esqueleto linhas={6} />
        ) : (
          <>
            <div className="cal" role="grid" aria-label={nomeDoMes(mes)}>
              {DIAS_SEMANA.map(d => (
                <div key={d} className="cal-h">
                  {d}
                </div>
              ))}
              {semanas.flat().map(d => (
                <div key={d.data} className={'cal-d' + (d.doMes ? '' : ' fora') + (d.data === hoje ? ' hoje' : '')}>
                  <span className="cal-n">{d.dia}</span>
                  {d.eventos.map(botao)}
                </div>
              ))}
            </div>
            {/* No celular a grade vira lista (responsive.css). */}
            <div className="cal-ag">
              {doMes.length ? (
                doMes.map(i => (
                  <div className="ag" key={i.tipo + (i.codigo || i.data + i.projeto?.codigo)} onClick={() => abrirItem(i)}>
                    <span className={chip()}>{fd(i.data).slice(0, 5)}</span>
                    <div>
                      <b>{i.tipo === 'prazo' ? rotuloItem(i) : i.titulo}</b>
                      <small>
                        {i.tipo === 'reuniao'
                          ? `Reunião · ${i.hora} · ${textoDuracao(i.duracaoMinutos)}`
                          : i.tipo === 'capacitacao'
                            ? `Capacitação · ${i.hora} · ${i.sala}`
                            : `${i.projeto?.nome || ''}${i.concluida ? ' · concluída' : i.atrasada ? ' · atrasada' : ''}`}
                      </small>
                    </div>
                    <span className={'ag-ponto ' + classeItem(i)} aria-hidden="true" />
                  </div>
                ))
              ) : (
                <small>Nada na agenda neste mês.</small>
              )}
            </div>
          </>
        )}
      </div>
      {aberta && (
        <Reuniao
          r={aberta}
          fechar={() => setAberta(null)}
          editar={() => {
            const r = aberta
            setAberta(null)
            salvar(r)
          }}
          excluir={() => excluir(aberta)}
        />
      )}
    </>
  )
}
