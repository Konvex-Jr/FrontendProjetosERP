import Ic from './Icon'
import { clienteVazio, temContatos } from '../lib/clientesProjeto'
import { mascararTelefone } from '../lib/pessoaContato'

/**
 * Clientes no formulário do projeto (sessão 31b), só para quem tem `clientes.ver`: uma linha por cliente
 * com nome, empresa, telefone e e-mail. Linhas em branco são descartadas ao gravar (clientesParaApi).
 */
export function CamposClientes({ valor, aoMudar }) {
  const lista = valor?.length ? valor : []
  const mudar = (i, campo, texto) => aoMudar(lista.map((c, j) => (j === i ? { ...c, [campo]: texto } : c)))
  const remover = i => aoMudar(lista.filter((_, j) => j !== i))
  return (
    <div className="clientes-form">
      <div className="form-label mb-0">Clientes</div>
      <small className="d-block">Telefone e e-mail só a diretoria vê; a equipe vê o nome e a empresa.</small>
      {lista.map((c, i) => (
        <fieldset className="clientes-linha" key={i}>
          <legend className="visually-hidden">Cliente {i + 1}</legend>
          <input
            className="form-control"
            aria-label={`Nome do cliente ${i + 1}`}
            placeholder="Nome"
            maxLength={150}
            value={c.nome}
            onChange={e => mudar(i, 'nome', e.target.value)}
          />
          <input
            className="form-control"
            aria-label={`Empresa do cliente ${i + 1}`}
            placeholder="Empresa"
            maxLength={150}
            value={c.empresa}
            onChange={e => mudar(i, 'empresa', e.target.value)}
          />
          <input
            className="form-control"
            aria-label={`Telefone do cliente ${i + 1}`}
            placeholder="Telefone"
            inputMode="tel"
            value={c.telefone}
            onChange={e => mudar(i, 'telefone', mascararTelefone(e.target.value))}
          />
          <input
            className="form-control"
            type="email"
            aria-label={`E-mail do cliente ${i + 1}`}
            placeholder="E-mail"
            maxLength={254}
            value={c.email}
            onChange={e => mudar(i, 'email', e.target.value)}
          />
          <button type="button" className="btn btn-g btn-sm" aria-label={`Remover o cliente ${i + 1}`} onClick={() => remover(i)}>
            <Ic k="trash" />
          </button>
        </fieldset>
      ))}
      {lista.length < 10 && (
        <button type="button" className="btn btn-g btn-sm" onClick={() => aoMudar([...lista, clienteVazio()])}>
          <Ic k="plus" />
          Adicionar cliente
        </button>
      )}
    </div>
  )
}

/** Clientes na Visão geral: nome e empresa para quem abre; com contatos, a tabela (só quem tem clientes.ver os recebe). */
export function ListaClientes({ clientes }) {
  if (!clientes?.length) return <span>—</span>
  if (!temContatos(clientes))
    return (
      <ul className="clientes-lista">
        {clientes.map((c, i) => (
          <li key={i}>
            {c.nome}
            {c.empresa && <span className="text-mu"> · {c.empresa}</span>}
          </li>
        ))}
      </ul>
    )
  return (
    <ul className="clientes-lista">
      {clientes.map((c, i) => (
        <li key={i}>
          <span className="fw-semibold">{c.nome}</span>
          {c.empresa && <span className="text-mu"> · {c.empresa}</span>}
          <span className="d-block small">
            {c.telefone && (
              <a className="link-texto" href={`tel:${c.telefone.replace(/\D/g, '')}`}>
                {c.telefone}
              </a>
            )}
            {c.telefone && c.email && ' · '}
            {c.email && (
              <a className="link-texto" href={`mailto:${c.email}`}>
                {c.email}
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
