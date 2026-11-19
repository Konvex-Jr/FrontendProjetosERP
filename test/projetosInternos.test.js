import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  areasDosProjetos,
  comArea,
  erroDoFormularioProjeto,
  filtrarProjetos,
  gruposDeProjetos,
  rotuloTipo,
} from '../src/lib/projetosInternos.js'

const area = (areaId, areaNome) => ({ areaId, areaNome })
const projetos = [
  { id: 1, nome: 'Site', tipo: 'cliente' },
  { id: 2, nome: 'App', tipo: 'cliente' },
  { id: 3, nome: 'Robô', tipo: 'interno', ...area(10, 'Inovação') },
  { id: 4, nome: 'Geral Inovação', tipo: 'interno', geralDaArea: true, ...area(10, 'Inovação') },
  { id: 5, nome: 'Geral Execução', tipo: 'interno', geralDaArea: true, ...area(11, 'Execução') },
]

test('rotuloTipo', () => {
  assert.equal(rotuloTipo(projetos[3]), 'Geral da área')
  assert.equal(rotuloTipo(projetos[2]), 'Interno')
  assert.equal(rotuloTipo(projetos[0]), 'Cliente')
})

test('filtrarProjetos por tipo e área', () => {
  assert.equal(filtrarProjetos(projetos, {}).length, 5)
  assert.deepEqual(
    filtrarProjetos(projetos, { tipo: 'interno' }).map(p => p.id),
    [3, 4, 5],
  )
  assert.deepEqual(
    filtrarProjetos(projetos, { tipo: 'cliente' }).map(p => p.id),
    [1, 2],
  )
  assert.deepEqual(
    filtrarProjetos(projetos, { areaId: 10 }).map(p => p.id),
    [3, 4],
  )
  assert.deepEqual(
    filtrarProjetos(projetos, { areaId: '11', tipo: 'interno' }).map(p => p.id),
    [5],
  )
})

test('gruposDeProjetos: clientes, depois áreas em ordem alfabética, geral primeiro', () => {
  const grupos = gruposDeProjetos(projetos)
  assert.deepEqual(
    grupos.map(g => g.rotulo),
    ['Clientes', 'Execução', 'Inovação'],
  )
  assert.deepEqual(
    grupos[2].projetos.map(p => p.id),
    [4, 3],
  )
  assert.deepEqual(
    gruposDeProjetos(projetos.slice(2, 3)).map(g => g.rotulo),
    ['Inovação'],
  )
})

test('gruposDeProjetos agrupa pelo id da área, não pelo nome', () => {
  const g = gruposDeProjetos([
    { id: 1, nome: 'A', tipo: 'interno', ...area(1, 'Mesma') },
    { id: 2, nome: 'B', tipo: 'interno', ...area(2, 'Mesma') },
  ])
  assert.equal(g.length, 2)
})

test('comArea achata a área e assume cliente sem tipo', () => {
  assert.deepEqual(comArea({ codigo: 'p', area: { codigo: 'a', nome: 'Tec' } }), {
    codigo: 'p',
    area: { codigo: 'a', nome: 'Tec' },
    tipo: 'cliente',
    areaId: 'a',
    areaNome: 'Tec',
  })
  assert.equal(comArea({ tipo: 'interno', area: null }).areaId, null)
})

test('areasDosProjetos lista cada área uma vez, em ordem', () => {
  const ps = [area('b', 'Vendas'), area('a', 'Tecnologia'), area('b', 'Vendas'), area(null, null)]
  assert.deepEqual(areasDosProjetos(ps), [
    ['a', 'Tecnologia'],
    ['b', 'Vendas'],
  ])
})

test('projeto interno exige área; cliente não', () => {
  assert.match(erroDoFormularioProjeto({ tipo: 'interno', codigoArea: '' }), /área/)
  assert.equal(erroDoFormularioProjeto({ tipo: 'interno', codigoArea: 'a' }), '')
  assert.equal(erroDoFormularioProjeto({ tipo: 'cliente', codigoArea: '' }), '')
})
