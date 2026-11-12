import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Ic from './Icon'

/**
 * Menu de ações de uma linha ou cartão. `items` = [[ícone, rótulo, função, perigo?]];
 * com perigo (1) o botão fica vermelho. Os itens mostram só o ícone; o rótulo vai no tooltip e no aria-label.
 * Monte a lista conforme as permissões que a API devolveu (só entra o que a pessoa pode fazer).
 */
export default function ActionMenu({ items }) {
  const [pos, setPos] = useState(null),
    b = useRef(null),
    close = () => setPos(null)
  useEffect(() => {
    if (!pos) return
    const k = e => e.key == 'Escape' && close()
    addEventListener('keydown', k)
    addEventListener('scroll', close, true)
    addEventListener('resize', close)
    return () => {
      removeEventListener('keydown', k)
      removeEventListener('scroll', close, true)
      removeEventListener('resize', close)
    }
  }, [pos])
  const open = e => {
    e.stopPropagation()
    if (pos) return close()
    const r = b.current.getBoundingClientRect(),
      // Perto do fim da tela, abre para cima.
      up = r.bottom + 70 > innerHeight
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
              className={'pop' + (pos.up ? ' up' : '')}
              role="menu"
              style={pos.up ? { right: pos.r, bottom: pos.y } : { right: pos.r, top: pos.y }}
            >
              {items.map(([k, l, fn, dg], i) => (
                <button
                  key={l}
                  role="menuitem"
                  className={'ib' + (dg ? ' x' : '')}
                  data-tip={l}
                  aria-label={l}
                  style={{ '--d': i * 45 + 'ms' }}
                  onClick={e => {
                    e.stopPropagation()
                    close()
                    fn()
                  }}
                >
                  <Ic k={k} />
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
