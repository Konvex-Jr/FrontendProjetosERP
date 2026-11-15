import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { memoria } from '../src/lib/memoria.js'
import { memoriaArquivos } from '../src/lib/memoriaArquivos.js'
import {
  ACEITA,
  LIMITE_BYTES,
  acaoAoAbrir,
  adaptAnexo,
  anexos,
  criarAntecipador,
  ESPERA_ANTECIPAR_MS,
  conferirArquivo,
  enviarVarios,
  extensao,
  avisoEnviados,
  podeVer,
  progressoVisivel,
  resumoFalhas,
  tamanhoLegivel,
  textoProgresso,
} from '../src/services/anexos.js'

beforeEach(() => {
  memoria.definirPessoa(null)
  memoria.definirPessoa('ana')
  memoriaArquivos.limpar()
})

const arquivo = (name, size, type = 'application/pdf') => {
  const blob = new Blob([new Uint8Array(size)], { type })
  return Object.assign(blob, { name })
}

test('confere tipo, vazio e limite de 20 MB antes de enviar', () => {
  assert.equal(conferirArquivo(arquivo('relatório.PDF', 10)), '')
  assert.equal(conferirArquivo(arquivo('foto.jpeg', 10)), '')
  assert.match(conferirArquivo(arquivo('pagina.html', 10)), /não aceito/)
  assert.match(conferirArquivo(arquivo('semextensao', 10)), /não aceito/)
  assert.equal(conferirArquivo(arquivo('a.pdf', 0)), 'O arquivo está vazio.')
  assert.equal(conferirArquivo({ name: 'a.pdf', size: LIMITE_BYTES + 1 }), 'O arquivo passa de 20 MB, o tamanho máximo.')
  assert.equal(conferirArquivo({ name: 'a.pdf', size: LIMITE_BYTES }), '')
  assert.equal(conferirArquivo(null), 'Escolha um arquivo.')
  assert.equal(extensao('a.tar.GZ'), 'gz')
  assert.ok(ACEITA.includes('.docx') && ACEITA.includes('.png'))
})

test('mostra o tamanho de forma legível', () => {
  assert.equal(tamanhoLegivel(500), '500 B')
  assert.equal(tamanhoLegivel(2048), '2 KB')
  assert.equal(tamanhoLegivel(1.25 * 1024 * 1024), '1,3 MB')
})

test('adapta anexo da Biblioteca', () => {
  const bruto = {
    codigo: 'a1',
    nome: 'Ata.pdf',
    tamanhoBytes: 2048,
    enviadoPor: { codigo: 'u', nome: 'Ana' },
    enviadoEm: '2026-11-09T15:00:00.000Z',
  }
  assert.deepEqual(adaptAnexo(bruto), {
    id: 'a1',
    nome: 'Ata.pdf',
    ext: 'pdf',
    tamanho: '2 KB',
    bytes: 2048,
    enviadoPor: 'Ana',
    data: '2026-11-09',
    podeExcluir: undefined,
  })
  assert.equal(adaptAnexo({ ...bruto, podeExcluir: true }).podeExcluir, true)
})

test('envia os bytes com o nome no cabeçalho e baixa pela API com a sessão', async () => {
  const original = globalThis.fetch
  const chamadas = []
  globalThis.fetch = async (url, init) => {
    chamadas.push({ url: String(url), init })
    return { ok: true, status: 200, text: async () => '{"codigo":"a1"}' }
  }
  try {
    const f = arquivo('Relatório final.pdf', 3)
    await anexos.enviar('biblioteca', 'b1', f)
    await anexos.excluir('a1')
  } finally {
    globalThis.fetch = original
  }
  assert.match(chamadas[0].url, /\/biblioteca\/b1\/anexos$/)
  assert.equal(chamadas[0].init.method, 'POST')
  assert.equal(chamadas[0].init.headers['X-Nome-Arquivo'], 'Relat%C3%B3rio%20final.pdf')
  assert.equal(chamadas[0].init.headers['Content-Type'], 'application/octet-stream')
  assert.ok(chamadas[0].init.body instanceof Blob)
  assert.match(chamadas[1].url, /\/anexos\/a1$/)
  assert.equal(chamadas[1].init.method, 'DELETE')
})

test('enviarVarios confere antes, envia um por vez e não para no primeiro erro', async () => {
  const chamados = []
  const enviar = async (dono, codigo, f) => {
    chamados.push([dono, codigo, f.name])
    if (f.name === 'd.pdf') throw new Error('Falhou')
  }
  const lista = [arquivo('a.pdf', 5), arquivo('b.exe', 5), { name: 'c.pdf', size: LIMITE_BYTES + 1 }, arquivo('d.pdf', 5)]
  const r = await enviarVarios('tarefas', 't1', lista, enviar)
  assert.deepEqual(chamados, [
    ['tarefas', 't1', 'a.pdf'],
    ['tarefas', 't1', 'd.pdf'],
  ])
  assert.equal(r.enviados, 1)
  assert.deepEqual(
    r.falhas.map(f => f.nome),
    ['b.exe', 'c.pdf', 'd.pdf'],
  )
  assert.match(r.falhas[0].erro, /não aceito/)
  assert.match(r.falhas[1].erro, /20 MB/)
  assert.equal(r.falhas[2].erro, 'Falhou')
  assert.deepEqual(await enviarVarios('tarefas', 't1', undefined, enviar), { enviados: 0, falhas: [] })
})

test('podeVer só para PDF e imagens raster', () => {
  assert.equal(podeVer('Relatório 50%.PDF'), true)
  assert.equal(podeVer('foto.jpeg'), true)
  assert.equal(podeVer('a.svg'), false)
  assert.equal(podeVer('a.docx'), false)
  assert.equal(podeVer('semextensao'), false)
})

test('acaoAoAbrir: PDF no celular baixa; imagem abre em janela; resto baixa', () => {
  assert.equal(acaoAoAbrir('a.pdf', false), 'janela')
  assert.equal(acaoAoAbrir('a.pdf', true), 'baixar')
  assert.equal(acaoAoAbrir('a.PNG', true), 'janela')
  assert.equal(acaoAoAbrir('a.docx', false), 'baixar')
  assert.equal(acaoAoAbrir('a.docx', true), 'baixar')
})

test('abrir usa o tipo da extensão, nunca o da resposta, e recusa o que não se vê', async () => {
  const original = globalThis.fetch
  const criar = URL.createObjectURL
  let blobCriado
  URL.createObjectURL = b => ((blobCriado = b), 'blob:x')
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/html' }),
    blob: async () => new Blob(['<script>'], { type: 'text/html' }),
  })
  try {
    const r = await anexos.abrir({ id: 'a1', nome: 'x.pdf' })
    assert.deepEqual(r, { url: 'blob:x', tipo: 'application/pdf' })
    assert.equal(blobCriado.type, 'application/pdf')
    await assert.rejects(() => anexos.abrir({ id: 'a2', nome: 'x.svg' }))
  } finally {
    globalThis.fetch = original
    URL.createObjectURL = criar
  }
})

test('enviarVarios avisa o progresso antes de cada arquivo, inclusive os recusados na conferência', async () => {
  const passos = []
  const lista = [arquivo('a.pdf', 5), arquivo('b.exe', 5), arquivo('c.png', 5)]
  await enviarVarios(
    'biblioteca',
    'b1',
    lista,
    async () => {},
    (atual, total) => passos.push([atual, total]),
  )
  assert.deepEqual(passos, [
    [1, 3],
    [2, 3],
    [3, 3],
  ])
})

test('textoProgresso mostra a posição só quando há mais de um arquivo', () => {
  assert.equal(textoProgresso({ atual: 2, total: 5 }), 'Enviando 2 de 5…')
  assert.equal(textoProgresso({ atual: 1, total: 1 }), 'Enviando…')
  assert.equal(textoProgresso(null), '')
})

test('avisoEnviados concorda com a quantidade', () => {
  assert.equal(avisoEnviados(1), '1 arquivo enviado')
  assert.equal(avisoEnviados(3), '3 arquivos enviados')
})

test('resumoFalhas lista um arquivo por linha com o motivo', () => {
  assert.equal(
    resumoFalhas([
      { nome: 'a.exe', erro: 'Tipo não aceito.' },
      { nome: 'b.pdf', erro: 'Falhou' },
    ]),
    'a.exe: Tipo não aceito.\nb.pdf: Falhou',
  )
})

const MB = 1024 * 1024

// fetch falso que conta as chamadas por caminho e devolve bytes do tamanho pedido.
function fetchContando(bytes = 4) {
  const chamadas = []
  const original = globalThis.fetch
  globalThis.fetch = async url => {
    chamadas.push(String(url).replace(/^.*?(\/anexos\/)/, '$1'))
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': String(bytes) }),
      blob: async () => new Blob([new Uint8Array(bytes)]),
    }
  }
  return { chamadas, restaurar: () => (globalThis.fetch = original) }
}

test('antecipar busca PDF e imagem de até 5 MB, uma vez só', async () => {
  const f = fetchContando()
  try {
    await Promise.all([
      anexos.antecipar({ id: 'a1', nome: 'x.pdf', bytes: 5 * MB }),
      anexos.antecipar({ id: 'a1', nome: 'x.pdf', bytes: 5 * MB }),
    ])
    await anexos.antecipar({ id: 'a1', nome: 'x.pdf', bytes: 5 * MB })
    await anexos.antecipar({ id: 'a2', nome: 'foto.PNG', bytes: 10 })
  } finally {
    f.restaurar()
  }
  assert.deepEqual(f.chamadas, ['/anexos/a1', '/anexos/a2'])
  assert.ok(memoriaArquivos.obter('a1'))
})

test('antecipar não busca PDF de 6 MB, .docx nem anexo sem tamanho', async () => {
  const f = fetchContando()
  try {
    await anexos.antecipar({ id: 'a1', nome: 'x.pdf', bytes: 6 * MB })
    await anexos.antecipar({ id: 'a2', nome: 'x.docx', bytes: 10 })
    await anexos.antecipar({ id: 'a3', nome: 'x.pdf' })
  } finally {
    f.restaurar()
  }
  assert.deepEqual(f.chamadas, [])
})

test('antecipar ignora erro em silêncio', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 404, text: async () => '' })
  try {
    await assert.doesNotReject(anexos.antecipar({ id: 'a1', nome: 'x.pdf', bytes: 10 }))
  } finally {
    globalThis.fetch = original
  }
})

test('abrir e baixar usam o arquivo guardado, sem buscar de novo', async () => {
  const f = fetchContando()
  const criar = URL.createObjectURL
  const revogar = URL.revokeObjectURL
  URL.createObjectURL = () => 'blob:x'
  URL.revokeObjectURL = () => {}
  const doc = globalThis.document
  globalThis.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } }
  // A revogação do endereço do download espera 30 s: relógio falso para o teste não esperar.
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    await anexos.antecipar({ id: 'a1', nome: 'x.pdf', bytes: 4 })
    await anexos.abrir({ id: 'a1', nome: 'x.pdf' })
    await anexos.baixar({ id: 'a1', nome: 'x.pdf' })
  } finally {
    f.restaurar()
    URL.createObjectURL = criar
    URL.revokeObjectURL = revogar
    globalThis.document = doc
    mock.timers.reset()
  }
  assert.deepEqual(f.chamadas, ['/anexos/a1'])
})

test('abrir repassa o progresso, inclusive entrando numa antecipação em andamento', async () => {
  const original = globalThis.fetch
  let liberar
  const corpo = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(2))
    },
    pull(c) {
      return new Promise(r => (liberar = r)).then(() => {
        c.enqueue(new Uint8Array(2))
        c.close()
      })
    },
  })
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: new Headers({ 'content-length': '4' }), body: corpo })
  const criar = URL.createObjectURL
  URL.createObjectURL = () => 'blob:x'
  const vistos = []
  try {
    const antecipada = anexos.antecipar({ id: 'a1', nome: 'x.pdf', bytes: 4 })
    await new Promise(r => setTimeout(r, 0))
    const aberta = anexos.abrir({ id: 'a1', nome: 'x.pdf' }, { aoProgresso: (r, t) => vistos.push([r, t]) })
    liberar()
    await Promise.all([antecipada, aberta])
  } finally {
    globalThis.fetch = original
    URL.createObjectURL = criar
  }
  assert.deepEqual(vistos.at(-1), [4, 4])
  assert.ok(vistos.length >= 2)
})

test('excluir tira o arquivo da memória', async () => {
  await memoriaArquivos.buscar('a1', async () => new Blob(['x']))
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, status: 204, text: async () => '' })
  try {
    await anexos.excluir('a1')
  } finally {
    globalThis.fetch = original
  }
  assert.equal(memoriaArquivos.obter('a1'), undefined)
})

test('progresso só aparece acima de 1 MB e vira "Baixando…" sem o tamanho total', () => {
  assert.equal(progressoVisivel(null, 5 * MB), null)
  assert.equal(progressoVisivel({ recebidos: 10, total: MB }, MB), null)
  assert.deepEqual(progressoVisivel({ recebidos: MB, total: 2 * MB }, 2 * MB), { pct: 50, texto: 'Baixando… 50%' })
  assert.deepEqual(progressoVisivel({ recebidos: 3 * MB, total: 2 * MB }, 2 * MB), { pct: 100, texto: 'Baixando… 100%' })
  assert.deepEqual(progressoVisivel({ recebidos: 10, total: null }, 3 * MB), { pct: null, texto: 'Baixando…' })
  assert.deepEqual(progressoVisivel({ recebidos: 10, total: null }, undefined), { pct: null, texto: 'Baixando…' })
  // Tamanho desconhecido dos dois lados (0 ou ausente): "Baixando…", não esconde.
  assert.deepEqual(progressoVisivel({ recebidos: 10, total: null }, 0), { pct: null, texto: 'Baixando…' })
  assert.deepEqual(progressoVisivel({ recebidos: 10, total: 0 }, 0), { pct: null, texto: 'Baixando…' })
  assert.equal(progressoVisivel({ recebidos: 10, total: null }, 500), null)
})

test('antecipa no máximo 2 arquivos por vez; o terceiro é ignorado, não espera na fila', async () => {
  const original = globalThis.fetch
  const pendentes = []
  const chamadas = []
  globalThis.fetch = url => {
    chamadas.push(String(url).replace(/^.*\/anexos\//, ''))
    return new Promise(r => pendentes.push(() => r({ ok: true, status: 200, headers: new Headers(), blob: async () => new Blob(['x']) })))
  }
  try {
    const a = anexos.antecipar({ id: 'a1', nome: 'a.pdf', bytes: 10 })
    const b = anexos.antecipar({ id: 'a2', nome: 'b.pdf', bytes: 10 })
    await anexos.antecipar({ id: 'a3', nome: 'c.pdf', bytes: 10 })
    await new Promise(r => setTimeout(r, 0))
    assert.deepEqual(chamadas, ['a1', 'a2'])
    pendentes.forEach(f => f())
    await Promise.all([a, b])
    // Com as duas terminadas, outra pode começar.
    const c = anexos.antecipar({ id: 'a3', nome: 'c.pdf', bytes: 10 })
    await new Promise(r => setTimeout(r, 0))
    pendentes.at(-1)()
    await c
    assert.deepEqual(chamadas, ['a1', 'a2', 'a3'])
  } finally {
    globalThis.fetch = original
  }
})

test('antecipador: mouse e foco esperam 120 ms e cancelam ao sair; toque começa na hora', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const antecipados = []
  const ant = criarAntecipador(a => antecipados.push(a.id))
  try {
    assert.equal(ESPERA_ANTECIPAR_MS, 120)
    ant.agendar({ id: 'a1' })
    mock.timers.tick(ESPERA_ANTECIPAR_MS - 1)
    assert.deepEqual(antecipados, [])
    mock.timers.tick(1)
    assert.deepEqual(antecipados, ['a1'])

    // Passou o mouse de relance: sai antes dos 120 ms e nada é buscado.
    ant.agendar({ id: 'a2' })
    mock.timers.tick(60)
    ant.cancelar({ id: 'a2' })
    mock.timers.tick(200)
    assert.deepEqual(antecipados, ['a1'])

    ant.agora({ id: 'a3' })
    assert.deepEqual(antecipados, ['a1', 'a3'])

    // Ao desmontar a lista, nada agendado dispara depois.
    ant.agendar({ id: 'a4' })
    ant.cancelarTodos()
    mock.timers.tick(200)
    assert.deepEqual(antecipados, ['a1', 'a3'])
  } finally {
    mock.timers.reset()
  }
})

// fetch falso que só responde quando o teste manda: `soltar()` entrega 4 bytes, `falhar()` dá 500.
function fetchAdiado() {
  const original = globalThis.fetch
  const controle = {}
  globalThis.fetch = () =>
    new Promise(r => {
      controle.soltar = () =>
        r({ ok: true, status: 200, headers: new Headers({ 'content-length': '4' }), blob: async () => new Blob(['abcd']) })
      controle.falhar = () => r({ ok: false, status: 500, text: async () => '' })
    })
  controle.restaurar = () => (globalThis.fetch = original)
  return controle
}

// Sai A, entra B (o que o AppContext faz pelo memoriasDaAba).
const trocarParaBia = () => {
  memoria.definirPessoa(null)
  memoria.definirPessoa('bia')
}

test('baixar de A que termina depois da troca de pessoa não entrega o arquivo na sessão de B', async () => {
  const f = fetchAdiado()
  const criar = URL.createObjectURL
  URL.createObjectURL = () => 'blob:x'
  const doc = globalThis.document
  let cliques = 0
  globalThis.document = { createElement: () => ({ click: () => cliques++, remove() {} }), body: { appendChild() {} } }
  const progresso = []
  try {
    const baixando = anexos.baixar({ id: 'a9', nome: 'grande.docx' }, { aoProgresso: (r, t) => progresso.push([r, t]) })
    await new Promise(r => setTimeout(r, 0))
    trocarParaBia()
    f.soltar()
    await baixando
  } finally {
    f.restaurar()
    URL.createObjectURL = criar
    globalThis.document = doc
  }
  assert.equal(cliques, 0)
  assert.deepEqual(progresso, [])
})

test('baixar e abrir de A que falham depois da troca de pessoa não mostram erro a B', async () => {
  const f = fetchAdiado()
  try {
    const baixando = anexos.baixar({ id: 'a9', nome: 'grande.docx' })
    await new Promise(r => setTimeout(r, 0))
    trocarParaBia()
    f.falhar()
    await assert.doesNotReject(baixando)
    memoria.definirPessoa('ana')
    const abrindo = anexos.abrir({ id: 'a8', nome: 'x.pdf' })
    await new Promise(r => setTimeout(r, 0))
    trocarParaBia()
    f.falhar()
    assert.equal(await abrindo, null)
  } finally {
    f.restaurar()
  }
})

test('abrir de A que termina depois da troca de pessoa devolve null, sem endereço nem progresso', async () => {
  const f = fetchAdiado()
  const criar = URL.createObjectURL
  let criados = 0
  URL.createObjectURL = () => (criados++, 'blob:x')
  const progresso = []
  try {
    const abrindo = anexos.abrir({ id: 'a8', nome: 'x.pdf' }, { aoProgresso: (r, t) => progresso.push([r, t]) })
    await new Promise(r => setTimeout(r, 0))
    trocarParaBia()
    f.soltar()
    assert.equal(await abrindo, null)
  } finally {
    f.restaurar()
    URL.createObjectURL = criar
  }
  assert.equal(criados, 0)
  assert.deepEqual(progresso, [])
})

test('baixar de quem continua logado entrega o arquivo e o erro como antes', async () => {
  const f = fetchAdiado()
  try {
    const baixando = anexos.baixar({ id: 'a9', nome: 'grande.docx' })
    await new Promise(r => setTimeout(r, 0))
    f.falhar()
    await assert.rejects(baixando)
  } finally {
    f.restaurar()
  }
})
