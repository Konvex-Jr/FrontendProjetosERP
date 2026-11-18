import { useState } from 'react'
import { fotoUrl } from '../lib/foto'
import { ini } from '../lib/utils'

/**
 * Círculo da pessoa: a foto, ou as iniciais quando não há foto ou ela não carrega.
 * `pessoa` = { nome, foto }. O erro de carga fica guardado junto da foto que falhou: outra foto
 * (ou outra pessoa na mesma aba) tenta de novo, sem estado preso. Demais props vão para o `<span>`.
 */
export default function Avatar({ pessoa, tamanho = 'normal', className = '', ...resto }) {
  const [falhou, setFalhou] = useState(null)
  const nome = pessoa?.nome || '?'
  const url = fotoUrl(pessoa?.foto)
  const comFoto = url && falhou !== pessoa.foto
  return (
    <span className={['av', tamanho === 'grande' ? 'big' : '', comFoto ? 'com-foto' : '', className].filter(Boolean).join(' ')} {...resto}>
      {comFoto ? <img src={url} alt={nome} loading="lazy" onError={() => setFalhou(pessoa.foto)} /> : ini(nome)}
    </span>
  )
}
