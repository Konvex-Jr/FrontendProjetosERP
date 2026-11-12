import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import carregarPagina from './lib/carregarPagina'

// Cada página vira um arquivo separado, baixado na primeira visita. O Login fica no pacote de entrada.
const Dashboard = carregarPagina(() => import('./pages/Dashboard'))
const Projetos = carregarPagina(() => import('./pages/Projetos'))
const Projeto = carregarPagina(() => import('./pages/Projeto'))
const Tarefas = carregarPagina(() => import('./pages/Tarefas'))
const Capacitacoes = carregarPagina(() => import('./pages/Capacitacoes'))
const Estrategia = carregarPagina(() => import('./pages/Estrategia'))
const Gestao = carregarPagina(() => import('./pages/Gestao'))
const Conhecimento = carregarPagina(() => import('./pages/Conhecimento'))
const Iniciativas = carregarPagina(() => import('./pages/Iniciativas'))
const Precificacao = carregarPagina(() => import('./pages/Precificacao'))
const Pessoas = carregarPagina(() => import('./pages/Pessoas'))
const Perfil = carregarPagina(() => import('./pages/Perfil'))
const Configuracoes = carregarPagina(() => import('./pages/Configuracoes'))

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
        <Route path="capacitacoes/:id" element={<Capacitacoes />} />
        <Route path="conhecimento" element={<Conhecimento />} />
        <Route path="conhecimento/:id" element={<Conhecimento />} />
        <Route path="iniciativas" element={<Iniciativas />} />
        <Route path="iniciativas/:id" element={<Iniciativas />} />
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
