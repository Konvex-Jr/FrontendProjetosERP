import { STATUS_PESSOA } from '../services/pessoas.js'

/**
 * Regras do cadastro de pessoas que a tela segue (sessão 20). Trainee tem login com acesso de membro:
 * - só se entra como trainee na criação; na mudança de status a opção some (o back responde 400
 *   `STATUS_TRAINEE_SO_NA_ENTRADA`), salvo quando já é o status atual;
 * - trainee é sempre membro (gerente ou diretor dá 400 `TRAINEE_SO_MEMBRO`);
 * - a gestão manda link de senha (convite ou redefinição) a quem tem login: ativo e trainee.
 *   Ninguém digita nem vê a senha de outra pessoa (sessão 25a).
 */
export const opcoesMudarStatus = statusAtual => STATUS_PESSOA.filter(([k]) => k !== 'trainee' || statusAtual === 'trainee')

export const podeRedefinirSenha = status => status === 'ativo' || status === 'trainee'

/** Corpo do POST /usuarios: trainee vai sempre como membro; sem senha (a API manda o convite por e-mail). */
export function corpoNovaPessoa(valores) {
  const { dataEntrada, senha: _senha, ...resto } = valores
  return {
    ...resto,
    ...(dataEntrada ? { dataEntrada } : {}),
    ...(valores.status === 'trainee' ? { perfil: 'membro' } : {}),
  }
}
