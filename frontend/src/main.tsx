import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AppProvider } from './state'
import './styles.css'
import { registerPwa } from './lib/pwa'
import { InstallAppProvider } from './InstallAppContext'

registerPwa()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><AppProvider><InstallAppProvider><App /></InstallAppProvider></AppProvider></BrowserRouter></React.StrictMode>,
)
