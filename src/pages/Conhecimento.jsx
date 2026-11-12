import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { chip, fd } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import Markdown from '../components/Markdown'
import Anexos from '../components/Anexos'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import { abrirCom, consumir } from '../lib/atalho'
import { PERIODOS, conhecimento, inicioDoPeriodo, rotuloCategoria, valoresConhecimento } from '../services/conhecimento'

/**
 * Base de Inteligência (sessão 12a, RF-080 a RF-084). Todos leem e cadastram;
 * autor ou gestão editam e excluem (a API diz em `podeAlterar`). Busca e filtros vão para a API.
 */

// Filtros ficam na memória ao abrir a ficha e voltar (recarregar a página zera).
let ultimosFiltros = {}

const MARKDOWN = 'Aceita Markdown simples: ## título, - lista, **negrito**, *itálico* e [texto](https://...).'

/** Formulário de item, usado na Base e na aba do projeto. `inicial` preenche um item novo (ex.: o projeto). */
export function abrirFormConhecimento({ form, categorias, projetos, item, inicial, aoSalvar }) {
  const opcoesProjetos = [...(projetos || [])]
  // Projetos já ligados que a pessoa não vê na lista continuam selecionáveis (para não sumirem ao salvar).
  ;(item?.projetos || []).forEach(p => !opcoesProjetos.some(x => x.id === p.id) && opcoesProjetos.push(p))
  form(
    item ? 'Editar item' : 'Novo item na Base',
    [
      { k: 'titulo', l: 'Título' },
      { k: 'categoria', l: 'Categoria', o: (categorias || []).map(c => [c.valor, c.rotulo]) },
      { k: 'resumo', l: 'Resumo', t: 'textarea', rows: 2, h: 'Uma ou duas frases. Aparece na lista e entra na busca.' },
      { k: 'conteudo', l: 'Conteúdo completo', t: 'textarea', rows: 8, opt: 1, h: MARKDOWN },
      { k: 'fonte', l: 'Fonte', opt: 1, h: 'De onde veio: site, livro, entrevista, reunião…' },
      { k: 'links', l: 'Links', t: 'textarea', rows: 2, opt: 1, h: 'Um por linha.' },
      { k: 'tags', l: 'Tags', opt: 1, h: 'Separadas por vírgula. Ex.: delivery, mercado' },
      { k: 'data', l: 'Data', t: 'date' },
      { k: 'projetos', l: 'Projetos relacionados', c: opcoesProjetos.map(p => ({ id: p.id, nome: p.nome, perfil: '' })) },
    ],
    valoresConhecimento(item, inicial),
    async v => {
      try {
        const salvo = await conhecimento.salvar(v, item?.id)
        alerts.toastSuccess(item ? 'Item atualizado' : 'Item registrado na Base')
        await aoSalvar?.(salvo)
      } catch (error) {
        await alerts.error('Não foi possível salvar o item', error.message)
        throw error
      }
    },
    { largo: true },
  )
}

async function excluirItem(item, depois) {
  const ok = await alerts.confirm({ title: 'Excluir item?', text: item.titulo, confirmText: 'Excluir item', danger: true })
  if (!ok) return
  try {
    await conhecimento.excluir(item.id)
    alerts.toastSuccess('Item excluído')
    await depois()
  } catch (error) {
    alerts.error('Não foi possível excluir o item', error.message)
  }
}

const useCategorias = () => useCarregar(conhecimento.categorias, []).dados || []
const opcoes = lista => [...new Map(lista.map(x => [x.id, x.nome])).entries()].sort((a, b) => a[1].localeCompare(b[1]))

/** /conhecimento mostra a lista; /conhecimento/:id, a ficha do item. */
export default function Conhecimento() {
  const { id } = useParams()
  return id ? <Ficha id={id} /> : <Lista />
}

function Lista() {
  const { D, form, go } = useApp()
  const categorias = useCategorias()
  const [f, setF] = useState(() => ({ ...ultimosFiltros, ...(consumir('conhecimento') || {}) }))
  const [texto, setTexto] = useState(f.busca || '')
  useEffect(() => {
    ultimosFiltros = f
  }, [f])
  useEffect(() => {
    const t = setTimeout(() => setF(o => ((o.busca || '') === texto.trim() ? o : { ...o, busca: texto.trim() })), 300)
    return () => clearTimeout(t)
  }, [texto])

  const ativos = Object.values(f).some(Boolean)
  // Duas cargas: `todos` (sem filtro) monta as opções dos selects; `filtrados` vem da API só quando há filtro.
  const todos = useCarregar(() => conhecimento.listar(), [])
  const chave = JSON.stringify(f)
  const filtrados = useCarregar(
    () => (ativos ? conhecimento.listar({ ...f, de: inicioDoPeriodo(f.periodo) }) : Promise.resolve(null)),
    [chave],
  )
  const T = todos.dados || []
  const lista = ativos ? filtrados.dados || [] : T
  const carregando = todos.carregando || (ativos && filtrados.carregando)
  const recarregar = async () => {
    await todos.recarregar()
    if (ativos) await filtrados.recarregar()
  }

  // Opções dos filtros a partir do que já existe na Base.
  const autores = useMemo(() => opcoes(T.filter(i => i.autorId).map(i => ({ id: i.autorId, nome: i.autor }))), [T])
  const projetos = useMemo(() => opcoes(T.flatMap(i => i.projetos)), [T])
  const tags = useMemo(() => [...new Set(T.flatMap(i => i.tags))].sort(), [T])

  const novo = () => abrirFormConhecimento({ form, categorias, projetos: D.p, aoSalvar: recarregar })
  const set = k => e => setF(o => ({ ...o, [k]: e.target.value }))
  const sel = (k, rotulo, itens) => (
    <select
      className="form-select w-auto"
      style={{ maxWidth: 220 }}
      aria-label={'Filtrar por ' + rotulo.toLowerCase()}
      value={f[k] || ''}
      onChange={set(k)}
    >
      <option value="">
        {rotulo}: {k === 'categoria' || k === 'tag' ? 'todas' : 'todos'}
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
    {
      k: 'titulo',
      l: 'Item',
      render: x => (
        <a
          className="kc-t"
          href={`#/conhecimento/${x.id}`}
          onClick={e => {
            e.preventDefault()
            go('conhecimento', x.id)
          }}
        >
          <b>{x.titulo}</b>
          <small className="d-block">{x.resumo}</small>
        </a>
      ),
    },
    { k: 'categoria', l: 'Categoria', render: x => <span className={chip('')}>{rotuloCategoria(categorias, x.categoria)}</span> },
    { k: 'autor', l: 'Autor' },
    { k: 'data', l: 'Data', render: x => fd(x.data) },
    {
      k: 'tags',
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
            ['open', 'Abrir', () => go('conhecimento', x.id)],
            ...(x.podeAlterar
              ? [
                  ['edit', 'Editar', () => abrirFormConhecimento({ form, categorias, projetos: D.p, item: x, aoSalvar: recarregar })],
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
      <PageBar title="Base de Inteligência" sub="Pesquisas, cases, decisões e aprendizados da Konvex, abertos a todos.">
        <button className="btn btn-primary" onClick={novo}>
          <Ic k="plus" />
          Novo item
        </button>
      </PageBar>
      <div className="fl d-flex flex-wrap gap-2 mb-2">
        <input
          className="form-control w-auto flex-grow-1"
          style={{ maxWidth: 320 }}
          placeholder="Buscar no título, resumo, conteúdo e tags…"
          aria-label="Buscar na Base"
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        {sel(
          'categoria',
          'Categoria',
          categorias.map(c => [c.valor, c.rotulo]),
        )}
        {sel(
          'tag',
          'Tag',
          tags.map(t => [t, '#' + t]),
        )}
        {sel('autor', 'Autor', autores)}
        {sel('projeto', 'Projeto', projetos)}
        {sel('periodo', 'Período', PERIODOS)}
        {ativos && (
          <button className="btn btn-g" onClick={limpar}>
            Limpar filtros
          </button>
        )}
      </div>
      {carregando && !lista.length ? (
        <div className="card card-body">
          <small>Carregando…</small>
        </div>
      ) : (
        <Table
          busca={false}
          cols={cols}
          rows={lista}
          vazio={
            ativos
              ? 'Nada encontrado. Ajuste a busca ou os filtros.'
              : 'Nada registrado ainda. Use “Novo item” para guardar uma pesquisa, um case ou um aprendizado.'
          }
        />
      )}
    </>
  )
}

function Ficha({ id }) {
  const { D, form, go } = useApp()
  const categorias = useCategorias()
  const { dados: item, carregando, recarregar } = useCarregar(() => conhecimento.buscar(id), [id])
  const voltar = (
    <button className="btn btn-g" onClick={() => go('conhecimento')}>
      <Ic k="back" />
      Voltar
    </button>
  )
  if (!item)
    return (
      <PageBar title="Base de Inteligência" sub={carregando ? 'Carregando…' : 'Item não encontrado. Ele pode ter sido excluído.'}>
        {voltar}
      </PageBar>
    )

  const visiveis = new Set((D.p || []).map(p => p.id))
  const porTag = t => {
    abrirCom('conhecimento', { tag: t })
    go('conhecimento')
  }
  const editar = () => abrirFormConhecimento({ form, categorias, projetos: D.p, item, aoSalvar: recarregar })

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="cab d-flex align-items-center gap-2">
          {voltar}
          <h1>{item.titulo}</h1>
          <span className={chip('')}>{rotuloCategoria(categorias, item.categoria)}</span>
        </div>
        {item.podeAlterar && (
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-g" onClick={editar}>
              <Ic k="edit" />
              Editar
            </button>
            <button className="btn btn-g" onClick={() => excluirItem(item, () => go('conhecimento'))}>
              <Ic k="trash" />
              Excluir
            </button>
          </div>
        )}
      </div>
      <div className="card card-body kc">
        <p className="kc-r">{item.resumo}</p>
        <div className="kc-m">
          <span>
            <Ic k="perfil" />
            {item.autor}
          </span>
          <span>
            <Ic k="clock" />
            {fd(item.data)}
          </span>
          {item.fonte && (
            <span>
              <Ic k="file" />
              Fonte: {item.fonte}
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
        {!!item.projetos.length && (
          <div className="kc-s">
            <h3 className="h6 fw-bold">Projetos relacionados</h3>
            <div className="kc-tags">
              {item.projetos.map(p =>
                visiveis.has(p.id) ? (
                  <button key={p.id} type="button" className={chip('kc-tag')} onClick={() => go('projeto', p.id)}>
                    {p.nome}
                  </button>
                ) : (
                  <span key={p.id} className={chip('')}>
                    {p.nome}
                  </span>
                ),
              )}
            </div>
          </div>
        )}
        {!!item.iniciativas.length && (
          <div className="kc-s">
            <h3 className="h6 fw-bold">Iniciativas de inovação</h3>
            <div className="kc-tags">
              {item.iniciativas.map(i => (
                <button key={i.id} type="button" className={chip('kc-tag')} onClick={() => go('iniciativas', i.id)}>
                  {i.nome}
                </button>
              ))}
            </div>
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
            <Anexos dono="conhecimento" codigo={item.id} lista={item.anexos} podeAlterar={item.podeAlterar} aoMudar={recarregar} />
          </div>
        )}
        <div className="kc-s">
          <h3 className="h6 fw-bold">Conteúdo</h3>
          {item.conteudo.trim() ? (
            <Markdown texto={item.conteudo} />
          ) : (
            <small>Sem conteúdo completo. {item.podeAlterar && 'Use “Editar” para acrescentar.'}</small>
          )}
        </div>
      </div>
    </>
  )
}

/** Aba "Base" da ficha do projeto: itens ligados a ele (RF-080, QA-21). */
export function ItensDoProjeto({ projeto }) {
  const { D, form, go } = useApp()
  const categorias = useCategorias()
  const { dados, carregando, recarregar } = useCarregar(() => conhecimento.listar({ projeto: projeto.codigo }), [projeto.codigo])
  const L = dados || []
  // O próprio projeto entra nas opções mesmo se não estiver em D.p.
  const projetos = [...(D.p || []).filter(p => p.id !== projeto.codigo), { id: projeto.codigo, nome: projeto.nome }]
  const novo = () => abrirFormConhecimento({ form, categorias, projetos, inicial: { projetos: [projeto.codigo] }, aoSalvar: recarregar })
  const cols = [
    {
      k: 'titulo',
      l: 'Item',
      render: x => (
        <a
          className="kc-t"
          href={`#/conhecimento/${x.id}`}
          onClick={e => {
            e.preventDefault()
            go('conhecimento', x.id)
          }}
        >
          <b>{x.titulo}</b>
          <small className="d-block">{x.resumo}</small>
        </a>
      ),
    },
    { k: 'categoriaRotulo', l: 'Categoria', get: x => rotuloCategoria(categorias, x.categoria) },
    { k: 'autor', l: 'Autor' },
    { k: 'data', l: 'Data', render: x => fd(x.data) },
    { l: 'Ações', render: x => <ActionMenu items={[['open', 'Abrir', () => go('conhecimento', x.id)]]} /> },
  ]
  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <small>Pesquisas, decisões e aprendizados ligados a este projeto. Ficam abertos a toda a Konvex.</small>
        <button className="btn btn-primary" onClick={novo}>
          <Ic k="plus" />
          Registrar na Base
        </button>
      </div>
      {carregando && !L.length ? (
        <div className="card card-body">
          <small>Carregando…</small>
        </div>
      ) : (
        <Table
          cols={cols}
          rows={L}
          vazio="Nenhum item ligado a este projeto. Use “Registrar na Base” para guardar uma pesquisa, decisão ou aprendizado."
        />
      )}
    </>
  )
}
