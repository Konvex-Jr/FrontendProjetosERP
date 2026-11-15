import { memoria } from './memoria.js'
import { memoriaArquivos } from './memoriaArquivos.js'

// Memórias da aba (dados da memoria.js e arquivos dos anexos da memoriaArquivos.js) mudam de dona
// juntas. Quem troca a pessoa ou encerra a sessão chama daqui, nunca uma das duas sozinha.

/** Troca a dona das memórias. Outra pessoa apaga na hora os dados e os arquivos guardados. */
export function definirPessoa(codigo) {
  if (memoria.pessoa() !== codigo) memoriaArquivos.limpar()
  memoria.definirPessoa(codigo)
}

/** Fim de sessão (sair, sessão vencida, login que falhou): nada de uma pessoa fica para a próxima. */
export function apagarMemorias() {
  memoria.limpar()
  memoriaArquivos.limpar()
  memoria.definirPessoa(null)
}
