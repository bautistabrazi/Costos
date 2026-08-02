import { del,get,set } from 'idb-keyval'
import { supabase } from '../lib/supabase'
const TABLES=['profiles','credit_cards','categories','transactions','installment_plans','installments','budgets','scheduled_payments','recurring_expenses','tags']
const cacheKey=userId=>`faro-data-v1-${userId}`,queueKey=userId=>`faro-offline-queue-v1-${userId}`
export async function fetchAll(userId){await supabase.rpc('generate_recurring_payments');const requests=TABLES.map(table=>supabase.from(table).select('*').eq('user_id',userId).order('created_at',{ascending:false}));const results=await Promise.all(requests);const failed=results.find(result=>result.error);if(failed)throw failed.error;const data=Object.fromEntries(TABLES.map((table,index)=>[table,results[index].data||[]]));await set(cacheKey(userId),data);return data}
export const getCachedData=userId=>get(cacheKey(userId))
export async function saveRecord(table,record,userId){const payload={...record,user_id:userId};const{data,error}=await supabase.from(table).upsert(payload,{onConflict:'id'}).select().single();if(error)throw error;return data}
export async function removeRecord(table,id){const{error}=await supabase.from(table).delete().eq('id',id);if(error)throw error}
export async function createTransaction(payload,userId){const{data,error}=await supabase.rpc('create_transaction_with_installments',{p_payload:{...payload,user_id:userId}});if(error)throw error;return data}
export async function queueOffline(payload,userId){const key=queueKey(userId),queue=(await get(key))||[];await set(key,[...queue,payload])}
export async function syncQueue(userId){const key=queueKey(userId),queue=(await get(key))||[];if(!queue.length)return 0;const remaining=[];let synced=0;for(const item of queue){try{await createTransaction(item,userId);synced++}catch{remaining.push(item)}}if(remaining.length)await set(key,remaining);else await del(key);return synced}
export async function exportData(userId){return fetchAll(userId)}
