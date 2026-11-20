/** Telas que toda pessoa logada abre mesmo sem item no menu: o perfil abre pelo avatar do topo (sessão 22). */
const SEMPRE_LIBERADAS = ['perfil']

/** A seção (primeiro trecho do caminho, sem "/") pode abrir? Início sempre; outras só se vieram no menu (`nav`). */
export function podeAbrirSecao(secao, nav) {
  if (!secao || SEMPRE_LIBERADAS.includes(secao)) return true
  return nav.some(([, , caminho]) => caminho === '/' + secao)
}

export const ROTA_COMPLETAR_PERFIL = '/completar-perfil'

/** Pessoa com dados obrigatórios do perfil faltando só abre a tela de completar; devolve o caminho ou null. */
export function destinoPorPendencia(pendencias) {
  return pendencias?.length ? ROTA_COMPLETAR_PERFIL : null
}
