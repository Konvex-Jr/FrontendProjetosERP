import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ST, chip, d, fm, hj, un } from '../lib/utils'
import Agenda from './Agenda'

// Cor do selo de situação da tarefa (atrasada tem cor própria).
const COR_SITUACAO = { pendente: '', andamento: 'p3' }

/** Linha clicável das listas do Dashboard: título, detalhe, data e selo. */
function Linha({ titulo, detalhe, data, dataAlerta, selo, seloCls, onClick }) {
  return (
    <button type="button" className="dl-linha" onClick={onClick}>
      <b>{titulo}</b>
      <span className="dl-det">{detalhe}</span>
      <span className={dataAlerta ? 'dl-data al' : 'dl-data'}>{data}</span>
      <span className={chip(seloCls)}>{selo}</span>
    </button>
  )
}

/**
 * Tela inicial (25/11): tarefas abertas da pessoa, capacitações em que ela está inscrita e a Agenda do mês.
 * Indicadores e ocupação ficam em Relatórios. Usa os dados do contexto (D).
 */
export default function Dashboard() {
  const { D, go, me } = useApp(),
    navigate = useNavigate(),
    h = hj(D)
  const tarefas = D.t
    .filter(t => t.status != 'concluida' && (t.responsaveis || []).includes(me))
    .sort((a, b) => (a.fim > b.fim ? 1 : a.fim < b.fim ? -1 : 0))
  const caps = D.k.filter(c => c.inscrito && c.data >= D.c.hoje).sort((a, b) => (a.data + a.hora > b.data + b.hora ? 1 : -1))
  const nomeProjeto = id => D.p.find(p => p.id == id)?.nome || ''
  return (
    <>
      <div className="dl-cab">
        <h1>Olá, {un(D, me).split(' ')[0]}.</h1>
        <p>{d(D.c.hoje).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <section className="dl" aria-label="Minhas tarefas">
        <h2>
          Minhas tarefas <span className="dl-n">{tarefas.length}</span>
        </h2>
        <div className="dl-caixa">
          {tarefas.length ? (
            tarefas.map(t => {
              const atrasada = d(t.fim) < h
              return (
                <Linha
                  key={t.id}
                  titulo={t.titulo}
                  detalhe={nomeProjeto(t.projetoId)}
                  data={fm(t.fim)}
                  dataAlerta={atrasada}
                  selo={atrasada ? 'Atrasada' : ST[t.status]}
                  seloCls={atrasada ? 'er' : COR_SITUACAO[t.status]}
                  onClick={() => navigate(`/tarefas?tarefa=${t.id}`)}
                />
              )
            })
          ) : (
            <p className="dl-vazio">Você não tem tarefas abertas.</p>
          )}
        </div>
      </section>

      <section className="dl" aria-label="Minhas capacitações">
        <h2>
          Minhas capacitações <span className="dl-n">{caps.length}</span>
        </h2>
        <div className="dl-caixa">
          {caps.length ? (
            caps.map(c => (
              <Linha
                key={c.id}
                titulo={c.titulo}
                detalhe={[c.hora, c.sala].filter(Boolean).join(' · ')}
                data={fm(c.data)}
                selo="Inscrito"
                seloCls="ok"
                onClick={() => go('capacitacoes', c.id)}
              />
            ))
          ) : (
            <p className="dl-vazio">
              Você não está inscrito em nenhuma capacitação futura.{' '}
              <button type="button" className="btn-nome" onClick={() => go('capacitacoes')}>
                Ver capacitações
              </button>
            </p>
          )}
        </div>
      </section>

      {/* A Agenda saiu do menu (25/11) e mora aqui: reuniões, prazos e capacitações do mês. */}
      <section className="dl" aria-label="Agenda">
        <Agenda />
      </section>
    </>
  )
}
