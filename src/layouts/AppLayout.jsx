import { NavLink,Outlet,useLocation,useNavigate } from 'react-router-dom'
import { BarChart3,CalendarDays,CreditCard,History,House,Menu,Plus,Repeat2,Settings,Tags,WalletCards,X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { cx } from '../utils/format'
const nav=[['/','Inicio',House],['/movimientos','Movimientos',History],['/tarjetas','Tarjetas',CreditCard],['/proximos-pagos','Próximos pagos',CalendarDays],['/presupuestos','Presupuestos',WalletCards],['/recurrentes','Recurrentes',Repeat2],['/categorias','Categorías',Tags],['/informes','Informes',BarChart3],['/configuracion','Configuración',Settings]]
export default function AppLayout(){const[open,setOpen]=useState(false);const{user}=useAuth();const{offline,error}=useData();const navigate=useNavigate();const loc=useLocation();return <div className="app-shell">
 <aside className={cx('sidebar',open&&'is-open')}><div className="brand"><span>F</span><div><strong>Faro</strong><small>Control de gastos</small></div><button className="mobile-close" onClick={()=>setOpen(false)}><X/></button></div><nav>{nav.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/'} onClick={()=>setOpen(false)}><Icon size={19}/>{label}</NavLink>)}</nav><div className="sidebar-user"><span>{user?.email?.[0]?.toUpperCase()}</span><div><strong>{user?.user_metadata?.full_name||'Mi cuenta'}</strong><small>{user?.email}</small></div></div></aside>
 <main className="main"><header className="topbar"><button className="menu-button" onClick={()=>setOpen(true)}><Menu/></button><div className="status">{offline&&<span className="offline-dot">Sin conexión</span>}{error&&!offline&&<span>{error}</span>}</div><button className="button button--primary desktop-add" onClick={()=>navigate('/agregar')}><Plus size={18}/>Nuevo gasto</button></header><div className="content" key={loc.pathname}><Outlet/></div></main>
 <nav className="bottom-nav">{nav.slice(0,2).map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/'}><Icon/><span>{label}</span></NavLink>)}<NavLink className="add-nav" to="/agregar"><Plus/></NavLink><NavLink to="/proximos-pagos"><CalendarDays/><span>Pagos</span></NavLink><NavLink to="/configuracion"><Settings/><span>Ajustes</span></NavLink></nav>
 </div>}
