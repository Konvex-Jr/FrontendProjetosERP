import { useState } from 'react'
import Multi from './Multi'
import ZonaEnvio from './ZonaEnvio'
import { valoresIniciais } from '../lib/formulario'

/**
 * Campos: k (chave), l (rótulo), t (tipo do input ou 'textarea'), o (opções de select),
 * c (opções de múltipla escolha; pode ser função dos valores), s (mostrar se), opt (opcional), h (dica abaixo do campo),
 * rows (linhas do textarea), min, max e step (limites de data ou número). `largo`: modal mais largo para textos longos (ex.: Base de Inteligência).
 * `save` pode ser assíncrono; se devolver false (ou falhar), o modal continua aberto.
 *
 * Detalhes: `o` é uma lista de pares [valor, rótulo]; `c` é uma lista de { id, nome, perfil? } (componente Multi);
 * `t` aceita qualquer tipo de input HTML (date, number, url...); `s(valores)` e `c(valores)` recebem o que já foi
 * preenchido, para um campo depender de outro; `disabled` trava um select. Campo sem `opt` é obrigatório.
 * `t: 'file'` usa a zona de envio (seletor ou arrastar e soltar) e guarda a lista escolhida (File[]); `multiple` e `accept` vão para a zona.
 * Campo de arquivo sem `opt` também é obrigatório: um input escondido leva o aviso do navegador e barra o envio.
 * Select visível sem valor é enviado com a 1ª opção, a que a tela mostra (lib/formulario.js).
 * Normalmente não se usa direto: as telas chamam `form(titulo, campos, inicial, salvar)` do contexto.
 */
export default function FormModal({ t, fs, init, save, close, largo }) {
  const [v, setV] = useState(init),
    set = (k, x) => setV(o => ({ ...o, [k]: x }))
  const [salvando, setSalvando] = useState(false)
  const enviar = async e => {
    e.preventDefault()
    setSalvando(true)
    try {
      // Select visível que a pessoa não mexeu vai com a 1ª opção, a que a tela mostra.
      const visiveis = fs.filter(x => !x.s || x.s(v))
      if ((await save(valoresIniciais(visiveis, v))) !== false) close()
    } catch {
      // Quem chamou já mostrou o erro; o formulário fica aberto para corrigir.
    } finally {
      setSalvando(false)
    }
  }
  const campo = x => {
    const comum = {
      className: 'form-control mt-1',
      required: !x.opt,
      value: v[x.k] ?? '',
      onChange: e => set(x.k, e.target.value),
      ...(x.min ? { min: x.min } : {}),
      ...(x.max ? { max: x.max } : {}),
      ...(x.step ? { step: x.step } : {}),
    }
    if (x.grupos)
      return (
        <select className="form-select mt-1" value={v[x.k] ?? ''} onChange={e => set(x.k, e.target.value)}>
          {x.grupos.map(g => (
            <optgroup key={g.rotulo} label={g.rotulo}>
              {g.opcoes.map(o => (
                <option key={o[0]} value={o[0]}>
                  {o[1]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )
    if (x.o)
      return (
        <select className="form-select mt-1" disabled={Boolean(x.disabled)} value={v[x.k] ?? ''} onChange={e => set(x.k, e.target.value)}>
          {x.o.map(o => (
            <option key={o[0]} value={o[0]}>
              {o[1]}
            </option>
          ))}
        </select>
      )
    if (x.t === 'textarea') return <textarea rows={x.rows || 3} {...comum} />
    return <input type={x.t || 'text'} {...comum} />
  }
  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={close}>
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: largo ? 680 : 440 }} onClick={e => e.stopPropagation()}>
          <form className="modal-content" onSubmit={enviar}>
            <div className="modal-body">
              <h3 className="h5 fw-bold mb-3">{t}</h3>
              {fs
                .filter(x => !x.s || x.s(v))
                .map(x =>
                  x.c ? (
                    <div className="mb-3" key={x.k}>
                      <div className="form-label">{x.l}</div>
                      <Multi opts={typeof x.c === 'function' ? x.c(v) : x.c} value={v[x.k] || []} onChange={z => set(x.k, z)} />
                      {x.h && <small className="d-block mt-1">{x.h}</small>}
                    </div>
                  ) : x.t === 'file' ? (
                    // Fora de <label>: a zona tem o próprio botão e a área de soltar. O formulário guarda os arquivos.
                    <div className="mb-3 position-relative" key={x.k}>
                      <div className="form-label">{x.l}</div>
                      {!x.opt && (
                        // A zona não tem input visível com `required`; este carrega a validação do navegador.
                        <input
                          className="visually-hidden"
                          tabIndex={-1}
                          aria-hidden="true"
                          value={v[x.k]?.length ? 'ok' : ''}
                          // Sem readOnly: campo só leitura fica fora da validação do navegador.
                          onChange={() => {}}
                          ref={el => el?.setCustomValidity(v[x.k]?.length ? '' : 'Escolha pelo menos um arquivo.')}
                        />
                      )}
                      <ZonaEnvio
                        aoEscolher={z => set(x.k, z)}
                        multiple={Boolean(x.multiple)}
                        accept={x.accept}
                        rotulo={x.multiple ? 'Escolher arquivos' : 'Escolher arquivo'}
                        dica={x.h}
                      />
                      {!!v[x.k]?.length && <small className="d-block mt-1">Escolhidos: {v[x.k].map(f => f.name).join(', ')}</small>}
                    </div>
                  ) : (
                    <label className="form-label w-100 mb-3" key={x.k}>
                      {x.l}
                      {campo(x)}
                      {x.h && <small className="d-block mt-1">{x.h}</small>}
                    </label>
                  ),
                )}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-g" onClick={close}>
                  Cancelar
                </button>
                <button className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
