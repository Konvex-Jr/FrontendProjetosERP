import { useEffect, useRef, useState } from 'react'
import { blobDeFotoValido, LADO_FOTO, quadradoDeRecorte, validarArquivoFoto } from '../lib/foto'
import { minhaConta } from '../services/pessoas'
import alerts from '../lib/alerts'
import ZonaEnvio from './ZonaEnvio'

const PREVIA = 256
const SEM_IMAGEM = 'Seu navegador não gerou a imagem. Tente outro navegador.'

/**
 * Janela "Trocar foto": escolhe a imagem, enquadra (arrastar com mouse ou dedo, zoom de 1 a 3) e salva
 * uma imagem 256×256 (WebP, ou JPEG onde o navegador não gera WebP). `aoSalvo()` roda depois do
 * envio, para a tela recarregar. A prévia é a própria
 * área recortada: o que se vê é o que vai ser salvo.
 */
export default function FotoModal({ aoFechar, aoSalvo }) {
  const [arquivo, setArquivo] = useState(null)
  const [url, setUrl] = useState('')
  const [imagem, setImagem] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [corte, setCorte] = useState({ zoom: 1, x: 0.5, y: 0.5 })
  const arrasto = useRef(null)

  useEffect(() => {
    if (!arquivo) return
    const endereco = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      setImagem(img)
      setUrl(endereco)
    }
    img.onerror = () => setErro('Não foi possível abrir esta imagem.')
    img.src = endereco
    return () => URL.revokeObjectURL(endereco)
  }, [arquivo])

  const escolher = ([file]) => {
    const problema = validarArquivoFoto(file)
    setErro(problema || '')
    if (problema) return
    setImagem(null)
    setCorte({ zoom: 1, x: 0.5, y: 0.5 })
    setArquivo(file)
  }

  const geometria = imagem && quadradoDeRecorte({ largura: imagem.naturalWidth, altura: imagem.naturalHeight, ...corte })
  const escala = geometria ? PREVIA / geometria.lado : 1

  const comecar = e => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    arrasto.current = { px: e.clientX, py: e.clientY, sx: geometria.sx, sy: geometria.sy }
  }
  const mover = e => {
    const a = arrasto.current
    if (!a || !imagem) return
    const folgaX = imagem.naturalWidth - geometria.lado
    const folgaY = imagem.naturalHeight - geometria.lado
    // Arrastar a imagem para a direita mostra mais da esquerda: o quadrado anda no sentido contrário.
    const sx = a.sx - (e.clientX - a.px) / escala
    const sy = a.sy - (e.clientY - a.py) / escala
    setCorte(c => ({ ...c, x: folgaX > 0 ? sx / folgaX : 0.5, y: folgaY > 0 ? sy / folgaY : 0.5 }))
  }
  const soltar = () => {
    arrasto.current = null
  }

  const salvar = async () => {
    if (!imagem || salvando) return
    setSalvando(true)
    setErro('')
    try {
      const { sx, sy, lado } = geometria
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = LADO_FOTO
      canvas.getContext('2d').drawImage(imagem, sx, sy, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO)
      const gerar = tipo => new Promise(resolve => canvas.toBlob(resolve, tipo, 0.85))
      // Safari e iPhone não geram WebP pelo canvas (devolvem PNG): aí vai JPEG, e o servidor converte.
      let blob = await gerar('image/webp')
      if (!blobDeFotoValido(blob)) blob = await gerar('image/jpeg')
      if (!blobDeFotoValido(blob)) throw new Error(SEM_IMAGEM)
      await minhaConta.enviarFoto(blob)
      alerts.toastSuccess('Foto atualizada')
      await aoSalvo?.()
      aoFechar()
    } catch (error) {
      setErro(error.message)
      setSalvando(false)
    }
  }

  const fechar = () => !salvando && aoFechar()

  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={fechar}>
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-body">
              <h3 className="h5 fw-bold mb-3">Trocar foto</h3>
              {!imagem && (
                <ZonaEnvio
                  aoEscolher={escolher}
                  multiple={false}
                  rotulo="Escolher imagem"
                  dica="JPEG, PNG ou WebP, até 5 MB."
                  accept="image/jpeg,image/png,image/webp"
                />
              )}
              {imagem && (
                <>
                  <div
                    className="foto-previa"
                    style={{ width: PREVIA, height: PREVIA }}
                    onPointerDown={comecar}
                    onPointerMove={mover}
                    onPointerUp={soltar}
                    onPointerCancel={soltar}
                  >
                    <img
                      src={url}
                      alt="Prévia da foto"
                      draggable={false}
                      style={{
                        width: imagem.naturalWidth * escala,
                        height: imagem.naturalHeight * escala,
                        left: -geometria.sx * escala,
                        top: -geometria.sy * escala,
                      }}
                    />
                  </div>
                  <label className="form-label w-100 mt-3">
                    Zoom
                    <input
                      type="range"
                      className="form-range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={corte.zoom}
                      onChange={e => setCorte(c => ({ ...c, zoom: Number(e.target.value) }))}
                    />
                  </label>
                  <small className="d-block">Arraste a imagem para enquadrar o rosto.</small>
                </>
              )}
              {erro && (
                <small className="d-block mt-2 text-danger" role="alert">
                  {erro}
                </small>
              )}
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-g" onClick={fechar}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" disabled={!imagem || salvando} onClick={salvar}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
