import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { chip, codigoDoPerfil, fd, iso } from '../lib/utils'
import Ic from '../components/Icon'
import Avatar from '../components/Avatar'
import FotoModal from '../components/FotoModal'
import { PageBar, Prog } from '../components/Ui'
import alerts from '../lib/alerts'
import useCarregar from '../lib/useCarregar'
import Esqueleto from '../components/Esqueleto'
import CampoNovaSenha from '../components/CampoNovaSenha'
import { forcaSenha } from '../lib/senha'
import { minhaConta, pessoas, rotuloStatus } from '../services/pessoas'
import { cartoesDeLinks } from '../lib/linksPerfil'
import LogoMarca from '../components/LogosMarcas'
import { horas } from '../services/capacitacoes'
import { itensDoAutor } from '../services/biblioteca'
import Clipe from '../components/Clipe'
import { SeloTipo } from '../components/SeloProjeto'
import AreasPessoa from '../components/AreasPessoa'
import { periodoTrainee, rotuloArea, rotuloMotivo } from '../lib/periodos'
import { copiarTexto, mascararIngresso, mascararTelefone, telefoneParaMostrar } from '../lib/pessoaContato'
import { corpoEdicaoPerfil, erroApagarObrigatorio, erroCadastro, opcoesCurso } from '../lib/cadastroPessoa'
import { ocupacao } from '../services/ocupacao'
import { faixaOcupacao, formatarHoras, proximaSemana, rotuloSemana, semanaAnterior, semanaAtual } from '../lib/ocupacao'

const COR_STATUS = { ativo: 'ok', trainee: '', inativo: 'er' }
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

const COR_FAIXA = { ok: '', atencao: 'bg-warning', perigo: 'bg-danger' }
const CHIP_FAIXA = { ok: 'ok', atencao: 'wa', perigo: 'er' }

/** Uma linha do detalhe da ocupação: tarefa, projeto inteiro (sem tarefa visível) ou "outras". */
function linhaOcupacao(i) {
  if (i.tipo === 'tarefa') return `${i.titulo} · ${i.projeto?.nome || 'Projeto restrito'}`
  if (i.tipo === 'projeto') return i.projeto?.nome || 'Projeto restrito'
  return 'Outras tarefas'
}

/** Ocupação da semana (dificuldade das tarefas abertas = % do dia). `inicial` = semana atual, vinda do perfil. */
function CartaoOcupacao({ codigo, inicial }) {
  const [semana, setSemana] = useState(null)
  // Perfil sem `ocupacao` (cache antigo ou resposta diferente): a semana atual é buscada à parte.
  const atual = inicial?.semana ?? semanaAtual()
  const buscar = semana || (inicial ? null : atual)
  const { dados: outra, carregando } = useCarregar(
    () => (buscar ? ocupacao.dePessoa(codigo, buscar) : Promise.resolve(null)),
    [codigo, buscar],
    { chave: buscar ? `ocupacao:${codigo}:${buscar}` : `ocupacao:${codigo}:atual` },
  )
  const o = buscar ? outra : inicial
  const mostrada = semana || atual
  const faixa = o ? faixaOcupacao(o.percentual) : 'ok'
  const voltarPara = s => setSemana(s === atual ? null : s)

  return (
    <div className="card card-body h-100">
      <h2>Ocupação da semana</h2>
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <button className="btn btn-g btn-sm" aria-label="Semana anterior" onClick={() => voltarPara(semanaAnterior(mostrada))}>
          ‹
        </button>
        <small className="text-center">
          {rotuloSemana(mostrada)}
          {semana && (
            <button type="button" className="btn-nome ms-2" onClick={() => setSemana(null)}>
              Esta semana
            </button>
          )}
        </small>
        <button className="btn btn-g btn-sm" aria-label="Próxima semana" onClick={() => voltarPara(proximaSemana(mostrada))}>
          ›
        </button>
      </div>
      {!o ? (
        <small>{carregando ? 'Carregando…' : 'Não foi possível carregar esta semana.'}</small>
      ) : (
        <>
          <div className="d-flex justify-content-between mb-1">
            <b>
              {Math.round(o.percentual)}% · {formatarHoras(o.horas)} de {formatarHoras(o.teto)}
            </b>
            {faixa === 'perigo' && <span className={chip(CHIP_FAIXA[faixa])}>Acima de 100%</span>}
          </div>
          <Prog v={Math.min(o.percentual, 100)} cls={COR_FAIXA[faixa]} />
          <div className="mt-3">
            {o.itens.length ? (
              o.itens.map((i, n) => (
                <div key={`${i.tipo}-${i.codigo ?? i.projeto?.codigo ?? ''}-${n}`} className="d-flex justify-content-between gap-2">
                  <small>{linhaOcupacao(i)}</small>
                  <small className="text-nowrap">{formatarHoras(i.horas)}</small>
                </div>
              ))
            ) : (
              <small>Sem tarefas abertas nesta semana.</small>
            )}
          </div>
          <small className="text-mu d-block mt-2">Mostra só tarefas abertas.</small>
        </>
      )}
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
  const { me, form, go, refresh, nav, setPendencias } = useApp()
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

  const { usuario: u, projetosAtuais, projetosAnteriores, periodos, podeGerir, capacitacoes, ocupacao: ocupacaoAtual } = perfil

  const editarDados = () =>
    form(
      'Editar meus dados',
      [
        { k: 'nomeExibicao', l: 'Como prefere ser chamado(a)', opt: true },
        {
          k: 'telefone',
          l: 'Telefone',
          campo: (v, set) => (
            <label className="form-label w-100 mb-0">
              Telefone
              <input
                className="form-control mt-1"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(00) 00000-0000"
                value={v.telefone || ''}
                onChange={e => set('telefone', mascararTelefone(e.target.value))}
              />
            </label>
          ),
        },
        { k: 'emailPessoal', l: 'E-mail pessoal', t: 'email', opt: true, maxLength: 254 },
        { k: 'linkedinUrl', l: 'LinkedIn (link)', t: 'url', opt: true },
        { k: 'githubUrl', l: 'GitHub (link)', t: 'url', opt: true },
        {
          k: 'calendarioUrl',
          l: 'Calendário (link)',
          t: 'url',
          opt: true,
          h: 'Link público da sua agenda (Google Agenda, Calendly…), para marcarem reuniões com você.',
        },
        { k: 'curso', l: 'Curso', o: opcoesCurso(u) },
        {
          k: 'ingresso',
          l: 'Ingresso na faculdade',
          opt: true,
          campo: (v, set) => (
            <label className="form-label w-100 mb-0">
              Ingresso na faculdade
              <input
                className="form-control mt-1"
                inputMode="numeric"
                autoComplete="off"
                placeholder="AAAA/S"
                value={v.ingresso || ''}
                onChange={e => set('ingresso', mascararIngresso(e.target.value))}
              />
              <small className="text-muted">Ex.: 2025/1 para o primeiro semestre de 2025.</small>
            </label>
          ),
        },
        { k: 'dataEntrada', l: 'Entrada na EJ', t: 'date', opt: true, max: iso(new Date()) },
        { k: 'bio', l: 'Sobre você', t: 'textarea', opt: true },
      ],
      {
        nomeExibicao: u.nomeExibicao || '',
        telefone: u.telefone || '',
        emailPessoal: u.emailPessoal || '',
        linkedinUrl: u.linkedinUrl || '',
        githubUrl: u.githubUrl || '',
        calendarioUrl: u.calendarioUrl || '',
        curso: u.curso || '',
        ingresso: u.ingresso || '',
        dataEntrada: u.dataEntrada?.slice(0, 10) || '',
        bio: u.bio || '',
      },
      async v => {
        const erro = erroApagarObrigatorio(v, u) || erroCadastro(v, u)
        if (erro) {
          alerts.error(erro.titulo, erro.texto)
          return false
        }
        try {
          const gravada = await minhaConta.editarPerfil(corpoEdicaoPerfil(v, u))
          setPendencias(gravada?.pendenciasPerfil || [])
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
        // Mesma regra e medidor do link de senha (lib/senha.js); a API confere de novo.
        {
          k: 'novaSenha',
          campo: (v, set) => (
            <CampoNovaSenha
              valor={v.novaSenha || ''}
              confirmacao={v.confirmar || ''}
              onValor={z => set('novaSenha', z)}
              onConfirmacao={z => set('confirmar', z)}
            />
          ),
        },
      ],
      {},
      async v => {
        if (forcaSenha(v.novaSenha) === 'fraca') {
          alerts.error('Senha fraca', 'A nova senha precisa cumprir todas as regras da lista.')
          return false
        }
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

  const copiar = async texto => {
    if (await copiarTexto(texto)) alerts.toastSuccess('Copiado')
    else alerts.error('Não foi possível copiar', 'Selecione o texto e copie à mão.')
  }
  // [rótulo, valor, texto a copiar e rótulo do botão (opcionais)]
  const info = [
    ['E-mail', u.email],
    ['E-mail pessoal', u.emailPessoal, u.emailPessoal, 'e-mail pessoal'],
    ['Telefone', u.telefone && telefoneParaMostrar(u.telefone), u.telefone && telefoneParaMostrar(u.telefone), 'telefone'],
    ['Curso', u.curso || 'Curso não informado'],
    ['Ingresso', u.ingresso],
    ['Na EJ desde', u.dataEntrada && fd(u.dataEntrada)],
    ['Saída', u.dataSaida && fd(u.dataSaida)],
    ['Motivo da saída', rotuloMotivo(u)],
  ].filter(([, v]) => v)
  const cartoes = cartoesDeLinks(u)

  const projeto = p => (
    <div
      className={'ag' + (p.restrito ? ' resumo-sigilo' : '')}
      key={p.codigo + p.dataEntrada}
      onClick={p.restrito ? undefined : () => go('projeto', p.codigo)}
    >
      <div>
        <b>{p.nome}</b>
        <small>
          {/* Projeto que quem olha não abre (restrito): sem função e sem link. */}
          {p.restrito ? 'Detalhes restritos' : p.funcao || 'Sem função definida'} · desde {fd(p.dataEntrada)}
          {p.dataSaida ? ` até ${fd(p.dataSaida)}` : ''}
        </small>
      </div>
      <SeloTipo p={p} />
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
      <PageBar title={meu ? 'Meu perfil' : u.nome}>
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
            {info.map(([k, v, c, rotuloCopiar]) => (
              <div key={k} className="d-flex justify-content-between align-items-center gap-3 mb-1">
                <small>{k}</small>
                <span className="text-end d-inline-flex align-items-center gap-1 pf-info-v">
                  {v}
                  {c && (
                    <button
                      className="btn btn-g btn-sm"
                      title={`Copiar ${rotuloCopiar}`}
                      aria-label={`Copiar ${rotuloCopiar}`}
                      onClick={() => copiar(c)}
                    >
                      <Ic k="copy" />
                    </button>
                  )}
                </span>
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
          <CartaoOcupacao key={codigo} codigo={codigo} inicial={ocupacaoAtual} />
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
          <AreasPessoa
            periodos={periodos}
            trainee={periodoTrainee(u)}
            podeGerir={podeGerir}
            codigoPessoa={u.codigo}
            onMudou={aoMudarPeriodos}
          />
        </div>
      </div>
      {trocandoFoto && <FotoModal aoFechar={() => setTrocandoFoto(false)} aoSalvo={aoMudarFoto} />}
    </>
  )
}
