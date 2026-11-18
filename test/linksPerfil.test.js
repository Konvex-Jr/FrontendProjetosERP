import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cartoesDeLinks } from '../src/lib/linksPerfil.js'

test('cartoesDeLinks só traz os links preenchidos', () => {
  const cartoes = cartoesDeLinks({ githubUrl: 'https://github.com/ana', linkedinUrl: '', calendarioUrl: null })
  assert.equal(cartoes.length, 1)
  assert.deepEqual(cartoes[0], { tipo: 'github', rotulo: 'GitHub', url: 'https://github.com/ana', texto: 'github.com/ana' })
  assert.deepEqual(cartoesDeLinks({}), [])
  assert.deepEqual(cartoesDeLinks(null), [])
})

test('cartoesDeLinks segue a ordem LinkedIn, GitHub, calendário', () => {
  const cartoes = cartoesDeLinks({
    calendarioUrl: 'https://calendly.com/ana',
    githubUrl: 'https://github.com/ana',
    linkedinUrl: 'https://linkedin.com/in/ana',
  })
  assert.deepEqual(
    cartoes.map(c => c.tipo),
    ['linkedin', 'github', 'calendario'],
  )
})

test('cartoesDeLinks reconhece o Google Agenda pelos dois endereços', () => {
  for (const url of ['https://calendar.google.com/calendar/u/0?cid=x', 'https://calendar.app.google/abc']) {
    const [c] = cartoesDeLinks({ calendarioUrl: url })
    assert.equal(c.tipo, 'google-agenda', url)
    assert.equal(c.rotulo, 'Google Agenda')
  }
})

test('cartoesDeLinks usa o calendário genérico para outros serviços e hosts parecidos', () => {
  const [calendly] = cartoesDeLinks({ calendarioUrl: 'https://calendly.com/ana' })
  assert.equal(calendly.tipo, 'calendario')
  assert.equal(calendly.rotulo, 'Agenda')
  for (const url of ['https://calendar.google.com.evil.io/x', 'https://evilcalendar.google.com.br/', 'https://nao-e-link.com']) {
    assert.equal(cartoesDeLinks({ calendarioUrl: url })[0].tipo, 'calendario', url)
  }
})

test('cartoesDeLinks encurta o texto: sem protocolo, sem www, sem barra final, até 40 caracteres', () => {
  assert.equal(cartoesDeLinks({ linkedinUrl: 'https://www.linkedin.com/in/ana/' })[0].texto, 'linkedin.com/in/ana')
  const longo = cartoesDeLinks({ githubUrl: 'https://github.com/' + 'a'.repeat(60) })[0].texto
  assert.equal(longo.length, 40)
  assert.ok(longo.endsWith('…'))
  assert.ok(longo.startsWith('github.com/aaa'))
})

test('cartoesDeLinks descarta o que não for http(s)', () => {
  assert.deepEqual(cartoesDeLinks({ githubUrl: 'javascript:alert(1)', linkedinUrl: ' data:text/html,x', calendarioUrl: 'nao é link' }), [])
})
