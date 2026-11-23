import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularPreco, regrasDoFormulario, validadeAte, CAMPOS_REGRAS, lerCampo } from '../src/lib/precificacao.js'

const REGRAS = {
  complexidade: { baixa: 0, media: 15, alta: 30 },
  risco: { escopo: 10, tecnologia: 10, terceiros: 5 },
  urgencia: 20,
  tipoCliente: { parceira: -20, pequena: 0, mediaGrande: 20 },
  contingencia: 10,
  suporteHorasMes: 4,
  impostos: 10,
  margem: 30,
  margemMinima: 15,
  descontoMaximo: 15,
  validadeDias: 15,
}
const SENIORIDADES = [
  { codigo: 'junior', nome: 'Júnior' },
  { codigo: 'pleno', nome: 'Pleno' },
  { codigo: 'senior', nome: 'Sênior' },
]
const base = escolhas =>
  calcularPreco({
    senioridades: SENIORIDADES,
    horas: { junior: 40, senior: 10 },
    valoresHora: { junior: 45, pleno: 75, senior: 120 },
    regras: REGRAS,
    escolhas: { margem: 30, ...escolhas },
  })
const perto = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≠ ${b}`)

test('custo com contingência e suporte ao valor-hora médio', () => {
  const r = base({ mesesSuporte: 2 })
  assert.deepEqual(
    r.linhas.map(l => l.codigo),
    ['junior', 'senior'],
  )
  assert.equal(r.horasBase, 50)
  perto(r.horasProjeto, 55)
  assert.equal(r.horasSuporte, 8)
  perto(r.custo, 3780) // 3000 + 300 de contingência + 8 h × 60
})

test('regras em sequência, desconto e impostos por dentro', () => {
  const r = base({ mesesSuporte: 2, complexidade: 'alta', tipoCliente: 'parceira', desconto: 5, justificativa: 'Parceria' })
  perto(r.liquido, 3780 * 1.3 * 1.3 * 0.8 * 0.95)
  perto(r.total, r.liquido / 0.9)
  assert.equal(r.abaixoDaMargem, false)
  assert.equal(r.podeGerarDocumento, true)
  const rotulos = r.memoria.map(m => m.rotulo)
  assert.ok(rotulos.includes('Complexidade alta (+30%)'))
  assert.ok(rotulos.includes('Cliente: ONG ou EJ parceira (-20%)'))
  assert.equal(rotulos.at(-1), 'Preço final')
  perto(r.memoria.at(-1).subtotal, r.total)
})

test('riscos e urgência somam um passo cada', () => {
  const r = base({ riscos: ['escopo', 'terceiros'], urgente: true })
  const passos = r.memoria.filter(m => /Risco|Urgência/.test(m.rotulo)).map(m => m.rotulo)
  assert.deepEqual(passos, ['Risco: escopo pouco definido (+10%)', 'Risco: dependência de terceiros (+5%)', 'Urgência (+20%)'])
  perto(r.liquido, 3300 * 1.3 * 1.1 * 1.05 * 1.2)
})

test('alerta de margem mínima, teto do desconto e justificativa', () => {
  const r = base({ margem: 0, tipoCliente: 'parceira' })
  assert.equal(r.abaixoDaMargem, true)
  assert.equal(base({ desconto: 20, justificativa: 'x' }).descontoAcimaDoTeto, true)
  assert.equal(base({ desconto: 20, justificativa: 'x' }).podeGerarDocumento, false)
  assert.equal(base({ desconto: 5, justificativa: '  ' }).faltaJustificativa, true)
  assert.equal(base({ desconto: 0 }).faltaJustificativa, false)
})

test('sem horas: zero, sem alerta e sem documento', () => {
  const r = calcularPreco({ senioridades: SENIORIDADES, horas: {}, valoresHora: {}, regras: REGRAS, escolhas: { margem: 30 } })
  assert.equal(r.total, 0)
  assert.equal(r.abaixoDaMargem, false)
  assert.equal(r.podeGerarDocumento, false)
})

test('formulário de regras ida e volta', () => {
  const plano = Object.fromEntries(CAMPOS_REGRAS.map(([c]) => [c, String(lerCampo(REGRAS, c))]))
  assert.deepEqual(regrasDoFormulario(plano), REGRAS)
})

test('validade soma dias corridos', () => {
  assert.equal(validadeAte(new Date(2026, 11, 25), 15), '09/01/2027')
})
