import { useState } from 'react'
import { CreditCard,Plus,Trash2 } from 'lucide-react'
import { Button,Card,EmptyState,Field,Modal,PageHeader } from '../components/ui'
import { useData } from '../context/DataContext'
import { money } from '../utils/format'

const blank={name:'',issuer:'',brand:'Visa',color:'#5658d4',total_limit:'',available_limit:'',currency:'ARS',active:true}

export default function CardsPage(){
 const data=useData()
 const[open,setOpen]=useState(false)
 const[form,setForm]=useState(blank)
 const[saving,setSaving]=useState(false)
 const edit=card=>{setForm(card);setOpen(true)}
 const save=async event=>{event.preventDefault();setSaving(true);await data.save('credit_cards',{...form,total_limit:Number(form.total_limit),available_limit:form.available_limit?Number(form.available_limit):null});setSaving(false);setOpen(false);setForm(blank)}
 return <><PageHeader eyebrow="Medios de pago" title="Tarjetas de crédito" description="Identificá tus tarjetas y controlá el límite utilizado sin guardar datos sensibles." action={<Button onClick={()=>setOpen(true)}><Plus/>Agregar tarjeta</Button>}/>
  {data.credit_cards.length?<div className="cards-grid">{data.credit_cards.map(card=>{
   const installmentDebt=data.installments.filter(item=>item.credit_card_id===card.id&&item.status==='pending').reduce((sum,item)=>sum+Number(item.amount),0)
   const singleDebt=data.scheduled_payments.filter(payment=>payment.status==='pending'&&data.transactions.find(transaction=>transaction.id===payment.transaction_id)?.credit_card_id===card.id).reduce((sum,payment)=>sum+Number(payment.amount),0)
   const used=installmentDebt+singleDebt
   const percentage=card.total_limit?Math.min(100,used/Number(card.total_limit)*100):0
   return <Card className="credit-card-panel" key={card.id}><div className="credit-card-visual" style={{'--card-color':card.color}} onClick={()=>edit(card)}><div><span>{card.issuer}</span><CreditCard/></div><strong>{card.name}</strong><p className="card-brand">{card.brand}</p><small>{card.currency} · Identificador interno</small></div><div className="card-stats"><span><small>Pendiente total</small><strong>{money(used,card.currency)}</strong></span><span><small>Límite disponible</small><strong>{money(Math.max(0,Number(card.total_limit)-used),card.currency)}</strong></span></div><div className="progress"><i style={{width:percentage+'%'}}/></div><div className="card-footer"><span>{percentage.toFixed(0)}% del límite utilizado</span><button className="icon-button danger" aria-label="Eliminar tarjeta" onClick={()=>confirm('¿Eliminar esta tarjeta?')&&data.remove('credit_cards',card.id)}><Trash2/></button></div></Card>
  })}</div>:<Card><EmptyState icon={CreditCard} title="Todavía no agregaste tarjetas" text="Solo necesitás un nombre identificador, el banco y la marca. No guardamos números de tarjeta." action={<Button onClick={()=>setOpen(true)}>Agregar la primera</Button>}/></Card>}
  <Modal open={open} onClose={()=>setOpen(false)} title={form.id?'Editar tarjeta':'Nueva tarjeta'}><form onSubmit={save} className="modal-form"><div className="form-grid"><Field label="Nombre identificador *"><input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Ej. Visa personal"/></Field><Field label="Banco o entidad *"><input required value={form.issuer} onChange={event=>setForm({...form,issuer:event.target.value})}/></Field><Field label="Marca"><select value={form.brand} onChange={event=>setForm({...form,brand:event.target.value})}><option>Visa</option><option>Mastercard</option><option>American Express</option><option>Otra</option></select></Field><Field label="Límite total"><input type="number" min="0" step=".01" required value={form.total_limit} onChange={event=>setForm({...form,total_limit:event.target.value})}/></Field><Field label="Límite disponible (opcional)"><input type="number" min="0" step=".01" value={form.available_limit||''} onChange={event=>setForm({...form,available_limit:event.target.value})}/></Field><Field label="Color"><input type="color" value={form.color} onChange={event=>setForm({...form,color:event.target.value})}/></Field><Field label="Moneda"><select value={form.currency} onChange={event=>setForm({...form,currency:event.target.value})}><option>ARS</option><option>USD</option></select></Field></div><label className="check-field"><input type="checkbox" checked={form.active} onChange={event=>setForm({...form,active:event.target.checked})}/>Tarjeta activa</label><div className="form-actions"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button><Button loading={saving}>Guardar</Button></div></form></Modal>
 </>}
