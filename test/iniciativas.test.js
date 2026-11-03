import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adaptIniciativa, consulta, corpoIniciativa, progressoTarefas, rotulo, valoresIniciativa } from '../src/services/iniciativas.js'
import { corpoNovaTarefa, corpoTarefa, origemTarefa } from '../src/services/tarefas.js'
import { adaptTask } from '../src/lib/apiMappers.js'

const api = {
  codigo: 'i1', titulo: 'Chatbot', descricao: '## A', tipo: 'servico', frente: 'radar', status: 'andamento',
  responsavel: { codigo: 'u1', nome: 'Ana' }, criadoPor: { codigo: 'u2', nome: 'Bia' },
  dataInicio: '2026-11-03T00:00:00.000Z', dataFim: null, resultado: '', aprendizados: 'x',
  projetos: [{ codigo: 'p1', nome: 'Site' }], conhecimentos: [{ codigo: 'k1', nome: 'Pesquisa' }],
  tarefas: [{ codigo: 't1', titulo: 'Protótipo', status: 'pendente', prioridade: 'P2', dataFim: '2026-11-10T00:00:00.000Z', responsaveis: [{ codigo: 'u1', nome: 'Ana' }] }],
  totalTarefas: 3, tarefasConcluidas: 1, podeAlterar: true,
}

test('adaptIniciativa traz referências, datas curtas, tarefas e contagem', () => {
  const i = adaptIniciativa(api)
  assert.equal(i.id, 'i1')
  assert.equal(i.responsavel, 'Ana')
  assert.equal(i.inicio, '2026-11-03')
  assert.equal(i.fim, '')
  assert.deepEqual(i.conhecimentos, [{ id: 'k1', nome: 'Pesquisa' }])
  assert.deepEqual(i.tarefas[0], { id: 't1', titulo: 'Protótipo', status: 'pendente', prioridade: 'P2', fim: '2026-11-10', responsaveis: ['Ana'] })
  assert.equal(progressoTarefas(i), '1 de 3')
  assert.equal(progressoTarefas(adaptIniciativa({ codigo: 'x', titulo: 'T' })), '—')
  assert.equal(adaptIniciativa({ codigo: 'x', titulo: 'T' }).responsavel, '—')
})

test('consulta manda só os filtros preenchidos, com os nomes da API', () => {
  assert.equal(consulta({}), '')
  assert.equal(consulta({ busca: ' ia ', status: 'ideia', frente: '', responsavel: 'u1', projeto: 'p1' }),
    '?busca=ia&status=ideia&codigoResponsavel=u1&codigoProjeto=p1')
})

test('formulário: valores de uma iniciativa e corpo enviado à API', () => {
  const v = valoresIniciativa(adaptIniciativa(api))
  assert.deepEqual(v.projetos, ['p1'])
  assert.deepEqual(v.conhecimentos, ['k1'])
  const corpo = corpoIniciativa({ ...v, titulo: '  Chatbot 2 ', fim: '' })
  assert.equal(corpo.titulo, 'Chatbot 2')
  assert.equal(corpo.codigoResponsavel, 'u1')
  assert.equal(corpo.dataFim, null)
  assert.deepEqual(corpo.codigosConhecimentos, ['k1'])
  // Nova sem responsável escolhido: a API usa quem cria.
  assert.equal('codigoResponsavel' in corpoIniciativa(valoresIniciativa(null, { titulo: 'X' })), false)
  assert.equal(valoresIniciativa(null).status, 'ideia')
})

test('rotulo usa a lista da API e cai no valor quando não acha', () => {
  const lista = [{ valor: 'radar', rotulo: 'Radar de Mercado' }]
  assert.equal(rotulo(lista, 'radar'), 'Radar de Mercado')
  assert.equal(rotulo(lista, 'outra'), 'outra')
})

test('tarefa de Inovação leva a iniciativa; outras categorias mandam null', () => {
  const t = { titulo: 'T', inicio: '2026-11-03', fim: '2026-11-04', categoria: 'inovacao', iniciativaId: 'i1' }
  assert.equal(corpoNovaTarefa(null, t).codigoIniciativa, 'i1')
  assert.equal(corpoNovaTarefa(null, { ...t, categoria: 'execucao' }).codigoIniciativa, null)
  assert.equal('codigoIniciativa' in corpoNovaTarefa('p1', t), false)
  assert.equal(corpoTarefa({ ...t, avulsa: true, status: 'pendente' }).codigoIniciativa, 'i1')
  assert.equal('codigoIniciativa' in corpoTarefa({ ...t, avulsa: false, status: 'pendente' }), false)
  const tarefa = adaptTask({ codigo: 't1', categoria: 'inovacao', iniciativa: { codigo: 'i1', nome: 'Chatbot' }, titulo: 'T', dataInicio: '2026-11-03', dataFim: '2026-11-04' })
  assert.equal(tarefa.iniciativaId, 'i1')
  assert.equal(origemTarefa(tarefa), 'Inovação · Chatbot')
})
