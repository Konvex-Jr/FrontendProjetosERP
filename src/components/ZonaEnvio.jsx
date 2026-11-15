import { useRef, useState } from 'react'
import Ic from './Icon'
import { ACEITA, DICA, textoProgresso } from '../services/anexos'

// Fora de Anexos.jsx: o formulário (FormModal, no pacote de entrada) usa a zona sem levar
// a janela de visualização, o botão de download e a barra de progresso (o resto de Anexos.jsx, carregado depois).

/**
 * Zona de envio: o botão abre o seletor (alternativa de teclado) e a área aceita arquivos soltos.
 * Entrega a lista inteira em `aoEscolher(arquivos)`; quem chama confere e envia.
 * `ocupado = { atual, total }` trava a zona e mostra "Enviando 2 de 5…".
 */
export default function ZonaEnvio({ aoEscolher, multiple = true, rotulo = 'Anexar arquivos', ocupado, dica = DICA, accept = ACEITA }) {
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
