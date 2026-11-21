import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Ic from './Icon'
import { avisos } from '../services/avisos'
import { destinoAviso, temAlerta, textoAviso } from '../lib/avisos'
import { fm } from '../lib/utils'

const INTERVALO = 120000
const GRUPOS_DE_TAREFAS = ['tarefas_atrasadas', 'tarefas_a_vencer']

// Sobrecarga vem em grupo; no painel vira uma linha por pessoa.
const linhasDaSituacao = situacao =>
  (situacao || []).flatMap(i => (i.tipo === 'sobrecarga' && i.pessoas ? i.pessoas.map(p => ({ tipo: 'sobrecarga', ...p })) : [i]))

/** Sininho da barra do topo: avisos gravados ("Novos") e situação de agora ("Agora"). */
export default function Avisos({ me }) {
  const [aberto, setAberto] = useState(false)
  const [dados, setDados] = useState(null)
  const [expandido, setExpandido] = useState({})
  const raiz = useRef(null)
  const pessoa = useRef(me)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Troca de pessoa na mesma aba: o painel da anterior some e respostas dela são descartadas.
  const [dona, setDona] = useState(me)
  if (dona !== me) {
    setDona(me)
    setDados(null)
    setAberto(false)
  }
  useEffect(() => {
    pessoa.current = me
  }, [me])

  const carregar = useCallback(async () => {
    const quem = me
    try {
      const r = await avisos.listar()
      if (pessoa.current === quem) setDados(r)
    } catch {
      /* o sininho não incomoda com erro; tenta de novo na próxima */
    }
  }, [me])

  // Buscar na API ao montar e ao navegar é sincronizar com sistema externo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar, pathname])

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && carregar(), INTERVALO)
    return () => clearInterval(id)
  }, [carregar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (aberto) carregar()
  }, [aberto, carregar])

  useEffect(() => {
    if (!aberto) return undefined
    const esc = e => e.key === 'Escape' && setAberto(false)
    const fora = e => raiz.current && !raiz.current.contains(e.target) && setAberto(false)
    document.addEventListener('keydown', esc)
    document.addEventListener('mousedown', fora)
    return () => {
      document.removeEventListener('keydown', esc)
      document.removeEventListener('mousedown', fora)
    }
  }, [aberto])

  const naoLidos = dados?.naoLidos || 0
  const gravados = dados?.gravados || []
  const situacao = linhasDaSituacao(dados?.situacao)

  const ir = destino => {
    setAberto(false)
    if (destino) navigate(destino)
  }
  const abrirGravado = async item => {
    const quem = me
    try {
      await avisos.marcarLidos([item.codigo])
    } catch {
      /* navega mesmo assim */
    }
    if (pessoa.current === quem) {
      setDados(
        d =>
          d && {
            ...d,
            naoLidos: item.lido ? d.naoLidos : Math.max(0, d.naoLidos - 1),
            gravados: d.gravados.map(g => (g.codigo === item.codigo ? { ...g, lido: true } : g)),
          },
      )
      ir(destinoAviso(item))
    }
  }
  const marcarTudo = async () => {
    const quem = me
    try {
      await avisos.marcarLidos()
    } catch {
      return
    }
    if (pessoa.current === quem) setDados(d => d && { ...d, naoLidos: 0, gravados: d.gravados.map(g => ({ ...g, lido: true })) })
  }

  const vazio = !gravados.length && !situacao.length
  return (
    <div className="av-sino" ref={raiz}>
      <button
        className="tg"
        aria-label={`Avisos (${naoLidos} não lidos)`}
        aria-expanded={aberto}
        title="Avisos"
        onClick={() => setAberto(a => !a)}
      >
        <Ic k="sino" />
        {naoLidos > 0 && <span className="av-n">{naoLidos > 99 ? '99+' : naoLidos}</span>}
        {temAlerta(dados?.situacao) && <span className="av-ponto" aria-hidden="true" />}
      </button>
      {aberto && (
        <div className="av-painel" role="dialog" aria-label="Avisos">
          <div className="av-topo">
            <b>Avisos</b>
            {naoLidos > 0 && (
              <button className="btn btn-g btn-sm" onClick={marcarTudo}>
                Marcar tudo como lido
              </button>
            )}
            <button className="btn btn-g btn-sm av-fechar" aria-label="Fechar avisos" onClick={() => setAberto(false)}>
              <Ic k="x" />
            </button>
          </div>
          {vazio && <p className="av-vazio">Nada por aqui.</p>}
          {gravados.length > 0 && (
            <section>
              <h6>Novos</h6>
              {gravados.map(g => (
                <button key={g.codigo} className={'av-item' + (g.lido ? '' : ' nao-lido')} onClick={() => abrirGravado(g)}>
                  {textoAviso(g)}
                </button>
              ))}
            </section>
          )}
          {situacao.length > 0 && (
            <section>
              <h6>Agora</h6>
              {situacao.map((s, i) => {
                const chave = s.tipo + (s.codigoUsuario || s.capacitacao?.codigo || i)
                if (GRUPOS_DE_TAREFAS.includes(s.tipo)) {
                  const aberta = !!expandido[s.tipo]
                  return (
                    <div key={chave}>
                      <button className="av-item" aria-expanded={aberta} onClick={() => setExpandido(e => ({ ...e, [s.tipo]: !aberta }))}>
                        {textoAviso(s)}
                      </button>
                      {aberta &&
                        s.tarefas.map(t => (
                          <button key={t.codigo} className="av-item av-sub" onClick={() => ir(`/tarefas?tarefa=${t.codigo}`)}>
                            {t.titulo}
                            <small>
                              {t.projeto?.nome ? `${t.projeto.nome} · ` : ''}
                              {t.dataFim ? fm(t.dataFim) : ''}
                            </small>
                          </button>
                        ))}
                    </div>
                  )
                }
                const destino = destinoAviso(s)
                return (
                  <button key={chave} className="av-item" onClick={() => ir(destino)} disabled={!destino}>
                    {textoAviso(s)}
                  </button>
                )
              })}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
