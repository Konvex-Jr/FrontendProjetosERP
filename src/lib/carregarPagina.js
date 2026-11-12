import { lazy } from 'react'

const FLAG = 'recarregouVersao'

const ler = () => {
  try {
    return sessionStorage.getItem(FLAG)
  } catch {
    return null
  }
}
const gravar = valor => {
  try {
    valor ? sessionStorage.setItem(FLAG, valor) : sessionStorage.removeItem(FLAG)
  } catch {
    /* sem sessionStorage */
  }
}

/**
 * lazy() que sobrevive a uma publicação nova: se o chunk da página sumiu do servidor
 * (o hash mudou depois que a aba foi aberta), recarrega a página uma vez para pegar
 * o index.html novo. A flag na sessionStorage evita recarregar em loop.
 */
export default function carregarPagina(importar) {
  return lazy(() =>
    importar().then(
      modulo => {
        // Deu certo: libera um novo recarregamento automático na próxima publicação.
        gravar(null)
        return modulo
      },
      erro => {
        // Já recarregou uma vez e continua falhando: é erro de verdade (ex.: sem internet); deixa aparecer.
        if (ler()) throw erro
        gravar('1')
        window.location.reload()
        // Promessa que nunca termina: a página vai recarregar, e o Suspense segue mostrando o carregamento.
        return new Promise(() => {})
      },
    ),
  )
}
