import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { chip, fd } from '../lib/utils'
import Clipe from '../components/Clipe'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import Markdown from '../components/Markdown'
import Anexos from '../components/Anexos'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { abrirCom, consumir } from '../lib/atalho'
import { ACEITA, DICA, enviarVarios } from '../services/anexos'
import {
  SIGILOS,
  avisoFalhasItem,
  biblioteca,
  dadosBiblioteca,
  problemaBiblioteca,
  sigilosPermitidos,
  valoresBiblioteca,
} from '../services/biblioteca'

/**
 * Biblioteca (sessão 17): substitui Gestão (pastas e documentos), Base de Inteligência e Iniciativas.
 * Item com título, texto e/ou links, anexos, tags, projeto opcional e sigilo. Quem vê o quê é a API
 * que decide (item invisível nem vem); autor ou gestão editam e excluem (`podeAlterar`).
 */

// Filtros ficam na memória ao abrir a ficha e voltar (recarregar a página zera).
// Filtros lembrados por pessoa logada (não vazam entre contas na mesma aba).
const ultimosFiltros = {}

const MARKDOWN = 'Aceita Markdown simples: ## título, - lista, **negrito**, *itálico* e [texto](https://...).'
const GERIR = 'biblioteca.gerir'
const rotuloSigilo = valor => SIGILOS.find(s => s.valor === valor)?.rotulo || valor
const comId = lista => lista.map(x => ({ ...x, id: x.codigo }))

/**
 * Formulário de item, usado na Biblioteca e na aba do projeto. `projetos` é a lista de projetos que a pessoa
 * já recebe (DF.p, igual a GET /projetos); `inicial` preenche um item novo (ex.: o projeto da aba).
 */
export function abrirFormBiblioteca({ form, projetos, gestor, item, inicial, aoSalvar }) {
  // Projeto em cartão (a pessoa não vê os detalhes) não aceita item: a API responde 403.
  const opcoesProjetos = (projetos || []).filter(p => !p.cartao)
  // Projeto já ligado que não está na lista continua selecionável (para não sumir ao salvar).
  if (item?.projeto && !opcoesProjetos.some(p => p.id === item.projeto.codigo))
    opcoesProjetos.push({ id: item.projeto.codigo, nome: item.projeto.nome })
  const sigilos = [...sigilosPermitidos(gestor)]
  if (item && !sigilos.some(s => s.valor === item.sigilo)) sigilos.push(SIGILOS.find(s => s.valor === item.sigilo))
  form(
    item ? 'Editar item' : 'Novo item na Biblioteca',
    [
      { k: 'titulo', l: 'Título', h: 'Até 160 caracteres.' },
      {
        k: 'codigoProjeto',
        l: 'Projeto',
        o: [['', 'Nenhum'], ...opcoesProjetos.map(p => [p.id, p.nome]).sort((a, b) => a[1].localeCompare(b[1]))],
      },
      {
        k: 'sigilo',
        l: 'Quem vê',
        o: sigilos.filter(Boolean).map(s => [s.valor, s.rotulo]),
        h: '“Equipe do projeto” precisa de um projeto: vê quem participa ou participou dele, e a gestão.',
      },
      { k: 'conteudo', l: 'Texto', t: 'textarea', rows: 8, opt: 1, h: MARKDOWN },
      { k: 'links', l: 'Links', t: 'textarea', rows: 2, opt: 1, h: 'Um por linha.' },
      { k: 'tags', l: 'Tags', opt: 1, h: 'Separadas por vírgula. Ex.: delivery, mercado' },
      { k: 'arquivos', l: item ? 'Anexar mais arquivos' : 'Arquivos', t: 'file', multiple: true, accept: ACEITA, opt: 1, h: DICA },
    ],
    valoresBiblioteca(item, inicial),
    async v => {
      const problema = problemaBiblioteca(v, item)
      if (problema) {
        await alerts.error('Não foi possível salvar o item', problema)
        return false
      }
      let salvo
      try {
        // O original vai junto: projeto inalterado não é enviado (um projeto oculto não é desligado).
        salvo = item ? await biblioteca.editar(item.codigo, dadosBiblioteca(v), item) : await biblioteca.criar(dadosBiblioteca(v))
      } catch (error) {
        await alerts.error('Não foi possível salvar o item', error.message)
        throw error
      }
      // O item fica salvo mesmo se um arquivo falhar; a pessoa sabe qual e pode anexar de novo na ficha.
      const { falhas } = await enviarVarios('biblioteca', salvo.codigo, v.arquivos)
      if (falhas.length) {
        const { titulo, texto } = avisoFalhasItem(falhas, Boolean(item))
        await alerts.error(titulo, texto)
      } else alerts.toastSuccess(item ? 'Item atualizado' : 'Item registrado na Biblioteca')
      await aoSalvar?.(salvo)
    },
    { largo: true },
  )
}

async function excluirItem(item, depois) {
  const ok = await alerts.confirm({ title: 'Excluir item?', text: item.titulo, confirmText: 'Excluir item', danger: true })
  if (!ok) return
  try {
    await biblioteca.excluir(item.codigo)
    alerts.toastSuccess('Item excluído')
    await depois()
  } catch (error) {
    alerts.error('Não foi possível excluir o item', error.message)
  }
}

const opcoes = lista => [...new Map(lista.map(x => [x.codigo, x.nome])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
const resumo = texto => {
  const linha = String(texto || '')
    .split('\n')
    .map(l => l.replace(/^[#>\-*\s]+/, '').trim())
    .find(Boolean)
  return linha && linha.length > 140 ? linha.slice(0, 140) + '…' : linha || ''
}

/** Título clicável que abre a ficha, usado na lista e na aba do projeto. */
function TituloItem({ x }) {
  const { go } = useApp()
  return (
    <a
      className="kc-t"
      href={`#/biblioteca/${x.codigo}`}
      onClick={e => {
        e.preventDefault()
        go('biblioteca', x.codigo)
      }}
    >
      <b>{x.titulo}</b>
      <small className="d-block">{resumo(x.conteudo) || (x.links.length ? x.links[0] : '')}</small>
      <Clipe n={x.anexos.length} />
    </a>
  )
}

/**
 * Chave e busca da lista completa (sem filtro), que monta as opções dos selects. O menu
 * (src/lib/antecipar.js) usa as mesmas para buscar antes do clique.
 */
export function dadosDaTela() {
  return { chave: 'biblioteca:todos', carregar: () => biblioteca.listar() }
}

/** /biblioteca mostra a lista; /biblioteca/:id, a ficha do item. */
export default function Biblioteca() {
  const { id } = useParams()
  return id ? <Ficha id={id} /> : <Lista />
}

function Lista() {
  const { DF, form, go, me, pode } = useApp()
  const gestor = pode(GERIR)
  const [f, setF] = useState(() => ({ ...ultimosFiltros[me], ...(consumir('biblioteca') || {}) }))
  const [texto, setTexto] = useState(f.q || '')
  useEffect(() => {
    ultimosFiltros[me] = f
  }, [f, me])
  useEffect(() => {
    const t = setTimeout(() => setF(o => ((o.q || '') === texto.trim() ? o : { ...o, q: texto.trim() })), 300)
    return () => clearTimeout(t)
  }, [texto])

  const ativos = Object.values(f).some(Boolean)
  // Duas cargas: `todos` (sem filtro) monta as opções dos selects; `filtrados` vem da API só quando há filtro.
  const telaTodos = dadosDaTela()
  const todos = useCarregar(telaTodos.carregar, [], { chave: telaTodos.chave })
  const chave = JSON.stringify(f)
  const filtrados = useCarregar(() => (ativos ? biblioteca.listar(f) : Promise.resolve(null)), [chave])
  const T = useMemo(() => todos.dados || [], [todos.dados])
  const lista = ativos ? filtrados.dados || [] : T
  const carregando = todos.carregando || (ativos && filtrados.carregando)
  const recarregar = async () => {
    await todos.recarregar()
    if (ativos) await filtrados.recarregar()
  }

  // Opções dos filtros a partir do que a pessoa já vê na Biblioteca.
  const projetos = useMemo(() => opcoes(T.filter(i => i.projeto).map(i => i.projeto)), [T])
  const tags = useMemo(() => [...new Set(T.flatMap(i => i.tags))].sort(), [T])
  const sigilos = sigilosPermitidos(gestor)

  const abrirForm = item => abrirFormBiblioteca({ form, projetos: DF?.p, gestor, item, aoSalvar: recarregar })
  const set = k => e => setF(o => ({ ...o, [k]: e.target.value }))
  const sel = (k, rotulo, todas, itens) => (
    <select
      className="form-select w-auto"
      style={{ maxWidth: 220 }}
      aria-label={'Filtrar por ' + rotulo.toLowerCase()}
      value={f[k] || ''}
      onChange={set(k)}
    >
      <option value="">
        {rotulo}: {todas ? 'todas' : 'todos'}
      </option>
      {itens.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
  const limpar = () => {
    setTexto('')
    setF({})
  }

  const cols = [
    { k: 'titulo', l: 'Item', render: x => <TituloItem x={x} /> },
    { k: 'projetoNome', l: 'Projeto', get: x => x.projeto?.nome || '—' },
    {
      k: 'sigilo',
      l: 'Quem vê',
      get: x => rotuloSigilo(x.sigilo),
      render: x => <span className={chip('')}>{rotuloSigilo(x.sigilo)}</span>,
    },
    { k: 'autorNome', l: 'Autor', get: x => x.autor?.nome || '—' },
    { k: 'atualizadoEm', l: 'Atualizado', render: x => fd(x.atualizadoEm) },
    {
      k: 'tagsTexto',
      l: 'Tags',
      get: x => x.tags.join(' '),
      render: x =>
        x.tags.length ? (
          <span className="kc-tags">
            {x.tags.map(t => (
              <span key={t} className={chip('')}>
                #{t}
              </span>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
    {
      l: 'Ações',
      render: x => (
        <ActionMenu
          items={[
            ['open', 'Abrir', () => go('biblioteca', x.codigo)],
            ...(x.podeAlterar
              ? [
                  ['edit', 'Editar', () => abrirForm(x)],
                  ['trash', 'Excluir', () => excluirItem(x, recarregar), 1],
                ]
              : []),
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageBar title="Biblioteca" sub="Documentos, pesquisas, decisões e aprendizados da Konvex, com projeto e sigilo.">
        <button className="btn btn-primary" onClick={() => abrirForm()}>
          <Ic k="plus" />
          Novo item
        </button>
      </PageBar>
      <div className="fl d-flex flex-wrap gap-2 mb-2">
        <input
          className="form-control w-auto flex-grow-1"
          style={{ maxWidth: 320 }}
          placeholder="Buscar no título, texto e tags…"
          aria-label="Buscar na Biblioteca"
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        {sel(
          'tag',
          'Tag',
          true,
          tags.map(t => [t, '#' + t]),
        )}
        {sel('projeto', 'Projeto', false, projetos)}
        {sel(
          'sigilo',
          'Quem vê',
          false,
          sigilos.map(s => [s.valor, s.rotulo]),
        )}
        {ativos && (
          <button className="btn btn-g" onClick={limpar}>
            Limpar filtros
          </button>
        )}
      </div>
      {carregando && !lista.length ? (
        <Esqueleto />
      ) : (
        <Table
          busca={false}
          cols={cols}
          rows={comId(lista)}
          vazio={
            ativos
              ? 'Nada encontrado. Ajuste a busca ou os filtros.'
              : 'Nada registrado ainda. Use “Novo item” para guardar um documento, uma pesquisa ou um aprendizado.'
          }
        />
      )}
    </>
  )
}

function Ficha({ id }) {
  const { DF, form, go, pode } = useApp()
  const { dados: item, carregando, recarregar } = useCarregar(() => biblioteca.obter(id), [id], { chave: `biblioteca:item:${id}` })
  const voltar = (
    <button className="btn btn-g" onClick={() => go('biblioteca')}>
      <Ic k="back" />
      Voltar
    </button>
  )
  if (!item)
    return (
      <>
        <PageBar title="Biblioteca" sub={carregando ? '' : 'Item não encontrado. Ele pode ter sido excluído.'}>
          {voltar}
        </PageBar>
        {carregando && <Esqueleto />}
      </>
    )

  const visiveis = new Set((DF?.p || []).map(p => p.id))
  const porTag = t => {
    abrirCom('biblioteca', { tag: t })
    go('biblioteca')
  }
  const editar = () => abrirFormBiblioteca({ form, projetos: DF?.p, gestor: pode(GERIR), item, aoSalvar: recarregar })

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="cab d-flex align-items-center gap-2">
          {voltar}
          <h1>{item.titulo}</h1>
          <span className={chip('')}>{rotuloSigilo(item.sigilo)}</span>
        </div>
        {item.podeAlterar && (
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-g" onClick={editar}>
              <Ic k="edit" />
              Editar
            </button>
            <button className="btn btn-g" onClick={() => excluirItem(item, () => go('biblioteca'))}>
              <Ic k="trash" />
              Excluir
            </button>
          </div>
        )}
      </div>
      <div className="card card-body kc">
        <div className="kc-m">
          <span>
            <Ic k="perfil" />
            {item.autor?.nome || '—'}
          </span>
          <span>
            <Ic k="clock" />
            Atualizado em {fd(item.atualizadoEm)}
          </span>
          {item.projeto && (
            <span>
              <Ic k="projetos" />
              {visiveis.has(item.projeto.codigo) ? (
                <button type="button" className={chip('kc-tag')} onClick={() => go('projeto', item.projeto.codigo)}>
                  {item.projeto.nome}
                </button>
              ) : (
                item.projeto.nome
              )}
            </span>
          )}
        </div>
        {!!item.tags.length && (
          <div className="kc-tags">
            {item.tags.map(t => (
              <button key={t} type="button" className={chip('kc-tag')} onClick={() => porTag(t)} title="Ver itens com esta tag">
                #{t}
              </button>
            ))}
          </div>
        )}
        {!!item.links.length && (
          <div className="kc-s">
            <h3 className="h6 fw-bold">Links</h3>
            <ul className="kc-l">
              {item.links.map(l => (
                <li key={l}>
                  <a href={l} target="_blank" rel="noopener noreferrer">
                    <Ic k="link" />
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(item.anexos.length > 0 || item.podeAlterar) && (
          <div className="kc-s">
            <h3 className="h6 fw-bold">Anexos</h3>
            <Anexos dono="biblioteca" codigo={item.codigo} lista={item.anexos} podeAlterar={item.podeAlterar} aoMudar={recarregar} />
          </div>
        )}
        {item.conteudo.trim() && (
          <div className="kc-s">
            <h3 className="h6 fw-bold">Texto</h3>
            <Markdown texto={item.conteudo} />
          </div>
        )}
      </div>
    </>
  )
}

/** Aba "Biblioteca" da ficha do projeto: itens ligados a ele que a pessoa vê (a API filtra pelo sigilo). */
export function ItensDoProjeto({ projeto }) {
  const { DF, form, go, pode } = useApp()
  const { dados, carregando, recarregar } = useCarregar(() => biblioteca.listar({ projeto: projeto.codigo }), [projeto.codigo], {
    chave: `biblioteca:projeto:${projeto.codigo}`,
  })
  const L = dados || []
  // O próprio projeto entra nas opções mesmo se não estiver em DF.p.
  const projetos = [...(DF?.p || []).filter(p => p.id !== projeto.codigo), { id: projeto.codigo, nome: projeto.nome }]
  const novo = () =>
    abrirFormBiblioteca({ form, projetos, gestor: pode(GERIR), inicial: { codigoProjeto: projeto.codigo }, aoSalvar: recarregar })
  const cols = [
    { k: 'titulo', l: 'Item', render: x => <TituloItem x={x} /> },
    { k: 'sigilo', l: 'Quem vê', get: x => rotuloSigilo(x.sigilo) },
    { k: 'autorNome', l: 'Autor', get: x => x.autor?.nome || '—' },
    { k: 'atualizadoEm', l: 'Atualizado', render: x => fd(x.atualizadoEm) },
    { l: 'Ações', render: x => <ActionMenu items={[['open', 'Abrir', () => go('biblioteca', x.codigo)]]} /> },
  ]
  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <small>Documentos, decisões e aprendizados ligados a este projeto.</small>
        <button className="btn btn-primary" onClick={novo}>
          <Ic k="plus" />
          Novo item
        </button>
      </div>
      {carregando && !L.length ? (
        <Esqueleto />
      ) : (
        <Table
          cols={cols}
          rows={comId(L)}
          vazio="Nenhum item ligado a este projeto. Use “Novo item” para guardar um documento, uma decisão ou um aprendizado."
        />
      )}
    </>
  )
}
