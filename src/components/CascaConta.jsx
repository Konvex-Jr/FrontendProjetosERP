const BASE = import.meta.env.BASE_URL + 'assets/'

/** Painel dividido do login (marca à esquerda, formulário à direita) para as telas de conta sem sessão. */
export default function CascaConta({ children }) {
  return (
    <div className="lgv">
      <section className="lgv-hx">
        <img className="lgv-logo" src={BASE + 'logo-branca.webp'} width={192} height={28} alt="Konvex Jr" />
        <div className="lgv-tx">
          <h1>Sistema interno da Konvex</h1>
          <p>Projetos, tarefas, pessoas e capacitações num lugar só.</p>
        </div>
      </section>
      <main className="lgv-mold">{children}</main>
    </div>
  )
}
