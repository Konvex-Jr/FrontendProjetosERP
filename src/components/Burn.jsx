import { DAY, d, fm, hj, iso } from '../lib/utils'

/** Burndown das tarefas `T` (padrão: todas as do contexto). Ignora tarefas sem datas válidas. */
export default function Burn({ D, T: lista = D.t }) {
  const T = lista.filter(t => !isNaN(+d(t.inicio)) && !isNaN(+d(t.fim)))
  if (!T.length) return null
  // N >= 1: com todas as tarefas no mesmo dia, a divisão por zero gerava NaN no SVG.
  const n = T.length, a = Math.min(...T.map(t => +d(t.inicio))), z = Math.max(a + DAY, ...T.map(t => +d(t.fim))), N = Math.max(1, Math.round((z - a) / DAY)), W = 600, H = 210
  const X = i => 40 + i / N * (W - 60), Y = v => 10 + (1 - v / n) * (H - 40), pts = []
  for (let i = 0; i <= N && a + i * DAY <= +hj(D); i++) {
    const dt = a + i * DAY
    pts.push(X(i) + ',' + Y(n - T.filter(t => t.conclusao && +d(t.conclusao) <= dt).length))
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Burndown">
      <line x1="40" y1={Y(0)} x2={W - 20} y2={Y(0)} className="ax" /><line x1="40" y1="10" x2="40" y2={Y(0)} className="ax" />
      <text x="4" y="18" fontSize="11" className="mu">{n}</text><text x="28" y={Y(0) + 4} fontSize="11" className="mu">0</text>
      <line x1={X(0)} y1={Y(n)} x2={X(N)} y2={Y(0)} className="id" strokeDasharray="5 4" />
      <polyline points={pts.join(' ')} fill="none" className="rl" strokeWidth="3" strokeLinejoin="round" />
      <text x="40" y={H - 8} fontSize="11" className="mu">{fm(iso(new Date(a)))}</text>
      <text x={W - 50} y={H - 8} fontSize="11" className="mu">{fm(iso(new Date(z)))}</text>
      {/* Legenda embaixo, no centro: no alto ela ficava por cima da linha real. */}
      <text x={W / 2 - 90} y={H - 8} fontSize="12" className="tl">— Restante real</text>
      <text x={W / 2 + 20} y={H - 8} fontSize="12" className="mu">-- Ideal</text>
    </svg>
  )
}
