import { lazy,Suspense } from 'react'
import { Navigate,Route,Routes } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../layouts/AppLayout'
const AuthPage=lazy(()=>import('../pages/AuthPage'))
const DashboardPage=lazy(()=>import('../pages/DashboardPage'))
const TransactionsPage=lazy(()=>import('../pages/TransactionsPage'))
const TransactionFormPage=lazy(()=>import('../pages/TransactionFormPage'))
const CardsPage=lazy(()=>import('../pages/CardsPage'))
const CategoriesPage=lazy(()=>import('../pages/CategoriesPage'))
const PaymentsPage=lazy(()=>import('../pages/PaymentsPage'))
const BudgetsPage=lazy(()=>import('../pages/BudgetsPage'))
const ReportsPage=lazy(()=>import('../pages/ReportsPage'))
const SettingsPage=lazy(()=>import('../pages/SettingsPage'))
const RecurringPage=lazy(()=>import('../pages/RecurringPage'))
const UpdatePasswordPage=lazy(()=>import('../pages/UpdatePasswordPage'))
function Protected({children}){const{user,loading,configured}=useAuth();if(loading)return <div className="splash"><span className="brand-mark">F</span><p>Preparando tu espacio…</p></div>;if(!configured)return <AuthPage configuration/>;return user?children:<Navigate to="/acceso" replace/>}
export default function AppRoutes(){const{user}=useAuth();return <Suspense fallback={<div className="splash"><span className="brand-mark">F</span><p>Cargando…</p></div>}><Routes><Route path="/acceso" element={user?<Navigate to="/"/>:<AuthPage/>}/><Route path="/actualizar-clave" element={<UpdatePasswordPage/>}/><Route element={<Protected><AppLayout/></Protected>}><Route index element={<DashboardPage/>}/><Route path="movimientos" element={<TransactionsPage/>}/><Route path="agregar" element={<TransactionFormPage/>}/><Route path="tarjetas" element={<CardsPage/>}/><Route path="categorias" element={<CategoriesPage/>}/><Route path="proximos-pagos" element={<PaymentsPage/>}/><Route path="presupuestos" element={<BudgetsPage/>}/><Route path="recurrentes" element={<RecurringPage/>}/><Route path="informes" element={<ReportsPage/>}/><Route path="configuracion" element={<SettingsPage/>}/></Route><Route path="*" element={<Navigate to="/"/>}/></Routes></Suspense>}
