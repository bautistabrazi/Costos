import { createContext,useContext,useEffect,useMemo,useState } from 'react'
import { isSupabaseConfigured,supabase } from '../lib/supabase'
const AuthContext=createContext(null)
export function AuthProvider({children}){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(isSupabaseConfigured)
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false)});return()=>subscription.unsubscribe()},[])
 const value=useMemo(()=>({session,user:session?.user||null,loading,configured:isSupabaseConfigured,
  signIn:(email,password)=>supabase.auth.signInWithPassword({email,password}),
  signUp:(email,password,name)=>supabase.auth.signUp({email,password,options:{data:{full_name:name}}}),
  resetPassword:email=>supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/actualizar-clave`}),
  updatePassword:password=>supabase.auth.updateUser({password}),signOut:()=>supabase.auth.signOut()}),[session,loading])
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth=()=>useContext(AuthContext)
