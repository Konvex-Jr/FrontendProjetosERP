import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  corpoNovaTarefa,
  criarComAnexos,
  corpoTarefa,
  origemTarefa,
  papelNaTarefa,
  papelNasTarefas,
  quadroDesatualizado,
  soMudouConclusao,
  soMudouEtapa,
  soMudouStatus,
  tarefas,
} from '../src/services/tarefas.js'
import { sessao } from '../src/services/api.js'

const capturar = async fn => {
  const original = globalThis.fetch
  const chamadas = []
  globalThis.fetch = async (url, init) => {
    chamadas.push({
      url: String(url).replace(/^https?:\/\/[^/]+/, ''),
      method: init.method,
      body: init.body ? JSON.parse(init.body) : undefined,
    })
    return { ok: true, status: 200, text: async () => '{}' }
  }
  try {
    await fn()
  } finally {
    globalThis.fetch = original
  }
  return chamadas
}

const tarefa = {
  id: 't1',
  projetoId: 'p1',
  titulo: ' Requisitos ',
  descricao: '',
  inicio: '2026-11-03',
  fim: '2026-11-07',
  status: 'pendente',
  prioridade: 'P2',
  responsaveis: ['u1'],
  dependeDe: undefined,
  checklist: [{ id: 'c1', texto: 'Levantar', feito: 1 }],
}

test('dificuldade vai no corpo: vazia vira null', () => {
  assert.equal(corpoTarefa({ ...tarefa, dificuldade: '' }).dificuldade, null)
  assert.equal(corpoTarefa({ ...tarefa, dificuldade: 'media' }).dificuldade, 'media')
  assert.equal(corpoNovaTarefa('p1', { titulo: 'X', dificuldade: 'rapida' }).dificuldade, 'rapida')
  assert.equal(corpoNovaTarefa('p1', { titulo: 'X' }).dificuldade, null)
})

test('corpos da tarefa seguem o contrato da API', () => {
  const nova = corpoNovaTarefa('p1', { titulo: 'X', inicio: '2026-11-03', fim: '2026-11-07' })
  assert.equal(nova.codigoProjeto, 'p1')
  assert.equal(nova.prioridade, 'P3')
  assert.deepEqual(nova.codigosResponsaveis, [])
  assert.equal(nova.dataInicio.slice(0, 10), '2026-11-03')

  const corpo = corpoTarefa(tarefa)
  assert.equal(corpo.titulo, 'Requisitos')
  assert.equal(corpo.descricao, null)
  assert.equal(corpo.codigoDependencia, null)
  assert.deepEqual(corpo.checklist, [{ codigo: 'c1', texto: 'Levantar', feito: true, codigoResponsavel: null }])
})

test('salvar usa PATCH quando só o status muda e PUT no resto', async () => {
  assert.equal(soMudouStatus(tarefa, { ...tarefa, status: 'concluida', conclusao: '2026-11-03' }), true)
  assert.equal(soMudouStatus(tarefa, { ...tarefa, status: 'andamento', fim: '2026-11-14' }), false)

  sessao.salvar({ token: 'tk', refreshToken: 'rt' })
  const chamadas = await capturar(async () => {
    await tarefas.listar({ codigoProjeto: 'p1' })
    await tarefas.criar('p1', tarefa)
    await tarefas.salvar(tarefa, { ...tarefa, status: 'concluida' })
    await tarefas.salvar(tarefa, { ...tarefa, titulo: 'Outra' })
    await tarefas.excluir('t1')
    await tarefas.anexos('t1')
  })
  sessao.limpar()

  assert.deepEqual(
    chamadas.map(c => [c.method, c.url]),
    [
      ['GET', '/tarefas?codigoProjeto=p1'],
      ['POST', '/tarefas'],
      ['PATCH', '/tarefas/t1/status'],
      ['PUT', '/tarefas/t1'],
      ['DELETE', '/tarefas/t1'],
      ['GET', '/tarefas/t1/anexos'],
    ],
  )
  assert.deepEqual(chamadas[2].body, { status: 'concluida' })
})

test('papel nas tarefas: gestão e líder organizam; participante só as suas; de fora só vê', () => {
  const projeto = {
    lider: { codigo: 'lid' },
    participacoes: [
      { usuario: { codigo: 'lid' }, dataSaida: null },
      { usuario: { codigo: 'par' }, dataSaida: null },
      { usuario: { codigo: 'saiu' }, dataSaida: '2026-10-01' },
    ],
  }
  const sua = { responsaveis: ['par'] },
    outra = { responsaveis: ['lid'] }
  const gestao = papelNasTarefas({ me: 'g', gestao: true, projeto })
  assert.equal(gestao.organiza, true)
  const lider = papelNasTarefas({ me: 'lid', gestao: false, projeto })
  assert.equal(lider.lider, true)
  assert.equal(lider.podeStatus(sua), true)
  const par = papelNasTarefas({ me: 'par', gestao: false, projeto })
  assert.equal(par.organiza, false)
  assert.equal(par.participa, true)
  assert.equal(par.podeStatus(sua), true)
  assert.equal(par.podeStatus(outra), false)
  assert.equal(par.podeApagarComentario({ autor: { codigo: 'par' } }), true)
  assert.equal(par.podeApagarComentario({ autor: { codigo: 'lid' } }), false)
  const saiu = papelNasTarefas({ me: 'saiu', gestao: false, projeto })
  assert.equal(saiu.participa, false)
  assert.equal(saiu.podeStatus({ responsaveis: ['saiu'] }), false)
})

test('toda tarefa tem projeto (23b): corpo, origem e líder da área', () => {
  const nova = corpoNovaTarefa('p1', { titulo: 'Pesquisa', inicio: '2026-11-03', fim: '2026-11-07', responsaveis: ['u2'] })
  assert.equal(nova.codigoProjeto, 'p1')
  assert.equal('categoria' in nova, false)
  assert.deepEqual(nova.codigosResponsaveis, ['u2'])
  assert.equal('categoria' in corpoTarefa(tarefa), false)

  const projeto = { participacoes: [{ usuario: { codigo: 'u1' } }], lider: null, lideresDaArea: ['ld'] }
  assert.equal(papelNaTarefa({ me: 'u1', projeto, tarefa }).podeStatus(tarefa), true)
  assert.equal(papelNaTarefa({ me: 'u1', projeto, tarefa }).organiza, false)
  assert.equal(papelNaTarefa({ me: 'ld', projeto, tarefa }).organiza, true)
  assert.equal(papelNasTarefas({ me: 'ld', projeto }).organiza, true)
  assert.equal(papelNasTarefas({ me: 'ld', projeto }).lider, true)
  assert.equal(origemTarefa({ ...tarefa, projetoNome: 'Site' }), 'Site')
  assert.equal(origemTarefa(tarefa), 'Projeto')
})

const entrada = { id: 'c1', nome: 'A fazer', cor: 'cinza', papel: 'entrada' }
const fazendo = { id: 'c2', nome: 'Fazendo', cor: 'azul', papel: 'meio' }

test('soMudouEtapa só vale quando a coluna muda e o resto fica igual', () => {
  const a = { ...tarefa, coluna: entrada }
  assert.equal(soMudouEtapa(a, { ...a, coluna: fazendo }), true)
  assert.equal(soMudouEtapa(a, { ...a, coluna: fazendo, titulo: 'Outra' }), false)
  assert.equal(soMudouEtapa(a, { ...a, coluna: fazendo, status: 'concluida' }), false)
  assert.equal(soMudouEtapa(a, a), false)
  assert.equal(soMudouStatus(a, { ...a, status: 'concluida', coluna: fazendo }), false)
  assert.equal(soMudouStatus(a, { ...a, status: 'concluida', coluna: { ...entrada } }), true)
})

test('salvar escolhe mover, status ou editar; corpos levam a coluna', async () => {
  const a = { ...tarefa, coluna: entrada }
  sessao.salvar({ token: 'tk', refreshToken: 'rt' })
  const chamadas = await capturar(async () => {
    await tarefas.salvar(a, { ...a, coluna: fazendo })
    await tarefas.salvar(a, { ...a, status: 'concluida' })
    await tarefas.salvar(a, { ...a, coluna: fazendo, titulo: 'Outra' })
    await tarefas.mover('t1', 'c2')
    await tarefas.salvar(a, { ...a, status: 'concluida', coluna: fazendo })
  })
  sessao.limpar()
  assert.deepEqual(
    chamadas.map(c => [c.method, c.url]),
    [
      ['PATCH', '/tarefas/t1/coluna'],
      ['PATCH', '/tarefas/t1/status'],
      ['PUT', '/tarefas/t1'],
      ['PATCH', '/tarefas/t1/coluna'],
      ['PUT', '/tarefas/t1'],
    ],
  )
  assert.equal(chamadas[4].body.codigoColuna, 'c2')
  assert.deepEqual(chamadas[0].body, { codigoColuna: 'c2' })
  assert.equal(chamadas[2].body.codigoColuna, 'c2')
  assert.equal(corpoTarefa(tarefa).codigoColuna, undefined)
  assert.equal(corpoNovaTarefa('p1', { titulo: 'X', colunaId: 'c2' }).codigoColuna, 'c2')
  assert.equal('codigoColuna' in corpoNovaTarefa('p1', { titulo: 'X' }), false)
})

test('PUT só leva codigoColuna quando a etapa muda: reabrir arrastando para uma semana manda só o status', async () => {
  const concluido = { id: 'c4', nome: 'Concluído', cor: 'verde', papel: 'concluida' }
  const feita = { ...tarefa, status: 'concluida', conclusao: '2026-11-05', coluna: concluido }
  sessao.salvar({ token: 'tk', refreshToken: 'rt' })
  const chamadas = await capturar(async () => {
    // Tela Tarefas: quem organiza solta a concluída numa coluna de semana (status andamento, prazo novo, mesma etapa).
    await tarefas.salvar(feita, { ...feita, status: 'andamento', conclusao: undefined, fim: '2026-11-14' })
    // Concluir arrastando para "Concluído" com o prazo de outra semana também não pode prender a tarefa na etapa atual.
    await tarefas.salvar({ ...tarefa, coluna: entrada }, { ...tarefa, coluna: entrada, status: 'concluida', fim: '2026-11-14' })
    // Etapa trocada no formulário junto com outro campo: vai a coluna nova.
    await tarefas.salvar({ ...tarefa, coluna: entrada }, { ...tarefa, coluna: fazendo, titulo: 'Outra' })
  })
  sessao.limpar()
  assert.deepEqual(
    chamadas.map(c => [c.method, c.url]),
    [
      ['PUT', '/tarefas/t1'],
      ['PUT', '/tarefas/t1'],
      ['PUT', '/tarefas/t1'],
    ],
  )
  assert.equal('codigoColuna' in chamadas[0].body, false)
  assert.equal(chamadas[0].body.status, 'andamento')
  assert.equal('codigoColuna' in chamadas[1].body, false)
  assert.equal(chamadas[1].body.status, 'concluida')
  assert.equal(chamadas[2].body.codigoColuna, 'c2')
})

test('quadroDesatualizado: coluna sumida e 409 QUADRO_MUDOU recarregam; outros erros não', () => {
  assert.equal(quadroDesatualizado({ codigo: 'COLUNA_DE_OUTRO_PROJETO' }), true)
  assert.equal(quadroDesatualizado({ codigo: 'QUADRO_MUDOU', status: 409 }), true)
  assert.equal(quadroDesatualizado({ codigo: 'DESTINO_COLUNA_OBRIGATORIO' }), false)
  assert.equal(quadroDesatualizado(undefined), false)
})

test('24b: criador na equipe edita; criador que saiu não; responsável marca', () => {
  const projeto = {
    lider: { codigo: 'lid' },
    participacoes: [
      { usuario: { codigo: 'par' }, dataSaida: null },
      { usuario: { codigo: 'saiu' }, dataSaida: '2026-10-01' },
    ],
  }
  const doPar = { responsaveis: ['lid'], criadaPorId: 'par' }
  const doSaiu = { responsaveis: ['saiu'], criadaPorId: 'saiu' }
  const par = papelNasTarefas({ me: 'par', gestao: false, projeto })
  assert.equal(par.podeEditar(doPar), true)
  assert.equal(par.podeEditar({ criadaPorId: 'lid' }), false)
  assert.equal(par.podeMarcar(doPar), true)
  assert.equal(par.podeMarcar({ responsaveis: ['lid'], criadaPorId: 'lid' }), false)
  const saiu = papelNasTarefas({ me: 'saiu', gestao: false, projeto })
  assert.equal(saiu.podeEditar(doSaiu), false)
  assert.equal(saiu.podeMarcar(doSaiu), false)
  assert.equal(papelNasTarefas({ me: 'lid', gestao: false, projeto }).podeEditar({}), true)
  const resp = papelNasTarefas({ me: 'par', gestao: false, projeto })
  assert.equal(resp.podeMarcar({ responsaveis: ['par'], criadaPorId: 'lid' }), true)
})

test('24b: corpos mandam responsável do item, descrição, checklist e data de conclusão', () => {
  const t = {
    titulo: 'X',
    status: 'concluida',
    conclusao: '2026-11-10',
    descricao: 'd',
    checklist: [
      { id: 'i1', texto: 'a', feito: false, responsavel: 'u2' },
      { texto: 'b', feito: true },
    ],
  }
  const c = corpoTarefa(t)
  assert.deepEqual(c.checklist, [
    { codigo: 'i1', texto: 'a', feito: false, codigoResponsavel: 'u2' },
    { codigo: undefined, texto: 'b', feito: true, codigoResponsavel: null },
  ])
  assert.equal(c.dataConclusao, new Date('2026-11-10T12:00:00').toISOString())
  assert.equal('dataConclusao' in corpoTarefa({ ...t, status: 'andamento' }), false)
  const n = corpoNovaTarefa('p1', t)
  assert.equal(n.descricao, 'd')
  assert.deepEqual(n.checklist, [
    { texto: 'a', feito: false, codigoResponsavel: 'u2' },
    { texto: 'b', feito: true },
  ])
})

test('24b: soMudouConclusao e chamadas PATCH', async () => {
  const antes = { id: 't1', titulo: 'X', status: 'concluida', conclusao: '2026-11-10', coluna: { id: 'c' } }
  assert.equal(soMudouConclusao(antes, { ...antes, conclusao: '2026-11-09' }), true)
  assert.equal(soMudouConclusao(antes, { ...antes, conclusao: '2026-11-09', titulo: 'Y' }), false)
  assert.equal(soMudouConclusao(antes, antes), false)
  assert.equal(soMudouConclusao({ ...antes, status: 'andamento' }, { ...antes, conclusao: '2026-11-09' }), false)
  const chamadas = await capturar(async () => {
    await tarefas.salvar(antes, { ...antes, conclusao: '2026-11-09' })
    await tarefas.marcarItem('t1', 'i1', true)
  })
  assert.equal(chamadas[0].method, 'PATCH')
  assert.equal(chamadas[0].url, '/tarefas/t1/conclusao')
  assert.deepEqual(chamadas[0].body, { dataConclusao: new Date('2026-11-09T12:00:00').toISOString() })
  assert.equal(chamadas[1].url, '/tarefas/t1/checklist/i1')
  assert.deepEqual(chamadas[1].body, { feito: true })
})

test('criarComAnexos: cria a tarefa e envia os anexos para ela', async () => {
  const chamadas = []
  const criar = async (projeto, t) => {
    chamadas.push(['criar', projeto, t.titulo])
    return { codigo: 'nova', avisosOcupacao: [] }
  }
  const enviar = async (dono, codigo, arquivos) => {
    chamadas.push(['enviar', dono, codigo, arquivos.map(a => a.name)])
    return { enviados: 1, falhas: [{ nome: 'b.pdf', erro: 'Falhou' }] }
  }
  const r = await criarComAnexos('p1', { titulo: 'X' }, [{ name: 'a.pdf' }, { name: 'b.pdf' }], { criar, enviar })
  assert.deepEqual(chamadas, [
    ['criar', 'p1', 'X'],
    ['enviar', 'tarefas', 'nova', ['a.pdf', 'b.pdf']],
  ])
  assert.equal(r.criada.codigo, 'nova')
  assert.deepEqual(r.falhas, [{ nome: 'b.pdf', erro: 'Falhou' }])
})

test('criarComAnexos: sem arquivos não chama o envio', async () => {
  let enviou = false
  const r = await criarComAnexos('p1', { titulo: 'X' }, [], {
    criar: async () => ({ codigo: 'nova' }),
    enviar: async () => {
      enviou = true
    },
  })
  assert.equal(enviou, false)
  assert.deepEqual(r.falhas, [])
})

test('criarComAnexos: falha ao criar não envia anexos', async () => {
  let enviou = false
  await assert.rejects(
    criarComAnexos('p1', {}, [{ name: 'a.pdf' }], {
      criar: async () => {
        throw new Error('Título obrigatório')
      },
      enviar: async () => {
        enviou = true
      },
    }),
    /Título obrigatório/,
  )
  assert.equal(enviou, false)
})
