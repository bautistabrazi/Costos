import { createContext,useCallback,useContext,useEffect,useState } from 'react'
import { useAuth } from './AuthContext'
import * as api from '../services/dataService'
const empty={profiles:[],credit_cards:[],categories:[],transactions:[],installment_plans:[],installments:[],budgets:[],scheduled_payments:[],recurring_expenses:[],tags:[]}
const DataContext=createContext(null)
export function DataProvider({children}){const{user}=useAuth();const[data,setData]=useState(empty),[loading,setLoading]=useState(false),[error,setError]=useState(''),[offline,setOffline]=useState(!navigator.onLine)
 const refresh=useCallback(async()=>{if(!user)return;setLoading(true);setError('');try{setData(await api.fetchAll(user.id))}catch(err){const cached=await api.getCachedData(user.id);if(cached)setData(cached);setError(cached?'Mostrando la última información guardada.':err.message)}finally{setLoading(false)}},[user])
 useEffect(()=>{if(user)refresh();else setData(empty)},[user,refresh])
 useEffect(()=>{const online=async()=>{setOffline(false);if(user){await api.syncQueue(user.id);refresh()}};const off=()=>setOffline(true);addEventListener('online',online);addEventListener('offline',off);return()=>{removeEventListener('online',online);removeEventListener('offline',off)}},[user,refresh])
 useEffect(()=>{if(!user||data.profiles[0]?.notifications_enabled===false||!('Notification' in window)||Notification.permission!=='granted')return;const today=new Date(),limit=new Date();limit.setDate(limit.getDate()+3);const upcoming=data.scheduled_payments.filter(item=>item.status==='pending'&&new Date(item.due_date+'T12:00:00')>=today&&new Date(item.due_date+'T12:00:00')<=limit);if(!upcoming.length)return;const key=`faro-notified-${user.id}-${today.toISOString().slice(0,10)}`;if(localStorage.getItem(key))return;new Notification('Faro · Próximos pagos',{body:`Tenés ${upcoming.length} pago${upcoming.length===1?'':'s'} que vence${upcoming.length===1?'':'n'} en los próximos 3 días.`,icon:'/icons/icon-192.png'});localStorage.setItem(key,'1')},[data.profiles,data.scheduled_payments,user])
 const save=async(table,record)=>{const saved=await api.saveRecord(table,record,user.id);setData(prev=>({...prev,[table]:[saved,...prev[table].filter(x=>x.id!==saved.id)]}));return saved}
 const remove=async(table,id)=>{await api.removeRecord(table,id);setData(prev=>({...prev,[table]:prev[table].filter(x=>x.id!==id)}))}
 const addTransaction=async payload=>{if(!navigator.onLine){await api.queueOffline(payload,user.id);setOffline(true);return{queued:true}}await api.createTransaction(payload,user.id);await refresh();return{queued:false}}
 return <DataContext.Provider value={{...data,loading,error,offline,refresh,save,remove,addTransaction}}>{children}</DataContext.Provider>}
export const useData=()=>useContext(DataContext)
