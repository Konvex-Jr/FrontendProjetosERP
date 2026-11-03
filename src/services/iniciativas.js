import { request } from './api.js'

/**
 * Iniciativas de inovação (sessão 12b). Todos leem; a API diz se a pessoa pode criar
 * (`podeCriar` em /iniciativas/opcoes: gestão ou área de Inovação) e se pode alterar cada uma
 * (`podeAlterar`: responsável, quem criou ou gestão). Status, tipos e frentes vêm da API.
 */
const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, auth: true, body })

const ref = r => ({ id: r.codigo, nome: r.nome })

export const adaptIniciativa = (i) => ({
  id: i.codigo,
  titulo: i.titulo,
  descricao: i.descricao || '',
  tipo: i.tipo,
  frente: i.frente,
  status: i.status,
  responsavelId: i.responsavel?.codigo || '',
  responsavel: i.responsavel?.nome || '—',
  criadoPor: i.criadoPor?.nome || '',
  inicio: String(i.dataInicio || '').slice(0, 10),
  fim: String(i.dataFim || '').slice(0, 10),
  resultado: i.resultado || '',
  aprendizados: i.aprendizados || '',
  projetos: (i.projetos || []).map(ref),
  conhecimentos: (i.conhecimentos || []).map(ref),
  tarefas: (i.tarefas || []).map(t => ({
    id: t.codigo, titulo: t.titulo, status: t.status, prioridade: t.prioridade,
    fim: String(t.dataFim || '').slice(0, 10), responsaveis: (t.responsaveis || []).map(r => r.nome),
  })),
  totalTarefas: i.totalTarefas ?? (i.tarefas || []).length,
  tarefasConcluidas: i.tarefasConcluidas ?? 0,
  podeAlterar: Boolean(i.podeAlterar),
  atualizadoEm: i.atualizadoEm || '',
})

/** Rótulo de um valor numa das listas da API ({ valor, rotulo }). */
export const rotulo = (lista, valor) => (lista || []).find(o => o.valor === valor)?.rotulo || valor || '—'
/** Lista da API → opções de select ([valor, rótulo]). */
export const opcoesDe = lista => (lista || []).map(o => [o.valor, o.rotulo])

/** Cor do chip de status (classes já usadas nos projetos). */
export const COR_STATUS = { ideia: '', andamento: 'p3', pausada: 'wa', concluida: 'ok', descartada: 'er' }

/** Filtros da tela → query string da API (só os preenchidos). */
export function consulta(f = {}) {
  const q = new URLSearchParams()
  const mapa = { busca: f.busca?.trim(), status: f.status, tipo: f.tipo, frente: f.frente, codigoResponsavel: f.responsavel, codigoProjeto: f.projeto, codigoConhecimento: f.conhecimento }
  Object.entries(mapa).forEach(([k, v]) => v && q.set(k, v))
  const texto = q.toString()
  return texto ? `?${texto}` : ''
}

export const valoresIniciativa = (item, inicial = {}) => item
  ? {
      titulo: item.titulo, tipo: item.tipo, frente: item.frente, status: item.status, descricao: item.descricao,
      responsavel: item.responsavelId, inicio: item.inicio, fim: item.fim, resultado: item.resultado,
      aprendizados: item.aprendizados, projetos: item.projetos.map(p => p.id), conhecimentos: item.conhecimentos.map(c => c.id),
    }
  : { tipo: 'produto', frente: 'lab', status: 'ideia', projetos: [], conhecimentos: [], ...inicial }

export const corpoIniciativa = (v) => ({
  titulo: (v.titulo || '').trim(),
  tipo: v.tipo,
  frente: v.frente,
  status: v.status,
  descricao: v.descricao || '',
  ...(v.responsavel ? { codigoResponsavel: v.responsavel } : {}),
  dataInicio: v.inicio || null,
  dataFim: v.fim || null,
  resultado: v.resultado || '',
  aprendizados: v.aprendizados || '',
  codigosProjetos: v.projetos || [],
  codigosConhecimentos: v.conhecimentos || [],
})

/** Progresso das tarefas ligadas, para a lista e a ficha ("2 de 5"). */
export const progressoTarefas = i => (i.totalTarefas ? `${i.tarefasConcluidas} de ${i.totalTarefas}` : '—')

export const iniciativas = {
  opcoes: () => get('/iniciativas/opcoes'),
  listar: async (filtros) => (await get(`/iniciativas${consulta(filtros)}`)).map(adaptIniciativa),
  buscar: async (codigo) => adaptIniciativa(await get(`/iniciativas/${codigo}`)),
  salvar: (v, codigo) => codigo ? send('PUT', `/iniciativas/${codigo}`, corpoIniciativa(v)) : send('POST', '/iniciativas', corpoIniciativa(v)),
  excluir: (codigo) => send('DELETE', `/iniciativas/${codigo}`),
}
