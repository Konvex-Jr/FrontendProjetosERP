import { CURSOS, STATUS_PESSOA } from '../services/pessoas.js'
import { telefoneValido } from './pessoaContato.js'

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

/** Opções do select de curso. Quem já tem curso mantém o atual na lista, mesmo fora dos três (dado antigo). */
export function opcoesCurso(pessoa) {
  const fixos = CURSOS.map(c => [c, c])
  if (!pessoa) return [['', 'Selecione o curso'], ...fixos]
  if (!pessoa.curso) return [['', 'Curso não informado'], ...fixos]
  return CURSOS.includes(pessoa.curso) ? fixos : [[pessoa.curso, pessoa.curso], ...fixos]
}

const igual = (novo, antigo) => (novo ?? '').trim() === (antigo ?? '').trim()

/** Primeiro problema do formulário (ou null). Curso e telefone só são cobrados na criação ou quando mudam: dado antigo não trava outra edição. */
export function erroCadastro(v, pessoa) {
  if (!pessoa && !v.curso) return { titulo: 'Curso obrigatório', texto: 'Escolha o curso da pessoa.' }
  if ((!pessoa || !igual(v.telefone, pessoa.telefone)) && !telefoneValido(v.telefone)) {
    return { titulo: 'Telefone inválido', texto: 'Use DDD e 10 ou 11 dígitos, como (11) 98765-4321.' }
  }
  return null
}

/** Corpo do PUT /usuarios/:codigo: curso, telefone, e-mail pessoal e fim do trainee só vão se mudaram. */
export function corpoEdicaoPessoa(v, pessoa) {
  const { status: _status, dataEntrada, curso, telefone, emailPessoal, fimTrainee, ...resto } = v
  const corpo = { ...resto, ...(dataEntrada ? { dataEntrada } : {}) }
  if (curso !== undefined && curso !== (pessoa.curso ?? '')) corpo.curso = curso
  if (telefone !== undefined && !igual(telefone, pessoa.telefone)) corpo.telefone = telefone
  if (emailPessoal !== undefined && !igual(emailPessoal, pessoa.emailPessoal)) corpo.emailPessoal = emailPessoal
  if (fimTrainee && fimTrainee !== (pessoa.fimTrainee ?? '').slice(0, 10)) corpo.fimTrainee = fimTrainee
  return corpo
}

/** Motivo da saída: pedido só ao mudar para Inativo (quem já é inativo só corrige a data). */
export const pedeMotivoSaida = (statusAtual, destino) => destino === 'inativo' && statusAtual !== 'inativo'

/** Corpo do PUT /auth/perfil (a própria pessoa): curso, telefone e e-mail pessoal só vão se mudaram. */
export function corpoEdicaoPerfil(v, u) {
  const { curso, telefone, emailPessoal, ...resto } = v
  const corpo = { ...resto }
  if (curso !== undefined && curso !== (u.curso ?? '')) corpo.curso = curso
  if (telefone !== undefined && !igual(telefone, u.telefone)) corpo.telefone = telefone
  if (emailPessoal !== undefined && !igual(emailPessoal, u.emailPessoal)) corpo.emailPessoal = emailPessoal
  return corpo
}
