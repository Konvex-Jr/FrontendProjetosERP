import { API_URL } from '../services/api.js'

/** Foto de perfil: conferências e cálculo do recorte, sem tocar em tela. */
export const LIMITE_ENTRADA = 5 * 1024 * 1024
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
export const LADO_FOTO = 256
const NOME_FOTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/

/** Endereço público da foto, ou null se não há foto (ou o nome não é de um arquivo nosso). */
export const fotoUrl = (foto, base = API_URL) => (typeof foto === 'string' && NOME_FOTO.test(foto) ? `${base}/fotos/${foto}` : null)

const entre = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))

/**
 * Quadrado a recortar da imagem. `zoom` ≥ 1 diminui o lado; `x` e `y` (0 a 1) posicionam
 * o quadrado dentro da folga da imagem. O resultado nunca passa dos limites.
 */
export function quadradoDeRecorte({ largura, altura, zoom, x, y }) {
  const lado = Math.min(largura, altura) / Math.max(1, Number(zoom) || 1)
  return { sx: entre(x, 0, 1) * (largura - lado), sy: entre(y, 0, 1) * (altura - lado), lado }
}

/** Mensagem do problema com o arquivo escolhido, ou null se pode seguir. */
export function validarArquivoFoto(file) {
  if (!file || !TIPOS_FOTO.includes(file.type)) return 'Escolha uma imagem JPEG, PNG ou WebP.'
  if (file.size > LIMITE_ENTRADA) return 'A imagem pode ter até 5 MB.'
  return null
}
