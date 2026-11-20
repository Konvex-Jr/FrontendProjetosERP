import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import {
  Biblioteca,
  Capacitacoes,
  Configuracoes,
  CriarSenha,
  Dashboard,
  EsqueciSenha,
  Estrategia,
  Perfil,
  Pessoas,
  Precificacao,
  Projeto,
  Projetos,
  Tarefas,
} from './paginas'

// As páginas (arquivos separados, baixados sob demanda) estão em src/paginas.js. O Login fica no pacote de entrada.

/**
 * Rotas do app (HashRouter: os endereços ficam como /#/tarefas). O Login fica fora do Layout;
 * o Layout exige login e só abre telas que vieram no menu da pessoa.
 * Rotas com :id usam a mesma página, que mostra a lista ou a ficha conforme o parâmetro.
 * Tela nova: página em src/paginas.js (e no PAGINAS, se estiver no menu) + rota aqui + item no registro de módulos do backend + ícone em components/Icon.jsx.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/senha/:token"
        element={
          <Suspense fallback={null}>
            <CriarSenha />
          </Suspense>
        }
      />
      <Route
        path="/esqueci-senha"
        element={
          <Suspense fallback={null}>
            <EsqueciSenha />
          </Suspense>
        }
      />
      {/* Telas que viraram a Biblioteca (sessão 17), para não quebrar favoritos. Ficam fora do Layout:
          ele manda para / qualquer seção que não está no menu antes de a rota filha abrir. */}
      {['gestao', 'conhecimento', 'iniciativas'].map(antiga => (
        <Route key={antiga} path={`/${antiga}/*`} element={<Navigate to="/biblioteca" replace />} />
      ))}
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tarefas" element={<Tarefas />} />
        <Route path="projetos" element={<Projetos />} />
        <Route path="projetos/:id" element={<Projeto />} />
        <Route path="capacitacoes" element={<Capacitacoes />} />
        <Route path="capacitacoes/:id" element={<Capacitacoes />} />
        <Route path="biblioteca" element={<Biblioteca />} />
        <Route path="biblioteca/:id" element={<Biblioteca />} />
        <Route path="estrategia" element={<Estrategia />} />
        <Route path="precificacao" element={<Precificacao />} />
        <Route path="usuarios" element={<Pessoas />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="perfil/:codigo" element={<Perfil />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      {/* Endereço desconhecido volta ao Dashboard. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
