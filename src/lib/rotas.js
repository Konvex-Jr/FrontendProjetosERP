/**
 * Telas que toda pessoa logada abre mesmo sem item no menu: o perfil abre pelo avatar do topo (sessão 22);
 * a agenda saiu do menu em 25/11 e o endereço antigo (favoritos) leva ao Dashboard (`App.jsx`).
 */
const SEMPRE_LIBERADAS = ['perfil', 'agenda']

/** Seções que existem no sistema (primeiro trecho do caminho). As de fora mostram a tela "página não existe". */
const SECOES = [
  'tarefas',
  'projetos',
  'agenda',
  'capacitacoes',
  'biblioteca',
  'estrategia',
  'precificacao',
  'usuarios',
  'perfil',
  'configuracoes',
]

/** A seção (primeiro trecho do caminho, sem "/") pode abrir? Início sempre; outras só se vieram no menu (`nav`). */
export function podeAbrirSecao(secao, nav) {
  // O React Router casa rotas sem diferenciar maiúsculas: /PROJETOS abre Projetos, então a guarda também.
  secao = (secao || '').toLowerCase()
  if (!secao || SEMPRE_LIBERADAS.includes(secao)) return true
  return nav.some(([, , caminho]) => caminho === '/' + secao)
}

/**
 * O que a tela logada mostra para a seção: 'liberada' (abre a página), 'sem-acesso' (existe, mas não está
 * no menu da pessoa) ou 'inexistente' (endereço errado). Antes da 27c as duas últimas voltavam ao início sem explicar.
 */
export function situacaoDaSecao(secao, nav) {
  if (podeAbrirSecao(secao, nav)) return 'liberada'
  return SECOES.includes((secao || '').toLowerCase()) ? 'sem-acesso' : 'inexistente'
}

export const ROTA_COMPLETAR_PERFIL = '/completar-perfil'

/** Pessoa com dados obrigatórios do perfil faltando só abre a tela de completar; devolve o caminho ou null. */
export function destinoPorPendencia(pendencias) {
  return pendencias?.length ? ROTA_COMPLETAR_PERFIL : null
}
