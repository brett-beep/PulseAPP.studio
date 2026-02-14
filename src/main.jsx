import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const applySystemTheme = () => {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.classList.toggle('dark', prefersDark);
  root.style.colorScheme = prefersDark ? 'dark' : 'light';
};

applySystemTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
