import { useApp } from '../context/AppContext'
import { chip, nid } from '../lib/utils'
import Ic from '../components/Icon'
import Table from '../components/Table'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'

export default function Usuarios() {
  const { D, up, form } = useApp()
  const edit = u => form(u ? 'Editar usuário' : 'Novo usuário',
    [{ k: 'nome', l: 'Nome' }, { k: 'email', l: 'E-mail', t: 'email' }, { k: 'senha', l: 'Senha inicial', t: 'password', s: () => !u }, { k: 'perfil', l: 'Perfil', o: D.c.perfis.map(p => [p, p]) }, { k: 'senioridade', l: 'Senioridade', o: Object.entries(D.c.senioridades), s: v => v.perfil == 'membro' }],
    u || { perfil: 'membro', senioridade: 'junior' },
    o => {
      const q = { ...o, senioridade: o.perfil == 'membro' ? o.senioridade || 'junior' : undefined }
      up('u', a => u ? a.map(x => x.id == u.id ? { ...x, ...q } : x) : [...a, { id: nid(a), ativo: true, ...q }])
    })
  const set = async (u, o) => {
    if (o.ativo === false && u.ativo) {
      const confirmed = await alerts.confirm({ title: 'Inativar usuário?', text: `${u.nome} perderá o acesso ao sistema.`, confirmText: 'Inativar', danger: true })
      if (!confirmed) return
    }
    if (o.ativo === true && !u.ativo) {
      await alerts.info('Reativação indisponível', 'A API atual não disponibiliza uma rota para reativar usuários inativos.')
      return
    }
    const changes = o.perfil === 'membro' && !u.senioridade ? { ...o, senioridade: 'junior' } : o
    up('u', a => a.map(x => x.id == u.id ? { ...x, ...changes } : x))
  }
  const cols = [
    { k: 'nome', l: 'Nome' },
    { k: 'email', l: 'E-mail' },
    { k: 'perfil', l: 'Perfil', filter: 1, render: u => <select className="form-select form-select-sm auto" aria-label={'Perfil de ' + u.nome} value={u.perfil} onChange={e => set(u, { perfil: e.target.value })}>{D.c.perfis.map(p => <option key={p}>{p}</option>)}</select> },
    { k: 'sn', l: 'Senioridade', filter: 1, get: u => u.perfil == 'membro' ? D.c.senioridades[u.senioridade] || '—' : '—', render: u => u.perfil == 'membro' ? <select className="form-select form-select-sm auto" aria-label={'Senioridade de ' + u.nome} value={u.senioridade || 'junior'} onChange={e => set(u, { senioridade: e.target.value })}>{Object.entries(D.c.senioridades).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select> : <small>—</small> },
    { k: 'st', l: 'Status', filter: 1, get: u => u.ativo ? 'Ativo' : 'Inativo', render: u => <span className={chip(u.ativo ? 'ok' : 'er')}>{u.ativo ? 'Ativo' : 'Inativo'}</span> },
    { l: 'Ações', render: u => <div className="d-flex gap-2"><button className="btn btn-g btn-sm" onClick={() => edit(u)}>Editar</button>{u.ativo && <button className="btn btn-g btn-sm" onClick={() => set(u, { ativo: false })}>Inativar</button>}</div> }
  ]
  return (
    <>
      <PageBar title="Usuários"><button className="btn btn-primary" onClick={() => edit()}><Ic k="plus" />Novo usuário</button></PageBar>
      <Table cols={cols} rows={D.u} />
    </>
  )
}
