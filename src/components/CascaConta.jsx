const BASE = import.meta.env.BASE_URL + 'assets/'

/** Painel dividido do login (marca à esquerda, formulário à direita) para as telas de conta sem sessão. */
export default function CascaConta({ children }) {
  return (
    <div className="lgv">
      <section className="lgv-hx">
        <img className="lgv-logo" src={BASE + 'logo-branca.webp'} width={192} height={28} alt="Konvex Jr" />
        <div className="lgv-tx">
          <span className="lgv-pill">Sistema interno</span>
          <h1>
            A Konvex em <em>movimento</em>.
          </h1>
          <p>Projetos, tarefas, pessoas e capacitações num só lugar.</p>
        </div>
        <div className="lgv-glass" aria-hidden="true">
          <small>Acesso</small>
          <b>Só para membros</b>
          <span>Use o e-mail e a senha da empresa</span>
        </div>
      </section>
      <main className="lgv-mold">{children}</main>
    </div>
  )
}
