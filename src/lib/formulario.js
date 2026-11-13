/**
 * Valores enviados pelo FormModal: select sem valor vai com a 1ª opção, que é a que a tela mostra.
 * Antes, a tela mostrava a 1ª opção e o valor ficava vazio até a pessoa trocar. Passe só os campos
 * visíveis, para não preencher um select escondido.
 * Só preenche o que está `undefined`: um '' dado de propósito ("Nenhum") continua ''.
 */
export function valoresIniciais(campos, init = {}) {
  const v = { ...init }
  for (const campo of campos) {
    if (Array.isArray(campo.o) && campo.o.length && v[campo.k] === undefined) v[campo.k] = campo.o[0][0]
  }
  return v
}
