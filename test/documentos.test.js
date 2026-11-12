import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adaptDocumento,
  adaptPasta,
  corpoDocumento,
  corpoPasta,
  dominio,
  normalizarLink,
  rotuloSigilo,
} from '../src/services/documentos.js'

test('adaptPasta traz sigilo e projeto; rotuloSigilo descreve quem lê', () => {
  const p = adaptPasta({ codigo: 'p1', nome: 'Entregas', sigilo: 'projeto', projeto: { codigo: 'proj', nome: 'Site' } })
  assert.deepEqual(p, { id: 'p1', nome: 'Entregas', sigilo: 'projeto', projetoId: 'proj', projetoNome: 'Site' })
  assert.equal(rotuloSigilo(p), 'Equipe: Site')
  assert.equal(rotuloSigilo(adaptPasta({ codigo: 'p2', nome: 'X' })), 'Todos')
  assert.equal(rotuloSigilo({ sigilo: 'gestao' }), 'Só gestão')
})

test('corpoPasta só manda projeto quando o sigilo é projeto', () => {
  assert.deepEqual(corpoPasta({ nome: ' Fin ', sigilo: 'gestao', projetoId: 'proj' }), {
    nome: 'Fin',
    sigilo: 'gestao',
    codigoProjeto: null,
  })
  assert.deepEqual(corpoPasta({ nome: 'E', sigilo: 'projeto', projetoId: 'proj' }), { nome: 'E', sigilo: 'projeto', codigoProjeto: 'proj' })
})

test('documento é link: completa https e mostra o domínio', () => {
  assert.equal(normalizarLink('drive.google.com/x'), 'https://drive.google.com/x')
  assert.equal(normalizarLink('http://a.com'), 'http://a.com')
  assert.deepEqual(corpoDocumento({ nome: ' Ata ', url: 'docs.google.com/d/1' }), {
    nome: 'Ata',
    arquivoUrl: 'https://docs.google.com/d/1',
  })
  assert.equal(dominio('https://www.notion.so/abc'), 'notion.so')
  const d = adaptDocumento({
    codigo: 'd1',
    pasta: { codigo: 'p1' },
    nome: 'Ata',
    arquivoUrl: 'https://drive.google.com/a',
    dataEnvio: '2026-11-03T00:00:00.000Z',
    autor: { nome: 'Ana' },
  })
  assert.equal(d.dominio, 'drive.google.com')
  assert.equal(d.data, '2026-11-03')
  assert.equal(d.autor, 'Ana')
})
