import { useMemo,useState } from 'react'
import { addMonths,eachDayOfInterval,endOfMonth,format,getDay,startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays,ChevronLeft,ChevronRight,ReceiptText,TrendingUp } from 'lucide-react'
import { Button,Card,EmptyState,PageHeader } from '../components/ui'
import { useData } from '../context/DataContext'
import { money,paymentLabel,shortDate } from '../utils/format'
import { PAYMENT_METHODS } from '../constants/app'

const weekdays=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

export default function CalendarPage(){
 const data=useData()
 const[visibleMonth,setVisibleMonth]=useState(startOfMonth(new Date()))
 const[selectedDate,setSelectedDate]=useState(format(new Date(),'yyyy-MM-dd'))
 const monthKey=format(visibleMonth,'yyyy-MM')
 const days=eachDayOfInterval({start:startOfMonth(visibleMonth),end:endOfMonth(visibleMonth)})
 const leading=(getDay(startOfMonth(visibleMonth))+6)%7
 const monthTransactions=useMemo(()=>data.transactions.filter(item=>item.purchase_date?.startsWith(monthKey)),[data.transactions,monthKey])
 const byDate=useMemo(()=>monthTransactions.reduce((groups,item)=>{(groups[item.purchase_date]??=[]).push(item);return groups},{}),[monthTransactions])
 const activeDays=Object.keys(byDate).length
 const total=monthTransactions.reduce((sum,item)=>sum+Number(item.amount),0)
 const dailyTotals=Object.entries(byDate).map(([date,items])=>({date,total:items.reduce((sum,item)=>sum+Number(item.amount),0)}))
 const highest=dailyTotals.sort((a,b)=>b.total-a.total)[0]
 const selected=byDate[selectedDate]||[]
 const selectedTotal=selected.reduce((sum,item)=>sum+Number(item.amount),0)
 const changeMonth=amount=>{const next=startOfMonth(addMonths(visibleMonth,amount));setVisibleMonth(next);setSelectedDate(format(next,'yyyy-MM-dd'))}
 return <><PageHeader eyebrow="Vista mensual" title="Calendario de gastos" description="Cada consumo aparece en el día en que lo realizaste." action={<div className="calendar-nav"><Button variant="ghost" aria-label="Mes anterior" onClick={()=>changeMonth(-1)}><ChevronLeft/></Button><strong>{format(visibleMonth,'MMMM yyyy',{locale:es})}</strong><Button variant="ghost" aria-label="Mes siguiente" onClick={()=>changeMonth(1)}><ChevronRight/></Button></div>}/>
  <div className="calendar-metrics"><Card><ReceiptText/><span>Total del mes</span><strong>{money(total)}</strong><small>{monthTransactions.length} consumos registrados</small></Card><Card><CalendarDays/><span>Promedio por día con gastos</span><strong>{money(activeDays?total/activeDays:0)}</strong><small>{activeDays} días con actividad</small></Card><Card><TrendingUp/><span>Día de mayor gasto</span><strong>{highest?money(highest.total):money(0)}</strong><small>{highest?shortDate(highest.date):'Sin actividad todavía'}</small></Card></div>
  <div className="calendar-layout"><Card className="calendar-card"><div className="calendar-weekdays">{weekdays.map(day=><span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({length:leading},(_,index)=><span className="calendar-blank" key={'blank-'+index}/>)}
   {days.map(day=>{const key=format(day,'yyyy-MM-dd'),items=byDate[key]||[],dayTotal=items.reduce((sum,item)=>sum+Number(item.amount),0),isSelected=key===selectedDate,isToday=key===format(new Date(),'yyyy-MM-dd');return <button type="button" key={key} className={'calendar-day'+(isSelected?' is-selected':'')+(isToday?' is-today':'')} onClick={()=>setSelectedDate(key)}><span className="calendar-day-number">{format(day,'d')}</span>{items.slice(0,2).map(item=><span className="calendar-entry" key={item.id} style={{'--entry-color':data.categories.find(category=>category.id===item.category_id)?.color||'#747b91'}}>{item.description}</span>)}{items.length>2&&<small>+{items.length-2} más</small>}{items.length>0&&<strong>{money(dayTotal)}</strong>}</button>})}
  </div></Card>
  <Card className="calendar-detail"><span className="eyebrow">Detalle del día</span><h2>{shortDate(selectedDate)}</h2><div className="calendar-detail-total"><span>Total gastado</span><strong>{money(selectedTotal)}</strong></div>{selected.length?<div className="transaction-list">{selected.map(item=><div className="transaction-row" key={item.id}><span className="transaction-icon" style={{background:data.categories.find(category=>category.id===item.category_id)?.color||'#747b91'}}><ReceiptText/></span><div><strong>{item.description}</strong><small>{item.merchant||paymentLabel(item.payment_method,PAYMENT_METHODS)}</small></div><strong>{money(item.amount,item.currency)}</strong></div>)}</div>:<EmptyState icon={CalendarDays} title="Día sin consumos" text="No registraste gastos en esta fecha."/>}</Card>
  </div>
 </>}
