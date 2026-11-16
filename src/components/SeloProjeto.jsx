import { chip } from '../lib/utils'
import { COR_STATUS_PROJETO, rotuloStatusProjeto } from '../services/projetos'
import Ic from './Icon'

/** Selo dos projetos sigilosos (lista, página do projeto e perfil). */
export const SeloSigiloso = () => (
  <span className={chip() + ' selo-sigilo'} title="Projeto sigiloso">
    <Ic k="lock" />
    Sigiloso
  </span>
)

/** Status do projeto como chip, com a cor de cada status. */
export const StatusProjeto = ({ s }) => <span className={chip(COR_STATUS_PROJETO[s])}>{rotuloStatusProjeto(s)}</span>
