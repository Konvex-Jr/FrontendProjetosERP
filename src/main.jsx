import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/inter'
import 'bootstrap/dist/css/bootstrap.min.css'
// A ordem dos CSS importa: cada arquivo pode sobrescrever os anteriores (responsive.css vem depois dos estilos base).
import './styles/theme.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/responsive.css'
import './styles/konvex.css'
import { AppProvider } from './context/AppContext'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <AppProvider>
      <App />
    </AppProvider>
  </HashRouter>,
)
