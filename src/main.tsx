import React from 'react'
import ReactDOM from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

// The service worker is not optional (CLAUDE.md, "Never do"). It is registered
// unconditionally; updates apply on next load.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
