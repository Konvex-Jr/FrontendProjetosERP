import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classeItem,
  corpoReuniao,
  linkGoogleAgenda,
  periodoDaGrade,
  rotuloItem,
  somarMinutos,
  textoDuracao,
  valoresReuniao,
} from '../src/lib/agenda.js'

test('periodoDaGrade cobre a grade inteira (domingo a sábado)', () => {
  assert.deepEqual(periodoDaGrade('2026-11'), { de: '2026-11-01', ate: '2026-12-05' })
  assert.deepEqual(periodoDaGrade('2026-12'), { de: '2026-11-29', ate: '2027-01-02' })
})

test('somarMinutos passa da meia-noite e do fim do ano', () => {
  assert.deepEqual(somarMinutos('2026-11-24', '14:00', 90), { data: '2026-11-24', hora: '15:30' })
  assert.deepEqual(somarMinutos('2026-12-31', '23:30', 60), { data: '2027-01-01', hora: '00:30' })
})

test('linkGoogleAgenda preenche título, horário de São Paulo, local e convidados', () => {
  const url = new URL(
    linkGoogleAgenda({
      titulo: 'Alinhamento & plano',
      data: '2026-11-24',
      hora: '14:00',
      duracaoMinutos: 30,
      local: 'https://meet.google.com/abc',
      descricao: '',
      participantes: [{ email: 'ana@konvexjr.com.br' }, { email: 'bia@konvexjr.com.br' }, { email: '' }],
    }),
  )
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render')
  assert.equal(url.searchParams.get('action'), 'TEMPLATE')
  assert.equal(url.searchParams.get('text'), 'Alinhamento & plano')
  assert.equal(url.searchParams.get('dates'), '20261124T140000/20261124T143000')
  assert.equal(url.searchParams.get('ctz'), 'America/Sao_Paulo')
  assert.equal(url.searchParams.get('location'), 'https://meet.google.com/abc')
  assert.equal(url.searchParams.get('add'), 'ana@konvexjr.com.br,bia@konvexjr.com.br')
  assert.equal(url.searchParams.has('details'), false)
})

test('rótulo e cor de cada tipo de item', () => {
  assert.equal(rotuloItem({ tipo: 'reuniao', hora: '14:00', titulo: 'Daily' }), '14:00 Daily')
  assert.equal(rotuloItem({ tipo: 'prazo', titulo: 'Relatório' }), 'Prazo: Relatório')
  assert.equal(rotuloItem({ tipo: 'prazo', titulo: null, projeto: { nome: 'Secreto' } }), 'Prazo de tarefa · Secreto')
  assert.equal(classeItem({ tipo: 'prazo', atrasada: true }), 'ag-prazo atrasada')
  assert.equal(classeItem({ tipo: 'prazo', concluida: true }), 'ag-prazo ok')
  assert.equal(classeItem({ tipo: 'capacitacao' }), 'ag-capacitacao')
})

test('textoDuracao e formulário da reunião', () => {
  assert.equal(textoDuracao(30), '30 min')
  assert.equal(textoDuracao(60), '1 h')
  assert.equal(textoDuracao(90), '1 h 30')
  assert.deepEqual(valoresReuniao(null, '2026-11-24').data, '2026-11-24')
  const v = valoresReuniao({ titulo: 'D', data: '2026-11-24', hora: '09:00', duracaoMinutos: 45, participantes: [{ codigo: 'a' }] })
  assert.deepEqual(v.participantes, ['a'])
  assert.equal(corpoReuniao(v).duracaoMinutos, 45)
})
