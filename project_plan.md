# Plan de Proyecto: RepartoPro - Aplicación de Gestión de Reparto

## Descripción
Aplicación web de gestión de repartos y logística para empresas de reparto. Incluye gestión de clientes, rutas, pedidos, facturación, comunicación, control horario, documentos, hoja de cálculo, calendario, control de combustible, sugerencias, incidencias, incidencias de vehículo, productos y stock, asistente IA, chat interno entre empleados, correo electrónico integrado, estadísticas, cuadrante, hoja de ruta, notificaciones, perfil de empresa, gestión de empleados, configuración, términos legales y perfil de usuario.

## Stack Tecnológico
- **Frontend:** React, TypeScript, Tailwind CSS, Recharts, React Router
- **Backend/DB:** Supabase (PostgreSQL)
- **Despliegue:** Readdy.ai

## Funcionalidades Implementadas
- [x] Dashboard con estadísticas y gráficos
- [x] Gestión de Clientes
- [x] Rutas y Localización
- [x] Productos y Stock
- [x] Pedidos
- [x] Facturación y Cobros
- [x] Incidencias y Tickets
- [x] Incidencias de Vehículo
- [x] Chat Empleados (Comunicación)
- [x] Correo Electrónico (Email)
- [x] Hoja de Cálculo
- [x] Calendario
- [x] Control Horario
- [x] Documentos
- [x] Asistente IA
- [x] Sugerencias
- [x] Control de Combustible
- [x] Estadísticas
- [x] Cuadrante
- [x] Hoja de Ruta
- [x] Hoja de Pedidos
- [x] Notificaciones
- [x] Perfil Empresa
- [x] Gestión de Empleados
- [x] Perfil de Usuario
- [x] Configuración
- [x] Términos Legales / Privacidad
- [x] **Sistema de Roles (Empresa / Empleado / Cliente)**
- [ ] **Autenticación real con Supabase Auth**
- [ ] Publicación en App Stores / Google Play

## Estructura de Datos Supabase
- Tablas creadas:
  - clients, routes, route_stops, invoices, invoice_items
  - product_categories, product_items, product_variants, product_skus, product_custom_fields, product_custom_values
  - order_headers, order_items
  - fuel_tickets, vehicle_incidents, time_tracking, calendar_events, shift_schedules, shift_swaps, stock_movements
  - employees, profiles, calendar_events
- RLS: Configurado
- Edge Functions: No implementadas

## Sistema de Roles
Se ha implementado un sistema de control de acceso basado en 3 roles:

### Rol "Empresa" (Administrador)
**Acceso total a TODOS los apartados:**
- Dashboard completo
- Gestión de Clientes
- Rutas y Localización
- Productos y Stock
- Pedidos
- Facturación y Cobros
- Incidencias y Tickets
- Incidencias de Vehículo
- Hoja de Ruta
- Hoja de Pedidos
- Cuadrante
- Perfil Empresa
- Empleados
- Combustible
- Estadísticas
- Calendario
- Control Horario
- Chat Empleados
- Correo
- Notificaciones
- Documentos
- Hoja de Cálculo
- Asistente IA
- Sugerencias
- Privacidad y Términos
- Perfil
- Configuración

### Rol "Empleado"
**Acceso a operaciones y comunicación:**
- Dashboard (básico)
- Rutas y Localización
- Pedidos
- Hoja de Ruta
- Hoja de Pedidos
- Cuadrante
- Chat Empleados
- Correo
- Notificaciones
- Documentos
- Asistente IA
- Sugerencias
- Privacidad y Términos
- Calendario
- Control Horario
- Perfil
- Configuración

**NO puede ver:**
- Gestión de Clientes
- Productos y Stock
- Facturación y Cobros
- Incidencias (gestión)
- Incidencias de Vehículo
- Perfil Empresa
- Gestión de Empleados
- Combustible
- Estadísticas
- Hoja de Cálculo

### Rol "Cliente"
**Acceso limitado a sus propias operaciones:**
- Dashboard (básico)
- Pedidos (sus propios pedidos)
- Facturación (sus facturas)
- Chat Empleados
- Correo
- Notificaciones
- Documentos
- Asistente IA
- Sugerencias
- Privacidad y Términos
- Perfil
- Configuración

**NO puede ver:**
- Gestión de Clientes
- Rutas
- Productos y Stock
- Incidencias
- Hoja de Ruta / Pedidos / Cuadrante
- Perfil Empresa / Empleados / Combustible / Estadísticas / Hoja de Cálculo / Calendario / Control Horario

## Cómo Asignar Roles
1. Los usuarios se autentican con Supabase Auth (email/contraseña)
2. Al crear un usuario en **profiles**, asignar el campo `role`:
   - `'Administrador'` → rol **Empresa**
   - `'Empleado'` o `'Repartidor'` → rol **Empleado**
   - `'Cliente'` → rol **Cliente**
3. El sistema normaliza automáticamente estos valores

## Próximos Pasos
1. Implementar login real con Supabase Auth
2. Crear flujo de registro por rol
3. Publicación móvil / App Stores
