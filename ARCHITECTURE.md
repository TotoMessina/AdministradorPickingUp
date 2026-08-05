# PickingUp! Administración — Mapa de Arquitectura Completo

> **Propósito**: Este documento es la única fuente de verdad técnica del proyecto.
> Leer solo este archivo es suficiente para entender la arquitectura, componentes, esquemas de base de datos en Supabase y cómo extender la aplicación.
>
> **Última actualización**: 2026-08-01 — v3.00 (Pure Supabase DB Persistence)

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

---

## Grafo de Dependencias del Proyecto

```
index.html
  └── src/main.tsx
        └── src/App.tsx                      ← Raíz de la aplicación
              ├── config/appConfig.ts        ← Configuración centralizada de marca (PickingUp! Administración)
              ├── context/AuthContext.tsx     ← Auth Supabase + Registro con Negocio + Modo Demo
              ├── context/TenantContext.tsx   ← Estado multi-tenant (stores aisladas)
              ├── context/NotificationContext.tsx ← Notificaciones reales de sistema (DB + State)
              ├── lib/supabase.ts             ← Cliente Supabase singleton
              │
              ├── components/Auth/
              │     ├── LoginForm.tsx         ← Login / Registro de Propietario + Comercio
              │     └── StoreSelector.tsx     ← Modal de selección / Alta de sucursales
              │
              ├── components/Layout/
              │     ├── Header.tsx            ← Barra superior (PickingUp! + selector de tienda + hamburger toggle)
              │     └── Sidebar.tsx           ← Menú lateral colapsable con acordeones cerrados por defecto
              │
              ├── components/Dashboard/
              │     ├── ModuleGrid.tsx        ← Grilla principal de módulos alineada a los 9 módulos oficiales (Precios, Distribuciones, Inventario, Artículos, Proveedores, Reportes, Caja Central, Configuración, Otros)
              │     ├── FavoritesBar.tsx      ← Accesos rápidos con persistencia permanente en tabla Supabase user_favorites + localStorage v2
              │     └── CommandPalette.tsx    ← Búsqueda global interactiva (Ctrl+K)
              │
              └── components/Modals/
                    ├── ActionModal.tsx                  ← Ejecución operacional con ruteo estricto por slug y Code Splitting dinámico con React.lazy() + Suspense
                    ├── PriceListsModal.tsx              ← Gestión de listas de precios, redondeo e importador CSV/Excel
                    ├── CashRegisterMonitoringModal.tsx  ← Monitoreo de cajas en vivo (versión POS, lista aplicada, tickets y totales)
                    ├── CashRegisterConfigModal.tsx      ← Configuración de cajas por comercio (múltiples listas de precios permitidas por caja)
                    ├── InventoryManagementModal.tsx     ← Gestión de inventario (ingresos, egresos, ajustes, transferencias)
                    ├── ArticlesManagementModal.tsx      ← Módulo de Artículos CRUD completo (catalogo, rubros, familias, precios por lista)
                    ├── InventoryReconciliationModal.tsx  ← Conciliación de inventario (stock teórico vs. físico + auto-ajuste)
                    ├── ReportsAnalyticsModal.tsx        ← Reportes & Analytics (stock bajo mínimo, movimientos por período, sin precio)
                    ├── SuppliersManagementModal.tsx      ← Gestión de Proveedores & Cuentas Corrientes (comprobantes, saldos a favor y pagos)
                    ├── POSTerminalModal.tsx              ← Terminal POS Aislada (Modo Cajero Persistente con motor Offline IndexedDB + Auto-Sync Supabase)
├── services/OfflinePOSStore.ts       ← Motor de almacenamiento local IndexedDB, cola de ventas offline y auto-sincronizador
├── services/ThermalPrinterService.ts ← Motor de comandos binarios ESC/POS, impresión directa WebUSB 80mm e impulso de apertura de cajón de dinero (RJ11)
├── services/AuditLoggerService.ts    ← Servicio de auditoría histórica inmutable de cambios de precio (Supabase price_audit_logs + LocalStorage)
├── components/Modals/PriceAuditLogsModal.tsx ← Gestor visual de historial de auditoría de precios por usuario, fecha, variación % y motivos
                    ├── UserProfileModal.tsx             ← Modal de perfil de usuario
                    └── UserPermissionsModal.tsx         ← Gestión de permisos y roles de usuarios
```

---

## Módulos de la Aplicación (slugs)

La grilla del Dashboard carga módulos desde `MODULE_GROUPS` en `ModuleGrid.tsx`. Cada módulo agrupa acciones con slugs únicos delegados en `ActionModal.tsx`.

| Módulo | Slug módulo | Acciones (slugs) | Estado |
|--------|-------------|------------------|--------|
| Precios | `precios` | `cambio-puntual`, `cambio-masivo`, `listas-precios`, `cambio-rapido` | ✅ Implementado |
| Distribuciones | `distribuciones` | `distribuir-precios`, `monitoreo-cajas`, `venta-pos` | ✅ Implementado |
| Inventario | `inventario` | `gestion-inventario`, `conciliacion` | ✅ Implementado |
| Artículos | `articulos` | `rubros`, `articulos-list`, `baja-articulos`, `familias-subfamilias` | ✅ Implementado |
| Proveedores | `proveedores` | `prov-cta-cte`, `ingreso-comprobantes`, `gestion-proveedores`, `admin-cta-cte` | ✅ Implementado |
| Reportes | `reportes` | `reportes-analytics` | ✅ Implementado |
| Caja Central | `caja-central` | `cierre-cajeros`, `cuenta-corriente-caja`, `movimientos-caja`, `admin-aranceles` | ✅ Implementado |
| Configuración | `configuracion` | `configuracion-cajas`, `autorizar-soporte`, `diseno-etiquetas`, `bonificaciones`, `propiedades-mm`, `configuracion-backend` | ✅ Implementado |
| Otros | `otros` | `bancos`, `tipo-cambio`, `ingresos-egresos`, `cuentas`, `vales-compra`, `exportaciones` | ✅ Implementado |

---

## Lógica de Listas de Precios y Artículos (Multi-Lista)

La arquitectura de precios diferencia entre el **Precio Base** y las **Sobreescrituras por Lista Secundaria**:

1. **Lista 1 (Predeterminada / Base)**:
   - Almacenada directamente en el campo `price` de la tabla `public.articles` y en `base_price` de `localStorage`.
   - Sirve como precio de referencia por defecto para todas las operaciones y punto de partida si una lista secundaria no tiene precio personalizado.

2. **Listas Secundarias (Listas 2, 3, Mayorista, POS, etc.)**:
   - Almacenadas en la tabla `public.price_list_items` (`price_list_id`, `article_code`, `custom_price`) y en el objeto `custom_prices: Record<string, number>` de cada artículo en `localStorage`.
   - Si una lista secundaria **no tiene un precio específico configurado**, el sistema toma el **Precio Base** del artículo automáticamente.

3. **Modificación de Precios desde el Módulo de Artículos (`ArticlesManagementModal.tsx`)**:
   - La grilla incluye un selector de lista (`🏷️ Ver Precios en Lista: [Lista Base | Lista Mayorista | ...]`) que recalcula el precio mostrado para cada artículo.
   - El formulario de Alta/Edición muestra el **Precio Base (Lista 1)** e inputs individuales para cada **Lista Secundaria**, permitiendo definir precios diferenciados desde una sola pantalla.

4. **Modificación de Precios desde el Módulo de Precios (`ActionModal.tsx`)**:
   - `Cambio Puntual`: Muestra una insignia clara con el **Precio Base** y el nombre de la **Lista Objetivo Seleccionada**.
   - `Cambio Masivo`: Aplica el porcentaje tanto al precio base como a todas las listas secundarias existentes para mantener la paridad.

---

## Módulo de Artículos — CRUD Completo

Componente: `ArticlesManagementModal.tsx`

- **Catálogo Activo**: Listado paginado de productos activos con buscador (código, EAN, descripción), filtro por rubro y filtro de estado (stock bajo, sin precio).
- **Rubros y Familias**: Gestor dinámico de categorías principales y secundarias.
- **Desactivados**: Pestaña dedicada a administrar productos dados de baja lógica, con opción de restauración en 1 clic o eliminación permanente.
- **Generador EAN**: Autogenerador de código de barras numérico válido (`779...`).

---

## Módulo de Conciliación de Inventario

Componente: `InventoryReconciliationModal.tsx`

- **Grilla de Comparación**: Muestra Stock Teórico (sistema) vs Conteo Físico Real (ingresado por el usuario).
- **Varianza**: Calcula diferencia en unidades e impacto monetario ($).
- **Auto-Ajuste de 1-Clic**: Genera automáticamente un movimiento de `Ajuste de Stock` en la base de datos Supabase e incrementa/decrementa el stock teórico para alinearlo al real.
- **Plantilla CSV**: Descarga plantilla `.csv` con catálogo actual para toma de inventario físico en papel/tablet.

---

## Módulo de Reportes & Analytics

Componente: `ReportsAnalyticsModal.tsx`

- **Tarjetas KPI**: Valuación total de inventario a precio de venta y costo, artículos totales, stock en estado crítico y productos sin precio asignado ($0).
- **Reporte Stock Bajo**: Tabla de alertas con insignias de reposición.
- **Movimientos por Período**: Registro histórico filtrable por fecha (Hoy, 7 Días, Mes Actual).
- **Sin Precio Asignado**: Listado prioritario para asignación de precios antes de la venta.

---

## Módulo de Proveedores y Cuentas Corrientes

Componente: `SuppliersManagementModal.tsx`

- **Gestión de Proveedores**: CRUD completo con CUIT, Razón Social, Teléfono, Email, Dirección, Condición IVA y Saldo Adeudado.
- **Cuentas Corrientes & Pagos**:
  - **Métricas KPI**: Deuda Total con Proveedores, Saldo a Favor Crédito Total acumulado y Pagos emitidos del mes.
  - **Formulario 💸 Registrar Pago**: Imputación de pago (Efectivo, Transferencia Bancaria, Cheque) que resta del saldo adeudado del proveedor.
  - **Soporte Saldo a Favor**: Si el monto pagado supera la deuda existente, el balance queda en valor negativo (`-$X.XX`), reflejándose como **Crédito a Favor** del comercio para futuras facturas.
- **Ingreso de Comprobantes**: Alta rápida de Facturas A, B, C o Notas de Débito que incrementan la deuda del proveedor en cuenta corriente.

---

## Base de Datos Supabase — Esquema Multi-Tenant con RLS Idempotente

Todas las políticas RLS utilizan `DROP POLICY IF EXISTS` para garantizar ejecución idempotente.

### Tablas Principales

#### `public.stores` — Comercios/Sucursales
`id` (UUID PK), `name` (TEXT), `slug` (TEXT UNIQUE), `code` (TEXT UNIQUE), `plan` (TEXT).

#### `public.store_members` — Relación Usuario y Comercio
`id` (UUID PK), `store_id` (UUID FK), `user_id` (UUID FK), `role` (`owner` / `admin` / `supervisor` / `operador`), `is_active` (BOOLEAN).

#### `public.articles` — Productos por Comercio
`id` (UUID PK), `store_id` (UUID FK), `code` (TEXT), `barcode` (TEXT), `description` (TEXT), `category` (TEXT), `family` (TEXT), `subfamily` (TEXT), `price` (NUMERIC), `cost` (NUMERIC), `stock` (INT), `min_stock` (INT), `is_active` (BOOLEAN), `is_priority_pricing` (BOOLEAN), `created_at` (TIMESTAMPTZ).
**UNIQUE**: `(store_id, code)`

#### `public.price_lists` — Listas de Precios por Comercio
`id` (UUID PK), `store_id` (UUID FK), `code` (INT), `name` (TEXT), `type` (`normal` / `porcentual`), `discount_percent` (NUMERIC), `base_list_name` (TEXT), `generate_labels` (BOOLEAN), `visible_in_pos` (BOOLEAN), `round_prices` (BOOLEAN), `is_default` (BOOLEAN).
**UNIQUE**: `(store_id, code)`

#### `public.price_list_items` — Sobreescrituras de Precio por Producto y Lista
`id` (UUID PK), `price_list_id` (UUID FK → price_lists), `article_code` (TEXT), `custom_price` (NUMERIC).
**UNIQUE**: `(price_list_id, article_code)`

#### `public.suppliers` — Proveedores por Comercio
`id` (UUID PK), `store_id` (UUID FK), `code` (TEXT), `name` (TEXT), `cuit` (TEXT), `phone` (TEXT), `email` (TEXT), `address` (TEXT), `vat_condition` (TEXT), `balance` (NUMERIC), `is_active` (BOOLEAN), `created_at` (TIMESTAMPTZ).
**UNIQUE**: `(store_id, code)`

#### `public.supplier_invoices` — Facturas de Compra de Proveedores
`id` (UUID PK), `store_id` (UUID FK), `supplier_id` (UUID FK), `invoice_number` (TEXT), `invoice_type` (TEXT), `amount` (NUMERIC), `paid_amount` (NUMERIC), `status` (TEXT), `issue_date` (TIMESTAMPTZ).

#### `public.supplier_payments` — Pagos a Proveedores
`id` (UUID PK), `store_id` (UUID FK), `supplier_id` (UUID FK), `invoice_id` (UUID FK → supplier_invoices), `payment_method` (TEXT), `amount` (NUMERIC), `reference_number` (TEXT), `notes` (TEXT), `created_by` (UUID FK), `created_at` (TIMESTAMPTZ).

#### `public.cash_registers` — Configuración de Cajas por Tienda
`id` (UUID PK), `store_id` (UUID FK), `code` (TEXT), `name` (TEXT), `cashier_name` (TEXT), `version` (TEXT), `default_price_list_name` (TEXT), `allowed_price_list_names` (TEXT[]), `is_active` (BOOLEAN).
**UNIQUE**: `(store_id, code)`

#### `public.stock_movements` — Movimientos de Inventario
`id` (UUID PK), `store_id` (UUID FK), `movement_type` (TEXT: `Ingreso` / `Egreso` / `Ajuste de Stock` / `Transferencia`), `observations` (TEXT), `total_units` (NUMERIC), `created_by` (UUID FK), `created_at` (TIMESTAMPTZ).

#### `public.stock_movement_items` — Ítems por Movimiento
`id` (UUID PK), `movement_id` (UUID FK → stock_movements ON DELETE CASCADE), `article_code` (TEXT), `article_description` (TEXT), `qty` (NUMERIC), `unit_price` (NUMERIC), `total_price` (NUMERIC), `created_at` (TIMESTAMPTZ).

---

## Persistencia de Datos — Estrategia Dual

| Entidad | localStorage | Supabase DB |
|---------|-------------|-------------|
| Artículos / Catálogo | `pickingup_prodprices_${storeKey}` | `public.articles` |
| Listas de Precios | `pickingup_pricelists_${storeKey}` | `public.price_lists` |
| Items de Listas | `custom_prices` en objeto artículo | `public.price_list_items` |
| Favoritos | `pickingup_favs_${userId}_${storeId}` | `public.user_favorites` |
| Cajas | `pickingup_registers_${storeKey}` | `public.cash_registers` |
| Proveedores | `pickingup_suppliers_${storeKey}` | `public.suppliers` |
| Comprobantes Compra | `pickingup_supplier_invoices_${storeKey}` | `public.supplier_invoices` |
| Pagos Proveedores | `pickingup_supplier_payments_${storeKey}` | `public.supplier_payments` |
| Movimientos de Stock | — | `public.stock_movements` + `public.stock_movement_items` |

---

## Contextos de Estado (React Contexts)

- **`AuthContext.tsx`**: Administra la sesión de Supabase Auth, login/registro de propietario + comercio, y modo demo fallback.
- **`TenantContext.tsx`**: Administra la sucursal/comercio activo (`activeStore`) y el cambio entre tiendas. `selectedListId` se resetea automáticamente al cambiar de tienda activa.
- **`NotificationContext.tsx`**: Administra las notificaciones de sistema reales persistidas en Supabase (`public.notifications`) y en estado local.
