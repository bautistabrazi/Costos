import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button,Field } from '../components/ui'
export default function UpdatePasswordPage(){const[password,setPassword]=useState(''),[error,setError]=useState('');const{updatePassword}=useAuth();const navigate=useNavigate();return <main className="center-page"><form className="auth-form" onSubmit={async e=>{e.preventDefault();const{error:err}=await updatePassword(password);if(err)setError(err.message);else navigate('/')}}><h1>Nueva contraseña</h1><Field label="Contraseña" error={error}><input type="password" minLength="8" required value={password} onChange={e=>setPassword(e.target.value)}/></Field><Button>Guardar contraseña</Button></form></main>}
