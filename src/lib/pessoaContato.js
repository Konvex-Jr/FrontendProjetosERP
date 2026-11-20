/** Telefone e área de transferência (sessão 25b). */

const soDigitos = texto => String(texto ?? '').replace(/\D/g, '')

/** Só dígitos (até 11), com a máscara parcial enquanto a pessoa digita. */
export function mascararTelefone(texto) {
  const d = soDigitos(texto).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Formata se tiver 10 ou 11 dígitos; texto de outro formato vai como está. */
export function telefoneParaMostrar(gravado) {
  if (gravado == null) return null
  const n = soDigitos(gravado).length
  return n === 10 || n === 11 ? mascararTelefone(gravado) : gravado
}

/** Vazio ou 10/11 dígitos. */
export function telefoneValido(texto) {
  const limpo = String(texto ?? '').trim()
  if (!limpo) return true
  const n = soDigitos(limpo).length
  return n === 10 || n === 11
}

/** `false` se faltar a API ou der erro (ex.: página sem HTTPS). */
export async function copiarTexto(texto) {
  try {
    if (!globalThis.navigator?.clipboard?.writeText) return false
    await globalThis.navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

/** Ingresso na faculdade, `AAAA/S`: só dígitos (até 5), com a barra depois do ano. */
export function mascararIngresso(texto) {
  const d = soDigitos(texto).slice(0, 5)
  return d.length > 4 ? `${d.slice(0, 4)}/${d.slice(4)}` : d
}

/** `AAAA/1` ou `AAAA/2`, ano a partir de 2000, não depois do semestre de `hoje` (1 = jan a jun). */
export function ingressoValido(texto, hoje = new Date()) {
  const m = /^(\d{4})\/([12])$/.exec(String(texto ?? '').trim())
  if (!m) return false
  const ano = Number(m[1])
  const semestre = Number(m[2])
  const atual = hoje.getFullYear() * 2 + (hoje.getMonth() < 6 ? 1 : 2)
  return ano >= 2000 && ano * 2 + semestre <= atual
}
