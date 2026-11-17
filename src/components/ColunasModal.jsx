import { useEffect, useRef, useState } from 'react'
import { CORES, corpoColunas, efeitoNaConclusao, erroDoRascunho, excluidasComTarefas, marcar, mover, novoRascunho } from '../lib/colunas'
import alerts from '../lib/alerts'
import Ic from './Icon'

const rotuloCor = cor => cor.charAt(0).toUpperCase() + cor.slice(1)
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Janela "Editar colunas" do quadro. `colunas` no formato da tela (ver `adaptColuna`), `tarefas` as do projeto.
 * `aoSalvar(corpo)` grava (PUT) e recarrega; se falhar, a janela continua aberta. Erro 409 (quadro mudou
 * enquanto a janela estava aberta): o rascunho recomeça das colunas já recarregadas.
 * Coluna excluída que tem tarefas sai da lista e vira uma linha "Mover N tarefas para", com o destino obrigatório.
 */
export default function ColunasModal({ colunas, tarefas, aoSalvar, aoFechar }) {
  const [rascunho, setRascunho] = useState(() => novoRascunho(colunas))
  const [destinos, setDestinos] = useState({})
  const [salvando, setSalvando] = useState(false)
  const contador = useRef(0)
  const foco = useRef(null)
  const ultimas = useRef(colunas)
  useEffect(() => {
    ultimas.current = colunas
  }, [colunas])

  const excluidas = excluidasComTarefas(colunas, rascunho, tarefas)
  const faltaDestino = excluidas.find(x => !rascunho.some(r => !r.nova && r.id === destinos[x.coluna.id]))
  const erro =
    erroDoRascunho(rascunho) || (faltaDestino ? `Escolha para onde vão as tarefas da coluna "${faltaDestino.coluna.nome}".` : null)
  const alterado = !igual(rascunho, novoRascunho(colunas)) || Object.keys(destinos).length > 0
  const naoNovas = rascunho.filter(r => !r.nova)

  useEffect(() => {
    // Coluna nova recebe o foco no campo do nome (teclado).
    if (foco.current) {
      document.getElementById(`col-nome-${foco.current}`)?.focus()
      foco.current = null
    }
  }, [rascunho.length])

  const fechar = async () => {
    if (salvando) return
    if (
      alterado &&
      !(await alerts.confirm({
        title: 'Descartar as alterações?',
        text: 'As mudanças nas colunas ainda não foram salvas.',
        confirmText: 'Descartar',
        danger: true,
      }))
    )
      return
    aoFechar()
  }
  const fecharRef = useRef(fechar)
  useEffect(() => {
    fecharRef.current = fechar
  })
  useEffect(() => {
    const k = e => e.key == 'Escape' && !document.querySelector('.swal2-popup:not(.swal2-toast)') && fecharRef.current()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  const mudar = (id, campos) => setRascunho(r => r.map(c => (c.id === id ? { ...c, ...campos } : c)))

  const nova = () => {
    contador.current += 1
    const linha = { id: `nova-${contador.current}`, nome: '', cor: 'cinza', papel: 'meio', nova: true }
    const i = rascunho.findIndex(c => c.papel === 'concluida')
    setRascunho(r => [...r.slice(0, i < 0 ? r.length : i), linha, ...r.slice(i < 0 ? r.length : i)])
    foco.current = linha.id
  }

  const excluir = id => {
    setRascunho(r => r.filter(c => c.id !== id))
    setDestinos(d => Object.fromEntries(Object.entries(d).filter(([k, v]) => k !== id && v !== id)))
  }

  const desfazer = coluna => {
    const indice = colunas.findIndex(c => c.id === coluna.id)
    setRascunho(r => {
      const i = Math.min(indice, r.length)
      return [...r.slice(0, i), { ...novoRascunho([coluna])[0] }, ...r.slice(i)]
    })
    setDestinos(d => Object.fromEntries(Object.entries(d).filter(([k]) => k !== coluna.id)))
  }

  const salvar = async () => {
    if (erro || salvando) return
    const usados = Object.fromEntries(excluidas.map(x => [x.coluna.id, destinos[x.coluna.id]]))
    const { concluem, reabrem } = efeitoNaConclusao(colunas, rascunho, usados, tarefas)
    if (concluem > 0 || reabrem > 0) {
      const ok = await alerts.confirm({
        title: 'Trocar a coluna concluída?',
        text: `${concluem} ${concluem == 1 ? 'tarefa passa a contar como concluída' : 'tarefas passam a contar como concluídas'} hoje e ${reabrem} ${reabrem == 1 ? 'volta a aberta' : 'voltam a abertas'}.`,
        confirmText: 'Salvar',
      })
      if (!ok) return
    }
    setSalvando(true)
    try {
      await aoSalvar(corpoColunas(rascunho, usados))
      aoFechar()
    } catch (e) {
      if (e.status === 409) {
        setRascunho(novoRascunho(ultimas.current))
        setDestinos({})
      }
      await alerts.error('Não foi possível salvar', e.message)
    } finally {
      setSalvando(false)
    }
  }

  const ultimo = rascunho.length - 1
  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={fechar}>
        <div
          className="modal-dialog modal-dialog-centered modal-dialog-scrollable cl-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Editar colunas do quadro"
          onClick={e => e.stopPropagation()}
        >
          <form
            className="modal-content"
            onSubmit={e => {
              e.preventDefault()
              salvar()
            }}
          >
            <div className="modal-body">
              <h3 className="h5 fw-bold mb-1">Colunas do quadro</h3>
              <p className="text-muted small mb-3">
                De 2 a 12 colunas. A de entrada recebe as tarefas novas; a concluída conta no progresso do projeto.
              </p>
              <div className="cl-lista">
                {rascunho.map((c, i) => {
                  const marca = c.papel === 'entrada' ? 'entrada' : c.papel === 'concluida' ? 'concluída' : ''
                  const travada = Boolean(marca) || rascunho.length <= 2
                  const dica = marca
                    ? `Marque outra coluna como ${marca} antes de excluir`
                    : rascunho.length <= 2
                      ? 'O quadro precisa de pelo menos 2 colunas'
                      : `Excluir a coluna ${c.nome || i + 1}`
                  const nome = c.nome || `${i + 1}`
                  return (
                    <div className={'cl-linha kc-' + c.cor} key={c.id}>
                      <div className="cl-mover">
                        <button
                          type="button"
                          className="btn btn-g btn-sm"
                          aria-label={`Subir coluna ${nome}`}
                          disabled={i === 0}
                          onClick={() => setRascunho(r => mover(r, i, -1))}
                        >
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-g btn-sm"
                          aria-label={`Descer coluna ${nome}`}
                          disabled={i === ultimo}
                          onClick={() => setRascunho(r => mover(r, i, 1))}
                        >
                          <span aria-hidden="true">↓</span>
                        </button>
                      </div>
                      <input
                        id={`col-nome-${c.id}`}
                        className="form-control cl-nome"
                        aria-label={`Nome da coluna ${i + 1}`}
                        maxLength={40}
                        value={c.nome}
                        onChange={e => mudar(c.id, { nome: e.target.value })}
                      />
                      <div className="cl-cores" role="group" aria-label={`Cor da coluna ${nome}`}>
                        {CORES.map(cor => (
                          <button
                            type="button"
                            key={cor}
                            className={'cl-cor kc-' + cor}
                            title={rotuloCor(cor)}
                            aria-label={`${rotuloCor(cor)}, cor da coluna ${nome}`}
                            aria-pressed={c.cor === cor}
                            onClick={() => mudar(c.id, { cor })}
                          />
                        ))}
                      </div>
                      <div className="cl-papeis">
                        <label className="cl-op">
                          <input
                            type="radio"
                            name="col-entrada"
                            checked={c.papel === 'entrada'}
                            onChange={() => setRascunho(r => marcar(r, c.id, 'entrada'))}
                          />
                          entrada
                        </label>
                        <label className="cl-op">
                          <input
                            type="radio"
                            name="col-concluida"
                            checked={c.papel === 'concluida'}
                            onChange={() => setRascunho(r => marcar(r, c.id, 'concluida'))}
                          />
                          concluída
                        </label>
                      </div>
                      <button
                        type="button"
                        className="btn btn-g btn-sm cl-excluir"
                        aria-label={`Excluir coluna ${nome}`}
                        title={dica}
                        disabled={travada}
                        onClick={() => excluir(c.id)}
                      >
                        <Ic k="trash" />
                      </button>
                    </div>
                  )
                })}
                {excluidas.map(({ coluna, quantidade }) => (
                  <div className={'cl-linha cl-excluida kc-' + coluna.cor} key={coluna.id}>
                    <span className="cl-nome-ex">
                      <s>{coluna.nome}</s> excluída
                    </span>
                    <label className="cl-destino">
                      <span>
                        Mover {quantidade} {quantidade == 1 ? 'tarefa' : 'tarefas'} para:
                      </span>
                      <select
                        className="form-select"
                        value={destinos[coluna.id] || ''}
                        onChange={e => setDestinos(d => ({ ...d, [coluna.id]: e.target.value }))}
                      >
                        <option value="">Escolha a coluna</option>
                        {naoNovas.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="btn btn-g btn-sm" onClick={() => desfazer(coluna)}>
                      Desfazer
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-g mt-3"
                disabled={rascunho.length >= 12}
                title={rascunho.length >= 12 ? 'O quadro aceita no máximo 12 colunas' : ''}
                onClick={nova}
              >
                <Ic k="plus" />
                Nova coluna
              </button>
              {erro && (
                <p className="cl-erro" role="alert">
                  {erro}
                </p>
              )}
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-g" onClick={fechar}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={Boolean(erro) || salvando}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
