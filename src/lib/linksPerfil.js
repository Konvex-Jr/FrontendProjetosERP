/** Links do perfil (LinkedIn, GitHub, calendário) como cartões com logo, sem tocar em tela. */

const MAX_TEXTO = 40
// Só estes hosts, exatos, são do Google Agenda: "calendar.google.com.evil.io" cai no genérico.
const HOSTS_GOOGLE_AGENDA = ['calendar.google.com', 'calendar.app.google']

const hostDe = url => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** Link sem `https://`, sem `www.` e sem barra final, cortado em 40 caracteres com "…". */
const encurtar = url => {
  const texto = url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
  return texto.length > MAX_TEXTO ? texto.slice(0, MAX_TEXTO - 1) + '…' : texto
}

const tipoDoCalendario = url => (HOSTS_GOOGLE_AGENDA.includes(hostDe(url)) ? 'google-agenda' : 'calendario')

const ROTULOS = { linkedin: 'LinkedIn', github: 'GitHub', 'google-agenda': 'Google Agenda', calendario: 'Agenda' }

/**
 * Cartões dos links preenchidos da pessoa `u`, na ordem LinkedIn, GitHub, calendário:
 * `{ tipo, rotulo, url, texto }`. `tipo` escolhe o logo (LogosMarcas.jsx).
 */
export function cartoesDeLinks(u) {
  const links = [
    ['linkedin', u?.linkedinUrl],
    ['github', u?.githubUrl],
    [null, u?.calendarioUrl],
  ]
  return links
    .filter(([, url]) => typeof url === 'string' && url.trim())
    .map(([tipo, url]) => {
      const limpo = url.trim()
      const t = tipo || tipoDoCalendario(limpo)
      return { tipo: t, rotulo: ROTULOS[t], url: limpo, texto: encurtar(limpo) }
    })
}
