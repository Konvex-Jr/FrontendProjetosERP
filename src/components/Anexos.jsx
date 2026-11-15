import { useEffect, useRef, useState } from 'react'
import Ic from './Icon'
import alerts from '../lib/alerts'
import {
  ACEITA,
  DICA,
  acaoAoAbrir,
  adaptAnexo,
  anexos as api,
  avisoEnviados,
  enviarVarios,
  podeVer,
  progressoVisivel,
  resumoFalhas,
  textoProgresso,
} from '../services/anexos'
import { fd } from '../lib/utils'

/** Mesma largura do celular em responsive.css: lá o PDF baixa em vez de abrir na janela. */
const CELULAR = '(max-width: 575.98px)'
const ehCelular = () => typeof matchMedia === 'function' && matchMedia(CELULAR).matches

/**
 * Zona de envio: o botão abre o seletor (alternativa de teclado) e a área aceita arquivos soltos.
 * Entrega a lista inteira em `aoEscolher(arquivos)`; quem chama confere e envia.
 * `ocupado = { atual, total }` trava a zona e mostra "Enviando 2 de 5…".
 */
export function ZonaEnvio({ aoEscolher, multiple = true, rotulo = 'Anexar arquivos', ocupado, dica = DICA, accept = ACEITA }) {
  const entrada = useRef(null)
  // Contador: arrastar por cima de um filho dispara dragleave no pai; só sai do estado quando volta a zero.
  const dentro = useRef(0)
  const [sobre, setSobre] = useState(false)
  const entregar = lista => {
    const arquivos = [...(lista || [])]
    if (arquivos.length) aoEscolher(multiple ? arquivos : arquivos.slice(0, 1))
  }
  const temArquivos = e => [...(e.dataTransfer?.types || [])].includes('Files')
  const arrastar = {
    onDragEnter: e => {
      if (!temArquivos(e)) return
      e.preventDefault()
      dentro.current++
      setSobre(true)
    },
    onDragOver: e => {
      if (!temArquivos(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = ocupado ? 'none' : 'copy'
    },
    onDragLeave: () => {
      dentro.current = Math.max(0, dentro.current - 1)
      if (!dentro.current) setSobre(false)
    },
    onDrop: e => {
      e.preventDefault()
      dentro.current = 0
      setSobre(false)
      if (!ocupado) entregar(e.dataTransfer?.files)
    },
  }
  const progresso = textoProgresso(ocupado)
  return (
    <div className={'ze' + (sobre && !ocupado ? ' is-over' : '') + (ocupado ? ' is-busy' : '')} {...arrastar}>
      <input
        ref={entrada}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={e => {
          const arquivos = [...(e.target.files || [])]
          // Limpa o input para a pessoa poder escolher o mesmo arquivo de novo.
          e.target.value = ''
          entregar(arquivos)
        }}
      />
      <button type="button" className="btn btn-g btn-sm" disabled={Boolean(ocupado)} onClick={() => entrada.current?.click()}>
        <Ic k="upload" />
        {rotulo}
      </button>
      <span className="ze-t" aria-live="polite">
        {progresso ? (
          progresso
        ) : (
          <>
            <Ic k="clip" />
            {multiple ? 'ou arraste os arquivos para cá' : 'ou arraste o arquivo para cá'}
          </>
        )}
      </span>
      {dica && <small className="ze-d">{dica}</small>}
    </div>
  )
}

/**
 * Baixa com a sessão (um link direto não levaria o token) e mostra o erro num alerta.
 * Usa o arquivo guardado na aba quando houver; `aoProgresso(recebidos, total)` acompanha a busca.
 */
export async function baixarAnexo(anexo, aoProgresso) {
  try {
    await api.baixar(anexo, { aoProgresso })
  } catch (error) {
    await alerts.error('Não foi possível baixar o arquivo', error.message)
  }
}

/**
 * Estado de um download por anexo: `baixar(anexo)` marca o anexo enquanto chega e `progresso(id)`
 * diz o que mostrar (null em arquivo pequeno). Um anexo em download não começa outro igual.
 */
function useDownloads() {
  const [andamento, setAndamento] = useState({})
  const baixar = async anexo => {
    if (andamento[anexo.id]) return
    const marcar = valor => setAndamento(atual => ({ ...atual, [anexo.id]: valor }))
    marcar({ recebidos: 0, total: null, bytes: anexo.bytes })
    try {
      await baixarAnexo(anexo, (recebidos, total) => marcar({ recebidos, total, bytes: anexo.bytes }))
    } finally {
      setAndamento(({ [anexo.id]: _, ...resto }) => resto)
    }
  }
  return { baixar, emAndamento: id => Boolean(andamento[id]), progresso: id => progressoVisivel(andamento[id], andamento[id]?.bytes) }
}

/** Botão "Baixar": enquanto chega, fica ocupado e mostra o progresso (o fundo enche até 100%). */
function BotaoBaixar({ anexo, downloads, comTexto = false }) {
  const ocupado = downloads.emAndamento(anexo.id)
  const p = downloads.progresso(anexo.id)
  const rotulo = p ? p.texto : 'Baixar'
  return (
    <button
      type="button"
      className={'btn btn-g btn-sm' + (p ? ' btn-prog' : '')}
      style={p?.pct != null ? { '--p': `${p.pct}%` } : undefined}
      onClick={() => downloads.baixar(anexo)}
      disabled={ocupado}
      aria-busy={ocupado || undefined}
      aria-label={comTexto ? undefined : rotulo}
      data-tip={comTexto ? undefined : rotulo}
    >
      {p && !comTexto ? <span className="btn-prog-t">{p.pct == null ? '…' : `${p.pct}%`}</span> : <Ic k="download" />}
      {comTexto && rotulo}
    </button>
  )
}

/** Barra de progresso de quem está abrindo um arquivo grande; sem o total, barra em movimento e "Baixando…". */
function BarraProgresso({ progresso }) {
  const definida = progresso.pct != null
  return (
    <div className="jv-p" role="status">
      <div
        className={'jv-b' + (definida ? '' : ' is-ind')}
        role="progressbar"
        aria-label="Progresso do download"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={definida ? progresso.pct : undefined}
      >
        <span style={definida ? { width: `${progresso.pct}%` } : undefined} />
      </div>
      <p className="jv-m">{progresso.texto}</p>
    </div>
  )
}

/**
 * Janela que mostra PDF (iframe) ou imagem (img) de um anexo, baixado com a sessão.
 * O arquivo vira um endereço local (blob:) com o tipo pela extensão; ele é revogado ao fechar.
 */
export function JanelaAnexo({ anexo, fechar }) {
  const [arquivo, setArquivo] = useState(null)
  const [erro, setErro] = useState('')
  const [chegando, setChegando] = useState(null)
  const progresso = progressoVisivel(chegando, anexo.bytes)
  const downloads = useDownloads()
  const botaoFechar = useRef(null)
  useEffect(() => {
    let vivo = true
    let url = ''
    // Se o arquivo já foi antecipado ou está guardado na aba, chega na hora (sem barra).
    api.abrir(anexo, { aoProgresso: (recebidos, total) => vivo && setChegando({ recebidos, total }) }).then(
      r => {
        url = r.url
        if (vivo) setArquivo(r)
        else URL.revokeObjectURL(url)
      },
      error => vivo && setErro(error.message),
    )
    return () => {
      vivo = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [anexo])
  // Foco entra no "Fechar" e volta para onde estava (o nome do arquivo) ao fechar.
  useEffect(() => {
    const antes = document.activeElement
    botaoFechar.current?.focus()
    return () => antes?.focus?.()
  }, [])
  // Esc fecha com o foco em qualquer lugar fora do PDF (no body também). Escuta na captura da janela
  // e para o evento ali: um modal por baixo (ex.: tarefa, que escuta no window) não fecha junto.
  // Com o foco dentro do leitor de PDF do Chromium, a tecla não chega à página; fica o botão "Fechar".
  useEffect(() => {
    const tecla = e => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      fechar()
    }
    addEventListener('keydown', tecla, true)
    return () => removeEventListener('keydown', tecla, true)
  }, [fechar])
  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={fechar}>
        <div
          className="modal-dialog modal-dialog-centered modal-xl jv"
          role="dialog"
          aria-modal="true"
          aria-label={anexo.nome}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="jv-h">
              <h3 className="h6 fw-bold m-0">{anexo.nome}</h3>
              <span className="d-flex gap-2">
                <BotaoBaixar anexo={anexo} downloads={downloads} comTexto />
                <button ref={botaoFechar} type="button" className="btn btn-g btn-sm" onClick={fechar}>
                  <Ic k="x" />
                  Fechar
                </button>
              </span>
            </div>
            <div className="jv-c">
              {erro ? (
                <p className="jv-m">Não foi possível abrir o arquivo. {erro} Use “Baixar” para tentar de novo.</p>
              ) : !arquivo ? (
                progresso ? (
                  <BarraProgresso progresso={progresso} />
                ) : (
                  <p className="jv-m" role="status">
                    Abrindo…
                  </p>
                )
              ) : arquivo.tipo === 'application/pdf' ? (
                // Sem `sandbox`: ele quebra o leitor de PDF do Chromium. Só chega PDF aqui, porque o tipo
                // do Blob é forçado pela extensão (VISUALIZAVEIS), nunca pelo que a resposta diz.
                <iframe title={anexo.nome} src={arquivo.url} />
              ) : (
                <img src={arquivo.url} alt={anexo.nome} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Seção de anexos das fichas (Biblioteca, Capacitações). `lista` vem da API (formato bruto);
 * `dono` é o caminho do dono na API ('biblioteca', 'capacitacoes'); quem pode alterar o item anexa.
 * Exclusão por anexo: `podeExcluir` da API quando vier (tarefas), senão `podeAlterar`.
 * Clique no nome: PDF e imagem abrem na janela; o resto (e PDF no celular) baixa.
 */
export default function Anexos({ dono, codigo, lista, podeAlterar, aoMudar }) {
  const itens = (lista || []).map(adaptAnexo)
  const [vendo, setVendo] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const downloads = useDownloads()
  const abrir = a => (acaoAoAbrir(a.nome, ehCelular()) === 'janela' ? setVendo(a) : downloads.baixar(a))
  // Passar o mouse, focar ou tocar no nome já começa a baixar PDF e imagem pequenos (até 5 MB):
  // o clique que vem depois abre com o arquivo na aba. A regra fica em anexos.antecipar.
  const antecipar = a => () => api.antecipar(a)
  const enviar = async arquivos => {
    setOcupado({ atual: 1, total: arquivos.length })
    let resultado
    try {
      resultado = await enviarVarios(dono, codigo, arquivos, undefined, (atual, total) => setOcupado({ atual, total }))
    } finally {
      setOcupado(null)
    }
    const { enviados, falhas } = resultado
    if (enviados) aoMudar?.()
    // Um alerta substitui o outro na tela: com falhas, o total enviado vai junto no texto do erro.
    if (falhas.length)
      await alerts.error('Alguns arquivos não foram enviados', (enviados ? `${avisoEnviados(enviados)}.\n` : '') + resumoFalhas(falhas))
    else alerts.toastSuccess(avisoEnviados(enviados))
  }
  const excluir = async a => {
    const ok = await alerts.confirm({ title: 'Excluir anexo?', text: a.nome, confirmText: 'Excluir anexo', danger: true })
    if (!ok) return
    try {
      await api.excluir(a.id)
      alerts.toastSuccess('Anexo excluído')
      aoMudar?.()
    } catch (error) {
      await alerts.error('Não foi possível excluir o anexo', error.message)
    }
  }
  return (
    <>
      {itens.length ? (
        <ul className="ax">
          {itens.map(a => (
            <li key={a.id}>
              <button
                type="button"
                className="ax-n"
                onClick={() => abrir(a)}
                onPointerEnter={antecipar(a)}
                onFocus={antecipar(a)}
                onTouchStart={antecipar(a)}
                title={podeVer(a.nome) ? 'Ver' : 'Baixar'}
              >
                <Ic k="file" />
                <span>{a.nome}</span>
              </button>
              <small>
                {a.tamanho} · {a.enviadoPor} · {fd(a.data)}
              </small>
              <span className="ax-a">
                <BotaoBaixar anexo={a} downloads={downloads} />
                {(a.podeExcluir ?? podeAlterar) && (
                  <button type="button" className="btn btn-g btn-sm" onClick={() => excluir(a)} aria-label="Excluir" data-tip="Excluir">
                    <Ic k="trash" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <small className="d-block mb-2">
          {podeAlterar
            ? 'Nenhum arquivo ainda. Use “Anexar arquivos” ou arraste para cá PDFs, planilhas, apresentações ou imagens.'
            : 'Nenhum arquivo anexado.'}
        </small>
      )}
      {podeAlterar && (
        <div className="mt-2">
          <ZonaEnvio aoEscolher={enviar} ocupado={ocupado} />
        </div>
      )}
      {vendo && <JanelaAnexo anexo={vendo} fechar={() => setVendo(null)} />}
    </>
  )
}
