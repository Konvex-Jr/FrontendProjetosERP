import { useState } from 'react'
import Avatar from './Avatar'
import ChipOcupacao from './ChipOcupacao'
import Table from './Table'
import { StatusProjeto } from './SeloProjeto'
import useCarregar from '../lib/useCarregar'
import { chip } from '../lib/utils'
import { colunasDoCampinho, contaNaAlocacao, linhasAlocacao, projetosPorPessoa } from '../lib/alocacao'
import { ocupacao } from '../services/ocupacao'

/**
 * Visões só da gestão em Projetos (sessão 28a). A ocupação usa a mesma chave da aba Equipe;
 * se ela falhar, o percentual aparece como "—" e o resto da visão segue.
 */
function useOcupacoes() {
  const { dados } = useCarregar(() => ocupacao.todas().catch(() => null), [], { chave: 'ocupacao:todas' })
  return dados
}

/** Visão "Alocação": cada pessoa na EJ com a ocupação da semana e os projetos ativos. */
export function Alocacao({ lista, gente }) {
  const ocupacoes = useOcupacoes()
  const [soAcima, setSoAcima] = useState(false)
  const todas = linhasAlocacao(gente, ocupacoes, lista)
  const linhas = soAcima ? todas.filter(l => l.percentual > 100) : todas
  const acima = todas.filter(l => l.percentual > 100).length
  const cols = [
    {
      k: 'nome',
      l: 'Pessoa',
      render: l => (
        <span className="d-inline-flex align-items-center gap-2">
          <Avatar pessoa={l} />
          {l.nome}
          {l.trainee && <span className={chip()}>Trainee</span>}
        </span>
      ),
    },
    { k: 'pct', l: 'Ocupação na semana', get: l => l.percentual ?? -1, render: l => <ChipOcupacao percentual={l.percentual} /> },
    {
      k: 'projetos',
      l: 'Projetos ativos',
      get: l => l.projetos.map(p => p.nome).join(', '),
      render: l =>
        l.projetos.length ? (
          <span className="d-flex flex-wrap gap-1">
            {l.projetos.map(p => (
              <span key={p.codigo} className={chip(p.lider ? 'p3' : '')}>
                {p.nome}
                {p.lider ? ' · líder' : ''}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-mu">Nenhum</span>
        ),
    },
  ]
  return (
    <>
      <div className="fl d-flex flex-wrap align-items-center gap-3 mb-3">
        <label className="form-check m-0">
          <input type="checkbox" className="form-check-input" checked={soAcima} onChange={e => setSoAcima(e.target.checked)} />
          <span className="form-check-label">Só quem passa de 100% ({acima})</span>
        </label>
      </div>
      <Table
        cols={cols}
        rows={linhas}
        linhaCls={l => (l.percentual > 100 ? 'linha-acima' : undefined)}
        vazio={soAcima ? 'Ninguém passa de 100% nesta semana.' : 'Ninguém na EJ.'}
      />
    </>
  )
}

/** Uma peça de futebol de botão: foto ou iniciais, braçadeira do líder, nº de projetos e borda vermelha acima de 100%. */
function Botao({ peca, qtd, percentual }) {
  const acima = percentual > 100
  const partes = [peca.nome, peca.capitao ? 'líder' : peca.funcao, `${qtd} ${qtd === 1 ? 'projeto' : 'projetos'}`]
  if (percentual != null) partes.push(`${Math.round(percentual)}% da semana`)
  const texto = partes.filter(Boolean).join(' · ')
  return (
    <li className={'botao' + (acima ? ' acima' : '')} title={texto} aria-label={texto}>
      <span className="botao-disco">
        <Avatar pessoa={peca} />
        {peca.capitao && (
          <span className="botao-c" aria-hidden="true">
            C
          </span>
        )}
        {qtd > 1 && (
          <span className="botao-n" aria-hidden="true">
            {qtd}
          </span>
        )}
      </span>
      <span className="botao-nome">{peca.nome.split(' ')[0]}</span>
    </li>
  )
}

/** Visão "Campinho": cada projeto ativo é um campo, com a equipe atual em colunas pela função. */
export function Campinho({ projetos, lista }) {
  const ocupacoes = useOcupacoes()
  const pct = Object.fromEntries((ocupacoes || []).map(o => [o.codigoUsuario, o.percentual]))
  const contagem = projetosPorPessoa(lista)
  const campos = projetos.filter(contaNaAlocacao)
  return (
    <>
      <p className="text-mu small mb-3">
        Projetos ativos, sem os gerais das áreas. C = líder; o número no botão = em quantos projetos ativos a pessoa está; borda vermelha =
        acima de 100% na semana.
      </p>
      <div className="row g-3">
        {!campos.length && (
          <div className="col-12">
            <div className="card card-body">Nenhum projeto ativo com estes filtros.</div>
          </div>
        )}
        {campos.map(p => {
          const colunas = colunasDoCampinho(p)
          return (
            <div className="col-lg-6" key={p.codigo}>
              <section className="card card-body h-100" aria-label={'Campinho do projeto ' + p.nome}>
                <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                  <h2 className="m-0 fs-6">{p.nome}</h2>
                  <StatusProjeto s={p.status} />
                </div>
                {colunas.length ? (
                  <div className="campo">
                    {colunas.map(c => (
                      <div className="campo-col" key={c.rotulo}>
                        <ul>
                          {c.pecas.map(m => (
                            <Botao key={m.codigo} peca={m} qtd={contagem[m.codigo]?.length || 1} percentual={pct[m.codigo]} />
                          ))}
                        </ul>
                        <small className="campo-rot">{c.rotulo}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="campo campo-vazio">Ninguém na equipe.</div>
                )}
              </section>
            </div>
          )
        })}
      </div>
    </>
  )
}
