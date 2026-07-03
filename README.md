# Organizador de gastos

App para registrar gastos diarios, compras con tarjeta en cuotas y ver resumen mensual/proyeccion con sincronizacion en Supabase.

## Como usar

1. Abrir `index.html` en el navegador.
2. Elegir el mes desde el selector superior.
3. Cargar gastos diarios desde la pestana `Gastos`; los montos se formatean como pesos con separador de miles.
4. Crear tus tarjetas desde la pestana `Tarjetas`.
5. Elegir una tarjeta y cargar compras asociadas a esa tarjeta.
6. Usar `Pagar` para marcar una cuota como pagada.
7. Revisar la pestana `Proyeccion` para ver los proximos 12 meses.
8. Cambiar entre tema claro y oscuro desde el boton superior.

Los datos se guardan en Supabase cuando `config.js` tiene la URL y anon key del proyecto.

## Supabase

Para sincronizar entre dispositivos:

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase-schema.sql` en el SQL Editor del proyecto.
3. Copiar `config.example.js` a `config.js`.
4. Completar `url` y `anonKey` con los datos del proyecto.
5. En Supabase Auth, agregar la URL de Vercel como redirect URL permitida.

## Proximos pasos posibles

- Exportar e importar datos desde Excel.
- Agregar categorias y medios de pago personalizables.
- Separar gastos fijos mensuales de gastos diarios.
- Publicarla como PWA para instalarla en el celular.
- Sincronizar datos entre computadora y telefono.
