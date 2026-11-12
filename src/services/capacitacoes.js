import { request } from './api.js'

/**
 * Capacitações (sessão 13). Todos leem; a API diz o que cada pessoa pode fazer em cada uma
 * (`podeGerir`, `podeInscrever`, `podeCancelar`, `podeAvaliar`, `podeVerAvaliacoes`).
 * Inscritos só vêm para a gestão e para quem ministra; avaliações individuais só para eles.
 */
const get = path => request(path, { auth: true })
const send = (method, path, body) => request(path, { method, auth: true, body })

export const SITUACAO = { aberta: ['Inscrições abertas', 'ok'], lotada: ['Vagas esgotadas', 'wa'], realizada: ['Realizada', ''] }

/** Horas em texto: 1 → "1 h", 1.5 → "1h30". */
export const horas = h => {
  const n = Number(h) || 0,
    inteiras = Math.floor(n),
    min = Math.round((n - inteiras) * 60)
  return min ? `${inteiras}h${String(min).padStart(2, '0')}` : `${inteiras} h`
}

export const adaptCapacitacao = c => ({
  id: c.codigo,
  titulo: c.titulo,
  descricao: c.descricao || '',
  data: String(c.data || '').slice(0, 10),
  hora: c.hora,
  inicio: c.inicio,
  duracao: Number(c.duracaoHoras) || 1,
  instrutorId: c.instrutor?.codigo || '',
  instrutor: c.instrutor?.nome || '—',
  vagas: c.vagas,
  tipo: c.tipo,
  sala: c.sala,
  totalInscritos: c.totalInscritos ?? 0,
  vagasRestantes: c.vagasRestantes ?? 0,
  situacao: c.situacao,
  inscrito: Boolean(c.inscrito),
  presente: c.presente ?? null,
  // Só a gestão e quem ministra recebem a lista; os demais ficam com a contagem.
  inscritos: (c.inscritos || []).map(i => ({ id: i.codigo, nome: i.nome, presente: i.presente ?? null })),
  verInscritos: Array.isArray(c.inscritos),
  media: c.avaliacao?.media ?? null,
  avaliacoes: c.avaliacao?.total ?? 0,
  minhaAvaliacao: c.minhaAvaliacao || null,
  podeGerir: Boolean(c.podeGerir),
  podeInscrever: Boolean(c.podeInscrever),
  podeCancelar: Boolean(c.podeCancelar),
  podeAvaliar: Boolean(c.podeAvaliar),
  podeVerAvaliacoes: Boolean(c.podeVerAvaliacoes),
  anexos: c.anexos || [],
})

export const valoresCapacitacao = c =>
  c
    ? {
        titulo: c.titulo,
        descricao: c.descricao,
        data: c.data,
        hora: c.hora,
        duracaoHoras: String(c.duracao).replace('.', ','),
        codigoInstrutor: c.instrutorId,
        vagas: c.vagas,
        tipo: c.tipo,
        sala: c.sala,
      }
    : {
        titulo: '',
        descricao: '',
        data: '',
        hora: '18:30',
        duracaoHoras: '1',
        codigoInstrutor: '',
        vagas: 20,
        tipo: 'computacao',
        sala: '',
      }

const corpo = v => ({ ...v, duracaoHoras: String(v.duracaoHoras ?? '').replace(',', '.'), vagas: Number(v.vagas) })

const uma = async p => adaptCapacitacao(await p)

export const capacitacoes = {
  opcoes: () => get('/capacitacoes/opcoes'),
  listar: async () => (await get('/capacitacoes')).map(adaptCapacitacao),
  buscar: codigo => uma(get(`/capacitacoes/${codigo}`)),
  salvar: (codigo, valores) =>
    uma(codigo ? send('PUT', `/capacitacoes/${codigo}`, corpo(valores)) : send('POST', '/capacitacoes', corpo(valores))),
  excluir: codigo => send('DELETE', `/capacitacoes/${codigo}`),
  inscrever: (codigo, codigoUsuario) => uma(send('POST', `/capacitacoes/${codigo}/inscricoes`, codigoUsuario ? { codigoUsuario } : {})),
  cancelar: (codigo, codigoUsuario) => uma(send('DELETE', `/capacitacoes/${codigo}/inscricoes/${codigoUsuario}`)),
  marcarPresencas: (codigo, presentes) => uma(send('PUT', `/capacitacoes/${codigo}/presencas`, { presentes })),
  avaliar: (codigo, avaliacao) => uma(send('PUT', `/capacitacoes/${codigo}/avaliacao`, avaliacao)),
  avaliacoes: codigo => get(`/capacitacoes/${codigo}/avaliacoes`),
}
