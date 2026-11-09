import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { chip, fm } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'
import { BotaoAnexar, baixarAnexo } from '../components/Anexos'
import { DICA, anexos } from '../services/anexos'
import useCarregar from '../lib/useCarregar'
import { SIGILOS, excluirDocumento, excluirPasta, listarDocumentos, listarPastasComContagem, rotuloSigilo, salvarDocumento, salvarPasta } from '../services/documentos'

/**
 * Pastas e documentos (sessão 9). Documento é um link (Drive etc.) ou um arquivo guardado no sistema (sessão 12c).
 * A API só devolve o que a pessoa pode ler; só quem tem documentos.gerir organiza.
 */
export default function Gestao() {
  const { D, form, pode } = useApp()
  const gere = pode('documentos.gerir')
  const [pid, setPid] = useState(null)
  const { dados: pastas, carregando, recarregar } = useCarregar(listarPastasComContagem, [])
  const pa = (pastas || []).find(x => x.id == pid)

  // Salva e recarrega; em erro mostra o alerta e mantém o formulário aberto.
  const executar = async (acao, titulo, depois = recarregar) => {
    try {
      await acao()
      await depois()
    } catch (error) {
      await alerts.error(titulo, error.message)
      throw error
    }
  }

  const projetos = (D.p || []).map(p => [p.id, p.nome])
  const nova = f => form(f ? 'Editar pasta' : 'Nova pasta', [
    { k: 'nome', l: 'Nome da pasta' },
    { k: 'sigilo', l: 'Quem pode ver', o: SIGILOS, h: 'Gerentes e diretores veem todas as pastas.' },
    { k: 'projetoId', l: 'Projeto', o: [['', 'Escolha o projeto'], ...projetos], s: v => v.sigilo === 'projeto', h: 'Equipe atual e quem já participou do projeto.' },
  ], f ? { nome: f.nome, sigilo: f.sigilo, projetoId: f.projetoId } : { sigilo: 'todos', projetoId: '' },
  v => executar(() => salvarPasta(v, f?.id), 'Não foi possível salvar a pasta'))

  const delP = async folder => {
    const ok = await alerts.confirm({ title: 'Excluir pasta?', text: `A pasta e seus ${folder.total} documento(s) serão excluídos.`, confirmText: 'Excluir pasta', danger: true })
    if (ok) await executar(() => excluirPasta(folder.id), 'Não foi possível excluir a pasta').catch(() => {})
  }

  if (!pa) return (
    <>
      <PageBar title="Gestão" sub="Documentos da empresa, organizados por pasta.">{gere && <button className="btn btn-primary" onClick={() => nova()}><Ic k="plus" />Nova pasta</button>}</PageBar>
      <div className="row g-3">
        {(pastas || []).map(f => (
          <div className="col-sm-6 col-xl-4" key={f.id}>
            <div className="fc" onClick={() => setPid(f.id)}>
              <span className="fi"><Ic k="gestao" /></span>
              <div><b>{f.nome}</b><small>{f.total} documento{f.total == 1 ? '' : 's'} · {rotuloSigilo(f)}</small></div>
              <ActionMenu items={[['open', 'Abrir', () => setPid(f.id)], ...(gere ? [['edit', 'Editar', () => nova(f)], ['trash', 'Excluir', () => delP(f), 1]] : [])]} />
            </div>
          </div>
        ))}
      </div>
      {!carregando && !pastas?.length && <div className="card card-body">{gere ? 'Nenhuma pasta ainda. Use “Nova pasta”.' : 'Nenhuma pasta disponível para você.'}</div>}
    </>
  )

  return <Pasta pasta={pa} gere={gere} form={form} executar={executar} voltar={() => { setPid(null); recarregar() }} />
}

function Pasta({ pasta, gere, form, executar, voltar }) {
  const { dados, carregando, recarregar } = useCarregar(() => listarDocumentos(pasta.id), [pasta.id])
  const L = dados || []
  const doc = x => form(x ? 'Editar documento' : 'Adicionar link', [
    { k: 'nome', l: 'Nome', ...(x?.anexo ? { h: `Arquivo: ${x.anexo.nome}. Para trocar o arquivo, exclua e envie outro.` } : {}) },
    ...(x?.anexo ? [] : [{ k: 'url', l: 'Link', t: 'url', h: 'Cole o link do Google Drive, Docs, Notion etc. Quem abrir precisa ter acesso no serviço de origem.' }]),
  ], x ? { nome: x.nome, url: x.url } : {}, v => executar(() => salvarDocumento(pasta.id, v, x?.id, Boolean(x?.anexo)), 'Não foi possível salvar o documento', recarregar))
  const enviarArquivo = async arquivo => { await anexos.enviarDocumento(pasta.id, arquivo); recarregar() }
  const delD = async x => {
    const ok = await alerts.confirm({ title: 'Excluir documento?', text: x.nome, confirmText: 'Excluir documento', danger: true })
    if (ok) await executar(() => excluirDocumento(x.id), 'Não foi possível excluir o documento', recarregar).catch(() => {})
  }
  const abrir = x => x.anexo ? baixarAnexo(x.anexo) : window.open(x.url, '_blank', 'noopener,noreferrer')

  const cols = [
    { k: 'nome', l: 'Documento', render: x => x.anexo
      ? <a className="fn" href="#" onClick={e => { e.preventDefault(); abrir(x) }} title={`Baixar ${x.anexo.nome}`}><Ic k="download" />{x.nome}</a>
      : <a className="fn" href={x.url} target="_blank" rel="noopener noreferrer"><Ic k="file" />{x.nome}</a> },
    { k: 'dominio', l: 'Onde está', filter: 1, render: x => x.anexo ? `Arquivo · ${x.anexo.tamanho}` : x.dominio },
    { k: 'autor', l: 'Adicionado por', fl: 'Autor', filter: 1 },
    { k: 'data', l: 'Data', render: x => fm(x.data) },
    { l: 'Ações', render: x => <ActionMenu items={[x.anexo ? ['download', 'Baixar', () => abrir(x)] : ['open', 'Abrir', () => abrir(x)], ...(gere ? [['edit', 'Editar', () => doc(x)], ['trash', 'Excluir', () => delD(x), 1]] : [])]} /> },
  ]
  return (
    <div className="dw">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="cab d-flex align-items-center gap-2"><button className="btn btn-g" onClick={voltar}><Ic k="back" />Voltar</button><h1>{pasta.nome}</h1><span className={chip('')}>{rotuloSigilo(pasta)}</span></div>
        {gere && <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => doc()}><Ic k="link" />Adicionar link</button>
          <BotaoAnexar enviar={enviarArquivo} rotulo="Enviar arquivo" />
        </div>}
      </div>
      {L.length ? <Table cols={cols} rows={L} /> : !carregando && <div className="dz"><Ic k="file" /><b>Nenhum documento nesta pasta</b>{gere && <small>Use “Adicionar link” para um arquivo do Drive, Docs ou Notion, ou “Enviar arquivo” para guardá-lo aqui. {DICA}</small>}</div>}
    </div>
  )
}
