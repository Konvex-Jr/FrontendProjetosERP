import { Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { fm, un, chip } from '../lib/utils'
import Ic from './Icon'
import alerts from '../lib/alerts'
import Avatar from './Avatar'
import Avisos from './Avisos'
import { destinoPorPendencia, situacaoDaSecao } from '../lib/rotas'
import TelaAviso from './TelaAviso'
import FormModal from './FormModal'
import Esqueleto from './Esqueleto'
import { PAGINAS } from '../paginas'
import { anteciparDados, precarregarPaginas } from '../lib/antecipar'

/** Barra do topo: data de hoje, troca de tema, avisos, pessoa logada (abre o perfil), Configurações (engrenagem) e Sair. */
function Header() {
  const { D, me, sair, nav, go } = useApp(),
    temConfig = nav.some(([k]) => k === 'configuracoes'),
    // Sair pede confirmação (27c): o botão fica perto do avatar e era fácil clicar sem querer.
    confirmarSaida = async () => {
      if (await alerts.confirm({ title: 'Sair do sistema?', text: 'Você volta para a tela de entrada.', confirmText: 'Sair' })) sair()
    },
    navigate = useNavigate()
  const [dk, setDk] = useState(document.documentElement.dataset.theme == 'dark')
  const tema = () => {
    const n = !dk,
      r = document.documentElement
    // data-theme liga as nossas cores e data-bs-theme as do Bootstrap. A classe `tt` anima as cores só durante a troca.
    r.classList.add('tt')
    r.dataset.theme = n ? 'dark' : 'light'
    r.dataset.bsTheme = n ? 'dark' : 'light'
    try {
      localStorage.setItem('tema', n ? 'dark' : 'light')
    } catch (e) {
      /* sem storage: o tema só não fica salvo */
    }
    setDk(n)
    setTimeout(() => r.classList.remove('tt'), 600)
  }
  return (
    <header className="hd">
      <div className="hdi">
        <img
          className="hl"
          src={import.meta.env.BASE_URL + 'assets/logo-branca.webp'}
          width={192}
          height={28}
          alt="Konvex Jr – ir para o Dashboard"
          onClick={() => navigate('/')}
        />
        <div className="hr">
          <span className={chip('hdt')}>Hoje · {fm(D.c.hoje)}</span>
          <button
            className="tg"
            aria-label={dk ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={dk ? 'Modo claro' : 'Modo escuro'}
            onClick={tema}
          >
            <span className="sun">
              <Ic k="sun" />
            </span>
            <span className="moon">
              <Ic k="moon" />
            </span>
          </button>
          <Avisos me={me} />
          <span className="hu">
            <b>{un(D, me)}</b>
            <small>{D.u.find(u => u.id == me)?.perfil}</small>
          </span>
          <Avatar
            pessoa={D.u.find(u => u.id == me) || { nome: un(D, me) }}
            role="button"
            tabIndex={0}
            title="Meu perfil"
            aria-label="Meu perfil"
            onClick={() => navigate('/perfil')}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), navigate('/perfil'))}
          />
          {temConfig && (
            <button
              type="button"
              className="btn btn-g btn-sm hs-config"
              onClick={() => go('configuracoes')}
              aria-label="Configurações"
              title="Configurações"
            >
              <Ic k="configuracoes" />
            </button>
          )}
          <button className="btn btn-g btn-sm hs-sair" onClick={confirmarSaida} aria-label="Sair">
            <Ic k="logout" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </header>
  )
}

// No celular (até 991 px) a barra inferior mostra só os primeiros itens; o resto fica na gaveta "Mais".
const ITENS_BARRA = 4

/** Menu lateral (no celular, barra inferior com gaveta "Mais"). Os itens vêm da API (`nav`). */
function SideNav() {
  const { nav: navTodo, go, me, mb, pode } = useApp(),
    { pathname } = useLocation()
  // Itens com grupo formam o menu (Trabalho, Equipe, Gestão); Configurações fica na engrenagem do topo.
  const nav = navTodo.filter(([, , , grupo]) => grupo)
  const [gaveta, setGaveta] = useState(false)
  // Depois de montar, baixa no tempo ocioso o arquivo de cada tela do menu: o clique abre sem esperar.
  // A dependência é o texto dos caminhos: o `nav` é um array novo a cada render do contexto.
  const caminhos = navTodo.map(([, , caminho]) => caminho).join(' ')
  useEffect(() => {
    precarregarPaginas(caminhos.split(' '), PAGINAS)
  }, [caminhos])
  // Mouse em cima, foco ou toque num item: busca os dados da tela antes do clique (só itens do menu).
  const antecipar = caminho => {
    const buscar = () => anteciparDados(caminho, { me, mb, pode, nav: navTodo }, { paginas: PAGINAS })
    return { onMouseEnter: buscar, onFocus: buscar, onTouchStart: buscar }
  }
  const ativo = nav.findIndex(([, , p]) => (p === '/' ? pathname === '/' : pathname.startsWith(p)))
  const comMais = nav.length > ITENS_BARRA + 1
  const ir = k => {
    setGaveta(false)
    go(k)
  }
  return (
    <>
      {/* --i posiciona a pílula animada no item ativo (layout.css). */}
      <nav id="menu" aria-label="Menu principal" className={comMais ? 'cm-mais' : ''} style={{ '--i': Math.max(0, ativo) }}>
        <i className="pill" />
        <img
          className="ml"
          src={import.meta.env.BASE_URL + 'assets/logo-branca.webp'}
          width={192}
          height={28}
          alt="Konvex Jr – ir para a Visão Geral"
          onClick={() => ir(nav[0]?.[0])}
        />
        {nav.map(([k, l, p, grupo], i) => [
          grupo !== nav[i - 1]?.[3] && (
            <span key={'g-' + grupo} className="mg" aria-hidden="true">
              {grupo}
            </span>
          ),
          <a
            key={k}
            {...antecipar(p)}
            role="button"
            tabIndex={0}
            className={(i === ativo ? 'on' : '') + (comMais && i >= ITENS_BARRA ? ' ex' : '')}
            aria-current={i === ativo ? 'page' : undefined}
            aria-label={l}
            data-l={l}
            onClick={() => ir(k)}
            onKeyDown={e => e.key == 'Enter' && ir(k)}
          >
            <Ic k={k} />
            <span className="nl">{l}</span>
          </a>,
        ])}
        {comMais && (
          <button
            type="button"
            className={'mais' + (ativo >= ITENS_BARRA ? ' on' : '')}
            aria-label="Mais opções do menu"
            aria-expanded={gaveta}
            onClick={() => setGaveta(true)}
          >
            <Ic k="menu" />
          </button>
        )}
      </nav>
      {gaveta && (
        <>
          <div className="gv-fundo" onClick={() => setGaveta(false)} />
          <div className="gv" role="dialog" aria-label="Menu">
            <div className="gv-t">
              <b>Menu</b>
              <button type="button" className="btn btn-g btn-sm" aria-label="Fechar menu" onClick={() => setGaveta(false)}>
                <Ic k="x" />
              </button>
            </div>
            {nav.map(([k, l, p, grupo], i) => [
              grupo !== nav[i - 1]?.[3] && (
                <span key={'g-' + grupo} className="gv-g">
                  {grupo}
                </span>
              ),
              <button
                type="button"
                key={k}
                {...antecipar(p)}
                className={'gv-i' + (i === ativo ? ' on' : '')}
                aria-current={i === ativo ? 'page' : undefined}
                onClick={() => ir(k)}
              >
                <Ic k={k} />
                <span>{l}</span>
              </button>,
            ])}
          </div>
        </>
      )}
    </>
  )
}

/**
 * Moldura de todas as telas logadas: cabeçalho, menu, a página da rota (Outlet) e o FormModal
 * global aberto por `form()` do contexto. Também é a guarda das rotas: sem login vai para /login.
 */
export default function Layout() {
  const { me, nav, md, setMd, pendencias } = useApp(),
    { pathname } = useLocation()
  if (!me) return <Navigate to="/login" replace />
  // Dados obrigatórios faltando (primeiro acesso): nada abre antes da tela de completar o perfil.
  const completar = destinoPorPendencia(pendencias)
  if (completar) return <Navigate to={completar} replace />
  // Só abre telas que vieram no menu da pessoa (GET /auth/permissoes), além do perfil. Tela fora do menu
  // mostra "sem acesso"; endereço que não existe cai na rota "*" (tela "página não existe").
  const semAcesso = situacaoDaSecao(pathname.split('/')[1], nav) === 'sem-acesso'
  return (
    <>
      <Header />
      <SideNav />
      <main className="app-main">
        {/* Fallback enquanto o arquivo da página baixa (carregarPagina); a key por rota repete a animação de entrada. */}
        <Suspense fallback={<Esqueleto />}>
          <div key={pathname} className="page-in">
            {semAcesso ? <TelaAviso tipo="sem-acesso" /> : <Outlet />}
          </div>
        </Suspense>
      </main>
      {md && <FormModal {...md} close={() => setMd(null)} />}
    </>
  )
}
