import { useCallback, useEffect, useState } from 'react'
import alerts from './alerts'

/**
 * Carrega dados de uma tela direto da API.
 * Devolve { dados, carregando, recarregar }. Erros aparecem num alerta.
 * `carregar` devolve uma Promise; `deps` funciona como no useEffect (mudou, carrega de novo).
 * `dados` começa null (a tela mostra "Carregando…"); num erro, os dados anteriores ficam.
 * Depois de salvar, use `await recarregar()`.
 * Atenção: a chamada anterior não é cancelada; se `deps` mudar rápido, vale a resposta que chegar por último.
 */
export default function useCarregar(carregar, deps = []) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    try {
      setDados(await carregar())
    } catch (error) {
      alerts.error('Não foi possível carregar', error.message)
    } finally {
      setCarregando(false)
    }
    // As dependências vêm de quem chama (como no useEffect); o lint não consegue conferir uma lista dinâmica.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps)

  useEffect(() => {
    recarregar()
  }, [recarregar])
  return { dados, carregando, recarregar }
}
