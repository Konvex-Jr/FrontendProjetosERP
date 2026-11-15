import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { anteciparDados, precarregarPaginas, esquecerAntecipacoes } from '../src/lib/antecipar.js'
import { memoria } from '../src/lib/memoria.js'

// Agenda na hora: o teste não precisa esperar o navegador ficar ocioso.
const agora = fn => fn()
const esperar = () => new Promise(r => setTimeout(r, 0))
const nav = caminhos => caminhos.map((c, i) => [`k${i}`, `Item ${i}`, c])

// Página falsa: o .precarregar() devolve o "módulo" com dadosDaTela.
const paginaCom = (modulo, contador = { n: 0 }) => ({ precarregar: () => (contador.n++, Promise.resolve(modulo)) })

beforeEach(() => {
  memoria.definirPessoa(null)
  memoria.definirPessoa('p1')
  esquecerAntecipacoes()
})

test('precarregarPaginas agenda só os caminhos do menu', () => {
  const baixadas = []
  const paginas = {
    '/tarefas': { precarregar: () => (baixadas.push('/tarefas'), Promise.resolve({})) },
    '/projetos': { precarregar: () => (baixadas.push('/projetos'), Promise.resolve({})) },
    '/usuarios': { precarregar: () => (baixadas.push('/usuarios'), Promise.resolve({})) },
  }
  const agendadas = []
  precarregarPaginas(['/tarefas', '/projetos', '/desconhecida'], paginas, fn => agendadas.push(fn))
  // Nada baixa antes da hora agendada.
  assert.deepEqual(baixadas, [])
  agendadas.forEach(fn => fn())
  assert.deepEqual(baixadas, ['/tarefas', '/projetos'])
})

test('erro ao baixar uma página não quebra as outras', async () => {
  const baixadas = []
  const paginas = {
    '/a': { precarregar: () => Promise.reject(new Error('chunk sumiu')) },
    '/b': {
      precarregar: () => {
        throw new Error('falha síncrona')
      },
    },
    '/c': { precarregar: () => (baixadas.push('/c'), Promise.resolve({})) },
  }
  assert.doesNotThrow(() => precarregarPaginas(['/a', '/b', '/c'], paginas, agora))
  await esperar()
  assert.deepEqual(baixadas, ['/c'])
})

test('anteciparDados grava na memória com a chave da tela', async () => {
  const recebidos = []
  const modulo = {
    dadosDaTela: contexto => (recebidos.push(contexto), { chave: `tela:${contexto.me}`, carregar: async () => ({ lista: [1, 2] }) }),
  }
  const contexto = { me: 'p1', mb: false, pode: () => true, nav: nav(['/tela']) }
  await anteciparDados('/tela', contexto, { paginas: { '/tela': paginaCom(modulo) } })
  assert.deepEqual(memoria.obter('tela:p1'), { lista: [1, 2] })
  assert.equal(recebidos[0].me, 'p1')
})

test('anteciparDados ignora caminho sem dadosDaTela', async () => {
  const contador = { n: 0 }
  const contexto = { me: 'p1', nav: nav(['/sem']) }
  await assert.doesNotReject(anteciparDados('/sem', contexto, { paginas: { '/sem': paginaCom({ default: () => null }, contador) } }))
  // Também sem página registrada para o caminho.
  await assert.doesNotReject(anteciparDados('/outra', { me: 'p1', nav: nav(['/outra']) }, { paginas: {} }))
  assert.equal(contador.n, 1)
})

test('anteciparDados não busca caminho fora do menu nem sem pessoa logada', async () => {
  let chamadas = 0
  const modulo = { dadosDaTela: () => ({ chave: 'x', carregar: async () => (chamadas++, 1) }) }
  const paginas = { '/x': paginaCom(modulo) }
  await anteciparDados('/x', { me: 'p1', nav: nav(['/outra']) }, { paginas })
  await anteciparDados('/x', { me: null, nav: nav(['/x']) }, { paginas })
  assert.equal(chamadas, 0)
  assert.equal(memoria.obter('x'), undefined)
})

test('anteciparDados busca cada item no máximo uma vez a cada 10 s', async () => {
  let chamadas = 0
  let relogio = 1000
  const modulo = { dadosDaTela: () => ({ chave: 'y', carregar: async () => ++chamadas }) }
  const paginas = { '/y': paginaCom(modulo) }
  const contexto = { me: 'p1', nav: nav(['/y']) }
  const opcoes = { paginas, agora: () => relogio }
  await anteciparDados('/y', contexto, opcoes)
  relogio += 9999
  await anteciparDados('/y', contexto, opcoes)
  assert.equal(chamadas, 1)
  relogio += 1
  await anteciparDados('/y', contexto, opcoes)
  assert.equal(chamadas, 2)
})

test('anteciparDados engole erro da busca e da página', async () => {
  const falha = Object.assign(new Error('sem acesso'), { status: 403 })
  const modulo = {
    dadosDaTela: () => ({
      chave: 'z',
      carregar: async () => {
        throw falha
      },
    }),
  }
  await assert.doesNotReject(anteciparDados('/z', { me: 'p1', nav: nav(['/z']) }, { paginas: { '/z': paginaCom(modulo) } }))
  await assert.doesNotReject(
    anteciparDados('/w', { me: 'p1', nav: nav(['/w']) }, { paginas: { '/w': { precarregar: () => Promise.reject(new Error('x')) } } }),
  )
})

test('anteciparDados descarta o dado se a pessoa mudou enquanto a tela baixava', async () => {
  let chamadas = 0
  let soltar
  const modulo = { dadosDaTela: ({ me }) => ({ chave: 'perfil:eu', carregar: async () => (chamadas++, { perfilDe: me }) }) }
  const pagina = { precarregar: () => new Promise(r => (soltar = () => r(modulo))) }
  const pendente = anteciparDados('/perfil', { me: 'p1', nav: nav(['/perfil']) }, { paginas: { '/perfil': pagina } })
  // Sair e entrar como outra pessoa antes do arquivo da tela chegar.
  memoria.limpar()
  memoria.definirPessoa(null)
  memoria.definirPessoa('p2')
  soltar()
  await pendente
  assert.equal(chamadas, 0)
  assert.equal(memoria.obter('perfil:eu'), undefined)
})

test('memoria.pessoa devolve o código da pessoa atual', () => {
  assert.equal(memoria.pessoa(), 'p1')
  memoria.definirPessoa('p9')
  assert.equal(memoria.pessoa(), 'p9')
})
