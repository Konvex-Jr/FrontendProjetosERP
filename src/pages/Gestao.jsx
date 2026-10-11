import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { fm, nid, sz, un } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'

export default function Gestao() {
  const { D, up, form, me } = useApp()
  const [pid, setPid] = useState(null), pa = D.g.find(x => x.id == pid), cnt = id => D.d.filter(x => x.pastaId == id).length

  const nova = f => form(f ? 'Renomear pasta' : 'Nova pasta', [{ k: 'nome', l: 'Nome da pasta' }], f ? { nome: f.nome } : {}, o => up('g', a => f ? a.map(x => x.id == f.id ? { ...x, nome: o.nome } : x) : [...a, { id: nid(a), ...o }]))
  const delP = async folder => {
    const confirmed = await alerts.confirm({ title: 'Excluir pasta?', text: `A pasta e seus ${cnt(folder.id)} documento(s) serão excluídos.`, confirmText: 'Excluir pasta', danger: true })
    if (confirmed) up('g', folders => folders.filter(item => item.id != folder.id))
  }
  const add = () => form('Adicionar documento por URL', [
    { k: 'nome', l: 'Nome do documento' },
    { k: 'url', l: 'URL do arquivo', t: 'url' },
    { k: 'tam', l: 'Tamanho em bytes', t: 'number' },
  ], { tam: 0 }, value => {
    const ext = value.nome.includes('.') ? value.nome.split('.').pop().toUpperCase().slice(0, 5) : '—'
    up('d', documents => [...documents, { id: nid(documents), pastaId: pid, nome: value.nome, url: value.url, tam: Number(value.tam || 0), ext, data: D.c.hoje, autor: un(D, me), autorId: me }])
  })
  const ren = x => form('Renomear documento', [{ k: 'nome', l: 'Nome' }], { nome: x.nome }, o => up('d', a => a.map(y => y.id == x.id ? { ...y, nome: o.nome } : y)))
  const bx = x => window.open(x.url, '_blank', 'noopener,noreferrer')
  const delD = async document => {
    const confirmed = await alerts.confirm({ title: 'Excluir documento?', text: document.nome, confirmText: 'Excluir documento', danger: true })
    if (confirmed) up('d', documents => documents.filter(item => item.id != document.id))
  }

  if (!pa) return (
    <>
      <PageBar title="Gestão" sub="Documentos da empresa, organizados por pasta."><button className="btn btn-primary" onClick={() => nova()}><Ic k="plus" />Nova pasta</button></PageBar>
      <div className="row g-3">
        {D.g.map(f => (
          <div className="col-sm-6 col-xl-4" key={f.id}>
            <div className="fc" onClick={() => setPid(f.id)}>
              <span className="fi"><Ic k="gestao" /></span>
              <div><b>{f.nome}</b><small>{cnt(f.id)} documento{cnt(f.id) == 1 ? '' : 's'}</small></div>
              <ActionMenu items={[['open', 'Abrir', () => setPid(f.id)], ['edit', 'Renomear', () => nova(f)], ['trash', 'Excluir', () => delP(f), 1]]} />
            </div>
          </div>
        ))}
      </div>
      {!D.g.length && <div className="card card-body">Nenhuma pasta ainda. Use “Nova pasta”.</div>}
    </>
  )

  const L = D.d.filter(x => x.pastaId == pid)
  const cols = [
    { k: 'nome', l: 'Documento', render: x => <span className="fn"><Ic k="file" />{x.nome}</span> },
    { k: 'ext', l: 'Tipo', filter: 1 },
    { k: 'tam', l: 'Tamanho', render: x => sz(x.tam) },
    { k: 'autor', l: 'Enviado por', filter: 1 },
    { k: 'data', l: 'Data', render: x => fm(x.data) },
    { l: 'Ações', render: x => <ActionMenu items={[['download', 'Baixar', () => bx(x)], ['edit', 'Renomear', () => ren(x)], ['trash', 'Excluir', () => delD(x), 1]]} /> }
  ]
  return (
    <div className={'dw' + (ov ? ' on' : '')} onDragOver={e => { e.preventDefault(); setOv(true) }} onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setOv(false)} onDrop={e => { e.preventDefault(); setOv(false); add(e.dataTransfer.files) }}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="d-flex align-items-center gap-2"><button className="btn btn-g" onClick={() => setPid(null)}><Ic k="back" />Voltar</button><h1>{pa.nome}</h1></div>
        <button className="btn btn-primary" onClick={add}><Ic k="plus" />Adicionar documento por URL</button>
      </div>
      {L.length ? <Table cols={cols} rows={L} /> : <div className="dz"><Ic k="upload" /><b>Nenhum documento nesta pasta</b><small>Cadastre o nome e a URL do arquivo. O backend armazena metadados e não recebe upload binário.</small></div>}
    </div>
  )
}
