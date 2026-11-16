import { mesmaLista, projetos } from '../services/projetos.js'

/** O projeto foi salvo, mas a lista de acesso não: a tela recarrega e avisa. */
export class ErroAcessoParcial extends Error {}

/**
 * Grava o formulário do projeto: cria, ou edita. O PUT ignora a lista de acesso, então, na edição,
 * quem gere o acesso (diretor e criador) manda a lista à parte, e só se ela mudou. Quem não gere
 * o acesso não envia Visibilidade nem lista (a API recusa mudar o sigilo com 403).
 * Falha só no `definirAcesso` vira ErroAcessoParcial; qualquer outra sobe como veio.
 */
export async function gravarProjeto(p, v) {
  if (!p) return projetos.criar(v)
  const { visibilidade, acesso, ...resto } = v
  const gere = Boolean(p.podeGerirAcesso)
  const r = await projetos.editar(p.codigo, gere ? { ...resto, visibilidade } : resto)
  if (gere && visibilidade === 'sigiloso' && Array.isArray(acesso) && !mesmaLista(acesso, p.acesso)) {
    try {
      await projetos.definirAcesso(p.codigo, acesso)
    } catch (erro) {
      throw new ErroAcessoParcial(erro.message)
    }
  }
  return r
}
