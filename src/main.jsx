import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { getTheme, applyTheme, getThemeEventName } from '@/lib/theme'

// Default light for everyone; user can change in Settings
applyTheme(getTheme());
window.addEventListener(getThemeEventName(), (e) => applyTheme(e.detail));

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
