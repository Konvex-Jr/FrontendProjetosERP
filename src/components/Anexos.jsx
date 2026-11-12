import { useRef, useState } from 'react'
import Ic from './Icon'
import alerts from '../lib/alerts'
import { ACEITA, DICA, adaptAnexo, anexos as api, conferirArquivo } from '../services/anexos'
import { fd } from '../lib/utils'

/** Botão que abre o seletor de arquivo, confere tamanho/tipo e chama `enviar(arquivo)`. */
export function BotaoAnexar({ enviar, rotulo = 'Anexar arquivo', className = 'btn btn-g' }) {
  const entrada = useRef(null)
  const [enviando, setEnviando] = useState(false)
  const escolher = async e => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    const problema = conferirArquivo(arquivo)
    if (problema) return alerts.error('Arquivo não enviado', problema)
    setEnviando(true)
    try {
      await enviar(arquivo)
      alerts.toastSuccess('Arquivo enviado')
    } catch (error) {
      await alerts.error('Não foi possível enviar o arquivo', error.message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <>
      <input ref={entrada} type="file" accept={ACEITA} hidden onChange={escolher} />
      <button type="button" className={className} disabled={enviando} onClick={() => entrada.current?.click()}>
        <Ic k="upload" />
        {enviando ? 'Enviando…' : rotulo}
      </button>
    </>
  )
}

export async function baixarAnexo(anexo) {
  try {
    await api.baixar(anexo)
  } catch (error) {
    await alerts.error('Não foi possível baixar o arquivo', error.message)
  }
}

/**
 * Seção de anexos das fichas (Base e Iniciativas). `lista` vem da API (formato bruto);
 * `dono` é 'conhecimento' ou 'iniciativas'; quem pode alterar o item anexa e exclui.
 */
export default function Anexos({ dono, codigo, lista, podeAlterar, aoMudar }) {
  const itens = (lista || []).map(adaptAnexo)
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
              <button type="button" className="ax-n" onClick={() => baixarAnexo(a)} title="Baixar">
                <Ic k="file" />
                <span>{a.nome}</span>
              </button>
              <small>
                {a.tamanho} · {a.enviadoPor} · {fd(a.data)}
              </small>
              <span className="ax-a">
                <button type="button" className="btn btn-g btn-sm" onClick={() => baixarAnexo(a)} aria-label="Baixar" data-tip="Baixar">
                  <Ic k="download" />
                </button>
                {podeAlterar && (
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
            ? 'Nenhum arquivo ainda. Use “Anexar arquivo” para guardar PDFs, planilhas, apresentações ou imagens.'
            : 'Nenhum arquivo anexado.'}
        </small>
      )}
      {podeAlterar && (
        <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
          <BotaoAnexar
            enviar={async arquivo => {
              await api.enviar(dono, codigo, arquivo)
              aoMudar?.()
            }}
          />
          <small>{DICA}</small>
        </div>
      )}
    </>
  )
}
