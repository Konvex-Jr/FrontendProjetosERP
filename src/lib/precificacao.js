/**
 * Cálculo da simulação de precificação (sessão 29). Função pura: nada é gravado.
 *
 * Ordem do cálculo (cada passo aparece na memória de cálculo):
 * 1. Custo das horas: horas por senioridade × valor-hora.
 * 2. Contingência: reserva sobre as horas.
 * 3. Suporte pós-entrega: meses × horas por mês, ao valor-hora médio do projeto.
 *    = Custo total.
 * 4. Margem, complexidade, riscos, urgência e tipo de cliente: percentuais aplicados em sequência.
 * 5. Desconto comercial (até o teto, com justificativa).
 *    = Valor líquido. Abaixo do custo + margem mínima: alerta.
 * 6. Impostos "por dentro": tirando os impostos do preço final, sobra o valor líquido.
 */

export const COMPLEXIDADES = [
  ['baixa', 'Baixa'],
  ['media', 'Média'],
  ['alta', 'Alta'],
]

export const RISCOS = [
  ['escopo', 'Escopo pouco definido'],
  ['tecnologia', 'Tecnologia nova para a equipe'],
  ['terceiros', 'Dependência de terceiros'],
]

export const TIPOS_CLIENTE = [
  ['parceira', 'ONG ou EJ parceira'],
  ['pequena', 'Pequena empresa'],
  ['mediaGrande', 'Média ou grande empresa'],
]

/** Campos das regras para o formulário da diretoria: [caminho, rótulo, mínimo, máximo, passo]. */
export const CAMPOS_REGRAS = [
  ['complexidade.baixa', 'Complexidade baixa (%)', 0, 100, 0.5],
  ['complexidade.media', 'Complexidade média (%)', 0, 100, 0.5],
  ['complexidade.alta', 'Complexidade alta (%)', 0, 100, 0.5],
  ['risco.escopo', 'Risco: escopo pouco definido (%)', 0, 100, 0.5],
  ['risco.tecnologia', 'Risco: tecnologia nova (%)', 0, 100, 0.5],
  ['risco.terceiros', 'Risco: dependência de terceiros (%)', 0, 100, 0.5],
  ['urgencia', 'Urgência (%)', 0, 100, 0.5],
  ['tipoCliente.parceira', 'Cliente ONG ou EJ parceira (%)', -50, 100, 0.5],
  ['tipoCliente.pequena', 'Cliente pequena empresa (%)', -50, 100, 0.5],
  ['tipoCliente.mediaGrande', 'Cliente média ou grande empresa (%)', -50, 100, 0.5],
  ['contingencia', 'Contingência sobre as horas (%)', 0, 50, 0.5],
  ['suporteHorasMes', 'Horas de suporte por mês', 0, 80, 0.5],
  ['impostos', 'Impostos e taxas da EJ (%)', 0, 60, 0.5],
  ['margem', 'Margem padrão (%)', 0, 200, 0.5],
  ['margemMinima', 'Margem mínima (%)', 0, 200, 0.5],
  ['descontoMaximo', 'Teto do desconto (%)', 0, 50, 0.5],
  ['validadeDias', 'Validade do documento (dias)', 1, 180, 1],
]

/** Lê `a.b` de um objeto. */
export const lerCampo = (obj, caminho) => caminho.split('.').reduce((atual, chave) => atual?.[chave], obj)

/** Monta o objeto das regras a partir dos valores planos do formulário (`{ 'risco.escopo': '10', ... }`). */
export function regrasDoFormulario(valores) {
  const regras = {}
  for (const [caminho] of CAMPOS_REGRAS) {
    const [grupo, campo] = caminho.split('.')
    const numero = Number(valores[caminho])
    if (campo) regras[grupo] = { ...regras[grupo], [campo]: numero }
    else regras[grupo] = numero
  }
  return regras
}

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const pct = v => `${String(v).replace('.', ',')}%`
const nomeDe = (lista, chave) => lista.find(([k]) => k === chave)?.[1] ?? chave

/**
 * @param {object} p
 * @param {Array<{codigo:string,nome:string}>} p.senioridades em ordem de exibição
 * @param {Record<string, number>} p.horas horas estimadas por senioridade
 * @param {Record<string, number>} p.valoresHora valor-hora por senioridade
 * @param {object} p.regras regras da diretoria (GET /config/precificacao)
 * @param {object} p.escolhas { complexidade, riscos: string[], urgente, tipoCliente, mesesSuporte, margem, desconto, justificativa }
 */
export function calcularPreco({ senioridades, horas, valoresHora, regras, escolhas }) {
  const contingencia = num(regras.contingencia)
  const linhas = senioridades
    .map(s => {
      const horasBase = Math.max(0, num(horas[s.codigo]))
      const valorHora = Math.max(0, num(valoresHora[s.codigo]))
      const horasComReserva = horasBase * (1 + contingencia / 100)
      return { codigo: s.codigo, nome: s.nome, horasBase, horas: horasComReserva, valorHora, custo: horasComReserva * valorHora }
    })
    .filter(l => l.horasBase > 0)

  const horasBase = linhas.reduce((t, l) => t + l.horasBase, 0)
  const horasProjeto = linhas.reduce((t, l) => t + l.horas, 0)
  const custoSemReserva = linhas.reduce((t, l) => t + l.horasBase * l.valorHora, 0)
  const custoProjeto = linhas.reduce((t, l) => t + l.custo, 0)
  const valorHoraMedio = horasProjeto ? custoProjeto / horasProjeto : 0
  const mesesSuporte = Math.max(0, Math.floor(num(escolhas.mesesSuporte)))
  const horasSuporte = mesesSuporte * num(regras.suporteHorasMes)
  const custoSuporte = horasSuporte * valorHoraMedio
  const custo = custoProjeto + custoSuporte

  const memoria = [{ rotulo: 'Horas estimadas × valor-hora', valor: custoSemReserva, subtotal: custoSemReserva }]
  let atual = custoSemReserva
  const somar = (rotulo, valor) => {
    atual += valor
    memoria.push({ rotulo, valor, subtotal: atual })
  }
  if (contingencia) somar(`Contingência (${pct(contingencia)} das horas)`, custoProjeto - custoSemReserva)
  if (horasSuporte)
    somar(`Suporte pós-entrega (${mesesSuporte} ${mesesSuporte === 1 ? 'mês' : 'meses'} × ${regras.suporteHorasMes} h)`, custoSuporte)
  memoria.push({ rotulo: 'Custo total', subtotal: custo, total: true })

  const aplicar = (rotulo, percentual) => somar(`${rotulo} (${percentual > 0 ? '+' : ''}${pct(percentual)})`, (atual * percentual) / 100)
  const margem = Math.max(0, num(escolhas.margem))
  aplicar('Margem', margem)
  if (escolhas.complexidade)
    aplicar(`Complexidade ${nomeDe(COMPLEXIDADES, escolhas.complexidade).toLowerCase()}`, num(regras.complexidade?.[escolhas.complexidade]))
  for (const [chave, nome] of RISCOS)
    if (escolhas.riscos?.includes(chave)) aplicar(`Risco: ${nome.toLowerCase()}`, num(regras.risco?.[chave]))
  if (escolhas.urgente) aplicar('Urgência', num(regras.urgencia))
  if (escolhas.tipoCliente)
    aplicar(`Cliente: ${nomeDe(TIPOS_CLIENTE, escolhas.tipoCliente)}`, num(regras.tipoCliente?.[escolhas.tipoCliente]))

  const desconto = Math.max(0, num(escolhas.desconto))
  if (desconto) somar(`Desconto comercial (${pct(desconto)})`, -(atual * desconto) / 100)
  const liquido = atual
  memoria.push({ rotulo: 'Valor líquido', subtotal: liquido, total: true })

  const impostos = Math.min(Math.max(0, num(regras.impostos)), 99)
  const total = liquido / (1 - impostos / 100)
  if (impostos)
    memoria.push({ rotulo: `Impostos e taxas da EJ (${pct(impostos)} do preço final)`, valor: total - liquido, subtotal: total })
  memoria.push({ rotulo: 'Preço final', subtotal: total, total: true })

  const piso = custo * (1 + num(regras.margemMinima) / 100)
  const descontoAcimaDoTeto = desconto > num(regras.descontoMaximo)
  const faltaJustificativa = desconto > 0 && !String(escolhas.justificativa ?? '').trim()

  return {
    linhas,
    horasBase,
    horasProjeto,
    horasSuporte,
    custo,
    liquido,
    total,
    memoria,
    piso,
    abaixoDaMargem: custo > 0 && liquido < piso - 0.005,
    descontoAcimaDoTeto,
    faltaJustificativa,
    podeGerarDocumento: horasBase > 0 && !descontoAcimaDoTeto && !faltaJustificativa,
  }
}

/** Data de validade (hoje + dias), em dd/mm/aaaa. */
export function validadeAte(hoje, dias) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + num(dias))
  return d.toLocaleDateString('pt-BR')
}
