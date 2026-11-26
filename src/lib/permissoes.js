/**
 * Grade de permissões (sessão 31a): cálculos puros da aba Configurações → Permissões.
 * A API manda o catálogo (chave, rótulo, descrição, grupo) e as colunas (cargos e conjuntos).
 */

/** Grupos na ordem em que aparecem no catálogo, cada um com as suas permissões. */
export function linhasPorGrupo(catalogo) {
  const grupos = []
  for (const item of catalogo || []) {
    let grupo = grupos.find(g => g.grupo === item.grupo)
    if (!grupo) grupos.push((grupo = { grupo: item.grupo, itens: [] }))
    grupo.itens.push(item)
  }
  return grupos
}

/** Liga ou desliga uma permissão, sem mexer na lista recebida. */
export function alternar(permissoes, chave) {
  return permissoes.includes(chave) ? permissoes.filter(p => p !== chave) : [...permissoes, chave]
}

/** Se a coluna mudou (a ordem não importa). */
export function mudou(antes, depois) {
  return antes.length !== depois.length || antes.some(p => !depois.includes(p))
}

/** O que estava ligado e saiu (para confirmar antes de gravar). */
export function desligadas(antes, depois) {
  return antes.filter(p => !depois.includes(p))
}

const ABAS = [
  ['areas', 'Áreas', 'config.estrutura'],
  ['cargos', 'Cargos', 'config.estrutura'],
  ['senioridades', 'Senioridades', 'config.estrutura'],
  ['dificuldade', 'Dificuldade', 'config.dificuldade'],
  ['permissoes', 'Permissões', 'permissoes.gerir'],
]

/** Abas de Configurações que a pessoa pode usar, como pares [chave, rótulo]. */
export function abasConfiguracoes(pode) {
  return ABAS.filter(([, , permissao]) => pode(permissao)).map(([k, l]) => [k, l])
}
