/** Regra da senha nova (criar senha e troca no perfil). O login não usa: senhas antigas continuam entrando. */
const REGRAS = [
  ['tamanho', '8 ou mais caracteres', s => s.length >= 8],
  ['maiuscula', 'Uma letra maiúscula', s => /\p{Lu}/u.test(s)],
  ['numero', 'Um número', s => /\p{Nd}/u.test(s)],
  ['especial', 'Um caractere especial', s => /[^\p{L}\p{Nd}]/u.test(s)],
]

const contarEspeciais = s => [...s].filter(c => /[^\p{L}\p{Nd}]/u.test(c)).length

/** Cada regra com `ok`. "Especial" é qualquer caractere que não seja letra nem número (espaço conta). */
export const regrasSenha = (senha = '') => REGRAS.map(([chave, rotulo, confere]) => ({ chave, rotulo, ok: confere(String(senha)) }))

/** 'fraca' (alguma regra falha), 'forte' (todas ok e 12+ caracteres, ou 2+ especiais com minúscula) ou 'media'. */
export function forcaSenha(senha = '') {
  const s = String(senha)
  if (!regrasSenha(s).every(r => r.ok)) return 'fraca'
  const longa = s.length >= 12
  const variada = contarEspeciais(s) >= 2 && /\p{Ll}/u.test(s)
  return longa || variada ? 'forte' : 'media'
}
