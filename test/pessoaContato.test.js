import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  copiarTexto,
  ingressoValido,
  mascararIngresso,
  mascararTelefone,
  telefoneParaMostrar,
  telefoneValido,
} from '../src/lib/pessoaContato.js'

test('mascararTelefone formata enquanto digita', () => {
  assert.equal(mascararTelefone(''), '')
  assert.equal(mascararTelefone('1'), '(1')
  assert.equal(mascararTelefone('1198'), '(11) 98')
  assert.equal(mascararTelefone('1134567890'), '(11) 3456-7890')
  assert.equal(mascararTelefone('11987654321'), '(11) 98765-4321')
  assert.equal(mascararTelefone('(11) 98765-43219'), '(11) 98765-4321')
  assert.equal(mascararTelefone('abc'), '')
})

test('telefoneParaMostrar', () => {
  assert.equal(telefoneParaMostrar(null), null)
  assert.equal(telefoneParaMostrar('11987654321'), '(11) 98765-4321')
  assert.equal(telefoneParaMostrar('1134567890'), '(11) 3456-7890')
  assert.equal(telefoneParaMostrar('ramal 12'), 'ramal 12')
})

test('telefoneValido', () => {
  assert.equal(telefoneValido(''), true)
  assert.equal(telefoneValido('(11) 98765-4321'), true)
  assert.equal(telefoneValido('(11) 3456-7890'), true)
  assert.equal(telefoneValido('(11) 9876'), false)
})

test('copiarTexto sem clipboard devolve false', async () => {
  assert.equal(await copiarTexto('x'), false)
})

test('copiarTexto com clipboard', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  try {
    await comClipboard()
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete globalThis.navigator
  }
})

async function comClipboard() {
  let copiado
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async t => (copiado = t) } }, configurable: true })
  assert.equal(await copiarTexto('oi'), true)
  assert.equal(copiado, 'oi')
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: {
        writeText: async () => {
          throw new Error('x')
        },
      },
    },
    configurable: true,
  })
  assert.equal(await copiarTexto('oi'), false)
}

test('mascararIngresso formata AAAA/S enquanto digita', () => {
  assert.equal(mascararIngresso(''), '')
  assert.equal(mascararIngresso('20'), '20')
  assert.equal(mascararIngresso('2025'), '2025')
  assert.equal(mascararIngresso('20251'), '2025/1')
  assert.equal(mascararIngresso('2025/2'), '2025/2')
  assert.equal(mascararIngresso('2025/12345'), '2025/1')
  assert.equal(mascararIngresso('ab'), '')
})

test('ingressoValido confere formato, ano mínimo e semestre atual', () => {
  const hoje = new Date(2026, 10, 20) // 2026/2
  assert.equal(ingressoValido('2025/1', hoje), true)
  assert.equal(ingressoValido('2026/2', hoje), true)
  assert.equal(ingressoValido('2000/1', hoje), true)
  assert.equal(ingressoValido('2027/1', hoje), false)
  assert.equal(ingressoValido('1999/2', hoje), false)
  assert.equal(ingressoValido('2025/3', hoje), false)
  assert.equal(ingressoValido('2025', hoje), false)
  assert.equal(ingressoValido('', hoje), false)
  assert.equal(ingressoValido('2026/2', new Date(2026, 2, 1)), false)
  assert.equal(ingressoValido('2026/1', new Date(2026, 2, 1)), true)
})
