import { STATUS_ATIVOS } from '../services/projetos.js'

/** Grupos de projeto usados nos indicadores e no filtro da tela Projetos. */
export const GRUPOS_PROJETO = {
  ativos: { rotulo: 'Ativos', status: STATUS_ATIVOS },
  atencao: { rotulo: 'Em atenção ou bloqueados', status: ['atencao', 'bloqueado'] },
  concluidos: { rotulo: 'Concluídos', status: ['concluido'] },
  arquivados: { rotulo: 'Arquivados', status: ['arquivado'] },
}

const dia = s => new Date(String(s).slice(0, 10) + 'T00:00')
const somarDias = (data, n) => {
  const x = new Date(data)
  x.setDate(x.getDate() + n)
  return x
}

/** Domingo da semana de `hoje` (semana de segunda a domingo). */
export const fimDaSemana = hoje => somarDias(hoje, (7 - hoje.getDay()) % 7)

/**
 * Os sete indicadores do Dashboard (RF-110), calculados com o que a pessoa enxerga.
 * `D` = dados do contexto (p: projetos, u: pessoas, k: capacitações, t: tarefas); `hoje` = Date à meia-noite.
 * Cada item: { chave, numero, rotulo, dica, alerta, destino }. `destino` = [tela, filtro] para o atalho.
 */
export function indicadores(D, hoje) {
  const projetos = D.p || [],
    tarefas = D.t || [],
    pessoas = D.u || [],
    caps = D.k || []
  const emGrupo = g => projetos.filter(p => GRUPOS_PROJETO[g].status.includes(p.status)).length
  const abertas = tarefas.filter(t => t.status != 'concluida')
  const domingo = fimDaSemana(hoje),
    em30 = somarDias(hoje, 30)
  const atrasadas = abertas.filter(t => dia(t.fim) < hoje).length
  const semana = abertas.filter(t => dia(t.fim) >= hoje && dia(t.fim) <= domingo).length
  const proximas = caps.filter(c => dia(c.data) >= hoje && dia(c.data) <= em30).length
  const membros = pessoas.filter(u => (u.status ? u.status === 'ativo' : u.ativo !== false)).length
  return [
    {
      chave: 'ativos',
      numero: emGrupo('ativos'),
      rotulo: 'Projetos ativos',
      dica: 'Em andamento, atenção ou bloqueados',
      destino: ['projetos', 'ativos'],
    },
    {
      chave: 'atencao',
      numero: emGrupo('atencao'),
      rotulo: 'Em atenção',
      dica: 'Atenção ou bloqueados',
      alerta: true,
      destino: ['projetos', 'atencao'],
    },
    {
      chave: 'concluidos',
      numero: emGrupo('concluidos'),
      rotulo: 'Projetos concluídos',
      dica: 'Desde o início',
      destino: ['projetos', 'concluidos'],
    },
    {
      chave: 'membros',
      numero: membros,
      rotulo: 'Membros ativos',
      dica: 'Status Ativo (sem trainees)',
      destino: ['usuarios', { st: 'Ativo' }],
    },
    { chave: 'capacitacoes', numero: proximas, rotulo: 'Capacitações próximas', dica: 'Nos próximos 30 dias', destino: ['capacitacoes'] },
    {
      chave: 'semana',
      numero: semana,
      rotulo: 'Tarefas da semana',
      dica: 'Abertas, vencem até domingo',
      destino: ['tarefas', { pessoa: '', prazo: 'semana' }],
    },
    {
      chave: 'atrasadas',
      numero: atrasadas,
      rotulo: 'Tarefas atrasadas',
      dica: 'Abertas com prazo vencido',
      alerta: true,
      destino: ['tarefas', { pessoa: '', prazo: 'atrasadas' }],
    },
  ]
}
