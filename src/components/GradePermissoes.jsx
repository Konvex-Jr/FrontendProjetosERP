import { useMemo, useState } from 'react'
import alerts from '../lib/alerts'
import { alternar, desligadas, linhasPorGrupo, mudou } from '../lib/permissoes'

/**
 * Grade de permissões (sessão 31a): cargos nas colunas (presidente primeiro) e mais "Sem cargo" e "Trainee";
 * permissões nas linhas, agrupadas. A API diz em `podeAlterar` quais colunas a pessoa altera (só abaixo do
 * cargo dela). Cada coluna tem o próprio Salvar. No celular, um seletor de coluna e a lista dela.
 * Quem usa passa uma `key` que muda com os dados gravados: o rascunho recomeça a cada leitura da API.
 */
export default function GradePermissoes({ dados, aoSalvar }) {
  const grupos = useMemo(() => linhasPorGrupo(dados.catalogo), [dados.catalogo])
  const original = useMemo(() => Object.fromEntries(dados.colunas.map(c => [c.chave, c.permissoes])), [dados.colunas])
  const [rascunho, setRascunho] = useState(original)
  const [salvando, setSalvando] = useState(null)
  const primeiraEditavel = dados.colunas.find(c => c.podeAlterar)?.chave || dados.colunas[0]?.chave
  const [colunaCelular, setColunaCelular] = useState(primeiraEditavel)
  const rotulo = chave => dados.catalogo.find(i => i.chave === chave)?.rotulo || chave

  const marcar = (coluna, chave) => setRascunho(r => ({ ...r, [coluna]: alternar(r[coluna] || [], chave) }))

  const salvar = async coluna => {
    const saem = desligadas(original[coluna.chave] || [], rascunho[coluna.chave] || [])
    if (saem.length) {
      const ok = await alerts.confirm({
        title: `Tirar permissões de ${coluna.nome}?`,
        text: `Quem tem este cargo perde, no próximo clique: ${saem.map(rotulo).join(', ')}.`,
        confirmText: 'Tirar e salvar',
      })
      if (!ok) return
    }
    setSalvando(coluna.chave)
    try {
      await aoSalvar(coluna.chave, rascunho[coluna.chave] || [])
    } finally {
      setSalvando(null)
    }
  }

  const caixa = (coluna, item) => (
    <input
      type="checkbox"
      className="form-check-input"
      aria-label={`${item.rotulo}: ${coluna.nome}`}
      checked={(rascunho[coluna.chave] || []).includes(item.chave)}
      disabled={!coluna.podeAlterar || salvando === coluna.chave}
      onChange={() => marcar(coluna.chave, item.chave)}
    />
  )

  const botaoSalvar = coluna =>
    coluna.podeAlterar ? (
      <button
        className="btn btn-primary btn-sm"
        disabled={!mudou(original[coluna.chave] || [], rascunho[coluna.chave] || []) || salvando === coluna.chave}
        onClick={() => salvar(coluna)}
      >
        {salvando === coluna.chave ? 'Salvando…' : 'Salvar'}
      </button>
    ) : (
      <small className="text-muted">Só leitura</small>
    )

  const celular = dados.colunas.find(c => c.chave === colunaCelular) || dados.colunas[0]

  return (
    <div className="grade-perm">
      <p className="text-muted small mb-2">
        Você altera só os cargos abaixo do seu e só liga permissões que você tem. A mudança vale no próximo clique de quem tem o cargo.
      </p>

      <div className="grade-perm-tabela tbx">
        <div className="tw">
          <table className="table align-middle tc">
            <thead>
              <tr>
                <th className="grade-perm-nome">Permissão</th>
                {dados.colunas.map(c => (
                  <th key={c.chave} className="text-center">
                    {c.nome}
                    {c.posicao != null && <div className="small text-muted fw-normal">posição {c.posicao}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map(g => [
                <tr key={`g-${g.grupo}`} className="grade-perm-grupo">
                  <th colSpan={dados.colunas.length + 1}>{g.grupo}</th>
                </tr>,
                ...g.itens.map(item => (
                  <tr key={item.chave}>
                    <td className="grade-perm-nome">
                      {item.rotulo}
                      <div className="small text-muted">{item.descricao}</div>
                    </td>
                    {dados.colunas.map(c => (
                      <td key={c.chave} className="text-center">
                        {caixa(c, item)}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
              <tr>
                <td />
                {dados.colunas.map(c => (
                  <td key={c.chave} className="text-center">
                    {botaoSalvar(c)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {celular && (
        <div className="grade-perm-celular">
          <label className="form-label small" htmlFor="grade-perm-coluna">
            Cargo
          </label>
          <select
            id="grade-perm-coluna"
            className="form-select mb-3"
            value={celular.chave}
            onChange={e => setColunaCelular(e.target.value)}
          >
            {dados.colunas.map(c => (
              <option key={c.chave} value={c.chave}>
                {c.nome}
                {c.podeAlterar ? '' : ' (só leitura)'}
              </option>
            ))}
          </select>
          {grupos.map(g => (
            <div key={g.grupo} className="mb-3">
              <div className="fw-semibold mb-1">{g.grupo}</div>
              {g.itens.map(item => (
                <label key={item.chave} className="d-flex gap-2 align-items-start mb-2">
                  {caixa(celular, item)}
                  <span>
                    {item.rotulo}
                    <span className="d-block small text-muted">{item.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
          ))}
          <div className="mb-3">{botaoSalvar(celular)}</div>
        </div>
      )}
    </div>
  )
}
