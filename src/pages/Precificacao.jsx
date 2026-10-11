import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { brl, chip } from '../lib/utils'
import Multi from '../components/Multi'
import { PageBar } from '../components/Ui'

export default function Precificacao() {
  const { D } = useApp()
  const S = D.c.senioridades, ms = D.u.filter(u => u.ativo && u.perfil == 'membro')
  const [sel, setSel] = useState(ms.slice(0, 3).map(u => u.id)), [hs, setHs] = useState({}), [vh, setVh] = useState(D.c.valorHora), [mg, setMg] = useState(30), [imp, setImp] = useState(10)
  const hr = id => hs[id] ?? 40, rate = u => +vh[u.senioridade || 'junior'] || 0, k = (1 + mg / 100) / (1 - Math.min(imp, 99) / 100)
  const L = sel.map(id => D.u.find(u => u.id == id)).filter(Boolean)
  const horas = L.reduce((s, u) => s + hr(u.id), 0), custo = L.reduce((s, u) => s + hr(u.id) * rate(u), 0), base = custo * (1 + mg / 100), preco = custo * k
  const num = (f, max) => e => f(Math.min(max ?? 1e9, Math.max(0, +e.target.value)))
  return (
    <>
      <PageBar title="Simular precificação" sub="Escolha a equipe, defina as horas e veja o valor hora de cada membro por senioridade." />
      <div className="row g-3">
        <div className="col-lg-8"><div className="card card-body">
          <div className="form-label">Membros da proposta</div>
          <Multi opts={ms} value={sel} onChange={setSel} />
          {L.length ? (
            <div className="tw mt-3">
              <table className="table align-middle">
                <thead><tr>{['Membro', 'Senioridade', 'Valor hora (custo)', 'Valor hora (venda)', 'Horas', 'Subtotal (venda)'].map(h => <th key={h} className="n">{h}</th>)}</tr></thead>
                <tbody>{L.map(u => (
                  <tr key={u.id}>
                    <td>{u.nome}</td><td><span className={chip()}>{S[u.senioridade || 'junior']}</span></td>
                    <td>{brl(rate(u))}</td><td>{brl(rate(u) * k)}</td>
                    <td><input className="form-control" type="number" min="0" aria-label={'Horas de ' + u.nome} value={hr(u.id)} onChange={num(n => setHs(o => ({ ...o, [u.id]: n })))} /></td>
                    <td><b>{brl(hr(u.id) * rate(u) * k)}</b></td>
                  </tr>))}
                </tbody>
                <tfoot><tr><td colSpan="4"><b>Total</b></td><td><b>{horas} h</b></td><td><b>{brl(preco)}</b></td></tr></tfoot>
              </table>
            </div>
          ) : <p className="mt-3 mb-0"><small>Selecione ao menos um membro para simular.</small></p>}
        </div></div>

        <div className="col-lg-4 d-flex flex-column gap-3">
          <div className="card card-body">
            <h2>Parâmetros</h2>
            {Object.entries(S).map(([key, l]) => (
              <label className="form-label w-100 mb-3" key={key}>Valor hora {l} (R$)<input className="form-control mt-1" type="number" min="0" value={vh[key]} onChange={num(n => setVh(o => ({ ...o, [key]: n })))} /></label>
            ))}
            <label className="form-label w-100 mb-3">Margem (%)<input className="form-control mt-1" type="number" min="0" value={mg} onChange={num(setMg)} /></label>
            <label className="form-label w-100 m-0">Impostos (%)<input className="form-control mt-1" type="number" min="0" max="99" value={imp} onChange={num(setImp, 99)} /></label>
          </div>
          <div className="card card-body">
            <h2>Resultado</h2>
            <div className="pl"><span>Horas totais</span><b>{horas} h</b></div>
            <div className="pl"><span>Custo da equipe</span><b>{brl(custo)}</b></div>
            <div className="pl"><span>Margem ({mg}%)</span><b>{brl(base - custo)}</b></div>
            <div className="pl"><span>Impostos ({imp}%)</span><b>{brl(preco - base)}</b></div>
            <div className="pv mt-3 mb-1"><small>Preço final da proposta</small><b>{brl(preco)}</b></div>
            <small>Valor hora médio de venda: {brl(horas ? preco / horas : 0)}</small>
          </div>
        </div>
      </div>
    </>
  )
}
