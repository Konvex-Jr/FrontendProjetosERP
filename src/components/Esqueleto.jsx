/**
 * Blocos cinza com brilho suave no lugar de "Carregando…": a tela já mostra o formato do que vem.
 * `linhas` é a quantidade de blocos; o rótulo "Carregando" é só para leitor de tela.
 * A animação para sozinha com `prefers-reduced-motion` (regra global em layout.css).
 */
export default function Esqueleto({ linhas = 4 }) {
  return (
    <div className="esq" aria-busy="true" role="status">
      <span className="visually-hidden">Carregando</span>
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} className="esq-b esq-linha" aria-hidden="true" />
      ))}
    </div>
  )
}

/**
 * Moldura do app (cabeçalho e menu lateral, barra inferior no celular) em esqueleto, mostrada
 * enquanto a sessão e os dados globais carregam. Reaproveita `.hd` e `#menu` para ocupar o
 * mesmo lugar do layout de verdade e nada pular quando ele entrar.
 */
export function EsqueletoApp() {
  return (
    <div aria-busy="true" role="status">
      <span className="visually-hidden">Carregando</span>
      <header className="hd" aria-hidden="true">
        <div className="hdi">
          <span className="esq-b esq-logo" />
          <div className="hr">
            <span className="esq-b esq-chip" />
            <span className="esq-b esq-avatar" />
          </div>
        </div>
      </header>
      <nav id="menu" className="esq-menu" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className="esq-b esq-icone" />
        ))}
      </nav>
      <main className="app-main">
        <Esqueleto linhas={5} />
      </main>
    </div>
  )
}
