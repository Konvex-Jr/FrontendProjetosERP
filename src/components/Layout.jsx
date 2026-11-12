import { Suspense, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { fm, ini, un, chip } from '../lib/utils'
import Ic from './Icon'
import FormModal from './FormModal'

function Header() {
  const { D, me, sair } = useApp(), navigate = useNavigate()
  const [dk, setDk] = useState(document.documentElement.dataset.theme == 'dark')
  const tema = () => {
    const n = !dk, r = document.documentElement
    r.classList.add('tt'); r.dataset.theme = n ? 'dark' : 'light'; r.dataset.bsTheme = n ? 'dark' : 'light'
    try { localStorage.setItem('tema', n ? 'dark' : 'light') } catch (e) { /* sem storage: o tema só não fica salvo */ }
    setDk(n); setTimeout(() => r.classList.remove('tt'), 600)
  }
  return (
    <header className="hd">
      <div className="hdi">
        <img className="hl" src={import.meta.env.BASE_URL + 'assets/logo-branca.webp'} width={192} height={28} alt="Konvex Jr – ir para o Dashboard" onClick={() => navigate('/')} />
        <div className="hr">
          <span className={chip('hdt')}>Hoje · {fm(D.c.hoje)}</span>
          <button className="tg" aria-label={dk ? 'Ativar modo claro' : 'Ativar modo escuro'} title={dk ? 'Modo claro' : 'Modo escuro'} onClick={tema}>
            <span className="sun"><Ic k="sun" /></span><span className="moon"><Ic k="moon" /></span>
          </button>
          <span className="hu"><b>{un(D, me)}</b><small>{D.u.find(u => u.id == me)?.perfil}</small></span>
          <span className="av" role="button" title="Meu perfil" onClick={() => navigate('/perfil')}>{ini(un(D, me))}</span>
          <button className="btn btn-g btn-sm hs-sair" onClick={sair} aria-label="Sair"><Ic k="logout" /><span>Sair</span></button>
        </div>
      </div>
    </header>
  )
}

// No celular (até 991 px) a barra inferior mostra só os primeiros itens; o resto fica na gaveta "Mais".
const ITENS_BARRA = 4

function SideNav() {
  const { nav, go } = useApp(), { pathname } = useLocation()
  const [gaveta, setGaveta] = useState(false)
  const ativo = nav.findIndex(([, , p]) => p === '/' ? pathname === '/' : pathname.startsWith(p))
  const comMais = nav.length > ITENS_BARRA + 1
  const ir = k => { setGaveta(false); go(k) }
  return (
    <>
      <nav id="menu" aria-label="Menu principal" className={comMais ? 'cm-mais' : ''} style={{ '--i': Math.max(0, ativo) }}>
        <i className="pill" />
        <img className="ml" src={import.meta.env.BASE_URL + 'assets/logo-branca.webp'} width={192} height={28} alt="Konvex Jr – ir para a Visão Geral" onClick={() => ir(nav[0]?.[0])} />
        {nav.map(([k, l], i) => (
          <a key={k} role="button" tabIndex={0} className={(i === ativo ? 'on' : '') + (comMais && i >= ITENS_BARRA ? ' ex' : '')} aria-current={i === ativo ? 'page' : undefined} aria-label={l} data-l={l} onClick={() => ir(k)} onKeyDown={e => e.key == 'Enter' && ir(k)}>
            <Ic k={k} /><span className="nl">{l}</span>
          </a>
        ))}
        {comMais && (
          <button type="button" className={'mais' + (ativo >= ITENS_BARRA ? ' on' : '')} aria-label="Mais opções do menu" aria-expanded={gaveta} onClick={() => setGaveta(true)}>
            <Ic k="menu" />
          </button>
        )}
      </nav>
      {gaveta && (
        <>
          <div className="gv-fundo" onClick={() => setGaveta(false)} />
          <div className="gv" role="dialog" aria-label="Menu">
            <div className="gv-t"><b>Menu</b><button type="button" className="btn btn-g btn-sm" aria-label="Fechar menu" onClick={() => setGaveta(false)}><Ic k="x" /></button></div>
            {nav.map(([k, l], i) => (
              <button type="button" key={k} className={'gv-i' + (i === ativo ? ' on' : '')} aria-current={i === ativo ? 'page' : undefined} onClick={() => ir(k)}>
                <Ic k={k} /><span>{l}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default function Layout() {
  const { me, nav, md, setMd } = useApp(), { pathname } = useLocation()
  if (!me) return <Navigate to="/login" replace />
  const secao = pathname.split('/')[1]
  // Só abre telas que vieram no menu da pessoa (GET /auth/permissoes).
  if (secao && !nav.some(([, , caminho]) => caminho === '/' + secao)) return <Navigate to="/" replace />
  return (
    <>
      <Header />
      <SideNav />
      <main className="app-main">
        <Suspense fallback={<div className="pagina-carregando" aria-busy="true" />}>
          <div key={pathname} className="page-in"><Outlet /></div>
        </Suspense>
      </main>
      {md && <FormModal {...md} close={() => setMd(null)} />}
    </>
  )
}
