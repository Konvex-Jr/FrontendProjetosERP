import { CURSOS, STATUS_PESSOA } from '../services/pessoas.js'
import { ingressoValido, telefoneValido } from './pessoaContato.js'

/**
 * Regras do cadastro de pessoas que a tela segue (sessão 20). Trainee tem login com acesso de membro:
 * - só se entra como trainee na criação; na mudança de status a opção some (o back responde 400
 *   `STATUS_TRAINEE_SO_NA_ENTRADA`), salvo quando já é o status atual;
 * - desde a 31a não há perfil fixo: o que a pessoa pode vem do cargo (períodos) e da grade de permissões;
 * - a gestão manda link de senha (convite ou redefinição) a quem tem login: ativo e trainee.
 *   Ninguém digita nem vê a senha de outra pessoa (sessão 25a).
 */
export const opcoesMudarStatus = statusAtual => STATUS_PESSOA.filter(([k]) => k !== 'trainee' || statusAtual === 'trainee')

export const podeRedefinirSenha = status => status === 'ativo' || status === 'trainee'

/** Corpo do POST /usuarios: sem senha (a API manda o convite por e-mail) e sem perfil (31a: vem do cargo). */
export function corpoNovaPessoa(valores) {
  const { dataEntrada, senha: _senha, perfil: _perfil, ...resto } = valores
  return {
    ...resto,
    ...(dataEntrada ? { dataEntrada } : {}),
  }
}

/** Opções do select de curso. Quem já tem curso mantém o atual na lista, mesmo fora da lista (dado antigo). */
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
  const { status: _status, perfil: _perfil, dataEntrada, curso, telefone, emailPessoal, fimTrainee, ...resto } = v
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
  const { curso, telefone, emailPessoal, dataEntrada, ...resto } = v
  const corpo = { ...resto }
  // Entrada na EJ (a própria pessoa preenche desde 25/11): só vai se mudou e não está vazia.
  if (dataEntrada && dataEntrada !== (u.dataEntrada || '').slice(0, 10)) corpo.dataEntrada = dataEntrada
  if (curso !== undefined && curso !== (u.curso ?? '')) corpo.curso = curso
  if (telefone !== undefined && !igual(telefone, u.telefone)) corpo.telefone = telefone
  if (emailPessoal !== undefined && !igual(emailPessoal, u.emailPessoal)) corpo.emailPessoal = emailPessoal
  return corpo
}

const LINK = /^https?:\/\/\S+$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Primeiro problema da tela "Complete seu perfil" (ou null): os cinco campos são obrigatórios. */
export function erroCompletarPerfil(v, hoje = new Date()) {
  if (!CURSOS.includes(v.curso)) return { titulo: 'Curso obrigatório', texto: 'Escolha o seu curso na lista.' }
  if (!telefoneValido(v.telefone) || !(v.telefone ?? '').trim()) {
    return { titulo: 'Telefone inválido', texto: 'Use DDD e 10 ou 11 dígitos, como (11) 98765-4321.' }
  }
  if (!EMAIL.test((v.emailPessoal ?? '').trim())) {
    return { titulo: 'E-mail pessoal obrigatório', texto: 'Informe um e-mail válido, como nome@gmail.com.' }
  }
  if (!ingressoValido(v.ingresso, hoje)) {
    return { titulo: 'Ingresso inválido', texto: 'Use o formato AAAA/S, como 2025/1, sem passar do semestre atual.' }
  }
  if (!LINK.test((v.calendarioUrl ?? '').trim())) {
    return { titulo: 'Link da agenda inválido', texto: 'Informe um link que comece com http:// ou https://.' }
  }
  return null
}

/** Corpo do PUT /auth/perfil da tela de completar: só o que mudou em relação à pessoa. */
export function corpoCompletarPerfil(v, u) {
  const corpo = {}
  for (const k of ['curso', 'telefone', 'emailPessoal', 'ingresso', 'calendarioUrl', 'linkedinUrl', 'githubUrl']) {
    if (v[k] !== undefined && !igual(v[k], u[k])) corpo[k] = v[k].trim()
  }
  return corpo
}

const OBRIGATORIOS = [
  ['curso', 'Curso'],
  ['telefone', 'Telefone'],
  ['emailPessoal', 'E-mail pessoal'],
  ['ingresso', 'Ingresso na faculdade'],
  ['calendarioUrl', 'Link da agenda'],
]

/** Em "Editar meus dados": quem já tem um dos cinco campos obrigatórios não pode apagá-lo. */
export function erroApagarObrigatorio(v, u) {
  for (const [k, rotulo] of OBRIGATORIOS) {
    if ((u[k] ?? '').toString().trim() && !(v[k] ?? '').toString().trim()) {
      return { titulo: `${rotulo} obrigatório`, texto: `O campo ${rotulo} não pode ficar vazio.` }
    }
  }
  return null
}
