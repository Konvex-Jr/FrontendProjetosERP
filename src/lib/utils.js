/**
 * Funções curtas usadas em muitas telas. Datas 'AAAA-MM-DD' são tratadas no fuso local.
 * `D` é o objeto de dados do contexto (useApp().D): u pessoas, p projetos, t tarefas, c configuração.
 */
/** Um dia em milissegundos. */
export const DAY = 864e5
/** 'AAAA-MM-DD' → Date à meia-noite local. Sem o 'T00:00' o JS leria em UTC e, no Brasil, cairia no dia anterior. */
export const d = s => new Date(s + 'T00:00')
/** Date (ou timestamp) → 'AAAA-MM-DD' no fuso local (toISOString usaria UTC). */
export const iso = x => {
  const t = new Date(x)
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0')
}
/** 'AAAA-MM-DD' → 'dd/mm' (forma curta, para cartões e prazos). */
export const fm = s => s.slice(8) + '/' + s.slice(5, 7)

/** Tipos de capacitação → rótulo. */
export const TIPO = { mecanica: 'Mecânica', computacao: 'Computação', eletrica: 'Elétrica' }
/** Prioridade da tarefa (P1 é a mais urgente) → classe de cor do chip. */
export const PC = { P1: 'er', P2: 'wa', P3: 'p3', P4: '' }
/** Status da tarefa → rótulo. */
export const ST = { pendente: 'Pendente', andamento: 'Em andamento', concluida: 'Concluída' }

/**
 * Chave, rótulo e caminho de cada tela. O menu que aparece vem da API (GET /auth/permissoes);
 * esta lista serve ao `path`, para traduzir a chave em caminho.
 */
export const NAV = [
  ['dashboard', 'Dashboard', '/'],
  ['tarefas', 'Tarefas', '/tarefas'],
  ['projetos', 'Projetos', '/projetos'],
  ['capacitacoes', 'Capacitações', '/capacitacoes'],
  ['conhecimento', 'Base de Inteligência', '/conhecimento'],
  ['iniciativas', 'Iniciativas', '/iniciativas'],
  ['estrategia', 'Visão Estratégica', '/estrategia'],
  ['gestao', 'Gestão', '/gestao'],
  ['precificacao', 'Simular precificação', '/precificacao'],
  ['usuarios', 'Pessoas', '/usuarios'],
  ['configuracoes', 'Configurações', '/configuracoes'],
  ['perfil', 'Meu perfil', '/perfil'],
]
/** Caminho da tela `n` para o `go(n, id)` do contexto. Telas com ficha usam o id: /projetos/:id, /perfil/:codigo etc. */
export const path = (n, pid) =>
  n === 'projeto'
    ? '/projetos/' + pid
    : n === 'perfil' && pid
      ? '/perfil/' + pid
      : (n === 'conhecimento' || n === 'iniciativas' || n === 'capacitacoes') && pid
        ? `/${n}/${pid}`
        : NAV.find(x => x[0] === n)?.[2] || '/'

/** Classes do chip (badge arredondado), com a cor opcional: ok, wa, er... */
export const chip = (c = '') => 'badge rounded-pill ' + c
/** Iniciais do nome, para o avatar (até 2 letras). */
export const ini = n =>
  n
    .split(' ')
    .map(x => x[0])
    .join('')
    .slice(0, 2)
/** Nome da pessoa pelo código, procurando em D.u ('—' se não achar). */
export const un = (D, id) => D.u.find(u => u.id == id)?.nome || '—'
/** Hoje como Date. Vem de D.c.hoje, que o AppContext atualiza quando o dia muda. */
export const hj = D => d(D.c.hoje)
/** Nomes de várias pessoas, separados por vírgula. */
export const nm = (D, ids) => (ids || []).map(i => un(D, i)).join(', ') || '—'
/**
 * Progresso do projeto: % das tarefas concluídas, pela contagem que a API manda em `tarefas`
 * ({ total, concluidas }, todas as tarefas do projeto). Assim membro e gestão veem o mesmo número;
 * D.t do membro só tem as tarefas dele. Sem contagem, conta as tarefas carregadas.
 */
export const prog = (D, p) => {
  const c = p.tarefas || D.p.find(x => x.id == p.id)?.tarefas
  if (c) return c.total ? Math.round((c.concluidas / c.total) * 100) : 0
  const t = D.t.filter(x => x.projetoId == p.id)
  return t.length ? Math.round((t.filter(x => x.status == 'concluida').length / t.length) * 100) : 0
}
/** Número → 'R$ 1.234,56'. */
export const brl = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
/** Tamanho em bytes → texto curto (B, KB, MB). */
export const sz = n => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB')
// Data vinda da API (ISO, meia-noite UTC) para dd/mm/aaaa.
export const fd = s => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—')
