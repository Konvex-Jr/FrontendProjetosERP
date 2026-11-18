import assert from 'node:assert/strict'
import { test } from 'node:test'
import { erroDatas, rotuloArea, separarPeriodos } from '../src/lib/periodos.js'

const periodo = (area, inicio, fim = null, cargo = null) => ({
  codigo: `${area}-${inicio}`,
  area: { codigo: area, nome: area },
  cargo: cargo ? { codigo: cargo, nome: cargo } : null,
  inicio: `${inicio}T00:00:00.000Z`,
  fim: fim ? `${fim}T00:00:00.000Z` : null,
})

test('separa atuais (por nome da área) e anteriores (fim mais recente primeiro)', () => {
  const { atuais, anteriores } = separarPeriodos([
    periodo('Marketing', '2025-01-01', '2025-06-01'),
    periodo('Projetos', '2026-01-01'),
    periodo('Execução', '2025-08-01'),
    periodo('Marketing', '2025-07-01', '2026-01-01'),
  ])
  assert.deepEqual(
    atuais.map(p => p.area.nome),
    ['Execução', 'Projetos'],
  )
  assert.deepEqual(
    anteriores.map(p => p.inicio.slice(0, 10)),
    ['2025-07-01', '2025-01-01'],
  )
})

test('separar aceita lista vazia ou ausente', () => {
  assert.deepEqual(separarPeriodos(undefined), { atuais: [], anteriores: [] })
})

test('rótulo com e sem cargo', () => {
  assert.equal(rotuloArea({ area: { nome: 'Inovação' }, cargo: { nome: 'Gerente' } }), 'Inovação · Gerente')
  assert.equal(rotuloArea({ area: { nome: 'Inovação' }, cargo: null }), 'Inovação')
})

test('erroDatas segue as regras do back', () => {
  const hoje = '2026-11-18'
  assert.match(erroDatas({ inicio: '', fim: '' }, hoje), /início/i)
  assert.match(erroDatas({ inicio: '2026-11-19', fim: '' }, hoje), /futuro/i)
  assert.match(erroDatas({ inicio: '2026-01-01', fim: '2026-11-19' }, hoje), /futuro/i)
  assert.match(erroDatas({ inicio: '2026-01-01', fim: '2026-01-01' }, hoje), /depois do início/i)
  assert.match(erroDatas({ inicio: '2026-02-01', fim: '2026-01-01' }, hoje), /depois do início/i)
  assert.equal(erroDatas({ inicio: '2026-01-01', fim: '' }, hoje), null)
  assert.equal(erroDatas({ inicio: '2026-01-01', fim: '2026-11-18' }, hoje), null)
  assert.equal(erroDatas({ inicio: '2026-11-18', fim: null }, hoje), null)
})
