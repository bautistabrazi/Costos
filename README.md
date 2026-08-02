# Faro · Organizador de gastos

Faro es una PWA responsive para registrar gastos personales, administrar tarjetas de crédito, controlar cuotas, anticipar vencimientos y comparar presupuestos. La interfaz está en español y usa ARS, formato monetario argentino y la zona horaria de Buenos Aires de manera predeterminada.

## Funciones incluidas

- Registro, inicio de sesión, recuperación de contraseña y rutas privadas con Supabase Auth.
- Dashboard mensual con gastos, pendientes, compromisos futuros, categorías y actividad reciente.
- Alta, edición y eliminación de tarjetas sin almacenar números completos ni códigos de seguridad.
- Registro manual de consumos por efectivo, crédito, débito, transferencia y billeteras.
- Planes de cuotas con distribución exacta de centavos y calendario de vencimientos.
- Cálculo de resumen según fecha de compra y día de cierre, con corrección manual del período.
- Historial con búsqueda, filtros por mes, categoría, medio e importe.
- Presupuestos generales, por categoría o medio de pago, con alertas visuales.
- Gastos recurrentes y generación idempotente de los próximos 12 meses.
- Próximos pagos agrupados por semana, mes, mes siguiente y vencidos.
- Informes de categorías, medios de pago y evolución de seis meses.
- Exportación CSV y JSON e importación validada de respaldos JSON.
- Tema claro/oscuro, navegación de escritorio y barra inferior móvil.
- PWA instalable, shell offline, caché de última lectura y cola IndexedDB para nuevos consumos.

## Tecnologías

React 19, Vite 8, JavaScript, Tailwind CSS 4, React Router, Supabase, PostgreSQL, Recharts, Lucide React, date-fns, IndexedDB y vite-plugin-pwa. Las versiones resueltas están fijadas en `pnpm-lock.yaml`.

## Requisitos

- Node.js 20.19 o posterior.
- pnpm 10 o posterior.
- Un proyecto de Supabase.

## Instalación local

1. Instalá las dependencias:

   ```bash
   pnpm install
   ```

2. Copiá `.env.example` como `.env`:

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANON
   ```

3. En Supabase, abrí **SQL Editor**, copiá el contenido de `supabase/migrations/001_initial_schema.sql` y ejecutalo una vez.

4. En **Authentication → URL Configuration**, configurá:

   - Site URL: `http://localhost:5173`
   - Redirect URL: `http://localhost:5173/actualizar-clave`

5. Iniciá la aplicación:

   ```bash
   pnpm dev
   ```

La aplicación muestra instrucciones de configuración si las variables de Supabase están vacías.

## Modelo de datos

- `profiles`: preferencias regionales y personales.
- `accounts`: cuentas o fuentes de fondos.
- `credit_cards`: metadatos seguros de tarjetas; solo últimos cuatro dígitos.
- `categories`: categorías iniciales y personalizadas.
- `transactions`: compra original y medio de pago.
- `installment_plans` / `installments`: plan y vencimientos individuales.
- `recurring_expenses`: definición del gasto periódico.
- `scheduled_payments`: resúmenes, servicios y pagos programados.
- `budgets`: límites mensuales por alcance.
- `tags` / `transaction_tags`: etiquetado muchos-a-muchos.

Todas las tablas privadas incluyen `user_id`. Las políticas RLS restringen lectura y escritura a `auth.uid()`. La base también valida importes, cuotas, propiedad de referencias, formato de períodos y últimos cuatro dígitos.

## Cierres y cuotas

Para una compra con tarjeta:

- Si el día de compra es menor o igual al cierre, se asigna al resumen del mes de compra.
- Si es posterior, se asigna al resumen siguiente.
- Si el vencimiento ocurre antes o el mismo día que el cierre, se calcula en el mes posterior al resumen.
- Los días 29, 30 o 31 se ajustan al último día real del mes.
- Un período indicado manualmente tiene prioridad y queda marcado como corregido.

Las compras en cuotas se dividen en centavos enteros. Cualquier diferencia queda en la última cuota, evitando errores de redondeo. Los informes mensuales deben contabilizar la cuota del período, no volver a sumar el total original.

## Funcionamiento offline

El service worker guarda el shell de la aplicación y aplica una estrategia de red primero para lecturas de Supabase. La última respuesta consolidada se conserva en IndexedDB por usuario. Si se registra un consumo sin conexión, se guarda con un `client_id` UUID y se reintenta al recuperar internet. La restricción única `(user_id, client_id)` evita duplicados durante los reintentos.

La autenticación inicial y operaciones distintas del alta de consumos requieren conexión.

## Notificaciones

La primera versión deja configurada la preferencia del usuario y muestra vencimientos dentro de la aplicación. Las notificaciones web locales solo pueden programarse mientras el navegador o la PWA tienen oportunidad de ejecutar código.

Para notificaciones push confiables con la aplicación cerrada se necesita:

- solicitar permiso explícito al usuario;
- guardar suscripciones Web Push;
- una Edge Function o servidor programado;
- claves VAPID y envío desde un entorno seguro.

Las claves privadas nunca deben incluirse en el cliente.

## Exportación e importación

- CSV: exporta movimientos para análisis en una hoja de cálculo.
- JSON: genera un respaldo versionado de los datos principales.
- Importación: acepta únicamente respaldos con `app: "faro"`, versión compatible y todas las colecciones esperadas. Solicita confirmación antes de escribir.

La importación usa funciones SQL y RLS; no confía solamente en la validación del navegador.

## Calidad

```bash
pnpm lint
pnpm test
pnpm build
```

Las pruebas verifican el cambio de resumen después del cierre y la conservación exacta de centavos al dividir cuotas.

## Despliegue

1. Ejecutá `pnpm build`.
2. Publicá la carpeta `dist` en Vercel, Netlify, Cloudflare Pages u otro hosting estático.
3. Configurá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el proveedor.
4. Agregá la URL pública y `/actualizar-clave` a las URLs permitidas de Supabase Auth.
5. Forzá HTTPS; es necesario para service workers e instalación PWA fuera de localhost.

## Instalar la PWA

- **Windows/Android:** abrí la URL en Chrome o Edge y elegí “Instalar Faro”.
- **iPhone/iPad:** abrí en Safari, usá Compartir y elegí “Agregar a pantalla de inicio”.
- **Escritorio:** también puede aparecer un icono de instalación en la barra de direcciones.

## Seguridad

No se almacenan números completos, CVV, claves bancarias ni contraseñas de entidades financieras. La clave anónima de Supabase está diseñada para estar en el cliente; la seguridad real depende de RLS. Nunca agregues la `service_role` al frontend ni al repositorio.
