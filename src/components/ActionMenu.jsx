import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Ic from './Icon'

/**
 * Menu de ações de uma linha ou cartão. `items` = [[ícone, rótulo, função, perigo?]];
 * com perigo (1) o botão fica vermelho. O ⋯ gira e abre um painel que vira, com ícone e nome de cada ação.
 * Monte a lista conforme as permissões que a API devolveu (só entra o que a pessoa pode fazer).
 */
export default function ActionMenu({ items }) {
  const [pos, setPos] = useState(null),
    b = useRef(null),
    painel = useRef(null),
    // Fechar devolve o foco ao ⋯ (teclado não perde o lugar na lista).
    close = (voltarFoco = true) => {
      setPos(null)
      if (voltarFoco) b.current?.focus({ preventScroll: true })
    }
  useEffect(() => {
    if (!pos) return
    // Teclado: o foco vai para a primeira ação ao abrir.
    painel.current?.querySelector('button')?.focus({ preventScroll: true })
    // Esc fecha; setas e Home/End andam entre as ações; Tab sai e fecha.
    const k = e => {
      const itens = [...(painel.current?.querySelectorAll('button') || [])],
        i = itens.indexOf(document.activeElement)
      if (e.key == 'Escape') close()
      else if (e.key == 'Tab') close(false)
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && itens.length) {
        e.preventDefault()
        const n = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: itens.length - 1 }[e.key]
        itens[(n + itens.length) % itens.length].focus()
      }
    }
    addEventListener('keydown', k)
    const fecharSemFoco = () => close(false)
    addEventListener('scroll', fecharSemFoco, true)
    addEventListener('resize', fecharSemFoco)
    return () => {
      removeEventListener('keydown', k)
      removeEventListener('scroll', fecharSemFoco, true)
      removeEventListener('resize', fecharSemFoco)
    }
  }, [pos])
  const open = e => {
    e.stopPropagation()
    if (pos) return close()
    const r = b.current.getBoundingClientRect(),
      // Perto do fim da tela, abre para cima.
      up = r.bottom + 46 * items.length + 20 > innerHeight
    setPos({ r: innerWidth - r.right, y: up ? innerHeight - r.top + 6 : r.bottom + 6, up })
  }
  return (
    <>
      <button ref={b} className="dots" aria-label="Ações" aria-haspopup="menu" aria-expanded={!!pos} onClick={open}>
        <Ic k="menu" />
      </button>
      {/* Portal no body: dentro da tabela o menu seria cortado pelo overflow. */}
      {/* A posição é fixa (calculada a partir do botão), por isso o menu fecha ao rolar ou redimensionar. */}
      {pos &&
        createPortal(
          <>
            <div
              className="scrim"
              onClick={e => {
                e.stopPropagation()
                close()
              }}
            />
            <div
              ref={painel}
              className={'pop' + (pos.up ? ' up' : '')}
              role="menu"
              style={pos.up ? { right: pos.r, bottom: pos.y } : { right: pos.r, top: pos.y }}
            >
              {items.map(([k, l, fn, dg], i) => (
                <button
                  key={l}
                  role="menuitem"
                  className={'ib' + (dg ? ' x' : '')}
                  style={{ '--d': i * 45 + 'ms' }}
                  onClick={e => {
                    e.stopPropagation()
                    close()
                    fn()
                  }}
                >
                  <Ic k={k} />
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
