import { useNavigate } from 'react-router-dom'
import Ic from './Icon'

const TEXTOS = {
  inexistente: {
    icone: 'link',
    titulo: 'Essa página não existe',
    texto: 'O endereço pode estar errado ou a página mudou de lugar. Volte ao início e siga pelo menu.',
  },
  'sem-acesso': {
    icone: 'lock',
    titulo: 'Esta tela não está liberada para você',
    texto: 'Ela depende do seu papel na Konvex. Se precisar dela no dia a dia, fale com a gestão.',
  },
}

/** Tela de "página não existe" (`tipo="inexistente"`) ou "sem acesso" dentro do Layout, com o botão de voltar ao início (27c). */
export default function TelaAviso({ tipo }) {
  const navigate = useNavigate(),
    { icone, titulo, texto } = TEXTOS[tipo]
  return (
    <section className="tela-aviso">
      <span className="tela-aviso-ic" aria-hidden="true">
        <Ic k={icone} />
      </span>
      <h1>{titulo}</h1>
      <p>{texto}</p>
      <button type="button" className="btn btn-dk" onClick={() => navigate('/')}>
        Ir para o início
      </button>
    </section>
  )
}
