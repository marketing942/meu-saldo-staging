import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import './styles/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ErroDeConfiguracao } from './app/ErroDeConfiguracao'
import { validarAmbiente } from './lib/env'

const elemento = document.getElementById('root')
if (!elemento) throw new Error('Elemento #root não encontrado no index.html.')
const raiz = createRoot(elemento)

const ambiente = validarAmbiente()

if (!ambiente.ok) {
  raiz.render(<ErroDeConfiguracao problemas={ambiente.problemas} />)
} else {
  // Só carrega Supabase, roteador e telas depois de validar o ambiente.
  const [{ App }, { iniciarMonitoramento }] = await Promise.all([
    import('./app/App'),
    import('./lib/monitoramento'),
    import('./stores/ui'),
  ])
  void iniciarMonitoramento()
  raiz.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
