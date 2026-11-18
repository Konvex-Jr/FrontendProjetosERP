/** Telas que toda pessoa logada abre mesmo sem item no menu: o perfil abre pelo avatar do topo (sessão 22). */
const SEMPRE_LIBERADAS = ['perfil']

/** A seção (primeiro trecho do caminho, sem "/") pode abrir? Início sempre; outras só se vieram no menu (`nav`). */
export function podeAbrirSecao(secao, nav) {
  if (!secao || SEMPRE_LIBERADAS.includes(secao)) return true
  return nav.some(([, , caminho]) => caminho === '/' + secao)
}
