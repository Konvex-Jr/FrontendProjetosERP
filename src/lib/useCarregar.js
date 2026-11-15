import { useCallback, useEffect, useRef, useState } from 'react'
import alerts from './alerts'
import { memoria } from './memoria'

/**
 * Carrega dados de uma tela direto da API.
 * Devolve { dados, carregando, recarregar }. Erros aparecem num alerta.
 * `carregar` devolve uma Promise; `deps` funciona como no useEffect (mudou, carrega de novo).
 * `dados` começa null (a tela mostra "Carregando…"); num erro, os dados anteriores ficam.
 * Depois de salvar, use `await recarregar()`.
 * Com `{ chave }` (3º parâmetro), o dado passa pela memória de dados (src/lib/memoria.js):
 * a tela abre na hora com o último dado visto dessa chave (`carregando` só é true sem dado
 * guardado) e atualiza em seguida. Se a chave for apagada (403/404, logout), `dados` volta a
 * null. `recarregar()` sempre busca de novo e grava. Sem `chave`, nada disso se aplica.
 * Se `deps` mudar rápido (filtros da Biblioteca), só a resposta da chamada mais nova
 * vale: uma resposta lenta de um filtro antigo é descartada.
 */
export default function useCarregar(carregar, deps = [], { chave } = {}) {
  const guardado = chave ? memoria.obter(chave) : undefined
  const [dados, setDados] = useState(guardado ?? null)
  const [carregando, setCarregando] = useState(guardado === undefined)
  const [chaveDoEstado, setChaveDoEstado] = useState(chave)
  const ultima = useRef(0)

  // Chave nova (ex.: outro item): o estado parte do que a chave nova já tem, sem um
  // quadro com o dado da chave antiga.
  if (chave !== chaveDoEstado) {
    setChaveDoEstado(chave)
    setDados(guardado ?? null)
    setCarregando(guardado === undefined)
  }

  const buscar = useCallback(
    async forcar => {
      const minha = ++ultima.current
      // Com dado guardado a tela já está pronta: a atualização acontece sem "Carregando…".
      setCarregando(chave ? memoria.obter(chave) === undefined : true)
      try {
        const resultado = chave ? await memoria.buscar(chave, carregar, { forcar }) : await carregar()
        if (minha === ultima.current) setDados(resultado)
      } catch (error) {
        // 401 já é tratado pelo fluxo de sessão; um alerta a mais só atrapalha.
        if (minha === ultima.current && !(chave && error.status === 401)) {
          alerts.error('Não foi possível carregar', error.message)
        }
      } finally {
        if (minha === ultima.current) setCarregando(false)
      }
    },
    // As dependências vêm de quem chama (como no useEffect); o lint não consegue conferir uma lista dinâmica.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
    [...deps, chave],
  )

  // A memória avisa quando a chave é gravada por outra tela ou apagada (valor undefined).
  useEffect(() => {
    if (!chave) return undefined
    return memoria.ouvir(chave, valor => setDados(valor ?? null))
  }, [chave])

  useEffect(() => {
    buscar(false)
  }, [buscar])

  const recarregar = useCallback(() => buscar(true), [buscar])
  return { dados, carregando, recarregar }
}
