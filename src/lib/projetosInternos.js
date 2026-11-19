/** Projetos de cliente x internos (geral da área e internos da área), sessão 23b. */

export const rotuloTipo = p => (p?.geralDaArea ? 'Geral da área' : p?.tipo === 'interno' ? 'Interno' : 'Cliente')

/** `tipo`: '' (todos), 'cliente' ou 'interno'; `areaId` vazio = todas as áreas. */
export const filtrarProjetos = (projetos, { tipo = '', areaId = '' } = {}) =>
  (projetos || []).filter(p => (!tipo || p.tipo === tipo) && (!areaId || String(p.areaId) === String(areaId)))

/** Grupos para a tela: Clientes, depois uma área por grupo (ordem alfabética; geral primeiro, internos por nome). */
export function gruposDeProjetos(projetos) {
  const porNome = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
  const clientes = (projetos || []).filter(p => p.tipo !== 'interno').sort(porNome)
  const porArea = new Map()
  for (const p of (projetos || []).filter(p => p.tipo === 'interno')) {
    const rotulo = p.areaNome || 'Sem área'
    porArea.set(rotulo, [...(porArea.get(rotulo) || []), p])
  }
  const areas = [...porArea.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([rotulo, lista]) => ({
      rotulo,
      projetos: lista.sort((a, b) => Number(Boolean(b.geralDaArea)) - Number(Boolean(a.geralDaArea)) || porNome(a, b)),
    }))
  return [{ rotulo: 'Clientes', projetos: clientes }, ...areas].filter(g => g.projetos.length)
}
