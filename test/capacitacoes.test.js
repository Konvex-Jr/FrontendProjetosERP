import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mudarMes, nomeDoMes, semanasDoMes } from '../src/lib/calendario.js'
import { adaptCapacitacao, horas, valoresCapacitacao } from '../src/services/capacitacoes.js'

test('semanasDoMes monta semanas de domingo a sábado e põe cada evento no seu dia', () => {
  const semanas = semanasDoMes('2026-11', [{ data: '2026-11-09', t: 'Git' }, { data: '2026-11-09', t: 'SQL' }, { data: '2026-12-01', t: 'fora' }])
  assert.equal(semanas.length, 5)
  assert.equal(semanas[0][0].data, '2026-11-01') // 1º de novembro de 2026 é domingo
  assert.equal(semanas[4][6].data, '2026-12-05')
  assert.equal(semanas[4][6].doMes, false)
  const dia9 = semanas.flat().find(d => d.data === '2026-11-09')
  assert.deepEqual(dia9.eventos.map(e => e.t), ['Git', 'SQL'])
  assert.equal(semanas.flat().find(d => d.data === '2026-12-01').eventos.length, 1)
  assert.equal(semanasDoMes('2026-02')[0][0].data, '2026-02-01')
})

test('mudarMes atravessa o ano e nomeDoMes escreve em português', () => {
  assert.equal(mudarMes('2026-01', -1), '2025-12')
  assert.equal(mudarMes('2026-12', 1), '2027-01')
  assert.equal(nomeDoMes('2026-03'), 'Março de 2026')
})

test('adaptCapacitacao lê a resposta da API e sabe se veio a lista de inscritos', () => {
  const c = adaptCapacitacao({
    codigo: 'c1', titulo: 'Git', data: '2026-11-20', hora: '18:30', duracaoHoras: 1.5, instrutor: { codigo: 'u1', nome: 'Inês' },
    vagas: 10, tipo: 'computacao', sala: 'Lab', totalInscritos: 3, vagasRestantes: 7, situacao: 'aberta', inscrito: true,
    avaliacao: { media: 4.5, total: 2 }, podeCancelar: true,
  })
  assert.equal(c.instrutor, 'Inês')
  assert.equal(c.verInscritos, false)
  assert.equal(c.media, 4.5)
  assert.equal(c.podeCancelar, true)
  assert.equal(adaptCapacitacao({ codigo: 'c2', inscritos: [{ codigo: 'u2', nome: 'Bia', presente: true }] }).inscritos[0].presente, true)
  assert.equal(valoresCapacitacao(c).duracaoHoras, '1,5')
})

test('horas escreve a duração de forma curta', () => {
  assert.equal(horas(1), '1 h')
  assert.equal(horas(1.5), '1h30')
  assert.equal(horas(0.5), '0h30')
})
