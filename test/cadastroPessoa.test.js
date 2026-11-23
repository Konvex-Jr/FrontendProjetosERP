import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  corpoCompletarPerfil,
  corpoEdicaoPerfil,
  corpoNovaPessoa,
  erroApagarObrigatorio,
  erroCompletarPerfil,
  opcoesMudarStatus,
  podeRedefinirSenha,
} from '../src/lib/cadastroPessoa.js'

test('mudar status não oferece trainee, salvo para quem já é trainee', () => {
  assert.deepEqual(
    opcoesMudarStatus('ativo').map(([k]) => k),
    ['ativo', 'inativo'],
  )
  assert.deepEqual(
    opcoesMudarStatus('inativo').map(([k]) => k),
    ['ativo', 'inativo'],
  )
  assert.deepEqual(
    opcoesMudarStatus('trainee').map(([k]) => k),
    ['ativo', 'trainee', 'inativo'],
  )
})

test('a gestão manda link de senha a ativo e a trainee', () => {
  assert.equal(podeRedefinirSenha('ativo'), true)
  assert.equal(podeRedefinirSenha('trainee'), true)
  assert.equal(podeRedefinirSenha('inativo'), false)
})

test('nova pessoa: trainee vai como membro e ninguém leva senha (a pessoa cria pelo convite)', () => {
  assert.deepEqual(corpoNovaPessoa({ nome: 'Tê', status: 'trainee', perfil: 'gerente', senha: 'segredo123', dataEntrada: '' }), {
    nome: 'Tê',
    status: 'trainee',
    perfil: 'membro',
  })
  assert.deepEqual(corpoNovaPessoa({ nome: 'Ana', status: 'ativo', perfil: 'gerente', senha: 'x', dataEntrada: '2026-11-01' }), {
    nome: 'Ana',
    status: 'ativo',
    perfil: 'gerente',
    dataEntrada: '2026-11-01',
  })
})

test('opcoesCurso: criação, sem curso, curso antigo e curso válido', async () => {
  const { opcoesCurso } = await import('../src/lib/cadastroPessoa.js')
  assert.equal(opcoesCurso(null)[0][0], '')
  assert.equal(opcoesCurso(null).length, 5)
  assert.equal(opcoesCurso({ curso: null })[0][1], 'Curso não informado')
  assert.equal(opcoesCurso({ curso: 'Direito' })[0][0], 'Direito')
  assert.equal(opcoesCurso({ curso: 'Direito' }).length, 5)
  assert.equal(opcoesCurso({ curso: 'Engenharia Mecânica' }).length, 4)
})

test('erroCadastro: curso obrigatório na criação; telefone só quando muda', async () => {
  const { erroCadastro } = await import('../src/lib/cadastroPessoa.js')
  assert.equal(erroCadastro({ curso: '', telefone: '' }, null).titulo, 'Curso obrigatório')
  assert.equal(erroCadastro({ curso: 'Engenharia Mecânica', telefone: '123' }, null).titulo, 'Telefone inválido')
  assert.equal(erroCadastro({ curso: 'Engenharia Mecânica', telefone: '(11) 98765-4321' }, null), null)
  // pessoa antiga com telefone fora da máscara, sem mexer nele
  assert.equal(erroCadastro({ curso: '', telefone: 'ramal 12' }, { curso: null, telefone: 'ramal 12' }), null)
  assert.equal(erroCadastro({ curso: '', telefone: 'ramal 1' }, { curso: null, telefone: 'ramal 12' }).titulo, 'Telefone inválido')
})

test('corpoEdicaoPessoa só manda o que mudou', async () => {
  const { corpoEdicaoPessoa } = await import('../src/lib/cadastroPessoa.js')
  const p = { curso: 'Direito', telefone: 'ramal 12', emailPessoal: null, fimTrainee: '2026-03-01T00:00:00.000Z' }
  const base = { nome: 'A', email: 'a@x', perfil: 'membro', codigoSenioridade: 1, dataEntrada: '' }
  assert.deepEqual(
    corpoEdicaoPessoa({ ...base, status: 'ativo', curso: 'Direito', telefone: 'ramal 12', emailPessoal: '', fimTrainee: '2026-03-01' }, p),
    {
      nome: 'A',
      email: 'a@x',
      perfil: 'membro',
      codigoSenioridade: 1,
    },
  )
  assert.deepEqual(
    corpoEdicaoPessoa(
      {
        nome: 'A',
        email: 'a@x',
        perfil: 'membro',
        codigoSenioridade: 1,
        curso: 'Engenharia Elétrica',
        telefone: '(11) 3456-7890',
        emailPessoal: 'p@x.com',
        fimTrainee: '2026-04-01',
      },
      p,
    ),
    {
      nome: 'A',
      email: 'a@x',
      perfil: 'membro',
      codigoSenioridade: 1,
      curso: 'Engenharia Elétrica',
      telefone: '(11) 3456-7890',
      emailPessoal: 'p@x.com',
      fimTrainee: '2026-04-01',
    },
  )
})

test('pedeMotivoSaida só ao mudar para inativo', async () => {
  const { pedeMotivoSaida } = await import('../src/lib/cadastroPessoa.js')
  assert.equal(pedeMotivoSaida('ativo', 'inativo'), true)
  assert.equal(pedeMotivoSaida('trainee', 'inativo'), true)
  assert.equal(pedeMotivoSaida('inativo', 'inativo'), false)
  assert.equal(pedeMotivoSaida('ativo', 'ativo'), false)
})

test('corpoEdicaoPerfil: curso, telefone e e-mail pessoal só vão se mudaram', () => {
  const u = { curso: 'Curso Antigo', telefone: '1199', emailPessoal: null }
  const v = { bio: 'oi', curso: 'Curso Antigo', telefone: '1199', emailPessoal: '' }
  assert.deepEqual(corpoEdicaoPerfil(v, u), { bio: 'oi' })
  assert.deepEqual(corpoEdicaoPerfil({ ...v, curso: 'Engenharia Elétrica', emailPessoal: 'a@b.co' }, u), {
    bio: 'oi',
    curso: 'Engenharia Elétrica',
    emailPessoal: 'a@b.co',
  })
})

test('corpoCompletarPerfil manda só o que mudou e erroCompletarPerfil cobra os obrigatórios', () => {
  const u = {
    curso: 'Engenharia Elétrica',
    telefone: '',
    emailPessoal: '',
    ingresso: null,
    calendarioUrl: '',
    linkedinUrl: 'https://l.com/a',
    githubUrl: '',
  }
  const v = {
    curso: 'Engenharia Elétrica',
    telefone: '(11) 98765-4321',
    emailPessoal: 'a@b.com',
    ingresso: '2025/1',
    calendarioUrl: 'https://cal.com/a',
    linkedinUrl: 'https://l.com/a',
    githubUrl: '',
  }
  assert.deepEqual(corpoCompletarPerfil(v, u), {
    telefone: '(11) 98765-4321',
    emailPessoal: 'a@b.com',
    ingresso: '2025/1',
    calendarioUrl: 'https://cal.com/a',
  })
  assert.equal(erroCompletarPerfil(v, new Date(2026, 10, 1)), null)
  assert.equal(erroCompletarPerfil({ ...v, curso: 'Eng. de Software' }, new Date(2026, 10, 1)).titulo, 'Curso obrigatório')
  assert.equal(erroCompletarPerfil({ ...v, curso: '' }, new Date(2026, 10, 1)).titulo, 'Curso obrigatório')
  assert.equal(erroCompletarPerfil({ ...v, telefone: '(11) 9' }, new Date(2026, 10, 1)).titulo, 'Telefone inválido')
  assert.equal(erroCompletarPerfil({ ...v, emailPessoal: '' }, new Date(2026, 10, 1)).titulo, 'E-mail pessoal obrigatório')
  assert.equal(erroCompletarPerfil({ ...v, ingresso: '2030/1' }, new Date(2026, 10, 1)).titulo, 'Ingresso inválido')
  assert.equal(erroCompletarPerfil({ ...v, calendarioUrl: 'cal.com' }, new Date(2026, 10, 1)).titulo, 'Link da agenda inválido')
})

test('erroApagarObrigatorio barra apagar campo que a pessoa já tem', () => {
  const u = {
    curso: 'Engenharia Elétrica',
    telefone: '(11) 98765-4321',
    emailPessoal: 'a@b.com',
    ingresso: '2025/1',
    calendarioUrl: 'https://c.com',
  }
  assert.equal(erroApagarObrigatorio({ ...u }, u), null)
  assert.equal(erroApagarObrigatorio({ ...u, emailPessoal: '' }, u).titulo, 'E-mail pessoal obrigatório')
  assert.equal(erroApagarObrigatorio({ ...u, ingresso: ' ' }, u).titulo, 'Ingresso na faculdade obrigatório')
  assert.equal(erroApagarObrigatorio({ ...u, curso: '' }, { ...u, curso: null }), null)
})
