// Memória de dados por pessoa, só na aba (nada em localStorage/sessionStorage):
// recarregar a página ou fechar a aba apaga tudo, o que mantém o dado de uma
// pessoa longe de outra. Serve para mostrar a tela de imediato com o último
// dado conhecido enquanto a atualização acontece.

// Respostas que significam "você não tem mais acesso a isso": o dado guardado
// não pode continuar aparecendo.
const STATUS_QUE_APAGAM = new Set([401, 403, 404])

const dados = new Map()
const emAndamento = new Map()
const ouvintes = new Map()
let pessoaAtual = null
// Muda a cada troca de pessoa ou limpeza: uma resposta que começou numa
// geração anterior pertence a outra sessão e é descartada.
let geracao = 0

function avisar(chave, valor) {
  for (const fn of [...(ouvintes.get(chave) ?? [])]) fn(valor)
}

function apagarTudo() {
  geracao += 1
  emAndamento.clear()
  const chaves = [...dados.keys()]
  dados.clear()
  for (const chave of chaves) avisar(chave, undefined)
}

function apagarChave(chave) {
  if (!dados.delete(chave)) return
  avisar(chave, undefined)
}

export const memoria = {
  definirPessoa(codigo) {
    if (codigo === pessoaAtual) return
    pessoaAtual = codigo
    apagarTudo()
  },

  obter(chave) {
    return dados.get(chave)
  },

  buscar(chave, carregar) {
    const existente = emAndamento.get(chave)
    if (existente) return existente

    const minhaGeracao = geracao
    const promessa = (async () => {
      try {
        const valor = await carregar()
        if (minhaGeracao === geracao) {
          dados.set(chave, valor)
          avisar(chave, valor)
        }
        return valor
      } catch (erro) {
        if (minhaGeracao === geracao && STATUS_QUE_APAGAM.has(erro?.status)) apagarChave(chave)
        throw erro
      } finally {
        if (emAndamento.get(chave) === promessa) emAndamento.delete(chave)
      }
    })()
    emAndamento.set(chave, promessa)
    return promessa
  },

  limpar() {
    apagarTudo()
  },

  ouvir(chave, fn) {
    if (!ouvintes.has(chave)) ouvintes.set(chave, new Set())
    ouvintes.get(chave).add(fn)
    return () => {
      ouvintes.get(chave)?.delete(fn)
    }
  },
}
