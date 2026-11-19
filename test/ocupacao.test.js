import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DIFICULDADES,
  faixaOcupacao,
  formatarHoras,
  proximaSemana,
  rotuloDificuldade,
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
  assert.equal(rotuloDificuldade('media', 4), 'Média (4 h)')
  assert.equal(rotuloDificuldade('rapida', 1.5), 'Rápida (1,5 h)')
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
