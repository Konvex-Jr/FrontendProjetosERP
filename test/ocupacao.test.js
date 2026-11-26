import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apoioTarefa } from '../src/services/ocupacao.js'
import {
  DIFICULDADES,
  comCarga,
  opcoesDificuldade,
  faixaOcupacao,
  formatarHoras,
  proximaSemana,
  rotuloDificuldade,
  horasPorDia,
  resumoOcupacao,
  rotuloSemana,
  segundaDaSemana,
  semanaAnterior,
  textoAviso,
} from '../src/lib/ocupacao.js'

test('DIFICULDADES na ordem', () => {
  assert.deepEqual(
    DIFICULDADES.map(d => d[0]),
    ['rapida', 'facil', 'media', 'dificil'],
  )
  assert.equal(DIFICULDADES[3][1], 'Difícil')
})

test('rotuloDificuldade', () => {
  assert.equal(rotuloDificuldade('media', 75), 'Média (75% do dia)')
  assert.equal(rotuloDificuldade('rapida', 25), 'Rápida (25% do dia)')
  assert.equal(rotuloDificuldade('facil'), 'Fácil')
})

test('formatarHoras', () => {
  assert.equal(formatarHoras(4.8), '4,8 h')
  assert.equal(formatarHoras(4), '4 h')
  assert.equal(formatarHoras(0), '0 h')
  assert.equal(formatarHoras(2.25), '2,3 h')
})

test('faixaOcupacao', () => {
  assert.equal(faixaOcupacao(0), 'ok')
  assert.equal(faixaOcupacao(80), 'ok')
  assert.equal(faixaOcupacao(81), 'atencao')
  assert.equal(faixaOcupacao(100), 'atencao')
  assert.equal(faixaOcupacao(101), 'perigo')
})

test('segundaDaSemana', () => {
  assert.equal(segundaDaSemana('2026-11-23'), '2026-11-23')
  assert.equal(segundaDaSemana('2026-11-25'), '2026-11-23')
  assert.equal(segundaDaSemana('2026-11-29'), '2026-11-23')
  assert.equal(segundaDaSemana('2026-12-31'), '2026-12-28')
})

test('semanaAnterior e proximaSemana', () => {
  assert.equal(semanaAnterior('2026-11-25'), '2026-11-16')
  assert.equal(proximaSemana('2026-11-29'), '2026-11-30')
  assert.equal(proximaSemana('2026-12-31'), '2027-01-04')
  assert.equal(semanaAnterior('2027-01-01'), '2026-12-21')
})

test('rotuloSemana', () => {
  assert.equal(rotuloSemana('2026-11-25'), '23/11 a 29/11')
  assert.equal(rotuloSemana('2026-12-31'), '28/12 a 03/01')
})

test('textoAviso', () => {
  assert.equal(
    textoAviso({ nome: 'Ana', horas: 12, teto: 10, percentual: 120, semana: '2026-11-23' }),
    'Ana fica com 120% na semana de 23/11 (12 h de 10 h).',
  )
})

test('opcoesDificuldade e comCarga', () => {
  assert.deepEqual(opcoesDificuldade({ media: 75 })[0], ['', 'Sem classificação'])
  assert.deepEqual(opcoesDificuldade({ media: 75 })[3], ['media', 'Média (75% do dia)'])
  assert.equal(opcoesDificuldade(null)[3][1], 'Média')
  const l = comCarga(
    [
      { id: 1, nome: 'Ana' },
      { id: 2, nome: 'Bia' },
    ],
    { 1: 120 },
  )
  assert.deepEqual(
    l.map(u => u.nome),
    ['Ana · 120%', 'Bia'],
  )
})

test('apoioTarefa nunca lança: Date, texto inválido ou chamadas falhando viram o vazio', async () => {
  const vazio = { horas: null, carga: {} }
  assert.deepEqual(await apoioTarefa(new Date()), vazio)
  assert.deepEqual(await apoioTarefa('lixo'), vazio)
  // Sem API no teste, as duas chamadas falham: mesmo assim resolve.
  assert.deepEqual(await apoioTarefa('2026-11-19'), vazio)
})

const pess = (i, percentual) => ({ codigoUsuario: i, nome: `P${i}`, percentual })

test('resumoOcupacao: lista vazia', () => {
  assert.deepEqual(resumoOcupacao([]), { acima: 0, mais: [], livres: [] })
})

test('resumoOcupacao: mais, livres e acima', () => {
  const lista = [...[10, 20, 30, 40, 45].map((p, i) => pess(i + 1, p)), ...[60, 70, 100, 110, 120, 130, 140].map((p, i) => pess(i + 10, p))]
  const r = resumoOcupacao(lista)
  assert.equal(r.acima, 4)
  assert.deepEqual(
    r.mais.map(x => x.percentual),
    [140, 130, 120, 110, 100],
  )
  assert.deepEqual(
    r.livres.map(x => x.percentual),
    [10, 20, 30, 40, 45],
  )
})

test('resumoOcupacao: 100 exato não conta como acima', () => {
  assert.equal(resumoOcupacao([pess(1, 100)]).acima, 0)
})

test('resumoOcupacao: pessoa não aparece nas duas listas', () => {
  const r = resumoOcupacao([pess(1, 10), pess(2, 20), pess(3, 90)])
  const ids = [...r.mais, ...r.livres].map(x => x.codigoUsuario)
  assert.equal(new Set(ids).size, ids.length)
})

test('horasPorDia: % do dia × teto ÷ 5', () => {
  assert.equal(horasPorDia(100), 2)
  assert.equal(horasPorDia(75), 1.5)
  assert.equal(horasPorDia(100, 20), 4)
})
