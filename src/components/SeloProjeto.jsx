import { chip } from '../lib/utils'
import { COR_STATUS_PROJETO, rotuloStatusProjeto } from '../services/projetos'
import { rotuloTipo } from '../lib/projetosInternos'

/** Status do projeto como chip, com a cor de cada status. */
export const StatusProjeto = ({ s }) => <span className={chip(COR_STATUS_PROJETO[s])}>{rotuloStatusProjeto(s)}</span>

/** Tipo do projeto: Cliente, Interno ou Geral da área (`p` com `tipo` e `geralDaArea`). */
export const SeloTipo = ({ p }) => <span className={chip()}>{rotuloTipo(p)}</span>
