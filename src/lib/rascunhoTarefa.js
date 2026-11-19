/**
 * Rascunho da janela da tarefa (sessão 24b): o que a pessoa mudou e ainda não salvou.
 * Base do aviso "Descartar alterações?" ao fechar.
 */

// Vazio é vazio: campo apagado (null, undefined, '' ou lista vazia) não conta como alteração.
const vazio = v => v == null || v === '' || (Array.isArray(v) && v.length === 0)

// A marcação do checklist grava na hora (PATCH), fora do rascunho: o `feito` não entra na comparação.
const semFeito = checklist => (checklist || []).map(({ feito: _feito, ...item }) => item)

const valor = (t, chave) => {
  const v = chave === 'checklist' ? semFeito(t.checklist) : t[chave]
  return vazio(v) ? undefined : JSON.stringify(v)
}

/**
 * O rascunho difere do original? Compara campo a campo (como `soMudouStatus`), sem o `feito` dos itens.
 * Em criação, `original` é o rascunho inicial e qualquer anexo escolhido (`anexosEscolhidos`) conta.
 */
export function mudouRascunho(original, rascunho, anexosEscolhidos = []) {
  if (anexosEscolhidos.length > 0) return true
  const chaves = new Set([...Object.keys(original || {}), ...Object.keys(rascunho || {})])
  for (const chave of chaves) if (valor(original || {}, chave) !== valor(rascunho || {}, chave)) return true
  return false
}
