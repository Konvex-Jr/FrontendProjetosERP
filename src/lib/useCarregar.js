import { useCallback, useEffect, useRef, useState } from 'react'
import alerts from './alerts'

/**
 * Carrega dados de uma tela direto da API.
 * Devolve { dados, carregando, recarregar }. Erros aparecem num alerta.
 * `carregar` devolve uma Promise; `deps` funciona como no useEffect (mudou, carrega de novo).
 * `dados` começa null (a tela mostra "Carregando…"); num erro, os dados anteriores ficam.
 * Depois de salvar, use `await recarregar()`.
 * Se `deps` mudar rápido (filtros da Base, das Iniciativas), só a resposta da chamada mais nova
 * vale: uma resposta lenta de um filtro antigo é descartada.
 */
export default function useCarregar(carregar, deps = []) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const ultima = useRef(0)

  const recarregar = useCallback(async () => {
    const minha = ++ultima.current
    setCarregando(true)
    try {
      const resultado = await carregar()
      if (minha === ultima.current) setDados(resultado)
    } catch (error) {
      if (minha === ultima.current) alerts.error('Não foi possível carregar', error.message)
    } finally {
      if (minha === ultima.current) setCarregando(false)
    }
    // As dependências vêm de quem chama (como no useEffect); o lint não consegue conferir uma lista dinâmica.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps)

  useEffect(() => {
    recarregar()
  }, [recarregar])
  return { dados, carregando, recarregar }
}
