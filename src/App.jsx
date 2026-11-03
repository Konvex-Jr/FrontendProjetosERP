import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projetos from './pages/Projetos'
import Projeto from './pages/Projeto'
import Tarefas from './pages/Tarefas'
import Capacitacoes from './pages/Capacitacoes'
import Estrategia from './pages/Estrategia'
import Gestao from './pages/Gestao'
import Conhecimento from './pages/Conhecimento'
import Precificacao from './pages/Precificacao'
import Pessoas from './pages/Pessoas'
import Perfil from './pages/Perfil'
import Configuracoes from './pages/Configuracoes'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tarefas" element={<Tarefas />} />
        <Route path="projetos" element={<Projetos />} />
        <Route path="projetos/:id" element={<Projeto />} />
        <Route path="capacitacoes" element={<Capacitacoes />} />
        <Route path="conhecimento" element={<Conhecimento />} />
        <Route path="conhecimento/:id" element={<Conhecimento />} />
        <Route path="estrategia" element={<Estrategia />} />
        <Route path="gestao" element={<Gestao />} />
        <Route path="precificacao" element={<Precificacao />} />
        <Route path="usuarios" element={<Pessoas />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="perfil/:codigo" element={<Perfil />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
