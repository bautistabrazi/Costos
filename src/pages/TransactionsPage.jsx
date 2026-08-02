import { useMemo,useState } from 'react'
import { Download,Filter,ReceiptText,Search,Trash2 } from 'lucide-react'
import { Badge,Button,Card,EmptyState,PageHeader } from '../components/ui'
import { PAYMENT_METHODS } from '../constants/app'
import { useData } from '../context/DataContext'
import { money,paymentLabel,shortDate } from '../utils/format'

const initialFilters={q:'',start:'',end:'',month:'',category:'',card:'',method:'',min:'',max:'',installment:'',recurring:'',status:'',sort:'date_desc'}

export default function TransactionsPage(){
 const data=useData(),[filters,setFilters]=useState(initialFilters)
 const rows=useMemo(()=>{
  const filtered=data.transactions.filter(transaction=>{
   const text=[transaction.description,transaction.merchant,transaction.notes].join(' ').toLowerCase()
   return(!filters.q||text.includes(filters.q.toLowerCase()))&&(!filters.start||transaction.purchase_date>=filters.start)&&(!filters.end||transaction.purchase_date<=filters.end)&&(!filters.month||transaction.purchase_date?.startsWith(filters.month))&&(!filters.category||transaction.category_id===filters.category)&&(!filters.card||transaction.credit_card_id===filters.card)&&(!filters.method||transaction.payment_method===filters.method)&&(!filters.min||Number(transaction.amount)>=Number(filters.min))&&(!filters.max||Number(transaction.amount)<=Number(filters.max))&&(!filters.installment||(filters.installment==='yes'?transaction.installment_count>1:transaction.installment_count===1))&&(!filters.recurring||(filters.recurring==='yes'?transaction.is_recurring:!transaction.is_recurring))&&(!filters.status||transactionPaymentStatus(transaction,data)===filters.status)
  })
  return filtered.sort((a,b)=>filters.sort==='amount_desc'?Number(b.amount)-Number(a.amount):filters.sort==='amount_asc'?Number(a.amount)-Number(b.amount):filters.sort==='merchant'?(a.merchant||'').localeCompare(b.merchant||''):filters.sort==='category'?(data.categories.find(c=>c.id===a.category_id)?.name||'').localeCompare(data.categories.find(c=>c.id===b.category_id)?.name||''):b.purchase_date.localeCompare(a.purchase_date))
 },[data,filters])
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}))
 const exportCsv=()=>{const head=['fecha','descripcion','comercio','importe','moneda','medio_pago'];const body=rows.map(item=>[item.purchase_date,item.description,item.merchant||'',item.amount,item.currency,item.payment_method]);download('movimientos.csv',[head,...body].map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv')}
 return <><PageHeader eyebrow="Historial" title="Todos tus movimientos" description={rows.length+' consumos encontrados'} action={<Button variant="secondary" onClick={exportCsv}><Download/>Exportar vista</Button>}/>
  <Card className="filters"><div className="search-box"><Search/><input placeholder="Buscar descripción, comercio o nota…" value={filters.q} onChange={e=>set('q',e.target.value)}/></div><div className="filter-grid">
   <label><Filter/>Desde<input type="date" value={filters.start} onChange={e=>set('start',e.target.value)}/></label><label>Hasta<input type="date" value={filters.end} onChange={e=>set('end',e.target.value)}/></label><input type="month" aria-label="Mes" value={filters.month} onChange={e=>set('month',e.target.value)}/>
   <select aria-label="Categoría" value={filters.category} onChange={e=>set('category',e.target.value)}><option value="">Todas las categorías</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
   <select aria-label="Tarjeta" value={filters.card} onChange={e=>set('card',e.target.value)}><option value="">Todas las tarjetas</option>{data.credit_cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
   <select aria-label="Medio de pago" value={filters.method} onChange={e=>set('method',e.target.value)}><option value="">Todos los medios</option>{PAYMENT_METHODS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
   <input type="number" aria-label="Importe mínimo" placeholder="Importe mín." value={filters.min} onChange={e=>set('min',e.target.value)}/><input type="number" aria-label="Importe máximo" placeholder="Importe máx." value={filters.max} onChange={e=>set('max',e.target.value)}/>
   <select aria-label="Compra en cuotas" value={filters.installment} onChange={e=>set('installment',e.target.value)}><option value="">Cuotas: todas</option><option value="yes">En cuotas</option><option value="no">Sin cuotas</option></select>
   <select aria-label="Gasto recurrente" value={filters.recurring} onChange={e=>set('recurring',e.target.value)}><option value="">Recurrencia: todas</option><option value="yes">Recurrentes</option><option value="no">No recurrentes</option></select>
   <select aria-label="Estado de pago" value={filters.status} onChange={e=>set('status',e.target.value)}><option value="">Todos los estados</option><option value="pending">Pendientes</option><option value="paid">Pagados</option></select>
   <select aria-label="Orden" value={filters.sort} onChange={e=>set('sort',e.target.value)}><option value="date_desc">Más recientes</option><option value="amount_desc">Mayor importe</option><option value="amount_asc">Menor importe</option><option value="category">Categoría</option><option value="merchant">Comercio</option></select>
  </div><button className="text-button clear-filters" onClick={()=>setFilters(initialFilters)}>Limpiar filtros</button></Card>
  <Card className="table-card">{rows.length?<div className="data-table"><div className="table-head"><span>Movimiento</span><span>Fecha</span><span>Medio</span><span>Importe</span><span/></div>{rows.map(transaction=><div className="table-row" key={transaction.id}><div><strong>{transaction.description}</strong><small>{transaction.merchant||data.categories.find(c=>c.id===transaction.category_id)?.name||'Sin categoría'}</small></div><span>{shortDate(transaction.purchase_date)}</span><Badge>{paymentLabel(transaction.payment_method,PAYMENT_METHODS)}</Badge><strong>{money(transaction.amount,transaction.currency)}</strong><button className="icon-button danger" aria-label="Eliminar" onClick={()=>confirm('¿Eliminar este consumo?')&&data.remove('transactions',transaction.id)}><Trash2/></button></div>)}</div>:<EmptyState icon={ReceiptText} title="No encontramos movimientos" text="Probá cambiando los filtros o registrá un nuevo consumo."/>}</Card>
 </>}

function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url)}
function transactionPaymentStatus(transaction,data){const plan=data.installment_plans.find(item=>item.transaction_id===transaction.id);const installments=plan?data.installments.filter(item=>item.plan_id===plan.id):[];const scheduled=data.scheduled_payments.find(item=>item.transaction_id===transaction.id);return scheduled?.status||(installments.length&&installments.every(item=>item.status==='paid')?'paid':installments.length?'pending':'paid')}
