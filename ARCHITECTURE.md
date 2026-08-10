# PickingUp! Administración — Mapa de Arquitectura Completo

> **Propósito**: Este documento es la única fuente de verdad técnica del proyecto.
> Leer solo este archivo es suficiente para entender la arquitectura, componentes, esquemas de base de datos en Supabase y cómo extender la aplicación.
>
> **Última actualización**: 2026-08-05 — v5.00 (sincronizado con schema.sql real)

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework UI | React 18 + TypeScript |
| Bundler | Vite 6 |
| Backend/Auth/DB | Supabase (`@supabase/supabase-js ^2.48.1`) |
| Íconos | `lucide-react ^0.474.0` |
| Estilos | CSS Theme Variables (`var(--bg-surface)`, `var(--brand-blue)`) + Vanilla CSS |
| Fuentes | Plus Jakarta Sans + Inter (Google Fonts) |
| Aislamiento | Multi-Tenant Scoped Isolation por `store_id` |
| POS Offline | IndexedDB vía `OfflinePOSStore.ts` + Auto-Sync Supabase |
| Impresión | ESC/POS binario vía WebUSB (`ThermalPrinterService.ts`) |

---

## Grafo de Dependencias del Proyecto

```
index.html
  └── src/main.tsx
        └── src/App.tsx                          ← Raíz de la aplicación
              ├── config/appConfig.ts             ← Configuración centralizada de marca
              ├── context/AuthContext.tsx          ← Auth Supabase + Registro con Negocio + Modo Demo
              ├── context/TenantContext.tsx        ← Estado multi-tenant (stores aisladas)
              ├── context/NotificationContext.tsx  ← Notificaciones reales (DB + State)
              ├── lib/supabase.ts                  ← Cliente Supabase singleton
              │
              ├── services/
              │     ├── OfflinePOSStore.ts         ← Motor IndexedDB, cola offline y auto-sync
              │     ├── ThermalPrinterService.ts   ← Comandos ESC/POS, WebUSB 80mm, cajón RJ11
              │     └── AuditLoggerService.ts      ← Auditoría de cambios de precio (inmutable)
              │
              ├── components/Auth/
              │     ├── LoginForm.tsx              ← Login / Registro de Propietario + Comercio
              │     └── StoreSelector.tsx          ← Modal de selección / Alta de sucursales
              │
              ├── components/Layout/
              │     ├── Header.tsx                 ← Barra superior + selector de tienda
              │     └── Sidebar.tsx                ← Menú lateral colapsable con acordeones
              │
              ├── components/Dashboard/
              │     ├── ModuleGrid.tsx             ← Grilla de los 9 módulos (cargados desde modules + module_actions en DB)
              │     ├── FavoritesBar.tsx           ← Accesos rápidos (Supabase user_favorites)
              │     └── CommandPalette.tsx         ← Búsqueda global (Ctrl+K)
              │
              └── components/Modals/
                    ├── ActionModal.tsx                   ← Ruteo por slug + React.lazy() + Suspense
                    ├── PriceListsModal.tsx               ← Listas de precios + importador CSV/Excel
                    ├── CashRegisterMonitoringModal.tsx   ← Monitoreo de cajas en vivo (Realtime)
                    ├── CashRegisterConfigModal.tsx       ← Configuración de cajas por comercio
                    ├── CajaCentralModal.tsx              ← Caja central: cierres, transferencias, movimientos
                    ├── InventoryManagementModal.tsx      ← Inventario: ingresos, egresos, ajustes, transferencias
                    ├── ArticlesManagementModal.tsx       ← CRUD de Artículos, rubros, familias, EAN
                    ├── InventoryReconciliationModal.tsx  ← Conciliación: stock teórico vs. físico + auto-ajuste
                    ├── ReportsAnalyticsModal.tsx         ← KPIs, stock bajo mínimo, exportación CSV detallada
                    ├── SuppliersManagementModal.tsx      ← Proveedores, cuentas corrientes, pagos
                    ├── POSTerminalModal.tsx              ← Terminal POS (modo cajero, offline, auto-sync)
                    ├── PriceAuditLogsModal.tsx           ← Historial de auditoría de precios
                    ├── ExecutiveDashboardModal.tsx       ← Dashboard ejecutivo con KPIs reales desde DB
                    ├── UserPermissionsModal.tsx          ← Gestión de cajeros y roles
                    ├── UserProfileModal.tsx              ← Perfil de usuario
                    ├── ConfiguracionModal.tsx            ← Config: soporte, bonificaciones, propiedades MM
                    └── OtrosModal.tsx                    ← Bancos, tipo de cambio, vales, exportaciones
```

---

## Flujo de Autenticación y Roles

```
supabase.auth.signIn()
    │
    ├── store_members.role = 'owner'      → Acceso total a todos los módulos
    ├── store_members.role = 'admin'      → Acceso total, excepto gestión de propietario
    ├── store_members.role = 'supervisor' → Acceso a reportes, inventario, cajas (sin config)
    └── store_members.role = 'operador'   → Solo POS Terminal (modo cajero)
```

**Registro automático (DB Trigger `on_auth_user_created`):**
1. Se crea el usuario en `auth.users`.
2. El trigger `handle_new_user()` verifica si el registro incluye `store_name` en los metadatos:
   - Si incluye `store_name` (creación de comercio), crea el registro en `public.profiles` con rol `owner`, genera un registro en `public.stores` con slug único seguro (`substr(gen_random_uuid(), 1, 8)`) y una membresía en `public.store_members` con rol `owner`.
   - Si no incluye `store_name` (invitaciones a comercios existentes), asigna el rol indicado en metadatos o `operador` por defecto en `public.profiles`.

**Cajeros (`operador`):** Son creados por `owner`/`admin` desde `UserPermissionsModal`. El flujo correcto es: invitar al cajero por email (Supabase Auth) → el `user_id` retornado se inserta en `store_members`.

**Modo Demo:** Si la autenticación falla o se activa explícitamente, `AuthContext` activa `isDemoMode = true`, que deshabilita todas las escrituras a Supabase y usa localStorage como única fuente.

---

## Módulos de la Aplicación (slugs)

Los módulos y acciones se almacenan en las tablas `public.modules` y `public.module_actions` en Supabase. `ModuleGrid.tsx` los carga desde DB al iniciar.

| Módulo | Slug | Acciones (slugs) | Color |
|--------|------|------------------|-------|
| Precios | `precios` | `cambio-puntual`, `cambio-masivo`, `listas-precios`, `cambio-rapido` | red |
| Distribuciones | `distribuciones` | `distribuir-precios`, `monitoreo-cajas` | green |
| Inventario | `inventario` | `gestion-inventario`, `conciliacion` | purple |
| Artículos | `articulos` | `rubros`, `articulos-list`, `baja-articulos`, `familias-subfamilias` | blue |
| Proveedores | `proveedores` | `prov-cta-cte`, `ingreso-comprobantes`, `gestion-proveedores`, `admin-cta-cte` | orange |
| Reportes | `reportes` | `reportes-analytics` | sky |
| Caja Central | `caja-central` | `cierre-cajeros`, `cuenta-corriente-caja`, `movimientos-caja`, `admin-aranceles` | lime |
| Configuración | `configuracion` | `autorizar-soporte`, `diseno-etiquetas`, `bonificaciones`, `propiedades-mm`, `configuracion-backend` | rose |
| Otros | `otros` | `bancos`, `tipo-cambio`, `ingresos-egresos`, `cuentas`, `vales-compra`, `exportaciones` | teal |

---

## Lógica de Listas de Precios y Artículos (Multi-Lista)

1. **Lista 1 (Base):** Almacenada en `articles.price`. Es el precio de referencia por defecto.
2. **Listas Secundarias:** Almacenadas en `price_list_items` (`price_list_id`, `article_code`, `custom_price`). Si no tienen precio específico, toman el precio base automáticamente.
3. **Desde Artículos:** `ArticlesManagementModal.tsx` muestra Precio Base + inputs por cada lista secundaria en el formulario de Alta/Edición.
4. **Desde Precios:** `Cambio Puntual` edita una lista objetivo. `Cambio Masivo` aplica porcentaje al precio base y a todas las listas secundarias existentes.

---

## Supabase Realtime — Patrón de Canal

`CashRegisterMonitoringModal.tsx` usa Supabase Realtime para actualizaciones en vivo:

```typescript
const channel = supabase
  .channel('sales-monitoring')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'sales',
    filter: `store_id=eq.${activeStore.id}`,
  }, () => loadMonitoringData())
  .subscribe();

// Cleanup obligatorio en useEffect return
return () => { supabase.removeChannel(channel); };
```

> **Regla**: Siempre limpiar el canal en el `return` del `useEffect` para evitar memory leaks y suscripciones duplicadas.

---

## Servicios

### `OfflinePOSStore.ts` — Motor POS Offline
- Almacena ventas en **IndexedDB** cuando no hay conexión.
- Cola de sincronización: al detectar reconexión, envía ventas pendientes a `public.sales` + `public.sales_items`.
- `movement_type` usa el string exacto `'Egreso'` para compatibilidad con RLS.

### `ThermalPrinterService.ts` — Impresión Térmica
- Genera comandos binarios **ESC/POS** para impresoras de 80mm.
- Impresión directa vía **WebUSB** (sin drivers).
- Soporte de apertura de cajón de dinero por pulso RJ11.

### `AuditLoggerService.ts` — Auditoría de Precios
- Registra cada cambio de precio en `public.price_audit_logs` (inmutable).
- Fallback a localStorage si Supabase no está disponible.

---

## Base de Datos Supabase — Esquema Completo (sincronizado con schema.sql)

> Todas las tablas usan RLS (Row Level Security). Las políticas se crean con `DROP POLICY IF EXISTS` para ser idempotentes.

### Tablas de Identidad y Tenancy

#### `public.stores` — Comercios/Sucursales
`id` UUID PK, `name` TEXT, `slug` TEXT UNIQUE, `logo_url` TEXT, `code` TEXT UNIQUE, `plan` TEXT (`standard`/`pro`/`enterprise`), `is_active` BOOLEAN, `created_at` TIMESTAMPTZ.

**Stores pre-cargados (seed):**
| id prefijo | nombre | code | plan |
|---|---|---|---|
| `11111111...` | PICKING & DELIVERING UP! S.A. | UP-001 | enterprise |
| `22222222...` | SUPERMERCADOS CENTRAL SUR | CS-002 | pro |
| `33333333...` | EXPRESS MARKET NORTE | EM-003 | standard |

#### `public.store_members` — Relación Usuario ↔ Comercio
`id` UUID PK, `store_id` UUID FK → stores, `user_id` UUID FK → auth.users, `role` TEXT (`owner`/`admin`/`supervisor`/`operador`), `is_active` BOOLEAN, `created_at` TIMESTAMPTZ.
**UNIQUE**: `(store_id, user_id)`

#### `public.profiles` — Perfil de Usuario (espejo de auth.users)
`id` UUID PK → auth.users, `email` TEXT UNIQUE, `full_name` TEXT, `avatar_url` TEXT, `role` TEXT, `active_store_id` UUID FK → stores, `created_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ.
> Creado automáticamente por el trigger `on_auth_user_created`.

---

### Tablas de Catálogo de Módulos (datos estáticos de la app)

#### `public.modules` — Módulos del Sistema
`id` UUID PK, `name` TEXT, `slug` TEXT UNIQUE, `icon` TEXT (lucide name), `color_theme` TEXT, `sort_order` INT, `created_at` TIMESTAMPTZ.

#### `public.module_actions` — Acciones por Módulo
`id` UUID PK, `module_id` UUID FK → modules, `name` TEXT, `slug` TEXT UNIQUE, `description` TEXT, `icon` TEXT, `sort_order` INT, `created_at` TIMESTAMPTZ.

---

### Tablas de Negocio Multi-Tenant

#### `public.articles` — Productos por Comercio
`id` UUID PK, `store_id` UUID FK, `code` TEXT, `barcode` TEXT, `description` TEXT, `category` TEXT, `family` TEXT, `subfamily` TEXT, `price` NUMERIC(10,2), `cost` NUMERIC(10,2), `stock` INT, `min_stock` INT, `is_active` BOOLEAN, `is_priority_pricing` BOOLEAN, `created_at` TIMESTAMPTZ.
**UNIQUE**: `(store_id, code)`

#### `public.price_lists` — Listas de Precios por Comercio
`id` UUID PK, `store_id` UUID FK, `code` INT, `name` TEXT, `type` TEXT (`normal`/`porcentual`), `discount_percent` NUMERIC(5,2), `base_list_name` TEXT, `generate_labels` BOOLEAN, `visible_in_pos` BOOLEAN, `round_prices` BOOLEAN, `is_default` BOOLEAN, `created_at` TIMESTAMPTZ.
**UNIQUE**: `(store_id, code)`

#### `public.price_list_items` — Sobreescrituras de Precio por Producto y Lista
`id` UUID PK, `price_list_id` UUID FK → price_lists (CASCADE), `article_id` UUID FK → articles (CASCADE), `article_code` TEXT, `custom_price` NUMERIC(10,2), `created_at` TIMESTAMPTZ.
**UNIQUE**: `(price_list_id, article_id)`

#### `public.price_audit_logs` — Auditoría de Cambios de Precio (inmutable)
`id` UUID PK, `store_id` UUID FK → stores, `article_id` UUID FK → articles (SET NULL), `article_code` TEXT, `article_description` TEXT, `price_list_name` TEXT, `old_price` NUMERIC(12,2), `new_price` NUMERIC(12,2), `reason` TEXT, `user_email` TEXT, `created_at` TIMESTAMPTZ.

#### `public.cash_registers` — Configuración de Cajas por Tienda
`id` UUID PK, `store_id` UUID FK, `code` TEXT, `name` TEXT, `cashier_name` TEXT, `version` TEXT (default: `v10.3.20 (iPOS-Android)`), `default_price_list_name` TEXT, `allowed_price_list_names` TEXT[], `is_active` BOOLEAN, `created_at` TIMESTAMPTZ.
**UNIQUE**: `(store_id, code)`

#### `public.stock_movements` — Cabecera de Movimientos de Inventario
`id` UUID PK, `store_id` UUID FK, `movement_type` TEXT (`Ingreso`/`Egreso`/`Ajuste de Stock`/`Transferencia`), `observations` TEXT, `total_units` NUMERIC(10,2), `created_by` UUID FK → auth.users, `created_at` TIMESTAMPTZ.

#### `public.stock_movement_items` — Ítems por Movimiento
`id` UUID PK, `movement_id` UUID FK → stock_movements (CASCADE), `article_id` UUID FK → articles (SET NULL), `article_code` TEXT, `article_description` TEXT, `qty` NUMERIC(10,2), `unit_price` NUMERIC(10,2), `total_price` NUMERIC(12,2), `created_at` TIMESTAMPTZ.

#### `public.suppliers` — Proveedores por Comercio
`id` UUID PK, `store_id` UUID FK, `code` TEXT, `name` TEXT, `cuit` TEXT, `phone` TEXT, `email` TEXT, `address` TEXT, `vat_condition` TEXT, `balance` NUMERIC(12,2), `is_active` BOOLEAN, `created_at` TIMESTAMPTZ.
**UNIQUE**: `(store_id, code)`

#### `public.supplier_invoices` — Facturas de Compra
`id` UUID PK, `store_id` UUID FK, `supplier_id` UUID FK → suppliers (CASCADE), `invoice_number` TEXT, `invoice_type` TEXT (`Factura A`/`B`/`C`/`Nota de Débito`), `amount` NUMERIC(12,2), `paid_amount` NUMERIC(12,2), `status` TEXT (`Pendiente`/`Pagado Parcial`/`Pagado`), `issue_date` TIMESTAMPTZ, `created_at` TIMESTAMPTZ.

#### `public.supplier_payments` — Pagos a Proveedores
`id` UUID PK, `store_id` UUID FK, `supplier_id` UUID FK → suppliers (CASCADE), `invoice_id` UUID FK → supplier_invoices (SET NULL), `payment_method` TEXT (`Efectivo`/`Transferencia`/`Cheque`), `amount` NUMERIC(12,2), `reference_number` TEXT, `notes` TEXT, `created_by` UUID FK → auth.users, `created_at` TIMESTAMPTZ.

---

### Tablas Auxiliares Enterprise

#### `public.card_tariffs` — Aranceles de Tarjetas
`id` UUID PK, `store_id` UUID FK, `name` TEXT, `code` TEXT, `type` TEXT (`Credito`/`Debito`), `fee_percent` NUMERIC(5,2), `accreditation_days` INT, `is_active` BOOLEAN, `created_at` TIMESTAMPTZ.

#### `public.cash_movements` — Movimientos de Caja Central
`id` UUID PK, `store_id` UUID FK, `movement_type` TEXT, `amount` NUMERIC(12,2), `cashier_name` TEXT, `concept` TEXT, `register_code` TEXT, `created_at` TIMESTAMPTZ.

#### `public.bank_accounts` — Cuentas Bancarias (módulo Otros)
`id` UUID PK, `store_id` UUID FK, `bank_name` TEXT, `account_type` TEXT (`Cuenta Corriente`/`Caja de Ahorro`), `account_number` TEXT, `cbu` TEXT, `balance` NUMERIC(12,2), `created_at` TIMESTAMPTZ.

#### `public.currency_rates` — Cotizaciones de Divisas (módulo Otros)
`id` UUID PK, `store_id` UUID FK, `currency` TEXT, `symbol` TEXT, `rate` NUMERIC(12,4), `updated_at` TIMESTAMPTZ.

#### `public.cash_flows` — Ingresos/Egresos No Operativos (módulo Otros)
`id` UUID PK, `store_id` UUID FK, `flow_type` TEXT, `category` TEXT, `concept` TEXT, `amount` NUMERIC(12,2), `created_at` TIMESTAMPTZ.

#### `public.purchase_vouchers` — Vales de Compra (módulo Otros)
`id` UUID PK, `store_id` UUID FK, `code` TEXT, `customer_name` TEXT, `amount` NUMERIC(12,2), `status` TEXT (`Activo`/`Usado`/`Vencido`), `created_at` TIMESTAMPTZ.

#### `public.discount_rules` — Reglas de Bonificación (módulo Configuración)
`id` UUID PK, `store_id` UUID FK, `name` TEXT, `discount_percent` NUMERIC(5,2), `min_amount` NUMERIC(12,2), `applies_to` TEXT, `is_active` BOOLEAN, `created_at` TIMESTAMPTZ.

#### `public.custom_properties` — Propiedades MM Personalizadas (módulo Configuración)
`id` UUID PK, `store_id` UUID FK, `field_name` TEXT, `field_type` TEXT (`Texto`/`Número`/`Fecha`), `is_required` BOOLEAN, `created_at` TIMESTAMPTZ.

---

### Tablas de Sistema

#### `public.user_favorites` — Accesos Rápidos por Usuario y Comercio
`id` UUID PK, `store_id` UUID FK, `user_id` UUID FK → auth.users, `action_slug` TEXT, `created_at` TIMESTAMPTZ.
**UNIQUE**: `(store_id, user_id, action_slug)`

#### `public.notifications` — Notificaciones del Sistema
`id` UUID PK, `store_id` UUID FK, `user_id` UUID FK → auth.users, `title` TEXT, `message` TEXT, `type` TEXT (`info`/`success`/`warning`/`error`), `is_read` BOOLEAN, `created_at` TIMESTAMPTZ.

---

## Persistencia de Datos — Estrategia Dual

> **Regla fundamental**: Supabase es la fuente de verdad. `localStorage` es caché de último recurso para modo offline/demo únicamente.

| Entidad | localStorage (caché/fallback) | Supabase DB (fuente de verdad) |
|---------|-------------------------------|-------------------------------|
| Artículos / Catálogo | `pickingup_prodprices_${storeKey}` | `public.articles` |
| Listas de Precios | `pickingup_pricelists_${storeKey}` | `public.price_lists` |
| Items de Listas | `custom_prices` en objeto artículo | `public.price_list_items` |
| Favoritos | `pickingup_favs_${userId}_${storeId}` | `public.user_favorites` |
| Cajas | `pickingup_registers_${storeKey}` | `public.cash_registers` |
| Proveedores | `pickingup_suppliers_${storeKey}` | `public.suppliers` |
| Comprobantes Compra | `pickingup_supplier_invoices_${storeKey}` | `public.supplier_invoices` |
| Pagos Proveedores | `pickingup_supplier_payments_${storeKey}` | `public.supplier_payments` |
| Movimientos de Stock | — | `public.stock_movements` + `stock_movement_items` |
| Ventas POS | IndexedDB (offline queue) | `public.sales` + `public.sales_items` |
| Movimientos de Caja | — | `public.cash_movements` |
| Cuentas Bancarias | — | `public.bank_accounts` |
| Cotizaciones | — | `public.currency_rates` |
| Ingresos/Egresos | — | `public.cash_flows` |
| Vales de Compra | — | `public.purchase_vouchers` |
| Aranceles de Tarjetas | — | `public.card_tariffs` |
| Reglas de Bonificación | — | `public.discount_rules` |
| Propiedades MM | — | `public.custom_properties` |
| Notificaciones | — | `public.notifications` |
| Auditoría de Precios | fallback local | `public.price_audit_logs` |
| Módulos/Acciones | — | `public.modules` + `public.module_actions` |

---

## Contextos de Estado (React Contexts)

- **`AuthContext.tsx`**: Administra la sesión de Supabase Auth, login/registro de propietario + comercio, modo demo fallback. Expone `user`, `isDemoMode`, `logout`.
- **`TenantContext.tsx`**: Administra la sucursal/comercio activo (`activeStore`) y el cambio entre tiendas. `selectedListId` se resetea automáticamente al cambiar de tienda.
- **`NotificationContext.tsx`**: Administra las notificaciones de sistema reales persistidas en `public.notifications` y en estado local. Expone `addNotification`, `markAsRead`.

---

## Convenciones de Código

- **Hooks**: Todos los `useState`/`useEffect`/`useContext` deben declararse **antes** de cualquier `return` condicional (regla de Hooks de React).
- **Slugs**: Los slugs de módulo/acción son la unidad atómica de navegación. No hardcodear rutas; usar siempre el slug.
- **Notificaciones**: Usar siempre `addNotification({ type, title, message })` en lugar de `alert()` o `console.log`.
- **Valores iniciales**: Los estados que se cargan desde Supabase deben inicializarse con `[]` o `null`, nunca con datos ficticios hardcodeados.
- **Fallback $0**: Si no hay datos en Supabase, mostrar `$0` o `"Sin datos"`, nunca un valor inventado.
- **Realtime**: Todo canal de Supabase debe limpiarse con `supabase.removeChannel()` en el `return` del `useEffect`.
- **RLS & Multi-Tenant Isolation**: Todas las tablas poseen RLS habilitado con granularidad estricta por operación:
  - **Lectura (`SELECT`)**: Todos los miembros activos de la tienda vía `public.get_my_store_ids()`.
  - **Gestión Operativa (`INSERT`/`UPDATE`/`DELETE`)**: Restringido a roles de gestión (`owner`, `admin`, `supervisor`) vía `public.get_my_management_store_ids()`.
  - **Gestión Administrativa (`stores`, `store_members`, `bank_accounts`, `card_tariffs`, `discount_rules`)**: Restringido a `owner` y `admin` únicamente vía `public.get_my_admin_store_ids()`.
- **Actualización Atómica de Stock**: Los movimientos registrados en `stock_movement_items` desencadenan el trigger `apply_stock_movement()`, que actualiza `articles.stock` atómicamente en PostgreSQL dentro de la misma transacción SQL.
- **Protección de Propietario (`prevent_last_owner_deletion()`)**: Impide la eliminación o desactivación del último propietario de un comercio, protegiendo contra comercios huérfanos.
- **Soporte Auditable de Plataforma (`platform_admins`)**: La tabla `public.platform_admins` y la función `is_platform_admin()` otorgan acceso de soporte técnico auditable sin exponer service keys.
- **Soft-Delete Financiero**: Facturas y pagos a proveedores utilizan `is_active` y `deleted_at` para preservar comprobantes contables.
- **Recomendaciones Operativas**: Se recomienda activar Point-in-Time Recovery (PITR) en Supabase para respaldos continuos y habilitar Rate-Limiting/CAPTCHA en Supabase Auth Dashboard.
