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
    const chave = p.areaId ?? ''
    const g = porArea.get(chave) || { rotulo: p.areaNome || 'Sem área', lista: [] }
    g.lista.push(p)
    porArea.set(chave, g)
  }
  const areas = [...porArea.values()]
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
    .map(({ rotulo, lista }) => ({
      rotulo,
      projetos: lista.sort((a, b) => Number(Boolean(b.geralDaArea)) - Number(Boolean(a.geralDaArea)) || porNome(a, b)),
    }))
  return [{ rotulo: 'Clientes', projetos: clientes }, ...areas].filter(g => g.projetos.length)
}

export const TIPOS_PROJETO = [
  ['cliente', 'Cliente'],
  ['interno', 'Interno'],
]

/** Opções do filtro "Tipo" das telas de projetos. */
export const FILTRO_TIPO = [
  ['', 'Todos'],
  ['cliente', 'Clientes'],
  ['interno', 'Internos'],
]

/** Projeto da API (aninhado `area`) com `areaId` e `areaNome`, o formato que `filtrarProjetos` lê. */
export const comArea = p => ({ ...p, tipo: p.tipo || 'cliente', areaId: p.area?.codigo ?? null, areaNome: p.area?.nome ?? null })

/** Áreas que aparecem nos projetos da lista, em ordem alfabética (opções do filtro "Área"). */
export function areasDosProjetos(projetos) {
  const porCodigo = new Map()
  for (const p of projetos || []) if (p.areaId != null) porCodigo.set(p.areaId, p.areaNome || 'Área')
  return [...porCodigo].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
}

/** Aviso do formulário do projeto antes de enviar; vazio = pode enviar. */
export const erroDoFormularioProjeto = v => (v?.tipo === 'interno' && !v.codigoArea ? 'Escolha a área do projeto interno.' : '')

/** O texto da aba Equipe do projeto geral da área. */
export const TEXTO_EQUIPE_GERAL = 'A equipe é quem está na área (Pessoas › Áreas e cargos).'
