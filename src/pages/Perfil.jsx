import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { chip, codigoDoPerfil, fd } from '../lib/utils'
import Ic from '../components/Icon'
import Avatar from '../components/Avatar'
import FotoModal from '../components/FotoModal'
import { PageBar, Prog } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import { minhaConta, pessoas, rotuloStatus } from '../services/pessoas'
import { cartoesDeLinks } from '../lib/linksPerfil'
import LogoMarca from '../components/LogosMarcas'
import { horas } from '../services/capacitacoes'
import { itensDoAutor } from '../services/biblioteca'
import Clipe from '../components/Clipe'
import { SeloSigiloso } from '../components/SeloProjeto'
import AreasPessoa from '../components/AreasPessoa'
import { rotuloArea } from '../lib/periodos'

const COR_STATUS = { ativo: 'ok', trainee: '', alumni: 'wa', inativo: 'er' }
/** Links do perfil como cartões com logo; abrem em nova aba. */
function CartoesDeLinks({ cartoes }) {
  return (
    <div className="links-perfil">
      {cartoes.map(c => (
        <a key={c.tipo} className="link-perfil" href={c.url} target="_blank" rel="noreferrer" title={c.url}>
          <LogoMarca tipo={c.tipo} />
          <span>
            <b>{c.rotulo}</b>
            <small>{c.texto}</small>
          </span>
        </a>
      ))}
    </div>
  )
}

function Lista({ titulo, itens, vazio, linha }) {
  return (
    <div className="card card-body h-100">
      <h2>{titulo}</h2>
      {itens.length ? itens.map(linha) : <small>{vazio}</small>}
    </div>
  )
}

/**
 * Chave e busca do perfil. Sem `outro` é o próprio perfil (o que o menu, src/lib/antecipar.js,
 * busca antes do clique, com a mesma chave). `contexto` = { me } do useApp().
 */
export function dadosDaTela({ me }, outro) {
  return { chave: `perfil:${outro || 'eu'}`, carregar: () => pessoas.perfil(outro || me) }
}

/** RF-013: perfil da pessoa. Em /perfil é o próprio; em /perfil/:codigo, o de outra pessoa. */
export default function Perfil() {
  const { codigo: outro } = useParams()
  const { me, form, go, refresh, nav } = useApp()
  const [trocandoFoto, setTrocandoFoto] = useState(false)
  const codigo = codigoDoPerfil(me, outro)
  const meu = codigo === me
  const tela = dadosDaTela({ me }, outro)
  const { dados: perfil, carregando, recarregar } = useCarregar(tela.carregar, [codigo], { chave: tela.chave })

  // Quem não tem Biblioteca no menu (trainee) levaria 403 da API: nem busca, nem mostra a seção.
  const temBiblioteca = nav.some(([chave]) => chave === 'biblioteca')
  const itens = itensDoAutor(codigo)
  const { dados: itensBib, carregando: carregandoItens } = useCarregar(
    temBiblioteca ? itens.carregar : () => Promise.resolve(null),
    [codigo, temBiblioteca],
    { chave: temBiblioteca ? itens.chave : `${itens.chave}:sem` },
  )

  if (!perfil)
    return (
      <>
        <PageBar title={meu ? 'Meu perfil' : 'Perfil'} sub={carregando ? '' : 'Não foi possível carregar.'} />
        {carregando && <Esqueleto />}
      </>
    )

  const { usuario: u, projetosAtuais, projetosAnteriores, periodos, podeGerirPeriodos, capacitacoes, alocacao } = perfil

  const editarDados = () =>
    form(
      'Editar meus dados',
      [
        { k: 'nomeExibicao', l: 'Como prefere ser chamado(a)', opt: true },
        { k: 'telefone', l: 'Telefone', t: 'tel', opt: true },
        { k: 'linkedinUrl', l: 'LinkedIn (link)', t: 'url', opt: true },
        { k: 'githubUrl', l: 'GitHub (link)', t: 'url', opt: true },
        {
          k: 'calendarioUrl',
          l: 'Calendário (link)',
          t: 'url',
          opt: true,
          h: 'Link público da sua agenda (Google Agenda, Calendly…), para marcarem reuniões com você.',
        },
        { k: 'curso', l: 'Curso', opt: true },
        { k: 'semestre', l: 'Semestre', t: 'number', opt: true },
        { k: 'bio', l: 'Sobre você', t: 'textarea', opt: true },
      ],
      {
        nomeExibicao: u.nomeExibicao || '',
        telefone: u.telefone || '',
        linkedinUrl: u.linkedinUrl || '',
        githubUrl: u.githubUrl || '',
        calendarioUrl: u.calendarioUrl || '',
        curso: u.curso || '',
        semestre: u.semestre ?? '',
        bio: u.bio || '',
      },
      async v => {
        try {
          await minhaConta.editarPerfil(v)
          alerts.toastSuccess('Dados atualizados')
          await recarregar()
          refresh().catch(() => {})
        } catch (error) {
          alerts.error('Não foi possível salvar', error.message)
          return false
        }
      },
    )

  // Depois de trocar ou remover: recarrega o perfil e os dados compartilhados (topo, listas, equipes).
  const aoMudarFoto = async () => {
    await recarregar()
    refresh().catch(() => {})
  }
  const removerFoto = async () => {
    if (
      !(await alerts.confirm({
        title: 'Remover a foto?',
        text: 'Voltam a aparecer as suas iniciais.',
        confirmText: 'Remover',
        danger: true,
      }))
    )
      return
    try {
      await minhaConta.removerFoto()
      alerts.toastSuccess('Foto removida')
      await aoMudarFoto()
    } catch (error) {
      alerts.error('Não foi possível remover a foto', error.message)
    }
  }

  const trocarSenha = () =>
    form(
      'Trocar senha',
      [
        { k: 'senhaAtual', l: 'Senha atual', t: 'password' },
        { k: 'novaSenha', l: 'Nova senha', t: 'password', h: 'Mínimo de 8 caracteres.' },
        { k: 'confirmar', l: 'Repita a nova senha', t: 'password' },
      ],
      {},
      async v => {
        if (v.novaSenha !== v.confirmar) {
          alerts.error('As senhas não conferem', 'Digite a mesma senha nos dois campos.')
          return false
        }
        try {
          const r = await minhaConta.trocarSenha(v.senhaAtual, v.novaSenha)
          alerts.success('Senha alterada', r?.message || '')
        } catch (error) {
          alerts.error('Não foi possível trocar a senha', error.message)
          return false
        }
      },
    )

  const info = [
    ['E-mail', u.email],
    ['Telefone', u.telefone],
    ['Curso', u.curso && (u.semestre ? `${u.curso} · ${u.semestre}º semestre` : u.curso)],
    ['Na EJ desde', u.dataEntrada && fd(u.dataEntrada)],
    ['Saída', u.dataSaida && fd(u.dataSaida)],
  ].filter(([, v]) => v)
  const cartoes = cartoesDeLinks(u)

  const projeto = p => (
    <div
      className={'ag' + (p.restrito ? ' resumo-sigilo' : '')}
      key={p.codigo + p.dataEntrada}
      onClick={p.restrito ? undefined : () => go('projeto', p.codigo)}
    >
      <span className={chip()}>{p.alocacao}%</span>
      <div>
        <b>{p.nome}</b>
        <small>
          {/* Projeto sigiloso que quem olha não pode abrir: sem função e sem link. */}
          {p.restrito ? 'Detalhes restritos' : p.funcao || 'Sem função definida'} · desde {fd(p.dataEntrada)}
          {p.dataSaida ? ` até ${fd(p.dataSaida)}` : ''}
        </small>
      </div>
      {p.sigiloso && <SeloSigiloso />}
      <span className={chip()}>{p.status}</span>
    </div>
  )
  const capacitacao = c => (
    <div className="ag" key={c.codigo} onClick={() => go('capacitacoes', c.codigo)}>
      <span className={chip(c.presente === true ? 'ok' : '')}>
        {c.papel === 'instrutor' ? 'Ministrou' : c.presente === true ? 'Presente' : c.presente === false ? 'Faltou' : 'Inscrito'}
      </span>
      <div>
        <b>{c.titulo}</b>
        <small>
          {c.hora} · {horas(c.duracaoHoras)}
        </small>
      </div>
      <span className={chip()}>{fd(c.data)}</span>
    </div>
  )
  const itemBiblioteca = x => (
    <div className="ag" key={x.codigo}>
      <div>
        <a
          href={`#/biblioteca/${x.codigo}`}
          onClick={e => {
            e.preventDefault()
            go('biblioteca', x.codigo)
          }}
        >
          <b>{x.titulo}</b>
        </a>
        {x.tags.length > 0 && <small>{x.tags.map(t => '#' + t).join(' ')}</small>}
      </div>
      <Clipe n={x.anexos.length} />
      <span className={chip()}>{fd(x.atualizadoEm)}</span>
    </div>
  )
  // Mudou um período: recarrega o perfil e os dados compartilhados (a lista de Pessoas mostra as áreas).
  const aoMudarPeriodos = async () => {
    await recarregar()
    refresh().catch(() => {})
  }
  const areasAtuais = (u.areas || []).map(rotuloArea)

  return (
    <>
      <PageBar title={meu ? 'Meu perfil' : u.nome} sub={!meu ? 'Perfil de pessoa da Konvex' : undefined}>
        {!meu && (
          <button className="btn btn-g" onClick={() => history.back()}>
            <Ic k="back" />
            Voltar
          </button>
        )}
        {meu && (
          <button className="btn btn-g" onClick={trocarSenha}>
            <Ic k="key" />
            Trocar senha
          </button>
        )}
        {meu && (
          <button className="btn btn-primary" onClick={editarDados}>
            <Ic k="edit" />
            Editar meus dados
          </button>
        )}
      </PageBar>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card card-body h-100">
            <div className="d-flex align-items-center gap-3 mb-3">
              {meu ? (
                <Avatar
                  pessoa={u}
                  tamanho="grande"
                  className="av-troca"
                  role="button"
                  tabIndex={0}
                  title="Trocar foto"
                  onClick={() => setTrocandoFoto(true)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setTrocandoFoto(true))}
                />
              ) : (
                <Avatar pessoa={u} tamanho="grande" />
              )}
              <div>
                <h2 className="mb-0">{u.nomeExibicao || u.nome}</h2>
                <small className="d-block">{areasAtuais.length ? areasAtuais.join(' · ') : 'Sem área no momento'}</small>
                {u.senioridade?.nome && <small className="d-block">{u.senioridade.nome}</small>}
              </div>
              <span className={'ms-auto ' + chip(COR_STATUS[u.status])}>{rotuloStatus(u.status)}</span>
            </div>
            {info.map(([k, v]) => (
              <div key={k} className="d-flex justify-content-between gap-3 mb-1">
                <small>{k}</small>
                <span className="text-end">{v}</span>
              </div>
            ))}
            {cartoes.length > 0 ? (
              <CartoesDeLinks cartoes={cartoes} />
            ) : (
              meu && <small className="d-block mt-3">Adicione seus links em Editar meus dados.</small>
            )}
            {u.bio && <p className="mt-3 mb-0">{u.bio}</p>}
            {meu && (
              <div className="d-flex flex-wrap gap-2 mt-3">
                <button className="btn btn-g btn-sm" onClick={() => setTrocandoFoto(true)}>
                  <Ic k="edit" />
                  Trocar foto
                </button>
                {u.foto && (
                  <button className="btn btn-g btn-sm" onClick={removerFoto}>
                    Remover foto
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="col-md-6">
          <div className="card card-body h-100">
            <h2>Alocação em projetos ativos</h2>
            <div className="d-flex justify-content-between mb-1">
              <b>{alocacao.total}%</b>
              {alocacao.excedeu && <span className={chip('er')}>Acima de 100%</span>}
            </div>
            <Prog v={Math.min(alocacao.total, 100)} cls={alocacao.excedeu ? 'bg-danger' : ''} />
            <div className="mt-3">
              {alocacao.projetos.length ? (
                alocacao.projetos.map(p => (
                  <div key={p.codigo} className="d-flex justify-content-between">
                    <small>{p.nome}</small>
                    <small>{p.alocacao}%</small>
                  </div>
                ))
              ) : (
                <small>Sem alocação em projetos ativos.</small>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <Lista titulo="Projetos atuais" itens={projetosAtuais} vazio="Nenhum projeto no momento." linha={projeto} />
        </div>
        <div className="col-md-6">
          <Lista titulo="Projetos anteriores" itens={projetosAnteriores} vazio="Nenhum projeto encerrado." linha={projeto} />
        </div>
        <div className="col-md-6">
          <Lista
            titulo={`Capacitações · ${horas(capacitacoes.horasCumpridas || 0)} cumpridas`}
            itens={[...capacitacoes.proximas, ...capacitacoes.realizadas]}
            vazio="Nenhuma capacitação registrada."
            linha={capacitacao}
          />
        </div>
        <div className="col-md-6">
          {itensBib ? (
            <Lista titulo="Itens na Biblioteca" itens={itensBib} vazio="Nenhum item na Biblioteca." linha={itemBiblioteca} />
          ) : (
            carregandoItens && (
              <div className="card card-body h-100">
                <h2>Itens na Biblioteca</h2>
                <Esqueleto />
              </div>
            )
          )}
        </div>
        <div className="col-md-6">
          <AreasPessoa periodos={periodos} podeGerir={podeGerirPeriodos} codigoPessoa={u.codigo} onMudou={aoMudarPeriodos} />
        </div>
      </div>
      {trocandoFoto && <FotoModal aoFechar={() => setTrocandoFoto(false)} aoSalvo={aoMudarFoto} />}
    </>
  )
}
