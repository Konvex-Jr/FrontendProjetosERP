/**
 * Ocupação semanal (sessão 24a). Datas são AAAA-MM-DD tratadas em UTC, nunca no fuso local.
 * Semana = segunda a domingo.
 */

export const DIFICULDADES = [
  ['rapida', 'Rápida'],
  ['facil', 'Fácil'],
  ['media', 'Média'],
  ['dificil', 'Difícil'],
]

/** "4,8 h"; inteiro sem casa decimal: "4 h". */
export function formatarHoras(n) {
  const v = Math.round(Number(n) * 10) / 10
  return `${String(v).replace('.', ',')} h`
}

/** "Média (4 h)"; sem horas, só o nome. */
export function rotuloDificuldade(valor, horas) {
  const par = DIFICULDADES.find(([v]) => v === valor)
  if (!par) return ''
  return horas == null ? par[1] : `${par[1]} (${formatarHoras(horas)})`
}

/** ok até 80%, atencao de 81 a 100, perigo acima de 100. */
export function faixaOcupacao(p) {
  if (p > 100) return 'perigo'
  if (p > 80) return 'atencao'
  return 'ok'
}

const MS_DIA = 24 * 60 * 60 * 1000
const paraData = iso => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
const paraISO = d => d.toISOString().slice(0, 10)

/** Segunda-feira da semana do dia informado. */
export function segundaDaSemana(isoDia) {
  const d = paraData(isoDia)
  const dias = (d.getUTCDay() + 6) % 7
  return paraISO(new Date(d.getTime() - dias * MS_DIA))
}

const somarDias = (iso, n) => paraISO(new Date(paraData(iso).getTime() + n * MS_DIA))

export const semanaAnterior = iso => somarDias(segundaDaSemana(iso), -7)
export const proximaSemana = iso => somarDias(segundaDaSemana(iso), 7)

const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** "23/11 a 29/11". */
export function rotuloSemana(iso) {
  const segunda = segundaDaSemana(iso)
  return `${ddmm(segunda)} a ${ddmm(somarDias(segunda, 6))}`
}

/** "Ana fica com 120% na semana de 23/11 (12 h de 10 h)." */
export const textoAviso = a =>
  `${a.nome} fica com ${Math.round(a.percentual)}% na semana de ${ddmm(String(a.semana).slice(0, 10))} (${formatarHoras(a.horas)} de ${formatarHoras(a.teto)}).`

/** Segunda-feira da semana de hoje (dia do relógio local). */
export function semanaAtual() {
  const d = new Date()
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return segundaDaSemana(iso)
}

/** Opções do select de dificuldade: [valor, rótulo] com "Sem classificação" primeiro. `horas` pode faltar. */
export const opcoesDificuldade = horas => [['', 'Sem classificação'], ...DIFICULDADES.map(([v]) => [v, rotuloDificuldade(v, horas?.[v])])]

/** Pessoas com " · N%" no nome (percentual por código); quem não tem % fica igual. */
export const comCarga = (pessoas, carga = {}) => pessoas.map(u => (carga[u.id] == null ? u : { ...u, nome: `${u.nome} · ${carga[u.id]}%` }))

/** Lista da API de ocupação → { codigo: percentual arredondado }. */
export const cargaPorPessoa = lista => Object.fromEntries(lista.map(o => [o.codigoUsuario, Math.round(o.percentual)]))
