import { useState } from 'react'
import { Plus,Repeat2,Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Button,Card,EmptyState,Field,Modal,PageHeader } from '../components/ui'
import { PAYMENT_METHODS,RECURRENCES } from '../constants/app'
import { useData } from '../context/DataContext'
import { money,shortDate } from '../utils/format'

const blank={description:'',amount:'',category_id:'',payment_method:'transfer',credit_card_id:'',currency:'ARS',frequency:'monthly',next_due_date:format(new Date(),'yyyy-MM-dd'),end_date:'',active:true}

export default function RecurringPage(){
  const data=useData()
  const[open,setOpen]=useState(false)
  const[form,setForm]=useState(blank)
  const save=async event=>{
    event.preventDefault()
    await data.save('recurring_expenses',{...form,amount:Number(form.amount),category_id:form.category_id||null,credit_card_id:form.payment_method==='credit_card'?form.credit_card_id:null,end_date:form.end_date||null})
    setOpen(false);setForm(blank);await data.refresh()
  }
  return <><PageHeader eyebrow="Automatización" title="Gastos recurrentes" description="Generá próximos vencimientos sin duplicarlos." action={<Button onClick={()=>setOpen(true)}><Plus/>Nuevo recurrente</Button>}/>
    {data.recurring_expenses.length?<div className="budget-grid">{data.recurring_expenses.map(item=><Card className="budget-card" key={item.id}><div><span className="eyebrow">{RECURRENCES.find(x=>x[0]===item.frequency)?.[1]}</span><h3>{item.description}</h3><button className="icon-button danger" onClick={()=>confirm('¿Eliminar este gasto recurrente?')&&data.remove('recurring_expenses',item.id)}><Trash2/></button></div><strong>{money(item.amount,item.currency)}</strong><p>Próximo vencimiento: {shortDate(item.next_due_date)}</p><footer><span>{PAYMENT_METHODS.find(x=>x[0]===item.payment_method)?.[1]}</span><span>{item.active?'Activo':'Inactivo'}</span></footer></Card>)}</div>:<Card><EmptyState icon={Repeat2} title="Sin gastos recurrentes" text="Agregá servicios, alquiler o suscripciones para anticipar sus vencimientos." action={<Button onClick={()=>setOpen(true)}>Agregar el primero</Button>}/></Card>}
    <Modal open={open} onClose={()=>setOpen(false)} title="Nuevo gasto recurrente"><form className="modal-form" onSubmit={save}><div className="form-grid"><Field label="Descripción *"><input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field><Field label="Importe *"><input type="number" min=".01" step=".01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></Field><Field label="Categoría"><select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">Sin categoría</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Medio de pago"><select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>{PAYMENT_METHODS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>{form.payment_method==='credit_card'&&<Field label="Tarjeta *"><select required value={form.credit_card_id} onChange={e=>setForm({...form,credit_card_id:e.target.value})}><option value="">Seleccionar</option>{data.credit_cards.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}<Field label="Frecuencia"><select value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value})}>{RECURRENCES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field><Field label="Próximo vencimiento"><input type="date" required value={form.next_due_date} onChange={e=>setForm({...form,next_due_date:e.target.value})}/></Field><Field label="Finaliza (opcional)"><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></Field></div><div className="form-actions"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button><Button>Guardar</Button></div></form></Modal>
  </>}
