/** Clientes do projeto (sessão 31b). Telefone e e-mail só chegam para quem tem `clientes.ver`. */

const limpar = v => String(v ?? '').trim()

/** Linha nova do formulário. */
export const clienteVazio = () => ({ nome: '', empresa: '', telefone: '', email: '' })

/** Lista do formulário → corpo da API: tira as linhas em branco e manda vazio como null. */
export function clientesParaApi(lista) {
  return (lista || [])
    .map(c => ({ nome: limpar(c.nome), empresa: limpar(c.empresa), telefone: limpar(c.telefone), email: limpar(c.email) }))
    .filter(c => c.nome || c.empresa || c.telefone || c.email)
    .map(c => ({ nome: c.nome, empresa: c.empresa || null, telefone: c.telefone || null, email: c.email || null }))
}

/** Projeto da API → linhas do formulário (campos nulos viram texto vazio). */
export function clientesParaFormulario(clientes) {
  return (clientes || []).map(c => ({
    nome: c.nome || '',
    empresa: c.empresa || '',
    telefone: c.telefone || '',
    email: c.email || '',
  }))
}

/** Aviso do formulário antes de mandar: linha sem nome. Vazio = tudo certo. */
export function erroDosClientes(lista) {
  const i = clientesParaApi(lista).findIndex(c => !c.nome)
  return i === -1 ? '' : `Informe o nome do cliente ${i + 1}.`
}

/** "Ana Souza (Padaria Sol), Bruno Lima" ou "—". */
export function textoClientes(clientes) {
  if (!clientes?.length) return '—'
  return clientes.map(c => (c.empresa ? `${c.nome} (${c.empresa})` : c.nome)).join(', ')
}

/** Algum cliente veio com telefone ou e-mail (quem tem clientes.ver). */
export const temContatos = clientes => (clientes || []).some(c => c.telefone || c.email)
