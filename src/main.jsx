import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const applySystemTheme = () => {
  const root = document.documentElement;
  const savedTheme = window.localStorage.getItem('pulse-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = savedTheme ? savedTheme === 'dark' : prefersDark;

  root.classList.toggle('dark', useDark);
  root.style.colorScheme = useDark ? 'dark' : 'light';
};

applySystemTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
