import { describe, expect, it } from 'vitest'
import { forcaSenha, regrasSenha } from './senha'

describe('forcaSenha', () => {
  it('fraca quando alguma regra falha', () => {
    expect(forcaSenha('abc')).toBe('fraca')
    expect(forcaSenha('')).toBe('fraca')
    expect(forcaSenha('konvex@123')).toBe('fraca')
  })
  it('média quando cumpre o mínimo', () => {
    expect(forcaSenha('Konvex@123')).toBe('media')
  })
  it('forte com 12+ caracteres ou 2+ especiais e minúscula', () => {
    expect(forcaSenha('Konvex@123456')).toBe('forte')
    expect(forcaSenha('Konvex@#12a')).toBe('forte')
  })
})

describe('regrasSenha', () => {
  it('espaço é caractere especial', () => {
    const regras = regrasSenha('KONVEX 12')
    expect(regras.map(r => r.chave)).toEqual(['tamanho', 'maiuscula', 'numero', 'especial'])
    expect(regras.every(r => r.ok)).toBe(true)
  })
  it('marca só o que falta', () => {
    expect(regrasSenha('abc').map(r => r.ok)).toEqual([false, false, false, false])
    expect(regrasSenha('Abcdefgh1').find(r => r.chave === 'especial').ok).toBe(false)
  })
})
