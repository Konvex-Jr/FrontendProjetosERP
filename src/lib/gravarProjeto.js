import { mesmaLista, projetos } from '../services/projetos.js'

/**
 * Lista de acesso que o formulário mostra: só quem tem login (`ativo`). A API recusa a lista inteira
 * com ACESSO_PESSOA_SEM_LOGIN se sobrar o código de quem perdeu o login, e ele nem aparece no seletor;
 * tirado aqui, o primeiro salvamento grava a lista limpa.
 */
export const acessoComLogin = (acesso, pessoas) => {
  const comLogin = new Set(pessoas.filter(u => u.ativo).map(u => u.codigo))
  return (acesso || []).filter(c => comLogin.has(c))
}

/** O projeto foi salvo, mas a lista de acesso não: a tela recarrega e avisa. */
export class ErroAcessoParcial extends Error {}

/**
 * Grava o formulário do projeto: cria, ou edita. O PUT ignora a lista de acesso, então, na edição,
 * quem gere o acesso (diretor e criador) manda a lista à parte, e só se ela mudou. A Visibilidade
 * vai sempre (quem edita o projeto marca e desmarca o sigilo); quem não gere o acesso não envia a lista.
 * Falha só no `definirAcesso` vira ErroAcessoParcial; qualquer outra sobe como veio.
 */
export async function gravarProjeto(p, v) {
  if (!p) return projetos.criar(v)
  const { visibilidade, acesso, ...resto } = v
  const gere = Boolean(p.podeGerirAcesso)
  const r = await projetos.editar(p.codigo, { ...resto, visibilidade })
  if (gere && visibilidade === 'sigiloso' && Array.isArray(acesso) && !mesmaLista(acesso, p.acesso)) {
    try {
      await projetos.definirAcesso(p.codigo, acesso)
    } catch (erro) {
      throw new ErroAcessoParcial(erro.message)
    }
  }
  return r
}
