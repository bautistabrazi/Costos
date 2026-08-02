import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({plugins:[react(),tailwindcss(),VitePWA({registerType:'autoUpdate',includeAssets:['icons/icon-192.png','icons/icon-512.png'],manifest:{name:'Faro · Control de gastos',short_name:'Faro',description:'Gastos, tarjetas, cuotas y próximos pagos.',theme_color:'#161b2e',background_color:'#f5f7fb',display:'standalone',start_url:'/',lang:'es-AR',icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},workbox:{navigateFallback:'/index.html',runtimeCaching:[{urlPattern:/^https:\/\/.*\.supabase\.co\/rest\/v1\//,handler:'NetworkFirst',options:{cacheName:'supabase-data',networkTimeoutSeconds:5,expiration:{maxEntries:80,maxAgeSeconds:86400}}}]}})]})
