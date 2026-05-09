# Quickly — Cómo arrancar el proyecto

Aplicación web de gestión de repartos y logística (React 19 + TypeScript + Vite + Tailwind + Supabase + Stripe).

## Pasos para ponerla en marcha

Abre una terminal en esta carpeta (`RepartoPro`) y ejecuta:

```bash
# 1. Instalar dependencias (~2–4 min la primera vez)
npm install

# 2. Levantar el servidor de desarrollo
npm run dev
```

Abre la URL que muestra Vite (normalmente `http://localhost:5173`).

## Otros comandos útiles

```bash
npm run build       # Build de producción a /dist
npm run preview     # Sirve el build para probarlo
npm run type-check  # Verifica TypeScript sin compilar
npm run lint        # Linter
```

## Variables de entorno

El archivo `.env` ya viene con las claves de Supabase del zip. Si necesitas
cambiar de proyecto Supabase, edita:

```
VITE_PUBLIC_SUPABASE_URL=...
VITE_PUBLIC_SUPABASE_ANON_KEY=...
```

## Estructura

- `src/pages/` — 34 apartados (clientes, rutas, pedidos, facturación, mapa-reparto, calendario, etc.)
- `src/components/` — Layout, Sidebar, Navbar, modales, etc.
- `src/context/` — Auth, Notifications
- `src/hooks/` — useProfile, useRole, usePremium, useNotifications, etc.
- `src/lib/` — supabase client, permisos, gravatar
- `src/mocks/` — datos de ejemplo
- `src/router/` — configuración de rutas con guards por rol
- `supabase/functions/` — Edge Functions (Stripe checkout, verificación de suscripción)

## Sistema de roles

Tres roles: **Empresa** (admin), **Empleado**, **Cliente**. El rol se asigna en
la tabla `profiles` de Supabase (campo `role`). Ver `project_plan.md` para el
detalle de qué apartados ve cada rol.

## Nota

Intenté correr `npm install` automáticamente pero el sandbox tiene un límite de
45s por comando, insuficiente para descargar todas las dependencias (React 19,
Firebase, Supabase, Stripe, Recharts, i18next, Tailwind...). Por eso te dejo el
proyecto extraído tal cual y tú haces `npm install` localmente, que sí tiene
todo el tiempo que necesite.
