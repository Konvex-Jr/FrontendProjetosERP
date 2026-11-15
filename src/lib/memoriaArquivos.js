import { memoria } from './memoria.js'

// Arquivos (PDF e imagens dos anexos) guardados só na memória da aba, como os dados da
// memoria.js: nada em localStorage, sessionStorage, IndexedDB ou Cache Storage. Recarregar
// ou fechar a aba apaga tudo. Cada arquivo guarda quem o buscou: se a pessoa da aba mudar,
// ele deixa de valer (e o AppContext limpa tudo ao sair e na troca de conta).
// Guarda o Blob, nunca o endereço blob:, para cada janela criar e revogar o seu.

/** Total guardado; ao passar, sai o arquivo usado há mais tempo. */
export const LIMITE_BYTES = 50 * 1024 * 1024
/** Quanto tempo um arquivo guardado vale, contado de quando chegou. */
export const VALIDADE_MS = 10 * 60 * 1000

// Respostas que significam "você não tem mais acesso a isso".
const STATUS_QUE_APAGAM = new Set([401, 403, 404])

// codigo → { blob, pessoa, guardadoEm }. A ordem do Map é a ordem de uso: o primeiro é o
// usado há mais tempo (cada uso tira e põe de volta no fim).
const guardados = new Map()
// codigo → { promessa, pessoa, ouvintes, ultimo }: buscas em andamento, reaproveitadas.
const emAndamento = new Map()
let total = 0

function apagarGuardado(codigo) {
  const item = guardados.get(codigo)
  if (!item) return
  guardados.delete(codigo)
  total -= item.blob.size
}

function guardar(codigo, blob, pessoa) {
  apagarGuardado(codigo)
  if (blob.size > LIMITE_BYTES) return
  guardados.set(codigo, { blob, pessoa, guardadoEm: Date.now() })
  total += blob.size
  for (const [chave] of guardados) {
    if (total <= LIMITE_BYTES) break
    apagarGuardado(chave)
  }
}

export const memoriaArquivos = {
  /** O Blob guardado, ou undefined se não há, venceu (10 min) ou foi guardado por outra pessoa. */
  obter(codigo) {
    const item = guardados.get(codigo)
    if (!item) return undefined
    if (item.pessoa !== memoria.pessoa() || Date.now() - item.guardadoEm > VALIDADE_MS) {
      apagarGuardado(codigo)
      return undefined
    }
    guardados.delete(codigo)
    guardados.set(codigo, item)
    return item.blob
  },

  /**
   * Busca o arquivo com `carregar(aoProgresso)` e guarda. Busca igual em andamento (da mesma
   * pessoa) é reaproveitada, e quem entra recebe o progresso dela pelo `aoProgresso(recebidos, total)`.
   * Só grava se, ao terminar, a pessoa for a mesma e ninguém tiver apagado ou limpado no meio.
   * Erro 401, 403 ou 404 apaga o que estava guardado nessa chave.
   */
  buscar(codigo, carregar, { aoProgresso } = {}) {
    const pessoa = memoria.pessoa()
    const existente = emAndamento.get(codigo)
    if (existente && existente.pessoa === pessoa) {
      if (aoProgresso) {
        existente.ouvintes.add(aoProgresso)
        if (existente.ultimo) aoProgresso(...existente.ultimo)
      }
      return existente.promessa
    }

    const entrada = { pessoa, ouvintes: new Set(aoProgresso ? [aoProgresso] : []), ultimo: null }
    const avisar = (recebidos, totalBytes) => {
      entrada.ultimo = [recebidos, totalBytes]
      for (const fn of entrada.ouvintes) {
        // Ouvinte com defeito (ex.: tela já fechada) não pode quebrar a busca nem os outros.
        try {
          fn(recebidos, totalBytes)
        } catch (erro) {
          console.error('Falha em ouvinte do progresso', erro)
        }
      }
    }
    // Ainda vale gravar o resultado? Não se a busca foi descartada (apagar, limpar ou outra
    // busca no lugar) nem se outra pessoa está na aba agora.
    const valida = () => emAndamento.get(codigo) === entrada && memoria.pessoa() === pessoa
    entrada.promessa = (async () => {
      try {
        const blob = await carregar(avisar)
        if (valida() && pessoa !== null) guardar(codigo, blob, pessoa)
        return blob
      } catch (erro) {
        if (valida() && STATUS_QUE_APAGAM.has(erro?.status)) apagarGuardado(codigo)
        throw erro
      } finally {
        if (emAndamento.get(codigo) === entrada) emAndamento.delete(codigo)
      }
    })()
    emAndamento.set(codigo, entrada)
    return entrada.promessa
  },

  /** Tira o arquivo e descarta a busca em andamento dele (ex.: anexo excluído). */
  apagar(codigo) {
    apagarGuardado(codigo)
    emAndamento.delete(codigo)
  },

  /** Apaga tudo (sair, sessão vencida, troca de conta); buscas em andamento não gravam mais. */
  limpar() {
    guardados.clear()
    emAndamento.clear()
    total = 0
  },

  /** Bytes guardados agora (para conferir o limite). */
  tamanhoTotal() {
    return total
  },
}
