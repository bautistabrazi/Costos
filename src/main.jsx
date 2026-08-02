import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ThemeProvider } from './context/ThemeContext'
import AppRoutes from './routes/AppRoutes'
import './styles/index.css'
registerSW({immediate:true})
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><ThemeProvider><AuthProvider><DataProvider><AppRoutes/></DataProvider></AuthProvider></ThemeProvider></BrowserRouter></React.StrictMode>)
