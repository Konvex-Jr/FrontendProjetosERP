/**
 * Períodos da pessoa nas áreas (sessão 23a). Período = [início, fim): fim vazio = atual.
 * As regras de data repetem as do back (`PeriodoArea`), para avisar antes de enviar.
 */

const dataISO = valor => (valor ? String(valor).slice(0, 10) : '')

/** Atuais por nome da área; anteriores com o fim mais recente primeiro. */
export function separarPeriodos(periodos) {
  const lista = periodos || []
  const atuais = lista.filter(p => !p.fim).sort((a, b) => a.area.nome.localeCompare(b.area.nome, 'pt-BR'))
  const anteriores = lista
    .filter(p => p.fim)
    .sort((a, b) => dataISO(b.fim).localeCompare(dataISO(a.fim)) || dataISO(b.inicio).localeCompare(dataISO(a.inicio)))
  return { atuais, anteriores }
}

/** "Inovação · Gerente"; sem cargo, só a área. */
export const rotuloArea = ({ area, cargo }) => (cargo ? `${area.nome} · ${cargo.nome}` : area.nome)

/** Mensagem do primeiro problema nas datas (AAAA-MM-DD) ou null. */
export function erroDatas({ inicio, fim }, hojeISO) {
  const i = dataISO(inicio)
  const f = dataISO(fim)
  if (!i) return 'Informe o início do período.'
  if (i > hojeISO) return 'O início do período não pode ser no futuro.'
  if (f && f > hojeISO) return 'O fim do período não pode ser no futuro.'
  if (f && f <= i) return 'O fim do período deve ser depois do início.'
  return null
}
