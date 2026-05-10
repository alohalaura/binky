import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './styles/index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { PersistedQueryClientProvider } from './lib/queryClient.jsx'

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PersistedQueryClientProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </PersistedQueryClientProvider>
  </StrictMode>,
)
