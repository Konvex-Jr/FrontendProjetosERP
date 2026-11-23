import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import CascaConta from '../components/CascaConta'
import { useApp } from '../context/AppContext'
import alerts from '../lib/alerts'
import { corpoCompletarPerfil, erroCompletarPerfil, opcoesCurso } from '../lib/cadastroPessoa'
import { mascararIngresso, mascararTelefone, telefoneValido } from '../lib/pessoaContato'
import { request } from '../services/api'
import { CURSOS, minhaConta } from '../services/pessoas'

const AJUDA_AGENDA = 'Link público da sua agenda (Google Agenda, Calendly…), para marcarem reuniões com você.'

const ROTULOS = {
  curso: 'Curso',
  telefone: 'Telefone',
  emailPessoal: 'E-mail pessoal',
  ingresso: 'Ingresso na faculdade',
  calendarioUrl: 'Link da agenda',
}

// Curso fora dos 3 e telefone fora da regra (ex.: com +55) começam vazios: a pessoa escolhe e digita de novo,
// em vez de a máscara cortar o número antigo e gravar um telefone errado.
const valoresDe = u => ({
  curso: CURSOS.includes(u.curso) ? u.curso : '',
  telefone: u.telefone && telefoneValido(u.telefone) ? mascararTelefone(u.telefone) : '',
  emailPessoal: u.emailPessoal || '',
  ingresso: u.ingresso || '',
  calendarioUrl: u.calendarioUrl || '',
  linkedinUrl: u.linkedinUrl || '',
  githubUrl: u.githubUrl || '',
})

/** Primeiro acesso (ou dado obrigatório faltando): a pessoa completa o perfil antes de usar o sistema. */
export default function CompletarPerfil() {
  const { me, pendencias, setPendencias, sair, refresh } = useApp()
  const navigate = useNavigate()
  const [atual, setAtual] = useState(null)
  const [v, setV] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!me) return undefined
    let ativo = true
    request('/auth/me', { auth: true })
      .then(u => {
        if (!ativo) return
        setAtual(u)
        setV(valoresDe(u))
      })
      .catch(error => alerts.error('Não foi possível carregar seus dados', error.message))
    return () => {
      ativo = false
    }
  }, [me])

  if (!me) return <Navigate to="/login" replace />
  if (!pendencias.length) return <Navigate to="/" replace />

  const set = (k, valor) => setV(atualV => ({ ...atualV, [k]: valor }))

  const salvar = async event => {
    event.preventDefault()
    const erro = erroCompletarPerfil(v)
    if (erro) return alerts.error(erro.titulo, erro.texto)
    setSalvando(true)
    try {
      const gravada = await minhaConta.editarPerfil(corpoCompletarPerfil(v, atual))
      refresh().catch(() => {})
      const restantes = gravada?.pendenciasPerfil || []
      if (restantes.length) {
        alerts.error('Ainda faltam dados', `Preencha: ${restantes.map(k => ROTULOS[k] || k).join(', ')}.`)
        return
      }
      setPendencias([])
      navigate('/', { replace: true })
    } catch (error) {
      alerts.error('Não foi possível salvar', error.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <CascaConta>
      <form className="lgv-form" onSubmit={salvar} noValidate>
        <div>
          <h2>Complete seu perfil</h2>
          <small>Antes de começar, precisamos de alguns dados seus.</small>
        </div>
        {!v ? (
          <small role="status">Carregando…</small>
        ) : (
          <>
            <label>
              Curso
              <select className="form-select" value={v.curso} onChange={e => set('curso', e.target.value)}>
                {opcoesCurso(null).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Telefone
              <input
                className="form-control"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                value={v.telefone}
                onChange={e => set('telefone', mascararTelefone(e.target.value))}
              />
            </label>
            <label>
              E-mail pessoal
              <input
                className="form-control"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={v.emailPessoal}
                onChange={e => set('emailPessoal', e.target.value)}
              />
            </label>
            <label>
              Ingresso na faculdade
              <input
                className="form-control"
                inputMode="numeric"
                autoComplete="off"
                placeholder="AAAA/S"
                value={v.ingresso}
                onChange={e => set('ingresso', mascararIngresso(e.target.value))}
              />
              <small>Ex.: 2025/1 para o primeiro semestre de 2025.</small>
            </label>
            <label>
              Link da agenda
              <input
                className="form-control"
                type="url"
                autoComplete="off"
                value={v.calendarioUrl}
                onChange={e => set('calendarioUrl', e.target.value)}
              />
              <small>{AJUDA_AGENDA}</small>
            </label>
            <label>
              LinkedIn (opcional)
              <input className="form-control" type="url" value={v.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} />
            </label>
            <label>
              GitHub (opcional)
              <input className="form-control" type="url" value={v.githubUrl} onChange={e => set('githubUrl', e.target.value)} />
            </label>
            <button className="btn btn-dk w-100" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar e continuar'}
            </button>
          </>
        )}
        <button type="button" className="btn btn-g w-100" onClick={sair}>
          Sair
        </button>
      </form>
    </CascaConta>
  )
}
