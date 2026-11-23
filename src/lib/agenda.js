/**
 * Agenda unificada (sessão 28b): cálculos puros, sem React.
 * Datas AAAA-MM-DD; hora HH:MM de São Paulo; mês AAAA-MM.
 */
import { semanasDoMes } from './calendario.js'

/** Primeiro e último dia da grade do mês (domingo a sábado), para pedir à API só o que aparece. */
export function periodoDaGrade(mes) {
  const dias = semanasDoMes(mes).flat()
  return { de: dias[0].data, ate: dias[dias.length - 1].data }
}

const dois = n => String(n).padStart(2, '0')

/** Soma minutos a data + hora (sem fuso: tudo no horário de São Paulo). Devolve { data, hora }. */
export function somarMinutos(data, hora, minutos) {
  const [a, m, d] = data.split('-').map(Number)
  const [h, mi] = hora.split(':').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d, h, mi) + minutos * 60_000)
  return {
    data: `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}-${dois(t.getUTCDate())}`,
    hora: `${dois(t.getUTCHours())}:${dois(t.getUTCMinutes())}`,
  }
}

const carimbo = (data, hora) => data.replaceAll('-', '') + 'T' + hora.replace(':', '') + '00'

/**
 * Link que abre o Google Agenda com o evento preenchido (título, horário de São Paulo, local,
 * descrição e os participantes como convidados). Quem clica salva no Google, que manda os convites.
 */
export function linkGoogleAgenda(r) {
  const fim = somarMinutos(r.data, r.hora, r.duracaoMinutos)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: r.titulo,
    dates: `${carimbo(r.data, r.hora)}/${carimbo(fim.data, fim.hora)}`,
    ctz: 'America/Sao_Paulo',
  })
  if (r.local) p.set('location', r.local)
  if (r.descricao) p.set('details', r.descricao)
  const convidados = (r.participantes || []).map(x => x.email).filter(Boolean)
  if (convidados.length) p.set('add', convidados.join(','))
  return 'https://calendar.google.com/calendar/render?' + p.toString()
}

/** Texto curto do item na grade. */
export function rotuloItem(i) {
  if (i.tipo === 'prazo') return i.titulo ? `Prazo: ${i.titulo}` : `Prazo de tarefa · ${i.projeto?.nome || 'projeto'}`
  return `${i.hora} ${i.titulo}`
}

/** Classe de cor do item (reunião, prazo atrasado/concluído/aberto, capacitação). */
export function classeItem(i) {
  if (i.tipo === 'reuniao') return 'ag-reuniao'
  if (i.tipo === 'capacitacao') return 'ag-capacitacao'
  return i.concluida ? 'ag-prazo ok' : i.atrasada ? 'ag-prazo atrasada' : 'ag-prazo'
}

/** Duração em texto: 30 min, 1 h, 1 h 30. */
export function textoDuracao(minutos) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${dois(m)}` : `${h} h`
}

/** Valores iniciais do formulário de reunião (nova ou edição). */
export function valoresReuniao(r, dia) {
  return r
    ? {
        titulo: r.titulo,
        data: r.data,
        hora: r.hora,
        duracaoMinutos: String(r.duracaoMinutos),
        local: r.local || '',
        descricao: r.descricao || '',
        participantes: (r.participantes || []).map(p => p.codigo),
      }
    : { titulo: '', data: dia || '', hora: '14:00', duracaoMinutos: '60', local: '', descricao: '', participantes: [] }
}

/** Corpo para a API (duração em número). */
export const corpoReuniao = v => ({ ...v, duracaoMinutos: Number(v.duracaoMinutos) })
