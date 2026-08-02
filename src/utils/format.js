import { format,parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
export const money=(value=0,currency='ARS')=>new Intl.NumberFormat('es-AR',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value)||0)
export const shortDate=value=>value?format(typeof value==='string'?parseISO(value):value,'dd/MM/yyyy',{locale:es}):'—'
export const monthKey=(date=new Date())=>format(date,'yyyy-MM')
export const monthLabel=(date=new Date())=>format(date,'MMMM yyyy',{locale:es})
export const paymentLabel=(value,methods)=>methods.find(([key])=>key===value)?.[1]||value
export const cx=(...parts)=>parts.filter(Boolean).join(' ')
