/**
 * Calendário interno (sessão 13): cálculos puros, sem React.
 * Datas no formato AAAA-MM-DD; mês no formato AAAA-MM.
 */
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const iso = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

export const mesDe = (data) => String(data).slice(0, 7)

/** Mês somando `n` (negativo volta): mudarMes('2026-01', -1) → '2025-12'. */
export function mudarMes(mes, n) {
  const [a, m] = mes.split('-').map(Number)
  const total = a * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export const nomeDoMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`

/**
 * Semanas do mês (domingo a sábado), cada dia com { data, doMes, eventos }.
 * Os dias de fora do mês completam a primeira e a última semana.
 */
export function semanasDoMes(mes, eventos = [], dataDe = (e) => e.data) {
  const [a, m] = mes.split('-').map(Number)
  const primeiro = new Date(Date.UTC(a, m - 1, 1))
  const inicio = new Date(primeiro.getTime() - primeiro.getUTCDay() * 86_400_000)
  const ultimo = new Date(Date.UTC(a, m, 0))
  const fim = new Date(ultimo.getTime() + (6 - ultimo.getUTCDay()) * 86_400_000)
  const porDia = new Map()
  for (const e of eventos) porDia.set(dataDe(e), [...(porDia.get(dataDe(e)) || []), e])
  const semanas = []
  for (let t = inicio.getTime(); t <= fim.getTime(); t += 7 * 86_400_000) {
    semanas.push(Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(t + i * 86_400_000)
      const data = iso(dia.getUTCFullYear(), dia.getUTCMonth() + 1, dia.getUTCDate())
      return { data, dia: dia.getUTCDate(), doMes: dia.getUTCMonth() === m - 1, eventos: porDia.get(data) || [] }
    }))
  }
  return semanas
}
